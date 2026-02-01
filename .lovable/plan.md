

# Floor-to-Section Mapping Feature

## Overview
Implement a configurable floor-to-section mapping system that allows users to define which section number (01, 02, 03, etc.) each floor value maps to. This ensures labor codes are correctly aggregated by both section AND cost head in the budget export.

## Current State
- Floor values like "Club Level", "Low Roof", "Seating Bowl", "UG" are not recognized by the existing hardcoded `FLOOR_MAPPING`
- All labor codes default to section "01" when exported
- The budget aggregates by cost head only, not by section+cost head

## Solution

### Phase 1: Database Schema
Create a new table `floor_section_mappings` to store project-specific floor-to-section configurations:

```text
floor_section_mappings
├── id (uuid, primary key)
├── project_id (uuid, references estimate_projects)
├── floor_pattern (text) - The floor value to match
├── section_code (text) - The section number (01, 02, etc.)
├── created_at, updated_at
└── RLS policies for user access
```

### Phase 2: Floor Mapping Configuration UI
Add a new panel/section in the System Mapping tab or a dedicated tab for configuring floor-to-section mappings:

1. **Auto-detect floors**: Show all unique floor values from the current estimate
2. **Section assignment dropdown**: For each floor, select section 01, 02, 03, etc.
3. **Bulk actions**: Set multiple floors to the same section
4. **Save mappings**: Persist to database for the project

Example UI:
```text
┌─────────────────────────────────────────────────┐
│ Floor to Section Mapping                        │
├─────────────────────────────────────────────────┤
│ Floor Value          │ Section │ Item Count    │
├─────────────────────────────────────────────────┤
│ Club Level           │ [02 ▼]  │ 342 items     │
│ Low Roof             │ [03 ▼]  │ 128 items     │
│ Seating Bowl         │ [04 ▼]  │ 567 items     │
│ UG                   │ [01 ▼]  │ 234 items     │
│ Roof                 │ [05 ▼]  │ 89 items      │
└─────────────────────────────────────────────────┘
```

### Phase 3: Integrate Section into Labor Code Assignment
Modify the labor aggregation logic to:

1. **Store section on items**: When applying mappings, derive section from floor using the configured mapping
2. **Aggregate by full code**: Group labor by `${section} ${activity} ${costHead}` not just by cost head
3. **Update exports**: Ensure Budget Packet exports use the correct section per item

### Phase 4: Update Labor Summary Display
The Budget Adjustments panel and labor summary will show entries like:
- `01 0000 BGW` - UG floor items (123 hrs)
- `02 0000 BGW` - Club Level items (45 hrs)  
- `03 0000 BGW` - Low Roof items (67 hrs)

Instead of current behavior where all floors merge into:
- `01 0000 BGW` - All items (235 hrs)

## Technical Changes

### Files to Create
1. `src/hooks/useFloorSectionMappings.ts` - CRUD operations for floor mappings
2. `src/components/FloorSectionMapping.tsx` - Configuration UI component

### Files to Modify
1. `src/pages/Index.tsx` - Remove hardcoded FLOOR_MAPPING, use database mappings
2. `src/utils/budgetExportSystem.ts` - Update `aggregateLaborByCostCode` to derive section from floor
3. `src/components/BudgetAdjustmentsPanel.tsx` - Update labor summary to include section in code
4. `src/components/tabs/SystemMappingTab.tsx` - Add floor mapping configuration section
5. `src/types/estimate.ts` - Add `laborSec` field to EstimateItem interface

### Database Migration
```sql
CREATE TABLE floor_section_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES estimate_projects(id) ON DELETE CASCADE,
  floor_pattern TEXT NOT NULL,
  section_code TEXT NOT NULL DEFAULT '01',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, floor_pattern)
);

ALTER TABLE floor_section_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their project floor mappings"
  ON floor_section_mappings FOR ALL
  USING (project_id IN (SELECT id FROM estimate_projects WHERE user_id = auth.uid()));
```

## User Workflow
1. Upload estimate with floor data (Club Level, Low Roof, etc.)
2. Go to new "Floor Sections" tab or panel
3. See auto-detected floors with item counts
4. Assign section numbers (01, 02, 03...) to each floor
5. Save mappings
6. When applying system mappings, section is automatically derived
7. Export shows correct section-based labor aggregation

