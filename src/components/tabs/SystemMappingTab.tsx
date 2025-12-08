import React, { useState, useMemo, useEffect } from 'react';
import { EstimateItem } from '@/types/estimate';
import { COST_CODES_DB } from '@/data/costCodes';
import { useMaterialCodes, useLaborCodes } from '@/hooks/useCostCodes';
import { useSystemMappings, useUpdateAppliedStatus, useBatchUpdateAppliedStatus } from '@/hooks/useEstimateProjects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Search, Check, X, AlertCircle, LayoutGrid, Table as TableIcon, Layers } from 'lucide-react';
import { SystemMappingHeader } from './SystemMappingTab/SystemMappingHeader';
import { FilterCards } from './SystemMappingTab/FilterCards';
import { SystemCard } from './SystemMappingTab/SystemCard';
import { ItemTypeMappingCard } from './SystemMappingTab/ItemTypeMappingCard';
import { QuickActions } from './SystemMappingTab/QuickActions';
import { TableRowCombobox } from './SystemMappingTab/TableRowCombobox';
import { generateAllSuggestions, SuggestionResult } from './SystemMappingTab/autoSuggestLogic';

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

export const SystemMappingTab: React.FC<SystemMappingTabProps> = ({ data, onDataUpdate, onNavigateToEstimates, projectId, importedCostCodes = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mappings, setMappings] = useState<Record<string, { materialCode?: string; laborCode?: string }>>({});
  const [itemTypeMappings, setItemTypeMappings] = useState<Record<string, Record<string, { materialCode?: string; laborCode?: string }>>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionResult>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [enableItemTypeMappings, setEnableItemTypeMappings] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'mapped' | 'partial' | 'unmapped' | null>(null);
  const [activeSystemFilter, setActiveSystemFilter] = useState<string | null>(null);
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [isAutoSuggestLoading, setIsAutoSuggestLoading] = useState(false);
  const [appliedSystems, setAppliedSystems] = useState<Record<string, { appliedAt: Date; itemCount: number; appliedMaterialCode?: string; appliedLaborCode?: string }>>({});

  // Load system mappings from database to get applied status
  const { data: dbMappings = [] } = useSystemMappings(projectId);
  const updateAppliedStatus = useUpdateAppliedStatus();
  const batchUpdateAppliedStatus = useBatchUpdateAppliedStatus();

  // Initialize appliedSystems from database on load
  useEffect(() => {
    if (dbMappings.length > 0) {
      const appliedFromDb: Record<string, { appliedAt: Date; itemCount: number; appliedMaterialCode?: string; appliedLaborCode?: string }> = {};
      dbMappings.forEach(mapping => {
        if (mapping.applied_at) {
          // Parse cost_head which may contain both codes in format "material|labor"
          const codes = mapping.cost_head.split('|');
          appliedFromDb[mapping.system_name] = {
            appliedAt: new Date(mapping.applied_at),
            itemCount: mapping.applied_item_count || 0,
            appliedMaterialCode: codes[0] || undefined,
            appliedLaborCode: codes[1] || codes[0] || undefined,
          };
        }
      });
      setAppliedSystems(prev => ({ ...appliedFromDb, ...prev }));
    }
  }, [dbMappings]);

  // Load cost codes from database
  const { data: dbMaterialCodes = [] } = useMaterialCodes();
  const { data: dbLaborCodes = [] } = useLaborCodes();

  // Merge database codes with hardcoded codes and imported codes
  const allMaterialCodes = useMemo(() => {
    const hardcoded = COST_CODES_DB.material;
    const imported = importedCostCodes
      .filter(c => c.category === 'M')
      .map(c => ({
        code: c.code,
        description: c.description,
        category: 'M' as const,
        keywords: [],
      }));
    const dbCodes = dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
      category: 'M' as const,
      keywords: [],
    }));
    
    // Combine all sources and deduplicate by code
    const combined = [...hardcoded, ...imported, ...dbCodes];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [importedCostCodes, dbMaterialCodes]);

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

  // Extract unique systems and count items
  const systemMappings = useMemo(() => {
    const systemMap = new Map<string, { count: number; items: EstimateItem[] }>();
    
    data.forEach(item => {
      const systemKey = item.system || 'Unknown';
      if (!systemMap.has(systemKey)) {
        systemMap.set(systemKey, { count: 0, items: [] });
      }
      const entry = systemMap.get(systemKey)!;
      entry.count++;
      entry.items.push(item);
    });

    return Array.from(systemMap.entries())
      .map(([system, { count, items }]) => ({
        system,
        itemCount: count,
        items,
        materialCode: mappings[system]?.materialCode,
        laborCode: mappings[system]?.laborCode,
        suggestedMaterialCode: suggestions[system]?.materialCode,
        suggestedLaborCode: suggestions[system]?.laborCode,
        appliedInfo: appliedSystems[system],
      }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [data, mappings, suggestions, appliedSystems]);

  // Filter systems by search term and active filters
  const filteredSystems = useMemo(() => {
    let filtered = systemMappings;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sm => 
        sm.system.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (activeStatusFilter && activeStatusFilter !== 'all') {
      if (activeStatusFilter === 'mapped') {
        filtered = filtered.filter(sm => sm.materialCode && sm.laborCode);
      } else if (activeStatusFilter === 'partial') {
        filtered = filtered.filter(sm => 
          (sm.materialCode || sm.laborCode) && !(sm.materialCode && sm.laborCode)
        );
      } else if (activeStatusFilter === 'unmapped') {
        filtered = filtered.filter(sm => !sm.materialCode && !sm.laborCode);
      }
    }

    // Apply system filter
    if (activeSystemFilter) {
      filtered = filtered.filter(sm => sm.system === activeSystemFilter);
    }

    return filtered;
  }, [systemMappings, searchTerm, activeStatusFilter, activeSystemFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = systemMappings.length;
    const mapped = systemMappings.filter(sm => sm.materialCode && sm.laborCode).length;
    const partial = systemMappings.filter(sm => 
      (sm.materialCode || sm.laborCode) && !(sm.materialCode && sm.laborCode)
    ).length;
    const unmapped = total - mapped - partial;

    return { total, mapped, partial, unmapped };
  }, [systemMappings]);

  // Top systems for filter cards
  const topSystems = useMemo(() => {
    return systemMappings.map(sm => ({
      system: sm.system,
      itemCount: sm.itemCount,
      status: (sm.materialCode && sm.laborCode) ? 'mapped' as const 
            : (sm.materialCode || sm.laborCode) ? 'partial' as const 
            : 'unmapped' as const,
    }));
  }, [systemMappings]);

  const handleMappingChange = (system: string, type: 'materialCode' | 'laborCode', value: string) => {
    setMappings(prev => ({
      ...prev,
      [system]: {
        ...prev[system],
        [type]: value === 'none' ? undefined : value,
      }
    }));
  };

  const clearMapping = (system: string) => {
    setMappings(prev => {
      const newMappings = { ...prev };
      delete newMappings[system];
      return newMappings;
    });
    toast({
      title: "Mapping Cleared",
      description: `Removed mapping for ${system}`,
    });
  };

  const clearAllMappings = () => {
    setMappings({});
    setItemTypeMappings({});
    setSuggestions({});
    toast({
      title: "All Mappings Cleared",
      description: "All system mappings have been removed",
    });
  };

  const handleItemTypeMappingChange = (system: string, itemType: string, type: 'materialCode' | 'laborCode', value: string) => {
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
  };

  const handleAutoSuggest = () => {
    setIsAutoSuggestLoading(true);
    
    // Simulate processing time for better UX
    setTimeout(() => {
      const systemNames = systemMappings
        .filter(sm => !sm.materialCode && !sm.laborCode) // Only suggest for unmapped systems
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
  };

  const applySystemSuggestions = (system: string) => {
    const suggestion = suggestions[system];
    if (!suggestion) return;

    setMappings(prev => ({
      ...prev,
      [system]: {
        materialCode: suggestion.materialCode || prev[system]?.materialCode,
        laborCode: suggestion.laborCode || prev[system]?.laborCode,
      }
    }));

    toast({
      title: "Suggestions Applied",
      description: `Applied smart suggestions for ${system}`,
    });
  };

  const applyMappings = () => {
    let itemsAffected = 0;
    const systemItemCounts: Record<string, number> = {};

    const updatedData = data.map(item => {
      const systemMapping = mappings[item.system];
      const itemTypeMapping = itemTypeMappings[item.system]?.[item.itemType];
      
      // Priority: Item type mapping > System mapping > Existing code
      // Now we assign BOTH labor and material codes separately
      let newLaborCode = item.costCode;
      let newMaterialCode = item.materialCostCode || '';
      let changed = false;
      
      if (itemTypeMapping) {
        // Use item type-specific mapping
        if (itemTypeMapping.laborCode && !item.costCode) {
          newLaborCode = itemTypeMapping.laborCode;
          changed = true;
        }
        if (itemTypeMapping.materialCode && !item.materialCostCode) {
          newMaterialCode = itemTypeMapping.materialCode;
          changed = true;
        }
      } else if (systemMapping) {
        // Fall back to system-level mapping
        if (systemMapping.laborCode && !item.costCode) {
          newLaborCode = systemMapping.laborCode;
          changed = true;
        }
        if (systemMapping.materialCode && !item.materialCostCode) {
          newMaterialCode = systemMapping.materialCode;
          changed = true;
        }
      }
      
      if (changed) {
        itemsAffected++;
        systemItemCounts[item.system] = (systemItemCounts[item.system] || 0) + 1;
        return { ...item, costCode: newLaborCode, materialCostCode: newMaterialCode };
      }
      return item;
    });

    // Track which systems were applied
    const newAppliedSystems: Record<string, { appliedAt: Date; itemCount: number }> = {};
    const systemsToUpdate: Array<{ systemName: string; appliedItemCount: number }> = [];
    
    Object.keys(mappings).forEach(system => {
      if (systemItemCounts[system] || mappings[system]?.laborCode || mappings[system]?.materialCode) {
        newAppliedSystems[system] = {
          appliedAt: new Date(),
          itemCount: systemItemCounts[system] || 0,
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
  };

  const applySystemMapping = (system: string) => {
    const systemMapping = mappings[system];
    if (!systemMapping) return;

    let itemsAffected = 0;
    const updatedData = data.map(item => {
      if (item.system !== system) return item;
      
      let newLaborCode = item.costCode;
      let newMaterialCode = item.materialCostCode || '';
      let changed = false;
      
      if (systemMapping.laborCode && !item.costCode) {
        newLaborCode = systemMapping.laborCode;
        changed = true;
      }
      if (systemMapping.materialCode && !item.materialCostCode) {
        newMaterialCode = systemMapping.materialCode;
        changed = true;
      }
      
      if (changed) {
        itemsAffected++;
        return { ...item, costCode: newLaborCode, materialCostCode: newMaterialCode };
      }
      return item;
    });

    // Track this system as applied with the codes that were applied
    setAppliedSystems(prev => ({
      ...prev,
      [system]: {
        appliedAt: new Date(),
        itemCount: itemsAffected,
        appliedMaterialCode: systemMapping.materialCode,
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
      description: `Applied mapping for "${system}" to ${itemsAffected} items`,
    });
  };

  const getStatusBadge = (sm: typeof systemMappings[0]) => {
    if (sm.materialCode && sm.laborCode) {
      return <Badge className="bg-success text-success-foreground"><Check className="w-3 h-3 mr-1" /> Mapped</Badge>;
    } else if (sm.materialCode || sm.laborCode) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground"><AlertCircle className="w-3 h-3 mr-1" /> Partial</Badge>;
    } else {
      return <Badge variant="outline">Unmapped</Badge>;
    }
  };

  const totalItems = data.length;
  const hasMappings = Object.keys(mappings).length > 0 || Object.keys(itemTypeMappings).length > 0;

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
                  <CardTitle>System Mappings</CardTitle>
                  <CardDescription>
                    Assign material and labor codes to each system
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
                  className="pl-9"
                />
              </div>

              {/* Card View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSystems.map((sm) => (
                    enableItemTypeMappings ? (
                      <ItemTypeMappingCard
                        key={sm.system}
                        system={sm.system}
                        itemCount={sm.itemCount}
                        items={sm.items}
                        systemMaterialCode={sm.materialCode}
                        systemLaborCode={sm.laborCode}
                        itemTypeMappings={itemTypeMappings[sm.system] || {}}
                        onSystemMaterialCodeChange={(value) => handleMappingChange(sm.system, 'materialCode', value)}
                        onSystemLaborCodeChange={(value) => handleMappingChange(sm.system, 'laborCode', value)}
                        onItemTypeMappingChange={(itemType, type, value) => handleItemTypeMappingChange(sm.system, itemType, type, value)}
                        materialCodes={allMaterialCodes}
                        laborCodes={allLaborCodes}
                      />
                    ) : (
                      <SystemCard
                        key={sm.system}
                        system={sm.system}
                        itemCount={sm.itemCount}
                        items={sm.items}
                        materialCode={sm.materialCode}
                        laborCode={sm.laborCode}
                        suggestedMaterialCode={sm.suggestedMaterialCode}
                        suggestedLaborCode={sm.suggestedLaborCode}
                        appliedInfo={sm.appliedInfo}
                        onMaterialCodeChange={(value) => handleMappingChange(sm.system, 'materialCode', value)}
                        onLaborCodeChange={(value) => handleMappingChange(sm.system, 'laborCode', value)}
                        onClear={() => clearMapping(sm.system)}
                        onApplySuggestions={() => applySystemSuggestions(sm.system)}
                        onApplySystemMapping={() => applySystemMapping(sm.system)}
                        onViewAllItems={onNavigateToEstimates}
                        importedCostCodes={importedCostCodes}
                      />
                    )
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">System</th>
                          <th className="text-left p-3 font-medium">Material Code</th>
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
                                value={sm.materialCode}
                                options={allMaterialCodes}
                                placeholder="Select material code..."
                                onValueChange={(value) => handleMappingChange(sm.system, 'materialCode', value)}
                              />
                            </td>
                            
                            <td className="p-3">
                              <TableRowCombobox
                                value={sm.laborCode}
                                options={allLaborCodes}
                                placeholder="Select labor code..."
                                onValueChange={(value) => handleMappingChange(sm.system, 'laborCode', value)}
                              />
                            </td>
                            
                            <td className="p-3 text-right tabular-nums font-medium">{sm.itemCount}</td>
                            <td className="p-3 text-center">{getStatusBadge(sm)}</td>
                            <td className="p-3 text-center">
                              {(sm.materialCode || sm.laborCode) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => clearMapping(sm.system)}
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

              {filteredSystems.length === 0 && (
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
