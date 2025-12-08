import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { COST_CODES_DB } from '@/data/costCodes';
import { useLaborCodes } from '@/hooks/useCostCodes';
import { CheckCircle, AlertCircle, XCircle, X, Sparkles, ChevronDown, ChevronUp, Check, Eye, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstimateItem } from '@/types/estimate';

interface SystemCardProps {
  system: string;
  itemCount: number;
  laborCode?: string;
  suggestedLaborCode?: string;
  appliedInfo?: { appliedAt: Date; itemCount: number; appliedLaborCode?: string };
  onLaborCodeChange: (value: string) => void;
  onClear: () => void;
  onApplySuggestions?: () => void;
  onApplySystemMapping?: () => void;
  onViewAllItems?: (system: string) => void;
  items?: EstimateItem[];
  importedCostCodes?: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>;
}

export const SystemCard: React.FC<SystemCardProps> = ({
  system,
  itemCount,
  laborCode,
  suggestedLaborCode,
  appliedInfo,
  onLaborCodeChange,
  onClear,
  onApplySuggestions,
  onApplySystemMapping,
  onViewAllItems,
  items = [],
  importedCostCodes = [],
}) => {
  const [laborOpen, setLaborOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const isMapped = !!laborCode;
  const hasSuggestions = !!suggestedLaborCode;
  
  // Check if mapping has changed since last applied
  const hasChangedSinceApplied = appliedInfo && laborCode !== appliedInfo.appliedLaborCode;

  // Load cost codes from database
  const { data: dbLaborCodes = [], isLoading: loadingLabor } = useLaborCodes();

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

  const getStatusIcon = () => {
    if (isMapped) return <CheckCircle className="w-5 h-5 text-success" />;
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (appliedInfo) {
      return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" /> Applied</Badge>;
    }
    if (isMapped) {
      return <Badge className="bg-success text-success-foreground">Mapped</Badge>;
    }
    return <Badge variant="outline">Unmapped</Badge>;
  };

  const getCodeDisplay = (code: string | undefined, codes: Array<{ code: string; description: string }>, suggested?: string) => {
    const effectiveCode = code || suggested;
    if (!effectiveCode) return 'Select labor code...';
    const found = codes.find(c => c.code === effectiveCode);
    return found ? found.description : effectiveCode;
  };

  const handleLaborSelect = (value: string) => {
    onLaborCodeChange(value);
    setLaborOpen(false);
  };

  return (
    <Card className={`
      transition-all hover:shadow-lg
      ${isMapped ? 'border-success/50 bg-success/5' : ''}
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{system}</h3>
              <p className="text-sm text-muted-foreground">{itemCount} items</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {laborCode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggestions Banner */}
        {hasSuggestions && !laborCode && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">Smart suggestion available</span>
            <Button
              size="sm"
              variant="default"
              onClick={onApplySuggestions}
            >
              Apply Suggestion
            </Button>
          </div>
        )}

        {/* Labor Code Select - Searchable Combobox */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Labor Code {suggestedLaborCode && !laborCode && (
              <Badge variant="outline" className="ml-2 text-xs">
                Suggested
              </Badge>
            )}
          </label>
          <Popover open={laborOpen} onOpenChange={setLaborOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={laborOpen}
                className={cn(
                  "w-full justify-between font-normal",
                  suggestedLaborCode && !laborCode ? 'border-primary/50' : '',
                  !laborCode && !suggestedLaborCode ? 'text-muted-foreground' : ''
                )}
              >
                {getCodeDisplay(laborCode, allLaborCodes, suggestedLaborCode)}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search labor codes... (e.g., COMA, compressed air)" />
                <CommandList>
                  <CommandEmpty>No code found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => handleLaborSelect('none')}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !laborCode && !suggestedLaborCode ? "opacity-100" : "opacity-0")} />
                      <span className="text-muted-foreground">None</span>
                    </CommandItem>
                    {allLaborCodes.map((code) => (
                      <CommandItem
                        key={code.code}
                        value={`${code.code} ${code.description}`}
                        onSelect={() => handleLaborSelect(code.code)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", (laborCode || suggestedLaborCode) === code.code ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono text-xs mr-2">{code.code}</span>
                        <span className="truncate">{code.description}</span>
                        {code.code === suggestedLaborCode && !laborCode && (
                          <Badge variant="default" className="ml-auto text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Suggested
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Current mapping info */}
        {laborCode && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
            {appliedInfo && (
              <div className="flex items-center gap-1 text-success font-medium">
                <CheckCircle className="w-3 h-3" />
                Applied: {appliedInfo.itemCount} items at {appliedInfo.appliedAt.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {/* Apply to System Button */}
        {laborCode && onApplySystemMapping && (
          <>
            {appliedInfo && !hasChangedSinceApplied ? (
              <div className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-success/10 border border-success/30 rounded-md text-success text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Applied ({appliedInfo.itemCount} items)
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={onApplySystemMapping}
              >
                {hasChangedSinceApplied ? (
                  <>Apply Changes ({itemCount})</>
                ) : (
                  <>Apply to System ({itemCount})</>
                )}
              </Button>
            )}
          </>
        )}

        {/* Item Preview Section */}
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview Items
              </span>
              {previewOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Drawing</th>
                    <th className="text-left p-2 font-medium">Material Desc</th>
                    <th className="text-right p-2 font-medium">Qty</th>
                    <th className="text-right p-2 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.slice(0, 5).map((item, idx) => (
                    <tr key={item.id || idx} className="text-xs">
                      <td className="p-2 truncate max-w-[80px]" title={item.drawing}>{item.drawing || '-'}</td>
                      <td className="p-2 truncate max-w-[120px]" title={item.materialDesc}>{item.materialDesc || '-'}</td>
                      <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-2 text-right tabular-nums">{item.hours || 0}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {items.length > 5 && (
                <div className="p-2 border-t bg-muted/30 text-center">
                  <span className="text-xs text-muted-foreground">
                    Showing 5 of {items.length} items
                  </span>
                </div>
              )}
            </div>
            {onViewAllItems && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => onViewAllItems(system)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View All {itemCount} Items in Estimates
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
