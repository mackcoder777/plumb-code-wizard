import React, { useState, useMemo, useCallback } from 'react';
import { EstimateItem } from '@/types/estimate';
import type { CategoryMaterialDescOverride } from '@/hooks/useCategoryMaterialDescOverrides';
import type { MaterialDescLaborPattern } from '@/hooks/useMaterialDescLaborPatterns';
import { useCategoryMappings, useSaveCategoryMapping, useDeleteCategoryMapping, useCategoryIndex, CategoryLaborMapping as CategoryMapping, isUsingSystemMapping, SYSTEM_MAPPING_VALUE } from '@/hooks/useCategoryMappings';
import { useLaborCodes } from '@/hooks/useCostCodes';
import {
  useCategoryMaterialDescOverrides,
  useSaveCategoryMaterialDescOverride,
  useDeleteCategoryMaterialDescOverride,
} from '@/hooks/useCategoryMaterialDescOverrides';
import { useMaterialDescLaborPatterns, useRecordMaterialDescLaborPattern } from '@/hooks/useMaterialDescLaborPatterns';
import { useCategoryLaborPatterns, useRecordCategoryLaborPattern, getSuggestionForCategory, MIN_SUGGESTION_CONFIDENCE } from '@/hooks/useCategoryLaborPatterns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Tag, Check, X, Loader2, AlertCircle, Link2, ExternalLink, Layers, ChevronsUpDown, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { TableRowCombobox } from '@/components/tabs/SystemMappingTab/TableRowCombobox';
import { MaterialDescSection } from '@/components/CategoryLaborMapping/MaterialDescSection';

interface CategoryLaborMappingPanelProps {
  data: EstimateItem[];
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
  onViewCategoryItems?: (category: string) => void;
}

// Memoized wrapper that binds categoryName and computes materialDescGroups
interface BoundMaterialDescSectionProps {
  categoryName: string;
  categoryLaborCode: string | null;
  materialDescOverrides: CategoryMaterialDescOverride[];
  laborCodes: { code: string; description: string }[];
  patterns: MaterialDescLaborPattern[];
  estimateData: EstimateItem[];
  onSave: (categoryName: string, materialDescription: string, laborCode: string) => Promise<void>;
  onDelete: (categoryName: string, materialDescription: string) => Promise<void>;
}

const BoundMaterialDescSection = React.memo(function BoundMaterialDescSection({
  categoryName, categoryLaborCode, materialDescOverrides, laborCodes, patterns,
  estimateData, onSave, onDelete,
}: BoundMaterialDescSectionProps) {
  const materialDescGroups = useMemo(() => {
    const groups: Record<string, {
      items: number;
      hours: number;
      samples: string[];
      rawItems: Array<{ drawing?: string; system?: string; itemName?: string; size?: string; qty?: number; hours?: number }>;
    }> = {};
    estimateData.forEach(item => {
      if (item.reportCat !== categoryName) return;
      const desc = item.materialDesc || 'No Description';
      if (!groups[desc]) groups[desc] = { items: 0, hours: 0, samples: [], rawItems: [] };
      groups[desc].items++;
      groups[desc].hours += item.hours || 0;
      if (groups[desc].samples.length < 2 && item.itemName) {
        groups[desc].samples.push(item.itemName);
      }
      if (groups[desc].rawItems.length < 50) {
        groups[desc].rawItems.push({
          drawing: item.drawing,
          system: item.system,
          itemName: item.itemName,
          size: item.size,
          qty: item.quantity,
          hours: item.hours,
        });
      }
    });
    return Object.entries(groups)
      .filter(([, d]) => d.hours > 0)
      .sort((a, b) => b[1].hours - a[1].hours)
      .map(([desc, d]) => ({ desc, ...d }));
  }, [estimateData, categoryName]);

  const boundOnSave = useCallback(
    (materialDescription: string, laborCode: string) => onSave(categoryName, materialDescription, laborCode),
    [categoryName, onSave]
  );
  const boundOnDelete = useCallback(
    (materialDescription: string) => onDelete(categoryName, materialDescription),
    [categoryName, onDelete]
  );

  return (
    <MaterialDescSection
      categoryName={categoryName}
      categoryLaborCode={categoryLaborCode}
      materialDescGroups={materialDescGroups}
      materialDescOverrides={materialDescOverrides}
      laborCodes={laborCodes}
      patterns={patterns}
      onSave={boundOnSave}
      onDelete={boundOnDelete}
    />
  );
});

