

# Flexible Zone-to-Building Matching System

## Summary
Add `zone_pattern` column to `building_section_mappings` and a separate `getZonePatternMatch()` helper. Users configure zone keywords in the UI to map standalone floors to correct building sections.

## Database Migration
```sql
ALTER TABLE building_section_mappings ADD COLUMN zone_pattern text;
```

## Code Changes

### 1. `src/utils/datasetProfiler.ts`
Add `getZonePatternMatch()` after existing `getBuildingFromZone()` (line 207). `getBuildingFromZone` stays unchanged.

```ts
export function getZonePatternMatch(
  zone: string,
  buildingMappings: Array<{ building_identifier: string; zone_pattern?: string | null }>
): { building_identifier: string } | null {
  if (!zone) return null;
  for (const m of buildingMappings) {
    if (m.zone_pattern && zone.toLowerCase().includes(m.zone_pattern.toLowerCase())) {
      return { building_identifier: m.building_identifier };
    }
  }
  return null;
}
```

### 2. `src/hooks/useBuildingSectionMappings.ts`

**Interface** (line 9-15): Add `zone_pattern: string | null` to `BuildingSectionMapping`.

**Import**: Add `getZonePatternMatch` from datasetProfiler.

**`resolveSectionStatic`** (lines 163-173): After `getBuildingFromZone` returns null for standalone floors, try `getZonePatternMatch(zone, buildingMappings)`. If matched, look up section from buildingMappings.

**`resolveFloorMappingStatic`** (lines 238-247): Same Priority 2 fallback. When Priority 2 matches, extract activity from zone prefix:
```ts
const prefixMatch = zone.match(/^([A-Z0-9]{2,4})\s*[-–]/i);
if (prefixMatch) {
  const prefix = prefixMatch[1].toUpperCase();
  const activity = prefix.length <= 3 ? '0' + prefix : prefix;
  return { section: m.section_code, activity };
}
```

**Hook**: Add `updateZonePattern` function — updates `zone_pattern` on `building_section_mappings` by id, updates local state.

### 3. `src/components/BuildingSectionMapping.tsx`

Add "Zone Pattern" column to table header (after Description). Each row gets an `<Input>` for `zone_pattern` that calls `updateZonePattern` on blur. Add zone pattern input to the "Add new" row as well.

## Files Changed

| File | Change |
|---|---|
| Migration | Add `zone_pattern text` column |
| `src/utils/datasetProfiler.ts` | Add `getZonePatternMatch()` |
| `src/hooks/useBuildingSectionMappings.ts` | Update interface, add Priority 2 in both resolve functions with activity extraction, add `updateZonePattern` |
| `src/components/BuildingSectionMapping.tsx` | Add Zone Pattern column + input |

## Expected Result
- User types "MODULAR" in Zone Pattern for MD row → Crawl Space + "PC1 - MODULAR SYSTEMS" → `MD 0PC1 [costh]`
- Roof + BLDG-12 → still `12 0000 DRNS` (Priority 1 regex, unchanged)
- Works for any naming convention via UI configuration

