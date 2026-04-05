import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertCircle, XCircle, Grid3x3, X, ChevronDown, Sparkles, Check } from 'lucide-react';

interface SystemSuggestion {
  laborCode: string;
  confidence: number;
  usageCount: number;
  matchType: 'exact' | 'fuzzy' | 'keyword';
}

interface FilterCardsProps {
  stats: {
    total: number;
    mapped: number;
    partial: number;
    unmapped: number;
  };
  activeStatusFilter: 'all' | 'mapped' | 'partial' | 'unmapped' | null;
  onStatusFilterChange: (filter: 'all' | 'mapped' | 'partial' | 'unmapped' | null) => void;
  topSystems: Array<{ system: string; itemCount: number; totalHours: number; laborCode?: string; status: 'mapped' | 'partial' | 'unmapped' }>;
  activeSystemFilter: string | null;
  onSystemFilterChange: (system: string | null) => void;
  showAllSystems: boolean;
  onToggleShowAllSystems: () => void;
  // Multi-select support
  selectedSystems?: Set<string>;
  onToggleSystemSelection?: (system: string) => void;
  onBulkAssign?: (laborCode: string) => void;
  onClearSelection?: () => void;
  laborCodes?: Array<{ code: string; description: string }>;
  // Suggestions from learning system
  suggestions?: Record<string, SystemSuggestion>;
  onAcceptSuggestion?: (system: string, laborCode: string) => void;
}

