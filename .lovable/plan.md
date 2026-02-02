
# Report Category Labor Code Mapping

## Problem
Labor codes are currently assigned only by **System** (e.g., "Cold Water" → DIW). However, the estimate data has a **Report Cat** field that should take priority for certain categories:

- Items with Report Cat = "Drains/Cleanouts" should get labor code **DRNS** regardless of their system
- Items with Report Cat = "Plumbing Equipment" should get labor code **SEQP** regardless of their system
- Other categories like "Fixtures", "Valves", "Pipe", etc. may have their own mappings

## Solution
Add a **Category-based Labor Code Mapping** feature that:
1. Extracts unique Report Categories from the estimate
2. Allows users to assign labor codes to each category
3. Category mappings take **priority** over system mappings during code assignment

## Technical Implementation

### Phase 1: Database Schema
Create a new table for category-level labor mappings:

```text
category_labor_mappings
├── id (uuid, primary key)
├── project_id (uuid, references estimate_projects)
├── category_name (text) - The report_cat value
├── labor_code (text) - The assigned labor code
├── created_at, updated_at
└── RLS policies for user access
```

### Phase 2: New React Hook
Create `src/hooks/useCategoryMappings.ts`:
- Query/save category-to-labor-code mappings
- Build category index from estimate data
- Functions: `useCategoryMappings`, `useSaveCategoryMapping`, `useDeleteCategoryMapping`

### Phase 3: UI Component - Category Mapping Panel
Create `src/components/CategoryLaborMapping.tsx`:
- Collapsible panel in System Mapping tab (similar to Floor Section Mapping)
- Shows all unique Report Categories from the estimate with item counts
- Dropdown to assign labor code to each category
- Visual indicators for mapped vs unmapped categories

Example UI layout:
```text
Category Labor Mapping (expands/collapses)
├── Drains/Cleanouts     │ 45 items │ [DRNS - Drains & Floor Sinks ▼]
├── Plumbing Equipment   │ 32 items │ [SEQP - Equipment Setting ▼]  
├── Fixtures             │ 178 items│ [Select labor code... ▼]
├── Pipe                 │ 89 items │ [Select labor code... ▼]
└── Valves               │ 23 items │ [Select labor code... ▼]
```

### Phase 4: Update Labor Code Assignment Logic
Modify `src/pages/Index.tsx` and `src/utils/budgetExportSystem.ts`:
- New priority order for labor code assignment:
  1. **Category mapping** (if Report Cat has assigned code)
  2. **System mapping** (current behavior)
  3. **Manual override**
- Update `aggregateLaborByCostCode` to use category mappings
- Update "Apply All Mappings" to respect the priority order

### Phase 5: Build Category Index
Add to `useSystemIndex.ts` or create separate hook:
- Extract unique `reportCat` values from estimate items
- Track item counts per category
- Support real-time filtering

## Files to Create
1. `src/hooks/useCategoryMappings.ts` - CRUD operations for category mappings
2. `src/components/CategoryLaborMapping.tsx` - UI panel component
3. Database migration for `category_labor_mappings` table

## Files to Modify
1. `src/components/tabs/SystemMappingTab.tsx` - Add Category Mapping panel
2. `src/pages/Index.tsx` - Integrate category mappings into code assignment
3. `src/utils/budgetExportSystem.ts` - Use category mappings in export/aggregation

## User Workflow
1. Upload estimate with Report Cat data
2. Expand "Category Labor Mapping" panel in System Mapping tab
3. See auto-detected categories (Drains/Cleanouts, Plumbing Equipment, etc.)
4. Assign labor codes: Drains/Cleanouts → DRNS, Plumbing Equipment → SEQP
5. Apply mappings - items get coded by category first, then by system for uncategorized items
6. Export shows correct labor codes based on category priority
