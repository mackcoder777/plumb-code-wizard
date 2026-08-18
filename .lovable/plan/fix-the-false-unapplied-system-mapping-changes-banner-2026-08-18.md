# Fix the false "unapplied system mapping changes" banner

## What's actually happening

The banner is not driven by whether systems are mapped. It compares two pieces of state:

- `mappings[system].laborCode` — the code currently shown in the dropdown
- `appliedSystems[system].appliedLaborCode` — the code that was in effect the last time items were re-coded

If those differ for any system, the banner appears — even when every system has a code and every item already carries that code.

Confirmed by reading `src/components/tabs/SystemMappingTab.tsx`:

- `hasUnappliedChanges` (line ~120) is that comparison.
- `appliedSystems` is only written in three places: DB load (line ~246), Apply All (line ~788), Apply single system (line ~885).
- Every other path that changes a code — dropdown change (`handleMappingChange`, ~383), bulk assign (~470), accept suggestion (~926), apply a smart suggestion (~553) — writes `mappings` and saves to the database, but never touches `appliedSystems`. So the banner latches on immediately and never clears until the user presses Apply, regardless of whether items were already re-coded by the background auto-apply pass in `Index.tsx`.

Database check across all projects: every `system_mappings` row already has `applied_at` set (0 rows unapplied), which confirms the persisted state is fine — the banner is purely a client-side staleness artifact.

## The fix

1. **Clear the stale flag when the code round-trips to the database.** In `handleMappingChange`, `handleBulkAssign`, `handleAcceptSuggestion`, and `applySystemSuggestions`, do not mark applied — instead recompute the banner against real item state (below), so no path can leave the flag stuck.

2. **Base the banner on actual item coding, not on a bookkeeping timestamp.** Replace the `appliedLaborCode` comparison with a check over the loaded estimate items: a system counts as unapplied only when at least one item of that system has a `costCode` whose cost-head segment differs from the mapped code (or is empty). This is derived from data that already exists in the component (`data` prop), so it self-heals after the background auto-apply pass and cannot go stale.

3. **Keep the guard rails.** The unload warning and the tab-leave prompt in `Index.tsx` continue to use the same value, so they stay accurate rather than firing on a fully-coded project.

4. **Unmapped is a separate signal.** The "1 unmapped" system (Soft Cold Wtr in the screenshot) stays a normal unmapped indicator and must never trigger the "unapplied changes" banner.

## Technical notes

- Files touched: `src/components/tabs/SystemMappingTab.tsx` only.
- The cost-head segment is the last space-delimited token of `costCode` (`SEC ACT HEAD`); compare that, not the full code, so section/activity re-resolution doesn't produce false positives.
- Systems with zero items are ignored in the comparison.
- No schema change, no change to how codes are assigned — PM authority rule untouched, nothing is auto-assigned.
