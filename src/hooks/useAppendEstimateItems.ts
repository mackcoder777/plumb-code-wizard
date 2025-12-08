import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EstimateItem } from '@/types/estimate';

interface AppendItemsParams {
  projectId: string;
  items: EstimateItem[];
  sourceFile: string;
}

/**
 * Hook to APPEND items to existing project without deleting existing data
 * Use this when adding a second (or third, etc.) Excel file to a project
 */
export const useAppendEstimateItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, items, sourceFile }: AppendItemsParams) => {
      // 1. Get the current max row_number for this project
      const { data: existingItems, error: fetchError } = await supabase
        .from('estimate_items')
        .select('row_number')
        .eq('project_id', projectId)
        .order('row_number', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const startRowNumber = existingItems && existingItems.length > 0 
        ? (existingItems[0].row_number || 0) + 1 
        : 1;

      // 2. Prepare items with offset row numbers and source file
      const itemsToInsert = items.map((item, index) => ({
        project_id: projectId,
        row_number: startRowNumber + index,
        source_file: sourceFile,
        drawing: item.drawing || '',
        system: item.system || '',
        floor: item.floor || '',
        zone: item.zone || '',
        material_spec: item.materialSpec || '',
        item_type: item.itemType || '',
        trade: item.trade || '',
        material_desc: item.materialDesc || '',
        item_name: item.itemName || '',
        size: item.size || '',
        quantity: item.quantity || 0,
        list_price: item.listPrice || 0,
        material_dollars: item.materialDollars || 0,
        hours: item.hours || 0,
        labor_dollars: item.laborDollars || 0,
        cost_code: item.costCode || '',
        material_cost_code: item.materialCostCode || '',
        symbol: item.symbol || '',
        estimator: item.estimator || '',
        report_cat: item.reportCat || '',
      }));

      // 3. Insert in batches (Supabase has limits)
      const BATCH_SIZE = 500;
      for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
        const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('estimate_items')
          .insert(batch);

        if (insertError) throw insertError;
      }

      // 4. Update project metadata
      const { data: projectData } = await supabase
        .from('estimate_projects')
        .select('total_items, source_files')
        .eq('id', projectId)
        .single();

      const currentTotal = projectData?.total_items || 0;
      const currentFiles: string[] = (projectData?.source_files as string[]) || [];
      
      await supabase
        .from('estimate_projects')
        .update({
          total_items: currentTotal + items.length,
          source_files: [...currentFiles, sourceFile],
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      return { 
        inserted: items.length, 
        startRow: startRowNumber,
        totalItems: currentTotal + items.length 
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-items', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['estimate-projects'] });
    }
  });
};
