import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryItemNameOverride {
  id: string;
  project_id: string;
  category_name: string;
  material_description: string;
  item_name: string;
  labor_code: string;
}

const TABLE = 'category_item_name_overrides';

export function useCategoryItemNameOverrides(projectId: string | null) {
  return useQuery({
    queryKey: [TABLE, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as CategoryItemNameOverride[];
    },
    enabled: !!projectId,
  });
}

export function useSaveCategoryItemNameOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      materialDescription,
      itemName,
      laborCode,
    }: {
      categoryName: string;
      materialDescription: string;
      itemName: string;
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
            item_name: itemName,
            labor_code: laborCode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,category_name,material_description,item_name' }
        );
      if (error) throw error;
    },
    onMutate: async ({ categoryName, materialDescription, itemName, laborCode }) => {
      await qc.cancelQueries({ queryKey: [TABLE, projectId] });
      const previous = qc.getQueryData<CategoryItemNameOverride[]>([TABLE, projectId]);
      qc.setQueryData<CategoryItemNameOverride[]>([TABLE, projectId], old => {
        const list = old ?? [];
        const idx = list.findIndex(
          o => o.category_name === categoryName && o.material_description === materialDescription && o.item_name === itemName
        );
        const next: CategoryItemNameOverride = {
          id: idx >= 0 ? list[idx].id : `optimistic-${Date.now()}`,
          project_id: projectId!,
          category_name: categoryName,
          material_description: materialDescription,
          item_name: itemName,
          labor_code: laborCode,
        };
        return idx >= 0
          ? list.map((o, i) => (i === idx ? next : o))
          : [...list, next];
      });
      return { previous };
    },
    onError: (_err: Error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData([TABLE, projectId], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
  });
}

export function useDeleteCategoryItemNameOverride(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryName,
      materialDescription,
      itemName,
    }: {
      categoryName: string;
      materialDescription: string;
      itemName: string;
    }) => {
      if (!projectId) throw new Error('No project selected');
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('project_id', projectId)
        .eq('category_name', categoryName)
        .eq('material_description', materialDescription)
        .eq('item_name', itemName);
      if (error) throw error;
    },
    onMutate: async ({ categoryName, materialDescription, itemName }) => {
      await qc.cancelQueries({ queryKey: [TABLE, projectId] });
      const previous = qc.getQueryData<CategoryItemNameOverride[]>([TABLE, projectId]);
      qc.setQueryData<CategoryItemNameOverride[]>([TABLE, projectId], old =>
        (old ?? []).filter(
          o => !(o.category_name === categoryName && o.material_description === materialDescription && o.item_name === itemName)
        )
      );
      return { previous };
    },
    onError: (_err: Error, _vars, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData([TABLE, projectId], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
  });
}

export function getLaborCodeFromItemName(
  categoryName: string,
  materialDescription: string,
  itemName: string,
  overrides: CategoryItemNameOverride[]
): string | null {
  if (!categoryName || !itemName || overrides.length === 0) return null;
  const match = overrides.find(
    o =>
      o.category_name === categoryName &&
      o.material_description === materialDescription &&
      o.item_name === itemName
  );
  if (!match || match.labor_code === '__CATEGORY__') return null;
  return match.labor_code;
}
