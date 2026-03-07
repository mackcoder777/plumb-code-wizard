

# Fix FloorSectionMappingPanel Minor Issues

Two small issues flagged in the `FloorSectionMappingPanel` component:

## 1. Widen the `estimateData` prop type

The prop is typed as `Array<{ floor?: string; costCode?: string }>` but the parent passes full `EstimateItem[]` (which always has `costCode: string`). The current narrow type works at runtime since `costCode` is present, but it's misleading. 

**Fix:** Import `EstimateItem` and type the prop as `EstimateItem[]` (or at minimum `Array<{ floor?: string; costCode?: string; zone?: string }>` to future-proof for zone-based resolution in the panel).

This is cosmetic — the `itemCounts` calculation already works because `data` is always `EstimateItem[]` at runtime.

## 2. Make the save-then-apply chain explicit

In `FloorSectionMapping.tsx` line 482:
```ts
handleSaveAll().then(() => handleApplySectionCodes());
```

`handleSaveAll` is `async () => void` — this works because async functions return `Promise<void>`, so `.then()` is valid. However, if `handleSaveAll` throws (save fails), the `.then()` won't fire but the error is silently swallowed.

**Fix:** Add `.catch()` or use `await` pattern:
```ts
onClick={async () => {
  if (hasChanges) {
    await handleSaveAll();
  }
  handleApplySectionCodes();
}}
```

This ensures apply only runs after a successful save, and errors surface properly.

## Files changed
- `src/components/FloorSectionMapping.tsx` — both fixes in this single file

