

## Fab & Foreman Audit Export + totalFabHours Bug Fix

Bundled patch: one bug fix + one new export. No DB changes, no backend, no new dependencies.

### Files touched

| # | File | Action |
|---|---|---|
| 1 | `src/components/BudgetAdjustmentsPanel.tsx` | 1-line logic fix — move `totalFabHours += fabHours` inside the `if (fabCostHead)` block |
| 2 | `src/utils/fabAuditExport.ts` | NEW — pure function `exportFabAuditReport(items, projectInfo, ba)` returning a 4-sheet `.xlsx` |
| 3 | `src/components/ExportDropdown.tsx` | 3 edits — add import, add `handleExportFabAudit`, add menu item below Audit Report |

### Patch 1 — Bug fix in BudgetAdjustmentsPanel

`totalFabHours += fabHours` moves inside the `if (fabCostHead)` block so unrouted stripped hours no longer inflate the aggregate. Today this is gated by the export reconciliation (no broken data ships), but the internal model becomes consistent with what's actually in `adjustedLaborSummary` — which means `computeGcFabCont` sees the real volume gap.

### Patch 2 — `src/utils/fabAuditExport.ts`

Pure client-side, uses existing `xlsx` library (already a project dep via `budgetExportSystem.ts`). Re-aggregates `items` by cost head internally — no new prop plumbing through `Index.tsx`.

**Sheet 1 — Summary:** top-down hour reconciliation
- Original → − Foreman → After Foreman → − Fab → Final Field
- + Fab re-routed + Foreman re-routed (FCNT) = Reconciliation total
- Pass/fail row (delta < 1.0h = PASS)

**Sheet 2 — Strip Trail:** one row per cost head (matches UI table)
- `Cost Head | Description | Original | Foreman % | Foreman Hrs | After Foreman | Fab % | Fab Hrs | Final Field | Routed To`
- Sorted by Original Hours desc, totals row at bottom
- Unrouted fab shows "UNROUTED — hours lost" so the approver sees the gap

**Sheet 3 — Fab Routing:** grouped by fab code with source subrows
- Subrow hours rounded via `roundHoursPreservingTotal` per group so subrows sum exactly to the rolled-up fab code total (avoids drift between fractional `fabricationSummary` and rounded `adjustedLaborSummary`)
- Grand total at bottom

**Sheet 4 — Inputs & Settings:**
- Foreman: enabled/%/hours/$ at bid rate
- Rates: budget, shop, computed bid blended
- Per-cost-head fab config (only enabled rows): % + routes-to
- Project metadata + export timestamp

### Patch 3 — ExportDropdown wiring

- Import `exportFabAuditReport`
- Add `handleExportFabAudit` — toasts pass/fail with reconciliation delta, distinct destructive variant on FAIL with 12s duration so the user reads it before sharing
- Add third menu item below the existing Audit Report (matches existing styling, amber/orange icon to differentiate from green Budget Packet and blue Audit Report)
- No reconciliation gate on this export — the audit IS the reconciliation; blocking it would defeat the purpose (PM needs to see what's broken)

### Technical notes

- `roundHoursPreservingTotal` is exported from `budgetExportSystem.ts` (Largest Remainder Method, already used by main export)
- Cost-head re-aggregation uses the same priority chain as the rest of the app: `item.laborCostHead || item.costCode || item.suggestedCode?.costHead || 'UNCD'`
- Fab route lookup matches by stripping the cost code's last segment against `fabricationSummary[].code` — same pattern the panel uses
- File written via `XLSX.writeFile` (browser download); filename `Fab_Foreman_Audit_{jobNumber}_{YYYY-MM-DD}.xlsx`

### Verification after ship

1. Hamilton project → Export → "Fab & Foreman Audit"
2. Sheet 1 reconciliation delta ≤ 1 hr (PASS)
3. Sheet 2 TOTALS row matches Sheet 1 numbers
4. Sheet 3 per-fab-code subrows sum exactly to group total
5. Sheet 4 reflects the inputs configured in Budget Adjustments panel
6. GC 0FAB CONT on Bid Reconciliation unchanged on Hamilton (all fab strips routed) — the bug fix only affects projects with unrouted strips

