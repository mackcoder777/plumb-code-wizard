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
  code_format_mode?: 'standard' | 'multitrade';
  trade_prefix?: string;
  dismissed_duplicate_flags?: string[];
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
  applied_at: string | null;
  applied_item_count: number;
  auto_suggested: string | null;
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
  material_cost_code: string;
  source_file: string | null;
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
      previousCode = null,
      autoSuggested = null
    }: { 
      projectId: string; 
      systemName: string; 
      costHead: string;
      isVerified?: boolean;
      verifiedAt?: string | null;
      previousCode?: string | null;
      autoSuggested?: string | null;
    }) => {
      const normalizedSystem = systemName.toLowerCase().trim();
      
      // First check if record exists to preserve auto_suggested
      const { data: existing } = await supabase
        .from('system_mappings')
        .select('id, auto_suggested')
        .eq('project_id', projectId)
        .eq('system_name', normalizedSystem)
        .single();
      
      const upsertData = {
        project_id: projectId,
        system_name: normalizedSystem,
        cost_head: costHead,
        is_verified: isVerified,
        verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
        // Only set auto_suggested if it's a new record OR if not yet set
        ...(!existing || !existing.auto_suggested ? { auto_suggested: autoSuggested || costHead } : {})
      };
      
      const { data, error } = await supabase
        .from('system_mappings')
        .upsert([upsertData], {
          onConflict: 'project_id,system_name'
        })
        .select()
        .single();

      if (error) throw error;

      // Add to history if there was a previous code
      if (previousCode && previousCode !== costHead) {
        await supabase.from('mapping_history').insert({
          project_id: projectId,
          system_name: normalizedSystem,
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

// Delete system mapping
export const useDeleteMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      systemName,
    }: {
      projectId: string;
      systemName: string;
    }) => {
      const normalizedSystem = systemName.toLowerCase().trim();

      const { error } = await supabase
        .from('system_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('system_name', normalizedSystem);

      if (error) throw error;
      return { success: true };
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
// NOTE: Supabase has a default limit of 1000 rows, so we must paginate for large datasets
export const useEstimateItems = (projectId: string | null) => {
  return useQuery({
    queryKey: ['estimate_items', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      // Fetch all items using pagination to overcome the 1000 row limit
      const allItems: EstimateItem[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('estimate_items')
          .select('*')
          .eq('project_id', projectId)
          .order('row_number', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allItems.push(...(data as EstimateItem[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allItems;
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
        material_cost_code?: string;
        source_file?: string;
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
          material_cost_code: item.material_cost_code || '',
          source_file: item.source_file || null,
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
      projectId,
      type = 'labor'
    }: { 
      itemId: string; 
      costCode: string;
      projectId: string;
      type?: 'labor' | 'material';
    }) => {
      const updateData = type === 'material' 
        ? { material_cost_code: costCode }
        : { cost_code: costCode };
      
      const { data, error } = await supabase
        .from('estimate_items')
        .update(updateData)
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
// IMPORTANT: Uses row_number as the stable identifier (works regardless of ID type)
export const useBatchUpdateSystemCostCodes = (options?: { suppressInvalidate?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      system,
      laborCode,
      materialCode,
      itemUpdates
    }: { 
      projectId: string; 
      system: string;
      laborCode?: string;
      materialCode?: string;
      // Array of per-item updates using row_number (stable identifier)
      itemUpdates?: Array<{ row_number: number; cost_code?: string; material_cost_code?: string }>;
    }) => {
      // PRIMARY: Use row_number-based updates (works with both numeric and UUID IDs)
      if (itemUpdates && itemUpdates.length > 0) {
        // Process in batches to avoid overwhelming Supabase
        const BATCH_SIZE = 50;
        const results: EstimateItem[] = [];
        
        for (let i = 0; i < itemUpdates.length; i += BATCH_SIZE) {
          const batch = itemUpdates.slice(i, i + BATCH_SIZE);
          
          // Execute updates in parallel within each batch
          const batchResults = await Promise.all(
            batch.map(async (update) => {
              const updateData: { cost_code?: string; material_cost_code?: string } = {};
              if (update.cost_code) updateData.cost_code = update.cost_code;
              if (update.material_cost_code) updateData.material_cost_code = update.material_cost_code;
              
              if (Object.keys(updateData).length === 0) return null;
              
              // Use composite key: project_id + row_number (always works)
              const { data, error } = await supabase
                .from('estimate_items')
                .update(updateData)
                .eq('project_id', projectId)
                .eq('row_number', update.row_number)
                .select()
                .single();
              
              if (error) {
                console.error(`Failed to update item row ${update.row_number}:`, error);
                return null;
              }
              return data;
            })
          );
          
          results.push(...batchResults.filter(Boolean) as EstimateItem[]);
        }
        
        console.log(`[BatchUpdate] Successfully updated ${results.length}/${itemUpdates.length} items`);
        return results;
      }
      
      // Legacy fallback: update all items with same code (for simple cases)
      const updates: { cost_code?: string; material_cost_code?: string } = {};
      if (laborCode) updates.cost_code = laborCode;
      if (materialCode) updates.material_cost_code = materialCode;
      
      if (Object.keys(updates).length === 0) return [];
      
      const { data, error } = await supabase
        .from('estimate_items')
        .update(updates)
        .eq('project_id', projectId)
        .ilike('system', system)
        .select();

      if (error) throw error;
      return data as EstimateItem[];
    },
    onSuccess: (_, variables) => {
      if (!options?.suppressInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
      }
    },
  });
};

// Silent version that doesn't trigger estimate_items refetch
export const useBatchUpdateSystemCostCodesSilent = () => {
  return useBatchUpdateSystemCostCodes({ suppressInvalidate: true });
};

// Update applied status for a system mapping (also marks as verified)
export const useUpdateAppliedStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      systemName, 
      appliedItemCount 
    }: { 
      projectId: string; 
      systemName: string; 
      appliedItemCount: number;
    }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('system_mappings')
        .update({
          applied_at: now,
          applied_item_count: appliedItemCount,
          // Also mark as verified when applying
          is_verified: true,
          verified_at: now,
          verified_by: 'user',
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

// Batch update applied status for multiple system mappings (also marks as verified)
export const useBatchUpdateAppliedStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      systems 
    }: { 
      projectId: string; 
      systems: Array<{ systemName: string; appliedItemCount: number }>;
    }) => {
      const now = new Date().toISOString();
      
      // Update each system's applied status and mark as verified
      const updates = systems.map(async ({ systemName, appliedItemCount }) => {
        const { error } = await supabase
          .from('system_mappings')
          .update({
            applied_at: now,
            applied_item_count: appliedItemCount,
            // Also mark as verified when applying
            is_verified: true,
            verified_at: now,
            verified_by: 'user',
          })
          .eq('project_id', projectId)
          .eq('system_name', systemName.toLowerCase().trim());

        if (error) throw error;
      });

      await Promise.all(updates);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system_mappings', variables.projectId] });
    },
  });
};

// Batch update material cost codes for multiple items
export const useBatchUpdateMaterialCostCodes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      itemIds,
      materialCode
    }: { 
      projectId: string; 
      itemIds: string[];
      materialCode: string;
    }) => {
      if (itemIds.length === 0) return [];
      
      // Update in batches of 100
      const BATCH_SIZE = 100;
      const results: EstimateItem[] = [];
      
      for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
        const batchIds = itemIds.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('estimate_items')
          .update({ material_cost_code: materialCode })
          .eq('project_id', projectId)
          .in('id', batchIds)
          .select();

        if (error) throw error;
        if (data) results.push(...(data as EstimateItem[]));
      }
      
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
    },
  });
};

