import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstimateProject {
  id: string;
  user_id: string;
  name: string;
  file_name: string | null;
  total_items: number;
  created_at: string;
  updated_at: string;
}

export interface SystemMapping {
  id: string;
  project_id: string;
  system_name: string;
  item_type: string | null;
  cost_head: string;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MappingHistoryEntry {
  id: string;
  project_id: string;
  system_name: string;
  from_code: string | null;
  to_code: string;
  change_reason: string | null;
  changed_by: string;
  created_at: string;
}

export interface EstimateItem {
  id: string;
  project_id: string;
  row_number: number;
  drawing: string;
  system: string;
  floor: string;
  zone: string;
  symbol: string;
  estimator: string;
  material_spec: string;
  item_type: string;
  report_cat: string;
  trade: string;
  material_desc: string;
  item_name: string;
  size: string;
  quantity: number;
  list_price: number;
  material_dollars: number;
  weight: number;
  hours: number;
  labor_dollars: number;
  cost_code: string;
  created_at: string;
  updated_at: string;
}

// Fetch all projects for current user
export const useEstimateProjects = () => {
  return useQuery({
    queryKey: ['estimate_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as EstimateProject[];
    },
  });
};

// Fetch single project
export const useEstimateProject = (projectId: string | null) => {
  return useQuery({
    queryKey: ['estimate_project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('estimate_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data as EstimateProject;
    },
    enabled: !!projectId,
  });
};

// Fetch mappings for a project
export const useSystemMappings = (projectId: string | null) => {
  return useQuery({
    queryKey: ['system_mappings', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('system_mappings')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      return data as SystemMapping[];
    },
    enabled: !!projectId,
  });
};

// Fetch mapping history
export const useMappingHistory = (projectId: string | null) => {
  return useQuery({
    queryKey: ['mapping_history', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('mapping_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MappingHistoryEntry[];
    },
    enabled: !!projectId,
  });
};

// Create project mutation
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, fileName, totalItems }: { name: string; fileName?: string; totalItems?: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('estimate_projects')
        .insert({
          user_id: user.id,
          name,
          file_name: fileName,
          total_items: totalItems || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EstimateProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate_projects'] });
    },
  });
};

// Update project mutation
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EstimateProject> & { id: string }) => {
      const { data, error } = await supabase
        .from('estimate_projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as EstimateProject;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_projects'] });
      queryClient.invalidateQueries({ queryKey: ['estimate_project', data.id] });
    },
  });
};

// Delete project mutation
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('estimate_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate_projects'] });
    },
  });
};

// Save/update system mapping
export const useSaveMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      systemName, 
      costHead,
      isVerified = false,
      verifiedAt = null,
      previousCode = null 
    }: { 
      projectId: string; 
      systemName: string; 
      costHead: string;
      isVerified?: boolean;
      verifiedAt?: string | null;
      previousCode?: string | null;
    }) => {
      // Upsert the mapping
      const { data, error } = await supabase
        .from('system_mappings')
        .upsert({
          project_id: projectId,
          system_name: systemName.toLowerCase().trim(),
          cost_head: costHead,
          is_verified: isVerified,
          verified_at: verifiedAt,
        }, {
          onConflict: 'project_id,system_name'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to history if there was a previous code
      if (previousCode && previousCode !== costHead) {
        await supabase.from('mapping_history').insert({
          project_id: projectId,
          system_name: systemName.toLowerCase().trim(),
          from_code: previousCode,
          to_code: costHead,
          change_reason: 'Manual change',
        });
      }

      return data as SystemMapping;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system_mappings', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['mapping_history', variables.projectId] });
    },
  });
};

// Verify mapping
export const useVerifyMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      systemName, 
      isVerified 
    }: { 
      projectId: string; 
      systemName: string; 
      isVerified: boolean;
    }) => {
      const { data, error } = await supabase
        .from('system_mappings')
        .update({
          is_verified: isVerified,
          verified_at: isVerified ? new Date().toISOString() : null,
          verified_by: isVerified ? 'user' : null,
        })
        .eq('project_id', projectId)
        .eq('system_name', systemName.toLowerCase().trim())
        .select()
        .single();

      if (error) throw error;
      return data as SystemMapping;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system_mappings', variables.projectId] });
    },
  });
};

