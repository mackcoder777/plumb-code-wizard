import React, { useState, useMemo, useCallback } from 'react';
import { EstimateItem } from '@/types/estimate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { 
  Package, 
  Search, 
  Check, 
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Filter,
  Hash,
  DollarSign,
  Layers,
  Loader2,
  Save
} from 'lucide-react';
import { useMaterialCodes } from '@/hooks/useCostCodes';
import { useBatchUpdateMaterialCostCodes } from '@/hooks/useEstimateProjects';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MaterialMappingTabProps {
  data: EstimateItem[];
  onDataUpdate: (data: EstimateItem[]) => void;
  projectId?: string | null;
}

interface MaterialGroup {
  materialSpec: string;
  itemCount: number;
  totalMaterial: number;
  totalHours: number;
  assignedCode: string | null;
  subGroups: ItemTypeGroup[];
}

interface ItemTypeGroup {
  itemType: string;
  itemCount: number;
  totalMaterial: number;
  totalHours: number;
  assignedCode: string | null;
  items: EstimateItem[];
}

export const MaterialMappingTab: React.FC<MaterialMappingTabProps> = ({ 
  data, 
  onDataUpdate,
  projectId 
}) => {
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [openCodePicker, setOpenCodePicker] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: dbMaterialCodes = [] } = useMaterialCodes();
  const batchUpdateMaterialCodes = useBatchUpdateMaterialCostCodes();

  // Get parent checkbox state (checked, unchecked, or indeterminate)
  const getParentCheckState = (spec: string, group: MaterialGroup): 'checked' | 'unchecked' | 'indeterminate' => {
    const childKeys = group.subGroups.map(sg => `${spec}|${sg.itemType}`);
    const selectedCount = childKeys.filter(k => selectedGroups.has(k)).length;

    if (selectedCount === 0) return 'unchecked';
    if (selectedCount === childKeys.length) return 'checked';
    return 'indeterminate';
  };

  // Toggle parent selection with cascade to children
  const toggleParentSelection = (spec: string, group: MaterialGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroups(prev => {
      const next = new Set(prev);
      const currentState = getParentCheckState(spec, group);

      if (currentState === 'checked' || currentState === 'indeterminate') {
        // Uncheck parent and ALL children
        next.delete(spec);
        group.subGroups.forEach(sg => next.delete(`${spec}|${sg.itemType}`));
      } else {
        // Check parent and ALL children
        next.add(spec);
        group.subGroups.forEach(sg => next.add(`${spec}|${sg.itemType}`));
      }
      return next;
    });
  };

  // Toggle child selection and sync parent state
  const toggleChildSelection = (spec: string, type: string, group: MaterialGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const childKey = `${spec}|${type}`;
    
    setSelectedGroups(prev => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(childKey);

      if (isCurrentlySelected) {
        next.delete(childKey);
      } else {
        next.add(childKey);
      }

      // Sync parent state
      const childKeys = group.subGroups.map(sg => `${spec}|${sg.itemType}`);
      const selectedCount = childKeys.filter(k => next.has(k)).length;

      if (selectedCount === childKeys.length) {
        next.add(spec); // All children selected = parent selected
      } else {
        next.delete(spec); // Not all children = parent not fully selected
      }

      return next;
    });
  };


  // Material codes list
  const allMaterialCodes = useMemo(() => {
    return dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
    })).sort((a, b) => a.description.localeCompare(b.description));
  }, [dbMaterialCodes]);

  // Group items by Material Spec → Item Type
  const groups = useMemo(() => {
    const specMap = new Map<string, MaterialGroup>();

    data.forEach(item => {
      const spec = item.materialSpec || 'Unknown';
      const type = item.itemType || 'Unknown';

      if (!specMap.has(spec)) {
        specMap.set(spec, {
          materialSpec: spec,
          itemCount: 0,
          totalMaterial: 0,
          totalHours: 0,
          assignedCode: null,
          subGroups: [],
        });
      }

      const specGroup = specMap.get(spec)!;
      specGroup.itemCount++;
      specGroup.totalMaterial += item.materialDollars || 0;
      specGroup.totalHours += item.hours || 0;

      // Find or create item type subgroup
      let typeGroup = specGroup.subGroups.find(g => g.itemType === type);
      if (!typeGroup) {
        typeGroup = {
          itemType: type,
          itemCount: 0,
          totalMaterial: 0,
          totalHours: 0,
          assignedCode: null,
          items: [],
        };
        specGroup.subGroups.push(typeGroup);
      }

      typeGroup.itemCount++;
      typeGroup.totalMaterial += item.materialDollars || 0;
      typeGroup.totalHours += item.hours || 0;
      typeGroup.items.push(item);

      // Determine assigned code (if all items have same code)
      const codes = new Set(typeGroup.items.map(i => i.materialCostCode).filter(Boolean));
      typeGroup.assignedCode = codes.size === 1 ? [...codes][0]! : codes.size > 1 ? 'MIXED' : null;
    });

    // Determine spec-level assigned code
    specMap.forEach(specGroup => {
      const codes = new Set(specGroup.subGroups.map(g => g.assignedCode).filter(c => c && c !== 'MIXED'));
      specGroup.assignedCode = codes.size === 1 ? [...codes][0]! : codes.size > 1 ? 'MIXED' : null;
    });

    return Array.from(specMap.values()).sort((a, b) => b.totalMaterial - a.totalMaterial);
  }, [data]);

  // Get selected item count for bulk operations
  const getSelectedItemCount = useMemo(() => {
    let count = 0;
    selectedGroups.forEach(groupKey => {
      if (groupKey.includes('|')) {
        const [spec, type] = groupKey.split('|');
        const specGroup = groups.find(g => g.materialSpec === spec);
        const typeGroup = specGroup?.subGroups.find(g => g.itemType === type);
        count += typeGroup?.itemCount || 0;
      }
    });
    return count;
  }, [selectedGroups, groups]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      if (searchTerm && !group.materialSpec.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterStatus === 'assigned' && !group.assignedCode) return false;
      if (filterStatus === 'unassigned' && group.assignedCode) return false;
      return true;
    });
  }, [groups, searchTerm, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = data.length;
    const assigned = data.filter(i => i.materialCostCode).length;
    const totalMaterial = data.reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    const assignedMaterial = data.filter(i => i.materialCostCode).reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    return { total, assigned, unassigned: total - assigned, totalMaterial, assignedMaterial };
  }, [data]);

  // Toggle expand
  const toggleSpec = (spec: string) => {
    setExpandedSpecs(prev => {
      const next = new Set(prev);
      if (next.has(spec)) next.delete(spec);
      else next.add(spec);
      return next;
    });
  };

  const toggleType = (spec: string, type: string) => {
    const key = `${spec}|${type}`;
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Assign code to group with auto-save to database
  const handleAssignCode = useCallback(async (groupKey: string, code: string) => {
    const [spec, type] = groupKey.split('|');
    let targetItems: EstimateItem[] = [];

    if (type) {
      // Item type level
      const specGroup = groups.find(g => g.materialSpec === spec);
      const typeGroup = specGroup?.subGroups.find(g => g.itemType === type);
      targetItems = typeGroup?.items || [];
    } else {
      // Material spec level
      const specGroup = groups.find(g => g.materialSpec === spec);
      targetItems = specGroup?.subGroups.flatMap(g => g.items) || [];
    }

    if (targetItems.length === 0) return;

    // Update local state immediately
    const updatedData = data.map(item => {
      if (targetItems.some(t => t.id === item.id)) {
        return { ...item, materialCostCode: code };
      }
      return item;
    });

    onDataUpdate(updatedData);
    setOpenCodePicker(null);

    // Persist to database if projectId is available
    if (projectId) {
      setIsSaving(true);
      try {
        const itemIds = targetItems.map(item => String(item.id));
        await batchUpdateMaterialCodes.mutateAsync({
          projectId,
          itemIds,
          materialCode: code
        });
        toast({
          title: 'Code Saved',
          description: `Applied ${code} to ${targetItems.length} items and saved to database`,
        });
      } catch (error) {
        console.error('Failed to save material codes:', error);
        toast({
          title: 'Save Failed',
          description: 'Changes applied locally but failed to save to database. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({
        title: 'Code Assigned',
        description: `Applied ${code} to ${targetItems.length} items (not saved - no project selected)`,
      });
    }
  }, [groups, data, onDataUpdate, projectId, batchUpdateMaterialCodes]);

  // Bulk assign to selected groups with auto-save - only process child keys to avoid double-counting
  const handleBulkAssign = useCallback(async (code: string) => {
    const targetItems: EstimateItem[] = [];
    
    selectedGroups.forEach(groupKey => {
      if (groupKey.includes('|')) {
        const [spec, type] = groupKey.split('|');
        const specGroup = groups.find(g => g.materialSpec === spec);
        const typeGroup = specGroup?.subGroups.find(g => g.itemType === type);
        if (typeGroup) {
          targetItems.push(...typeGroup.items);
        }
      }
    });

    if (targetItems.length === 0) return;

    // Update local state immediately
    const itemIdSet = new Set(targetItems.map(i => i.id));
    const updatedData = data.map(item => {
      if (itemIdSet.has(item.id)) {
        return { ...item, materialCostCode: code };
      }
      return item;
    });

    onDataUpdate(updatedData);
    setSelectedGroups(new Set());
    setOpenCodePicker(null);

    // Persist to database if projectId is available
    if (projectId) {
      setIsSaving(true);
      try {
        const itemIds = targetItems.map(item => String(item.id));
        await batchUpdateMaterialCodes.mutateAsync({
          projectId,
          itemIds,
          materialCode: code
        });
        toast({
          title: 'Bulk Codes Saved',
          description: `Applied ${code} to ${targetItems.length} items and saved to database`,
        });
      } catch (error) {
        console.error('Failed to save material codes:', error);
        toast({
          title: 'Save Failed',
          description: 'Changes applied locally but failed to save to database. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({
        title: 'Bulk Code Assigned',
        description: `Applied ${code} to ${targetItems.length} items (not saved - no project selected)`,
      });
    }
  }, [selectedGroups, groups, data, onDataUpdate, projectId, batchUpdateMaterialCodes]);

  // Select all visible groups
  const selectAllVisible = () => {
    const newSelected = new Set<string>();
    filteredGroups.forEach(group => {
      newSelected.add(group.materialSpec);
      group.subGroups.forEach(sg => {
        newSelected.add(`${group.materialSpec}|${sg.itemType}`);
      });
    });
    setSelectedGroups(newSelected);
  };

  // Render status badge
  const renderStatusBadge = (code: string | null) => {
    if (!code) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Unassigned
        </Badge>
      );
    }
    if (code === 'MIXED') {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <Layers className="h-3 w-3 mr-1" />
          Mixed
        </Badge>
      );
    }
    const codeInfo = allMaterialCodes.find(c => c.code === code);
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-mono">
        <Check className="h-3 w-3 mr-1" />
        {code}
        {codeInfo && <span className="ml-1 font-normal opacity-75 truncate max-w-32">- {codeInfo.description}</span>}
      </Badge>
    );
  };

  // Code picker component
  const CodePicker = ({ groupKey, onSelect }: { groupKey: string; onSelect: (code: string) => void }) => (
    <Command className="rounded-lg border shadow-md">
      <CommandInput placeholder="Search material codes..." />
      <CommandList>
        <CommandEmpty>No codes found.</CommandEmpty>
        <CommandGroup>
          {allMaterialCodes.map(code => (
            <CommandItem
              key={code.code}
              value={`${code.code} ${code.description}`}
              onSelect={() => onSelect(code.code)}
              className="cursor-pointer"
            >
              <span className="font-mono font-semibold text-primary">{code.code}</span>
              <span className="ml-2 text-muted-foreground truncate">{code.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Material Code Assignment
                {isSaving && (
                  <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </Badge>
                )}
                {!isSaving && projectId && (
                  <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-600 border-green-500/30">
                    <Save className="h-3 w-3 mr-1" />
                    Auto-save enabled
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Click on any group to assign a material code. Use checkboxes for bulk assignment.
                {!projectId && (
                  <span className="text-yellow-600 ml-2">(Select a project to enable auto-save)</span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Hash className="h-4 w-4" />
                Total Items
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <Check className="h-4 w-4" />
                Assigned
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.assigned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.total > 0 ? ((stats.assigned / stats.total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive text-sm mb-1">
                <AlertCircle className="h-4 w-4" />
                Unassigned
              </div>
              <div className="text-2xl font-bold text-destructive">{stats.unassigned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.total > 0 ? ((stats.unassigned / stats.total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                Total Material
              </div>
              <div className="text-2xl font-bold text-blue-600">${stats.totalMaterial.toLocaleString()}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Assignment Progress</span>
              <span className="text-sm text-muted-foreground">{stats.assigned} / {stats.total} items</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.assigned / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search material specs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    <SelectItem value="unassigned">Unassigned Only</SelectItem>
                    <SelectItem value="assigned">Assigned Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={selectAllVisible}>
              Select All
            </Button>

            {selectedGroups.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium text-primary">
                  {getSelectedItemCount.toLocaleString()} items selected
                </span>
                <Popover open={openCodePicker === 'bulk'} onOpenChange={(open) => setOpenCodePicker(open ? 'bulk' : null)}>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="bg-primary hover:bg-primary/90">
                      Assign Code
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <CodePicker groupKey="bulk" onSelect={handleBulkAssign} />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="sm" onClick={() => setSelectedGroups(new Set())}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1"></div>
            <div className="col-span-4">Material Spec / Item Type</div>
            <div className="col-span-2 text-right">Items</div>
            <div className="col-span-2 text-right">Material $</div>
            <div className="col-span-3">Material Code</div>
          </div>

          {/* Groups */}
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {filteredGroups.map(group => {
                const parentState = getParentCheckState(group.materialSpec, group);
                
                return (
                <div key={group.materialSpec}>
                  {/* Material Spec Row */}
                  <div 
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer hover:bg-muted/50 transition-colors ${
                      parentState !== 'unchecked' ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleSpec(group.materialSpec)}
                  >
                    <div className="col-span-1 flex items-center gap-2">
                      <Checkbox
                        checked={parentState === 'checked' ? true : parentState === 'indeterminate' ? 'indeterminate' : false}
                        onClick={e => toggleParentSelection(group.materialSpec, group, e as unknown as React.MouseEvent)}
                      />
                      {expandedSpecs.has(group.materialSpec) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="col-span-4">
                      <span className="font-medium text-foreground">{group.materialSpec}</span>
                      <span className="ml-2 text-xs text-muted-foreground">({group.subGroups.length} types)</span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                      {group.itemCount.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                      ${group.totalMaterial.toLocaleString()}
                    </div>
                    <div className="col-span-3">
                      <Popover 
                        open={openCodePicker === group.materialSpec} 
                        onOpenChange={(open) => setOpenCodePicker(open ? group.materialSpec : null)}
                      >
                        <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" className="h-auto p-1 hover:bg-muted">
                            {renderStatusBadge(group.assignedCode)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <CodePicker 
                            groupKey={group.materialSpec} 
                            onSelect={(code) => handleAssignCode(group.materialSpec, code)} 
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Expanded Item Types */}
                  {expandedSpecs.has(group.materialSpec) && (
                    <div className="bg-muted/20">
                    {group.subGroups.map(typeGroup => {
                      const childKey = `${group.materialSpec}|${typeGroup.itemType}`;
                      const isChildSelected = selectedGroups.has(childKey);
                      
                      return (
                        <div key={childKey}>
                          {/* Item Type Row */}
                          <div 
                            className={`grid grid-cols-12 gap-4 px-4 py-2 items-center cursor-pointer hover:bg-muted/50 transition-colors pl-12 ${
                              isChildSelected ? 'bg-primary/5' : ''
                            }`}
                            onClick={() => toggleType(group.materialSpec, typeGroup.itemType)}
                          >
                            <div className="col-span-1 flex items-center gap-2">
                              <Checkbox
                                checked={isChildSelected}
                                onClick={e => toggleChildSelection(group.materialSpec, typeGroup.itemType, group, e as unknown as React.MouseEvent)}
                              />
                              {expandedTypes.has(`${group.materialSpec}|${typeGroup.itemType}`) ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="col-span-4">
                              <span className="text-sm text-foreground">{typeGroup.itemType}</span>
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                              {typeGroup.itemCount.toLocaleString()}
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                              ${typeGroup.totalMaterial.toLocaleString()}
                            </div>
                            <div className="col-span-3">
                              <Popover 
                                open={openCodePicker === `${group.materialSpec}|${typeGroup.itemType}`} 
                                onOpenChange={(open) => setOpenCodePicker(open ? `${group.materialSpec}|${typeGroup.itemType}` : null)}
                              >
                                <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" className="h-auto p-1 hover:bg-muted">
                                    {renderStatusBadge(typeGroup.assignedCode)}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="start">
                                  <CodePicker 
                                    groupKey={`${group.materialSpec}|${typeGroup.itemType}`} 
                                    onSelect={(code) => handleAssignCode(`${group.materialSpec}|${typeGroup.itemType}`, code)} 
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* Expanded Items */}
                          {expandedTypes.has(`${group.materialSpec}|${typeGroup.itemType}`) && (
                            <div className="bg-background border-l-2 border-primary/20 ml-16">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Material $</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {typeGroup.items.slice(0, 10).map(item => (
                                    <tr key={item.id} className="hover:bg-muted/30">
                                      <td className="px-3 py-2 text-foreground">{item.itemName || item.materialDesc}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{item.size}</td>
                                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">${(item.materialDollars || 0).toLocaleString()}</td>
                                      <td className="px-3 py-2">
                                        {item.materialCostCode ? (
                                          <span className="font-mono text-green-600">{item.materialCostCode}</span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {typeGroup.items.length > 10 && (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">
                                        + {typeGroup.items.length - 10} more items
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
                );
              })}

              {filteredGroups.length === 0 && (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No material groups found</p>
                  <p className="text-sm">Try adjusting your search or filter</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialMappingTab;
