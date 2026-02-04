import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SystemActivityMapping {
  id: string;
  project_id: string;
  system_pattern: string;
  activity_code: string;
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
export const getActivityFromSystem = (
  system: string,
  mappings: SystemActivityMapping[]
): string => {
  const normalizedSystem = (system || '').toLowerCase().trim();
  const mapping = mappings.find(
    m => m.system_pattern.toLowerCase().trim() === normalizedSystem
  );
  return mapping?.activity_code || '0000';
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
      return data as SystemActivityMapping[];
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
      description,
    }: {
      projectId: string;
      systemPattern: string;
      activityCode: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from('system_activity_mappings')
        .upsert(
          {
            project_id: projectId,
            system_pattern: systemPattern.toLowerCase().trim(),
            activity_code: activityCode.toUpperCase(),
            description: description || null,
          },
          { onConflict: 'project_id,system_pattern' }
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

// Batch save multiple activity mappings
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
        description: m.description || null,
      }));
      
      const { data, error } = await supabase
        .from('system_activity_mappings')
        .upsert(records, { onConflict: 'project_id,system_pattern' })
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
    }: {
      projectId: string;
      systemPattern: string;
    }) => {
      const { error } = await supabase
        .from('system_activity_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('system_pattern', systemPattern.toLowerCase().trim());
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['system-activity-mappings', variables.projectId],
      });
    },
  });
};
