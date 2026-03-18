import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryKeywordRule {
  id: string;
  project_id: string;
  category_name: string;
  keyword: string;
  labor_code: string;
  priority: number;
  created_at: string;
}

const TABLE = 'category_keyword_rules';
const QUERY_KEY = 'category-keyword-rules';

export function useCategoryKeywordRules(projectId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId)
        .order('priority', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryKeywordRule[];
    },
    enabled: !!projectId,
  });
}

export function useSaveCategoryKeywordRule(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: {
      category_name: string;
      keyword: string;
      labor_code: string;
      priority: number;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any).from(TABLE).upsert(
        { ...rule, project_id: projectId },
        { onConflict: 'project_id,category_name,keyword' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

export function useDeleteCategoryKeywordRule(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

/**
 * Resolve labor code from keyword rules for a given category + item name.
 * Rules are evaluated in priority order; first match wins.
 */
export function getLaborCodeFromKeywordRules(
  categoryName: string,
  itemName: string,
  rules: CategoryKeywordRule[],
  materialDesc?: string
): string | null {
  if (!categoryName || rules.length === 0) return null;
  if (!itemName && !materialDesc) return null;
  const categoryRules = rules
    .filter(r => r.category_name === categoryName)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of categoryRules) {
    const kw = rule.keyword.toLowerCase();
    const matchesName = itemName?.toLowerCase().includes(kw) ?? false;
    const matchesDesc = materialDesc?.toLowerCase().includes(kw) ?? false;
    if (matchesName || matchesDesc) {
      return rule.labor_code === '__CATEGORY__' ? null : rule.labor_code;
    }
  }
  return null;
}
