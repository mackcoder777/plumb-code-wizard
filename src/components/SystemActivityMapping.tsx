import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { toast } from '@/components/ui/use-toast';
import { Activity, Save, RotateCcw, Loader2, ChevronsUpDown, Check, Plus, Sparkles, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useSystemActivityMappings,
  useBatchSaveSystemActivityMappings,
  useSaveSystemActivityMapping,
  useDeleteSystemActivityMapping,
  SystemActivityMapping,
  ACTIVITY_CODE_SUGGESTIONS,
  suggestActivityCode,
} from '@/hooks/useSystemActivityMappings';

interface SystemData {
  system: string;
  itemCount: number;
}

interface CategoryData {
  category: string;
  items: number;
  hours: number;
  currentCostHead: string | null;
}

interface SystemActivityMappingPanelProps {
  estimateData: Array<{ system?: string; reportCat?: string; itemType?: string; hours?: number; costCode?: string }>;
  projectId: string | null;
  onMappingsChange?: (mappings: SystemActivityMapping[]) => void;
}

// Activity code input component with custom entry support
interface ActivityCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestion?: string | null;
}

const ActivityCodeInput: React.FC<ActivityCodeInputProps> = ({ value, onChange, suggestion }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState('');

  const displayLabel = useMemo(() => {
    const found = ACTIVITY_CODE_SUGGESTIONS.find(c => c.code === value);
    return found ? `${found.code} - ${found.label}` : value || 'Select activity...';
  }, [value]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setInputValue('');
  };

  const handleAddCustom = () => {
    if (customCode.trim().length >= 1 && customCode.trim().length <= 4) {
      const code = customCode.trim().toUpperCase();
      onChange(code);
      setCustomCode('');
      setIsAddingCustom(false);
      setOpen(false);
    }
  };

  const filteredCodes = ACTIVITY_CODE_SUGGESTIONS.filter(code =>
    code.code.toLowerCase().includes(inputValue.toLowerCase()) ||
    code.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-[180px] justify-between font-normal",
            suggestion && !value && "border-amber-400/50"
          )}
        >
          <span className="truncate flex items-center gap-1">
            {suggestion && !value && (
              <Sparkles className="h-3 w-3 text-amber-500" />
            )}
            {value ? displayLabel : (suggestion ? `Suggested: ${suggestion}` : 'Select activity...')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-popover" align="start">
        {isAddingCustom ? (
          <div className="p-3 space-y-3">
            <div className="text-sm font-medium">Add Custom Activity Code</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Code (1-4 chars)</label>
                <Input
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="e.g., DWTR, SNWV"
                  className="h-8 font-mono"
                  maxLength={4}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setIsAddingCustom(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddCustom}
                disabled={!customCode.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput
              placeholder="Search or type code..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center">
                  <p className="text-sm text-muted-foreground mb-2">No matching codes</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCustomCode(inputValue.toUpperCase());
                      setIsAddingCustom(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add "{inputValue.toUpperCase()}"
                  </Button>
                </div>
              </CommandEmpty>
              {suggestion && !value && (
                <CommandGroup heading="Suggested">
                  <CommandItem
                    value={`suggested-${suggestion}`}
                    onSelect={() => handleSelect(suggestion)}
                    className="text-amber-600"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span className="font-mono mr-2">{suggestion}</span>
                    <span className="text-muted-foreground">- Auto-suggested</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Common Activity Codes">
                {filteredCodes.map((code) => (
                  <CommandItem
                    key={code.code}
                    value={`${code.code} ${code.label}`}
                    onSelect={() => handleSelect(code.code)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === code.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono mr-2">{code.code}</span>
                    <span className="text-muted-foreground">- {code.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setIsAddingCustom(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add custom code...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const SystemActivityMappingPanel: React.FC<SystemActivityMappingPanelProps> = ({
  estimateData,
  projectId,
  onMappingsChange,
}) => {
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());

  const { data: dbMappings = [], isLoading } = useSystemActivityMappings(projectId);
  const batchSave = useBatchSaveSystemActivityMappings();
  const saveMapping = useSaveSystemActivityMapping();
  const deleteMapping = useDeleteSystemActivityMapping();

  // Extract unique systems from estimate data with counts
  const systemData = useMemo<SystemData[]>(() => {
    const systemCounts = new Map<string, number>();

    estimateData.forEach(item => {
      const system = (item.system || '').trim();
      if (system) {
        systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
      }
    });

    return Array.from(systemCounts.entries())
      .map(([system, itemCount]) => ({ system, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount);
  }, [estimateData]);

  // Generate auto-suggestions for systems
  const suggestions = useMemo(() => {
    const sugg: Record<string, string | null> = {};
    systemData.forEach(({ system }) => {
      sugg[system.toLowerCase().trim()] = suggestActivityCode(system);
    });
    return sugg;
  }, [systemData]);

  // Build category breakdown per system
  const systemCategoryData = useMemo(() => {
    const result: Record<string, CategoryData[]> = {};

    estimateData.forEach(item => {
      const sys = (item.system || '').trim();
      const cat = item.reportCat || item.itemType || 'Unknown';
      if (!sys) return;

      if (!result[sys]) result[sys] = [];
      let entry = result[sys].find(e => e.category === cat);
      if (!entry) {
        entry = { category: cat, items: 0, hours: 0, currentCostHead: null };
        result[sys].push(entry);
      }
      entry.items++;
      entry.hours += item.hours || 0;
      if (!entry.currentCostHead && item.costCode) {
        const parts = item.costCode.trim().split(/\s+/);
        entry.currentCostHead = parts.length >= 1 ? parts[parts.length - 1] : null;
      }
    });

    Object.values(result).forEach(cats => cats.sort((a, b) => b.hours - a.hours));
    return result;
  }, [estimateData]);

  // Detect cost heads shared across multiple systems
  const sharedCostHeadMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    estimateData.forEach(item => {
      const sys = (item.system || '').trim();
      if (!sys || !item.costCode) return;
      const parts = item.costCode.trim().split(/\s+/);
      const costHead = parts[parts.length - 1];
      if (!costHead) return;
      if (!map[costHead]) map[costHead] = new Set();
      map[costHead].add(sys);
    });
    const shared: Record<string, string[]> = {};
    Object.entries(map).forEach(([costHead, systems]) => {
      if (systems.size >= 2) shared[costHead] = [...systems];
    });
    return shared;
  }, [estimateData]);

  useEffect(() => {
    if (dbMappings.length > 0) {
      const mappingsFromDb: Record<string, string> = {};
      dbMappings.filter(m => !m.cost_head_filter).forEach(m => {
        mappingsFromDb[m.system_pattern] = m.activity_code;
      });
      setLocalMappings(mappingsFromDb);
      setHasChanges(false);
    }
  }, [dbMappings]);

  // Notify parent of mapping changes
  useEffect(() => {
    onMappingsChange?.(dbMappings);
  }, [dbMappings, onMappingsChange]);

  const handleActivityChange = useCallback((system: string, activityCode: string) => {
    const key = system.toLowerCase().trim();
    setLocalMappings(prev => ({
      ...prev,
      [key]: activityCode,
    }));
    setHasChanges(true);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!projectId) {
      toast({
        title: "No Project Selected",
        description: "Please select a project to save activity mappings.",
        variant: "destructive",
      });
      return;
    }

    const mappingsToSave = Object.entries(localMappings)
      .filter(([_, code]) => code && code !== '0000')
      .map(([systemPattern, activityCode]) => ({
        systemPattern,
        activityCode,
      }));

    try {
      await batchSave.mutateAsync({
        projectId,
        mappings: mappingsToSave,
      });

      setHasChanges(false);
      toast({
        title: "Mappings Saved",
        description: `Saved ${mappingsToSave.length} system-to-activity mappings.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save activity mappings. Please try again.",
        variant: "destructive",
      });
    }
  }, [projectId, localMappings, batchSave]);

  const handleReset = useCallback(() => {
    const mappingsFromDb: Record<string, string> = {};
    dbMappings.filter(m => !m.cost_head_filter).forEach(m => {
      mappingsFromDb[m.system_pattern] = m.activity_code;
    });
    setLocalMappings(mappingsFromDb);
    setHasChanges(false);
  }, [dbMappings]);

  const handleAutoSuggestAll = useCallback(() => {
    const newMappings: Record<string, string> = { ...localMappings };
    let suggestedCount = 0;

    systemData.forEach(({ system }) => {
      const key = system.toLowerCase().trim();
      if (!newMappings[key] || newMappings[key] === '0000') {
        const suggestion = suggestActivityCode(system);
        if (suggestion) {
          newMappings[key] = suggestion;
          suggestedCount++;
        }
      }
    });

    setLocalMappings(newMappings);
    setHasChanges(true);

    toast({
      title: "Auto-Suggestions Applied",
      description: `Applied ${suggestedCount} activity code suggestions based on system names.`,
    });
  }, [systemData, localMappings]);

  // Stats
  const stats = useMemo(() => {
    const total = systemData.length;
    const mapped = systemData.filter(s => {
      const code = localMappings[s.system.toLowerCase().trim()];
      return code && code !== '0000';
    }).length;
    return { total, mapped, unmapped: total - mapped };
  }, [systemData, localMappings]);

  if (systemData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System to Activity Code Mapping
          </CardTitle>
          <CardDescription>
            No system data found. Upload an estimate to configure activity mappings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System to Activity Code Mapping
            </CardTitle>
            <CardDescription>
              Map systems to their activity code — the middle segment of assembled labor codes. Format: SEC ACT COSTHEAD (e.g., 01 WATR VALV, 01 SNWV PIPE).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background">
              {stats.mapped}/{stats.total} mapped
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoSuggestAll}
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Auto-Suggest
            </Button>
            {hasChanges && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={batchSave.isPending}
                >
                  {batchSave.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save All
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-3">
              Activity codes are the middle segment: <code className="bg-muted px-1 rounded">SEC · <strong>ACT</strong> · COSTHEAD</code> — e.g., 01 · WATR · VALV. The cost head comes from category mapping; the section comes from floor mapping.
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">System Name</TableHead>
                  <TableHead className="w-[35%]">Activity Code</TableHead>
                  <TableHead className="w-[20%] text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemData.map(({ system, itemCount }) => {
                  const key = system.toLowerCase().trim();
                  const currentCode = localMappings[key] || '';
                  const suggestion = suggestions[key];
                  const isMapped = currentCode && currentCode !== '0000';
                  const isExpanded = expandedSystems.has(system);
                  const categories = systemCategoryData[system] || [];
                  const hasCategories = categories.length > 1;

                  return (
                    <React.Fragment key={system}>
                      <TableRow className={isMapped ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {hasCategories && (
                              <button
                                onClick={() => setExpandedSystems(prev => {
                                  const next = new Set(prev);
                                  next.has(system) ? next.delete(system) : next.add(system);
                                  return next;
                                })}
                                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                                title="Show category overrides"
                              >
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                              </button>
                            )}
                            {!hasCategories && <div className="w-4" />}
                            {isMapped && <Check className="h-4 w-4 text-primary" />}
                            {system}
                            {hasCategories && (
                              <>
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {categories.length} cats
                                </Badge>
                                {(() => {
                                  const hasUnresolvedShared = categories.some(cat => {
                                    if (!cat.currentCostHead) return false;
                                    const shared = sharedCostHeadMap[cat.currentCostHead];
                                    if (!shared || shared.length < 2) return false;
                                    return !dbMappings.some(
                                      m => m.system_pattern === key &&
                                           m.cost_head_filter === cat.category &&
                                           m.activity_code
                                    );
                                  });
                                  return hasUnresolvedShared ? (
                                    <span
                                      className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700"
                                      title="Some categories share cost heads with other systems — expand to review"
                                    >
                                      ⚠️ shared codes
                                    </span>
                                  ) : null;
                                })()}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ActivityCodeInput
                            value={currentCode}
                            onChange={(value) => handleActivityChange(system, value)}
                            suggestion={suggestion}
                          />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {itemCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      {isExpanded && categories.map(cat => {
                        const existingOverride = dbMappings.find(
                          m => m.system_pattern === key && m.cost_head_filter === cat.category
                        );
                        const currentActivity = existingOverride?.activity_code ?? '';

                        const isShared = !!(cat.currentCostHead &&
                          (sharedCostHeadMap[cat.currentCostHead]?.length ?? 0) >= 2);
                        const otherSystems = isShared
                          ? (sharedCostHeadMap[cat.currentCostHead!] ?? []).filter(s => s !== system)
                          : [];

                        return (
                          <TableRow
                            key={`${system}::${cat.category}`}
                            className={cn(
                              isShared && !currentActivity && 'bg-amber-50/60',
                              isShared && currentActivity && 'bg-green-50/60',
                              !isShared && 'bg-accent/30'
                            )}
                          >
                            <TableCell className="pl-12">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">↳</span>
                                  <span className="text-xs font-medium">{cat.category}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {cat.items} items · {cat.hours.toFixed(0)} hrs
                                  </span>
                                  {cat.currentCostHead && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                                      → {cat.currentCostHead}
                                    </Badge>
                                  )}
                                </div>
                                {isShared && otherSystems.length > 0 && (
                                  <div className={cn(
                                    'flex items-start gap-1.5 rounded px-2 py-1 text-xs border',
                                    currentActivity
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : 'bg-amber-50 border-amber-200 text-amber-700'
                                  )}>
                                    <span className="shrink-0 mt-0.5">
                                      {currentActivity ? '✓' : '⚠️'}
                                    </span>
                                    <span>
                                      {currentActivity ? (
                                        <>
                                          <span className="font-mono font-semibold">{cat.currentCostHead}</span>
                                          {' '}now distinguished from{' '}
                                          <span className="font-mono">{otherSystems.join(', ')}</span>
                                          {' '}via ACT{' '}
                                          <span className="font-mono font-semibold">{currentActivity}</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-mono font-semibold">{cat.currentCostHead}</span>
                                          {' '}is shared by{' '}
                                          <span className="font-semibold">{otherSystems.length + 1} systems</span>
                                          {': '}
                                          <span className="font-mono">{[system, ...otherSystems].join(', ')}</span>
                                          {' — set an ACT code here to distinguish'}
                                        </>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ActivityCodeInput
                                  value={currentActivity}
                                  onChange={async (code) => {
                                    if (!projectId) return;
                                    if (!code || code === '0000') {
                                      if (existingOverride) {
                                        await deleteMapping.mutateAsync({
                                          projectId,
                                          systemPattern: key,
                                          costHeadFilter: cat.category,
                                        });
                                        toast({ title: "Override Removed", description: `${cat.category} will inherit system activity code.` });
                                      }
                                    } else {
                                      await saveMapping.mutateAsync({
                                        projectId,
                                        systemPattern: key,
                                        activityCode: code,
                                        costHeadFilter: cat.category,
                                      });
                                      toast({ title: "Override Saved", description: `${cat.category} → ${code}` });
                                    }
                                  }}
                                  suggestion={null}
                                />
                                {currentActivity && (
                                  <button
                                    onClick={async () => {
                                      if (!projectId || !existingOverride) return;
                                      await deleteMapping.mutateAsync({
                                        projectId,
                                        systemPattern: key,
                                        costHeadFilter: cat.category,
                                      });
                                      toast({ title: "Override Removed" });
                                    }}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!currentActivity && isMapped && (
                                  <span className="text-xs text-muted-foreground">
                                    inherits {currentCode}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};