export const FilterCards: React.FC<FilterCardsProps> = ({
  stats,
  activeStatusFilter,
  onStatusFilterChange,
  topSystems,
  activeSystemFilter,
  onSystemFilterChange,
  showAllSystems,
  onToggleShowAllSystems,
  selectedSystems = new Set(),
  onToggleSystemSelection,
  onBulkAssign,
  onClearSelection,
  laborCodes = [],
  suggestions = {},
  onAcceptSuggestion,
}) => {
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
  
  const statusFilters = [
    {
      id: 'all' as const,
      label: 'All Systems',
      count: stats.total,
      icon: Grid3x3,
      color: 'default',
    },
    {
      id: 'mapped' as const,
      label: 'Fully Mapped',
      count: stats.mapped,
      icon: CheckCircle,
      color: 'success',
    },
    {
      id: 'partial' as const,
      label: 'Partially Mapped',
      count: stats.partial,
      icon: AlertCircle,
      color: 'warning',
    },
    {
      id: 'unmapped' as const,
      label: 'Unmapped',
      count: stats.unmapped,
      icon: XCircle,
      color: 'muted',
    },
  ];

  const getStatusIndicator = (status: 'mapped' | 'partial' | 'unmapped') => {
    if (status === 'mapped') {
      return <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />;
    }
    if (status === 'partial') {
      return <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />;
    }
    return <div className="w-3 h-3 rounded-full bg-muted-foreground/50 flex-shrink-0" />;
  };

  const activeFilterCount = (activeStatusFilter && activeStatusFilter !== 'all' ? 1 : 0) + 
                           (activeSystemFilter ? 1 : 0);

  const handleBulkAssign = (laborCode: string) => {
    if (onBulkAssign) {
      onBulkAssign(laborCode);
    }
    setBulkAssignOpen(false);
  };

  const isMultiSelectMode = selectedSystems.size > 0;

  return (
    <div className="space-y-4">
      {/* Multi-Select Bulk Assignment Banner */}
      {isMultiSelectMode && onBulkAssign && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-lg animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="font-semibold">
              {selectedSystems.size} systems selected
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <Popover open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
            <PopoverTrigger asChild>
              <Button size="sm">
                Assign Same Labor Code to All
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search labor codes..." />
                <CommandList>
                  <CommandEmpty>No code found.</CommandEmpty>
                  <CommandGroup>
                    {laborCodes.map((code) => (
                      <CommandItem
                        key={code.code}
                        value={`${code.code} ${code.description}`}
                        onSelect={() => handleBulkAssign(code.code)}
                      >
                        <span className="font-mono text-xs mr-2">{code.code}</span>
                        <span className="truncate">{code.description}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Active Filters Banner */}
      {activeFilterCount > 0 && !isMultiSelectMode && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">{activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}</Badge>
            {activeStatusFilter && activeStatusFilter !== 'all' && (
              <Badge variant="outline">
                Status: {activeStatusFilter}
                <button
                  onClick={() => onStatusFilterChange(null)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {activeSystemFilter && (
              <Badge variant="outline">
                System: {activeSystemFilter}
                <button
                  onClick={() => onSystemFilterChange(null)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onStatusFilterChange(null);
              onSystemFilterChange(null);
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Status Filter Cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Filter by Status</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeStatusFilter === filter.id;
            
            return (
              <Card
                key={filter.id}
                className={`
                  cursor-pointer transition-all hover:scale-105 hover:shadow-md
                  ${isActive ? 'ring-2 ring-primary bg-primary/10' : 'hover:border-primary/50'}
                  ${filter.color === 'success' && !isActive ? 'border-success/30' : ''}
                  ${filter.color === 'warning' && !isActive ? 'border-warning/30' : ''}
                `}
                onClick={() => onStatusFilterChange(isActive ? null : filter.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon
                      className={`
                        w-5 h-5
                        ${filter.color === 'success' ? 'text-success' : ''}
                        ${filter.color === 'warning' ? 'text-warning' : ''}
                        ${filter.color === 'default' ? 'text-primary' : ''}
                        ${filter.color === 'muted' ? 'text-muted-foreground' : ''}
                      `}
                    />
                    {isActive && <Badge variant="default" className="text-xs">Active</Badge>}
                  </div>
                  <div className="text-2xl font-bold">{filter.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{filter.label}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Filter Cards with Multi-Select */}
      {topSystems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Filter by System 
              {onToggleSystemSelection && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (Click checkbox to select multiple, click card to filter)
                </span>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleShowAllSystems}
            >
              {showAllSystems ? 'Show Top 8' : 'Show All Systems'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(showAllSystems ? topSystems : topSystems.slice(0, 8)).map((system) => {
              const isActive = activeSystemFilter === system.system;
              const isSelected = selectedSystems.has(system.system.toLowerCase().trim());
              const systemKey = system.system.toLowerCase().trim();
              const suggestion = suggestions[systemKey];
              const hasSuggestion = system.status === 'unmapped' && suggestion;
              
              return (
                <Card
                  key={system.system}
                  className={`
                    cursor-pointer transition-all hover:scale-105 hover:shadow-md
                    ${isActive ? 'ring-2 ring-primary bg-primary/10' : ''}
                    ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}
                    ${hasSuggestion ? 'border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20' : ''}
                    ${!isActive && !isSelected && !hasSuggestion ? 'hover:border-primary/50' : ''}
                  `}
                  onClick={() => {
                    if (onToggleSystemSelection) {
                      // Always toggle selection when clicking the card
                      onToggleSystemSelection(system.system);
                    } else {
                      onSystemFilterChange(isActive ? null : system.system);
                    }
                  }}
                >
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {onToggleSystemSelection && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleSystemSelection(system.system)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {getStatusIndicator(system.status)}
                        <span className="font-medium text-sm truncate">{system.system}</span>
                      </div>
                      {isActive && <Badge variant="default" className="text-xs flex-shrink-0">Active</Badge>}
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {system.itemCount} items
                      </Badge>
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                        ⏱ {system.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h
                      </span>
                      
                      {system.laborCode && (
                        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 gap-1">
                          {system.laborCode}
                          <Check className="w-3 h-3" />
                        </Badge>
                      )}
                      
                      {/* Show suggestion badge for unmapped systems */}
                      {hasSuggestion && onAcceptSuggestion && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:hover:bg-amber-900 dark:text-amber-200 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAcceptSuggestion(system.system, suggestion.laborCode);
                              }}
                            >
                              <Sparkles className="w-3 h-3" />
                              {suggestion.laborCode}
                              <Check className="w-3 h-3 ml-1" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <p className="text-xs">
                              Suggested: <span className="font-mono font-bold">{suggestion.laborCode}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.matchType === 'keyword' 
                                ? `Keyword match • ${Math.round(suggestion.confidence * 100)}% confidence`
                                : `Used ${suggestion.usageCount}x • ${Math.round(suggestion.confidence * 100)}% confidence`
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Click to accept
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
