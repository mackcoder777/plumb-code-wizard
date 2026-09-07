import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemActivityMapping {
  id: string;
  project_id: string;
  system_pattern: string;
  activity_code: string;
  cost_head_filter: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Activity code options, transcribed from CLAUDE.md §7 (Tier 1).
//
// An ACT segment is a floor/level code (00L1, 00UG, ...), never a cost head.
// An earlier version of this list offered cost heads (DWTR, STRM, SNWV, ...)
// here, so a PM who pressed Auto-Suggest All and saved would have produced
// codes like "B2 STRM WATR" where the format requires "B2 00L1 WATR" --
// a SEC/ACT/HEAD conflation, which is the thing the cost-code format exists
// to prevent. Surveyed before fixing: system_activity_mappings held zero
// rows, so no stored data ever carried the wrong shape.
export const ACTIVITY_CODE_SUGGESTIONS = [
  { code: '0000', label: 'Default' },
  { code: '00L1', label: 'Level 1' },
  { code: '00L2', label: 'Level 2' },
  { code: '00L3', label: 'Level 3' },
  { code: '00UG', label: 'Underground' },
  { code: '00RF', label: 'Roof' },
  { code: '00CS', label: 'Crawl Space' },
  { code: '00LB', label: 'Basement' },
  { code: '00MZ', label: 'Mezzanine' },
  { code: '00ST', label: 'Site' },
];

// Auto-suggest an ACTIVITY code from a system name.
//
// Deliberately narrow. A system name usually says nothing about which floor
// its items are on -- that is what the Floor column and the floor/section
// mappings resolve. The one inference the Tier 1 docs ground is below-grade:
// "BG"-prefixed systems (BG Waste, BG Storm Drn, ...) and names saying
// below grade / underground describe work that is underground by definition,
// and §5/§7 map Underground to 00UG. Everything else returns null: no
// suggestion, the PM decides. The previous version of this function returned
// COST HEADS (DWTR, STRM, ...) -- see the note on ACTIVITY_CODE_SUGGESTIONS.
export const suggestActivityCode = (systemName: string): string | null => {
  const lower = systemName.toLowerCase().trim();

  if (
    lower.startsWith('bg ') || lower.startsWith('bg.') ||
    lower.includes('below grade') || lower.includes('underground') ||
    lower.includes('u/g')
  ) {
    return '00UG';
  }

  return null;
};

// Helper to get activity code for a system from mappings
// Priority: system + category override > system-wide blanket rule > default '0000'
export const getActivityFromSystem = (
  system: string,
  mappings: SystemActivityMapping[],
  category?: string
): string => {
  const norm = (system || '').toLowerCase().trim();

  // Priority 1: system + category-specific override (stored in cost_head_filter)
  if (category) {
    const specific = mappings.find(
      m =>
        m.system_pattern === norm &&
        m.cost_head_filter === category
    );
    if (specific) return specific.activity_code;
  }

  // Priority 2: system-wide blanket rule (no cost_head_filter)
  const general = mappings.find(
    m =>
      m.system_pattern === norm &&
      !m.cost_head_filter
  );
  return general?.activity_code || '0000';
};

// Fetch all activity mappings for a project
export const useSystemActivityMappings = (projectId: string | null) => {
  return useQuery({
    queryKey: ['system-activity-mappings', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('system_activity_mappings')
        .select('*')
        .eq('project_id', projectId)
        .order('system_pattern');
      
      if (error) throw error;
      return (data as any[]).map(d => ({
        ...d,
        cost_head_filter: d.cost_head_filter ?? null,
      })) as SystemActivityMapping[];
    },
    enabled: !!projectId,
  });
};

// Save (upsert) a single activity mapping
export const useSaveSystemActivityMapping = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      systemPattern,
      activityCode,
      costHeadFilter,
      description,
    }: {
      projectId: string;
      systemPattern: string;
      activityCode: string;
      costHeadFilter?: string | null;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('system_activity_mappings')
        .upsert(
          {
            project_id: projectId,
            system_pattern: systemPattern.toLowerCase().trim(),
            activity_code: activityCode.toUpperCase(),
            cost_head_filter: costHeadFilter ?? null,
            description: description || null,
          } as any,
          { onConflict: 'project_id,system_pattern,cost_head_filter' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['system-activity-mappings', variables.projectId],
      });
    },
  });
};

// Batch save multiple activity mappings (blanket rules only)
export const useBatchSaveSystemActivityMappings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      mappings,
    }: {
      projectId: string;
      mappings: Array<{
        systemPattern: string;
        activityCode: string;
        description?: string;
      }>;
    }) => {
      const records = mappings.map(m => ({
        project_id: projectId,
        system_pattern: m.systemPattern.toLowerCase().trim(),
        activity_code: m.activityCode.toUpperCase(),
        cost_head_filter: null,
        description: m.description || null,
      }));
      
      const { data, error } = await supabase
        .from('system_activity_mappings')
        .upsert(records as any[], { onConflict: 'project_id,system_pattern,cost_head_filter' })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['system-activity-mappings', variables.projectId],
      });
    },
  });
};

// Delete an activity mapping
export const useDeleteSystemActivityMapping = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      systemPattern,
      costHeadFilter,
    }: {
      projectId: string;
      systemPattern: string;
      costHeadFilter?: string | null;
    }) => {
      let query = supabase
        .from('system_activity_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('system_pattern', systemPattern.toLowerCase().trim());

      if (costHeadFilter) {
        query = query.eq('cost_head_filter', costHeadFilter);
      } else {
        query = query.is('cost_head_filter', null);
      }
      
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['system-activity-mappings', variables.projectId],
      });
    },
  });
};
