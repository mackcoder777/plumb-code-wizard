/**
 * Pure helper extractions from BudgetAdjustmentsPanel.tsx.
 *
 * These functions own the labor/fab pre-merge calculation
 * (computeAdjustedLaborSummary) and the post-merge pipeline
 * (computeFinalLaborSummary, to be added in Commit 1b).
 *
 * The panel composes them with its local material-tax pass and consumer
 * bundle. The /debug/code-cleanup route (Commit 3) composes the same
 * helpers without the panel mounted, so PMs can verify detector inputs
 * against finalLaborSummary directly.
 *
 * Architectural rule: any shared math between the panel and an external
 * consumer (debug route, future Code Cleanup tab) lives here. Never
 * duplicate inline.
 */

import { roundHoursPreservingTotal } from '@/utils/budgetExportSystem';

const FAB_SECTION = 'FP';
const FAB_ACTIVITY = '0000';

const FAB_COST_HEAD_DESCRIPTIONS: Record<string, string> = {
  COPR: 'FABRICATION - COPPER',
  CSTI: 'FABRICATION - CAST IRON',
  CSTF: 'FABRICATION - CARBON STEEL TEFLON LINED',
  CRBN: 'FABRICATION - CARBON STEEL',
  SSTL: 'FABRICATION - STAINLESS STEEL',
  SS10: 'FABRICATION - STAINLESS 10GA',
  PLST: 'FABRICATION - PLASTIC / CPVC',
  BRAZ: 'FABRICATION - BRAZED',
  HFBS: 'FABRICATION - HANGER FAB SHEETS',
  HNGS: 'FABRICATION - HANGERS & SUPPORTS',
  FNSH: 'FABRICATION - FINISH',
};

export interface LaborCodeSummaryInput {
  code: string;
  description: string;
  fieldHours: number;
  rate: number;
}

export interface FabricationConfigInput {
  enabled: boolean;
  percentage: number;
}

export interface AdjustedLaborSummaryEntry {
  code: string;
  description: string;
  hours: number;
  rate: number;
  dollars: number;
  type: 'field' | 'fab' | 'foreman';
}

export interface AdjustedLaborFabricationSummaryEntry {
  code: string;
  description: string;
  fabCode: string;
  strippedHours: number;
  remainingFieldHours: number;
}

export interface ComputeAdjustedLaborSummaryInput {
  laborSummary: Record<string, LaborCodeSummaryInput>;
  foremanBonusEnabled: boolean;
  foremanBonusPercent: number;
  computedBidLaborRate: number;
  fabricationConfigs: Record<string, FabricationConfigInput>;
  fabCodeMap: Record<string, string>;
  fabRates: Record<string, { bidRate: string; budgetRate: string }>;
  customFabCodes: Record<string, string>;
  shopRate: number;
  budgetRate: number;
}

export interface ComputeAdjustedLaborSummaryResult {
  adjustedLaborSummary: Record<string, AdjustedLaborSummaryEntry>;
  foremanBonusHours: number;
  foremanBonusDollars: number;
  fabricationSummary: AdjustedLaborFabricationSummaryEntry[];
  totalFieldHours: number;
  totalFabHours: number;
  generatedFabCodes: Record<string, number>;
}

/**
 * Pre-merge labor + foreman strip + fab routing + Largest Remainder rounding.
 *
 * Verbatim extraction of BudgetAdjustmentsPanel.tsx `calculations` useMemo
 * lines 987-1129 (labor pass + fab assembly + rounding). Material tax,
 * total dollars, and other downstream bundle fields stay in the panel.
 *
 * Order of operations is identical to the panel's pre-extraction body:
 *   1. Original total hours
 *   2. Foreman bonus hours/dollars + foremanStripRatio
 *   3. Per-code loop: apply foreman strip, route to fab if enabled
 *   4. Assemble fab codes from accumulator (one per material cost head)
 *   5. Largest Remainder rounding over the assembled adjustedLaborSummary
 *
 * Reordering any of these will drift the Hamilton diff. Do not refactor
 * without re-running the diff.
 */
