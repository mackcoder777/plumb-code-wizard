

# Fix Plan: Infinite Re-render Loop + System Mapping Display

## Bug 1 (Critical): Infinite Re-render Loop

**Root cause confirmed:** Circular dependency chain in `Index.tsx`:

```text
setDatasetProfile (line 816) → datasetProfile changes
  → getSectionForFloor recreates (line 637, depends on datasetProfile)
  → generateCostCode recreates (line 706, depends on getSectionForFloor)
  → load effect re-fires (line 850, depends on generateCostCode)
  → calls setDatasetProfile again → ∞
```

**Fix — two changes in `src/pages/Index.tsx`:**

1. **Remove `generateCostCode` from load effect deps (line 850).** The load effect only uses `generateCostCode` for the `suggestedCode` display hint on each item. The actual mapping dependencies (`dbCategoryMappings`, `savedMappings`, `dbFloorMappings`, etc.) are already in the dep array and correctly trigger re-runs when mapping data changes. Remove just `generateCostCode` from the array.

2. **Move `setDatasetProfile` out of the load effect.** Create a separate `useEffect` that computes and sets `datasetProfile` from `estimateData`, guarded by a ref so it only runs once per project load (when `estimateData` transitions from empty to populated for the current project). This breaks the circular chain completely.

   ```ts
   // New effect — runs once when estimateData first populates for a project
   const datasetProfileSetRef = useRef<string | null>(null);
   useEffect(() => {
     if (estimateData.length > 0 && currentProject?.id && datasetProfileSetRef.current !== currentProject.id) {
       datasetProfileSetRef.current = currentProject.id;
       setDatasetProfile(profileDataset(estimateData));
     }
   }, [estimateData, currentProject?.id]);
   ```

   Remove `setDatasetProfile(profileDataset(transformedItems))` from line 816 of the load effect.

## Bug 2: System Mapping Shows 0/0

This is a downstream symptom of Bug 1. The infinite loop prevents `useSystemIndex` from ever completing (worker/sync gets terminated and restarted on every re-render cycle). Once Bug 1 is fixed:

- `data` reference stabilizes → `useSystemIndex` completes → `systemIndex` populates with 36 systems
- System cards render → `dbMappings` restore logic populates the 20+ saved mappings
- Mapping Audit Summary reads from both `systemIndex` and `systemMappings` → shows correct counts

No additional code changes needed for Bug 2 — it resolves automatically once the render loop stops.

## Files changed

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Remove `generateCostCode` from load effect deps; extract `setDatasetProfile` into guarded one-shot effect |

## Validation

After fix: Labor Mapping tab loads all 36 systems with 20+ verified mappings. "Processing..." completes in under 10 seconds. No mapping data is altered.

