

# Make `→ ?` Interactive in Floor Section Mapping Panel

## Summary
Replace static `?` text in standalone floor zone breakdown rows with a `<select>` dropdown of available building section codes. On selection, save the full zone label as `zone_pattern` on the chosen building mapping via direct supabase call. No prop threading needed.

## Changes

### 1. `src/components/FloorSectionMapping.tsx`

**Props**: Add `buildingMappings` to both `FloorSectionMappingPanelProps` and `StandaloneFloorRowProps`:
```ts
buildingMappings?: BuildingSectionMapping[];
```

Import `BuildingSectionMapping` from `@/hooks/useBuildingSectionMappings` and `supabase` (already available via hooks).

**StandaloneFloorRow zone breakdown** (lines 422-446): Replace the `{suggestedSection ?? '?'}` span. When `suggestedSection` is null:
- Also check if any `buildingMappings` entry has a `zone_pattern` that matches the zone label (contains-match). If so, show the resolved section code.
- Otherwise, render a `<select>` dropdown with options from `buildingMappings` formatted as `section_code — description`.
- On selection, call supabase directly to update `zone_pattern` on the selected building mapping row (set `zone_pattern = full zone label`). Update local state via a callback.

```tsx
// Where suggestedSection is null:
{suggestedSection === null ? (
  (() => {
    // Check zone_pattern matches from buildingMappings
    const patternMatch = buildingMappings?.find(
      m => m.zone_pattern && label.toLowerCase().includes(m.zone_pattern.toLowerCase())
    );
    if (patternMatch) {
      return <span className="font-mono font-medium">{patternMatch.section_code}</span>;
    }
    return (
      <select
        className="text-xs border rounded px-1 py-0.5 w-24 font-mono bg-background"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onZonePatternSave?.(label, e.target.value);
        }}
      >
        <option value="">? assign</option>
        {buildingMappings?.map(m => (
          <option key={m.id} value={m.section_code}>
            {m.section_code}{m.description ? ` — ${m.description}` : ''}
          </option>
        ))}
      </select>
    );
  })()
) : (
  <span className="font-mono font-medium">{suggestedSection}</span>
)}
```

**Add `onZonePatternSave` prop** to `StandaloneFloorRowProps`:
```ts
onZonePatternSave?: (zoneLabel: string, sectionCode: string) => void;
```

**In `FloorSectionMappingPanel`**: Implement `handleZonePatternSave` that calls supabase directly:
```ts
const handleZonePatternSave = useCallback(async (zoneLabel: string, sectionCode: string) => {
  const mapping = buildingMappings?.find(m => m.section_code === sectionCode);
  if (!mapping) return;
  if (mapping.zone_pattern) return; // don't overwrite existing pattern
  
  await supabase
    .from('building_section_mappings')
    .update({ zone_pattern: zoneLabel, updated_at: new Date().toISOString() })
    .eq('id', mapping.id);
  
  // Force re-render by updating local ref or triggering parent refresh
}, [buildingMappings]);
```

Since `FloorSectionMappingPanel` doesn't own the `buildingMappings` state, after saving we need the parent to refetch. Add an optional `onBuildingMappingsChanged?: () => void` callback prop that calls `fetchMappings` in `Index.tsx`.

### 2. `src/components/tabs/SystemMappingTab.tsx`

Pass `buildingMappings` and callbacks to `FloorSectionMappingPanel` (line 838):
```tsx
<FloorSectionMappingPanel
  // ...existing props
  buildingMappings={buildingSectionMappings}
  onBuildingMappingsChanged={onBuildingMappingsChanged}
/>
```

Add `onBuildingMappingsChanged?: () => void` to `SystemMappingTabProps`.

### 3. `src/pages/Index.tsx`

Pass `fetchMappings` (from `useBuildingSectionMappings`) as `onBuildingMappingsChanged` to `SystemMappingTab`.

## Files Changed

| File | Change |
|---|---|
| `src/components/FloorSectionMapping.tsx` | Add `buildingMappings` prop, interactive select for `?` zones, `handleZonePatternSave` with direct supabase call |
| `src/components/tabs/SystemMappingTab.tsx` | Pass `buildingSectionMappings` + refresh callback to `FloorSectionMappingPanel` |
| `src/pages/Index.tsx` | Pass `fetchMappings` as `onBuildingMappingsChanged` |

## Expected Result
- Unresolved zones show dropdown with `MD — Modular Buildings`, `BA — Building A`, etc.
- User selects MD → saves `zone_pattern = "PC1 - MODULAR SYSTEMS"` on the MD building mapping row
- UI updates to show `→ MD` instead of `→ ?`
- Re-apply Sections resolves via `getZonePatternMatch` automatically
- Priority 1 (BLDG regex) zones unaffected

