

# Add All Missing Material Codes from Spreadsheet

## What's Missing

Your database currently has only **L** (Labor, 604 codes) and **M** (Material, 55 codes). The uploaded spreadsheet contains ~130 additional codes across categories that don't exist yet:

| Category | Description | Count | Examples |
|----------|-------------|-------|---------|
| **O** (Other) | GC items, consumables, contract labor | ~80 | ALOW, BOND, 9730 (Consumables), 9740 (Small Tools) |
| **R** (Rental) | Equipment rentals | 3 | 9610, 9612, 9615 |
| **S** (Subcontract) | Formal subcontracts | ~40 | 9800-9853 |
| Special | Warranty, change work | 4 | WRNT, WNTY, MAT1, REN1, TMUM |

## Plan

### Step 1 -- Expand TypeScript types to support R and S categories

Update the category type from `'L' | 'M' | 'O'` to `'L' | 'M' | 'O' | 'R' | 'S'` in these files:
- `src/hooks/useCostCodes.ts` -- CostCode interface
- `src/components/AdminCostCodeManager.tsx` -- local type and filter
- `src/components/CostCodeImport.tsx` -- import type and sheet-name detection (add rules for "rental", "subcontract", "equipment rental" sheet names)
- `src/components/tabs/CostCodesTab.tsx` -- import type
- `src/utils/smartCodeMatcher.ts` -- type reference
- `supabase/functions/upload-cost-codes/index.ts` -- edge function type

### Step 2 -- Update Admin UI filter to show new categories

In `AdminCostCodeManager.tsx`, add "Rental" and "Subcontract" as filter options alongside the existing Labor / Material / Other tabs.

### Step 3 -- Insert all missing codes via database migration

Run a single SQL migration that inserts all ~130 codes from the spreadsheet using `ON CONFLICT (code, category) DO UPDATE` so existing codes get their descriptions refreshed and new codes are added. Each code will be inserted with the correct category (O, R, S, or M) and description exactly as shown in your spreadsheet.

This covers:
- General Conditions codes (ALOW through WHSX)
- Equipment Rental codes (9610, 9612, 9615)
- Consumable/Other codes (9720, 9730, 9731, 9732, 9740, 9741, 9742)
- Tier One codes (9690-9693)
- Contract Labor/WA codes (9617-9680, ODTL, OENG)
- Subcontract codes (9800-9853)
- Special codes (WRNT, WNTY, MAT1, REN1, TMUM)

### Step 4 -- Update CostCodeImport sheet detection

Add logic so importing future spreadsheets with sheets named "rental", "subcontract", "equipment", "general conditions", etc. will automatically assign the correct R or S category.

## No changes needed to
- Database schema (the `category` column is already `text`, so R and S values work)
- RLS policies (no changes to access patterns)
- Material mapping UI (it already filters by category M/O)

