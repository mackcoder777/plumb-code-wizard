import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialCodeRule {
  id: string;
  project_id: string | null;
  name: string;
  priority: number;
  material_spec_contains: string | null;
  material_spec_equals: string | null;
  item_type_equals: string | null;
  item_type_contains: string | null;
  material_desc_contains: string | null;
  item_name_contains: string | null;
  material_cost_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMaterialCodeRuleInput {
  project_id?: string | null;
  name: string;
  priority?: number;
  material_spec_contains?: string | null;
  material_spec_equals?: string | null;
  item_type_equals?: string | null;
  item_type_contains?: string | null;
  material_desc_contains?: string | null;
  item_name_contains?: string | null;
  material_cost_code: string;
  is_active?: boolean;
}

export function useMaterialCodeRules(projectId?: string | null) {
  return useQuery({
    queryKey: ['material-code-rules', projectId],
    queryFn: async () => {
      let query = supabase
        .from('material_code_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (projectId) {
        // Get project-specific rules AND global rules
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
      } else {
        // Only global rules
        query = query.is('project_id', null);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as MaterialCodeRule[];
    },
    enabled: true,
  });
}

export function useCreateMaterialCodeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMaterialCodeRuleInput) => {
      const { data, error } = await supabase
        .from('material_code_rules')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['material-code-rules', variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ['material-code-rules'] });
    },
  });
}

export function useUpdateMaterialCodeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaterialCodeRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('material_code_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-code-rules'] });
    },
  });
}

export function useDeleteMaterialCodeRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_code_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-code-rules'] });
    },
  });
}

// Helper function to check if an item matches a rule
export function matchesRule(
  item: { 
    materialSpec?: string; 
    itemType?: string; 
    materialDesc?: string; 
    itemName?: string 
  }, 
  rule: MaterialCodeRule
): boolean {
  // All specified conditions must match (AND logic)
  
  if (rule.material_spec_contains) {
    if (!item.materialSpec?.toLowerCase().includes(rule.material_spec_contains.toLowerCase())) {
      return false;
    }
  }
  
  if (rule.material_spec_equals) {
    if (item.materialSpec?.toLowerCase() !== rule.material_spec_equals.toLowerCase()) {
      return false;
    }
  }
  
  if (rule.item_type_equals) {
    if (item.itemType?.toLowerCase() !== rule.item_type_equals.toLowerCase()) {
      return false;
    }
  }
  
  if (rule.item_type_contains) {
    if (!item.itemType?.toLowerCase().includes(rule.item_type_contains.toLowerCase())) {
      return false;
    }
  }
  
  if (rule.material_desc_contains) {
    if (!item.materialDesc?.toLowerCase().includes(rule.material_desc_contains.toLowerCase())) {
      return false;
    }
  }
  
  if (rule.item_name_contains) {
    if (!item.itemName?.toLowerCase().includes(rule.item_name_contains.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

// Apply rules to items - returns mapping of item ID to material code
export function applyRulesToItems(
  items: Array<{ 
    id: number | string;
    materialSpec?: string; 
    itemType?: string; 
    materialDesc?: string; 
    itemName?: string;
    materialCostCode?: string;
  }>,
  rules: MaterialCodeRule[],
  overwriteExisting = false
): Record<string, string> {
  const sortedRules = [...rules]
    .filter(r => r.is_active)
    .sort((a, b) => a.priority - b.priority);
  
  const mappings: Record<string, string> = {};
  
  for (const item of items) {
    // Skip if already has a code and not overwriting
    if (item.materialCostCode && !overwriteExisting) continue;
    
    // Find first matching rule
    for (const rule of sortedRules) {
      if (matchesRule(item, rule)) {
        mappings[String(item.id)] = rule.material_cost_code;
        break;
      }
    }
  }
  
  return mappings;
}
