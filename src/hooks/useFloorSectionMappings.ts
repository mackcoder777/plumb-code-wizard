import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FloorSectionMapping {
  id: string;
  project_id: string;
  floor_pattern: string;
  section_code: string;
  activity_code: string;
  created_at: string;
  updated_at: string;
}

export interface FloorMappingResult {
  section: string;
  activity: string;
}

export function useFloorSectionMappings(projectId: string | null) {
  return useQuery({
    queryKey: ['floor-section-mappings', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('floor_section_mappings')
        .select('*')
        .eq('project_id', projectId)
        .order('floor_pattern');
      
      if (error) throw error;
      return data as FloorSectionMapping[];
    },
    enabled: !!projectId,
  });
}

export function useSaveFloorSectionMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      floorPattern,
      sectionCode,
      activityCode = '0000',
    }: {
      projectId: string;
      floorPattern: string;
      sectionCode: string;
      activityCode?: string;
    }) => {
      const { data, error } = await supabase
        .from('floor_section_mappings')
        .upsert(
          {
            project_id: projectId,
            floor_pattern: floorPattern,
            section_code: sectionCode,
            activity_code: activityCode,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'project_id,floor_pattern',
          }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['floor-section-mappings', variables.projectId] });
    },
  });
}

export function useBatchSaveFloorSectionMappings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      mappings,
    }: {
      projectId: string;
      mappings: Array<{ floorPattern: string; sectionCode: string; activityCode?: string }>;
    }) => {
      const records = mappings.map(m => ({
        project_id: projectId,
        floor_pattern: m.floorPattern,
        section_code: m.sectionCode,
        activity_code: m.activityCode || '0000',
        updated_at: new Date().toISOString(),
      }));
      
      const { data, error } = await supabase
        .from('floor_section_mappings')
        .upsert(records, { onConflict: 'project_id,floor_pattern' })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['floor-section-mappings', variables.projectId] });
    },
  });
}

export function useDeleteFloorSectionMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      floorPattern,
    }: {
      projectId: string;
      floorPattern: string;
    }) => {
      const { error } = await supabase
        .from('floor_section_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('floor_pattern', floorPattern);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['floor-section-mappings', variables.projectId] });
    },
  });
}

/**
 * Returns { section, activity } for a floor value using mappings.
 * Priority: exact match > case-insensitive match > contains match
 */
export function getFloorMapping(
  floor: string,
  mappings: FloorSectionMapping[]
): FloorMappingResult {
  if (!floor || mappings.length === 0) return { section: '01', activity: '0000' };
  
  const normalizedFloor = floor.toLowerCase().trim();
  
  // 1. Try exact match first (case-insensitive)
  const exactMatch = mappings.find(
    m => m.floor_pattern.toLowerCase().trim() === normalizedFloor
  );
  if (exactMatch) return { section: exactMatch.section_code, activity: exactMatch.activity_code || '0000' };
  
  // 2. Try partial match where pattern is contained in floor value
  const containsMatch = mappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return pattern.length >= 2 && normalizedFloor.includes(pattern);
  });
  if (containsMatch) return { section: containsMatch.section_code, activity: containsMatch.activity_code || '0000' };
  
  // 3. Try reverse partial match where floor is contained in pattern
  const reverseMatch = mappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return normalizedFloor.length >= 2 && pattern.includes(normalizedFloor);
  });
  if (reverseMatch) return { section: reverseMatch.section_code, activity: reverseMatch.activity_code || '0000' };
  
  return { section: '01', activity: '0000' }; // Default
}
