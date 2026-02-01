import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MappingPattern {
  id: string;
  system_name_pattern: string;
  labor_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
}

const normalizeSystemKey = (system: string) => (system || 'Unknown').toLowerCase().trim();

/**
 * Fetch all mapping patterns from the database
 */
export const useMappingPatterns = () => {
  return useQuery({
    queryKey: ['mapping-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapping_patterns')
        .select('*')
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data as MappingPattern[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

/**
 * Get the best suggestion for a system name based on historical patterns
 */
export const useGetSuggestion = (systemName: string) => {
  const { data: patterns = [] } = useMappingPatterns();
  
  const normalizedName = normalizeSystemKey(systemName);
  
  // Exact match first
  const exactMatch = patterns.find(p => p.system_name_pattern === normalizedName);
  if (exactMatch) {
    return {
      laborCode: exactMatch.labor_code,
      confidence: Math.min(0.95, 0.5 + (exactMatch.usage_count * 0.1)),
      usageCount: exactMatch.usage_count,
      matchType: 'exact' as const,
    };
  }
  
  // Fuzzy match - find patterns that contain or are contained in the system name
  const fuzzyMatches = patterns.filter(p => {
    const pattern = p.system_name_pattern;
    return normalizedName.includes(pattern) || pattern.includes(normalizedName);
  });
  
  if (fuzzyMatches.length > 0) {
    // Sort by usage count and return the best one
    const bestMatch = fuzzyMatches.sort((a, b) => b.usage_count - a.usage_count)[0];
    return {
      laborCode: bestMatch.labor_code,
      confidence: Math.min(0.85, 0.3 + (bestMatch.usage_count * 0.05)),
      usageCount: bestMatch.usage_count,
      matchType: 'fuzzy' as const,
    };
  }
  
  return null;
};

/**
 * Get suggestions for multiple systems at once (batch operation)
 */
export const useGetBatchSuggestions = (systemNames: string[]) => {
  const { data: patterns = [], isLoading } = useMappingPatterns();
  
  if (isLoading || patterns.length === 0) {
    return { suggestions: {}, isLoading };
  }
  
  const suggestions: Record<string, {
    laborCode: string;
    confidence: number;
    usageCount: number;
    matchType: 'exact' | 'fuzzy';
  }> = {};
  
  for (const systemName of systemNames) {
    const normalizedName = normalizeSystemKey(systemName);
    
    // Exact match first
    const exactMatch = patterns.find(p => p.system_name_pattern === normalizedName);
    if (exactMatch) {
      suggestions[normalizedName] = {
        laborCode: exactMatch.labor_code,
        confidence: Math.min(0.95, 0.5 + (exactMatch.usage_count * 0.1)),
        usageCount: exactMatch.usage_count,
        matchType: 'exact',
      };
      continue;
    }
    
    // Fuzzy match
    const fuzzyMatches = patterns.filter(p => {
      const pattern = p.system_name_pattern;
      return normalizedName.includes(pattern) || pattern.includes(normalizedName);
    });
    
    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches.sort((a, b) => b.usage_count - a.usage_count)[0];
      suggestions[normalizedName] = {
        laborCode: bestMatch.labor_code,
        confidence: Math.min(0.85, 0.3 + (bestMatch.usage_count * 0.05)),
        usageCount: bestMatch.usage_count,
        matchType: 'fuzzy',
      };
    }
  }
  
  return { suggestions, isLoading };
};

/**
 * Record a mapping pattern (called when user confirms/applies a mapping)
 */
export const useRecordMappingPattern = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ systemName, laborCode }: { systemName: string; laborCode: string }) => {
      const normalizedName = normalizeSystemKey(systemName);
      
      // Try to upsert - increment usage_count if exists, otherwise insert
      const { data: existing } = await supabase
        .from('mapping_patterns')
        .select('id, usage_count')
        .eq('system_name_pattern', normalizedName)
        .eq('labor_code', laborCode)
        .single();
      
      if (existing) {
        // Update existing pattern
        const { error } = await supabase
          .from('mapping_patterns')
          .update({
            usage_count: existing.usage_count + 1,
            last_used_at: new Date().toISOString(),
            confidence_score: Math.min(1.0, 0.5 + ((existing.usage_count + 1) * 0.1)),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new pattern
        const { error } = await supabase
          .from('mapping_patterns')
          .insert({
            system_name_pattern: normalizedName,
            labor_code: laborCode,
            usage_count: 1,
            confidence_score: 0.5,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-patterns'] });
    },
  });
};

/**
 * Record multiple mapping patterns at once (for bulk operations)
 */
export const useBatchRecordMappingPatterns = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mappings: Array<{ systemName: string; laborCode: string }>) => {
      for (const { systemName, laborCode } of mappings) {
        const normalizedName = normalizeSystemKey(systemName);
        
        const { data: existing } = await supabase
          .from('mapping_patterns')
          .select('id, usage_count')
          .eq('system_name_pattern', normalizedName)
          .eq('labor_code', laborCode)
          .single();
        
        if (existing) {
          await supabase
            .from('mapping_patterns')
            .update({
              usage_count: existing.usage_count + 1,
              last_used_at: new Date().toISOString(),
              confidence_score: Math.min(1.0, 0.5 + ((existing.usage_count + 1) * 0.1)),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('mapping_patterns')
            .insert({
              system_name_pattern: normalizedName,
              labor_code: laborCode,
              usage_count: 1,
              confidence_score: 0.5,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapping-patterns'] });
    },
  });
};
