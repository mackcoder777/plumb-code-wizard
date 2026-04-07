

# Three Data Integrity Safeguards

## What We Are Building

Three safeguards to prevent silent hour loss in budget exports:

1. **Export Reconciliation Gate** — blocks export if hours don't reconcile
2. **Corrupt Code Detector** — scans system mappings on load for invalid characters
3. **Hour Allocation Dashboard** — always-visible bar showing estimate vs coded vs export hours

---

## Technical Plan

### Safeguard 1: Export Reconciliation Gate

**File: `src/components/ExportDropdown.tsx`**

Before calling `exportBudgetPacket` or `exportAuditReport`, run a reconciliation check:

- Compute `rawTotalHours = sum(items.hours)` from the full estimate items array
- Compute `exportTotalHours` from `budgetAdjustments.adjustedLaborSummary` (the finalLaborSummary data that export actually reads)
- Account for known adjustments: fab strip hours are legitimately removed from field labor and moved to fab codes, so the comparison is `rawTotalHours` vs `exportLaborHours + fabStrippedHours`
- If delta > 0.1h: **block the export**, show a destructive toast with the exact delta and a breakdown of where hours were lost
- If delta <= 0.1h: proceed normally

Add a new `reconcileBeforeExport()` function in ExportDropdown that returns `{ pass: boolean; rawHours: number; exportHours: number; delta: number; details: string }`.

The ExportDropdown will need access to `budgetAdjustments.adjustedLaborSummary` — it already receives `budgetAdjustments` as a prop, so this data is available.

### Safeguard 2: Corrupt Code Detector

**New component: `src/components/CorruptCodeBanner.tsx`**

A red alert banner rendered at the top of the page (in `Index.tsx`) when corruption is detected.

On project load, scan all system mappings for:
- Cost heads containing `|` (pipe prefix from dual-code storage bug)
- Cost heads with leading/trailing whitespace
- Cost heads containing non-alphanumeric characters (excluding legitimate ones)
- Cost heads not found in the `cost_codes` library table

Display: red banner with count of corrupt mappings, list of affected systems, and a "Fix All" button that strips invalid characters and re-saves.

**File: `src/pages/Index.tsx`** — render `<CorruptCodeBanner>` above the tab content when the project has corrupt mappings.

**Data source**: The system mappings are already loaded via `useSystemMappings(projectId)`. The component receives the mappings array and the cost codes library, then runs validation.

### Safeguard 3: Hour Allocation Dashboard

**New component: `src/components/HourReconciliationBar.tsx`**

A compact, always-visible bar shown below the `EstimateHeader` (or integrated into it) with three numbers:

| Metric | Source | Description |
|--------|--------|-------------|
| Estimate Hours | `sum(estimateData.hours)` | Raw total from uploaded file |
| Coded Hours | `sum(items with costCode != '').hours` | Hours on items that have a labor code |
| Export Hours | `sum(budgetAdjustments.adjustedLaborSummary.hours)` | What will actually appear in the budget packet |

Visual treatment:
- Green when all three match within 0.1h
- Yellow when coded < estimate (uncoded items exist)
- Red when export != coded (hours lost in pipeline)
- Show the delta prominently when mismatched

**File: `src/pages/Index.tsx`** — render `<HourReconciliationBar>` in the header area, always visible regardless of active tab. Pass `estimateData`, `budgetAdjustments`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/CorruptCodeBanner.tsx` | New — corrupt mapping detector + red banner |
| `src/components/HourReconciliationBar.tsx` | New — three-number reconciliation bar |
| `src/components/ExportDropdown.tsx` | Add reconciliation gate before export |
| `src/pages/Index.tsx` | Render CorruptCodeBanner and HourReconciliationBar |

No database changes required. No changes to BudgetAdjustmentsPanel or budgetExportSystem.

