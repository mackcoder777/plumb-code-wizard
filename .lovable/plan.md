

# Fix: Only Show Active Job Section Codes in Zone Assignment

## Problem
The zone assignment dropdown shows all entries from `building_section_mappings` (including auto-detected/pre-populated ones from drawings), when it should only show section codes actively used in the current job's floor mappings.

## Solution
Change `allSectionSuggestions` to only source from `localMappings` (the floor_section_mappings values), not from `buildingMappings`. Building mappings are for resolution logic, not for populating the suggestion list.

## Change

### `src/components/FloorSectionMapping.tsx` (lines 546-555)

Replace the `allSectionSuggestions` memo to only pull from `localMappings`:

```ts
const allSectionSuggestions = useMemo(() => {
  const codes = new Map<string, string>();
  // Only include section codes actively assigned in this project's floor mappings
  Object.values(localMappings).forEach(code => {
    if (code && !codes.has(code)) codes.set(code, '');
  });
  return Array.from(codes.entries()).map(([code, description]) => ({ code, description }));
}, [localMappings]);
```

This ensures only codes like MD, BA, BB, CS, RF, UG, ST, etc. that the user has actively assigned to floors appear as suggestions — not the full set of auto-detected building identifiers.

