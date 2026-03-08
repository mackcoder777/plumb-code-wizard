

# Fix: Zone Assignment Selections Not Persisting

## Problem
When assigning multiple zones to the same section code (e.g., "PC1 - MODULAR SYSTEMS" → MD, "PC10 - MODULAR SYSTEMS" → MD, "PC5 - MODULAR SYSTEMS" → MD), only the first assignment persists. Subsequent assignments silently fail because:

1. **Line 665**: `if (mapping.zone_pattern) return;` — silently skips if the building mapping row already has a zone_pattern
2. **Line 642-654**: When creating a new row, the upsert uses `building_identifier: code` (e.g., "MD"), so a second zone assigned to MD overwrites the first via the unique constraint

## Solution
Support **multiple comma-separated zone patterns** per building mapping row. Three changes:

### 1. `src/components/FloorSectionMapping.tsx` — `handleZonePatternSave`

Replace the early return on line 665 with logic that **appends** the new zone label to the existing `zone_pattern`:

```ts
if (mapping.zone_pattern) {
  // Check if this zone is already included
  const existingPatterns = mapping.zone_pattern.split(',').map(p => p.trim().toLowerCase());
  if (existingPatterns.includes(zoneLabel.toLowerCase())) return; // already saved
  
  // Append the new pattern
  const updatedPattern = `${mapping.zone_pattern},${zoneLabel}`;
  const { error } = await supabase
    .from('building_section_mappings')
    .update({ zone_pattern: updatedPattern, updated_at: new Date().toISOString() })
    .eq('id', mapping.id);
  
  if (error) { toast error; return; }
  toast success;
  onBuildingMappingsChanged?.();
  return;
}
```

### 2. `src/components/FloorSectionMapping.tsx` — Zone breakdown display (line 494-496)

Update the matching logic to check each comma-separated pattern:

```ts
const patternMatch = buildingMappings?.find(
  m => m.zone_pattern && m.zone_pattern.split(',').some(
    p => label.toLowerCase().includes(p.trim().toLowerCase())
  )
);
```

### 3. `src/utils/datasetProfiler.ts` — `getZonePatternMatch` (line 222)

Update the assembly-time matching to also split on commas:

```ts
if (m.zone_pattern && m.zone_pattern.split(',').some(
  p => zone.toLowerCase().includes(p.trim().toLowerCase())
)) {
  return { building_identifier: m.building_identifier };
}
```

### Files Changed
- `src/components/FloorSectionMapping.tsx` — handleZonePatternSave + zone display matching
- `src/utils/datasetProfiler.ts` — getZonePatternMatch

No database changes needed. The `zone_pattern` column is already a text field that can hold comma-separated values.

