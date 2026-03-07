

# Fix: Zone-Based Section Codes Not Applied + Auto-Populate Buildings

## Changes in `src/pages/Index.tsx`

### Change 1: Re-resolve sections for items with existing cost codes (lines 764-767)

Replace the early return for items with `cost_code` with logic that re-resolves the section portion using zone-aware resolution. Only track items whose section actually changed:

```ts
// Line 764-767: Replace early return with re-resolve
if (item.cost_code) {
  const parts = item.cost_code.trim().split(/\s+/);
  if (parts.length >= 3) {
    const costHead = parts.slice(2).join(' '); // preserve multi-word cost heads
    const section = resolveSectionStatic(item.floor || '', item.drawing || '', dbFloorMappings, dbBuildingMappings, { zone: item.zone, datasetProfile });
    const floorMap = resolveFloorMappingStatic(item.floor || '', item.drawing || '', dbFloorMappings, dbBuildingMappings, { zone: item.zone, datasetProfile });
    const activity = floorMap.activity !== '0000' ? floorMap.activity : parts[1];
    const newCode = `${section} ${activity} ${costHead}`;
    if (newCode !== item.cost_code) {
      baseItem.costCode = newCode;
      itemsNeedingPersist.push({ row_number: item.row_number, cost_code: newCode });
    }
  }
  return baseItem;
}
```

The guard is built-in: `if (newCode !== item.cost_code)` means after first load persists the corrected codes, subsequent loads find no difference and `itemsNeedingPersist` stays empty — no DB write.

The existing `hasAutoAppliedRef` guard on the batch persist block (line 820) should be **relaxed for re-resolve** since re-resolve is idempotent (only writes when section differs). Add a separate persist block for re-resolved items that doesn't use the one-shot guard, since the diff check itself is the guard:

```ts
// After the existing auto-apply persist block (~line 848), add:
if (itemsNeedingPersist.length > 0 && newlyApplied === 0) {
  // Re-resolved items only (not newly mapped) — persist section corrections
  console.log(`[Load] Re-resolved sections for ${itemsNeedingPersist.length} items, persisting...`);
  const batchSize = 50;
  (async () => {
    for (let i = 0; i < itemsNeedingPersist.length; i += batchSize) {
      const batch = itemsNeedingPersist.slice(i, i + batchSize);
      await batchUpdateSystemCostCodes.mutateAsync({
        projectId: currentProject.id, system: '__re_resolve__',
        itemUpdates: batch.map(u => ({ row_number: u.row_number, cost_code: u.cost_code }))
      });
    }
    console.log(`[Load] Persisted ${itemsNeedingPersist.length} re-resolved codes`);
  })();
}
```

Wait — simpler approach: just merge re-resolved items into the same `itemsNeedingPersist` array. The existing persist block at line 820 already handles batching. But it has the `hasAutoAppliedRef` guard. We need to separate: the one-shot guard should only apply to *newly mapped* items (Priority 2/3), not re-resolved items. Actually, re-resolve is self-guarding (diff check), so we can just remove the `hasAutoAppliedRef` check from the persist block entirely and let the diff-based approach handle idempotency.

Simplest correct approach: combine both new-mapping and re-resolve items into `itemsNeedingPersist`, remove the `hasAutoAppliedRef` guard from the persist block. The diff check on re-resolve + the fact that newly mapped items get persisted (so next load they hit the re-resolve path and find no diff) makes this naturally idempotent.

### Change 2: Auto-populate building section mappings

Add a one-shot effect after the dataset profile effect (~line 859):

```ts
const buildingsPopulatedRef = useRef<string | null>(null);
useEffect(() => {
  if (estimateData.length > 0 && dbBuildingMappings.length === 0 
      && currentProject?.id && buildingsPopulatedRef.current !== currentProject.id) {
    buildingsPopulatedRef.current = currentProject.id;
    const detected = detectBuildingsFromDrawings(estimateData);
    if (detected.length > 0) {
      autoPopulateBuildings(detected);
    }
  }
}, [estimateData.length, dbBuildingMappings.length, currentProject?.id]);
```

### Change 3: `datasetProfile` availability

The re-resolve logic at line 764 uses `datasetProfile`, but during the first load `datasetProfile` is `null` (set in a separate effect). This is fine — `resolveSectionStatic` handles `options.datasetProfile` being null by falling back to zone/drawing-based resolution, which is the correct behavior for BLDG-12 zones.

## Files changed

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Re-resolve section for existing codes (diff-guarded), auto-populate buildings, simplify persist guard |

## Expected result
- First reload: Roof + BLDG-12 items → `12 0000 DRNS`, persisted to DB
- Subsequent reloads: codes already `12 0000 DRNS`, no DB write
- Building Section panel shows auto-detected buildings (1, 2, 3, 9, 12, 13, 14, A, B, C, D)
- Non-standalone floors unaffected

