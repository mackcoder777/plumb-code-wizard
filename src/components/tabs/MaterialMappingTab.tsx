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
  ChevronUp,
  Filter,
  Hash,
  DollarSign,
  Layers,
  Loader2,
  Save,
  AlertTriangle,
  X
} from 'lucide-react';
import { useMaterialCodes } from '@/hooks/useCostCodes';
import { useBatchUpdateMaterialCostCodes, useDismissFromMaterialBudget } from '@/hooks/useEstimateProjects';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Ban } from 'lucide-react';
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
  // Detailed assignment tracking
  assignedChildCount: number;
  totalChildCount: number;
  unassignedChildCount: number;
  hasUnassignedChildren: boolean;
  assignmentStatus: 'complete' | 'partial' | 'none';
}

interface ItemTypeGroup {
  itemType: string;
  itemCount: number;
  totalMaterial: number;
  totalHours: number;
  assignedCode: string | null;
  items: EstimateItem[];
  isFullyAssigned: boolean;
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'assigned' | 'unassigned' | 'needs-attention' | 'dismissed' | 'zero-value'>('all');
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const [openCodePicker, setOpenCodePicker] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedItemPages, setExpandedItemPages] = useState<Record<string, number>>({});
  const [expandedItemSearch, setExpandedItemSearch] = useState<Record<string, string>>({});
  const [expandedItemFilter, setExpandedItemFilter] = useState<Record<string, 'all' | 'assigned' | 'unassigned'>>({});
  const ITEMS_PER_PAGE = 15;

  // Get unique systems from data
  const uniqueSystems = useMemo(() => {
    const systems = new Set<string>();
    data.forEach(item => {
      if (item.system) systems.add(item.system);
    });
    return Array.from(systems).sort();
  }, [data]);

  // Get unique item types from data
  const uniqueItemTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(item => {
      if (item.itemType) types.add(item.itemType);
    });
    return Array.from(types).sort();
  }, [data]);

  const { data: dbMaterialCodes = [] } = useMaterialCodes();
  const batchUpdateMaterialCodes = useBatchUpdateMaterialCostCodes();
  const dismissFromBudget = useDismissFromMaterialBudget();

  // Get parent checkbox state (checked, unchecked, or indeterminate)
  const getParentCheckState = (spec: string, group: MaterialGroup): 'checked' | 'unchecked' | 'indeterminate' => {
    const childKeys = group.subGroups.map(sg => `${spec}|${sg.itemType}`);
    const selectedCount = childKeys.filter(k => selectedGroups.has(k)).length;

    if (selectedCount === 0) return 'unchecked';
    if (selectedCount === childKeys.length) return 'checked';
    return 'indeterminate';
  };

  // Toggle parent selection with cascade to children AND item-level selection
  const toggleParentSelection = (spec: string, group: MaterialGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentState = getParentCheckState(spec, group);
    
    // Collect ALL item IDs from ALL sub-groups
    const allItemIds = group.subGroups.flatMap(sg => 
      sg.items.map(i => String(i.id))
    );
    
    // Update group-level selection
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (currentState === 'checked' || currentState === 'indeterminate') {
        // Deselect parent and all children
        next.delete(spec);
        group.subGroups.forEach(sg => next.delete(`${spec}|${sg.itemType}`));
      } else {
        // Select parent and all children
        next.add(spec);
        group.subGroups.forEach(sg => next.add(`${spec}|${sg.itemType}`));
      }
      return next;
    });
    
    // CASCADE to item-level selection
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (currentState === 'checked' || currentState === 'indeterminate') {
        // Deselect all items
        allItemIds.forEach(id => next.delete(id));
      } else {
        // Select all items
        allItemIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle child selection and CASCADE to item-level selection
  // FIXED: Use the typeGroup passed directly from UI (already filtered by system filter)
  const toggleChildSelection = (spec: string, type: string, typeGroup: ItemTypeGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    const childKey = `${spec}|${type}`;
    
    // Use ALL items from the typeGroup (the UI-filtered version)
    const itemIds = typeGroup.items.map(i => String(i.id));
    
    // Check if ALL items in this group are currently selected
    const allItemsSelected = itemIds.length > 0 && itemIds.every(id => selectedItems.has(id));
    
    // Toggle group selection state
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (allItemsSelected) {
        next.delete(childKey);
      } else {
        next.add(childKey);
      }
      return next;
    });
    
    // CASCADE to item-level selection - select ALL items regardless of pagination
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allItemsSelected) {
        // Deselect all items in this group
        itemIds.forEach(id => next.delete(id));
      } else {
        // Select all items in this group (even ones not visible on current page)
        itemIds.forEach(id => next.add(id));
      }
      return next;
    });
  };
  
  // Get selection state for a type group based on item-level selections
  // FIXED: Accept typeGroup directly from UI to use consistent filtered data
  const getGroupSelectionState = (typeGroup: ItemTypeGroup) => {
    const itemIds = typeGroup.items.map(i => String(i.id));
    
    if (itemIds.length === 0) return { checked: false, indeterminate: false, selectedCount: 0, totalCount: 0 };
    
    const selectedCount = itemIds.filter(id => selectedItems.has(id)).length;
    const totalCount = itemIds.length;
    
    return {
      checked: selectedCount === totalCount,
      indeterminate: selectedCount > 0 && selectedCount < totalCount,
      selectedCount,
      totalCount
    };
  };
  
  // Helper functions for pagination and filtering
  const getPageForGroup = (groupKey: string) => expandedItemPages[groupKey] || 1;
  const getSearchForGroup = (groupKey: string) => expandedItemSearch[groupKey] || '';
  const getItemFilterForGroup = (groupKey: string) => {
    // If user has explicitly set a filter for this group, use it
    if (expandedItemFilter[groupKey]) return expandedItemFilter[groupKey];
    
    // Otherwise, inherit from main filter
    if (filterStatus === 'needs-attention' || filterStatus === 'unassigned') return 'unassigned';
    if (filterStatus === 'assigned') return 'assigned';
    return 'all';
  };

  // Material codes list
  const allMaterialCodes = useMemo(() => {
    return dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
    })).sort((a, b) => a.description.localeCompare(b.description));
  }, [dbMaterialCodes]);

  // Group items by Material Spec → Item Type with assignment tracking
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
          assignedChildCount: 0,
          totalChildCount: 0,
          unassignedChildCount: 0,
          hasUnassignedChildren: false,
          assignmentStatus: 'none'
        });
      }

      const specGroup = specMap.get(spec)!;
      specGroup.itemCount++;
      specGroup.totalMaterial += item.materialDollars || 0;
      specGroup.totalHours += item.hours || 0;

      let typeGroup = specGroup.subGroups.find(g => g.itemType === type);
      if (!typeGroup) {
        typeGroup = {
          itemType: type,
          itemCount: 0,
          totalMaterial: 0,
          totalHours: 0,
          assignedCode: null,
          items: [],
          isFullyAssigned: false
        };
        specGroup.subGroups.push(typeGroup);
      }

      typeGroup.itemCount++;
      typeGroup.totalMaterial += item.materialDollars || 0;
      typeGroup.totalHours += item.hours || 0;
      typeGroup.items.push(item);
    });

    // Calculate assignment status for each group
    specMap.forEach(specGroup => {
      specGroup.totalChildCount = specGroup.subGroups.length;
      
      specGroup.subGroups.forEach(typeGroup => {
        const codes = new Set(typeGroup.items.map(i => i.materialCostCode).filter(Boolean));
        const hasUnassignedItems = typeGroup.items.some(i => !i.materialCostCode);
        
        typeGroup.assignedCode = codes.size === 1 && !hasUnassignedItems 
          ? [...codes][0]! 
          : codes.size > 0 && hasUnassignedItems 
            ? 'MIXED' 
            : codes.size > 1 
              ? 'MIXED' 
              : null;
        
        typeGroup.isFullyAssigned = !hasUnassignedItems && codes.size > 0;
        
        if (typeGroup.isFullyAssigned) {
          specGroup.assignedChildCount++;
        }
      });
      
      specGroup.unassignedChildCount = specGroup.totalChildCount - specGroup.assignedChildCount;
      specGroup.hasUnassignedChildren = specGroup.unassignedChildCount > 0;
      
      if (specGroup.assignedChildCount === 0) {
        specGroup.assignmentStatus = 'none';
        specGroup.assignedCode = null;
      } else if (specGroup.assignedChildCount === specGroup.totalChildCount) {
        specGroup.assignmentStatus = 'complete';
        const allCodes = new Set(specGroup.subGroups.map(g => g.assignedCode).filter(c => c && c !== 'MIXED'));
        specGroup.assignedCode = allCodes.size === 1 ? [...allCodes][0]! : 'MIXED';
      } else {
        specGroup.assignmentStatus = 'partial';
        specGroup.assignedCode = 'MIXED';
      }
    });

    return Array.from(specMap.values()).sort((a, b) => b.totalMaterial - a.totalMaterial);
  }, [data]);

  // Get selected item count for bulk operations
  const getSelectedItemCount = useMemo(() => {
    // Use the actual selectedItems set as the source of truth
    return selectedItems.size;
  }, [selectedItems]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.map(group => {
      // If system filter is active, filter subGroups to only include those with matching items
      if (systemFilter !== 'all') {
        const filteredSubGroups = group.subGroups.map(sg => {
          const filteredItems = sg.items.filter(item => item.system === systemFilter);
          
          // FIX: Recalculate assignedCode based on FILTERED items
          const codes = new Set(
            filteredItems
              .map(i => i.materialCostCode)
              .filter(Boolean)
          );
          const hasUnassigned = filteredItems.some(i => !i.materialCostCode);
          
          let newAssignedCode: string | null = null;
          if (codes.size === 1 && !hasUnassigned) {
            newAssignedCode = [...codes][0]!;
          } else if (codes.size > 1 || (codes.size > 0 && hasUnassigned)) {
            newAssignedCode = 'MIXED';
          }

          return {
            ...sg,
            items: filteredItems,
            itemCount: filteredItems.length,
            totalMaterial: filteredItems.reduce((sum, i) => sum + (i.materialDollars || 0), 0),
            totalHours: filteredItems.reduce((sum, i) => sum + (i.hours || 0), 0),
            assignedCode: newAssignedCode,
            isFullyAssigned: !hasUnassigned && codes.size > 0
          };
        }).filter(sg => sg.items.length > 0);
        
        if (filteredSubGroups.length === 0) return null;
        
        // Recalculate group stats based on filtered items
        const filteredItemCount = filteredSubGroups.reduce((sum, sg) => sum + sg.items.length, 0);
        const filteredTotalMaterial = filteredSubGroups.reduce((sum, sg) => sg.totalMaterial + sum, 0);
        
        // FIX: Recalculate parent group's assignedCode based on filtered subGroups
        const allSubCodes = new Set(
          filteredSubGroups
            .map(g => g.assignedCode)
            .filter(c => c && c !== 'MIXED')
        );
        const hasUnassignedSubs = filteredSubGroups.some(g => !g.assignedCode);
        const hasMixedSubs = filteredSubGroups.some(g => g.assignedCode === 'MIXED');
        
        let newGroupAssignedCode: string | null = null;
        if (allSubCodes.size === 1 && !hasUnassignedSubs && !hasMixedSubs) {
          newGroupAssignedCode = [...allSubCodes][0]!;
        } else if (allSubCodes.size > 1 || hasMixedSubs || (allSubCodes.size > 0 && hasUnassignedSubs)) {
          newGroupAssignedCode = 'MIXED';
        }
        
        return {
          ...group,
          subGroups: filteredSubGroups,
          itemCount: filteredItemCount,
          totalMaterial: filteredTotalMaterial,
          assignedCode: newGroupAssignedCode
        };
      }
      return group;
    }).filter((group): group is MaterialGroup => {
      if (!group) return false;
      
      // Enhanced search: match Material Spec OR Item Type names
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const specMatches = group.materialSpec.toLowerCase().includes(searchLower);
        const typeMatches = group.subGroups.some(sg => 
          sg.itemType.toLowerCase().includes(searchLower)
        );
        if (!specMatches && !typeMatches) return false;
      }
      
      if (filterStatus === 'assigned' && group.assignmentStatus !== 'complete') return false;
      if (filterStatus === 'unassigned' && group.assignmentStatus !== 'none') return false;
      if (filterStatus === 'needs-attention' && !group.hasUnassignedChildren) return false;
      if (filterStatus === 'dismissed') {
        // Only show groups that have dismissed items
        const hasDismissed = group.subGroups.some(sg => 
          sg.items.some(i => i.excludedFromMaterialBudget)
        );
        if (!hasDismissed) return false;
      }
      if (filterStatus === 'zero-value') {
        // Only show groups with $0 value items
        const hasZeroValue = group.subGroups.some(sg => 
          sg.items.some(i => (i.materialDollars || 0) <= 0)
        );
        if (!hasZeroValue) return false;
      }
      return true;
    }).map(group => {
      // Apply child-level filtering based on filterStatus
      if (filterStatus === 'all') return group;
      
      const filteredSubGroups = group.subGroups.filter(sg => {
        if (filterStatus === 'assigned') return sg.isFullyAssigned;
        if (filterStatus === 'unassigned') return !sg.assignedCode;
        if (filterStatus === 'needs-attention') return !sg.isFullyAssigned;
        if (filterStatus === 'dismissed') {
          return sg.items.some(i => i.excludedFromMaterialBudget);
        }
        if (filterStatus === 'zero-value') {
          return sg.items.some(i => (i.materialDollars || 0) <= 0);
        }
        return true;
      });
      
      // If no subgroups match, still return group but with filtered subgroups
      return {
        ...group,
        subGroups: filteredSubGroups
      };
    }).map(group => {
      // Apply Item Type filter if active
      if (itemTypeFilter === 'all') return group;
      
      const filteredSubGroups = group.subGroups.filter(sg => sg.itemType === itemTypeFilter);
      if (filteredSubGroups.length === 0) return null;
      
      // Recalculate group stats
      const filteredItemCount = filteredSubGroups.reduce((sum, sg) => sum + sg.items.length, 0);
      const filteredTotalMaterial = filteredSubGroups.reduce((sum, sg) => sg.totalMaterial + sum, 0);
      
      return {
        ...group,
        subGroups: filteredSubGroups,
        itemCount: filteredItemCount,
        totalMaterial: filteredTotalMaterial
      };
    }).filter((group): group is MaterialGroup => group !== null);
  }, [groups, searchTerm, filterStatus, systemFilter, itemTypeFilter]);

  // Groups needing attention (exclude $0 value and dismissed items)
  const groupsNeedingAttention = useMemo(() => {
    return groups.filter(g => {
      // Check if group has unassigned children that actually need assignment
      const needsAssignment = g.subGroups.some(sg => {
        const activeItems = sg.items.filter(i => 
          (i.materialDollars || 0) > 0 && !i.excludedFromMaterialBudget
        );
        return activeItems.some(i => !i.materialCostCode);
      });
      return needsAssignment;
    });
  }, [groups]);

  // Stats - exclude $0 and dismissed items from "needing assignment"
  const stats = useMemo(() => {
    const total = data.length;
    const assigned = data.filter(i => i.materialCostCode).length;
    const totalMaterial = data.reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    const assignedMaterial = data.filter(i => i.materialCostCode).reduce((sum, i) => sum + (i.materialDollars || 0), 0);
    
    // Items that actually need assignment (have material value and not dismissed)
    const itemsNeedingAssignment = data.filter(i => 
      (i.materialDollars || 0) > 0 && !i.excludedFromMaterialBudget
    );
    const needingTotal = itemsNeedingAssignment.length;
    const needingAssigned = itemsNeedingAssignment.filter(i => i.materialCostCode).length;
    const needingUnassigned = needingTotal - needingAssigned;
    
    // Dismissed/excluded items
    const dismissed = data.filter(i => i.excludedFromMaterialBudget).length;
    const zeroValue = data.filter(i => (i.materialDollars || 0) <= 0).length;
    
    return { 
      total, 
      assigned, 
      unassigned: total - assigned, 
      totalMaterial, 
      assignedMaterial,
      needingTotal,
      needingAssigned,
      needingUnassigned,
      dismissed,
      zeroValue
    };
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

  // Expand all groups with unassigned children
  const expandAllIncomplete = () => {
    const incomplete = groups
      .filter(g => g.hasUnassignedChildren)
      .map(g => g.materialSpec);
    setExpandedSpecs(new Set(incomplete));
  };

  // Collapse all groups
  const collapseAll = () => {
    setExpandedSpecs(new Set());
    setExpandedTypes(new Set());
  };

  // Assign code to group with auto-save to database
  const handleAssignCode = useCallback(async (groupKey: string, code: string) => {
    const [spec, type] = groupKey.split('|');
    let targetItems: EstimateItem[] = [];

    if (type) {
      const specGroup = groups.find(g => g.materialSpec === spec);
      const typeGroup = specGroup?.subGroups.find(g => g.itemType === type);
      targetItems = typeGroup?.items || [];
    } else {
      const specGroup = groups.find(g => g.materialSpec === spec);
      targetItems = specGroup?.subGroups.flatMap(g => g.items) || [];
    }

    if (targetItems.length === 0) return;

    const updatedData = data.map(item => {
      if (targetItems.some(t => t.id === item.id)) {
        return { ...item, materialCostCode: code };
      }
      return item;
    });

    onDataUpdate(updatedData);
    setOpenCodePicker(null);

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

  // Dismiss items from material budget (for $0 value groups)
  const handleDismissGroup = useCallback(async (groupKey: string, dismissed: boolean = true) => {
    const [spec, type] = groupKey.split('|');
    let targetItems: EstimateItem[] = [];

    if (type) {
      const specGroup = groups.find(g => g.materialSpec === spec);
      const typeGroup = specGroup?.subGroups.find(g => g.itemType === type);
      targetItems = typeGroup?.items.filter(i => (i.materialDollars || 0) <= 0) || [];
    } else {
      const specGroup = groups.find(g => g.materialSpec === spec);
      targetItems = specGroup?.subGroups.flatMap(g => g.items.filter(i => (i.materialDollars || 0) <= 0)) || [];
    }

    if (targetItems.length === 0) return;

    const updatedData = data.map(item => {
      if (targetItems.some(t => t.id === item.id)) {
        return { ...item, excludedFromMaterialBudget: dismissed };
      }
      return item;
    });

    onDataUpdate(updatedData);

    if (projectId) {
      setIsSaving(true);
      try {
        const itemIds = targetItems.map(item => String(item.id));
        await dismissFromBudget.mutateAsync({
          projectId,
          itemIds,
          dismissed
        });
        toast({
          title: dismissed ? 'Items Dismissed' : 'Items Restored',
          description: `${targetItems.length} $0 items ${dismissed ? 'dismissed from' : 'restored to'} budget tracking`,
        });
      } catch (error) {
        console.error('Failed to dismiss items:', error);
        toast({
          title: 'Operation Failed',
          description: 'Failed to update items. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }
  }, [groups, data, onDataUpdate, projectId, dismissFromBudget]);

  // Bulk assign to selected groups with auto-save
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

  // Toggle individual item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Select all items in a type group
  const selectAllItemsInGroup = (items: EstimateItem[]) => {
    const itemIds = items.map(i => String(i.id));
    const allSelected = itemIds.every(id => selectedItems.has(id));
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) {
        itemIds.forEach(id => next.delete(id));
      } else {
        itemIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Assign code to individually selected items
  const handleItemLevelAssign = useCallback(async (code: string) => {
    if (selectedItems.size === 0) return;

    const itemIds = Array.from(selectedItems);
    const updatedData = data.map(item => {
      if (itemIds.includes(String(item.id))) {
        return { ...item, materialCostCode: code };
      }
      return item;
    });

    onDataUpdate(updatedData);
    
    if (projectId) {
      setIsSaving(true);
      try {
        await batchUpdateMaterialCodes.mutateAsync({
          projectId,
          itemIds,
          materialCode: code
        });
        toast({
          title: 'Items Updated',
          description: `Applied ${code} to ${itemIds.length} selected items`,
        });
      } catch (error) {
        console.error('Failed to save material codes:', error);
        toast({
          title: 'Save Failed',
          description: 'Changes applied locally but failed to save to database.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({
        title: 'Items Updated',
        description: `Applied ${code} to ${itemIds.length} selected items (not saved - no project selected)`,
      });
    }
    
    setSelectedItems(new Set());
    setSelectedGroups(new Set());
  }, [selectedItems, data, onDataUpdate, projectId, batchUpdateMaterialCodes]);

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedItems(new Set());
    setSelectedGroups(new Set());
  };
  
  // Select all visible groups AND their items
  const selectAllVisible = () => {
    const newGroups = new Set<string>();
    const newItems = new Set<string>();
    
    filteredGroups.forEach(group => {
      newGroups.add(group.materialSpec);
      group.subGroups.forEach(sg => {
        newGroups.add(`${group.materialSpec}|${sg.itemType}`);
        sg.items.forEach(item => newItems.add(String(item.id)));
      });
    });
    
    setSelectedGroups(newGroups);
    setSelectedItems(newItems);
  };
  
  // Get count of visible subgroups for the button label
  const visibleSubGroupCount = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + g.subGroups.length, 0);
  }, [filteredGroups]);

  // Render parent status badge with detailed assignment tracking
  const renderParentStatusBadge = (group: MaterialGroup) => {
    const { assignmentStatus, assignedChildCount, totalChildCount, assignedCode } = group;
    
    if (assignmentStatus === 'none') {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          0/{totalChildCount} Assigned
        </Badge>
      );
    }
    
    if (assignmentStatus === 'partial') {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {assignedChildCount}/{totalChildCount} Assigned
        </Badge>
      );
    }
    
    if (assignedCode === 'MIXED') {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          <Check className="h-3 w-3 mr-1" />
          {totalChildCount}/{totalChildCount} Complete
        </Badge>
      );
    }
    
    const codeInfo = allMaterialCodes.find(c => c.code === assignedCode);
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-mono">
        <Check className="h-3 w-3 mr-1" />
        {assignedCode}
        {codeInfo && <span className="ml-1 font-normal opacity-75 truncate max-w-32">- {codeInfo.description}</span>}
      </Badge>
    );
  };

  // Render child status badge
  const renderChildStatusBadge = (typeGroup: ItemTypeGroup) => {
    const { assignedCode, isFullyAssigned } = typeGroup;
    
    if (!assignedCode) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Unassigned
        </Badge>
      );
    }
    
    if (assignedCode === 'MIXED') {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <Layers className="h-3 w-3 mr-1" />
          Mixed
        </Badge>
      );
    }
    
    const codeInfo = allMaterialCodes.find(c => c.code === assignedCode);
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 font-mono">
        <Check className="h-3 w-3 mr-1" />
        {assignedCode}
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
              <span className="font-mono font-semibold">{code.code}</span>
              <span className="ml-2 opacity-70 truncate">{code.description}</span>
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
          {/* Needs Attention Alert */}
          {groupsNeedingAttention.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Incomplete Assignments
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {groupsNeedingAttention.length} material spec{groupsNeedingAttention.length > 1 ? 's' : ''} have 
                    unassigned item types. Expand them to complete assignments.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={expandAllIncomplete}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-700 border-amber-300"
                    >
                      Expand All Incomplete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterStatus('needs-attention')}
                      className="text-amber-700 hover:bg-amber-100"
                    >
                      Filter to Show Only
                    </Button>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-600">
                  {groupsNeedingAttention.length}
                </span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Hash className="h-4 w-4" />
                Needing Assignment
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.needingTotal.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">of {stats.total.toLocaleString()} total</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                <Check className="h-4 w-4" />
                Assigned
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.needingAssigned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.needingTotal > 0 ? ((stats.needingAssigned / stats.needingTotal) * 100).toFixed(1) : 0}%</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive text-sm mb-1">
                <AlertCircle className="h-4 w-4" />
                Still Needed
              </div>
              <div className="text-2xl font-bold text-destructive">{stats.needingUnassigned.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.needingTotal > 0 ? ((stats.needingUnassigned / stats.needingTotal) * 100).toFixed(1) : 0}%</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Ban className="h-4 w-4" />
                Excluded
              </div>
              <div className="text-2xl font-bold text-muted-foreground">{(stats.dismissed + stats.zeroValue).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.dismissed} dismissed, {stats.zeroValue} $0</div>
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
              <span className="text-sm font-medium text-foreground">Assignment Progress (items with value)</span>
              <span className="text-sm text-muted-foreground">{stats.needingAssigned} / {stats.needingTotal} items</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.needingTotal > 0 ? (stats.needingAssigned / stats.needingTotal) * 100 : 0}%` }}
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
                  placeholder="Search specs or item types..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups & Types</SelectItem>
                    <SelectItem value="unassigned">○ Unassigned Only</SelectItem>
                    <SelectItem value="needs-attention">⚠️ Needs Attention</SelectItem>
                    <SelectItem value="assigned">✓ Assigned Only</SelectItem>
                    <SelectItem value="zero-value">$0 Zero Value</SelectItem>
                    <SelectItem value="dismissed">🚫 Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Select value={systemFilter} onValueChange={setSystemFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Systems" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    {uniqueSystems.map(system => (
                      <SelectItem key={system} value={system}>{system}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Item Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Item Types</SelectItem>
                    {uniqueItemTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Select All Visible ({visibleSubGroupCount})
              </Button>
              {(selectedGroups.size > 0 || selectedItems.size > 0) && (
                <Button variant="outline" size="sm" onClick={clearAllSelections}>
                  <X className="h-4 w-4 mr-1" />
                  Deselect All
                </Button>
              )}
              {expandedSpecs.size > 0 && (
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse All
                </Button>
              )}
            </div>

            {(selectedGroups.size > 0 || selectedItems.size > 0) && (
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
                <Button variant="ghost" size="sm" onClick={clearAllSelections}>
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
                const isExpanded = expandedSpecs.has(group.materialSpec);
                
                return (
                <div key={group.materialSpec}>
                  {/* Material Spec Row */}
                  <div 
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer hover:bg-muted/50 transition-colors ${
                      parentState !== 'unchecked' ? 'bg-primary/5' : ''
                    } ${group.hasUnassignedChildren && !isExpanded ? 'border-l-4 border-amber-400' : ''}`}
                    onClick={() => toggleSpec(group.materialSpec)}
                  >
                    <div className="col-span-1 flex items-center gap-2">
                      <Checkbox
                        checked={parentState === 'checked' ? true : parentState === 'indeterminate' ? 'indeterminate' : false}
                        onClick={e => toggleParentSelection(group.materialSpec, group, e as unknown as React.MouseEvent)}
                      />
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{group.materialSpec}</span>
                        <span className="text-xs text-muted-foreground">({group.subGroups.length} types)</span>
                        {/* Warning indicator when collapsed and has unassigned */}
                        {group.hasUnassignedChildren && !isExpanded && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs animate-pulse">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            {group.unassignedChildCount} need codes
                          </Badge>
                        )}
                      </div>
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
                            {renderParentStatusBadge(group)}
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
                  {isExpanded && (
                    <div className="bg-muted/20">
                    {group.subGroups.map(typeGroup => {
                      const childKey = `${group.materialSpec}|${typeGroup.itemType}`;
                      const isChildSelected = selectedGroups.has(childKey);
                      const needsAttention = !typeGroup.isFullyAssigned;
                      
                      return (
                        <div key={childKey}>
                          {/* Item Type Row */}
                          <div 
                            className={`grid grid-cols-12 gap-4 px-4 py-2 items-center cursor-pointer hover:bg-muted/50 transition-colors pl-12 ${
                              isChildSelected ? 'bg-primary/5' : ''
                            } ${needsAttention ? 'border-l-2 border-amber-300' : ''}`}
                            onClick={() => toggleType(group.materialSpec, typeGroup.itemType)}
                          >
                            <div className="col-span-1 flex items-center gap-2">
                              {(() => {
                                const selState = getGroupSelectionState(typeGroup);
                                return (
                                  <Checkbox
                                    checked={selState.checked ? true : selState.indeterminate ? 'indeterminate' : false}
                                    onClick={e => toggleChildSelection(group.materialSpec, typeGroup.itemType, typeGroup, e as unknown as React.MouseEvent)}
                                  />
                                );
                              })()}
                              {expandedTypes.has(`${group.materialSpec}|${typeGroup.itemType}`) ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="col-span-4 flex items-center gap-2">
                              <span className={`text-sm ${needsAttention ? 'text-amber-700 font-medium' : 'text-foreground'}`}>
                                {typeGroup.itemType}
                              </span>
                              {(() => {
                                const selState = getGroupSelectionState(typeGroup);
                                if (selState.selectedCount > 0) {
                                  return (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      selState.checked 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-primary/10 text-primary'
                                    }`}>
                                      {selState.selectedCount}/{selState.totalCount} selected
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                              {typeGroup.itemCount.toLocaleString()}
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-muted-foreground">
                              ${typeGroup.totalMaterial.toLocaleString()}
                            </div>
                            <div className="col-span-3 flex items-center gap-2">
                              {/* Show dismiss button for $0 value groups */}
                              {typeGroup.totalMaterial <= 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allDismissed = typeGroup.items.every(i => i.excludedFromMaterialBudget);
                                    handleDismissGroup(`${group.materialSpec}|${typeGroup.itemType}`, !allDismissed);
                                  }}
                                  title={typeGroup.items.every(i => i.excludedFromMaterialBudget) ? "Restore to budget" : "Dismiss $0 items"}
                                >
                                  {typeGroup.items.every(i => i.excludedFromMaterialBudget) ? (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Restore
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="h-3 w-3 mr-1" />
                                      Dismiss
                                    </>
                                  )}
                                </Button>
                              )}
                              {typeGroup.totalMaterial > 0 && (
                                <Popover 
                                  open={openCodePicker === `${group.materialSpec}|${typeGroup.itemType}`} 
                                  onOpenChange={(open) => setOpenCodePicker(open ? `${group.materialSpec}|${typeGroup.itemType}` : null)}
                                >
                                  <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" className="h-auto p-1 hover:bg-muted">
                                      {renderChildStatusBadge(typeGroup)}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0" align="start">
                                    <CodePicker 
                                      groupKey={`${group.materialSpec}|${typeGroup.itemType}`} 
                                      onSelect={(code) => {
                                        // If items are selected within this group, only update those
                                        const groupItemIds = typeGroup.items.map(i => String(i.id));
                                        const selectedInGroup = groupItemIds.filter(id => selectedItems.has(id));
                                        
                                        if (selectedInGroup.length > 0) {
                                          // Update only selected items
                                          handleItemLevelAssign(code);
                                        } else {
                                          // No items selected, update entire group
                                          handleAssignCode(`${group.materialSpec}|${typeGroup.itemType}`, code);
                                        }
                                      }} 
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                              {/* Show N/A badge for $0 items */}
                              {typeGroup.totalMaterial <= 0 && (
                                <Badge variant="outline" className="text-muted-foreground border-muted bg-muted/30">
                                  $0 - N/A
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Expanded Items with Pagination */}
                          {expandedTypes.has(`${group.materialSpec}|${typeGroup.itemType}`) && (() => {
                            const groupKey = `${group.materialSpec}|${typeGroup.itemType}`;
                            const itemSearchTerm = getSearchForGroup(groupKey).toLowerCase();
                            const currentPage = getPageForGroup(groupKey);
                            const itemFilter = getItemFilterForGroup(groupKey);
                            
                            // Filter items by search term AND assignment status
                            const filteredItems = typeGroup.items.filter(item => {
                              // Search filter
                              const matchesSearch = !itemSearchTerm || 
                                (item.itemName || '').toLowerCase().includes(itemSearchTerm) ||
                                (item.materialDesc || '').toLowerCase().includes(itemSearchTerm) ||
                                (item.size || '').toLowerCase().includes(itemSearchTerm) ||
                                (item.system || '').toLowerCase().includes(itemSearchTerm);
                              
                              if (!matchesSearch) return false;
                              
                              // Assignment status filter
                              if (itemFilter === 'assigned') return !!item.materialCostCode;
                              if (itemFilter === 'unassigned') return !item.materialCostCode;
                              return true;
                            });
                            
                            const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
                            const paginatedItems = filteredItems.slice(
                              (currentPage - 1) * ITEMS_PER_PAGE,
                              currentPage * ITEMS_PER_PAGE
                            );
                            const pageItemIds = paginatedItems.map(i => String(i.id));
                            const allPageSelected = pageItemIds.length > 0 && pageItemIds.every(id => selectedItems.has(id));
                            const somePageSelected = pageItemIds.some(id => selectedItems.has(id));
                            
                            // Stats for this group
                            const totalInGroup = typeGroup.items.length;
                            const assignedInGroup = typeGroup.items.filter(i => i.materialCostCode).length;
                            const unassignedInGroup = totalInGroup - assignedInGroup;
                            
                            return (
                              <div className="bg-background border-l-2 border-primary/20 ml-16">
                                {/* Search & Pagination Controls */}
                                <div className="px-4 py-2 bg-muted/30 border-b flex items-center justify-between gap-4 flex-wrap">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <Search className="h-4 w-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Search items..."
                                        value={getSearchForGroup(groupKey)}
                                        onChange={(e) => {
                                          setExpandedItemSearch(prev => ({ ...prev, [groupKey]: e.target.value }));
                                          setExpandedItemPages(prev => ({ ...prev, [groupKey]: 1 }));
                                        }}
                                        className="h-7 text-xs w-40"
                                      />
                                    </div>
                                    {/* Item-level filter */}
                                    <Select 
                                      value={itemFilter} 
                                      onValueChange={(v) => {
                                        setExpandedItemFilter(prev => ({ ...prev, [groupKey]: v as 'all' | 'assigned' | 'unassigned' }));
                                        setExpandedItemPages(prev => ({ ...prev, [groupKey]: 1 }));
                                      }}
                                    >
                                      <SelectTrigger className="h-7 w-36 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">All Items ({totalInGroup})</SelectItem>
                                        <SelectItem value="assigned">✓ Assigned ({assignedInGroup})</SelectItem>
                                        <SelectItem value="unassigned">○ Unassigned ({unassignedInGroup})</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {/* Select All / Deselect All */}
                                    <div className="flex items-center gap-1 text-xs">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const allIds = typeGroup.items.map(i => String(i.id));
                                          setSelectedItems(prev => {
                                            const next = new Set(prev);
                                            allIds.forEach(id => next.add(id));
                                            return next;
                                          });
                                        }}
                                        className="text-primary hover:underline"
                                      >
                                        Select All {typeGroup.items.length}
                                      </button>
                                      <span className="text-muted-foreground">|</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const allIds = typeGroup.items.map(i => String(i.id));
                                          setSelectedItems(prev => {
                                            const next = new Set(prev);
                                            allIds.forEach(id => next.delete(id));
                                            return next;
                                          });
                                        }}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        Deselect All
                                      </button>
                                    </div>

                                    {/* Pagination Controls */}
                                    {filteredItems.length > ITEMS_PER_PAGE && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredItems.length)}-
                                          {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length}
                                        </span>
                                        <div className="flex gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedItemPages(prev => ({ 
                                                ...prev, 
                                                [groupKey]: Math.max(1, currentPage - 1) 
                                              }));
                                            }}
                                            disabled={currentPage === 1}
                                          >
                                            ← Prev
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedItemPages(prev => ({ 
                                                ...prev, 
                                                [groupKey]: Math.min(totalPages, currentPage + 1) 
                                              }));
                                            }}
                                            disabled={currentPage >= totalPages}
                                          >
                                            Next →
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Items Table */}
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="px-2 py-2 w-10">
                                        <Checkbox
                                          checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                                          onCheckedChange={() => {
                                            setSelectedItems(prev => {
                                              const next = new Set(prev);
                                              if (allPageSelected) {
                                                pageItemIds.forEach(id => next.delete(id));
                                              } else {
                                                pageItemIds.forEach(id => next.add(id));
                                              }
                                              return next;
                                            });
                                          }}
                                          title={allPageSelected ? "Deselect this page" : "Select this page"}
                                        />
                                      </th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">System</th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Material $</th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {paginatedItems.length === 0 ? (
                                      <tr>
                                        <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                                          {itemSearchTerm ? 'No items match your search' : 'No items'}
                                        </td>
                                      </tr>
                                    ) : (
                                      paginatedItems.map(item => {
                                        const isSelected = selectedItems.has(String(item.id));
                                        return (
                                          <tr 
                                            key={item.id} 
                                            className={`hover:bg-muted/30 cursor-pointer ${isSelected ? 'bg-primary/10' : ''}`}
                                            onClick={() => toggleItemSelection(String(item.id))}
                                          >
                                            <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleItemSelection(String(item.id))}
                                              />
                                            </td>
                                            <td className="px-3 py-2 text-foreground font-medium">{item.system || '—'}</td>
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
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
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

      {/* Floating Action Bar for Item-Level Selection */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50">
          <span className="text-sm font-medium">
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-muted-foreground/50" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm" className="h-8">
                Assign Code
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="center" side="top">
              <Command>
                <CommandInput placeholder="Search codes..." />
                <CommandList>
                  <CommandEmpty>No code found.</CommandEmpty>
                  <CommandGroup heading="Material Codes">
                    {allMaterialCodes.map(code => (
                      <CommandItem
                        key={code.code}
                        value={`${code.code} ${code.description}`}
                        onSelect={() => handleItemLevelAssign(code.code)}
                      >
                        <span className="font-mono mr-2">{code.code}</span>
                        <span className="opacity-70 truncate">{code.description}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-muted-foreground hover:text-background"
            onClick={() => {
              setSelectedItems(new Set());
              setSelectedGroups(new Set());
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

export default MaterialMappingTab;