export const CategoryLaborMappingPanel: React.FC<CategoryLaborMappingPanelProps> = ({
  data,
  projectId,
  onMappingsChange,
  onViewCategoryItems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [comboOpenMap, setComboOpenMap] = useState<Record<string, boolean>>({});
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Get category index from estimate data
  const categoryIndex = useCategoryIndex(data);
  
  // Load existing mappings from database
  const { data: dbMappings = [], isLoading: isLoadingMappings } = useCategoryMappings(projectId);
  const saveMappingMutation = useSaveCategoryMapping();
  const deleteMappingMutation = useDeleteCategoryMapping();
  
  // Load labor codes
  const { data: laborCodes = [] } = useLaborCodes();
  
  // Material description overrides
  const { data: materialDescOverrides = [] } = useCategoryMaterialDescOverrides(projectId);
  const saveOverride = useSaveCategoryMaterialDescOverride(projectId);
  const deleteOverride = useDeleteCategoryMaterialDescOverride(projectId);
  
  // Material description learning patterns
  const { data: materialDescPatterns = [] } = useMaterialDescLaborPatterns();
  const recordPattern = useRecordMaterialDescLaborPattern();

  // Category-level learning patterns
  const { data: categoryPatterns = [] } = useCategoryLaborPatterns();
  const recordCategoryPattern = useRecordCategoryLaborPattern();

  // Stable callbacks for material desc overrides
  const handleSaveOverride = useCallback(
    async (categoryName: string, materialDescription: string, laborCode: string) => {
      await saveOverride.mutateAsync({ categoryName, materialDescription, laborCode });
      recordPattern.mutate({ materialDescription, laborCode });
    },
    [saveOverride, recordPattern]
  );

  const handleDeleteOverride = useCallback(
    async (categoryName: string, materialDescription: string) => {
      await deleteOverride.mutateAsync({ categoryName, materialDescription });
    },
    [deleteOverride]
  );
  
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
  
  // Override counts per category for badge display
  const overrideCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    materialDescOverrides.forEach(o => {
      const key = (o.category_name || '').toLowerCase().trim();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [materialDescOverrides]);

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
    
    setHasInteracted(true);
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
            // Record to global learning (skip __SYSTEM__ sentinel)
            if (!isUsingSystemMapping(laborCode)) {
              recordCategoryPattern.mutate({ categoryName: category, laborCode });
            }
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
                <div className="flex items-center">
                  <h3 className="font-semibold">Category Labor Mapping</h3>
                  {hasInteracted && (
                    <span className="flex items-center gap-1 text-xs ml-3">
                      {(saveMappingMutation.isPending || deleteMappingMutation.isPending) ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground">Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">All changes saved</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
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
                    const suggestion = (!currentCode || currentCode === 'none')
                      ? getSuggestionForCategory(cat.category, categoryPatterns)
                      : null;
                    
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
                              {(() => {
                                const overrideCount = overrideCountByCategory[(cat.category || '').toLowerCase().trim()] || 0;
                                return overrideCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                                    <Layers className="h-3 w-3" />
                                    {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {suggestion && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                                title={`Suggested: ${suggestion.laborCode} (used ${suggestion.usageCount}× across projects, confidence ${(suggestion.confidence * 100).toFixed(0)}%)`}
                                onClick={() => handleMappingChange(cat.category, suggestion.laborCode)}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                {suggestion.laborCode}
                              </Button>
                            )}
                            <div className="w-64">
                            <Popover
                              open={comboOpenMap[cat.category] || false}
                              onOpenChange={(open) => setComboOpenMap(prev => ({ ...prev, [cat.category]: open }))}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between h-9 text-sm font-normal",
                                    isMapped && "border-primary/50",
                                    usesSystem && "border-muted-foreground/50"
                                  )}
                                >
                                  <span className="truncate">
                                    {!currentCode || currentCode === 'none'
                                      ? 'Inherit System (default)'
                                      : currentCode === '__SYSTEM__'
                                        ? 'Use System Mapping'
                                        : `${currentCode} — ${laborCodes.find(c => c.code === currentCode)?.description || ''}`}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-0 z-50" align="end">
                                <Command>
                                  <CommandInput placeholder="Search labor codes..." />
                                  <CommandList className="max-h-[300px]">
                                    <CommandEmpty>No codes found</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem
                                        value="inherit system default none"
                                        onSelect={() => { handleMappingChange(cat.category, 'none'); setComboOpenMap(prev => ({ ...prev, [cat.category]: false })); }}
                                        className="text-sm"
                                      >
                                        <Check className={cn("mr-2 h-3 w-3", (!currentCode || currentCode === 'none') ? "opacity-100" : "opacity-0")} />
                                        Inherit System (default)
                                      </CommandItem>
                                      <CommandItem
                                        value="use system mapping explicit"
                                        onSelect={() => { handleMappingChange(cat.category, SYSTEM_MAPPING_VALUE); setComboOpenMap(prev => ({ ...prev, [cat.category]: false })); }}
                                        className="text-sm"
                                      >
                                        <Check className={cn("mr-2 h-3 w-3", usesSystem ? "opacity-100" : "opacity-0")} />
                                        <Link2 className="h-3 w-3 mr-1 text-muted-foreground" />
                                        Use System Mapping
                                      </CommandItem>
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup heading="Labor Codes">
                                      {laborCodes.map((code) => (
                                        <CommandItem
                                          key={code.id}
                                          value={`${code.code} ${code.description}`}
                                          onSelect={() => { handleMappingChange(cat.category, code.code); setComboOpenMap(prev => ({ ...prev, [cat.category]: false })); }}
                                          className="text-xs"
                                        >
                                          <Check className={cn("mr-2 h-3 w-3", currentCode === code.code ? "opacity-100" : "opacity-0")} />
                                          <span className="font-mono mr-2">{code.code}</span>
                                          <span className="truncate text-muted-foreground">{code.description}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        
                        {/* Expanded Preview Section */}
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2 bg-muted/20">
                            {/* Category Composition Summary */}
                            <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                              {/* Systems */}
                              <div>
                                <p className="text-muted-foreground font-medium mb-1.5">Systems in this category</p>
                                <div className="space-y-1">
                                  {cat.topSystems.map(s => (
                                    <div key={s.system} className="flex items-center justify-between gap-2">
                                      <span className="truncate text-foreground">{s.system}</span>
                                      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                                        <span className="bg-muted px-1.5 py-0.5 rounded">{s.count}</span>
                                        <span>{s.hours.toFixed(1)}h</span>
                                      </div>
                                    </div>
                                  ))}
                                  {cat.systemCount > 5 && (
                                    <p className="text-muted-foreground">+{cat.systemCount - 5} more</p>
                                  )}
                                </div>
                              </div>

                              {/* Material Families */}
                              <div>
                                <p className="text-muted-foreground font-medium mb-1.5">Material families</p>
                                <div className="space-y-1">
                                  {cat.topMaterialDescs.map(m => (
                                    <div key={m.desc} className="flex items-center justify-between gap-2">
                                      <span className="truncate text-foreground">{m.desc}</span>
                                      <span className="bg-muted px-1.5 py-0.5 rounded shrink-0 text-muted-foreground">{m.count}</span>
                                    </div>
                                  ))}
                                  {cat.descCount > 5 && (
                                    <p className="text-muted-foreground">+{cat.descCount - 5} more</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {onViewCategoryItems && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => onViewCategoryItems(cat.category)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View All {cat.itemCount.toLocaleString()} Items in Estimates
                              </Button>
                            )}
                            
                            {/* Material Description Router */}
                            <BoundMaterialDescSection
                              categoryName={cat.category}
                              categoryLaborCode={currentCode ?? null}
                              materialDescOverrides={materialDescOverrides}
                              laborCodes={laborCodes}
                              patterns={materialDescPatterns}
                              estimateData={data}
                              onSave={handleSaveOverride}
                              onDelete={handleDeleteOverride}
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