
# Plan: Allow 'O' (Other) Category Codes in Material Mapping

## Summary
Update the material code filtering to include both 'M' (Material) and 'O' (Other) categories. This will allow codes like **9730 CONSUMABLES**, **9740 SMALL TOOLS**, and other field supply codes to appear in the Material Mapping dropdown.

---

## Changes Required

### 1. Update `useMaterialCodes` Hook
**File:** `src/hooks/useCostCodes.ts`

Change the database query from filtering only 'M' category to include both 'M' and 'O':

```typescript
// Before
.eq('category', 'M')

// After  
.in('category', ['M', 'O'])
```

### 2. Update TypeScript Type Definition
**File:** `src/hooks/useCostCodes.ts`

Expand the `CostCode` interface to accept 'O' as a valid category:

```typescript
// Before
category: 'L' | 'M';

// After
category: 'L' | 'M' | 'O';
```

### 3. Update CostCodeImport for 'O' Category Detection
**File:** `src/components/CostCodeImport.tsx`

Add logic to detect 'O' (Other) category from Excel sheets named "other" or similar:

```typescript
if (sheetNameLower.includes('other') || sheetNameLower.includes('consumable')) {
  sheetCategory = 'O';
}
```

### 4. Update AdminCostCodeManager Filter
**File:** `src/components/AdminCostCodeManager.tsx`

Add 'O' as a filter option so admins can view/manage Other category codes:
- Update category filter type to include 'O'
- Add "Other" option to the category dropdown
- Update stats to show Other category count

---

## Technical Details

| Component | Change |
|-----------|--------|
| `useCostCodes.ts` | Query includes 'M' and 'O' categories |
| `CostCode` type | Add 'O' to category union type |
| `CostCodeImport.tsx` | Detect 'O' category from "other" sheet names |
| `AdminCostCodeManager.tsx` | Add 'O' filter option and stats |

---

## Result
After this change:
- **Material Mapping** will show codes like 9730 CONSUMABLES, 9740 SMALL TOOLS
- **Cost Code Import** will correctly categorize "Other" sheet codes as 'O'
- **Admin panel** will allow filtering and managing 'O' category codes
