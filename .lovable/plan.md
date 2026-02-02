
# Report Category Labor Code Mapping

## Problem
Labor codes are currently assigned only by **System** (e.g., "Cold Water" → DIW). However, the estimate data has a **Report Cat** field that should take priority for certain categories:

- Items with Report Cat = "Drains/Cleanouts" should get labor code **DRNS** regardless of their system
- Items with Report Cat = "Plumbing Equipment" should get labor code **SEQP** regardless of their system
- Other categories like "Fixtures", "Valves", "Pipe", etc. may have their own mappings

## Solution ✅ IMPLEMENTED
Added a **Category-based Labor Code Mapping** feature that:
1. Extracts unique Report Categories from the estimate
2. Allows users to assign labor codes to each category
3. Category mappings take **priority** over system mappings during code assignment

## Technical Implementation

### Phase 1: Database Schema ✅
Created `category_labor_mappings` table:
- id (uuid, primary key)
- project_id (uuid, references estimate_projects)
- category_name (text) - The report_cat value
- labor_code (text) - The assigned labor code
- created_at, updated_at
- RLS policies for user access

### Phase 2: New React Hook ✅
Created `src/hooks/useCategoryMappings.ts`:
- `useCategoryMappings` - Query category mappings for a project
- `useSaveCategoryMapping` - Save/update a category mapping
- `useDeleteCategoryMapping` - Remove a category mapping
- `useCategoryIndex` - Build index from estimate data
- `getLaborCodeFromCategory` - Utility for lookups

### Phase 3: UI Component - Category Mapping Panel ✅
Created `src/components/CategoryLaborMapping.tsx`:
- Collapsible panel in System Mapping tab
- Shows all unique Report Categories from the estimate with item counts
- Dropdown to assign labor code to each category
- Visual indicators for mapped vs unmapped categories

### Phase 4: Update Labor Code Assignment Logic ✅
Modified `src/utils/budgetExportSystem.ts`:
- New priority order for labor code assignment:
  1. **Category mapping** (if Report Cat has assigned code)
  2. **System mapping** (existing costCode/laborCostHead)
  3. **Suggested code**
- Updated `aggregateLaborByCostCode` to accept categoryMappings
- Updated `exportBudgetPacket` to pass categoryMappings

### Phase 5: Integration ✅
- Added CategoryLaborMappingPanel to SystemMappingTab
- Updated ExportDropdown to accept categoryMappings prop

## Files Created
1. `src/hooks/useCategoryMappings.ts` - CRUD operations for category mappings
2. `src/components/CategoryLaborMapping.tsx` - UI panel component
3. Database migration for `category_labor_mappings` table

## Files Modified
1. `src/components/tabs/SystemMappingTab.tsx` - Added Category Mapping panel
2. `src/utils/budgetExportSystem.ts` - Added CategoryLaborMap type and priority logic
3. `src/components/ExportDropdown.tsx` - Added categoryMappings prop

## User Workflow
1. Upload estimate with Report Cat data
2. Expand "Category Labor Mapping" panel in System Mapping tab
3. See auto-detected categories (Drains/Cleanouts, Plumbing Equipment, etc.)
4. Assign labor codes: Drains/Cleanouts → DRNS, Plumbing Equipment → SEQP
5. Export shows correct labor codes based on category priority
