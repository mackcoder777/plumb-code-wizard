import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostCode {
  id: string;
  code: string;
  description: string;
  category: 'L' | 'M' | 'O' | 'R' | 'S';
  subcategory?: string;
  units?: string;
}

export const useCostCodes = () => {
  return useQuery({
    queryKey: ['cost_codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .order('description', { ascending: true });

      if (error) {
        throw error;
      }

      return data as CostCode[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};

export const useLaborCodes = () => {
  return useQuery({
    queryKey: ['cost_codes', 'labor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('category', 'L')
        .order('description', { ascending: true });

      if (error) {
        throw error;
      }

      return data as CostCode[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useMaterialCodes = () => {
  return useQuery({
    queryKey: ['cost_codes', 'material'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .in('category', ['M', 'O'])
        .order('description', { ascending: true });

      if (error) {
        throw error;
      }

      return data as CostCode[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

// Mutation hooks for CRUD operations (admin only)
export const useAddCostCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newCode: Omit<CostCode, 'id'>) => {
      const { data, error } = await supabase
        .from('cost_codes')
        .insert([newCode])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_codes'] });
    },
  });
};

export const useUpdateCostCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CostCode> & { id: string }) => {
      const { data, error } = await supabase
        .from('cost_codes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_codes'] });
    },
  });
};

export const useDeleteCostCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cost_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost_codes'] });
    },
  });
};
