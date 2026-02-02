import React, { useState, useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { useCategoryMappings, useSaveCategoryMapping, useDeleteCategoryMapping, useCategoryIndex, CategoryLaborMapping as CategoryMapping } from '@/hooks/useCategoryMappings';
import { useLaborCodes } from '@/hooks/useCostCodes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Tag, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface CategoryLaborMappingPanelProps {
  data: EstimateItem[];
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
}

export const CategoryLaborMappingPanel: React.FC<CategoryLaborMappingPanelProps> = ({
  data,
  projectId,
  onMappingsChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get category index from estimate data
  const categoryIndex = useCategoryIndex(data);
  
  // Load existing mappings from database
  const { data: dbMappings = [], isLoading: isLoadingMappings } = useCategoryMappings(projectId);
  const saveMappingMutation = useSaveCategoryMapping();
  const deleteMappingMutation = useDeleteCategoryMapping();
  
  // Load labor codes
  const { data: laborCodes = [] } = useLaborCodes();
  
  // Build mappings lookup
  const mappingsLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    dbMappings.forEach(m => {
      lookup[m.category_name.toLowerCase().trim()] = m.labor_code;
    });
    return lookup;
  }, [dbMappings]);
  
  // Notify parent when mappings change
  React.useEffect(() => {
    if (onMappingsChange) {
      onMappingsChange(mappingsLookup);
    }
  }, [mappingsLookup, onMappingsChange]);
  
  // Statistics
  const stats = useMemo(() => {
    const total = categoryIndex.length;
    const mapped = categoryIndex.filter(c => 
      mappingsLookup[c.category.toLowerCase().trim()]
    ).length;
    return { total, mapped, unmapped: total - mapped };
  }, [categoryIndex, mappingsLookup]);
  
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
      // Save mapping
      saveMappingMutation.mutate(
        { projectId, categoryName: category, laborCode },
        {
          onSuccess: () => {
            toast({
              title: "Mapping Saved",
              description: `Assigned ${laborCode} to "${category}"`,
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
  
  // Filter out "Unknown" category if it exists
  const filteredCategories = categoryIndex.filter(c => c.category !== 'Unknown' && c.category.trim() !== '');
  
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
                {stats.mapped}/{stats.total} mapped
              </Badge>
              {stats.unmapped > 0 && (
                <Badge variant="secondary">
                  {stats.unmapped} unmapped
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
                  Category mappings override System mappings for labor code assignment
                </div>
                
                <div className="grid gap-2">
                  {filteredCategories.map((cat) => {
                    const currentCode = getLaborCode(cat.category);
                    const isMapped = !!currentCode;
                    
                    return (
                      <div
                        key={cat.category}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isMapped ? "bg-accent/50 border-primary/30" : "bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isMapped ? (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
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
                              isMapped && "border-primary/50"
                            )}>
                              <SelectValue placeholder="Select labor code..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No mapping</span>
                              </SelectItem>
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
