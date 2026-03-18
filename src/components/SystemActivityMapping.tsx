import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { toast } from '@/components/ui/use-toast';
import { Activity, Save, RotateCcw, Loader2, ChevronsUpDown, Check, Plus, Sparkles } from 'lucide-react';
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
  SystemActivityMapping,
  ACTIVITY_CODE_SUGGESTIONS,
  suggestActivityCode,
} from '@/hooks/useSystemActivityMappings';

interface SystemData {
  system: string;
  itemCount: number;
}

interface SystemActivityMappingPanelProps {
  estimateData: Array<{ system?: string }>;
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

  const { data: dbMappings = [], isLoading } = useSystemActivityMappings(projectId);
  const batchSave = useBatchSaveSystemActivityMappings();

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

  // Initialize local mappings from database (blanket rules only)
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

                  return (
                    <TableRow key={system} className={isMapped ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isMapped && <Check className="h-4 w-4 text-primary" />}
                          {system}
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