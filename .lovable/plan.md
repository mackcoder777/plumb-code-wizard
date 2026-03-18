

## Problem

The Budget AI chat component (`BudgetChat`) was added to `PlumbingEstimateManager.tsx`, but the actual app uses `Index.tsx` (`EnhancedCostCodeManager`). That's why you don't see the chat button on any tab.

## Plan

### 1. Add BudgetChat to Index.tsx

- Import `BudgetChat` and its `EstimateSummary` type
- Add a `useMemo` that computes `estimateSummary` from `estimateData` (same logic already in `PlumbingEstimateManager.tsx` — system/category breakdowns, hours, material, coded counts)
- Render `<BudgetChat>` at the bottom of the main return, outside the tab content area, so it's visible on **all tabs** (Estimates, Mapping, Cost Codes, Automation, Dashboard, Bulk Buyout, PDF Import, etc.)

### 2. Render condition

Only show when a project is loaded:

```tsx
{currentProject && (
  <BudgetChat
    projectName={currentProject.name || "Current Project"}
    estimateSummary={estimateSummary}
  />
)}
```

### Files Changed

- **`src/pages/Index.tsx`** — import `BudgetChat`, add `estimateSummary` memo, render the component after the main card div (before the mapping warning dialog), gated on `currentProject` being set.

No other files need changes. The `BudgetChat` component and edge function are already built and working.

