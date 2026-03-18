import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EstimateItem } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import { useLaborCodes } from '@/hooks/useCostCodes';
import { useSystemMappings, useUpdateAppliedStatus, useBatchUpdateAppliedStatus, useSaveMapping, useDeleteMapping, useBatchSaveMappings } from '@/hooks/useEstimateProjects';
import { useSystemIndex } from '@/hooks/useSystemIndex';
import { useMappingPatterns, useRecordMappingPattern, useBatchRecordMappingPatterns } from '@/hooks/useMappingPatterns';
import { useCategoryMappings, getLaborCodeFromCategory, isUsingSystemMapping } from '@/hooks/useCategoryMappings';
import { useCategoryKeywordRules, getLaborCodeFromKeywordRules } from '@/hooks/useCategoryKeywordRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Search, Check, X, AlertCircle, LayoutGrid, Table as TableIcon, Layers, Loader2, CheckSquare, Square, ChevronDown, Sparkles, ChevronRight, Activity } from 'lucide-react';
import { SystemMappingHeader } from './SystemMappingTab/SystemMappingHeader';
import { FilterCards } from './SystemMappingTab/FilterCards';
import { SystemCard } from './SystemMappingTab/SystemCard';
import { ItemTypeMappingCard } from './SystemMappingTab/ItemTypeMappingCard';
import { QuickActions } from './SystemMappingTab/QuickActions';
import { TableRowCombobox } from './SystemMappingTab/TableRowCombobox';
import { generateAllSuggestions, SuggestionResult } from './SystemMappingTab/autoSuggestLogic';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FloorSectionMappingPanel } from '@/components/FloorSectionMapping';
import { DatasetProfile } from '@/utils/datasetProfiler';
import { BuildingSectionMappingPanel } from '@/components/BuildingSectionMapping';
import { CategoryLaborMappingPanel } from '@/components/CategoryLaborMapping';
import { SystemActivityMappingPanel } from '@/components/SystemActivityMapping';
import { MappingAuditSummary } from '@/components/MappingAuditSummary';
import { FloorSectionMapping } from '@/hooks/useFloorSectionMappings';
import { SystemActivityMapping, getActivityFromSystem } from '@/hooks/useSystemActivityMappings';
import { BuildingSectionMapping, resolveFloorMappingStatic } from '@/hooks/useBuildingSectionMappings';

interface SystemMappingTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
  onNavigateToEstimates?: (systemFilter: string) => void;
  projectId?: string | null;
  floorSectionMappings?: FloorSectionMapping[];
  systemActivityMappings?: SystemActivityMapping[];
  buildingSectionMappings: BuildingSectionMapping[];
  onBuildingMappingsChanged?: () => void;
  importedCostCodes?: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>;
  datasetProfile?: DatasetProfile | null;
  onProfileOverride?: (override: any) => void;
  onReanalyzeProfile?: () => void;
  onUnappliedChangesUpdate?: (hasChanges: boolean) => void;
}

type ViewMode = 'cards' | 'table';

// Stable style objects to avoid breaking React.memo
const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
};

const getVirtualRowStyle = (start: number, size: number): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: size,
  transform: `translateY(${start}px)`,
});

const normalizeSystemKey = (system: string | null | undefined) => (system || 'Unknown').toLowerCase().trim();

