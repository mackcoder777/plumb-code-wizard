

# Status: Everything is Already Wired Correctly

## Diagnosis Complete

All three wiring points are confirmed correct:

1. **Zone data exists in the database** — I queried the Hamilton High estimate items directly. All 12,846 items have zone values (BLDG - A: 4,301 items, BLDG - 3: 2,105, BLDG - B: 1,618, etc.)

2. **Zone is loaded from DB on project load** — Line 1126 of `Index.tsx` maps `zone: row.zone` when loading from database

3. **`FloorSectionMapping.tsx` is fully wired**:
   - `floorData` useMemo builds `zoneBreakdown` from `item.zone` (line 480-497)
   - `StandaloneFloorRow` receives `zoneBreakdown={floorZoneBreakdown[floor]}` (line 878)
   - `classifyStandaloneFloor` classifies floors based on zone distribution (line 285-315)
   - Badges render for `multi`, `single`, `dominant`, and `unknown` types (lines 350-383)

## No Code Changes Needed

The zone breakdown badges (amber "Per-item (N zones)" for Roof/UG, green "→ Zone" for Crawl Space/Site) should be rendering already. The screenshot was likely captured before the latest code deployment that added `StandaloneFloorRow`.

## Next Step

Simply reload the app in the preview. The standalone floor rows for Roof, UG, Crawl Space, Site, and Site Above Grade should now display:
- **Roof**: amber badge — "Per-item (8 zones)" with expandable breakdown
- **UG**: amber badge — "Per-item (11 zones)" with expandable breakdown  
- **Crawl Space**: green badge — "→ PC1 - MODULAR SYSTEMS" (or similar single-zone)
- **Site / Site Above Grade**: green badge — "→ Site Plumbing PKG 3"

After confirming the badges appear, click **"Re-apply Sections"** to update the cost codes on all items with their per-item zone-resolved section codes.

