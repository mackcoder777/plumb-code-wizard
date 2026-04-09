import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryLaborPattern {
  id: string;
  category_name: string;
  labor_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
}

const TABLE = 'category_labor_patterns';
const QK = [TABLE] as const;

/** Minimum confidence to surface a suggestion badge. */
export const MIN_SUGGESTION_CONFIDENCE = 0.60;

export function useCategoryLaborPatterns() {
  return useQuery({
    queryKey: [...QK],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CategoryLaborPattern[];
    },
    staleTime: 60_000,
  });
}

export function useRecordCategoryLaborPattern() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      laborCode,
    }: {
      categoryName: string;
      laborCode: string;
    }) => {
      const { data: existing } = await (supabase as any)
        .from(TABLE)
        .select('id, usage_count')
        .eq('category_name', categoryName)
        .eq('labor_code', laborCode)
        .maybeSingle();

      if (existing) {
        const newCount = (existing.usage_count || 1) + 1;
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({
            usage_count: newCount,
            confidence_score: Math.min(0.95, 0.5 + (newCount - 1) * 0.1),
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from(TABLE)
          .insert({
            category_name: categoryName,
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
 * Returns the best suggestion for a category name based on learned patterns.
 * Exact match only — "Fixtures" won't match "Fixture Trim".
 * Only returns suggestions with confidence >= MIN_SUGGESTION_CONFIDENCE.
 */
export function getSuggestionForCategory(
  categoryName: string,
  patterns: CategoryLaborPattern[]
): { laborCode: string; confidence: number; usageCount: number } | null {
  if (!categoryName || patterns.length === 0) return null;

  const nameLower = categoryName.toLowerCase().trim();

  const matches = patterns
    .filter(p => p.category_name.toLowerCase().trim() === nameLower && p.confidence_score >= MIN_SUGGESTION_CONFIDENCE)
    .sort((a, b) => b.usage_count - a.usage_count);

  if (matches.length === 0) return null;

  return {
    laborCode: matches[0].labor_code,
    confidence: matches[0].confidence_score,
    usageCount: matches[0].usage_count,
  };
}
