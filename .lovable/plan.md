

# Fix: Standalone Floor Zone Resolution Priority

## Problem
`getFloorMappingNullable` matches standalone floors (Roof, UG, etc.) to their floor mapping rows and returns immediately. Both `resolveSectionStatic` (line 159) and `resolveFloorMappingStatic` (line 220) accept this early return, so zone-based building lookup never runs.

## Fix in `src/hooks/useBuildingSectionMappings.ts`

Add a `STANDALONE_FLOORS` regex constant and restructure both functions to intercept standalone floors before accepting the floor mapping's section.

### Constant (add near top of file, after imports)
```ts
const STANDALONE_FLOORS = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i;
```

### `resolveSectionStatic` (lines 151-206) — new flow:
1. `getFloorMappingNullable` → save result as `fromFloor`
2. **NEW**: If floor matches `STANDALONE_FLOORS` AND `options?.zone` exists → `getBuildingFromZone(zone)` → building mapping lookup → return zone-derived section
3. If `fromFloor` exists (non-standalone), return `fromFloor.section` as before
4. Existing zone/drawing/default fallbacks unchanged

### `resolveFloorMappingStatic` (lines 212-266) — new flow:
1. `getFloorMappingNullable` → save result as `fromFloor`
2. **NEW**: If floor matches `STANDALONE_FLOORS` AND `options?.zone` exists → `getBuildingFromZone(zone)` → building mapping lookup → return `{ section: zoneSection, activity: fromFloor?.activity || '0000' }` (preserves user's activity setting from floor mapping panel)
3. If `fromFloor` exists (non-standalone), return `fromFloor` as before
4. Existing zone/drawing/default fallbacks unchanged

### Key detail
The activity code comes from `fromFloor?.activity` — whatever the user configured for that standalone floor row in the Floor Mapping panel. No hardcoding.

### No other files change
Callers in `Index.tsx` and `SystemMappingTab.tsx` already pass `options: { zone }`.

