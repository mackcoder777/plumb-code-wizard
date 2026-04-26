/**
 * Code Cleanup Detector — Phase 1 detection layer
 * Spec: CODE_CLEANUP_TAB_SPEC.md §7
 *
 * Pure function. Inputs: post-merge labor summary keyed by "SEC ACT HEAD",
 * plus thresholds. Outputs three candidate arrays for the three-step PM workflow.
 *
 * No UI. No persistence. No side effects. The Phase 1 risk gate is:
 * "Lovable cites Pasadena test cases verified against expected output."
 */

export interface FinalLaborEntry {
  hours: number;
  dollars?: number;
  [key: string]: any;
}

export type FinalLaborSummary = Record<string, FinalLaborEntry>;

export interface CleanupThresholds {
  /** Per-line floor — default 12h per spec §4.4 (8–16h range). */
  lineFloor: number;
  /** Section threshold — default 80h per spec §7.2. */
  sectionThreshold: number;
}

/** Step 1 — global head decisions (spec §7.1). */
export interface Step1Candidate {
  head: string;
  nTotal: number;
  nSmall: number;
  totalHours: number;
  /** Every instance of this head, with section / activity / hours. Small ones flagged. */
  instances: Array<{
    sec: string;
    act: string;
    hours: number;
    isSmall: boolean;
  }>;
}

/** Step 2 — section folds (spec §7.2). Computed AFTER subtracting Step 1 movements. */
export interface Step2Candidate {
  sec: string;
  remainingTotal: number;
  remainingCodes: number;
  /** Heads still present in this section after Step 1. */
  heads: Array<{ head: string; act: string; hours: number }>;
}

/** Step 3 — what's left (spec §7.3). Lines still under floor after Steps 1+2. */
export interface Step3Candidate {
  key: string;
  sec: string;
  act: string;
  head: string;
  hours: number;
  /** Section's total hours (post-Step-1) — drives Accept default. */
  sectionTotal: number;
  sectionIsHealthy: boolean;
  /** True iff this head is also surfaced in Step 1 (drives "no default — PM picks"). */
  headInStep1: boolean;
  /** Default action per spec §7.3 last paragraph. null when PM must pick. */
  defaultAction: 'accept' | null;
}

export interface DetectionResult {
  step1Candidates: Step1Candidate[];
  step2Candidates: Step2Candidate[];
  step3Candidates: Step3Candidate[];
  /** Summary numbers for debugging / verification gate. */
  meta: {
    totalLines: number;
    totalHours: number;
    linesBelowFloor: number;
    hoursAffected: number;
    thresholds: CleanupThresholds;
  };
}

// ---------------------------------------------------------------------------
// Pending decisions — in-flight Step 1/2/3 selections, not yet persisted.
// applyPendingDecisions() projects them onto a finalLaborSummary so the UI can
// recompute live (Step 2 cards shrink as Step 1 pools, Step 3 disappears as
// Steps 1+2 absorb lines, footer preview reflects the apply-time delta).
//
// Per spec §7: detection runs against finalLaborSummary; live preview runs
// against applyPendingDecisions(finalLaborSummary, decisions). Persistence
// happens elsewhere — this layer is pure.
// ---------------------------------------------------------------------------

export type Step1Decision =
  | { kind: 'pool_to_40' }
  | { kind: 'reroute_global'; targetHead: string }
  | { kind: 'keep_distributed' }
  | { kind: 'custom'; targetSec: string; targetAct: string; targetHead: string };

export interface Step2Decision {
  /** "fold": SEC 0000 PLMB. "combine": both source sections fold to a PM-named target. */
  kind: 'fold' | 'combine';
  /** Combine only — the partner section's code (the other half of the merge). */
  combineWithSec?: string;
  /** Combine only — PM-invented target SEC name (e.g., "MZ"). */
  combinedSec?: string;
  /** Combine only — PM scope note for the field. */
  fieldScopeNote?: string;
  /**
   * Optional ACT override for the fold target. Defaults to "0000".
   * PM may type "BLDG" or any other 4-char ACT.
   */
  targetAct?: string;
  /**
   * Optional HEAD override for the fold target. Defaults to "PLMB".
   * PM may route the section's residual to a peer head instead.
   */
  targetHead?: string;
}

export type Step3Decision =
  | { kind: 'accept' }
  | { kind: 'redistribute'; sourceHead: string; hours: number }
  | { kind: 'reroute'; targetSec: string; targetAct: string; targetHead: string }
  | { kind: 'custom'; targetSec: string; targetAct: string; targetHead: string };

