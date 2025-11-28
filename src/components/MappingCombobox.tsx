import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLaborCodes, useMaterialCodes } from '@/hooks/useCostCodes';
import { COST_CODES_DB } from '@/data/costCodes';

interface MappingComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MappingCombobox: React.FC<MappingComboboxProps> = ({
  value,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Load codes from database
  const { data: dbLaborCodes = [] } = useLaborCodes();
  const { data: dbMaterialCodes = [] } = useMaterialCodes();

  // Combine all available codes
  const allCodes = useMemo(() => {
    // Start with hardcoded codes
    const hardcodedLabor = COST_CODES_DB.fieldLabor.map(c => ({
      code: c.code,
      description: c.description,
    }));
    const hardcodedMaterial = COST_CODES_DB.material.map(c => ({
      code: c.code,
      description: c.description,
    }));
    
    // Add database codes
    const dbLabor = dbLaborCodes.map(c => ({
      code: c.code,
      description: c.description,
    }));
    const dbMaterial = dbMaterialCodes.map(c => ({
      code: c.code,
      description: c.description,
    }));
    
    // Combine and deduplicate by code
    const combined = [...hardcodedLabor, ...hardcodedMaterial, ...dbLabor, ...dbMaterial];
    const uniqueCodes = Array.from(
      new Map(combined.map(c => [c.code, c])).values()
    );
    
    return uniqueCodes.sort((a, b) => a.description.localeCompare(b.description));
  }, [dbLaborCodes, dbMaterialCodes]);

  // Scroll to top when popover opens
  useEffect(() => {
    if (open) {
      setSearch('');
      // Small delay to ensure the list is rendered
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      }, 10);
    }
  }, [open]);

  const getDisplayValue = () => {
    if (!value) return 'Select code...';
    const found = allCodes.find(c => c.code === value);
    return found ? `${found.code} - ${found.description}` : value;
  };

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal text-left h-auto py-1 px-2 text-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{getDisplayValue()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-50 bg-popover" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search codes (e.g., COMA, compressed air)..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[300px]">
            <CommandEmpty>No code found.</CommandEmpty>
            <CommandGroup>
              {allCodes
                .filter(option => {
                  if (!search) return true;
                  const searchLower = search.toLowerCase();
                  return option.code.toLowerCase().includes(searchLower) ||
                         option.description.toLowerCase().includes(searchLower);
                })
                .map((option) => (
                  <CommandItem
                    key={option.code}
                    value={option.code}
                    onSelect={() => handleSelect(option.code)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === option.code ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono text-xs mr-2 text-muted-foreground">{option.code}</span>
                    <span className="truncate">{option.description}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};