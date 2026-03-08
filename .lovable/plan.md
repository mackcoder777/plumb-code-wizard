

# Fix: Populate Zone Assignment Dropdown With All Available Section Codes

## Problem
The `? assign` dropdown in standalone floor zone breakdowns only shows entries from `buildingMappings` (the `building_section_mappings` table). Since the user never used the Building Section panel to create an "MD" entry, MD doesn't exist in that table and therefore doesn't appear as a dropdown option for UG (or any other standalone floor).

## Root Cause
Line 459-471 in `FloorSectionMapping.tsx`: the `<select>` is populated exclusively from `buildingMappings`. If the array is empty or doesn't contain MD, the user can't assign it.

## Solution
Allow the user to type a **free-text section code** instead of picking from a limited dropdown. Replace the `<select>` with a small text `<Input>` + confirm button (or an inline combobox). When the user types "MD" and confirms:

1. **Auto-create** a `building_section_mappings` row for that section code (with `building_identifier` derived from the section code, and the zone label as `zone_pattern`)
2. Update the UI immediately to show `→ MD`

This way the user doesn't need to visit the Building Section panel first.

### Alternative (simpler): Combine existing building mappings dropdown WITH a free-text "custom" option
- Show existing building mappings as `<option>` entries
- Add a final option "Custom..." that, when selected, shows a small text input
- On submit, create the building mapping row and save the zone pattern in one step

### Recommended approach: Inline input with datalist
Replace the `<select>` with an `<input>` that has a `<datalist>` of existing building mapping section codes. The user can either pick an existing one or type a new code like "MD". On blur/enter, save it.

## Changes

### `src/components/FloorSectionMapping.tsx`

**Lines 459-479** (the `<select>` block): Replace with:
```tsx
<ZoneAssignInput
  buildingMappings={buildingMappings}
  onAssign={(sectionCode) => onZonePatternSave?.(label, sectionCode)}
/>
```

**New small component `ZoneAssignInput`** (inline in same file):
- Renders a tiny `<input>` with placeholder "?" and a `<datalist>` of existing section codes
- Width ~16-20 chars, mono font, same styling as current select
- On Enter or blur with a value: calls `onAssign(value)`

**`handleZonePatternSave`** (line 594): Update to handle the case where no existing building mapping matches `sectionCode`:
```ts
const handleZonePatternSave = useCallback(async (zoneLabel: string, sectionCode: string) => {
  let mapping = buildingMappings?.find(m => m.section_code === sectionCode);
  
  if (!mapping) {
    // Auto-create a new building mapping row
    const { data } = await supabase
      .from('building_section_mappings')
      .upsert({
        project_id: projectId,
        building_identifier: sectionCode,
        section_code: sectionCode,
        description: `Building ${sectionCode}`,
        zone_pattern: zoneLabel,
      }, { onConflict: 'project_id,building_identifier' })
      .select()
      .single();
    if (data) onBuildingMappingsChanged?.();
    return;
  }
  
  if (mapping.zone_pattern) return;
  // ... existing save logic
}, [buildingMappings, projectId, onBuildingMappingsChanged]);
```

## Files Changed

| File | Change |
|---|---|
| `src/components/FloorSectionMapping.tsx` | Replace `<select>` with input+datalist, update `handleZonePatternSave` to auto-create building mapping if missing |

## Expected Result
- UG zone breakdown shows a small text input with "?" placeholder for unresolved zones
- Typing "MD" and pressing Enter creates the building mapping AND saves the zone pattern in one step
- Existing building mappings appear as autocomplete suggestions via datalist
- After assignment, shows `→ MD` immediately

