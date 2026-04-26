/**
 * useHydratedDecisions — reverse-engineer PendingDecisions from the DB.
 *
 * The Code Cleanup tab's in-memory PendingDecisions vanish on every Apply All
 * (pending.reset() runs after a successful write). Without rehydration, the
 * detector's Step 2/3 logic falls back to *pessimistic* mode for committed
 * Step 1 / Step 2 decisions — heads the PM explicitly chose `keep_distributed`
 * are silently treated as "globally consolidated", and sections the PM hasn't
 * touched are excluded from Step 3 because they *might* surface in Step 2.
 *
 * That's the "whack-a-mole" the PM sees: 1M/2M merges land, then L2 surfaces;
 * L2 fold lands, then 1M/2M come back. The fix is to start each render with
 * decisions reconstructed from `project_small_code_merges` +
 * `project_hour_redistributions`, plus implicit `keep_distributed` for any
 * Step 1 candidate that has no merge row.
 *
 * Reconstruction rules (operation_type-driven, not shape-inference — see
 * useApplyDecisions writer for the symmetric write side):
 *   - pool_to_40        → Step1 { kind: 'pool_to_40' }
 *   - reroute_global    → Step1 { kind: 'reroute_global', targetHead }
 *   - cleanup_custom on a Step 1 candidate head → Step1 { kind: 'custom', ... }
 *   - cleanup_custom not on a Step 1 candidate → Step3 { kind: 'custom', ... }
 *   - cleanup_reroute   → Step3 { kind: 'reroute', ... }
 *   - fold_to_plmb      → Step2 { kind: 'fold', targetHead?, targetAct? }
 *   - combine_sections  → Step2 { kind: 'combine', combinedSec, combineWithSec, ... }
 *   - redistribute (other table) → Step3 { kind: 'redistribute', sourceHead, hours }
 *
 * Implicit keep_distributed: any Step 1 candidate whose head has no merge
 * row gets seeded as keep_distributed. That's the semantic the PM sees —
 * they viewed the candidate, chose nothing global, and the small instances
 * were either accepted in Step 3 or left as-is.
 *
 * Orphan handling: rows whose cost_head doesn't appear in the current
 * detection candidates (e.g., legacy data, hand-written rows, dataset shifts)
 * are ignored for Step 1/2 reconstruction. Step 3 reconstruction is keyed by
 * the literal `${sec} ${act} ${head}` triple — orphans there just don't
 * align with any Step 3 candidate and are silently skipped by the UI.
 *
 * Accept (Step 3) is intentionally NOT hydrated. It's a no-op against the
 * detector and the PM re-confirming on reload is cheap. There's no
 * operation_type for it because nothing is written.
 *
 * The hydrationKey is content-based (sorted merge-row ids + redistribution-row
 * ids) so re-hydration fires whenever the DB content changes, not just when
 * row counts shift. This matters because Apply All can replace rows 1:1 —
 * counts stay stable while ids rotate.
 */
import { useMemo } from 'react';
import {
  EMPTY_PENDING,
  type DetectionResult,
  type PendingDecisions,
  type Step1Decision,
  type Step2Decision,
  type Step3Decision,
} from '@/utils/codeCleanupDetector';
import { useCleanupMerges, useHourRedistributions } from './useApplyDecisions';

type CleanupMergeRow = {
  id: string;
  sec_code: string;
  merged_act: string;
  cost_head: string;
  reassign_to_head: string | null;
  reassign_to_sec: string | null;
  reassign_to_act: string | null;
  operation_type: string | null;
  field_scope_note: string | null;
};

type RedistRow = {
  id: string;
  sec_code: string;
  act_code: string;
  source_head: string;
  target_head: string;
  hours_moved: number | string;
};

export interface HydratedDecisionsApi {
  /** Decisions reconstructed from DB + implicit keep_distributed. */
  decisions: PendingDecisions;
  /** True once both queries have settled — gate UI actions on this. */
  isReady: boolean;
  /**
   * Content-based key — flips whenever the underlying DB rows change.
   * usePendingDecisions watches this to know when to re-seed in-memory state.
   */
  hydrationKey: string;
}

