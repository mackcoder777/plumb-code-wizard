/**
 * useApplyDecisions — persistence layer for the Code Cleanup tab.
 *
 * Translates a PendingDecisions object into:
 *   - project_small_code_merges rows (Step 1 pool/reroute/custom, Step 2 fold/combine,
 *     Step 3 reroute/custom). All rows carry operation_type so a future Audit
 *     view can group cleanup work without confusing it with legacy merge records.
 *   - project_hour_redistributions rows (Step 3 redistribute).
 *
 * The writer DOES NOT delete pre-existing merge records authored outside the
 * Code Cleanup tab. It removes only rows whose operation_type is one of the
 * Code Cleanup operation types, then re-inserts the current decisions. This
 * lets the tab be re-applied repeatedly without clobbering legacy work, and
 * matches the spec §10.5 plan that Code Cleanup is the new owner for these
 * operations going forward.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  type PendingDecisions,
  type FinalLaborSummary,
} from '@/utils/codeCleanupDetector';

const CLEANUP_OP_TYPES = [
  'pool_to_40',
  'reroute_global',
  'fold_to_plmb',
  'combine_sections',
  'cleanup_reroute',
  'cleanup_custom',
] as const;

type CleanupOpType = typeof CLEANUP_OP_TYPES[number];

interface MergeRowInsert {
  project_id: string;
  sec_code: string;
  merged_act: string;
  cost_head: string;
  reassign_to_head: string | null;
  reassign_to_sec: string | null;
  reassign_to_act: string | null;
  redistribute_adjustments: Record<string, number> | null;
  operation_type: CleanupOpType;
  pm_email: string | null;
  field_scope_note: string | null;
}

interface RedistributionRowInsert {
  project_id: string;
  sec_code: string;
  act_code: string;
  source_head: string;
  target_head: string;
  hours_moved: number;
  pm_email: string | null;
  operation_type: 'redistribute';
  field_scope_note: string | null;
}

function parseKey(key: string): { sec: string; act: string; head: string } | null {
  const parts = key.trim().split(/\s+/);
  if (parts.length < 3) return null;
  return { sec: parts[0], act: parts[1], head: parts.slice(2).join(' ') };
}

/**
 * Live query for hour redistributions — feeds the audit drawer and the
 * per-section preview.
 */
