

# Standalone Floor Row Enhancement — Zone Breakdown UI

## Summary

Replace the plain standalone floor rows (Roof, UG, Crawl Space, Site, etc.) with zone-aware rows that show the user how each floor resolves at assembly time. No nesting — standalone rows stay standalone. Purely a display enhancement.

## Changes — single file: `src/components/FloorSectionMapping.tsx`

### A) Enrich `floorCounts` useMemo (lines 296-303)

Replace with a `floorData` useMemo that also builds `zoneBreakdown: Record<string, Record<string, number>>` — for each floor value, track which zone values appear and their counts. Derive `floorCounts` and `floorZoneBreakdown` from this.

### B) Add helper + component inline

Add `StandaloneFloorInfo` interface, `classifyStandaloneFloor()` function, and `StandaloneFloorRow` component directly in the file (above the main component). These come from the uploaded gold standard with minor cleanup:

- **`classifyStandaloneFloor`**: Classifies a floor as `single` (100% one zone), `dominant` (≥80%), `multi` (cross-building), or `unknown` (no zone data)
- **`StandaloneFloorRow`**: Renders the floor with colored badges:
  - **Multi** (amber): "Per-item (8 bldgs)" — clickable to expand zone breakdown with progress bars
  - **Single** (green): "→ Zone Label" — confirms all items route to one place
  - **Dominant** (blue): "~85% → Bldg A" — clickable to expand
  - **Unknown** (muted): "(no zone data)"
  - Section code input shows "fallback only" label when floor is multi-building
  - Expanded view shows per-zone breakdown with progress bars, suggested section codes, and item counts

### C) Replace standalone rows render (lines 674-697)

Replace the current `standalones.map()` block with `StandaloneFloorRow` usage, passing `floorZoneBreakdown[floor]` to each row.

### New imports needed

Add `Shuffle` to the lucide-react import (line 11).

### No changes to

- Resolution logic (`useBuildingSectionMappings.ts`)
- Grouping logic (`groupFloors`)
- Database / migrations
- Any other files

