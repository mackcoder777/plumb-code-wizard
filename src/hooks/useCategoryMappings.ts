import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';

export interface CategoryLaborMapping {
  id: string;
  project_id: string;
  category_name: string;
  labor_code: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryIndexEntry {
  category: string;
  itemCount: number;
  totalHours: number;
}

export function useCategoryMappings(projectId: string | null) {
  return useQuery({
    queryKey: ['category-labor-mappings', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('category_labor_mappings')
        .select('*')
        .eq('project_id', projectId)
        .order('category_name');
      
      if (error) throw error;
      return data as CategoryLaborMapping[];
    },
    enabled: !!projectId,
  });
}

export function useSaveCategoryMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      categoryName,
      laborCode,
    }: {
      projectId: string;
      categoryName: string;
      laborCode: string;
    }) => {
      const { data, error } = await supabase
        .from('category_labor_mappings')
        .upsert(
          {
            project_id: projectId,
            category_name: categoryName,
            labor_code: laborCode,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'project_id,category_name',
          }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-labor-mappings', variables.projectId] });
    },
  });
}

export function useDeleteCategoryMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      projectId,
      categoryName,
    }: {
      projectId: string;
      categoryName: string;
    }) => {
      const { error } = await supabase
        .from('category_labor_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('category_name', categoryName);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-labor-mappings', variables.projectId] });
    },
  });
}

/**
 * Build an index of unique report categories from estimate items
 */
export function useCategoryIndex(data: EstimateItem[]): CategoryIndexEntry[] {
  return useMemo(() => {
    const categoryMap = new Map<string, { count: number; hours: number }>();
    
    for (const item of data) {
      const category = item.reportCat || 'Unknown';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, hours: 0 });
      }
      const entry = categoryMap.get(category)!;
      entry.count++;
      entry.hours += item.hours || 0;
    }
    
    return Array.from(categoryMap.entries())
      .map(([category, entry]) => ({
        category,
        itemCount: entry.count,
        totalHours: entry.hours,
      }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [data]);
}

/**
 * Get labor code for a category from mappings
 */
export function getLaborCodeFromCategory(
  reportCat: string,
  mappings: CategoryLaborMapping[]
): string | null {
  if (!reportCat || mappings.length === 0) return null;
  
  const normalizedCat = reportCat.toLowerCase().trim();
  
  // Try exact match first
  const exactMatch = mappings.find(
    m => m.category_name.toLowerCase().trim() === normalizedCat
  );
  if (exactMatch) return exactMatch.labor_code;
  
  return null;
}
