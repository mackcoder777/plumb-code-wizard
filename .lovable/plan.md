# Fix the persistent “Unapplied System Mapping Changes” warning

## Confirmed root cause

The new banner check compares **every item’s final cost head** directly against its system mapping. That is incorrect for LBTP because category and material-description overrides intentionally outrank system mappings.

The apply path already uses this hierarchy:

```text
Material-description override → Category override → System mapping
```

But `hasUnappliedChanges` currently checks only:

```text
final item head === system mapping head
```

So after Apply All correctly recodes LBTP’s hanger/support items to `HNGS`, the warning reads those valid HNGS category overrides as system-mapping mismatches and remains latched. The current runtime log confirms `01 0000 HNGS` exists after the 931-item apply, while hour reconciliation remains exact at 4,176 h.

## Implementation

1. **Make the warning hierarchy-aware** in `SystemMappingTab.tsx`.
   - For each item, resolve its expected head using the same existing functions and priority order as Apply All:
     1. `getLaborCodeFromMaterialDesc(...)`
     2. `getLaborCodeFromCategory(...)`
     3. current system mapping
   - Compare the item’s final cost-head token to that resolved expected head.
   - An intentionally overridden HNGS item will therefore count as applied, not mismatched.

2. **Keep real unapplied detection intact.**
   - If an item should resolve to HNGS but still carries its old system head, the warning remains.
   - Unmapped systems stay separate and do not trigger this warning.
   - Do not use `appliedSystems` timestamps; the check remains based on actual item state.

3. **Use one shared resolver inside the component** for both Apply All and the warning comparison so their priority rules cannot drift again.
   - Reuse the already-loaded `categoryMappings` and `materialDescOverrides`.
   - No new assignment rules, automatic mappings, or database changes.

4. **Verify LBTP end to end.**
   - Apply all mappings.
   - Confirm 26/26 systems and 1,944/1,944 items remain coded.
   - Confirm the amber banner clears and leaving Labor Mapping does not open the modal.
   - Confirm HNGS remains in the labor summary and pre/post-merge totals remain 4,176 h with zero drift.

## Scope

- File: `src/components/tabs/SystemMappingTab.tsx`
- No change to coding authority, mapping persistence, budget math, or exports.
