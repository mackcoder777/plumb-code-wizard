import React, { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, startTransition } from 'react';
import { EstimateItem } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import { useLaborCodes } from '@/hooks/useCostCodes';
import { useSystemMappings, useUpdateAppliedStatus, useBatchUpdateAppliedStatus } from '@/hooks/useEstimateProjects';
import { useSystemIndex } from '@/hooks/useSystemIndex';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Search, Check, X, AlertCircle, LayoutGrid, Table as TableIcon, Layers, Loader2 } from 'lucide-react';
import { SystemMappingHeader } from './SystemMappingTab/SystemMappingHeader';
import { FilterCards } from './SystemMappingTab/FilterCards';
import { SystemCard } from './SystemMappingTab/SystemCard';
import { ItemTypeMappingCard } from './SystemMappingTab/ItemTypeMappingCard';
import { QuickActions } from './SystemMappingTab/QuickActions';
import { TableRowCombobox } from './SystemMappingTab/TableRowCombobox';
import { generateAllSuggestions, SuggestionResult } from './SystemMappingTab/autoSuggestLogic';
import { useVirtualizer } from '@tanstack/react-virtual';

interface SystemMappingTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
  onNavigateToEstimates?: (systemFilter: string) => void;
  projectId?: string | null;
  importedCostCodes?: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>;
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

export const SystemMappingTab: React.FC<SystemMappingTabProps> = ({ data, onDataUpdate, onNavigateToEstimates, projectId, importedCostCodes = [] }) => {
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
      setMappings(prev => {
        // If user has already made edits, keep those; otherwise use DB values
        const hasUserEdits = Object.keys(prev).length > 0;
        return hasUserEdits ? prev : mappingsFromDb;
      });
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
      laborCode: mappings[entry.system]?.laborCode,
      suggestedLaborCode: suggestions[entry.system]?.laborCode,
      appliedInfo: appliedSystems[entry.system],
    }));
  }, [systemIndex, mappings, suggestions, appliedSystems]);

  // Filter systems by search term and active filters - using deferred search
  // Note: When a specific system is selected from FilterCards, the text search should
  // NOT further filter (it would be redundant and cause "no results" issues)
  const filteredSystems = useMemo(() => {
    let filtered = systemMappings;

    // Apply system filter FIRST - if a specific system is selected, only show that one
    // and skip the text search filter (they're mutually exclusive in practice)
    if (activeSystemFilter) {
      filtered = filtered.filter(sm => sm.system === activeSystemFilter);
    } else if (deferredSearchTerm) {
      // Only apply text search if no system filter is active
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
  }, [systemMappings, deferredSearchTerm, activeStatusFilter, activeSystemFilter]);
  
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
    startTransition(() => {
      setMappings(prev => ({
        ...prev,
        [system]: {
          ...prev[system],
          [type]: value === 'none' ? undefined : value,
        }
      }));
    });
  }, []);

  const clearMapping = useCallback((system: string) => {
    setMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[system];
      return newMappings;
    });
    toast({
      title: "Mapping Cleared",
      description: `Removed mapping for ${system}`,
    });
  }, []);

  const clearAllMappings = useCallback(() => {
    setMappings({});
    setItemTypeMappings({});
    setSuggestions({});
    toast({
      title: "All Mappings Cleared",
      description: "All system mappings have been removed",
    });
  }, []);

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
        .map(sm => sm.system);
      
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
    const suggestion = suggestions[system];
    if (!suggestion) return;

    startTransition(() => {
      setMappings(prev => ({
        ...prev,
        [system]: {
          laborCode: suggestion.laborCode || prev[system]?.laborCode,
        }
      }));
    });

    toast({
      title: "Suggestion Applied",
      description: `Applied smart suggestion for ${system}`,
    });
  }, [suggestions]);

  const applyMappings = useCallback(() => {
    let itemsAffected = 0;
    const systemItemCounts: Record<string, number> = {};

    const updatedData = data.map(item => {
      const systemMapping = mappings[item.system];
      const itemTypeMapping = itemTypeMappings[item.system]?.[item.itemType];
      
      // Priority: Item type mapping > System mapping > Existing code
      let newLaborCode = item.costCode;
      let changed = false;
      
      if (itemTypeMapping?.laborCode && !item.costCode) {
        newLaborCode = itemTypeMapping.laborCode;
        changed = true;
      } else if (systemMapping?.laborCode && !item.costCode) {
        newLaborCode = systemMapping.laborCode;
        changed = true;
      }
      
      if (changed) {
        itemsAffected++;
        systemItemCounts[item.system] = (systemItemCounts[item.system] || 0) + 1;
        return { ...item, costCode: newLaborCode };
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
    
    const itemTypeMappingCount = Object.values(itemTypeMappings).reduce(
      (acc, systemItemTypes) => acc + Object.keys(systemItemTypes).length, 
      0
    );
    
    toast({
      title: "Mappings Applied Successfully",
      description: `Applied ${Object.keys(mappings).length} system mappings${itemTypeMappingCount > 0 ? ` and ${itemTypeMappingCount} item type overrides` : ''} to ${itemsAffected} items`,
    });
  }, [data, mappings, itemTypeMappings, projectId, batchUpdateAppliedStatus, onDataUpdate]);

  const applySystemMapping = useCallback((system: string) => {
    const systemMapping = mappings[system];
    if (!systemMapping) return;

    let itemsAffected = 0;
    const updatedData = data.map(item => {
      if (item.system !== system) return item;
      
      let newLaborCode = item.costCode;
      let changed = false;
      
      if (systemMapping.laborCode && !item.costCode) {
        newLaborCode = systemMapping.laborCode;
        changed = true;
      }
      
      if (changed) {
        itemsAffected++;
        return { ...item, costCode: newLaborCode };
      }
      return item;
    });

    // Track this system as applied
    setAppliedSystems(prev => ({
      ...prev,
      [system]: {
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

    onDataUpdate(updatedData);
    
    toast({
      title: "Mapping Applied",
      description: `Applied labor code for "${system}" to ${itemsAffected} items`,
    });
  }, [data, mappings, projectId, onDataUpdate, updateAppliedStatus]);

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
      {/* Progress Header */}
      <SystemMappingHeader stats={stats} totalItems={totalItems} />

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
              {/* Search Bar */}
              <div className="relative">
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

              {/* Card View - Virtualized single column */}
              {viewMode === 'cards' && (
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
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">System</th>
                          <th className="text-left p-3 font-medium">Labor Code</th>
                          <th className="text-right p-3 font-medium">Items</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-center p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredSystems.map((sm) => (
                          <tr key={sm.system} className="hover:bg-muted/30 transition-colors">
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

              {filteredSystems.length === 0 && !isProcessing && (
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
