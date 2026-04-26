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

    const surface =
      nSmall >= 2 ||
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