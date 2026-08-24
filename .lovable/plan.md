# Fix: new account sees another user's project + repeating "Failed to save setting"

## What's actually happening

Verified in source and against the backend:

- The last opened project id is stored in browser storage (`lastSelectedProjectId`) and is used directly as the active project id (`Index.tsx:648`, `activeProjectId = currentProject?.id || pendingProjectId`) **without checking that the signed-in user owns it**. After signing in with a new account in the same browser, every query and write still targets the previous account's project.
- Access rules on the backend are correct: reads of that project return empty (that's why the screen shows "No project selected"), and the settings write is rejected — the repeating red toast is that rejected write.
- The write repeats forever because of an unstable dependency: in `useBudgetSettings.ts` the query key array is rebuilt every render, so `saveSetting` changes identity every render, so the threshold save effect (`Index.tsx:719-725`) re-fires on every render. Each failure invalidates the query, which re-renders, which saves again — a loop.
- The "1,944 items loaded" / hour reconciliation numbers are in-memory state (`estimateData`) that is never cleared when the signed-in user changes. Nothing resets app state on sign-in/sign-out.

## The fix

**1. Only restore a project the current user owns**
- Stop using the stored id as the active project id. Derive `activeProjectId` from `currentProject` only, plus a *validated* pending id — i.e. use the stored id only once it has been matched against the user's project list.
- When the stored id is not in the user's project list (and the list has loaded), remove `lastSelectedProjectId` from browser storage.

**2. Reset app state when the signed-in user changes**
- Track the user id in `Index.tsx`. When it changes (sign-in as a different account, or sign-out), clear `currentProject`, `estimateData`, `filteredData`, custom mappings, verified systems, and the stored project id, and reset the threshold load gate refs.
- Clear the per-project `budget_*` browser-storage cache keys for the previous user on that transition so stale settings can't leak either.

**3. Stop the retry loop in settings saving**
- In `useBudgetSettings.ts`, memoize the query key so `saveSetting`/`getSetting` are stable across renders.
- On a failed save, do not invalidate the settings query (invalidation is what feeds the loop); keep the optimistic value, log, and show at most one toast per key using a short-lived failure guard.
- Skip the write entirely when the project is not in the user's own project list (defensive, so a mismatch degrades silently rather than spamming).

**4. Guard the seed migration**
- The one-shot `consolidation_thresholds` seed write (`Index.tsx:698-710`) should only run once the project is confirmed owned and loaded, not on a stale id.

## Verification

- Sign in as account A, open a project, sign out, sign in as new account B in the same browser: B lands on an empty state, no red toasts, no item counts or hour reconciliation carried over.
- Account A signs back in: their project still auto-restores.
- Changing a consolidation threshold on an owned project still persists and survives reload; only one write fires per change (network tab).

## Files touched

- `src/pages/Index.tsx` — project restore/ownership, user-change reset, seed guard
- `src/hooks/useBudgetSettings.ts` — stable query key, no invalidate-on-failure, toast de-dup
- possibly `src/hooks/useAuth.ts` — expose the user id transition if needed for the reset effect

No database or access-rule changes are needed; the backend is behaving correctly.
