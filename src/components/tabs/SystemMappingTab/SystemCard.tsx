import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { COST_CODES_DB } from '@/data/costCodes';
import { useMaterialCodes, useLaborCodes } from '@/hooks/useCostCodes';
import { CheckCircle, AlertCircle, XCircle, X, Sparkles, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemCardProps {
  system: string;
  itemCount: number;
  materialCode?: string;
  laborCode?: string;
  suggestedMaterialCode?: string;
  suggestedLaborCode?: string;
  onMaterialCodeChange: (value: string) => void;
  onLaborCodeChange: (value: string) => void;
  onClear: () => void;
  onApplySuggestions?: () => void;
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
  materialCode,
  laborCode,
  suggestedMaterialCode,
  suggestedLaborCode,
  onMaterialCodeChange,
  onLaborCodeChange,
  onClear,
  onApplySuggestions,
  importedCostCodes = [],
}) => {
  const [materialOpen, setMaterialOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  
  const isMapped = materialCode && laborCode;
  const isPartial = (materialCode || laborCode) && !(materialCode && laborCode);
  const hasSuggestions = suggestedMaterialCode || suggestedLaborCode;

  // Load cost codes from database
  const { data: dbMaterialCodes = [], isLoading: loadingMaterial } = useMaterialCodes();
  const { data: dbLaborCodes = [], isLoading: loadingLabor } = useLaborCodes();

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

  const getStatusIcon = () => {
    if (isMapped) return <CheckCircle className="w-5 h-5 text-success" />;
    if (isPartial) return <AlertCircle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (isMapped) {
      return <Badge className="bg-success text-success-foreground">Fully Mapped</Badge>;
    } else if (isPartial) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground">Partial</Badge>;
    }
    return <Badge variant="outline">Unmapped</Badge>;
  };

  const getCodeDisplay = (code: string | undefined, codes: Array<{ code: string; description: string }>, suggested?: string) => {
    const effectiveCode = code || suggested;
    if (!effectiveCode) return 'Select code...';
    const found = codes.find(c => c.code === effectiveCode);
    return found ? found.description : effectiveCode;
  };

  const handleMaterialSelect = (value: string) => {
    onMaterialCodeChange(value);
    setMaterialOpen(false);
  };

  const handleLaborSelect = (value: string) => {
    onLaborCodeChange(value);
    setLaborOpen(false);
  };

  return (
    <Card className={`
      transition-all hover:shadow-lg
      ${isMapped ? 'border-success/50 bg-success/5' : ''}
      ${isPartial ? 'border-warning/50 bg-warning/5' : ''}
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
            {(materialCode || laborCode) && (
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
        {hasSuggestions && !(materialCode && laborCode) && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">Smart suggestions available</span>
            <Button
              size="sm"
              variant="default"
              onClick={onApplySuggestions}
            >
              Apply Suggestions
            </Button>
          </div>
        )}

        {/* Material Code Select - Searchable Combobox */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Material Code {suggestedMaterialCode && !materialCode && (
              <Badge variant="outline" className="ml-2 text-xs">
                Suggested
              </Badge>
            )}
          </label>
          <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={materialOpen}
                className={cn(
                  "w-full justify-between font-normal",
                  suggestedMaterialCode && !materialCode ? 'border-primary/50' : '',
                  !materialCode && !suggestedMaterialCode ? 'text-muted-foreground' : ''
                )}
              >
                {getCodeDisplay(materialCode, allMaterialCodes, suggestedMaterialCode)}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search material codes..." />
                <CommandList>
                  <CommandEmpty>No code found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="none"
                      onSelect={() => handleMaterialSelect('none')}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !materialCode && !suggestedMaterialCode ? "opacity-100" : "opacity-0")} />
                      <span className="text-muted-foreground">None</span>
                    </CommandItem>
                    {allMaterialCodes.map((code) => (
                      <CommandItem
                        key={code.code}
                        value={`${code.code} ${code.description}`}
                        onSelect={() => handleMaterialSelect(code.code)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", (materialCode || suggestedMaterialCode) === code.code ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono text-xs mr-2">{code.code}</span>
                        <span className="truncate">{code.description}</span>
                        {code.code === suggestedMaterialCode && !materialCode && (
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
        {(materialCode || laborCode) && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <div>Last modified: {new Date().toLocaleString()}</div>
            {(suggestedMaterialCode || suggestedLaborCode) && (
              <div>Change trail: Auto-suggested: {suggestedMaterialCode || suggestedLaborCode}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};