// Upsert mapping AND apply status in one operation - ensures auto-detected mappings get persisted
export const useUpsertAndApplyMapping = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      systemName, 
      costHead, 
      itemCount,
      autoSuggested = null
    }: { 
      projectId: string; 
      systemName: string; 
      costHead: string;
      itemCount: number;
      autoSuggested?: string | null;
    }) => {
      const normalizedSystem = systemName.toLowerCase().trim();
      const now = new Date().toISOString();
      
      // First check if record exists to preserve auto_suggested
      const { data: existing } = await supabase
        .from('system_mappings')
        .select('id, auto_suggested')
        .eq('project_id', projectId)
        .eq('system_name', normalizedSystem)
        .single();
      
      const upsertData = {
        project_id: projectId,
        system_name: normalizedSystem,
        cost_head: costHead,
        applied_at: now,
        applied_item_count: itemCount,
        is_verified: true,
        verified_at: now,
        verified_by: 'user',
        updated_at: now,
        // Only set auto_suggested if it's a new record OR not yet set
        ...(!existing || !existing.auto_suggested ? { auto_suggested: autoSuggested || costHead } : {})
      };
      
      const { data, error } = await supabase
        .from('system_mappings')
        .upsert([upsertData], {
          onConflict: 'project_id,system_name'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as SystemMapping;
    },
    onSuccess: () => {
      // Don't invalidate queries immediately - let the calling code handle state
      // This prevents the race condition where other applied systems get reset
    },
    onError: (error) => {
      console.error('Error upserting and applying mapping:', error);
    }
  });
};

// Dismiss items from material budget (for $0 value items)
export const useDismissFromMaterialBudget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      itemIds,
      dismissed = true
    }: { 
      projectId: string; 
      itemIds: string[];
      dismissed?: boolean;
    }) => {
      if (itemIds.length === 0) return [];
      
      // Update in batches of 100
      const BATCH_SIZE = 100;
      const results: EstimateItem[] = [];
      
      for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
        const batchIds = itemIds.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('estimate_items')
          .update({ excluded_from_material_budget: dismissed })
          .eq('project_id', projectId)
          .in('id', batchIds)
          .select();

        if (error) throw error;
        if (data) results.push(...(data as EstimateItem[]));
      }
      
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate_items', variables.projectId] });
    },
  });
};
