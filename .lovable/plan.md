# Floor-to-Section Mapping Feature

## Status: ✅ IMPLEMENTED

## Overview
Implemented a configurable floor-to-section mapping system that allows users to define which section number (01, 02, 03, etc.) each floor value maps to. This ensures labor codes are correctly aggregated by both section AND cost head in the budget export.

## What Was Built

### Phase 1: Database Schema ✅
Created `floor_section_mappings` table with:
- `id` (uuid, primary key)
- `project_id` (uuid, references estimate_projects)
- `floor_pattern` (text) - The floor value to match
- `section_code` (text) - The section number (01, 02, etc.)
- `created_at`, `updated_at`
- RLS policies for user access
- Unique constraint on (project_id, floor_pattern)

### Phase 2: Floor Mapping Configuration UI ✅
Added collapsible "Floor to Section Mapping" panel in System Mapping tab:
- Auto-detects all unique floor values from the estimate
- Shows item count per floor
- Section dropdown with options: 01-10, BG, RF, P1-P3
- Auto-suggest button to guess sections from floor names
- Save All button to persist to database
- Reset button to revert unsaved changes

### Phase 3: Integrate Section into Labor Code Assignment ✅
- `aggregateLaborByCostCode()` now accepts `floorMappings` parameter
- Derives section from floor using configured mappings
- Falls back to '01' if no mapping found
- Groups labor by full code: `${section} ${activity} ${costHead}`

### Phase 4: Update Exports ✅
- Budget Packet export uses floor mappings for section derivation
- Audit Report export uses floor mappings for summary aggregation
- Budget Builder labor summary uses floor mappings for proper grouping

## Files Created
1. `src/hooks/useFloorSectionMappings.ts` - CRUD operations for floor mappings
2. `src/components/FloorSectionMapping.tsx` - Configuration UI component

## Files Modified
1. `src/pages/Index.tsx` - Added floor mappings hook and passed to relevant components
2. `src/utils/budgetExportSystem.ts` - Updated aggregation to use floor mappings
3. `src/components/ExportDropdown.tsx` - Added floorMappings prop
4. `src/components/tabs/SystemMappingTab.tsx` - Added collapsible floor mapping panel

## User Workflow
1. Upload estimate with floor data (Club Level, Low Roof, etc.)
2. Go to System Mapping tab
3. Click "Floor to Section Mapping" collapsible button
4. See auto-detected floors with item counts
5. Assign section numbers (01, 02, 03...) to each floor
6. Click "Save All" to persist mappings
7. Export shows correct section-based labor aggregation (e.g., "02 0000 SNWV" for Club Level)