export interface PendingDecisions {
  /** key: head name (matches Step1Candidate.head) */
  step1: Record<string, Step1Decision>;
  /** key: sec code (matches Step2Candidate.sec) */
  step2: Record<string, Step2Decision>;
  /** key: full "SEC ACT HEAD" (matches Step3Candidate.key) */
  step3: Record<string, Step3Decision>;
}

export const EMPTY_PENDING: PendingDecisions = { step1: {}, step2: {}, step3: {} };

/**
 * Project pending decisions onto a finalLaborSummary. Pure: same input → same output.
 * Used by the UI for live preview; the persistence layer writes via the existing
 * project_small_code_merges + project_hour_redistributions tables.
 *
 * Order matters and mirrors §7:
 *   1. Step 1 head decisions (pool / reroute / keep / custom)
 *   2. Step 2 section folds (fold / combine)
 *   3. Step 3 per-line actions (accept / redistribute / reroute / custom)
 */
export function applyPendingDecisions(
  finalLaborSummary: FinalLaborSummary,
  decisions: PendingDecisions
): FinalLaborSummary {
  const result: FinalLaborSummary = {};
  for (const [k, v] of Object.entries(finalLaborSummary || {})) {
    result[k] = { ...v };
  }

  const move = (fromKey: string, toSec: string, toAct: string, toHead: string) => {
    const src = result[fromKey];
    if (!src) return;
    const targetKey = `${toSec} ${toAct} ${toHead}`.trim();
    const tgt = result[targetKey];
    if (tgt) {
      tgt.hours = (tgt.hours ?? 0) + (src.hours ?? 0);
      tgt.dollars = (tgt.dollars ?? 0) + (src.dollars ?? 0);
    } else {
      result[targetKey] = { ...src, hours: src.hours ?? 0, dollars: src.dollars ?? 0 };
    }
    delete result[fromKey];
  };

  // ---- Step 1 ----
  for (const [head, decision] of Object.entries(decisions.step1)) {
    if (decision.kind === 'keep_distributed') continue;
    const matches = Object.keys(result).filter(k => {
      const p = parseKey(k);
      return p && p.head === head && !isStExempt(p.sec, p.act);
    });
    for (const k of matches) {
      const p = parseKey(k)!;
      if (decision.kind === 'pool_to_40') move(k, '40', '0000', head);
      else if (decision.kind === 'reroute_global') move(k, p.sec, p.act, decision.targetHead);
      else if (decision.kind === 'custom') move(k, decision.targetSec, decision.targetAct, decision.targetHead);
    }
  }

  // ---- Step 2 ----
  // Combine pairs: only act on the side that owns the decision (avoids double-write
  // when both sides have a "combine with the other" decision).
  const handledCombineSecs = new Set<string>();
  for (const [sec, decision] of Object.entries(decisions.step2)) {
    if (handledCombineSecs.has(sec)) continue;
    if (isStExempt(sec, '0000')) continue;

    let targetSec = sec;
    if (decision.kind === 'combine' && decision.combinedSec) {
      targetSec = decision.combinedSec;
      if (decision.combineWithSec) handledCombineSecs.add(decision.combineWithSec);
    }
    const sourceSecs =
      decision.kind === 'combine' && decision.combineWithSec
        ? [sec, decision.combineWithSec]
        : [sec];

    const targetAct = (decision.targetAct && decision.targetAct.trim()) || '0000';
    const targetHead = (decision.targetHead && decision.targetHead.trim()) || 'PLMB';

    for (const srcSec of sourceSecs) {
      const matches = Object.keys(result).filter(k => {
        const p = parseKey(k);
        return p && p.sec === srcSec && !isStExempt(p.sec, p.act);
      });
      for (const k of matches) move(k, targetSec, targetAct, targetHead);
    }
  }

  // ---- Step 3 ----
  for (const [key, decision] of Object.entries(decisions.step3)) {
    if (!result[key]) continue; // already absorbed by Step 1/2
    const p = parseKey(key);
    if (!p) continue;
    if (decision.kind === 'accept') continue;
    if (decision.kind === 'redistribute') {
      const sourceKey = `${p.sec} ${p.act} ${decision.sourceHead}`.trim();
      const sourceEntry = result[sourceKey];
      const targetEntry = result[key];
      if (!sourceEntry || !targetEntry) continue;
      const moveable = Math.min(decision.hours, sourceEntry.hours ?? 0);
      if (moveable <= 0) continue;
      sourceEntry.hours = (sourceEntry.hours ?? 0) - moveable;
      targetEntry.hours = (targetEntry.hours ?? 0) + moveable;
      // Dollars track hours proportionally at the source rate.
      const srcRate =
        (sourceEntry.hours ?? 0) > 0 && sourceEntry.dollars
          ? sourceEntry.dollars / ((sourceEntry.hours ?? 0) + moveable)
          : 0;
      const movedDollars = srcRate * moveable;
      sourceEntry.dollars = Math.max(0, (sourceEntry.dollars ?? 0) - movedDollars);
      targetEntry.dollars = (targetEntry.dollars ?? 0) + movedDollars;
    } else if (decision.kind === 'reroute' || decision.kind === 'custom') {
      move(key, decision.targetSec, decision.targetAct, decision.targetHead);
    }
  }

  return result;
}

