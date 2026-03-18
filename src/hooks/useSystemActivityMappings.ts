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

// Common activity code suggestions
export const ACTIVITY_CODE_SUGGESTIONS = [
  { code: '0000', label: 'Default/General' },
  { code: '00CW', label: 'Cold Water' },
  { code: '00HW', label: 'Hot Water' },
  { code: 'WATR', label: 'Combined Water' },
  { code: '00SD', label: 'Storm Drain' },
  { code: '00SN', label: 'Sanitary' },
  { code: '00GS', label: 'Gas' },
  { code: '00FX', label: 'Fixtures' },
  { code: '00VT', label: 'Vent' },
  { code: '00RF', label: 'Roof Drain' },
];

// Auto-suggest activity code based on system name keywords
export const suggestActivityCode = (systemName: string): string | null => {
  const lower = systemName.toLowerCase();
  
  if (lower.includes('cold water') || lower.includes('dcw') || lower.includes('cw ')) {
    return '00CW';
  }
  if (lower.includes('hot water') || lower.includes('dhw') || lower.includes('hw ')) {
    return '00HW';
  }
  if (lower.includes('storm') || lower.includes('sd ')) {
    return '00SD';
  }
  if (lower.includes('sanitary') || lower.includes('sn ') || lower.includes('waste')) {
    return '00SN';
  }
  if (lower.includes('gas') || lower.includes('ng ') || lower.includes('natural gas')) {
    return '00GS';
  }
  if (lower.includes('fixture') || lower.includes('fx ')) {
    return '00FX';
  }
  if (lower.includes('vent') || lower.includes('vt ')) {
    return '00VT';
  }
  if (lower.includes('roof drain') || lower.includes('rd ')) {
    return '00RF';
  }
  
  return null;
};

// Helper to get activity code for a system from mappings
// Priority: exact system + cost head match > system-wide (no filter) > default '0000'
export const getActivityFromSystem = (
  system: string,
  mappings: SystemActivityMapping[],
  costHead?: string
): string => {
  const norm = (system || '').toLowerCase().trim();
  const headUpper = (costHead || '').toUpperCase().trim();

  // Priority 1: exact system + exact cost head filter match
  if (headUpper) {
    const specific = mappings.find(
      m =>
        m.system_pattern.toLowerCase().trim() === norm &&
        m.cost_head_filter?.toUpperCase().trim() === headUpper
    );
    if (specific) return specific.activity_code;
  }

  // Priority 2: system match with no cost head filter (blanket rule)
  const general = mappings.find(
    m =>
      m.system_pattern.toLowerCase().trim() === norm &&
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
