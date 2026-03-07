

# Per-Item Zone Fallback — Implementation Plan

## What's Changing

Single file edit: `src/hooks/useBuildingSectionMappings.ts`

Insert a **per-item zone fallback** block into both `resolveSectionStatic` and `resolveFloorMappingStatic`, placed between the existing profile-driven zone check (Step 2) and the drawing-based fallback (Step 4).

## Verification of Dependencies

- `getBuildingFromZone` — already imported from `@/utils/datasetProfiler` (line 4)
- `suggestSectionForBuilding` — already defined in this file (derives section from building ID: "A" → "BA", "12" → "12")

No new imports or functions needed.

## Code Changes

### `resolveSectionStatic` (after line 177, before line 179)

Insert:
```ts
// Per-item zone fallback — fires for ANY pattern when floor extraction
// yields nothing (handles "Roof", "UG", "Crawl Space" in Pattern 1 datasets)
// Suppressed only when profile explicitly says zone is subzone or phase
if (
  options?.zone &&
  (!profile || (profile.zoneRole !== 'zone' && profile.zoneRole !== 'phase'))
) {
  const zoneBuilding = getBuildingFromZone(options.zone);
  if (zoneBuilding) {
    const m = buildingMappings.find(
      bm => bm.building_identifier.toUpperCase() === zoneBuilding.toUpperCase()
    );
    if (m) return m.section_code;
    return suggestSectionForBuilding(zoneBuilding);
  }
}
```

### `resolveFloorMappingStatic` (same position — after profile-driven zone block, before drawing fallback)

Same logic but returns `FloorMappingResult`:
```ts
if (
  options?.zone &&
  (!profile || (profile.zoneRole !== 'zone' && profile.zoneRole !== 'phase'))
) {
  const zoneBuilding = getBuildingFromZone(options.zone);
  if (zoneBuilding) {
    const m = buildingMappings.find(
      bm => bm.building_identifier.toUpperCase() === zoneBuilding.toUpperCase()
    );
    if (m) return { section: m.section_code, activity: '0000' };
    return { section: suggestSectionForBuilding(zoneBuilding), activity: '0000' };
  }
}
```

## Resolution Chain (after fix)

1. Floor mapping exact/partial match → section + activity
2. Profile-driven zone lookup (Pattern 2 only, confidence ≥ 0.6)
3. **Per-item zone fallback** (any pattern, suppressed for Pattern 3/4 subzones)
4. Drawing-based fallback
5. Default "01" / "0000"

No other files affected.

