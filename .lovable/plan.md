

# Fix: Standalone Floor Zone Resolution at Assembly Time

## Root Cause

`getFloorMappingNullable` matches "Roof" to its floor mapping row (section=RF, activity=0000) via exact match on line 109. It returns immediately. The standalone floor guard on line 126 (`/^(roof|crawl\s*space|...)$/`) never fires because the exact match already returned.

Both `resolveSectionStatic` and `resolveFloorMappingStatic` check `if (fromFloor) return fromFloor` on their first line — so zone fallback never runs for any floor that has a mapping row.

## Fix

The fix is in both `resolveSectionStatic` and `resolveFloorMappingStatic`. For standalone floors, zone resolution must run **before** accepting the floor mapping's section, while still preserving the floor mapping's **activity** code.

### Define standalone floor set

```ts
const STANDALONE_FLOORS = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i;
```

### Change `resolveFloorMappingStatic` (primary fix)

```text
Current flow:
  1. getFloorMappingNullable → if match, return immediately
  2. zone fallback
  3. drawing fallback
  4. default '01'

New flow:
  1. getFloorMappingNullable → save result
  2. IF floor is standalone AND zone is provided:
     a. getBuildingFromZone(zone) → lookup building mapping → use as section
     b. Use floor mapping's activity if available (e.g., 00RF), else '0000'
     c. Return { section: zoneSection, activity: floorActivity }
  3. IF floor mapping matched (non-standalone), return it as before
  4. zone fallback (existing code, for non-standalone unmatched floors)
  5. drawing fallback
  6. default '01'
```

Same pattern for `resolveSectionStatic` — check standalone + zone before accepting floor mapping section.

### File changed

**`src/hooks/useBuildingSectionMappings.ts`** — modify `resolveSectionStatic` (~line 151-206) and `resolveFloorMappingStatic` (~line 212-268):

- Move `const fromFloor = getFloorMappingNullable(...)` up but delay early return
- Add standalone floor check: if `STANDALONE_FLOORS.test(floor.trim())` and `options?.zone` exists, try `getBuildingFromZone(options.zone)` → building mapping lookup → return zone-derived section + floor mapping's activity
- Fall through to existing `if (fromFloor) return fromFloor` for non-standalone floors
- No changes to zone fallback tiers 2/3 or drawing fallback — they remain as-is for floors with no mapping at all

### No other files need changes

The callers in `Index.tsx` and `SystemMappingTab.tsx` already pass `options: { zone }` to these functions. The bug is purely in the resolution priority within these two functions.

