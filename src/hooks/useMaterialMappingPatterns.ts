import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MaterialMappingPattern {
  id: string;
  material_spec_pattern: string;
  item_type_pattern: string;
  material_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
}

// Normalize pattern for consistent matching
const normalizePattern = (str: string) => (str || '').toLowerCase().trim();

// Fetch all material mapping patterns
export const useMaterialMappingPatterns = () => {
  return useQuery({
    queryKey: ['material-mapping-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_mapping_patterns')
        .select('*')
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      return data as MaterialMappingPattern[];
    },
  });
};

// Get suggestion for a specific material spec + item type combination
export const useMaterialCodeSuggestion = (materialSpec: string, itemType: string) => {
  const { data: patterns } = useMaterialMappingPatterns();
  
  if (!patterns || !materialSpec || !itemType) return null;
  
  const normalizedSpec = normalizePattern(materialSpec);
  const normalizedType = normalizePattern(itemType);
  
  // Find exact match first
  const exactMatch = patterns.find(
    p => normalizePattern(p.material_spec_pattern) === normalizedSpec &&
         normalizePattern(p.item_type_pattern) === normalizedType
  );
  
  if (exactMatch) {
    return {
      code: exactMatch.material_code,
      confidence: Math.min(exactMatch.confidence_score, 1),
      usageCount: exactMatch.usage_count,
      matchType: 'exact' as const,
    };
  }
  
  // Try partial match on item type alone (less specific but still useful)
  const itemTypeMatch = patterns.find(
    p => normalizePattern(p.item_type_pattern) === normalizedType
  );
  
  if (itemTypeMatch && itemTypeMatch.usage_count >= 3) {
    return {
      code: itemTypeMatch.material_code,
      confidence: Math.min(itemTypeMatch.confidence_score * 0.7, 0.7),
      usageCount: itemTypeMatch.usage_count,
      matchType: 'partial' as const,
    };
  }
  
  return null;
};

// Get suggestions for multiple groups at once
export const useGetMaterialSuggestions = () => {
  const { data: patterns } = useMaterialMappingPatterns();
  
  return (materialSpec: string, itemType: string) => {
    if (!patterns || !materialSpec || !itemType) return null;
    
    const normalizedSpec = normalizePattern(materialSpec);
    const normalizedType = normalizePattern(itemType);
    
    // Find exact match first
    const exactMatch = patterns.find(
      p => normalizePattern(p.material_spec_pattern) === normalizedSpec &&
           normalizePattern(p.item_type_pattern) === normalizedType
    );
    
    if (exactMatch) {
      return {
        code: exactMatch.material_code,
        confidence: Math.min(exactMatch.confidence_score, 1),
        usageCount: exactMatch.usage_count,
        matchType: 'exact' as const,
      };
    }
    
    // Try partial match on item type alone
    const itemTypeMatch = patterns.find(
      p => normalizePattern(p.item_type_pattern) === normalizedType
    );
    
    if (itemTypeMatch && itemTypeMatch.usage_count >= 2) {
      return {
        code: itemTypeMatch.material_code,
        confidence: Math.min(itemTypeMatch.confidence_score * 0.6, 0.6),
        usageCount: itemTypeMatch.usage_count,
        matchType: 'partial' as const,
      };
    }
    
    return null;
  };
};

// Learn from a material code assignment
export const useLearnMaterialPattern = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      materialSpec, 
      itemType, 
      materialCode 
    }: { 
      materialSpec: string; 
      itemType: string; 
      materialCode: string;
    }) => {
      const normalizedSpec = normalizePattern(materialSpec);
      const normalizedType = normalizePattern(itemType);
      
      // Try to find existing pattern
      const { data: existing } = await supabase
        .from('material_mapping_patterns')
        .select('*')
        .eq('material_spec_pattern', normalizedSpec)
        .eq('item_type_pattern', normalizedType)
        .eq('material_code', materialCode)
        .single();
      
      if (existing) {
        // Update existing pattern - increment usage
        const newUsageCount = existing.usage_count + 1;
        const newConfidence = Math.min(1, 0.5 + (newUsageCount * 0.1));
        
        const { error } = await supabase
          .from('material_mapping_patterns')
          .update({
            usage_count: newUsageCount,
            confidence_score: newConfidence,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new pattern
        const { error } = await supabase
          .from('material_mapping_patterns')
          .insert({
            material_spec_pattern: normalizedSpec,
            item_type_pattern: normalizedType,
            material_code: materialCode,
            usage_count: 1,
            confidence_score: 0.5,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-mapping-patterns'] });
    },
  });
};

// Batch learn from multiple assignments
export const useBatchLearnMaterialPatterns = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignments: Array<{ 
      materialSpec: string; 
      itemType: string; 
      materialCode: string;
    }>) => {
      // Group by unique pattern
      const patternMap = new Map<string, { 
        materialSpec: string; 
        itemType: string; 
        materialCode: string; 
        count: number;
      }>();
      
      assignments.forEach(a => {
        const key = `${normalizePattern(a.materialSpec)}|${normalizePattern(a.itemType)}|${a.materialCode}`;
        const existing = patternMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          patternMap.set(key, { ...a, count: 1 });
        }
      });
      
      // Process each unique pattern
      for (const [_, pattern] of patternMap) {
        const normalizedSpec = normalizePattern(pattern.materialSpec);
        const normalizedType = normalizePattern(pattern.itemType);
        
        const { data: existing } = await supabase
          .from('material_mapping_patterns')
          .select('*')
          .eq('material_spec_pattern', normalizedSpec)
          .eq('item_type_pattern', normalizedType)
          .eq('material_code', pattern.materialCode)
          .single();
        
        if (existing) {
          const newUsageCount = existing.usage_count + pattern.count;
          const newConfidence = Math.min(1, 0.5 + (newUsageCount * 0.1));
          
          await supabase
            .from('material_mapping_patterns')
            .update({
              usage_count: newUsageCount,
              confidence_score: newConfidence,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('material_mapping_patterns')
            .insert({
              material_spec_pattern: normalizedSpec,
              item_type_pattern: normalizedType,
              material_code: pattern.materialCode,
              usage_count: pattern.count,
              confidence_score: Math.min(1, 0.5 + (pattern.count * 0.1)),
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-mapping-patterns'] });
    },
  });
};