export function computeAdjustedLaborSummary(
  input: ComputeAdjustedLaborSummaryInput
): ComputeAdjustedLaborSummaryResult {
  const {
    laborSummary,
    foremanBonusEnabled,
    foremanBonusPercent,
    computedBidLaborRate,
    fabricationConfigs,
    fabCodeMap,
    fabRates,
    customFabCodes,
    shopRate,
    budgetRate,
  } = input;

  const originalTotalHours = Object.values(laborSummary)
    .reduce((sum, item) => sum + (item.fieldHours || 0), 0);

  const foremanBonusHours = foremanBonusEnabled
    ? originalTotalHours * (foremanBonusPercent / 100)
    : 0;
  const foremanBonusDollars = foremanBonusHours * computedBidLaborRate;

  const hoursAfterForemanStrip = originalTotalHours - foremanBonusHours;
  const foremanStripRatio = originalTotalHours > 0 ? hoursAfterForemanStrip / originalTotalHours : 1;

  const fabricationSummary: AdjustedLaborFabricationSummaryEntry[] = [];
  const adjustedLaborSummary: Record<string, AdjustedLaborSummaryEntry> = {};

  let totalFieldHours = 0;
  let totalFabHours = 0;

  // Accumulate fab hours by material cost head before assembling codes
  const fabAccumulator: Record<string, { hours: number }> = {};

  Object.entries(laborSummary).forEach(([code, data]) => {
    const hoursAfterForeman = (data.fieldHours || 0) * foremanStripRatio;
    // Look up fab config by cost head (last segment)
    const parts = code.trim().split(/\s+/);
    const costHead = parts[parts.length - 1];
    const fabConfig = fabricationConfigs[costHead];
    const fabEnabled = fabConfig?.enabled || false;
    const fabPercent = fabConfig?.percentage || 0;

    if (fabEnabled && fabPercent > 0) {
      const fabHours = hoursAfterForeman * (fabPercent / 100);
      const fieldHours = hoursAfterForeman - fabHours;

      adjustedLaborSummary[code] = {
        code,
        description: data.description,
        hours: fieldHours,
        rate: budgetRate,
        dollars: fieldHours * budgetRate,
        type: 'field',
      };

      // Accumulate into material fab bucket using the routing map.
      // Only count hours toward totalFabHours if they actually route to a
      // fab code — unrouted stripped hours would otherwise inflate the
      // aggregate and make computeGcFabCont underestimate the volume gap.
      const fabCostHead = fabCodeMap[costHead];
      if (fabCostHead) {
        fabAccumulator[fabCostHead] = {
          hours: (fabAccumulator[fabCostHead]?.hours || 0) + fabHours,
        };
        totalFabHours += fabHours;
      } else {
        if (import.meta.env.DEV) console.warn(`No fab material mapping defined for cost head: ${costHead}`);
      }

      fabricationSummary.push({
        code,
        description: data.description,
        fabCode: fabCostHead ? `${FAB_SECTION} ${FAB_ACTIVITY} ${fabCostHead}` : `FP ???? ${costHead}`,
        strippedHours: fabHours,
        remainingFieldHours: fieldHours,
      });

      totalFieldHours += fieldHours;
    } else {
      adjustedLaborSummary[code] = {
        code,
        description: data.description,
        hours: hoursAfterForeman,
        rate: budgetRate,
        dollars: hoursAfterForeman * budgetRate,
        type: 'field',
      };
      totalFieldHours += hoursAfterForeman;
    }
  });

  // Insert one properly assembled fab code per material type
  // e.g. "FP 0000 COPR", "FP 0000 CSTF", "FP 0000 HFBS"
  const generatedFabCodes: Record<string, number> = {};
  Object.entries(fabAccumulator).forEach(([fabCostHead, { hours }]) => {
    const assembledCode = `${FAB_SECTION} ${FAB_ACTIVITY} ${fabCostHead}`;
    const fabBudgetRate = parseFloat(fabRates[fabCostHead]?.budgetRate) || shopRate;
    adjustedLaborSummary[assembledCode] = {
      code: assembledCode,
      description: FAB_COST_HEAD_DESCRIPTIONS[fabCostHead] || customFabCodes[fabCostHead] || `FABRICATION - ${fabCostHead}`,
      hours,
      rate: fabBudgetRate,
      dollars: hours * fabBudgetRate,
      type: 'fab',
    };
    generatedFabCodes[fabCostHead] = hours;
  });

  // Round at source using Largest Remainder Method.
  // Must happen before small code thresholds, merge detection, and export
  // so every downstream consumer sees only whole numbers.
  const summaryKeys = Object.keys(adjustedLaborSummary);
  if (summaryKeys.length > 0) {
    const rawHours = summaryKeys.map(k => adjustedLaborSummary[k].hours ?? 0);
    const roundedHours = roundHoursPreservingTotal(rawHours);
    summaryKeys.forEach((k, i) => {
      adjustedLaborSummary[k] = { ...adjustedLaborSummary[k], hours: roundedHours[i] };
    });
  }

  return {
    adjustedLaborSummary,
    foremanBonusHours,
    foremanBonusDollars,
    fabricationSummary,
    totalFieldHours,
    totalFabHours,
    generatedFabCodes,
  };
}