export function useHydratedDecisions(
  projectId: string | null,
  detection: DetectionResult
): HydratedDecisionsApi {
  const merges = useCleanupMerges(projectId);
  const redists = useHourRedistributions(projectId);

  const isReady =
    !projectId || projectId === 'default'
      ? true
      : merges.isFetched && redists.isFetched;

  // Content-based hydration key — sorted ids so order doesn't matter, falls
  // back to row count alone when no rows exist (still flips when the first
  // row arrives because the empty-vs-non-empty string differs).
  const hydrationKey = useMemo(() => {
    const mergeIds = ((merges.data ?? []) as CleanupMergeRow[])
      .map(r => r.id)
      .sort()
      .join(',');
    const redistIds = ((redists.data ?? []) as RedistRow[])
      .map(r => r.id)
      .sort()
      .join(',');
    return `m:${mergeIds}|r:${redistIds}|ready:${isReady ? 1 : 0}`;
  }, [merges.data, redists.data, isReady]);

  const decisions = useMemo<PendingDecisions>(() => {
    if (!isReady) return EMPTY_PENDING;

    const mergeRows = (merges.data ?? []) as CleanupMergeRow[];
    const redistRows = (redists.data ?? []) as RedistRow[];

    // Index Step 1 / Step 2 candidates so we can decide whether a
    // cleanup_custom row belongs to Step 1 or Step 3, and so we can
    // seed implicit keep_distributed.
    const step1Heads = new Set(detection.step1Candidates.map(c => c.head));
    const step2Secs = new Set(detection.step2Candidates.map(c => c.sec));

    const step1: Record<string, Step1Decision> = {};
    const step2: Record<string, Step2Decision> = {};
    const step3: Record<string, Step3Decision> = {};

    // --- Step 2 first so combine pairs (two rows with the same target sec
    //     for two distinct source secs) are handled together. ---
    // Group fold_to_plmb / combine_sections rows by source sec.
    const step2BySrcSec = new Map<string, CleanupMergeRow[]>();
    for (const row of mergeRows) {
      if (row.operation_type !== 'fold_to_plmb' && row.operation_type !== 'combine_sections') continue;
      const list = step2BySrcSec.get(row.sec_code) ?? [];
      list.push(row);
      step2BySrcSec.set(row.sec_code, list);
    }

    for (const [srcSec, rows] of step2BySrcSec.entries()) {
      // Pick a representative row — any row in this sec carries the target
      // identity (same target across all rows for the same sec by construction).
      const rep = rows[0];
      const opType = rep.operation_type;
      const targetSec = rep.reassign_to_sec ?? srcSec;
      const targetAct = rep.reassign_to_act ?? '0000';
      const targetHead = rep.reassign_to_head ?? 'PLMB';

      if (opType === 'combine_sections') {
        // Combine partner is the OTHER source sec pointing at the same target.
        const partner = [...step2BySrcSec.keys()].find(
          s => s !== srcSec && (step2BySrcSec.get(s)?.[0]?.reassign_to_sec ?? s) === targetSec
        );
        step2[srcSec] = {
          kind: 'combine',
          combinedSec: targetSec,
          combineWithSec: partner,
          fieldScopeNote: rep.field_scope_note ?? undefined,
          targetAct,
          targetHead,
        };
      } else {
        step2[srcSec] = {
          kind: 'fold',
          targetAct,
          targetHead,
        };
      }
    }

    // --- Step 1 + Step 3 reroute/custom from remaining merge rows. ---
    for (const row of mergeRows) {
      const opType = row.operation_type;
      if (opType === 'fold_to_plmb' || opType === 'combine_sections') continue;

      if (opType === 'pool_to_40') {
        if (!step1Heads.has(row.cost_head)) continue; // orphan — head no longer a candidate
        step1[row.cost_head] = { kind: 'pool_to_40' };
      } else if (opType === 'reroute_global') {
        if (!step1Heads.has(row.cost_head)) continue;
        if (!row.reassign_to_head) continue;
        step1[row.cost_head] = { kind: 'reroute_global', targetHead: row.reassign_to_head };
      } else if (opType === 'cleanup_custom') {
        if (!row.reassign_to_head) continue;
        const targetSec = row.reassign_to_sec ?? row.sec_code;
        const targetAct = row.reassign_to_act ?? row.merged_act;
        const targetHead = row.reassign_to_head;
        if (step1Heads.has(row.cost_head)) {
          // A Step 1 head with custom routing — reconstruct as Step 1 custom.
          // Multiple rows may exist (one per instance) but they all carry the
          // same target by construction; last write wins.
          step1[row.cost_head] = { kind: 'custom', targetSec, targetAct, targetHead };
        } else {
          // Treat as Step 3 custom on the original line.
          const key = `${row.sec_code} ${row.merged_act} ${row.cost_head}`;
          step3[key] = { kind: 'custom', targetSec, targetAct, targetHead };
        }
      } else if (opType === 'cleanup_reroute') {
        if (!row.reassign_to_head) continue;
        const key = `${row.sec_code} ${row.merged_act} ${row.cost_head}`;
        step3[key] = {
          kind: 'reroute',
          targetSec: row.reassign_to_sec ?? row.sec_code,
          targetAct: row.reassign_to_act ?? row.merged_act,
          targetHead: row.reassign_to_head,
        };
      }
      // Any other operation_type (legacy, unknown) is ignored — not ours to own.
    }

    // --- Implicit keep_distributed for Step 1 candidates with no merge row. ---
    for (const head of step1Heads) {
      if (!step1[head]) {
        step1[head] = { kind: 'keep_distributed' };
      }
    }

    // --- Step 3 redistribute from the redistributions table. ---
    for (const row of redistRows) {
      const key = `${row.sec_code} ${row.act_code} ${row.target_head}`;
      step3[key] = {
        kind: 'redistribute',
        sourceHead: row.source_head,
        hours: Number(row.hours_moved) || 0,
      };
    }

    return { step1, step2, step3 };
    // detection is intentionally part of the deps — when the underlying
    // summary changes (e.g., a new estimate file), we want to re-classify
    // cleanup_custom rows against the new candidate set.
  }, [isReady, merges.data, redists.data, detection]);

  return { decisions, isReady, hydrationKey };
}