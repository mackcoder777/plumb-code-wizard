

# Bulk Buyout Feature

A new full-featured tab that consolidates estimate line items by Material Spec + Size for early procurement tracking, vendor quoting, and savings analysis.

## What You'll Get

**Buyout Setup Panel** -- A slider to select buyout percentage (50-100%), with estimate items automatically consolidated into buyout lines grouped by Material Spec + Size. Each line shows total quantities, buyout quantities, estimate pricing, and an auto-suggested material cost code (overridable via dropdown).

**Vendor Pricing Entry** -- Inline editable columns for Vendor Name, Quoted Unit Price (with auto-calculated totals), and PO Number. A color-coded Savings column shows green for under-budget and red for overages.

**Summary Dashboard** -- Cards showing Total Estimate Value, Total Buyout Value, Total Savings (dollar and %), and a breakdown by Material Code. A progress bar tracks how many buyout lines have been awarded.

**Status Tracking** -- Each buyout line gets a status badge: Not Started, Quoted, Awarded, PO Issued, or Delivered. Color-coded for quick visual scanning.

**Excel Export** -- A "Generate Buyout Package" button exports the full buyout report as a standalone Excel file with all columns.

**Header Integration** -- A new "Buyout Value" stat card in the header showing total committed buyout dollars.

## Technical Plan

### 1. New Types (`src/types/buyout.ts`)

Define interfaces for:
- `BuyoutLine` -- consolidated line with: id, materialSpec, size, materialDesc, totalEstimateQty, buyoutPercent, buyoutQty, estimateUnitCost, estimateTotal, materialCostCode, vendorName, quotedUnitPrice, quotedTotal, savings, savingsPercent, poNumber, status, sourceItemCount
- `BuyoutStatus` -- union type: 'not_started' | 'quoted' | 'awarded' | 'po_issued' | 'delivered'
- `BuyoutSummary` -- totals and breakdown by material code

### 2. New Component (`src/components/tabs/BulkBuyoutTab.tsx`)

Single component (~600-800 lines) containing:
- **Buyout % selector** -- Slider from 50-100% in 10% increments
- **Consolidation logic** -- `useMemo` that groups `estimateData` by `materialSpec + size`, sums quantities, calculates average unit cost from listPrice, and counts source items per group
- **Auto-suggest material codes** -- Uses `useMaterialCodes()` hook, matches materialSpec patterns to suggest codes (reuses pattern matching from MaterialMappingTab)
- **Editable table** -- Renders consolidated lines with inline inputs for vendor name, quoted price, PO number, and status dropdown
- **Summary cards** -- Total estimate value, total quoted value, total savings with percentage
- **Progress bar** -- X of Y lines awarded/completed
- **Sort controls** -- By savings amount, material code, or status
- **Export button** -- Generates Excel using `xlsx` library (already installed)

State management: All buyout data (vendor quotes, statuses, PO numbers) stored in component state with `localStorage` persistence keyed by project ID, matching the pattern used by BudgetAdjustmentsPanel.

### 3. Wire Into Index.tsx

- Add `activeTab === 'buyout'` conditional rendering block (similar to other tabs)
- Pass `estimateData` and `currentProject?.id` as props
- No new database tables needed -- buyout data persists via localStorage per-project

### 4. Update NavigationTabs.tsx

- Rename existing tab label from "Buyout Reports" to "Bulk Buyout"

### 5. Update EstimateHeader.tsx

- Add a 5th stat card "Buyout Value" showing total committed (awarded) buyout dollars
- Accept optional `buyoutTotal` prop from Index.tsx
- Adjust grid from `grid-cols-4` to `grid-cols-5`

### 6. Export Utility (`src/utils/buyoutExport.ts`)

Standalone Excel export function using the `xlsx` library:
- Single sheet with columns: Material Code, Material Description, Size, Estimate Qty, Buyout Qty, Buyout %, Estimate Unit Cost, Estimate Total, Vendor, Quoted Unit Price, Quoted Total, Savings $, Savings %, PO Number, Status
- Header row with project name and date
- Summary row at bottom with totals

### Files Created
| File | Purpose |
|------|---------|
| `src/types/buyout.ts` | Type definitions |
| `src/components/tabs/BulkBuyoutTab.tsx` | Main tab component |
| `src/utils/buyoutExport.ts` | Excel export utility |

### Files Modified
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add buyout tab rendering + pass buyout total to header |
| `src/components/NavigationTabs.tsx` | Rename tab label |
| `src/components/EstimateHeader.tsx` | Add Buyout Value stat card |
| `src/types/estimate.ts` | Add optional `buyoutTotal` to `ProjectStats` |

### Design Details
- Dark theme compatible using existing CSS variables (bg-card, text-foreground, border-border, etc.)
- Font classes: `font-mono` for numbers, default sans for text (matching existing patterns)
- Status badge colors: gray (Not Started), blue (Quoted), green (Awarded), orange (PO Issued), emerald (Delivered)
- Savings: green text/bg for positive savings, red for overages
- Consolidation grouping shows item count badge (e.g., "12 items" rolled up)

