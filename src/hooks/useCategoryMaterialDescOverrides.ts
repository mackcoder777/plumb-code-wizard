import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';


export interface CategoryMaterialDescOverride {
  id: string;
  project_id: string;
  category_name: string;
  material_description: string;
  labor_code: string;
}

const TABLE = 'category_material_desc_overrides';

export function useCategoryMaterialDescOverrides(projectId: string | null) {
  return useQuery({
    queryKey: [TABLE, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
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
      const { error } = await supabase
        .from(TABLE)
        .upsert(
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
    onMutate: async ({ categoryName, materialDescription, laborCode }) => {
      await qc.cancelQueries({ queryKey: [TABLE, projectId] });
      const previous = qc.getQueryData<CategoryMaterialDescOverride[]>([TABLE, projectId]);
      qc.setQueryData<CategoryMaterialDescOverride[]>([TABLE, projectId], old => {
        const list = old ?? [];
        const idx = list.findIndex(
          o => o.category_name === categoryName && o.material_description === materialDescription
        );
        const next: CategoryMaterialDescOverride = {
          id: idx >= 0 ? list[idx].id : `optimistic-${Date.now()}`,
          project_id: projectId!,
          category_name: categoryName,
          material_description: materialDescription,
          labor_code: laborCode,
        };
        return idx >= 0
          ? list.map((o, i) => (i === idx ? next : o))
          : [...list, next];
      });
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData([TABLE, projectId], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
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
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('project_id', projectId)
        .eq('category_name', categoryName)
        .eq('material_description', materialDescription);
      if (error) throw error;
    },
    onMutate: async ({ categoryName, materialDescription }) => {
      await qc.cancelQueries({ queryKey: [TABLE, projectId] });
      const previous = qc.getQueryData<CategoryMaterialDescOverride[]>([TABLE, projectId]);
      qc.setQueryData<CategoryMaterialDescOverride[]>([TABLE, projectId], old =>
        (old ?? []).filter(
          o => !(o.category_name === categoryName && o.material_description === materialDescription)
        )
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData([TABLE, projectId], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
  });
}

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
