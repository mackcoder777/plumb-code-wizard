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

const FALLBACK_SECTIONS = new Set(['CS', 'UG', 'RF', 'AG']);
const FALLBACK_ACTIVITY_CODES = new Set(['00CS', '00UG', '00RF', '00AG']);

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

export interface SavedMergeRecord {
  id: string;
  sec_code: string;
  cost_head: string;
  merged_act: string;
  reassign_to_head?: string | null;
  redistribute_adjustments?: Record<string, number> | null;
  /**
   * Cross-section reassign target. When set together with `reassign_to_act`,
   * the helper looks for / creates `[reassign_to_sec] [reassign_to_act] [reassign_to_head]`
   * instead of `[sec_code] 0000 [reassign_to_head]`. Drives Pool to 40 and
   * Combine sections (spec §4.1, §10.1).
   *
   * When null/undefined, behavior is unchanged from prior loops — the target
   * lives in the same section as the source.
   */
  reassign_to_sec?: string | null;
  reassign_to_act?: string | null;
}

export interface StaleMergeUpdateEntry {
  mergeId: string;
  secCode: string;
  oldCostHead: string;
  newCostHead: string | null;
  mergeRecord: SavedMergeRecord;
}

export interface ComputeFinalLaborSummaryInput {
  adjustedLaborSummary: Record<string, any> | null | undefined;
  savedMergesData: SavedMergeRecord[] | null | undefined;
  staleMergeUpdates: Array<StaleMergeUpdateEntry | null | undefined>;
  /**
   * Hour redistributions from `project_hour_redistributions` — applied
   * post-merge as Stage 3.5. Each entry rebalances hours between two heads
   * within the same `(sec, act)` bucket. Section total is preserved.
   */
  hourRedistributions?: Array<HourRedistributionEntry> | null;
}

