

# Fix: Missing Hours in Reconciliation Bar

## Root Cause

Three sources of the 743.9h gap:

1. **Line 820 in Index.tsx** (`if (!activity) return;`): Items with null/empty activity are silently dropped from `laborSummary`. After our recent change making standalone floors return `activity: null`, those items never enter the budget pipeline at all. Their hours vanish.

2. **Foreman bonus (~280h)**: The reconciliation bar compares `estimateHours` vs `fieldHours + fabHours`, but foreman bonus hours are stripped and become a material line (FCNT). They're legitimately removed from labor but never added back in the reconciliation math.

3. **Compound effect**: Items with valid cost heads but failed zone resolution (the ~26 BG orphans + any other null-activity items) lose both their hours AND any foreman/fab adjustments that would have applied.

## Plan

### Change 1 — `src/pages/Index.tsx` (memoizedLaborSummary)

**Line 820**: Instead of `return` (skip), route null-activity items into the summary with a placeholder activity `0000`. These items have a cost head — they just lack a resolved activity. Skipping them entirely drops hours from the financial pipeline.

```
// BEFORE (line 820):
if (!activity) return; // Uncoded item — skip from summary

// AFTER:
if (!activity) {
  activity = '0000'; // No resolved activity — use default so hours enter pipeline
}
```

This ensures every item with hours enters `laborSummary` regardless of activity resolution. The PM can still see and fix these in Small Code Review.

### Change 2 — `src/components/HourReconciliationBar.tsx`

Add foreman bonus hours to the reconciliation math. The bar currently compares:
- `estimateHours` vs `exportHours(field) + fabHours`

It should compare:
- `estimateHours` vs `exportHours(field) + fabHours + foremanBonusHours`

Add `foremanBonusHours` from `budgetAdjustments.foremanBonusHours` to the total. Display it as a suffix like the fab hours.

```
const foremanHours = budgetAdjustments?.foremanBonusHours || 0;
const exportPlusFabPlusForeman = exportHours + fabHours + foremanHours;
```

Update the display to show the full breakdown: `Export: 23,310.0 (+4032 fab, +281 foreman)`

### Change 3 — `src/components/HourReconciliationBar.tsx`

Add a clickable "Show breakdown" that expands to show WHERE hours went:

| Stage | Hours | 
|-------|-------|
| Estimate total | 28,085.7 |
| − Foreman strip (1%) | −280.9 |
| − Fab strip | −4,032.0 |
| = Field labor | 23,772.8 |
| Actual export field | 23,310.0 |
| **Unaccounted** | **462.8** |

This gives the PM a clear diagnostic to trace any remaining gap.

### Change 4 — `src/components/ExportDropdown.tsx`

Update `reconcileBeforeExport` to also account for foreman hours in the comparison, matching the bar's logic. Currently it only checks field + fab vs raw.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Line 820: route null-activity items with `0000` instead of dropping |
| `src/components/HourReconciliationBar.tsx` | Add foreman hours to reconciliation math + expandable breakdown |
| `src/components/ExportDropdown.tsx` | Add foreman hours to reconcile gate |

