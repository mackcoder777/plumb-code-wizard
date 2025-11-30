import React, { useState, useMemo } from 'react';
import { ChevronDown, ArrowUpAZ, ArrowDownAZ, Filter, X, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ColumnFilterDropdownProps {
  columnKey: string;
  columnLabel: string;
  data: any[];
  activeFilters: Record<string, Set<string>>;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onFilterChange: (columnKey: string, selectedValues: Set<string>) => void;
  onSortChange: (columnKey: string, direction: 'asc' | 'desc') => void;
}

export const ColumnFilterDropdown: React.FC<ColumnFilterDropdownProps> = ({
  columnKey,
  columnLabel,
  data,
  activeFilters,
  sortConfig,
  onFilterChange,
  onSortChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  // Get unique values for this column
  const uniqueValues = useMemo(() => {
    const values = new Set<string>();
    data.forEach(item => {
      const val = item[columnKey];
      if (val !== undefined && val !== null) {
        const strVal = String(val).trim();
        values.add(strVal || '(Blanks)');
      } else {
        values.add('(Blanks)');
      }
    });
    return Array.from(values).sort((a, b) => {
      if (a === '(Blanks)') return 1;
      if (b === '(Blanks)') return -1;
      return a.localeCompare(b);
    });
  }, [data, columnKey]);

  // Filter values by search term
  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(v => 
      v.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm]);

  // Initialize local selected when popover opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Initialize with current active filters or all selected
      const currentFilter = activeFilters[columnKey];
      if (currentFilter && currentFilter.size > 0) {
        setLocalSelected(new Set(currentFilter));
      } else {
        setLocalSelected(new Set(uniqueValues));
      }
    }
    setSearchTerm('');
    setIsOpen(open);
  };

  const isAllSelected = localSelected.size === uniqueValues.length;
  const hasActiveFilter = activeFilters[columnKey] && activeFilters[columnKey].size > 0 && activeFilters[columnKey].size < uniqueValues.length;
  const isSorted = sortConfig?.key === columnKey;

  const toggleValue = (value: string) => {
    const newSelected = new Set(localSelected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setLocalSelected(newSelected);
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setLocalSelected(new Set());
    } else {
      setLocalSelected(new Set(uniqueValues));
    }
  };

  const applyFilter = () => {
    // If all are selected, clear the filter (no filter active)
    if (localSelected.size === uniqueValues.length) {
      onFilterChange(columnKey, new Set());
    } else {
      onFilterChange(columnKey, localSelected);
    }
    setIsOpen(false);
  };

  const clearFilter = () => {
    setLocalSelected(new Set(uniqueValues));
    onFilterChange(columnKey, new Set());
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 hover:bg-gray-100 px-1 py-0.5 rounded group w-full justify-between">
          <span className="truncate">{columnLabel}</span>
          <div className="flex items-center gap-0.5">
            {hasActiveFilter && (
              <Filter className="h-3 w-3 text-blue-600" />
            )}
            {isSorted && (
              sortConfig?.direction === 'asc' 
                ? <ArrowUpAZ className="h-3 w-3 text-blue-600" />
                : <ArrowDownAZ className="h-3 w-3 text-blue-600" />
            )}
            <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b space-y-1">
          <button
            onClick={() => { onSortChange(columnKey, 'asc'); setIsOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 ${
              sortConfig?.key === columnKey && sortConfig?.direction === 'asc' ? 'bg-blue-50 text-blue-700' : ''
            }`}
          >
            <ArrowUpAZ className="h-4 w-4" />
            Sort A to Z
          </button>
          <button
            onClick={() => { onSortChange(columnKey, 'desc'); setIsOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 ${
              sortConfig?.key === columnKey && sortConfig?.direction === 'desc' ? 'bg-blue-50 text-blue-700' : ''
            }`}
          >
            <ArrowDownAZ className="h-4 w-4" />
            Sort Z to A
          </button>
        </div>
        
        <div className="p-2 border-b">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="p-2 border-b">
          <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 rounded">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleAll}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">(Select All)</span>
          </label>
        </div>

        <ScrollArea className="h-48">
          <div className="p-2 space-y-0.5">
            {filteredValues.map(value => (
              <label 
                key={value} 
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-50 rounded"
              >
                <Checkbox
                  checked={localSelected.has(value)}
                  onCheckedChange={() => toggleValue(value)}
                  className="h-4 w-4"
                />
                <span className={`text-sm truncate ${value === '(Blanks)' ? 'italic text-gray-500' : ''}`}>
                  {value}
                </span>
              </label>
            ))}
            {filteredValues.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No matches found</p>
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilter}
            className="flex-1"
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={applyFilter}
            className="flex-1"
            disabled={localSelected.size === 0}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
