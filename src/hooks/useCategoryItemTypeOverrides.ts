import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryItemTypeOverride {
  id: string;
  project_id: string;
  category_name: string;
  item_type: string;
  labor_code: string;
}

const TABLE = 'category_item_type_overrides';
const QUERY_KEY = 'category-item-type-overrides';

export function useCategoryItemTypeOverrides(projectId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as CategoryItemTypeOverride[];
    },
    enabled: !!projectId,
  });
}

export function useSaveCategoryItemTypeOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      itemType,
      laborCode,
    }: {
      categoryName: string;
      itemType: string;
      laborCode: string;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any).from(TABLE).upsert(
        {
          project_id: projectId,
          category_name: categoryName,
          item_type: itemType,
          labor_code: laborCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,category_name,item_type' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

export function useDeleteCategoryItemTypeOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      itemType,
    }: {
      categoryName: string;
      itemType: string;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any)
        .from(TABLE)
        .delete()
        .eq('project_id', projectId)
        .eq('category_name', categoryName)
        .eq('item_type', itemType);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

/**
 * Get labor code from item-type override within a category.
 * Returns null if no override exists or if set to __CATEGORY__ (defer to category).
 */
export function getLaborCodeFromItemTypeOverride(
  categoryName: string,
  itemType: string,
  overrides: CategoryItemTypeOverride[]
): string | null {
  if (!categoryName || !itemType || overrides.length === 0) return null;
  const match = overrides.find(
    o => o.category_name === categoryName && o.item_type === itemType
  );
  if (!match || match.labor_code === '__CATEGORY__') return null;
  return match.labor_code;
}
