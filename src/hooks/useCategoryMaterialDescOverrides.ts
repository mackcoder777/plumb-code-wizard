import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save override',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCategoryMaterialDescOverride(projectId: string | null) {
  const qc = useQueryClient();
  const { toast } = useToast();
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE, projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove override',
        description: error.message,
        variant: 'destructive',
      });
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
