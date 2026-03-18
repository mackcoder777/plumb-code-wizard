import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { useCategoryMappings, useSaveCategoryMapping, useDeleteCategoryMapping, useCategoryIndex, CategoryLaborMapping as CategoryMapping, isUsingSystemMapping, SYSTEM_MAPPING_VALUE } from '@/hooks/useCategoryMappings';
import { useLaborCodes } from '@/hooks/useCostCodes';
import {
  useCategoryItemTypeOverrides,
  useSaveCategoryItemTypeOverride,
  useDeleteCategoryItemTypeOverride,
} from '@/hooks/useCategoryItemTypeOverrides';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Tag, Check, X, Loader2, AlertCircle, Link2, Eye, ExternalLink, Layers } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { TableRowCombobox } from '@/components/tabs/SystemMappingTab/TableRowCombobox';
import { ItemTypeOverridesSection } from '@/components/CategoryLaborMapping/ItemTypeOverridesSection';

interface CategoryLaborMappingPanelProps {
  data: EstimateItem[];
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
  onViewCategoryItems?: (category: string) => void;
}

export const CategoryLaborMappingPanel: React.FC<CategoryLaborMappingPanelProps> = ({
  data,
  projectId,
  onMappingsChange,
  onViewCategoryItems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Get category index from estimate data
  const categoryIndex = useCategoryIndex(data);
  
  // Load existing mappings from database
  const { data: dbMappings = [], isLoading: isLoadingMappings } = useCategoryMappings(projectId);
  const saveMappingMutation = useSaveCategoryMapping();
  const deleteMappingMutation = useDeleteCategoryMapping();
  
  // Load labor codes
  const { data: laborCodes = [] } = useLaborCodes();
  
  // Item-type overrides
  const { data: itemTypeOverrides = [] } = useCategoryItemTypeOverrides(projectId);
  const saveOverride = useSaveCategoryItemTypeOverride(projectId);
  const deleteOverride = useDeleteCategoryItemTypeOverride(projectId);
  const [selectedItemTypes, setSelectedItemTypes] = useState<Record<string, Set<string>>>({});
  
  // Build mappings lookup
  const mappingsLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    dbMappings.forEach(m => {
      lookup[m.category_name.toLowerCase().trim()] = m.labor_code;
    });
    return lookup;
  }, [dbMappings]);
  
  // Filter out "Unknown" category if it exists (must be before stats calculation)
  const filteredCategories = useMemo(() => {
    return categoryIndex.filter(c => c.category !== 'Unknown' && c.category.trim() !== '');
  }, [categoryIndex]);
  
  // Statistics with three states: mapped, useSystem, unset
  const stats = useMemo(() => {
    const total = filteredCategories.length;
    const mapped = filteredCategories.filter(c => {
      const code = mappingsLookup[c.category.toLowerCase().trim()];
      return code && !isUsingSystemMapping(code);
    }).length;
    const useSystem = filteredCategories.filter(c => {
      const code = mappingsLookup[c.category.toLowerCase().trim()];
      return isUsingSystemMapping(code);
    }).length;
    const unset = total - mapped - useSystem;
    return { total, mapped, useSystem, unset };
  }, [filteredCategories, mappingsLookup]);
  
  // Notify parent when mappings change
  React.useEffect(() => {
    if (onMappingsChange) {
      onMappingsChange(mappingsLookup);
    }
  }, [mappingsLookup, onMappingsChange]);
  
  // Handle mapping change
  const handleMappingChange = (category: string, laborCode: string) => {
    if (!projectId) {
      toast({
        title: "No Project Selected",
        description: "Please select a project to save category mappings.",
        variant: "destructive",
      });
      return;
    }
    
    if (laborCode === 'none') {
      // Delete mapping
      deleteMappingMutation.mutate(
        { projectId, categoryName: category },
        {
          onSuccess: () => {
            toast({
              title: "Mapping Removed",
              description: `Removed labor code mapping for "${category}"`,
            });
          },
        }
      );
    } else {
      // Save mapping (including __SYSTEM__ value)
      saveMappingMutation.mutate(
        { projectId, categoryName: category, laborCode },
        {
          onSuccess: () => {
            const message = isUsingSystemMapping(laborCode)
              ? `"${category}" will use System Mapping`
              : `Assigned ${laborCode} to "${category}"`;
            toast({
              title: "Mapping Saved",
              description: message,
            });
          },
        }
      );
    }
  };
  
  // Get current labor code for a category
  const getLaborCode = (category: string): string | undefined => {
    return mappingsLookup[category.toLowerCase().trim()];
  };
  
  // Toggle category expansion
  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  // Get preview items for a category (first 5)
  const getPreviewItems = (category: string): EstimateItem[] => {
    return data
      .filter(item => item.reportCat === category)
      .slice(0, 5);
  };
  
  if (filteredCategories.length === 0) {
    return null; // Don't show panel if no categories
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <Tag className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold">Category Labor Mapping</h3>
                <p className="text-sm text-muted-foreground">
                  Assign labor codes by Report Category (takes priority over System mapping)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-background">
                {stats.mapped} mapped
              </Badge>
              {stats.useSystem > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {stats.useSystem} use system
                </Badge>
              )}
              {stats.unset > 0 && (
                <Badge variant="outline">
                  {stats.unset} unset
                </Badge>
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {isLoadingMappings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading mappings...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  Category mappings override System mappings for labor code assignment. Select "Use System Mapping" to defer to system-level codes.
                </div>
                
                <div className="grid gap-2">
                  {filteredCategories.map((cat) => {
                    const currentCode = getLaborCode(cat.category);
                    const isMapped = !!currentCode && !isUsingSystemMapping(currentCode);
                    const usesSystem = isUsingSystemMapping(currentCode);
                    const isExpanded = expandedCategories.has(cat.category);
                    const previewItems = isExpanded ? getPreviewItems(cat.category) : [];
                    
                    return (
                      <div
                        key={cat.category}
                        className={cn(
                          "rounded-lg border transition-colors",
                          isMapped ? "bg-primary/10 border-primary/30" : 
                          usesSystem ? "bg-muted/50 border-muted-foreground/30" : 
                          "bg-background border-border"
                        )}
                      >
                        {/* Category Header Row */}
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              onClick={() => toggleCategoryExpansion(cat.category)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {isMapped ? (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            ) : usesSystem ? (
                              <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-medium truncate block">{cat.category}</span>
                              <span className="text-xs text-muted-foreground">
                                {cat.itemCount.toLocaleString()} items • {cat.totalHours.toFixed(1)} hrs
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex-shrink-0 w-64">
                            <Select
                              value={currentCode || 'none'}
                              onValueChange={(value) => handleMappingChange(cat.category, value)}
                            >
                              <SelectTrigger className={cn(
                                "h-9",
                                isMapped && "border-primary/50",
                                usesSystem && "border-muted-foreground/50"
                              )}>
                                <SelectValue placeholder="Select labor code..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  <span className="text-muted-foreground">No mapping (unset)</span>
                                </SelectItem>
                                <SelectItem value={SYSTEM_MAPPING_VALUE}>
                                  <span className="flex items-center gap-2">
                                    <Link2 className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground font-medium">Use System Mapping</span>
                                  </span>
                                </SelectItem>
                                <SelectSeparator />
                                {laborCodes.map((code) => (
                                  <SelectItem key={code.id} value={code.code}>
                                    <span className="font-mono">{code.code}</span>
                                    <span className="ml-2 text-muted-foreground">- {code.description}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Expanded Preview Section */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 bg-muted/20">
                            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              Preview Items ({Math.min(5, cat.itemCount)} of {cat.itemCount})
                            </div>
                            <div className="rounded border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="h-8 text-xs">Drawing</TableHead>
                                    <TableHead className="h-8 text-xs">System</TableHead>
                                    <TableHead className="h-8 text-xs">Material Desc</TableHead>
                                    <TableHead className="h-8 text-xs text-right">Qty</TableHead>
                                    <TableHead className="h-8 text-xs text-right">Hours</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {previewItems.map((item, idx) => (
                                    <TableRow key={`${item.id}-${idx}`} className="text-xs">
                                      <TableCell className="py-1.5">{item.drawing || '-'}</TableCell>
                                      <TableCell className="py-1.5">{item.system || '-'}</TableCell>
                                      <TableCell className="py-1.5 max-w-[200px] truncate">{item.materialDesc || '-'}</TableCell>
                                      <TableCell className="py-1.5 text-right">{item.quantity?.toLocaleString() || 0}</TableCell>
                                      <TableCell className="py-1.5 text-right">{item.hours?.toFixed(1) || '0.0'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            {onViewCategoryItems && cat.itemCount > 5 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs h-7"
                                onClick={() => onViewCategoryItems(cat.category)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View All {cat.itemCount} Items in Estimates
                              </Button>
                            )}
                            
                            {/* Item-Type Overrides Section */}
                            <ItemTypeOverridesSection
                              category={cat.category}
                              currentCategoryCode={currentCode}
                              data={data}
                              laborCodes={laborCodes}
                              itemTypeOverrides={itemTypeOverrides}
                              saveOverride={saveOverride}
                              deleteOverride={deleteOverride}
                              selectedItemTypes={selectedItemTypes}
                              setSelectedItemTypes={setSelectedItemTypes}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {filteredCategories.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center mt-3">
                    Showing {filteredCategories.length} categories from estimate
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};