export function useHourRedistributions(projectId: string | null) {
  return useQuery({
    queryKey: ['hour-redistributions', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'default') return [];
      const { data, error } = await supabase
        .from('project_hour_redistributions')
        .select('*')
        .eq('project_id', projectId);
      if (error) {
        console.error('Failed to load hour redistributions:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!projectId && projectId !== 'default',
  });
}

/**
 * Live query for cleanup-authored merges — used by the audit drawer to show
 * "what would Apply All do" in terms of database state.
 */
export function useCleanupMerges(projectId: string | null) {
  return useQuery({
    queryKey: ['cleanup-merges', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'default') return [];
      const { data, error } = await supabase
        .from('project_small_code_merges')
        .select('*')
        .eq('project_id', projectId)
        .in('operation_type', CLEANUP_OP_TYPES as unknown as string[]);
      if (error) {
        console.error('Failed to load cleanup merges:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!projectId && projectId !== 'default',
  });
}

function buildMergeRows(
  projectId: string,
  pmEmail: string | null,
  finalLaborSummary: FinalLaborSummary,
  decisions: PendingDecisions
): MergeRowInsert[] {
  const rows: MergeRowInsert[] = [];
  const liveKeys = Object.keys(finalLaborSummary);

  // ---- Step 1 ----
  for (const [head, decision] of Object.entries(decisions.step1)) {
    if (decision.kind === 'keep_distributed') continue;
    const matches = liveKeys
      .map(k => parseKey(k))
      .filter((p): p is { sec: string; act: string; head: string } => !!p && p.head === head);

    for (const m of matches) {
      let opType: CleanupOpType;
      let toSec: string;
      let toAct: string;
      let toHead: string;
      if (decision.kind === 'pool_to_40') {
        opType = 'pool_to_40';
        toSec = '40';
        toAct = '0000';
        toHead = head;
      } else if (decision.kind === 'reroute_global') {
        opType = 'reroute_global';
        toSec = m.sec;
        toAct = m.act;
        toHead = decision.targetHead;
      } else {
        opType = 'cleanup_custom';
        toSec = decision.targetSec;
        toAct = decision.targetAct;
        toHead = decision.targetHead;
      }
      rows.push({
        project_id: projectId,
        sec_code: m.sec,
        merged_act: m.act,
        cost_head: head,
        reassign_to_head: toHead,
        reassign_to_sec: toSec !== m.sec ? toSec : null,
        reassign_to_act: toAct !== m.act ? toAct : null,
        redistribute_adjustments: null,
        operation_type: opType,
        pm_email: pmEmail,
        field_scope_note: null,
      });
    }
  }

  // ---- Step 2 ----
  const handledCombineSecs = new Set<string>();
  for (const [sec, decision] of Object.entries(decisions.step2)) {
    if (handledCombineSecs.has(sec)) continue;

    let targetSec = sec;
    let opType: CleanupOpType = 'fold_to_plmb';
    let scopeNote: string | null = null;
    let sourceSecs = [sec];

    if (decision.kind === 'combine' && decision.combinedSec && decision.combineWithSec) {
      targetSec = decision.combinedSec;
      opType = 'combine_sections';
      scopeNote = decision.fieldScopeNote ?? null;
      sourceSecs = [sec, decision.combineWithSec];
      handledCombineSecs.add(decision.combineWithSec);
    }

    // Honor PM edits to the fold target. Defaults: PLMB head, 0000 act,
    // source-sec when no combine. Trade-prefix-aware defaults are out of
    // scope here — see project plan note.
    const editedHead = decision.targetHead?.trim();
    const editedAct = decision.targetAct?.trim();
    const targetHead = editedHead && editedHead.length > 0 ? editedHead : 'PLMB';
    const targetAct = editedAct && editedAct.length > 0 ? editedAct : '0000';

    for (const srcSec of sourceSecs) {
      const matches = liveKeys
        .map(k => parseKey(k))
        .filter((p): p is { sec: string; act: string; head: string } => !!p && p.sec === srcSec);
      for (const m of matches) {
        rows.push({
          project_id: projectId,
          sec_code: m.sec,
          merged_act: m.act,
          cost_head: m.head,
          reassign_to_head: targetHead,
          reassign_to_sec: targetSec !== m.sec ? targetSec : null,
          reassign_to_act: targetAct,
          redistribute_adjustments: null,
          operation_type: opType,
          pm_email: pmEmail,
          field_scope_note: scopeNote,
        });
      }
    }
  }

  // ---- Step 3 (reroute / custom only — accept and redistribute handled separately) ----
  for (const [key, decision] of Object.entries(decisions.step3)) {
    if (decision.kind === 'accept' || decision.kind === 'redistribute') continue;
    const p = parseKey(key);
    if (!p) continue;
    rows.push({
      project_id: projectId,
      sec_code: p.sec,
      merged_act: p.act,
      cost_head: p.head,
      reassign_to_head: decision.targetHead,
      reassign_to_sec: decision.targetSec !== p.sec ? decision.targetSec : null,
      reassign_to_act: decision.targetAct !== p.act ? decision.targetAct : null,
      redistribute_adjustments: null,
      operation_type: decision.kind === 'reroute' ? 'cleanup_reroute' : 'cleanup_custom',
      pm_email: pmEmail,
      field_scope_note: null,
    });
  }

  // Dedupe by (sec_code, cost_head) — last write wins. Matches the existing
  // panel writer's invariant against the unique index.
  const seen = new Set<string>();
  return [...rows].reverse().filter(r => {
    const k = `${r.sec_code}|${r.cost_head}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).reverse();
}

function buildRedistributionRows(
  projectId: string,
  pmEmail: string | null,
  decisions: PendingDecisions
): RedistributionRowInsert[] {
  const rows: RedistributionRowInsert[] = [];
  for (const [key, decision] of Object.entries(decisions.step3)) {
    if (decision.kind !== 'redistribute') continue;
    const p = parseKey(key);
    if (!p) continue;
    if (decision.hours <= 0) continue;
    rows.push({
      project_id: projectId,
      sec_code: p.sec,
      act_code: p.act,
      source_head: decision.sourceHead,
      target_head: p.head,
      hours_moved: decision.hours,
      pm_email: pmEmail,
      operation_type: 'redistribute',
      field_scope_note: null,
    });
  }
  return rows;
}

export interface UseApplyDecisionsApi {
  applyAll: (
    projectId: string,
    pmEmail: string | null,
    finalLaborSummary: FinalLaborSummary,
    decisions: PendingDecisions,
    onSuccess?: () => void
  ) => Promise<void>;
  isApplying: boolean;
  lastError: string | null;
}

export function useApplyDecisions(): UseApplyDecisionsApi {
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (args: {
      projectId: string;
      pmEmail: string | null;
      finalLaborSummary: FinalLaborSummary;
      decisions: PendingDecisions;
    }) => {
      const { projectId, pmEmail, finalLaborSummary, decisions } = args;
      const mergeRows = buildMergeRows(projectId, pmEmail, finalLaborSummary, decisions);
      const redistRows = buildRedistributionRows(projectId, pmEmail, decisions);

      // 1. Clear prior cleanup-authored merge rows for this project.
      const { error: delMergeErr } = await supabase
        .from('project_small_code_merges')
        .delete()
        .eq('project_id', projectId)
        .in('operation_type', CLEANUP_OP_TYPES as unknown as string[]);
      if (delMergeErr) throw new Error(`Clear cleanup merges failed: ${delMergeErr.message}`);

      // 2. Clear prior redistributions for this project (whole-batch atomic replace).
      const { error: delRedistErr } = await supabase
        .from('project_hour_redistributions')
        .delete()
        .eq('project_id', projectId);
      if (delRedistErr) throw new Error(`Clear redistributions failed: ${delRedistErr.message}`);

      // 3. Insert new merge rows.
      if (mergeRows.length > 0) {
        const { error: insMergeErr } = await supabase
          .from('project_small_code_merges')
          .insert(mergeRows);
        if (insMergeErr) throw new Error(`Insert cleanup merges failed: ${insMergeErr.message}`);
      }

      // 4. Insert new redistribution rows.
      if (redistRows.length > 0) {
        const { error: insRedistErr } = await supabase
          .from('project_hour_redistributions')
          .insert(redistRows);
        if (insRedistErr) throw new Error(`Insert redistributions failed: ${insRedistErr.message}`);
      }

      return { mergeRows: mergeRows.length, redistRows: redistRows.length };
    },
    onSuccess: (result, vars) => {
      if (import.meta.env.DEV) {
        console.log(
          `[CodeCleanup/apply] wrote merges=${result.mergeRows} redist=${result.redistRows} project=${vars.projectId}`
        );
      }
      setLastError(null);
      queryClient.invalidateQueries({ queryKey: ['small-code-merges', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['cleanup-merges', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['hour-redistributions', vars.projectId] });
      toast({
        title: 'Code cleanup applied',
        description: `${result.mergeRows} merge rule${result.mergeRows === 1 ? '' : 's'}, ${result.redistRows} redistribution${result.redistRows === 1 ? '' : 's'} written.`,
      });
    },
    onError: (err: Error) => {
      setLastError(err.message);
      toast({ title: 'Apply failed', description: err.message, variant: 'destructive' });
    },
  });

  const applyAll = useCallback(
    async (
      projectId: string,
      pmEmail: string | null,
      finalLaborSummary: FinalLaborSummary,
      decisions: PendingDecisions,
      onSuccess?: () => void
    ) => {
      try {
        await mutation.mutateAsync({ projectId, pmEmail, finalLaborSummary, decisions });
        onSuccess?.();
      } catch {
        // toast already raised
      }
    },
    [mutation]
  );

  return { applyAll, isApplying: mutation.isPending, lastError };
}