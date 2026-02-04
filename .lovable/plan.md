
# System-to-Activity Code Mapping Feature ✅ IMPLEMENTED

## Overview
Add a new mapping layer that dynamically assigns the Activity segment (middle part of the labor code format `SECT-ACT-COSTHEAD`) based on the System name. Previously hardcoded as `0000`, this is now customizable per system.

### Example
- Before: `01 0000 VALV` (Cold Water valves)
- After: `01 00CW VALV` (where CW = Cold Water activity code)
- Flexible: Users can map both Cold Water AND Hot Water → `WATR`

---

## Implementation Status: ✅ COMPLETE

### 1. Database Table ✅
Created `system_activity_mappings` table with:
- `id` (uuid) - Primary key
- `project_id` (uuid) - FK to estimate_projects
- `system_pattern` (text) - System name to match
- `activity_code` (text) - 2-4 char code (e.g., CW)
- `description` (text) - Optional label
- `created_at` / `updated_at` - Timestamps
- Full RLS policies for user access

### 2. New Hook ✅
`src/hooks/useSystemActivityMappings.ts`:
- `useSystemActivityMappings(projectId)` - Fetch all mappings
- `useSaveSystemActivityMapping()` - Upsert single mapping
- `useBatchSaveSystemActivityMappings()` - Bulk save
- `useDeleteSystemActivityMapping()` - Remove mapping
- `getActivityFromSystem(system, mappings)` - Helper function
- `suggestActivityCode(systemName)` - Auto-suggest based on keywords
- `ACTIVITY_CODE_SUGGESTIONS` - Pre-populated options

### 3. New Component ✅
`src/components/SystemActivityMapping.tsx`:
- Panel showing unique systems with item counts
- Activity code selector with common suggestions
- Custom code entry (1-4 characters)
- Auto-suggest based on system name keywords
- Save/Reset buttons
- Located in Labor Mapping tab as collapsible section

### 4. Code Assembly Logic Updated ✅
Modified in:
- `src/components/tabs/SystemMappingTab.tsx` - `buildFullLaborCode()` now accepts system parameter
- `src/pages/Index.tsx` - `generateCostCode()` uses activity mappings
- Applied to `applyMappings()`, `applySystemMapping()`, `handleApplySectionCodes()`

### 5. Integration Points ✅
- Activity mappings passed from Index.tsx to SystemMappingTab
- Included in all code assembly flows
- Works alongside floor-section and category mappings

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
- `00VT` - Vent
- `00RF` - Roof Drain

Users can add custom codes up to 4 characters.

---

## Files Created
- `src/hooks/useSystemActivityMappings.ts`
- `src/components/SystemActivityMapping.tsx`

## Files Modified
- `src/pages/Index.tsx` - Import hook, pass to components, update code assembly
- `src/components/tabs/SystemMappingTab.tsx` - Import components, update buildFullLaborCode