/**
 * Footer preview metrics — line counts and below-floor hours, before vs after.
 */
export function previewDelta(
  before: FinalLaborSummary,
  after: FinalLaborSummary,
  thresholds: CleanupThresholds
): {
  beforeLines: number;
  afterLines: number;
  linesDelta: number;
  beforeBelowFloor: number;
  afterBelowFloor: number;
  belowFloorDelta: number;
} {
  const countBelow = (s: FinalLaborSummary) =>
    Object.entries(s).filter(([k, v]) => {
      const p = parseKey(k);
      if (!p || isStExempt(p.sec, p.act)) return false;
      return (v.hours ?? 0) < thresholds.lineFloor;
    }).length;
  const beforeLines = Object.keys(before).length;
  const afterLines = Object.keys(after).length;
  const beforeBelowFloor = countBelow(before);
  const afterBelowFloor = countBelow(after);
  return {
    beforeLines,
    afterLines,
    linesDelta: afterLines - beforeLines,
    beforeBelowFloor,
    afterBelowFloor,
    belowFloorDelta: afterBelowFloor - beforeBelowFloor,
  };
}

const ST_SECTIONS = new Set(['ST']);
const ST_ACTIVITIES = new Set(['00ST']);

/**
 * Parse a "SEC ACT HEAD" key. Tolerant of multi-token heads (rare) by treating
 * everything after the second whitespace token as the head.
 */
function parseKey(key: string): { sec: string; act: string; head: string } | null {
  const parts = key.trim().split(/\s+/);
  if (parts.length < 3) return null;
  return {
    sec: parts[0],
    act: parts[1],
    head: parts.slice(2).join(' '),
  };
}

/** Spec §4.6 — ST never folds, never combines, never appears in any step. */
function isStExempt(sec: string, act: string): boolean {
  return ST_SECTIONS.has(sec) || ST_ACTIVITIES.has(act);
}

/**
 * Step 1 surfacing — proportional noise filter.
 *
 * Spec §7.1 literally says "surface if n_small ≥ 2". But §4.5 ("acceptable
 * noise") makes clear a head where 2 small instances exist in a sea of
 * healthy sections is NOT a cross-section pattern — it's stragglers in a
 * healthy distribution.
 *
 * Two-signal rule:
 *   (a) Average hours per section is below the section threshold — the head
 *       is globally small enough that pooling makes sense.
 *   (b) 3+ small instances regardless of total — a real cross-section
 *       pattern even when the head is large overall.
 *   (c) Sole instance, below the line floor — the head only exists once
 *       and is itself small.
 *
 * Verified on Pasadena: surfaces DRNS, SLVS, PIDV, SNWV; drops WATR, STRM,
 * SZMC. Tunable via the constants below.
 */
// Minimum small-instance count that always triggers Step 1, independent of
// the head's total scale. 3+ small lines of the same head is itself a
// cross-section pattern worth the PM's attention.
const STEP1_PERVASIVE_SMALL_COUNT = 3;

/**
 * Detect cleanup candidates from finalLaborSummary.
 *
 * Spec §7. Pure: same input → same output. No DB reads, no clock reads.
 */
