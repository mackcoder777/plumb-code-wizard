import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeOption {
  code: string;
  description: string;
}

interface TableRowComboboxProps {
  value: string | undefined;
  options: CodeOption[];
  placeholder: string;
  onValueChange: (value: string) => void;
}

export const TableRowCombobox: React.FC<TableRowComboboxProps> = ({
  value,
  options,
  placeholder,
  onValueChange,
}) => {
  const [open, setOpen] = useState(false);

  const getDisplayValue = () => {
    if (!value || value === 'none') return placeholder;
    const found = options.find(o => o.code === value);
    return found ? `${found.code} - ${found.description}` : value;
  };

  const handleSelect = (code: string) => {
    onValueChange(code);
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
            "w-full justify-between font-normal text-left",
            !value || value === 'none' ? 'text-muted-foreground' : ''
          )}
        >
          <span className="truncate">{getDisplayValue()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-50 bg-popover" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No code found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => handleSelect('none')}
              >
                <Check className={cn("mr-2 h-4 w-4", !value || value === 'none' ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">None</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.code} ${option.description}`}
                  onSelect={() => handleSelect(option.code)}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.code ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs mr-2">{option.code}</span>
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
