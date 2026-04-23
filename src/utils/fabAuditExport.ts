// Fabrication & Foreman Strip Audit Export
// Produces a 4-sheet Excel workbook that traces every hour from raw bid
// through foreman strip, fab strip, and fab routing. Read-only audit —
// does not mutate budget state, does not change any math.
//
// Sheets:
//   1. Summary           — top-down hour reconciliation
//   2. Strip Trail       — per-cost-head strip breakdown (matches UI table)
//   3. Fab Routing       — per-fab-code source trail with contribution hours
//   4. Inputs & Settings — audit of inputs that drove the numbers

import * as XLSX from 'xlsx';
import { BudgetAdjustments } from '@/components/BudgetAdjustmentsPanel';
import {
  ExportEstimateItem,
  ProjectInfo,
  roundHoursPreservingTotal,
} from './budgetExportSystem';

export interface FabAuditResult {
  filename: string;
  success: boolean;
  reconciliationPass: boolean;
  reconciliationDelta: number;
}

/**
 * Export the Fabrication & Foreman Strip Audit Report.
 * Reconciles original hours → foreman strip → fab strip → final field + fab re-routed.
 */
export function exportFabAuditReport(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  ba: BudgetAdjustments
): FabAuditResult {
  const wb = XLSX.utils.book_new();

  // ── Build cost-head groupings from raw items (matches UI groupedByCostHead) ──
  // Sheet 2 needs "original hours" per cost head BEFORE any strip. This is
  // the same aggregation the UI fab strip table uses — group raw items by
  // the last segment of their labor cost code.
  //
  // CRITICAL: extract the last segment. item.costCode holds FULL codes
  // (e.g. "PL 00BA WATR"), and fabricationConfigs is keyed by cost head
  // (e.g. "WATR"). Using the full code as the group key makes every fab
  // config lookup miss and every fab column render as 0 / "—".
  const extractCostHead = (raw: string): string => {
    const parts = raw.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  const originalByCostHead: Record<string, { hours: number; description: string }> = {};
  items.forEach(item => {
    const hours = parseFloat(String(item.hours)) || 0;
    if (hours <= 0) return;
    const rawCode =
      item.laborCostHead ||
      item.costCode ||
      item.suggestedCode?.costHead ||
      'UNCD';
    const costHead = extractCostHead(rawCode);
    const description =
      item.laborDescription ||
      item.suggestedCode?.description ||
      costHead;
    if (!originalByCostHead[costHead]) {
      originalByCostHead[costHead] = { hours: 0, description };
    }
    originalByCostHead[costHead].hours += hours;
  });

  // ── Inputs ──
  const foremanEnabled = !!ba.foremanBonusEnabled;
  const foremanPct = ba.foremanBonusPercent || 0;
  const foremanHours = ba.foremanBonusHours || 0;

  // Reconciliation source totals
  const originalTotalHours = items.reduce(
    (s, i) => s + (parseFloat(String(i.hours)) || 0),
    0
  );
  const finalFieldHours = ba.totalFieldHours || 0;
  const fabReRoutedHours = ba.totalFabHours || 0;
  const foremanReRoutedHours = foremanHours;
  const reconTotal = finalFieldHours + fabReRoutedHours + foremanReRoutedHours;
  const reconDelta = originalTotalHours - reconTotal;
  const reconPass = Math.abs(reconDelta) < 1.0;

  const foremanStripRatio =
    foremanEnabled && originalTotalHours > 0
      ? foremanHours / originalTotalHours
      : 0;

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 1 — Summary
  // ═══════════════════════════════════════════════════════════════════
  const summaryRows: (string | number)[][] = [
    ['FABRICATION & FOREMAN STRIP AUDIT'],
    [`Project: ${projectInfo.jobNumber} — ${projectInfo.jobName}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Prepared by: ${projectInfo.preparedBy}`],
    [],
    ['HOUR RECONCILIATION'],
    ['Stage', 'Hours', 'Notes'],
    [
      'Original field hours (pre-strip)',
      Math.round(originalTotalHours),
      'Raw bid hours from estimate items',
    ],
    [
      '− Foreman bonus strip',
      -Math.round(foremanHours),
      foremanEnabled ? `${foremanPct}% of original hours` : 'Disabled',
    ],
    [
      '= After foreman strip',
      Math.round(originalTotalHours - foremanHours),
      'Pool available for fab strip',
    ],
    [
      '− Fab strip',
      -Math.round(fabReRoutedHours),
      `${ba.fabricationSummary?.length || 0} source codes stripped`,
    ],
    [
      '= Final field hours',
      Math.round(finalFieldHours),
      'Remains on field cost codes after both strips',
    ],
    [],
    ['RE-ROUTED HOURS (same hours, different codes)'],
    [
      '+ Fab hours re-routed to FP codes',
      Math.round(fabReRoutedHours),
      'Emerges as FP 0000 {material} entries',
    ],
    [
      '+ Foreman hours reserved as FCNT',
      Math.round(foremanReRoutedHours),
      'Material-side dollar reserve (GC 0000 FCNT)',
    ],
    [],
    ['RECONCILIATION'],
    ['Original hours', Math.round(originalTotalHours)],
    ['Final field + fab re-routed + foreman re-routed', Math.round(reconTotal)],
    [
      'Delta',
      Math.round(reconDelta),
      reconPass ? 'PASS — strip math closes' : 'FAIL — investigate upstream',
    ],
    [],
    [
      reconPass
        ? '✓ All hours accounted for.'
        : '⚠ Reconciliation failed. Check foreman bonus inputs or fab routing for missing mappings.',
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 46 },
    { wch: 14 },
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 2 — Per-Cost-Head Strip Trail
  // ═══════════════════════════════════════════════════════════════════
  const trailHeader = [
    'Cost Head',
    'Description',
    'Original Hours',
    'Foreman Strip %',
    'Foreman Hrs',
    'After Foreman',
    'Fab Strip %',
    'Fab Hrs Stripped',
    'Final Field Hrs',
    'Routed To Fab Code',
  ];

  const trailRows: (string | number)[][] = [];
  const sortedCostHeads = Object.entries(originalByCostHead).sort(
    (a, b) => b[1].hours - a[1].hours
  );

  let trailTotalOriginal = 0;
  let trailTotalForeman = 0;
  let trailTotalFab = 0;
  let trailTotalFinal = 0;

  sortedCostHeads.forEach(([costHead, { hours: original, description }]) => {
    const fabConfig = ba.fabricationConfigs?.[costHead];
    const fabEnabled = !!fabConfig?.enabled;
    const fabPct = fabConfig?.percentage || 0;

    const foremanStrip = original * foremanStripRatio;
    const afterForeman = original - foremanStrip;
    const fabStrip = fabEnabled ? afterForeman * (fabPct / 100) : 0;
    const finalField = afterForeman - fabStrip;

    let fabRouteDisplay = '—';
    if (fabEnabled) {
      const routed = ba.fabricationSummary?.find(f => {
        const parts = (f.code || '').trim().split(/\s+/);
        return parts[parts.length - 1] === costHead;
      });
      fabRouteDisplay = routed?.fabCode || 'UNROUTED — hours lost';
    }

    trailTotalOriginal += original;
    trailTotalForeman += foremanStrip;
    trailTotalFab += fabStrip;
    trailTotalFinal += finalField;

    trailRows.push([
      costHead,
      description,
      Math.round(original),
      foremanEnabled ? `${foremanPct.toFixed(2)}%` : '—',
      foremanEnabled ? Math.round(foremanStrip) : 0,
      Math.round(afterForeman),
      fabEnabled ? `${fabPct}%` : '—',
      fabEnabled ? Math.round(fabStrip) : 0,
      Math.round(finalField),
      fabRouteDisplay,
    ]);
  });

  const trailData: (string | number)[][] = [
    trailHeader,
    ...trailRows,
    [
      'TOTALS',
      '',
      Math.round(trailTotalOriginal),
      '',
      Math.round(trailTotalForeman),
      Math.round(trailTotalOriginal - trailTotalForeman),
      '',
      Math.round(trailTotalFab),
      Math.round(trailTotalFinal),
      '',
    ],
  ];

  const wsTrail = XLSX.utils.aoa_to_sheet(trailData);
  wsTrail['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTrail, 'Strip Trail');

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 3 — Fab Material Routing
  // ═══════════════════════════════════════════════════════════════════
  const routingHeader = [
    'Fab Code',
    'Description / Source Code',
    'Hours',
    'Strip %',
    'Source Description',
  ];

  const routingRows: (string | number)[][] = [];

  const fabGroups: Record<
    string,
    Array<{
      sourceCode: string;
      sourceDescription: string;
      strippedHours: number;
      stripPct: number;
    }>
  > = {};

  (ba.fabricationSummary || []).forEach(entry => {
    if (!fabGroups[entry.fabCode]) fabGroups[entry.fabCode] = [];
    const parts = (entry.code || '').trim().split(/\s+/);
    const sourceCostHead = parts[parts.length - 1];
    const stripPct =
      ba.fabricationConfigs?.[sourceCostHead]?.percentage || 0;
    fabGroups[entry.fabCode].push({
      sourceCode: entry.code,
      sourceDescription: entry.description,
      strippedHours: entry.strippedHours,
      stripPct,
    });
  });

  const sortedFabCodes = Object.entries(fabGroups).sort(
    ([, a], [, b]) =>
      b.reduce((s, e) => s + e.strippedHours, 0) -
      a.reduce((s, e) => s + e.strippedHours, 0)
  );

  sortedFabCodes.forEach(([fabCode, sources]) => {
    const rawHours = sources.map(s => s.strippedHours);
    const roundedHours = roundHoursPreservingTotal(rawHours);
    const groupTotal = roundedHours.reduce((s, h) => s + h, 0);

    const fabDesc =
      fabCode === 'UNROUTED — hours lost'
        ? 'UNROUTED — hours lost'
        : `FABRICATION — ${fabCode.split(' ').pop() || ''}`;

    routingRows.push([
      fabCode,
      fabDesc,
      groupTotal,
      '',
      `(${sources.length} source${sources.length !== 1 ? 's' : ''})`,
    ]);

    sources.forEach((s, i) => {
      routingRows.push([
        '',
        `  ← ${s.sourceCode}`,
        roundedHours[i],
        `${s.stripPct}%`,
        s.sourceDescription,
      ]);
    });

    routingRows.push([]);
  });

  const grandTotalFab = sortedFabCodes.reduce(
    (s, [, sources]) =>
      s + Math.round(sources.reduce((ss, e) => ss + e.strippedHours, 0)),
    0
  );
  routingRows.push(['GRAND TOTAL FAB HOURS', '', grandTotalFab, '', '']);

  const routingData: (string | number)[][] = [routingHeader, ...routingRows];

  const wsRouting = XLSX.utils.aoa_to_sheet(routingData);
  wsRouting['!cols'] = [
    { wch: 18 },
    { wch: 36 },
    { wch: 12 },
    { wch: 10 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRouting, 'Fab Routing');

  // ═══════════════════════════════════════════════════════════════════
  // SHEET 4 — Inputs & Settings
  // ═══════════════════════════════════════════════════════════════════
  const inputRows: (string | number)[][] = [
    ['INPUTS & SETTINGS'],
    [],
    ['Foreman Bonus Strip'],
    ['Enabled', foremanEnabled ? 'Yes' : 'No'],
    ['Strip Percentage', foremanEnabled ? `${foremanPct}%` : '—'],
    ['Hours Stripped', Math.round(foremanHours)],
    [
      'Bid Blended Rate (field only)',
      `$${(ba.computedBidLaborRate || 0).toFixed(2)}/hr`,
    ],
    [
      'Foreman Bonus Value (FCNT)',
      `$${(ba.foremanBonusDollars || 0).toFixed(2)}`,
    ],
    [],
    ['Rates'],
    ['Budget Rate (field)', `$${(ba.budgetRate || 0).toFixed(2)}/hr`],
    ['Shop Rate (fab)', `$${(ba.shopRate || 0).toFixed(2)}/hr`],
    [
      'Computed Bid Labor Rate',
      `$${(ba.computedBidLaborRate || 0).toFixed(2)}/hr`,
    ],
    [],
    ['Per-Cost-Head Fab Configuration'],
    ['Cost Head', 'Fab Enabled', 'Strip %', 'Routes To'],
  ];

  sortedCostHeads.forEach(([costHead]) => {
    const cfg = ba.fabricationConfigs?.[costHead];
    if (!cfg?.enabled) return;
    const routed = ba.fabricationSummary?.find(f => {
      const parts = (f.code || '').trim().split(/\s+/);
      return parts[parts.length - 1] === costHead;
    });
    const routedCode = routed?.fabCode || '— (no routing)';
    inputRows.push([costHead, 'Yes', `${cfg.percentage}%`, routedCode]);
  });

  inputRows.push(
    [],
    ['Project'],
    ['Job Number', projectInfo.jobNumber],
    ['Job Name', projectInfo.jobName],
    ['Date', projectInfo.date.toLocaleDateString()],
    ['Prepared By', projectInfo.preparedBy],
    ['Export Timestamp', new Date().toISOString()]
  );

  const wsInputs = XLSX.utils.aoa_to_sheet(inputRows);
  wsInputs['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsInputs, 'Inputs & Settings');

  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = projectInfo.jobNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Fab_Foreman_Audit_${safeName}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);

  return {
    filename,
    success: true,
    reconciliationPass: reconPass,
    reconciliationDelta: reconDelta,
  };
}
