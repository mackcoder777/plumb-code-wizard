

# Fix: Include All Known Section Codes in Zone Assignment Dropdown

## Problem
MD exists as a section code in `floor_section_mappings` (used across Crawl Space, Roof, etc.) but not in `building_section_mappings`. The `ZoneAssignInput` datalist only pulls from `building_section_mappings`, so MD doesn't appear as a suggestion. The user has to type it manually despite it being a well-known code in their project.

## Database State
- `floor_section_mappings` has these section codes: 12, 13, 14, B1, B2, B3, B9, BA, BB, BC, BD, CS, **MD**, RF, ST, UG
- `building_section_mappings` has: 1, 2, 3, 9, 12, 13, 14, BA, BB, BC, BD, C1, C5 — **no MD**

## Solution
Merge section code suggestions from both sources. In `FloorSectionMappingPanel`, compute a deduplicated list of all known section codes from:
1. `buildingMappings` (building_section_mappings table)
2. `localMappings` values (floor_section_mappings, already in component state)

Pass this merged list to `StandaloneFloorRow` and `ZoneAssignInput`.

### Changes in `src/components/FloorSectionMapping.tsx`

1. **Compute merged section codes** in `FloorSectionMappingPanel`:
```ts
const allSectionCodes = useMemo(() => {
  const codes = new Map<string, string>(); // code → description
  // From building mappings
  buildingMappings?.forEach(m => {
    codes.set(m.section_code, m.description || `Building ${m.building_identifier}`);
  });
  // From floor mappings (localMappings values)
  Object.values(localMappings).forEach(code => {
    if (code && !codes.has(code)) codes.set(code, '');
  });
  return Array.from(codes.entries()).map(([code, desc]) => ({ code, description: desc }));
}, [buildingMappings, localMappings]);
```

2. **Update `ZoneAssignInput` props** to accept this merged list instead of raw `buildingMappings`:
```ts
const ZoneAssignInput: React.FC<{
  sectionSuggestions?: Array<{ code: string; description: string }>;
  onAssign: (sectionCode: string) => void;
}>
```

3. **Update datalist** to render from `sectionSuggestions` — MD will now appear alongside BA, BB, etc.

4. **Pass through** `StandaloneFloorRow` → `ZoneAssignInput`.

### No other file changes needed.
The `handleZonePatternSave` logic already handles creating a new `building_section_mappings` row when the section code doesn't exist in that table, so typing or picking MD from the suggestions will auto-create the building mapping with the zone pattern.