// Batch save mappings
export const useBatchSaveMappings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      mappings 
    }: { 
      projectId: string; 
      mappings: Array<{ systemName: string; costHead: string; isVerified?: boolean }>;
    }) => {
      const mappingsToUpsert = mappings.map(m => ({
        project_id: projectId,
        system_name: m.systemName.toLowerCase().trim(),
        cost_head: m.costHead,
        is_verified: m.isVerified || false,
      }));

      const { data, error } = await supabase
        .from('system_mappings')
        .upsert(mappingsToUpsert, {
          onConflict: 'project_id,system_name'
        })
        .select();

      if (error) throw error;
      return data as SystemMapping[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system_mappings', variables.projectId] });
    },
  });
};

// Fetch estimate items for a project
export const useEstimateItems = (projectId: string | null) => {
  return useQuery({
    queryKey: ['estimate_items', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('project_id', projectId)
        .order('row_number', { ascending: true });

      if (error) throw error;
      return data as EstimateItem[];
    },
    enabled: !!projectId,
  });
};

// Save estimate items in batches
export const useSaveEstimateItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      items,
      onProgress
    }: { 
      projectId: string; 
      items: Array<{
        row_number: number;
        drawing: string;
        system: string;
        floor: string;
        zone: string;
        symbol?: string;
        estimator?: string;
        material_spec?: string;
        item_type?: string;
        report_cat?: string;
        trade?: string;
        material_desc: string;
        item_name: string;
        size: string;
        quantity: number;
        list_price?: number;
        material_dollars: number;
        weight?: number;
        hours: number;
        labor_dollars: number;
        cost_code: string;
      }>;
      onProgress?: (progress: number) => void;
    }) => {
      // First, delete existing items for this project
      const { error: deleteError } = await supabase
        .from('estimate_items')
        .delete()
        .eq('project_id', projectId);
      
      if (deleteError) throw deleteError;

      // Insert in batches of 100
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE).map(item => ({
          project_id: projectId,
          row_number: item.row_number,
          drawing: item.drawing || '',
          system: item.system || '',
          floor: item.floor || '',
          zone: item.zone || '',
          symbol: item.symbol || '',
          estimator: item.estimator || '',
          material_spec: item.material_spec || '',
          item_type: item.item_type || '',
          report_cat: item.report_cat || '',
          trade: item.trade || '',
          material_desc: item.material_desc || '',
          item_name: item.item_name || '',
          size: item.size || '',
          quantity: item.quantity || 0,
          list_price: item.list_price || 0,
          material_dollars: item.material_dollars || 0,
          weight: item.weight || 0,
          hours: item.hours || 0,
          labor_dollars: item.labor_dollars || 0,
          cost_code: item.cost_code || '',
        }));

        const { error } = await supabase
          .from('estimate_items')
          .insert(batch);

        if (error) throw error;

        // Report progress
        if (onProgress) {
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          onProgress(Math.round((batchNum / totalBatches) * 100));
        }
      }

      return { success: true, count: items.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
    },
  });
};

// Update a single item's cost code
export const useUpdateItemCostCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      costCode,
      projectId
    }: { 
      itemId: string; 
      costCode: string;
      projectId: string;
    }) => {
      const { data, error } = await supabase
        .from('estimate_items')
        .update({ cost_code: costCode })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data as EstimateItem;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
    },
  });
};

// Batch update cost codes for items matching a system
export const useBatchUpdateSystemCostCodes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      system,
      costCode
    }: { 
      projectId: string; 
      system: string;
      costCode: string;
    }) => {
      // Update all items with matching system that don't have a cost code
      const { data, error } = await supabase
        .from('estimate_items')
        .update({ cost_code: costCode })
        .eq('project_id', projectId)
        .ilike('system', system)
        .eq('cost_code', '')
        .select();

      if (error) throw error;
      return data as EstimateItem[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
    },
  });
};
