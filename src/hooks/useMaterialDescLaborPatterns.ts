import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialDescLaborPattern {
  id: string;
  material_description_pattern: string;
  labor_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
}

const TABLE = 'material_desc_labor_patterns';
const QK = [TABLE] as const;

export function useMaterialDescLaborPatterns() {
  return useQuery({
    queryKey: [...QK],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaterialDescLaborPattern[];
    },
    staleTime: 60_000,
  });
}

export function useRecordMaterialDescLaborPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      materialDescription,
      laborCode,
    }: {
      materialDescription: string;
      laborCode: string;
    }) => {
      // Try to find existing pattern
      const { data: existing } = await (supabase as any)
        .from(TABLE)
        .select('id, usage_count')
        .eq('material_description_pattern', materialDescription)
        .eq('labor_code', laborCode)
        .maybeSingle();

      if (existing) {
        const newCount = (existing.usage_count || 1) + 1;
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({
            usage_count: newCount,
            confidence_score: Math.min(0.99, 0.5 + newCount * 0.05),
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from(TABLE)
          .insert({
            material_description_pattern: materialDescription,
            labor_code: laborCode,
            usage_count: 1,
            confidence_score: 0.50,
            last_used_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QK] });
    },
  });
}

/**
 * Returns the best suggestion for a material description based on learned patterns.
 * Uses exact match → starts-with → word overlap.
 */
export function getSuggestionForMaterialDesc(
  materialDescription: string,
  patterns: MaterialDescLaborPattern[]
): { laborCode: string; confidence: number } | null {
  if (!materialDescription || patterns.length === 0) return null;

  const descLower = materialDescription.toLowerCase();

  // 1. Exact match
  const exact = patterns
    .filter(p => p.material_description_pattern.toLowerCase() === descLower)
    .sort((a, b) => b.usage_count - a.usage_count)[0];
  if (exact) return { laborCode: exact.labor_code, confidence: exact.confidence_score };

  // 2. Starts-with match
  const startsWith = patterns
    .filter(p =>
      descLower.startsWith(p.material_description_pattern.toLowerCase()) ||
      p.material_description_pattern.toLowerCase().startsWith(descLower)
    )
    .sort((a, b) => b.usage_count - a.usage_count)[0];
  if (startsWith) return { laborCode: startsWith.labor_code, confidence: startsWith.confidence_score * 0.85 };

  // 3. Significant word overlap (≥2 shared words of 4+ chars)
  const descWords = descLower.split(/\W+/).filter(w => w.length >= 4);
  if (descWords.length === 0) return null;

  let bestScore = 0;
  let bestPattern: MaterialDescLaborPattern | null = null;

  for (const p of patterns) {
    const patternWords = p.material_description_pattern.toLowerCase().split(/\W+/).filter(w => w.length >= 4);
    const shared = descWords.filter(w => patternWords.includes(w)).length;
    const score = shared / Math.max(descWords.length, patternWords.length);
    if (shared >= 2 && score > bestScore) {
      bestScore = score;
      bestPattern = p;
    }
  }

  if (bestPattern) {
    return {
      laborCode: bestPattern.labor_code,
      confidence: bestPattern.confidence_score * bestScore * 0.8,
    };
  }

  return null;
}
