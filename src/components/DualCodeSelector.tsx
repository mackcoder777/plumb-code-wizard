import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronDown, Check, Package, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLaborCodes, useMaterialCodes } from '@/hooks/useCostCodes';
import { COST_CODES_DB } from '@/data/costCodes';

interface DualCodeSelectorProps {
  materialCode: string;
  laborCode: string;
  onMaterialCodeChange: (value: string) => void;
  onLaborCodeChange: (value: string) => void;
  className?: string;
  compact?: boolean;
}

export const DualCodeSelector: React.FC<DualCodeSelectorProps> = ({
  materialCode,
  laborCode,
  onMaterialCodeChange,
  onLaborCodeChange,
  className,
  compact = false,
}) => {
  const [materialOpen, setMaterialOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [laborSearch, setLaborSearch] = useState('');

  // Load codes from database
  const { data: dbLaborCodes = [] } = useLaborCodes();
  const { data: dbMaterialCodes = [] } = useMaterialCodes();

  // Material codes
  const allMaterialCodes = useMemo(() => {
    const hardcoded = COST_CODES_DB.material.map(c => ({
      code: c.code,
      description: c.description,
    }));
    const db = dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
    }));
    
    const combined = [...hardcoded, ...db];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [dbMaterialCodes]);

  // Labor codes
  const allLaborCodes = useMemo(() => {
    const hardcoded = COST_CODES_DB.fieldLabor.map(c => ({
      code: c.code,
      description: c.description,
    }));
    const db = dbLaborCodes.map(c => ({
      code: c.code,
      description: c.description,
    }));
    
    const combined = [...hardcoded, ...db];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [dbLaborCodes]);

  const getMaterialDisplay = () => {
    if (!materialCode) return 'Select Material Code...';
    const found = allMaterialCodes.find(c => c.code === materialCode);
    return found ? found.description : materialCode;
  };

  const getLaborDisplay = () => {
    if (!laborCode) return 'Select Labor Code...';
    const found = allLaborCodes.find(c => c.code === laborCode);
    return found ? found.description : laborCode;
  };

  const filterCodes = (codes: { code: string; description: string }[], search: string) => {
    if (!search) return codes;
    const lower = search.toLowerCase();
    return codes.filter(c => 
      c.code.toLowerCase().includes(lower) || 
      c.description.toLowerCase().includes(lower)
    );
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Material Code */}
        <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-between min-w-[140px]",
                materialCode ? "border-green-500 bg-green-50 text-green-800" : "text-muted-foreground"
              )}
            >
              <Package className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">{materialCode || 'Material'}</span>
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search material codes..." 
                value={materialSearch}
                onValueChange={setMaterialSearch}
              />
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No codes found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onMaterialCodeChange('');
                      setMaterialOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">— Clear —</span>
                  </CommandItem>
                  {filterCodes(allMaterialCodes, materialSearch).map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.description}`}
                      onSelect={() => {
                        onMaterialCodeChange(c.code);
                        setMaterialOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          materialCode === c.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{c.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Labor Code */}
        <Popover open={laborOpen} onOpenChange={setLaborOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs justify-between min-w-[140px]",
                laborCode ? "border-blue-500 bg-blue-50 text-blue-800" : "text-muted-foreground"
              )}
            >
              <Wrench className="w-3 h-3 mr-1 shrink-0" />
              <span className="truncate">{laborCode || 'Labor'}</span>
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search labor codes..." 
                value={laborSearch}
                onValueChange={setLaborSearch}
              />
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No codes found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onLaborCodeChange('');
                      setLaborOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">— Clear —</span>
                  </CommandItem>
                  {filterCodes(allLaborCodes, laborSearch).map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.description}`}
                      onSelect={() => {
                        onLaborCodeChange(c.code);
                        setLaborOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          laborCode === c.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{c.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Material Code Row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-green-700 font-medium w-24">
          <Package className="w-4 h-4" />
          Material:
        </div>
        <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-between font-normal text-left h-auto py-1.5 px-3 text-sm flex-1",
                materialCode 
                  ? "border-green-500 bg-green-50 text-green-800" 
                  : "text-muted-foreground"
              )}
            >
              <span className="truncate">{getMaterialDisplay()}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search material codes..." 
                value={materialSearch}
                onValueChange={setMaterialSearch}
              />
              <CommandList className="max-h-[280px]">
                <CommandEmpty>No material codes found.</CommandEmpty>
                <CommandGroup heading="Material Codes">
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onMaterialCodeChange('');
                      setMaterialOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">— Clear Selection —</span>
                  </CommandItem>
                  {filterCodes(allMaterialCodes, materialSearch).map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.description}`}
                      onSelect={() => {
                        onMaterialCodeChange(c.code);
                        setMaterialOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          materialCode === c.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs bg-green-100 px-1 rounded mr-2">{c.code}</span>
                      <span className="truncate">{c.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Labor Code Row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-blue-700 font-medium w-24">
          <Wrench className="w-4 h-4" />
          Labor:
        </div>
        <Popover open={laborOpen} onOpenChange={setLaborOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-between font-normal text-left h-auto py-1.5 px-3 text-sm flex-1",
                laborCode 
                  ? "border-blue-500 bg-blue-50 text-blue-800" 
                  : "text-muted-foreground"
              )}
            >
              <span className="truncate">{getLaborDisplay()}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search labor codes..." 
                value={laborSearch}
                onValueChange={setLaborSearch}
              />
              <CommandList className="max-h-[280px]">
                <CommandEmpty>No labor codes found.</CommandEmpty>
                <CommandGroup heading="Labor Codes">
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onLaborCodeChange('');
                      setLaborOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">— Clear Selection —</span>
                  </CommandItem>
                  {filterCodes(allLaborCodes, laborSearch).map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.code} ${c.description}`}
                      onSelect={() => {
                        onLaborCodeChange(c.code);
                        setLaborOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          laborCode === c.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs bg-blue-100 px-1 rounded mr-2">{c.code}</span>
                      <span className="truncate">{c.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
