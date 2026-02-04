import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FloorSectionMapping {
  id: string;
  project_id: string;
  floor_pattern: string;
  section_code: string;
  created_at: string;
  updated_at: string;
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
    }: {
      projectId: string;
      floorPattern: string;
      sectionCode: string;
    }) => {
      const { data, error } = await supabase
        .from('floor_section_mappings')
        .upsert(
          {
            project_id: projectId,
            floor_pattern: floorPattern,
            section_code: sectionCode,
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
      mappings: Array<{ floorPattern: string; sectionCode: string }>;
    }) => {
      const records = mappings.map(m => ({
        project_id: projectId,
        floor_pattern: m.floorPattern,
        section_code: m.sectionCode,
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
 * Utility function to get section code from floor value using mappings
 * Matches against the Floor column values (e.g., "Club Level", "UG"), NOT drawing names
 * Priority: exact match > case-insensitive match > contains match
 */
export function getSectionFromFloor(
  floor: string,
  mappings: FloorSectionMapping[]
): string {
  if (!floor || mappings.length === 0) return '01';
  
  const normalizedFloor = floor.toLowerCase().trim();
  
  // 1. Try exact match first (case-insensitive)
  const exactMatch = mappings.find(
    m => m.floor_pattern.toLowerCase().trim() === normalizedFloor
  );
  if (exactMatch) return exactMatch.section_code;
  
  // 2. Try partial match where pattern is contained in floor value
  // e.g., pattern "Club" matches floor "Club Level"
  const containsMatch = mappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    // Pattern must be at least 2 chars to avoid false positives
    return pattern.length >= 2 && normalizedFloor.includes(pattern);
  });
  if (containsMatch) return containsMatch.section_code;
  
  // 3. Try reverse partial match where floor is contained in pattern
  // e.g., floor "UG" matches pattern "Underground/UG"
  const reverseMatch = mappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    // Floor must be at least 2 chars to avoid false positives
    return normalizedFloor.length >= 2 && pattern.includes(normalizedFloor);
  });
  if (reverseMatch) return reverseMatch.section_code;
  
  return '01'; // Default section
}
