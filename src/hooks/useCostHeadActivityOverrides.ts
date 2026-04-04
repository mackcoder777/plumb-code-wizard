import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostHeadActivityOverride {
  id: string;
  project_id: string;
  cost_head: string;
  use_level_activity: boolean;
  created_at: string;
}

export function shouldUseLevelActivity(
  costHead: string,
  overrides: CostHeadActivityOverride[]
): boolean {
  return overrides.some(o => o.cost_head === costHead && o.use_level_activity === true);
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
    }: {
      projectId: string;
      costHead: string;
    }) => {
      const { error } = await supabase
        .from('cost_head_activity_overrides')
        .delete()
        .eq('project_id', projectId)
        .eq('cost_head', costHead);
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
      overrides: Array<{ costHead: string; useLevelActivity: boolean }>;
    }) => {
      const records = overrides.map(o => ({
        project_id: projectId,
        cost_head: o.costHead,
        use_level_activity: o.useLevelActivity,
      }));
      const { data, error } = await supabase
        .from('cost_head_activity_overrides')
        .upsert(records, { onConflict: 'project_id,cost_head' })
        .select();
      if (error) throw error;
      return data;
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
