# Fix: new account inherits the previous account's project id

## Gate question, answered

**No reload happened.** Evidence, from the request trace of that session:

- Every project-scoped read returned empty for the new account (`estimate_projects` → `[]`, `estimate_items` HEAD count, `system_mappings` and all mapping tables → `[]`), under the user id that the auth log shows signing up minutes earlier.
- There is no persistence for `estimateData` and no query-cache persister anywhere in `src/`. A hard reload would therefore have shown an empty screen with no banner.
- The banner and hour reconciliation were on screen, so that state predates the account switch inside the same tab.

Nothing crossed the access boundary. The backend rejected the write correctly. No database or access-rule change is part of this work.

## Loop driver, measured

The trace shows a strict POST → GET → POST → GET cadence at roughly one cycle per second: each rejected write is followed by a settings read. Invalidation is participating in the loop. Whether unstable render identity alone would also sustain it cannot be separated from that trace, so the fix memoizes the query key and leaves the invalidate-on-failure decision as a follow-up.

## PR A — validate the pending project id (the reported bug)

`Index.tsx:648` is the only place a project id reaches the app without an ownership check. The restore effect already validates against the user's own project list; line 648 bypasses it.

- Use the stored id as the active project id only once it has been matched against the loaded project list.
- When the list has loaded and does not contain the stored id, remove `lastSelectedProjectId`.

Effect for the reported case: the new account gets no active project id, `saveSetting` early-returns, no writes fire, no toasts.

## PR B — stabilize the settings query key

- Memoize the query key in `useBudgetSettings.ts` so `saveSetting` and `getSetting` keep a stable identity across renders, removing the per-render re-fire of the threshold save effect.
- Leave invalidate-on-failure in place for now; revisit once PR B's effect on write volume is observed on an owned project.

## PR C — reset app state on user change

- Track the signed-in user id in `Index.tsx`. On change (different account, or sign-out), clear `currentProject`, `estimateData`, `filteredData`, custom mappings, verified systems, the stored project id, and the threshold load-gate refs.
- Leave the `budget_*` browser-storage cache untouched. Those keys are project-scoped with no user recorded, so the only implementable purge would wipe account A's legitimate cache, and `getSetting` reads them as its migration fallback. With PR A in place a stale entry for an unreachable project is never read.

## Not in scope

The consolidation-thresholds seed effect is ref-guarded and runs once per project id. It is not part of the loop; guarding it further is separate hygiene.

## Verification

- PR A: sign in as a new account in a tab that previously held another account's project — no rejected writes in the network tab, no toasts, no active project id.
- PR A: the original account signs back in and their project still auto-restores.
- PR B: change a consolidation threshold on an owned project — exactly one write per change, value survives reload.
- PR C: after switching accounts in the same tab, the item count, hour reconciliation, and mappings are all empty.

## Files

- `src/pages/Index.tsx` — PR A, PR C
- `src/hooks/useBudgetSettings.ts` — PR B
