import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostHeadActivityOverride {
  id: string;
  project_id: string;
  cost_head: string;
  building_identifier: string | null;
  use_level_activity: boolean;
  created_at: string;
}

/**
 * Checks whether a cost head has a level-activity override active.
 * Checks specific building first, then falls back to global (null building).
 * Pass buildingId=null in standard mode to only match global overrides.
 */
export function shouldUseLevelActivity(
  costHead: string,
  buildingId: string | null,
  overrides: Pick<CostHeadActivityOverride, 'cost_head' | 'building_identifier' | 'use_level_activity'>[]
): boolean {
  if (buildingId) {
    const specific = overrides.find(
      o => o.cost_head === costHead && o.building_identifier === buildingId && o.use_level_activity === true
    );
    if (specific !== undefined) return true;
  }
  return overrides.some(
    o => o.cost_head === costHead && o.building_identifier === null && o.use_level_activity === true
  );
}

export function useCostHeadActivityOverrides(projectId: string | null) {
  return useQuery({
    queryKey: ['cost-head-activity-overrides', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('cost_head_activity_overrides')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data || []) as CostHeadActivityOverride[];
    },
    enabled: !!projectId,
  });
}

export function useUpsertCostHeadActivityOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      costHead,
      useLevelActivity,
    }: {
      projectId: string;
      costHead: string;
      useLevelActivity: boolean;
    }) => {
      const { data, error } = await supabase
        .from('cost_head_activity_overrides')
        .upsert(
          {
            project_id: projectId,
            cost_head: costHead,
            use_level_activity: useLevelActivity,
          },
          { onConflict: 'project_id,cost_head' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cost-head-activity-overrides', variables.projectId] });
    },
  });
}

export function useDeleteCostHeadActivityOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      costHead,
      buildingId,
    }: {
      projectId: string;
      costHead: string;
      buildingId?: string | null;
    }) => {
      let query = supabase
        .from('cost_head_activity_overrides')
        .delete()
        .eq('project_id', projectId)
        .eq('cost_head', costHead);
      if (buildingId !== undefined) {
        query = buildingId === null
          ? query.is('building_identifier', null)
          : query.eq('building_identifier', buildingId);
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cost-head-activity-overrides', variables.projectId] });
    },
  });
}

export function useBatchUpsertCostHeadActivityOverrides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      overrides,
    }: {
      projectId: string;
      overrides: Array<{ costHead: string; buildingId: string | null; useLevelActivity: boolean }>;
    }) => {
      // Partial unique indexes require manual delete-then-insert per record
      for (const o of overrides) {
        let delQ = supabase
          .from('cost_head_activity_overrides')
          .delete()
          .eq('project_id', projectId)
          .eq('cost_head', o.costHead);
        delQ = o.buildingId === null
          ? delQ.is('building_identifier', null)
          : delQ.eq('building_identifier', o.buildingId);
        await delQ;
        const { error } = await supabase
          .from('cost_head_activity_overrides')
          .insert({
            project_id: projectId,
            cost_head: o.costHead,
            building_identifier: o.buildingId,
            use_level_activity: o.useLevelActivity,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cost-head-activity-overrides', variables.projectId] });
    },
  });
}

export function usePruneStaleCostHeadOverrides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      validCostHeads,
    }: {
      projectId: string;
      validCostHeads: string[];
    }) => {
      // Fetch current overrides
      const { data: current, error: fetchError } = await supabase
        .from('cost_head_activity_overrides')
        .select('cost_head')
        .eq('project_id', projectId);
      if (fetchError) throw fetchError;

      const stale = (current || []).filter(o => !validCostHeads.includes(o.cost_head));
      if (stale.length === 0) return { pruned: 0 };

      for (const s of stale) {
        const { error } = await supabase
          .from('cost_head_activity_overrides')
          .delete()
          .eq('project_id', projectId)
          .eq('cost_head', s.cost_head);
        if (error) throw error;
      }
      return { pruned: stale.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cost-head-activity-overrides', variables.projectId] });
    },
  });
}