export const SystemMappingTab: React.FC<SystemMappingTabProps> = ({ data, onDataUpdate, onNavigateToEstimates, projectId, floorSectionMappings = [], systemActivityMappings = [], buildingSectionMappings = [], onBuildingMappingsChanged, importedCostCodes = [], datasetProfile, onProfileOverride, onReanalyzeProfile, onUnappliedChangesUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mappings, setMappings] = useState<Record<string, { laborCode?: string }>>({});
  const [itemTypeMappings, setItemTypeMappings] = useState<Record<string, Record<string, { laborCode?: string }>>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionResult>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [enableItemTypeMappings, setEnableItemTypeMappings] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'mapped' | 'partial' | 'unmapped' | null>(null);
  const [activeSystemFilter, setActiveSystemFilter] = useState<string | null>(null);
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [isAutoSuggestLoading, setIsAutoSuggestLoading] = useState(false);
  const [appliedSystems, setAppliedSystems] = useState<Record<string, { appliedAt: Date; appliedItemCount: number; appliedLaborCode?: string; isVerified?: boolean }>>({});

  // Track unapplied changes
  const hasUnappliedChanges = useMemo(() => {
    return Object.keys(mappings).some(system => {
      const applied = appliedSystems[system];
      return mappings[system]?.laborCode && applied?.appliedLaborCode !== mappings[system]?.laborCode;
    });
  }, [mappings, appliedSystems]);

  useEffect(() => {
    onUnappliedChangesUpdate?.(hasUnappliedChanges);
  }, [hasUnappliedChanges, onUnappliedChangesUpdate]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnappliedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnappliedChanges]);

  const [selectedSystems, setSelectedSystems] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  
  // Floor section mapping state
  const [floorSectionOpen, setFloorSectionOpen] = useState(false);
  const [floorMappings, setFloorMappings] = useState<Record<string, string>>({});
  
  // Ref for virtualization container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use deferred value for search to keep UI responsive
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const isSearchStale = searchTerm !== deferredSearchTerm;

  // Use Web Worker-powered system index for large datasets
  const { systemIndex, isProcessing, getPreviewItems } = useSystemIndex(data);

  // Load system mappings from database to get applied status
  const { data: dbMappings = [] } = useSystemMappings(projectId);
  const updateAppliedStatus = useUpdateAppliedStatus();
  const batchUpdateAppliedStatus = useBatchUpdateAppliedStatus();
  const saveMapping = useSaveMapping();
  const deleteMapping = useDeleteMapping();
  const batchSaveMappings = useBatchSaveMappings();
  
  // Category labor mappings (priority over system mappings)
  const { data: categoryMappings = [] } = useCategoryMappings(projectId);
  
  // Keyword rules within categories (highest priority)
  const { data: keywordRules = [] } = useCategoryKeywordRules(projectId);
  
  // Learning system hooks
  const { data: mappingPatterns = [] } = useMappingPatterns();
  const recordMappingPattern = useRecordMappingPattern();
  const batchRecordMappingPatterns = useBatchRecordMappingPatterns();

  // Build suggestions from learned patterns only (actual user mappings)
  // Static keyword patterns are not used because they contain placeholder codes
  const learnedSuggestions = useMemo(() => {
    const suggestions: Record<string, { laborCode: string; confidence: number; usageCount: number; matchType: 'exact' | 'fuzzy' | 'keyword' }> = {};
    
    // Only build suggestions if we have learned patterns
    if (mappingPatterns.length === 0) return suggestions;
    
    for (const entry of systemIndex) {
      const normalizedName = normalizeSystemKey(entry.system);
      
      // Skip already mapped systems
      if (mappings[normalizedName]?.laborCode) continue;
      
      // Priority 1: Exact match from learned patterns
      const exactMatch = mappingPatterns.find(p => p.system_name_pattern === normalizedName);
      if (exactMatch) {
        suggestions[normalizedName] = {
          laborCode: exactMatch.labor_code,
          confidence: Math.min(0.95, 0.5 + (exactMatch.usage_count * 0.1)),
          usageCount: exactMatch.usage_count,
          matchType: 'exact',
        };
        continue;
      }
      
      // Priority 2: Fuzzy match from learned patterns
      const fuzzyMatches = mappingPatterns.filter(p => {
        const pattern = p.system_name_pattern;
        return normalizedName.includes(pattern) || pattern.includes(normalizedName);
      });
      
      if (fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches.sort((a, b) => b.usage_count - a.usage_count)[0];
        suggestions[normalizedName] = {
          laborCode: bestMatch.labor_code,
          confidence: Math.min(0.85, 0.3 + (bestMatch.usage_count * 0.05)),
          usageCount: bestMatch.usage_count,
          matchType: 'fuzzy',
        };
      }
    }
    
    return suggestions;
  }, [mappingPatterns, systemIndex, mappings]);

  // Initialize mappings and appliedSystems from database on load
  useEffect(() => {
    if (dbMappings.length > 0) {
      const appliedFromDb: Record<string, { appliedAt: Date; appliedItemCount: number; appliedLaborCode?: string; isVerified?: boolean }> = {};
      const mappingsFromDb: Record<string, { laborCode?: string }> = {};
      
      dbMappings.forEach(mapping => {
        // Restore labor code mappings
        if (mapping.cost_head) {
          mappingsFromDb[mapping.system_name] = {
            laborCode: mapping.cost_head,
          };
        }
        
        // Restore applied status
        if (mapping.applied_at) {
          appliedFromDb[mapping.system_name] = {
            appliedAt: new Date(mapping.applied_at),
            appliedItemCount: mapping.applied_item_count || 0,
            appliedLaborCode: mapping.cost_head || undefined,
            isVerified: mapping.is_verified || false,
          };
        }
      });
      
      // Only update if we have data from DB (don't overwrite user edits)
      setMappings(prev => ({ ...mappingsFromDb, ...prev }));
      setAppliedSystems(prev => ({ ...appliedFromDb, ...prev }));
    }
  }, [dbMappings]);

  // Load cost codes from database
  const { data: dbLaborCodes = [] } = useLaborCodes();

  // Merge database codes with hardcoded codes and imported codes
  const allLaborCodes = useMemo(() => {
    const hardcoded = COST_CODES_DB.fieldLabor;
    const imported = importedCostCodes
      .filter(c => c.category === 'L')
      .map(c => ({
        code: c.code,
        description: c.description,
        category: 'L' as const,
        keywords: [],
      }));
    const dbCodes = dbLaborCodes.map(c => ({
      code: c.code,
      description: c.description,
      category: 'L' as const,
      keywords: [],
    }));
    
    // Combine all sources and deduplicate by code
    const combined = [...hardcoded, ...imported, ...dbCodes];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [importedCostCodes, dbLaborCodes]);

  // Build system mappings from pre-computed index (very fast - just adds UI state)
  const systemMappings = useMemo(() => {
    return systemIndex.map(entry => ({
      system: entry.system,
      itemCount: entry.itemCount,
      laborCode: mappings[normalizeSystemKey(entry.system)]?.laborCode,
      suggestedLaborCode: suggestions[normalizeSystemKey(entry.system)]?.laborCode,
      appliedInfo: appliedSystems[normalizeSystemKey(entry.system)],
    }));
  }, [systemIndex, mappings, suggestions, appliedSystems]);

  // Filter systems by search term and active filters - using deferred search
  // Multi-select mode takes priority: when systems are selected via checkboxes, show only those
  const filteredSystems = useMemo(() => {
    let filtered = systemMappings;

    // PRIORITY 1: Multi-select mode - show only selected systems
    if (selectedSystems.size > 0) {
      filtered = filtered.filter(sm => selectedSystems.has(normalizeSystemKey(sm.system)));
    }
    // PRIORITY 2: Single system filter from clicking on a filter card
    else if (activeSystemFilter) {
      filtered = filtered.filter(sm => sm.system === activeSystemFilter);
    } 
    // PRIORITY 3: Text search filter
    else if (deferredSearchTerm) {
      const searchLower = deferredSearchTerm.toLowerCase();
      filtered = filtered.filter(sm => 
        sm.system.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (activeStatusFilter && activeStatusFilter !== 'all') {
      if (activeStatusFilter === 'mapped') {
        filtered = filtered.filter(sm => sm.laborCode);
      } else if (activeStatusFilter === 'unmapped') {
        filtered = filtered.filter(sm => !sm.laborCode);
      }
    }

    return filtered;
  }, [systemMappings, deferredSearchTerm, activeStatusFilter, activeSystemFilter, selectedSystems]);
  
  // Virtualization for cards view - increased overscan for smoother scrolling
  const rowVirtualizer = useVirtualizer({
    count: filteredSystems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 320,
    overscan: 5, // Render 5 extra items above/below for smoother scrolling
  });

  // Statistics
  const stats = useMemo(() => {
    const total = systemMappings.length;
    const mapped = systemMappings.filter(sm => sm.laborCode).length;
    const unmapped = total - mapped;

    return { total, mapped, partial: 0, unmapped };
  }, [systemMappings]);

  // Top systems for filter cards
  const topSystems = useMemo(() => {
    return systemMappings.map(sm => ({
      system: sm.system,
      itemCount: sm.itemCount,
      status: sm.laborCode ? 'mapped' as const : 'unmapped' as const,
    }));
  }, [systemMappings]);

  // Stable callback refs to avoid breaking React.memo
  const handleMappingChange = useCallback((system: string, type: 'laborCode', value: string) => {
    const systemKey = normalizeSystemKey(system);
    const newValue = value === 'none' ? undefined : value;
    
    startTransition(() => {
      setMappings(prev => {
        const next = { ...prev };
        if (!newValue) {
          delete next[systemKey];
          return next;
        }
        next[systemKey] = {
          ...next[systemKey],
          [type]: newValue,
        };
        return next;
      });
    });
    
    // Auto-save to database
    if (projectId && newValue) {
      saveMapping.mutate({
        projectId,
        systemName: system,
        costHead: newValue,
      });
    }
  }, [projectId, saveMapping]);

  const clearMapping = useCallback((system: string) => {
    const systemKey = normalizeSystemKey(system);
    setMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[systemKey];
      return newMappings;
    });

    if (projectId) {
      deleteMapping.mutate({ projectId, systemName: system });
    }
    toast({
      title: "Mapping Cleared",
      description: `Removed mapping for ${system}`,
    });
  }, [deleteMapping, projectId]);

  const clearAllMappings = useCallback(() => {
    setMappings({});
    setItemTypeMappings({});
    setSuggestions({});
    toast({
      title: "All Mappings Cleared",
      description: "All system mappings have been removed",
    });
  }, []);

  // Multi-select handlers
  const toggleSystemSelection = useCallback((system: string) => {
    const systemKey = normalizeSystemKey(system);
    setSelectedSystems(prev => {
      const next = new Set(prev);
      if (next.has(systemKey)) {
        next.delete(systemKey);
      } else {
        next.add(systemKey);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedSystems.size === filteredSystems.length) {
      setSelectedSystems(new Set());
    } else {
      setSelectedSystems(new Set(filteredSystems.map(sm => normalizeSystemKey(sm.system))));
    }
  }, [filteredSystems, selectedSystems.size]);

  const clearSelection = useCallback(() => {
    setSelectedSystems(new Set());
  }, []);

  const handleBulkAssign = useCallback((laborCode: string) => {
    if (selectedSystems.size === 0) return;
    
    const systemsToUpdate = Array.from(selectedSystems);
    const systemCount = systemsToUpdate.length;
    
    // Update local state
    startTransition(() => {
      setMappings(prev => {
        const next = { ...prev };
        systemsToUpdate.forEach(systemKey => {
          next[systemKey] = { laborCode };
        });
        return next;
      });
    });

    // Persist to database
    if (projectId) {
      batchSaveMappings.mutate({
        projectId,
        mappings: systemsToUpdate.map(systemKey => ({
          systemName: systemKey,
          costHead: laborCode,
        })),
      });
    }
    
    // Record patterns for learning system
    batchRecordMappingPatterns.mutate(
      systemsToUpdate.map(systemKey => ({
        systemName: systemKey,
        laborCode,
      }))
    );

    // Keep selection visible after assignment so user can see all mapped systems
    // Just close the popover, don't clear selection
    setBulkAssignOpen(false);
    
    // Clear the single-system filter to avoid confusion (multi-select takes priority)
    setActiveSystemFilter(null);
    
    toast({
      title: "Bulk Assignment Complete",
      description: `Assigned labor code to ${systemCount} systems. Selection maintained to show all mapped systems.`,
    });
  }, [selectedSystems, projectId, batchSaveMappings, batchRecordMappingPatterns]);

  const handleItemTypeMappingChange = useCallback((system: string, itemType: string, type: 'laborCode', value: string) => {
    startTransition(() => {
      setItemTypeMappings(prev => ({
        ...prev,
        [system]: {
          ...prev[system],
          [itemType]: {
            ...prev[system]?.[itemType],
            [type]: value === 'none' ? undefined : value,
          }
        }
      }));
    });
  }, []);

  const handleAutoSuggest = useCallback(() => {
    setIsAutoSuggestLoading(true);
    
    // Simulate processing time for better UX
    setTimeout(() => {
      const systemNames = systemMappings
        .filter(sm => !sm.laborCode) // Only suggest for unmapped systems
        .map(sm => normalizeSystemKey(sm.system));
      
      const newSuggestions = generateAllSuggestions(systemNames);
      setSuggestions(newSuggestions);
      
      const suggestionCount = Object.keys(newSuggestions).length;
      setIsAutoSuggestLoading(false);
      
      toast({
        title: "Smart Suggestions Generated",
        description: `Generated ${suggestionCount} suggestion${suggestionCount !== 1 ? 's' : ''} based on system names`,
      });
    }, 800);
  }, [systemMappings]);

  const applySystemSuggestions = useCallback((system: string) => {
    const systemKey = normalizeSystemKey(system);
    const suggestion = suggestions[systemKey];
    if (!suggestion) return;

    startTransition(() => {
      setMappings(prev => ({
        ...prev,
        [systemKey]: {
          laborCode: suggestion.laborCode || prev[systemKey]?.laborCode,
        }
      }));
    });

    toast({
      title: "Suggestion Applied",
      description: `Applied smart suggestion for ${system}`,
    });
  }, [suggestions]);

  // Helper to build full labor code with zone-aware section resolution
  const buildFullLaborCode = useCallback((costHead: string, item: { floor: string; drawing?: string; zone?: string; system?: string }): string => {
    const resolved = resolveFloorMappingStatic(item.floor || '', item.drawing || '', floorSectionMappings, buildingSectionMappings, { zone: item.zone, datasetProfile });
    const activity = resolved.activity !== '0000'
      ? resolved.activity
      : (item.system ? getActivityFromSystem(item.system, systemActivityMappings) : '0000');
    return `${resolved.section} ${activity} ${costHead}`;
  }, [floorSectionMappings, systemActivityMappings, buildingSectionMappings, datasetProfile]);

  // Handler to apply section codes to all items that already have labor codes
  // Also persists the updated codes to the database
  const handleApplySectionCodes = useCallback(async (floorMappingsToApply: Record<string, string>) => {
    let itemsUpdated = 0;
    const dbUpdates: Array<{ id: string; cost_code: string }> = [];
    
    const updatedData = data.map(item => {
      if (!item.costCode || !item.costCode.trim()) return item;
      
      // Parse existing code to extract the cost head (last part)
      // Format: "SECTION ACTIVITY COSTHEAD" or just "COSTHEAD"
      const parts = item.costCode.trim().split(/\s+/);
      let costHead = parts.length >= 3 ? parts[parts.length - 1] : parts[0];
      
      // Tier 0: Item-type override within category
      const itemTypeCode = getLaborCodeFromItemTypeOverride(item.reportCat || '', item.itemType || '', itemTypeOverrides);
      if (itemTypeCode) {
        costHead = itemTypeCode;
      } else {
        // Tier 1: Check if category has a specific mapping that should override the costHead
        const categoryLaborCode = getLaborCodeFromCategory(item.reportCat, categoryMappings);
        if (categoryLaborCode) {
          costHead = categoryLaborCode;
        }
      }
      
      // Get new section and activity from zone-aware resolver
      const resolved = resolveFloorMappingStatic(item.floor || '', item.drawing || '', floorSectionMappings, buildingSectionMappings, { zone: item.zone, datasetProfile });
      
      // Build new full code with floor activity priority over system activity
      const activityCode = resolved.activity !== '0000'
        ? resolved.activity
        : getActivityFromSystem(item.system, systemActivityMappings);
      const newFullCode = `${resolved.section} ${activityCode} ${costHead}`;
      
      if (newFullCode !== item.costCode) {
        itemsUpdated++;
        dbUpdates.push({ id: String(item.id), cost_code: newFullCode });
        return { ...item, costCode: newFullCode };
      }
      return item;
    });

    if (itemsUpdated > 0) {
      onDataUpdate(updatedData);
      
      // Persist to database in chunks of 500
      const CHUNK_SIZE = 500;
      try {
        for (let i = 0; i < dbUpdates.length; i += CHUNK_SIZE) {
          const chunk = dbUpdates.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(({ id, cost_code }) =>
              supabase
                .from('estimate_items')
                .update({ cost_code })
                .eq('id', id)
            )
          );
        }
        console.log(`[ReapplySections] Persisted ${dbUpdates.length} updated codes to database`);
      } catch (err) {
        console.error('[ReapplySections] Failed to persist:', err);
      }
    }
    
    toast({
      title: 'Section Codes Re-applied',
      description: `Updated ${itemsUpdated} of ${data.filter(i => i.costCode).length} coded items.`,
    });
    
    return itemsUpdated;
  }, [data, categoryMappings, itemTypeOverrides, floorSectionMappings, systemActivityMappings, buildingSectionMappings, datasetProfile, onDataUpdate]);

  const applyMappings = useCallback(() => {
    let itemsAffected = 0;
    let categoryAssignments = 0;
    let systemAssignments = 0;
    const systemItemCounts: Record<string, number> = {};

    const updatedData = data.map(item => {
      const systemKey = normalizeSystemKey(item.system);
      const systemMapping = mappings[systemKey];
      const itemTypeMapping = itemTypeMappings[item.system]?.[item.itemType];
      
      // Priority: Item-Type Override > Category Mapping > System Mapping > Item Type Mapping
      let costHead: string | undefined;
      let changed = false;
      let assignmentSource: 'item-type-override' | 'category' | 'system' | 'itemType' | null = null;
      
      // Tier 0: Item-type override within category (highest priority)
      const itemTypeCode = getLaborCodeFromItemTypeOverride(item.reportCat || '', item.itemType || '', itemTypeOverrides);
      if (itemTypeCode) {
        const existingParts = item.costCode?.trim().split(/\s+/) || [];
        const existingCostHead = existingParts.length >= 1 ? existingParts[existingParts.length - 1] : '';
        if (existingCostHead !== itemTypeCode) {
          costHead = itemTypeCode;
          changed = true;
          assignmentSource = 'item-type-override';
        }
      }
      // Tier 1: Check category mapping (highest priority after item-type override)
      // Category mappings ALWAYS override existing codes (they take precedence)
      else {
        const categoryLaborCode = getLaborCodeFromCategory(item.reportCat, categoryMappings);
        if (categoryLaborCode) {
          const existingParts = item.costCode?.trim().split(/\s+/) || [];
          const existingCostHead = existingParts.length >= 1 ? existingParts[existingParts.length - 1] : '';
          if (existingCostHead !== categoryLaborCode) {
            costHead = categoryLaborCode;
            changed = true;
            assignmentSource = 'category';
          }
        }
        // Tier 2: Fall back to system mapping
        else if (systemMapping?.laborCode) {
          const existingParts = item.costCode?.trim().split(/\s+/) || [];
          const existingCostHead = existingParts.length >= 1 ? existingParts[existingParts.length - 1] : '';
          if (existingCostHead !== systemMapping.laborCode) {
            costHead = systemMapping.laborCode;
            changed = true;
            assignmentSource = 'system';
          }
        }
        // Tier 3: Fall back to item type mapping (only for items without codes)
        else if (itemTypeMapping?.laborCode && !item.costCode) {
          costHead = itemTypeMapping.laborCode;
          changed = true;
          assignmentSource = 'itemType';
        }
      }
      
      if (changed && costHead) {
        itemsAffected++;
        if (assignmentSource === 'category') categoryAssignments++;
        if (assignmentSource === 'system') systemAssignments++;
        systemItemCounts[systemKey] = (systemItemCounts[systemKey] || 0) + 1;
        const fullCode = buildFullLaborCode(costHead, { floor: item.floor || '', drawing: item.drawing, zone: item.zone, system: item.system });
        return { ...item, costCode: fullCode };
      }
      return item;
    });

    // Track which systems were applied
    const newAppliedSystems: Record<string, { appliedAt: Date; appliedItemCount: number; appliedLaborCode?: string }> = {};
    const systemsToUpdate: Array<{ systemName: string; appliedItemCount: number }> = [];
    
    Object.keys(mappings).forEach(system => {
      if (systemItemCounts[system] || mappings[system]?.laborCode) {
        newAppliedSystems[system] = {
          appliedAt: new Date(),
          appliedItemCount: systemItemCounts[system] || 0,
          appliedLaborCode: mappings[system]?.laborCode,
        };
        systemsToUpdate.push({
          systemName: system,
          appliedItemCount: systemItemCounts[system] || 0,
        });
      }
    });
    setAppliedSystems(prev => ({ ...prev, ...newAppliedSystems }));

    // Persist to database if we have a project
    if (projectId && systemsToUpdate.length > 0) {
      batchUpdateAppliedStatus.mutate({ projectId, systems: systemsToUpdate });
    }

    onDataUpdate(updatedData);
    
    const categoryMappingCount = categoryMappings.filter(m => !isUsingSystemMapping(m.labor_code)).length;
    const itemTypeMappingCount = Object.values(itemTypeMappings).reduce(
      (acc, systemItemTypes) => acc + Object.keys(systemItemTypes).length, 
      0
    );
    
    // Build description parts
    const descParts: string[] = [];
    if (categoryAssignments > 0) descParts.push(`${categoryAssignments} by category`);
    if (systemAssignments > 0) descParts.push(`${systemAssignments} by system`);
    
    toast({
      title: "Mappings Applied Successfully",
      description: `Applied to ${itemsAffected} items${descParts.length > 0 ? ` (${descParts.join(', ')})` : ''}`,
    });
  }, [data, mappings, itemTypeMappings, categoryMappings, itemTypeOverrides, projectId, batchUpdateAppliedStatus, onDataUpdate, buildFullLaborCode]);

  const applySystemMapping = useCallback((system: string) => {
    const systemKey = normalizeSystemKey(system);
    const systemMapping = mappings[systemKey];
    if (!systemMapping) return;

    let itemsAffected = 0;
    const updatedData = data.map(item => {
      if (normalizeSystemKey(item.system) !== systemKey) return item;
      
      // Tier 0: Item-type override within category
      const itemTypeCode = getLaborCodeFromItemTypeOverride(item.reportCat || '', item.itemType || '', itemTypeOverrides);
      
      // Determine the cost head to use
      let costHead: string | undefined;
      
      if (itemTypeCode) {
        const existingParts = item.costCode?.trim().split(/\s+/) || [];
        const existingCostHead = existingParts.length >= 1 ? existingParts[existingParts.length - 1] : '';
        if (existingCostHead !== itemTypeCode) {
          costHead = itemTypeCode;
        }
      } else {
        // Check if category has a specific mapping (not deferred to system)
        const categoryLaborCode = getLaborCodeFromCategory(item.reportCat, categoryMappings);
        
        if (categoryLaborCode) {
          // Category mapping takes priority and can OVERRIDE existing codes
          const existingParts = item.costCode?.trim().split(/\s+/) || [];
          const existingCostHead = existingParts.length >= 1 ? existingParts[existingParts.length - 1] : '';
          if (existingCostHead !== categoryLaborCode) {
            costHead = categoryLaborCode;
          }
        } else if (systemMapping.laborCode) {
          const existingParts2 = item.costCode?.trim().split(/\s+/) || [];
          const existingCostHead2 = existingParts2.length >= 1 ? existingParts2[existingParts2.length - 1] : '';
          if (existingCostHead2 !== systemMapping.laborCode) {
            costHead = systemMapping.laborCode;
          }
        }
      }
      
      if (costHead) {
        itemsAffected++;
        const fullCode = buildFullLaborCode(costHead, { floor: item.floor || '', drawing: item.drawing, zone: item.zone, system: item.system });
        return { ...item, costCode: fullCode };
      }
      return item;
    });

    // Track this system as applied
    setAppliedSystems(prev => ({
      ...prev,
      [systemKey]: {
        appliedAt: new Date(),
        appliedItemCount: itemsAffected,
        appliedLaborCode: systemMapping.laborCode,
      }
    }));

    // Persist to database if we have a project
    if (projectId) {
      updateAppliedStatus.mutate({ 
        projectId, 
        systemName: system, 
        appliedItemCount: itemsAffected 
      });
    }
    
    // Record pattern for learning system
    if (systemMapping.laborCode) {
      recordMappingPattern.mutate({
        systemName: system,
        laborCode: systemMapping.laborCode,
      });
    }

    onDataUpdate(updatedData);
    
    toast({
      title: "Mapping Applied",
      description: `Applied labor code for "${system}" to ${itemsAffected} items`,
    });
  }, [data, mappings, categoryMappings, itemTypeOverrides, projectId, onDataUpdate, updateAppliedStatus, recordMappingPattern, buildFullLaborCode]);

  // Handler to accept a suggestion from the filter cards
  const handleAcceptSuggestion = useCallback((system: string, laborCode: string) => {
    const systemKey = normalizeSystemKey(system);
    
    // Update local state
    startTransition(() => {
      setMappings(prev => ({
        ...prev,
        [systemKey]: { laborCode },
      }));
    });
    
    // Auto-save to database
    if (projectId) {
      saveMapping.mutate({
        projectId,
        systemName: system,
        costHead: laborCode,
      });
    }
    
    toast({
      title: "Suggestion Accepted",
      description: `Applied suggested code "${laborCode}" to ${system}`,
    });
  }, [projectId, saveMapping]);

  const getStatusBadge = useCallback((sm: typeof systemMappings[0]) => {
    if (sm.laborCode) {
      return <Badge className="bg-success text-success-foreground"><Check className="w-3 h-3 mr-1" /> Mapped</Badge>;
    }
    return <Badge variant="outline">Unmapped</Badge>;
  }, []);

  const totalItems = data.length;
  const hasMappings = Object.keys(mappings).length > 0 || Object.keys(itemTypeMappings).length > 0;

  // Memoized handler creators to avoid breaking React.memo on cards
  const createLaborCodeChangeHandler = useCallback((system: string) => {
    return (value: string) => handleMappingChange(system, 'laborCode', value);
  }, [handleMappingChange]);

  const createClearHandler = useCallback((system: string) => {
    return () => clearMapping(system);
  }, [clearMapping]);

  const createApplySuggestionsHandler = useCallback((system: string) => {
    return () => applySystemSuggestions(system);
  }, [applySystemSuggestions]);

  const createApplyMappingHandler = useCallback((system: string) => {
    return () => applySystemMapping(system);
  }, [applySystemMapping]);

  return (
    <div className="space-y-6">
      {hasUnappliedChanges && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-6 py-3 text-amber-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>⚠️</span>
            <span>You have unapplied mapping changes. Click "Apply All Mappings" before leaving this tab.</span>
          </div>
          <Button
            size="sm"
            onClick={applyMappings}
            className="shrink-0 bg-amber-500 text-white hover:bg-amber-600"
          >
            Apply All Now
          </Button>
        </div>
      )}
      {/* Progress Header */}
      <SystemMappingHeader stats={stats} totalItems={totalItems} />

      {/* Mapping Audit Summary - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              📊 Mapping Audit Summary
              <Badge variant="outline" className="ml-2 text-xs">
                {stats.mapped}/{stats.total} systems | {data.filter(i => i.costCode).length}/{data.length} items coded
              </Badge>
            </div>
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <MappingAuditSummary
            estimateData={data}
            systemMappings={Object.fromEntries(
              Object.entries(mappings).map(([k, v]) => [k, v.laborCode || ''])
            )}
            categoryMappings={categoryMappings}
            floorMappings={floorMappings}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Floor to Section Mapping - Collapsible */}
      <Collapsible open={floorSectionOpen} onOpenChange={setFloorSectionOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Section Mapping
            </div>
            <ChevronRight className={cn("h-4 w-4 transition-transform", floorSectionOpen && "rotate-90")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <FloorSectionMappingPanel
            estimateData={data}
            projectId={projectId}
            onMappingsChange={setFloorMappings}
            onApplySectionCodes={handleApplySectionCodes}
            datasetProfile={datasetProfile}
            onProfileOverride={onProfileOverride}
            onReanalyze={onReanalyzeProfile}
            buildingMappings={buildingSectionMappings}
            onBuildingMappingsChanged={onBuildingMappingsChanged}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Building to Section Mapping - Hidden (functionality covered by Section Mapping panel) */}
      {false && projectId && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Building → Section Code (Drawing-based)
              </div>
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <BuildingSectionMappingPanel
              projectId={projectId}
              estimateItems={data}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* System to Activity Mapping - Collapsible (closed by default) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2 text-left">
              <Activity className="h-4 w-4 shrink-0" />
              <div>
                <span>System to Activity Mapping</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">Optional: override activity codes per system. Only needed when systems on the same floor require different activity codes.</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <SystemActivityMappingPanel
            estimateData={data}
            projectId={projectId || null}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Category Labor Mapping Panel */}
      <CategoryLaborMappingPanel
        data={data}
        projectId={projectId || null}
      />

      {/* Main Content with Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Filter Cards */}
          <FilterCards
            stats={stats}
            activeStatusFilter={activeStatusFilter}
            onStatusFilterChange={setActiveStatusFilter}
            topSystems={topSystems}
            activeSystemFilter={activeSystemFilter}
            onSystemFilterChange={setActiveSystemFilter}
            showAllSystems={showAllSystems}
            onToggleShowAllSystems={() => setShowAllSystems(!showAllSystems)}
            selectedSystems={selectedSystems}
            onToggleSystemSelection={toggleSystemSelection}
            onBulkAssign={handleBulkAssign}
            onClearSelection={clearSelection}
            laborCodes={allLaborCodes}
            suggestions={learnedSuggestions}
            onAcceptSuggestion={handleAcceptSuggestion}
          />


          {/* System Mapping Content */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Labor Code Mapping</CardTitle>
                  <CardDescription>
                    Assign labor codes to each system (Material codes are assigned separately by Item Type)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="item-type-mode"
                      checked={enableItemTypeMappings}
                      onCheckedChange={setEnableItemTypeMappings}
                    />
                    <Label htmlFor="item-type-mode" className="text-sm flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      Item Type Overrides
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('cards')}
                    >
                      <LayoutGrid className="w-4 h-4 mr-2" />
                      Cards
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                    >
                      <TableIcon className="w-4 h-4 mr-2" />
                      Table
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar + Multi-Select Controls */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search systems..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn("pl-9", isSearchStale && "opacity-70")}
                  />
                  {isSearchStale && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                {/* Multi-Select Toggle */}
                <Button
                  variant={selectedSystems.size > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSelectAll}
                  className="shrink-0"
                >
                  {selectedSystems.size === filteredSystems.length && filteredSystems.length > 0 ? (
                    <>
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Select All ({filteredSystems.length})
                    </>
                  )}
                </Button>
              </div>

              {/* Multi-Select Consolidated View */}
              {selectedSystems.size > 0 && (
                <div className="border-2 border-primary/30 rounded-lg overflow-hidden animate-in slide-in-from-top-2 bg-primary/5">
                  {/* Header with bulk action */}
                  <div className="flex items-center justify-between gap-4 p-4 bg-primary/10 border-b border-primary/20">
                    <div className="flex items-center gap-3">
                      <Badge className="font-semibold text-base px-3 py-1">
                        {selectedSystems.size} systems selected
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        <X className="w-4 h-4 mr-1" />
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                  
                  {/* Selected Systems Summary */}
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredSystems.map((sm) => (
                        <div 
                          key={sm.system}
                          className="flex items-center justify-between p-3 bg-background rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={true}
                              onCheckedChange={() => toggleSystemSelection(sm.system)}
                            />
                            <span className="font-medium text-sm">{sm.system}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {sm.itemCount} items
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    {/* Total Items Summary */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">Total Items</span>
                      <span className="text-lg font-bold tabular-nums">
                        {filteredSystems.reduce((sum, sm) => sum + sm.itemCount, 0).toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Single Labor Code Assignment */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Assign Labor Code to All Selected Systems</Label>
                      <Popover open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-12 text-left">
                            <span className="text-muted-foreground">Select a labor code to apply...</span>
                            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search labor codes..." />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>No code found.</CommandEmpty>
                              <CommandGroup>
                                {allLaborCodes.map((code) => (
                                  <CommandItem
                                    key={code.code}
                                    value={`${code.code} ${code.description}`}
                                    onSelect={() => handleBulkAssign(code.code)}
                                  >
                                    <span className="font-mono text-xs mr-2">{code.code}</span>
                                    <span className="truncate">{code.description}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              )}

              {/* Card View - Virtualized single column (hidden when multi-select active) */}
              {viewMode === 'cards' && selectedSystems.size === 0 && (
                <>
                  {isProcessing && (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing {data.length.toLocaleString()} items...</span>
                    </div>
                  )}
                  {!isProcessing && filteredSystems.length > 0 && (
                    <div 
                      ref={scrollContainerRef}
                      className="h-[600px] overflow-auto"
                    >
                      <div
                        style={{
                          ...containerStyle,
                          height: rowVirtualizer.getTotalSize(),
                        }}
                      >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const sm = filteredSystems[virtualRow.index];
                          const rowStyle = getVirtualRowStyle(virtualRow.start, virtualRow.size);
                          
                          return (
                            <div
                              key={sm.system}
                              style={rowStyle}
                              className="pb-4"
                            >
                              <div className="flex gap-3 items-start">
                                {/* Checkbox for multi-select */}
                                <div className="pt-4">
                                  <Checkbox
                                    checked={selectedSystems.has(normalizeSystemKey(sm.system))}
                                    onCheckedChange={() => toggleSystemSelection(sm.system)}
                                  />
                                </div>
                                <div className="flex-1">
                                  {enableItemTypeMappings ? (
                                    <ItemTypeMappingCard
                                      system={sm.system}
                                      itemCount={sm.itemCount}
                                      items={[]} // Pass empty - items loaded lazily inside component
                                      systemLaborCode={sm.laborCode}
                                      itemTypeMappings={itemTypeMappings[sm.system] || {}}
                                      onSystemLaborCodeChange={createLaborCodeChangeHandler(sm.system)}
                                      onItemTypeMappingChange={(itemType, type, value) => handleItemTypeMappingChange(sm.system, itemType, type, value)}
                                      laborCodes={allLaborCodes}
                                    />
                                  ) : (
                                    <SystemCard
                                      system={sm.system}
                                      itemCount={sm.itemCount}
                                      laborCode={sm.laborCode}
                                      suggestedLaborCode={sm.suggestedLaborCode}
                                      appliedInfo={sm.appliedInfo}
                                      onLaborCodeChange={createLaborCodeChangeHandler(sm.system)}
                                      onClear={createClearHandler(sm.system)}
                                      onApplySuggestions={createApplySuggestionsHandler(sm.system)}
                                      onApplySystemMapping={createApplyMappingHandler(sm.system)}
                                      onViewAllItems={onNavigateToEstimates}
                                      importedCostCodes={importedCostCodes}
                                      getPreviewItems={getPreviewItems}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Table View (hidden when multi-select active) */}
              {viewMode === 'table' && selectedSystems.size === 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="w-10 p-3">
                            <Checkbox
                              checked={selectedSystems.size === filteredSystems.length && filteredSystems.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th className="text-left p-3 font-medium">System</th>
                          <th className="text-left p-3 font-medium">Labor Code</th>
                          <th className="text-right p-3 font-medium">Items</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-center p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredSystems.map((sm) => (
                          <tr 
                            key={sm.system} 
                            className={cn(
                              "hover:bg-muted/30 transition-colors",
                              selectedSystems.has(normalizeSystemKey(sm.system)) && "bg-primary/5"
                            )}
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selectedSystems.has(normalizeSystemKey(sm.system))}
                                onCheckedChange={() => toggleSystemSelection(sm.system)}
                              />
                            </td>
                            <td className="p-3 font-medium">{sm.system}</td>
                            
                            <td className="p-3">
                              <TableRowCombobox
                                value={sm.laborCode}
                                options={allLaborCodes}
                                placeholder="Select labor code..."
                                onValueChange={createLaborCodeChangeHandler(sm.system)}
                              />
                            </td>
                            
                            <td className="p-3 text-right tabular-nums font-medium">{sm.itemCount}</td>
                            <td className="p-3 text-center">{getStatusBadge(sm)}</td>
                            <td className="p-3 text-center">
                              {sm.laborCode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={createClearHandler(sm.system)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {filteredSystems.length === 0 && !isProcessing && selectedSystems.size === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">No systems found</p>
                  <p className="text-sm mt-1">
                    {searchTerm || activeStatusFilter || activeSystemFilter
                      ? 'Try adjusting your filters or search term'
                      : 'Upload a file to get started'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="lg:col-span-1">
          <QuickActions
            hasMappings={hasMappings}
            mappedCount={stats.mapped}
            totalCount={stats.total}
            onAutoSuggest={handleAutoSuggest}
            onApplyAll={applyMappings}
            isAutoSuggestLoading={isAutoSuggestLoading}
          />
        </div>
      </div>
    </div>
  );
};
