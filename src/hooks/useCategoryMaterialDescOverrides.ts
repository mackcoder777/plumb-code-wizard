import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryMaterialDescOverride {
  id: string;
  project_id: string;
  category_name: string;
  material_description: string;
  labor_code: string;
  created_at: string;
  updated_at: string;
}

const TABLE = 'category_material_desc_overrides';
const QUERY_KEY = 'category-material-desc-overrides';

export function useCategoryMaterialDescOverrides(projectId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as CategoryMaterialDescOverride[];
    },
    enabled: !!projectId,
  });
}

export function useSaveCategoryMaterialDescOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      materialDescription,
      laborCode,
    }: {
      categoryName: string;
      materialDescription: string;
      laborCode: string;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any).from(TABLE).upsert(
        {
          project_id: projectId,
          category_name: categoryName,
          material_description: materialDescription,
          labor_code: laborCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,category_name,material_description' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

export function useDeleteCategoryMaterialDescOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      materialDescription,
    }: {
      categoryName: string;
      materialDescription: string;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await (supabase as any)
        .from(TABLE)
        .delete()
        .eq('project_id', projectId)
        .eq('category_name', categoryName)
        .eq('material_description', materialDescription);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY, projectId] }),
  });
}

/**
 * Lookup helper — used in apply functions.
 * Returns the labor code override for a given category + materialDesc, or null.
 */
export function getLaborCodeFromMaterialDesc(
  categoryName: string,
  materialDescription: string,
  overrides: CategoryMaterialDescOverride[]
): string | null {
  if (!categoryName || !materialDescription || overrides.length === 0) return null;
  const match = overrides.find(
    o =>
      o.category_name === categoryName &&
      o.material_description === materialDescription
  );
  if (!match || match.labor_code === '__CATEGORY__') return null;
  return match.labor_code;
}