export function detectCandidates(
  finalLaborSummary: FinalLaborSummary,
  thresholds: CleanupThresholds
): DetectionResult {
  const { lineFloor, sectionThreshold } = thresholds;

  // ---- Index lines once. Skip ST exemptions per §4.6. ----
  type Line = { key: string; sec: string; act: string; head: string; hours: number };
  const lines: Line[] = [];
  for (const [key, entry] of Object.entries(finalLaborSummary || {})) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    if (isStExempt(parsed.sec, parsed.act)) continue;
    const hours = Number(entry?.hours) || 0;
    lines.push({ key, ...parsed, hours });
  }

  // ---- Step 1: global head decisions (§7.1) ----
  const byHead = new Map<string, Line[]>();
  for (const line of lines) {
    const list = byHead.get(line.head) ?? [];
    list.push(line);
    byHead.set(line.head, list);
  }

  const step1Candidates: Step1Candidate[] = [];
  const step1Heads = new Set<string>();

  for (const [head, instances] of byHead.entries()) {
    const nTotal = instances.length;
    const nSmall = instances.filter(i => i.hours < lineFloor).length;
    const totalHours = instances.reduce((s, i) => s + i.hours, 0);

    if (nSmall < 1) continue;

    const avgPerSection = nTotal > 0 ? totalHours / nTotal : 0;

    // Spec §4.5 — only surface heads with a real cross-section pattern.
    // (a) head is globally small (avg per section below the section threshold)
    //     AND has at least 2 small instances;
    // (b) 3+ small instances regardless of total scale;
    // (c) sole instance and itself below the line floor.
    const surface =
      (nSmall >= 2 && avgPerSection < sectionThreshold) ||
      (nSmall >= STEP1_PERVASIVE_SMALL_COUNT) ||
      (nTotal === 1 && totalHours < lineFloor);

    if (!surface) continue;

    step1Heads.add(head);
    step1Candidates.push({
      head,
      nTotal,
      nSmall,
      totalHours,
      instances: instances
        .map(i => ({
          sec: i.sec,
          act: i.act,
          hours: i.hours,
          isSmall: i.hours < lineFloor,
        }))
        .sort((a, b) => b.hours - a.hours),
    });
  }

  step1Candidates.sort((a, b) => b.nSmall - a.nSmall || b.totalHours - a.totalHours);

  // ---- Step 2: section folds (§7.2) ----
  // "After subtracting hours that Step 1 will move out" — for detection-layer
  // purposes, Step 1 moves out EVERY instance of a step1Head from its current
  // section. The pessimistic assumption is that the PM will pool/reroute the
  // whole head; the card recomputes live once a real selection is made.
  const sectionRemainingHours = new Map<string, number>();
  const sectionRemainingHeads = new Map<string, Array<{ head: string; act: string; hours: number }>>();

  for (const line of lines) {
    if (step1Heads.has(line.head)) continue; // Step 1 will move this out
    sectionRemainingHours.set(
      line.sec,
      (sectionRemainingHours.get(line.sec) ?? 0) + line.hours
    );
    const heads = sectionRemainingHeads.get(line.sec) ?? [];
    heads.push({ head: line.head, act: line.act, hours: line.hours });
    sectionRemainingHeads.set(line.sec, heads);
  }

  const step2Candidates: Step2Candidate[] = [];
  const step2Sections = new Set<string>();

  for (const [sec, remainingTotal] of sectionRemainingHours.entries()) {
    const heads = sectionRemainingHeads.get(sec) ?? [];
    // Distinct heads (a section may have the same head under multiple activity codes)
    const distinctHeads = new Set(heads.map(h => h.head));

    if (
      remainingTotal < sectionThreshold &&
      distinctHeads.size >= 2
    ) {
      step2Sections.add(sec);
      step2Candidates.push({
        sec,
        remainingTotal,
        remainingCodes: distinctHeads.size,
        heads: heads.sort((a, b) => b.hours - a.hours),
      });
    }
  }

  step2Candidates.sort((a, b) => a.remainingTotal - b.remainingTotal);

  // ---- Step 3: what's left (§7.3) ----
  // Per-section totals AFTER Step 1 movements (used for the healthy-section test).
  // Section health uses the same post-Step-1 view that Step 2 uses.
  const step3Candidates: Step3Candidate[] = [];

  for (const line of lines) {
    if (line.hours >= lineFloor) continue;
    if (step1Heads.has(line.head)) continue;   // head being globally consolidated
    if (step2Sections.has(line.sec)) continue; // section being folded

    const sectionTotal = sectionRemainingHours.get(line.sec) ?? 0;
    const sectionIsHealthy = sectionTotal > sectionThreshold;
    const headInStep1 = step1Heads.has(line.head); // false here by construction; explicit for spec parity

    step3Candidates.push({
      key: line.key,
      sec: line.sec,
      act: line.act,
      head: line.head,
      hours: line.hours,
      sectionTotal,
      sectionIsHealthy,
      headInStep1,
      defaultAction: sectionIsHealthy && !headInStep1 ? 'accept' : null,
    });
  }

  step3Candidates.sort((a, b) => a.hours - b.hours);

  // ---- Meta ----
  const totalLines = lines.length;
  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const belowFloor = lines.filter(l => l.hours < lineFloor);
  const linesBelowFloor = belowFloor.length;
  const hoursAffected = belowFloor.reduce((s, l) => s + l.hours, 0);

  return {
    step1Candidates,
    step2Candidates,
    step3Candidates,
    meta: {
      totalLines,
      totalHours,
      linesBelowFloor,
      hoursAffected,
      thresholds: { lineFloor, sectionThreshold },
    },
  };
}