export interface HourRedistributionEntry {
  sec: string;
  act: string;
  sourceHead: string;
  targetHead: string;
  hoursMoved: number;
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

/**
 * Post-merge pipeline: applies section alias normalization, fallback section
 * folding (incl. multitrade activity-based fallbacks), saved merge/redistribute/
 * reassign actions, zero-hour cleanup, and final Largest Remainder rounding.
 *
 * Verbatim extraction of BudgetAdjustmentsPanel.tsx `finalLaborSummary` useMemo
 * (lines 1122-1638 pre-extraction). The body is purely transformational — three
 * inputs in, one map out. `staleMergeUpdates` is a REQUIRED input rather than
 * recomputed inline so the panel and any external consumer (debug route) share
 * one upstream calculation instead of duplicating the logic.
 *
 * Order of operations is identical to the panel's pre-extraction body:
 *   1. Section alias normalization (numeric → B-prefix when canonical exists)
 *   2. Fallback section folding (CS/UG/RF/AG + multitrade fallback activities)
 *   3. Saved merge sec_code normalization + stale fallback remap
 *   4. Reassign chain resolution map (terminal target lookup, depth ≤ 10)
 *   5. Per-merge apply: redistribute / __keep__ / reassign / merge-to-0000
 *   6. Zero-hour cleanup (< 0.05h)
 *   7. Drift reconciliation log (DEV only)
 *   8. Re-rounding via Largest Remainder Method, with rawHours preserved
 *
 * Reordering any of these will drift the Hamilton diff. Do not refactor
 * without re-running the diff.
 */
export function computeFinalLaborSummary(
  input: ComputeFinalLaborSummaryInput
): Record<string, any> {
  const { adjustedLaborSummary, savedMergesData, staleMergeUpdates, hourRedistributions } = input;

  const summary = adjustedLaborSummary;
  if (!summary || Object.keys(summary).length === 0) return summary as any;

  // Build canonical alias map: numeric section → canonical section
  // e.g. "2" → "B2" when a B-prefixed version exists in the same summary
  const sectionAliases: Record<string, string> = {};
  if (summary) {
    Object.values(summary).forEach((item: any) => {
      const parts = (item.code ?? '').trim().split(/\s+/);
      if (parts.length >= 1) {
        const sec = parts[0];
        if (/^\d+$/.test(sec)) {
          const canonical = `B${sec}`;
          const hasCanonical = Object.values(summary).some(
            (i: any) => (i.code ?? '').trim().startsWith(canonical + ' ')
          );
          if (hasCanonical) sectionAliases[sec] = canonical;
        }
      }
    });
  }

  // Normalize any stale numeric sections in the summary itself
  let result: Record<string, any> = {};
  Object.entries(summary).forEach(([key, item]: [string, any]) => {
    const parts = (item.code ?? '').trim().split(/\s+/);
    if (parts.length >= 1 && sectionAliases[parts[0]]) {
      parts[0] = sectionAliases[parts[0]];
      const newCode = parts.join(' ');
      // Merge into existing canonical entry if it exists
      if (result[newCode]) {
        result[newCode] = {
          ...result[newCode],
          hours: (result[newCode].hours ?? 0) + (item.hours ?? 0),
          dollars: (result[newCode].dollars ?? 0) + (item.dollars ?? 0),
        };
      } else {
        result[newCode] = { ...item, code: newCode };
      }
    } else {
      if (result[key]) {
        result[key] = {
          ...result[key],
          hours: (result[key].hours ?? 0) + (item.hours ?? 0),
          dollars: (result[key].dollars ?? 0) + (item.dollars ?? 0),
        };
      } else {
        result[key] = { ...item };
      }
    }
  });

  // Fold standalone fallback sections (CS, RF, ST, UG, AG) into their
  // zone-resolved canonical sections. Prevents timing-gap transients from
  // surviving to export when zone resolution has already placed items correctly.

  // In multitrade mode, fallback sections appear as activity codes (00CS, 00UG, 00RF, 00AG)
  // rather than section prefixes (which are always PL)
  const fallbackKeys = Object.keys(result).filter(k => {
    const kParts = k.trim().split(/\s+/);
    const sec = kParts[0];
    if (FALLBACK_SECTIONS.has(sec)) return true;
    // Multitrade: check activity segment for fallback codes
    if (kParts.length >= 3 && FALLBACK_ACTIVITY_CODES.has(kParts[1])) return true;
    return false;
  });

  fallbackKeys.forEach(fbKey => {
    const parts = fbKey.trim().split(/\s+/);
    const fbSec = parts[0];
    const fbAct = parts.length >= 3 ? parts[1] : '';
    const fbHead = parts[parts.length - 1];

    // Determine if this is a multitrade activity-based fallback (e.g. PL 00CS WATR)
    const isMultitradeFallback = !FALLBACK_SECTIONS.has(fbSec) && FALLBACK_ACTIVITY_CODES.has(fbAct);

    // AG (Site Above Grade) always folds into ST, not a building section
    if (fbSec === 'AG' || (isMultitradeFallback && fbAct === '00AG')) {
      const stKey = Object.keys(result).find(k => {
        const kParts = k.trim().split(/\s+/);
        const kSec = kParts[0];
        const kAct = kParts.length >= 3 ? kParts[1] : '';
        if (isMultitradeFallback) {
          // In multitrade: look for PL SITE head or PL 00ST head
          return kSec === fbSec && !FALLBACK_ACTIVITY_CODES.has(kAct) &&
                 (kAct === 'SITE' || kAct === '00ST') &&
                 kParts[kParts.length - 1] === fbHead;
        }
        return kSec === 'ST' && kParts[kParts.length - 1] === fbHead;
      });
      if (stKey) {
        result[stKey] = {
          ...result[stKey],
          hours: (result[stKey].hours ?? 0) + (result[fbKey].hours ?? 0),
          materialDollars: (result[stKey].materialDollars ?? 0) + (result[fbKey].materialDollars ?? 0),
        };
        delete result[fbKey];
      }
      return; // skip normal folding for AG
    }

    // For multitrade activity-based fallbacks, fold into the largest canonical
    // building code with the same cost head
    if (isMultitradeFallback) {
      // Find all canonical keys with the same section (PL) and cost head,
      // but a real building activity (not a fallback activity)
      const candidates = Object.keys(result).filter(k => {
        if (k === fbKey) return false;
        const kParts = k.trim().split(/\s+/);
        return kParts[0] === fbSec &&
               !FALLBACK_ACTIVITY_CODES.has(kParts[1]) &&
               kParts[kParts.length - 1] === fbHead;
      });
      if (candidates.length > 0) {
        // Pick the candidate with the most hours
        const target = candidates.reduce((best, c) =>
          (result[c]?.hours ?? 0) > (result[best]?.hours ?? 0) ? c : best
        );
        result[target] = {
          ...result[target],
          hours: (result[target].hours ?? 0) + (result[fbKey].hours ?? 0),
          materialDollars: (result[target].materialDollars ?? 0) + (result[fbKey].materialDollars ?? 0),
        };
        delete result[fbKey];
      }
      return;
    }

    // Standard mode: Try 1 — exact activity + cost head match in any canonical section
    let canonicalKey = Object.keys(result).find(k => {
      const kParts = k.trim().split(/\s+/);
      return !FALLBACK_SECTIONS.has(kParts[0]) &&
             kParts[1] === fbAct &&
             kParts[kParts.length - 1] === fbHead;
    });

    // Try 2: preserve activity code, use canonical section
    if (!canonicalKey) {
      const candidates = Object.keys(result).filter(k => {
        const kParts = k.trim().split(/\s+/);
        return !FALLBACK_SECTIONS.has(kParts[0]) &&
               kParts[kParts.length - 1] === fbHead;
      });
      if (candidates.length > 0) {
        // Use the canonical section from the first candidate, but keep original activity
        const canonSec = candidates[0].trim().split(/\s+/)[0];
        const newKey = `${canonSec} ${fbAct} ${fbHead}`;
        const fbEntry = result[fbKey];
        if (result[newKey]) {
          result[newKey] = {
            ...result[newKey],
            hours: (result[newKey].hours ?? 0) + (fbEntry.hours ?? 0),
            materialDollars: (result[newKey].materialDollars ?? 0) + (fbEntry.materialDollars ?? 0),
          };
        } else {
          result[newKey] = { ...fbEntry, code: newKey };
        }
        delete result[fbKey];
      }
      return; // handled or no candidates — skip generic fold below
    }

    if (canonicalKey) {
      result[canonicalKey] = {
        ...result[canonicalKey],
        hours: (result[canonicalKey].hours ?? 0) + (result[fbKey].hours ?? 0),
        materialDollars: (result[canonicalKey].materialDollars ?? 0) + (result[fbKey].materialDollars ?? 0),
      };
      delete result[fbKey];
    }
  });

  if (!savedMergesData?.length) return result;

  // Normalize merge sec_codes using the alias map
  const normalizedMerges = (savedMergesData ?? []).map(merge => ({
    ...merge,
    sec_code: merge.sec_code
      ? (sectionAliases[merge.sec_code] ?? merge.sec_code)
      : merge.sec_code,
  }));

  // Remap stale merge sec_codes: if a saved merge references a fallback section
  // (e.g. CS) but no live keys exist under that section, find the canonical
  // section where the same cost head now lives and remap before applying.
  const remappedMerges = normalizedMerges.map(merge => {
    const mergeSecUpper = (merge.sec_code || '').trim().toUpperCase();
    if (!FALLBACK_SECTIONS.has(mergeSecUpper)) return merge;

    // Check if any live key exists under this fallback section
    const hasLiveKey = Object.keys(result).some(k => {
      const kSec = k.trim().split(/\s+/)[0].toUpperCase();
      const kHead = k.trim().split(/\s+/).pop()?.toUpperCase();
      return kSec === mergeSecUpper && kHead === (merge.cost_head || '').toUpperCase();
    });

    if (hasLiveKey) return merge; // fallback section still has live data, keep as-is

    // Find canonical section for this cost head
    const canonicalKey = Object.keys(result).find(k => {
      const kSec = k.trim().split(/\s+/)[0];
      const kHead = k.trim().split(/\s+/).pop();
      return !FALLBACK_SECTIONS.has(kSec.toUpperCase()) &&
             kHead?.toUpperCase() === (merge.cost_head || '').toUpperCase();
    });

    if (!canonicalKey) return merge; // can't remap, leave for stale detection

    const newSec = canonicalKey.trim().split(/\s+/)[0];
    if (import.meta.env.DEV) console.log(`[finalLaborSummary] Remapping stale merge ${merge.sec_code}|${merge.cost_head} → ${newSec}|${merge.cost_head}`);
    return { ...merge, sec_code: newSec };
  });

  // Build a chain resolution map: for each sec|head, follow reassign_to_head until terminal
  const buildReassignChainMap = (): Map<string, string> => {
    const directMap = new Map<string, string>();
    remappedMerges.forEach(m => {
      const rt = (m as any).reassign_to_head as string | null;
      if (rt && rt !== '__keep__' && rt !== '__merge__' && rt !== '__redistribute__' && !rt.startsWith('__')) {
        directMap.set(`${m.sec_code}|${m.cost_head}`, rt);
      }
    });
    const resolveChain = (sec: string, head: string, visited = new Set<string>()): string => {
      const key = `${sec}|${head}`;
      if (visited.has(key) || visited.size > 10) return head; // cycle/depth guard
      visited.add(key);
      const next = directMap.get(key);
      if (!next) return head;
      return resolveChain(sec, next, visited);
    };
    const resolved = new Map<string, string>();
    directMap.forEach((_, key) => {
      const [sec, head] = key.split('|');
      resolved.set(key, resolveChain(sec, head));
    });
    return resolved;
  };
  const reassignChainMap = buildReassignChainMap();

  remappedMerges.forEach(merge => {
    const head = merge.cost_head;
    const sec = merge.sec_code;
    const reassignTo = (merge as any).reassign_to_head as string | null;
    const redistAdj = (merge as any).redistribute_adjustments as Record<string, number> | null;

    let matchingKeys = Object.keys(result).filter(key => {
      const parts = key.trim().split(/\s+/);
      return parts.length >= 3 && parts[0] === sec && parts.slice(2).join(' ') === head;
    });

    // If no direct key match, attempt fuzzy match by section + similar cost head
    if (matchingKeys.length === 0 && head) {
      const fuzzyKeys = Object.keys(result).filter(k => {
        const parts = k.trim().split(/\s+/);
        if (parts.length < 3) return false;
        const kHead = parts.slice(2).join(' ');
        const kSec = parts[0];
        return kSec === sec && kHead !== head &&
          staleMergeUpdates.some(u => u?.oldCostHead === head && u?.newCostHead === kHead);
      });
      if (fuzzyKeys.length > 0) {
        matchingKeys = fuzzyKeys;
      }
    }

    // Redistribute: apply per-activity hour deltas
    if (redistAdj && Object.keys(redistAdj).length > 0) {
      const _redistHoursBefore = Object.values(result).reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
      // Pre-validate: ensure ALL referenced codes exist before touching any
      const redistEntries = Object.entries(redistAdj).filter(
        ([, delta]) => delta && (delta as number) !== 0
      );
      const missingKeys: string[] = [];
      redistEntries.forEach(([actCode]) => {
        const isFullCode = actCode.includes(' ');
        const fullCode = isFullCode ? actCode : `${sec} ${actCode} ${head}`;
        const matchKey =
          matchingKeys.find((k) => (result[k]?.code ?? '').trim() === fullCode) ??
          fullCode;
        if (!result[matchKey]) missingKeys.push(matchKey);
      });

      if (missingKeys.length > 0) {
        // Attempt activity-token drift fallback: match by sec + cost head ignoring activity
        const remappedAdj: Record<string, number> = {};
        let remapSuccess = true;

        redistEntries.forEach(([actCode, delta]) => {
          const isFullCode = actCode.includes(' ');
          const fullCode = isFullCode ? actCode : `${sec} ${actCode} ${head}`;
          // Match on parsed key segments, not mutable .code field
          // This survives section alias normalization and fallback folding
          const matchKey =
            matchingKeys.find((k) => {
              if (isFullCode) {
                const kParts = k.trim().split(/\s+/);
                const fParts = fullCode.trim().split(/\s+/);
                return kParts[0] === fParts[0] && kParts[1] === fParts[1] && kParts.slice(2).join(' ') === fParts.slice(2).join(' ');
              }
              const kParts = k.trim().split(/\s+/);
              return kParts[0] === sec && kParts[1] === actCode && kParts.slice(2).join(' ') === head;
            }) ?? fullCode;
          if (result[matchKey]) {
            remappedAdj[matchKey] = (remappedAdj[matchKey] ?? 0) + (delta as number);
            return;
          }
          // Find a live key with same section and cost head, different activity
          const fallback = Object.keys(result).find(lk => {
            const lkParts = lk.trim().split(/\s+/);
            return lkParts[0] === sec && lkParts.slice(2).join(' ') === head;
          });
          if (fallback) {
            remappedAdj[fallback] = (remappedAdj[fallback] ?? 0) + (delta as number);
          } else {
            remapSuccess = false;
          }
        });

        if (remapSuccess && Object.keys(remappedAdj).length > 0) {
          Object.entries(remappedAdj).forEach(([key, delta]) => {
            if (result[key]) {
              const rate = result[key].hours > 0 ? result[key].dollars / result[key].hours : 0;
              result[key] = {
                ...result[key],
                hours: result[key].hours + delta,
                dollars: result[key].dollars + delta * rate,
              };
              if (result[key].hours <= 0.001) delete result[key];
            }
          });
        } else {
          if (import.meta.env.DEV) console.warn(
            `[finalLaborSummary] redistribute skipping ${sec}|${head} — missing codes: ${missingKeys.join(', ')}. Remap failed.`
          );
        }
      } else {
        redistEntries.forEach(([actCode, delta]) => {
          const isFullCode = actCode.includes(' ');
          const fullCode = isFullCode ? actCode : `${sec} ${actCode} ${head}`;
          // Match on parsed key segments, not mutable .code field
          const matchKey =
            matchingKeys.find((k) => {
              if (isFullCode) {
                const kParts = k.trim().split(/\s+/);
                const fParts = fullCode.trim().split(/\s+/);
                return kParts[0] === fParts[0] && kParts[1] === fParts[1] && kParts.slice(2).join(' ') === fParts.slice(2).join(' ');
              }
              const kParts = k.trim().split(/\s+/);
              return kParts[0] === sec && kParts[1] === actCode && kParts.slice(2).join(' ') === head;
            }) ?? fullCode;
          const rate = result[matchKey].hours > 0
            ? result[matchKey].dollars / result[matchKey].hours
            : 0;
          result[matchKey] = {
            ...result[matchKey],
            hours: result[matchKey].hours + (delta as number),
            dollars: result[matchKey].dollars + (delta as number) * rate,
          };
          if (result[matchKey].hours <= 0.001) delete result[matchKey];
        });
      }
      // Zero-sum enforcement: redistribution must never change total hours.
      // If some delta target keys were missing and their deltas were dropped,
      // absorb the residual into the largest surviving matching key.
      const _redistHoursAfter = Object.values(result).reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
      const _redistDrift = _redistHoursAfter - _redistHoursBefore;
      if (Math.abs(_redistDrift) > 0.01) {
        const _liveMatchKeys = matchingKeys.filter(k => result[k] && (result[k].hours ?? 0) > 0.5);
        if (_liveMatchKeys.length > 0) {
          const _absorbKey = _liveMatchKeys.reduce((a, b) =>
            (result[a]?.hours ?? 0) >= (result[b]?.hours ?? 0) ? a : b
          );
          const _absorbRate = (result[_absorbKey].hours ?? 0) > 0
            ? (result[_absorbKey].dollars ?? 0) / (result[_absorbKey].hours ?? 1)
            : 0;
          result[_absorbKey] = {
            ...result[_absorbKey],
            hours: (result[_absorbKey].hours ?? 0) - _redistDrift,
            dollars: (result[_absorbKey].dollars ?? 0) - _redistDrift * _absorbRate,
          };
        }
      }
      return; // do not fall through to merge/reassign logic
    }

    if (reassignTo === '__keep__') {
      return; // hours stay on original code, nothing to do
    }

    if (reassignTo) {
      // Resolve through any reassignment chain to find the terminal target
      const effectiveTargetHead = reassignChainMap.get(`${sec}|${head}`) ?? reassignTo;

      // Spec §10.1: when `reassign_to_sec` is set (Pool to 40 / Combine sections),
      // the target lives in a DIFFERENT section than the source. The helper must
      // look for / create the target under that new section, not the source's.
      // When null, behavior is unchanged: target lives in same section as source.
      const targetSec = (merge as any).reassign_to_sec || sec;
      const targetAct = (merge as any).reassign_to_act || '0000';

      // Reassign: move hours/dollars to the terminal target cost head.
      // Match exact (sec, act, head) when reassign_to_sec is set; otherwise
      // match same-sec / same-head with any activity (legacy behavior).
      const isCrossSection = !!(merge as any).reassign_to_sec;
      const targetKey = Object.keys(result).find(key => {
        const parts = key.trim().split(/\s+/);
        if (parts.length < 3) return false;
        if (parts.slice(2).join(' ') !== effectiveTargetHead) return false;
        if (isCrossSection) {
          return parts[0] === targetSec && parts[1] === targetAct;
        }
        return parts[0] === sec;
      });
      // Exclude target from source keys to prevent double-counting
      const sourceKeys = targetKey ? matchingKeys.filter(k => k !== targetKey) : matchingKeys;
      const sourceHours = sourceKeys.reduce((s, k) => s + (result[k]?.hours ?? 0), 0);
      const sourceDollars = sourceKeys.reduce((s, k) => s + (result[k]?.dollars ?? 0), 0);
      if (targetKey) {
        result[targetKey] = {
          ...result[targetKey],
          hours: result[targetKey].hours + sourceHours,
          dollars: result[targetKey].dollars + sourceDollars,
        };
        sourceKeys.forEach(k => delete result[k]);
      } else {
        const specialValues = ['__redistribute__', '__merge__', ''];
        if (!effectiveTargetHead || specialValues.includes(effectiveTargetHead)) {
          matchingKeys.forEach(k => delete result[k]);
          return;
        }
        // §10.1: use the cross-section target when set, otherwise fall back
        // to the legacy same-sec / 0000 target. Line 1593 of the original
        // panel — "load-bearing for Fold to PLMB and Pool to 40."
        const newTargetKey = `${targetSec} ${targetAct} ${effectiveTargetHead}`;
        if (import.meta.env.DEV && isCrossSection) {
          console.log(
            `[finalLaborSummary] cross-section reassign: ${sec}|${head} → ${newTargetKey} (op=${(merge as any).operation_type ?? 'unknown'})`
          );
        }
        result[newTargetKey] = {
          code: newTargetKey,
          sec: targetSec,
          activityCode: targetAct,
          head: effectiveTargetHead,
          hours: sourceHours,
          dollars: sourceDollars,
          description: `Reassigned from ${head}`,
        };
        matchingKeys.forEach(k => delete result[k]);
      }
    } else {
      // Standard merge to 0000
      if (matchingKeys.length < 1) return;

      // Guard: Never consume codes with real location activities.
      // SITE/00ST = Site section (user-assigned, never fold).
      // Above-threshold non-fallback activities = building codes (00BD, 00B1, etc.)
      // that represent deliberate multitrade location assignments.
      // Only consume: 0000-activity target, known transient fallback activities,
      // and genuinely sub-threshold floor codes (the original small-code intent).
      const safeMatchingKeys = matchingKeys.filter(k => {
        const kParts = k.trim().split(/\s+/);
        const kAct = kParts.length >= 3 ? kParts[1] : '0000';
        // ST (Site) is a real user-assigned section — never merge it away
        if (kAct === 'SITE' || kAct === '00ST') return false;
        // Always include the 0000-activity merge target
        if (kAct === '0000') return true;
        // Include known transient fallback activities (00CS, 00UG, 00RF, 00AG)
        if (FALLBACK_ACTIVITY_CODES.has(kAct)) return true;
        // All other activities: include in merge.
        // Building codes (00BD, 00B1, etc.) should consolidate when a merge rule exists.
        // The only protected activity is SITE/00ST (hardcoded above).
        return true;
      });

      if (safeMatchingKeys.length < 1) return;
      const group = safeMatchingKeys.map(k => result[k]);
      const mergedHours = group.reduce((s, i) => s + (i.hours ?? 0), 0);
      const mergedDollars = group.reduce((s, i) => s + (i.dollars ?? 0), 0);
      const mergedCode = `${sec} ${merge.merged_act} ${head}`;
      safeMatchingKeys.forEach(k => delete result[k]);
      if (result[mergedCode]) {
        result[mergedCode] = {
          ...result[mergedCode],
          hours: (result[mergedCode].hours ?? 0) + mergedHours,
          dollars: (result[mergedCode].dollars ?? 0) + mergedDollars,
        };
      } else {
        result[mergedCode] = { ...group[0], code: mergedCode, hours: mergedHours, dollars: mergedDollars };
      }
    }

  });

  // Clean up entries with effectively zero hours after merges
  Object.keys(result).forEach(k => {
    if (Math.abs(result[k]?.hours ?? 0) < 0.05) delete result[k];
  });

  // Reconciliation check — warn if hours were lost during merge application
  const inputHours = Object.values(adjustedLaborSummary ?? {}).reduce(
    (s: number, e: any) => s + (e.hours ?? 0),
    0
  );
  const outputHours = Object.values(result).reduce(
    (s: number, e: any) => s + (e.hours ?? 0),
    0
  );
  const drift: number = inputHours - outputHours;
  if (Math.abs(drift) > 0.1) {
    if (import.meta.env.DEV) console.warn(
      `[finalLaborSummary] ⚠ Hour drift detected: input=${inputHours.toFixed(2)} output=${outputHours.toFixed(2)} lost=${drift.toFixed(2)}h`
    );
  }

  // Re-round after merges/redistributions may have reintroduced fractional hours
  const finalKeys = Object.keys(result);
  if (finalKeys.length > 0) {
    // Preserve pre-rounding hours for stable threshold checks (prevents rounding jitter)
    finalKeys.forEach(k => {
      result[k] = { ...result[k], rawHours: result[k].hours ?? 0 };
    });
    const finalRawHours = finalKeys.map(k => result[k].rawHours ?? result[k].hours ?? 0);
    const finalRoundedHours = roundHoursPreservingTotal(finalRawHours);
    finalKeys.forEach((k, i) => {
      result[k] = { ...result[k], hours: finalRoundedHours[i] };
    });
  }

  return result;
}