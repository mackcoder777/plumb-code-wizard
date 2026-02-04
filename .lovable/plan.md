
# System-to-Activity Code Mapping Feature

## Overview
Add a new mapping layer that dynamically assigns the Activity segment (middle part of the labor code format `SECT-ACT-COSTHEAD`) based on the System name. Currently hardcoded as `0000`, this will become customizable per system.

### Example
- Current: `01 0000 VALV` (Cold Water valves)
- New: `01 00CW VALV` (where CW = Cold Water activity code)
- Flexible: Users could also map both Cold Water AND Hot Water → `WATR`

---

## Technical Implementation

### 1. Database Table
Create new table `system_activity_mappings`:

```text
+-------------------+----------+---------------------------+
| Column            | Type     | Notes                     |
+-------------------+----------+---------------------------+
| id                | uuid     | Primary key               |
| project_id        | uuid     | FK to estimate_projects   |
| system_pattern    | text     | System name to match      |
| activity_code     | text     | 2-4 char code (e.g., CW)  |
| description       | text     | Optional label            |
| created_at        | timestamp| Auto                      |
| updated_at        | timestamp| Auto                      |
+-------------------+----------+---------------------------+
```

RLS policies: Users can CRUD mappings for their own projects.

### 2. New Hook: `useSystemActivityMappings.ts`
Following the pattern of `useFloorSectionMappings.ts`:
- `useSystemActivityMappings(projectId)` - Fetch all mappings
- `useSaveSystemActivityMapping()` - Upsert single mapping
- `useBatchSaveSystemActivityMappings()` - Bulk save
- `useDeleteSystemActivityMapping()` - Remove mapping
- `getActivityFromSystem(system, mappings)` - Helper function

### 3. New Component: `SystemActivityMappingPanel.tsx`
UI panel (similar to FloorSectionMappingPanel) with:
- Table showing unique systems from estimate data with item counts
- Activity code selector with common suggestions (00CW, 00HW, WATR, 0000, etc.)
- Ability to add custom codes (1-4 characters)
- Auto-suggest based on system name keywords
- Save/Reset/Apply buttons
- "Apply to Items" to update existing labor codes

### 4. Update Code Assembly Logic
Modify labor code generation in:
- `src/pages/Index.tsx` (initial load transformation)
- `src/components/tabs/SystemMappingTab.tsx` (applyMappings, applyFloorSectionCodes)

Change from:
```typescript
const newFullCode = `${section} 0000 ${costHead}`;
```

To:
```typescript
const activityCode = getActivityFromSystem(item.system, systemActivityMappings) || '0000';
const newFullCode = `${section} ${activityCode} ${costHead}`;
```

### 5. Integration Points
- Add new tab section or integrate into existing Labor Mapping workflow
- Pass activity mappings to SystemMappingTab and code assembly functions
- Include in "Apply to Items" flow alongside floor-section mappings

---

## UI Location Options
The System-to-Activity mapping panel can be placed:
1. **New sub-section in Labor Mapping tab** - alongside Floor-to-Section mapping
2. **Within each System Card** - add Activity field next to Labor Code dropdown

Recommendation: Option 1 - A dedicated panel similar to Floor-to-Section, grouped in the Labor Mapping workflow.

---

## Common Activity Code Suggestions
Pre-populated options for quick selection:
- `0000` - Default/General
- `00CW` - Cold Water
- `00HW` - Hot Water
- `WATR` - Combined Water Systems
- `00SD` - Storm Drain
- `00SN` - Sanitary
- `00GS` - Gas
- `00FX` - Fixtures

Users can add custom codes up to 4 characters.

---

## Files to Create
- `supabase/migrations/xxx_create_system_activity_mappings.sql`
- `src/hooks/useSystemActivityMappings.ts`
- `src/components/SystemActivityMapping.tsx`

## Files to Modify
- `src/pages/Index.tsx` - Import hook, pass to components, update code assembly
- `src/components/tabs/SystemMappingTab.tsx` - Update applyMappings and applyFloorSectionCodes functions
- `src/integrations/supabase/types.ts` - Will auto-update after migration
