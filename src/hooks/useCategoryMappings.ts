import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import {
  CategoryMaterialDescOverride,
  getLaborCodeFromMaterialDesc,
} from '@/hooks/useCategoryMaterialDescOverrides';

// Special value indicating category should use system mapping
export const SYSTEM_MAPPING_VALUE = '__SYSTEM__';

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
  topSystems: Array<{ system: string; count: number; hours: number }>;
  topMaterialDescs: Array<{ desc: string; count: number }>;
  systemCount: number;
  descCount: number;
}

/**
 * Check if a labor code value indicates "use system mapping"
 */
export function isUsingSystemMapping(laborCode: string | undefined | null): boolean {
  return laborCode === SYSTEM_MAPPING_VALUE;
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
    // Group items by category
    const categoryItems = new Map<string, EstimateItem[]>();
    
    for (const item of data) {
      const category = item.reportCat || 'Unknown';
      if (!categoryItems.has(category)) {
        categoryItems.set(category, []);
      }
      categoryItems.get(category)!.push(item);
    }
    
    return Array.from(categoryItems.entries())
      .map(([category, items]) => {
        const itemCount = items.length;
        const totalHours = items.reduce((sum, item) => sum + (item.hours || 0), 0);

        // Compute system distribution
        const systemMap = new Map<string, { count: number; hours: number }>();
        const descMap = new Map<string, number>();

        for (const item of items) {
          const sys = item.system || 'Unknown';
          const existing = systemMap.get(sys) ?? { count: 0, hours: 0 };
          systemMap.set(sys, {
            count: existing.count + 1,
            hours: existing.hours + (item.hours || 0),
          });

          const desc = item.materialDesc || 'Unknown';
          descMap.set(desc, (descMap.get(desc) ?? 0) + 1);
        }

        const topSystems = [...systemMap.entries()]
          .map(([system, d]) => ({ system, ...d }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 5);

        const topMaterialDescs = [...descMap.entries()]
          .map(([desc, count]) => ({ desc, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          category,
          itemCount,
          totalHours,
          topSystems,
          topMaterialDescs,
          systemCount: systemMap.size,
          descCount: descMap.size,
        };
      })
      .filter(entry => entry.totalHours > 0)
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [data]);
}

/**
 * Get labor code for a category from mappings
 * Returns null if no mapping exists OR if mapping is __SYSTEM__ (defer to system)
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
  
  if (exactMatch) {
    // If it's the system mapping sentinel, return null to defer to system mapping
    if (isUsingSystemMapping(exactMatch.labor_code)) {
      return null;
    }
    return exactMatch.labor_code;
  }
  
  return null;
}

// ============================================================================
// Shared labor-head resolution (single source of truth)
//
// Every consumer of the assignment hierarchy MUST use these exports:
//   - SystemMappingTab: applyMappings, applySystemMapping,
//     handleApplySectionCodes, and the hasUnappliedChanges banner memo.
// Defining a local copy of this chain inside a component is the drift these
// exports exist to prevent (same rule as computeGcFabCont / computeGcFldCont).
//
// PM AUTHORITY: this resolver has NO hardcoded defaults. Every tier reads
// PM-authored, project-scoped database rows. It returns null when nothing is
// mapped — it never guesses a cost head.
// ============================================================================

export const normalizeSystemKey = (system: string | null | undefined): string =>
  (system || 'Unknown').toLowerCase().trim();

export type SystemLaborMappings = Record<string, { laborCode?: string }>;

export type LaborHeadSource = 'material-desc' | 'category' | 'system';

export interface ResolvedLaborHead {
  head: string | null;
  source: LaborHeadSource | null;
}

/**
 * Extract the cost-head token from a full cost code.
 * Handles "SEC ACT HEAD" and a bare "HEAD". Returns null (never '') for an
 * uncoded item so callers can distinguish "no code" from "wrong code".
 */
export function parseCostHead(costCode: string | null | undefined): string | null {
  const trimmed = (costCode || '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || null;
}

/**
 * Resolve the labor cost head an item SHOULD carry, following the hierarchy:
 *   Tier 0  material description override (within category)
 *   Tier 1  category labor mapping
 *   Tier 2  system mapping                (skipped when includeSystem = false)
 *
 * Pure. No item-type tier here — that tier is conditional on the item having no
 * code at all and stays at the call site.
 */
export function resolveExpectedLaborHead(
  item: Pick<EstimateItem, 'system' | 'reportCat' | 'materialDesc'>,
  systemMappings: SystemLaborMappings,
  categoryMappings: CategoryLaborMapping[],
  materialDescOverrides: CategoryMaterialDescOverride[],
  options: { includeSystem?: boolean } = {}
): ResolvedLaborHead {
  const { includeSystem = true } = options;

  // Tier 0
  const materialDescCode = getLaborCodeFromMaterialDesc(
    item.reportCat || '',
    item.materialDesc || '',
    materialDescOverrides
  );
  if (materialDescCode) {
    return { head: materialDescCode, source: 'material-desc' };
  }

  // Tier 1
  const categoryLaborCode = getLaborCodeFromCategory(item.reportCat, categoryMappings);
  if (categoryLaborCode) {
    return { head: categoryLaborCode, source: 'category' };
  }

  // Tier 2
  if (includeSystem) {
    const systemLaborCode = systemMappings[normalizeSystemKey(item.system)]?.laborCode;
    if (systemLaborCode) {
      return { head: systemLaborCode, source: 'system' };
    }
  }

  return { head: null, source: null };
}
