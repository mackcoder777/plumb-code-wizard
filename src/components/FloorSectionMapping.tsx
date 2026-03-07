import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { toast } from '@/components/ui/use-toast';
import { Layers, Save, RotateCcw, Loader2, ChevronsUpDown, Check, Plus, RefreshCw, ChevronDown, ChevronRight, Wand2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFloorSectionMappings,
  useBatchSaveFloorSectionMappings,
  FloorSectionMapping,
} from '@/hooks/useFloorSectionMappings';
import { DatasetProfile, describeProfile, PatternOverride, getPatternLabel, getProfileFromOverride } from '@/utils/datasetProfiler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FloorSectionMappingPanelProps {
  estimateData: Array<{ floor?: string; costCode?: string }>;
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
  onApplySectionCodes?: (mappings: Record<string, string>) => void;
  datasetProfile?: DatasetProfile | null;
  onProfileOverride?: (override: PatternOverride | null) => void;
}

interface BuildingGroup {
  buildingKey: string;
  childFloors: string[];
  floorCounts: Record<string, number>;
  totalCount: number;
}

// ─── Common section codes ─────────────────────────────────────────────────────
const COMMON_SECTION_CODES = [
  { value: '01', label: 'Section 1' },
  { value: '02', label: 'Section 2' },
  { value: '03', label: 'Section 3' },
  { value: '04', label: 'Section 4' },
  { value: '05', label: 'Section 5' },
  { value: 'BG', label: 'Below Grade' },
  { value: 'UG', label: 'Underground' },
  { value: 'RF', label: 'Roof' },
  { value: 'CL', label: 'Club Level' },
  { value: 'SB', label: 'Seating Bowl' },
  { value: 'LR', label: 'Low Roof' },
  { value: 'P1', label: 'Parking 1' },
  { value: 'P2', label: 'Parking 2' },
];

// ─── Section Code Input (combobox with custom entry) ──────────────────────────
interface SectionCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  customCodes: Array<{ value: string; label: string }>;
  className?: string;
}

const SectionCodeInput: React.FC<SectionCodeInputProps> = ({ value, onChange, customCodes, className }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  const allCodes = useMemo(() => {
    const combined = [...COMMON_SECTION_CODES];
    customCodes.forEach(cc => {
      if (!combined.find(c => c.value === cc.value)) combined.push(cc);
    });
    return combined;
  }, [customCodes]);

  const displayLabel = useMemo(() => {
    const found = allCodes.find(c => c.value === value);
    return found ? `${found.value} - ${found.label}` : value || 'Select section...';
  }, [value, allCodes]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
    setInputValue('');
  };

  const handleAddCustom = () => {
    if (customCode.trim().length >= 1 && customCode.trim().length <= 3) {
      onChange(customCode.trim().toUpperCase());
      setCustomCode('');
      setCustomLabel('');
      setIsAddingCustom(false);
      setOpen(false);
    }
  };

  const filteredCodes = allCodes.filter(code =>
    code.value.toLowerCase().includes(inputValue.toLowerCase()) ||
    code.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between font-normal", className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0 bg-popover" align="start">
        {isAddingCustom ? (
          <div className="p-3 space-y-3">
            <div className="text-sm font-medium">Add Custom Section Code</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground">Code (1-3 chars)</label>
                <Input
                  ref={codeInputRef}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="e.g., CL, UG, 01"
                  className="h-8 font-mono"
                  maxLength={3}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description (optional)</label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g., Club Level"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setIsAddingCustom(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleAddCustom} disabled={!customCode.trim()}>
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Search or type code..." value={inputValue} onValueChange={setInputValue} />
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
              <CommandGroup heading="Common Codes">
                {filteredCodes.map((code) => (
                  <CommandItem
                    key={code.value}
                    value={`${code.value} ${code.label}`}
                    onSelect={() => handleSelect(code.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === code.value ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono mr-2">{code.value}</span>
                    <span className="text-muted-foreground">- {code.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={() => setIsAddingCustom(true)} className="text-primary">
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

// ─── Auto-suggest helpers ─────────────────────────────────────────────────────
function suggestSection(displayName: string): string {
  const bldgMatch = displayName.match(/^bldg\s*(\w+)/i);
  if (bldgMatch) {
    const num = bldgMatch[1];
    if (!isNaN(Number(num))) return Number(num) >= 10 ? num : `B${num}`;
    return `B${num.toUpperCase()}`;
  }
  const lower = displayName.toLowerCase();
  if (lower.includes('basement') || lower.includes('below') || lower === 'bg' || lower === 'ug') return 'BG';
  if (lower.includes('roof') || lower === 'rf') return 'RF';
  if (lower.includes('crawl')) return 'CS';
  if (lower.includes('mezzanine') || lower.includes('mezz')) return 'MZ';
  if (lower.includes('parking') || lower.startsWith('p')) {
    if (lower.includes('1') || lower === 'p1') return 'P1';
    if (lower.includes('2') || lower === 'p2') return 'P2';
    if (lower.includes('3') || lower === 'p3') return 'P3';
  }
  const levelMatch = lower.match(/(?:level|floor|l|f)\s*(\d+)/i);
  if (levelMatch) return `L${levelMatch[1]}`;
  return '';
}

function suggestActivity(floorName: string): string {
  const lower = floorName.toLowerCase();
  const dashIdx = lower.indexOf(' - ');
  const floorPart = dashIdx > 0 ? lower.substring(dashIdx + 3).trim() : lower;
  const clean = floorPart.replace(/\s*\(.*\)\s*$/, '').trim();

  const levelMatch = clean.match(/(?:level|lvl|floor|l|f)\s*(\d+)/i);
  if (levelMatch) return `00L${levelMatch[1]}`;
  if (/basement|below\s*grade/.test(clean)) return '00LB';
  if (/mezzanine|mezz/.test(clean)) return '00LM';
  if (/penthouse|pent/.test(clean)) return '00LP';
  if (/roof/.test(clean)) return '00LR';
  if (/crawl/.test(clean)) return '00LC';
  return '0000';
}

// ─── Grouping logic ───────────────────────────────────────────────────────────
function groupFloors(
  floorCounts: Record<string, number>
): { groups: BuildingGroup[]; standalones: Array<{ floor: string; count: number }> } {
  const groupMap = new Map<string, { floors: string[]; counts: Record<string, number>; total: number }>();
  const standalones: Array<{ floor: string; count: number }> = [];

  Object.entries(floorCounts).forEach(([floor, count]) => {
    const sep = floor.indexOf(' - ');
    if (sep > 0) {
      const key = floor.substring(0, sep);
      if (!groupMap.has(key)) groupMap.set(key, { floors: [], counts: {}, total: 0 });
      const g = groupMap.get(key)!;
      g.floors.push(floor);
      g.counts[floor] = count;
      g.total += count;
    } else {
      standalones.push({ floor, count });
    }
  });

  const groups: BuildingGroup[] = [];
  groupMap.forEach((val, buildingKey) => {
    groups.push({
      buildingKey,
      childFloors: val.floors.sort((a, b) => (val.counts[b] || 0) - (val.counts[a] || 0)),
      floorCounts: val.counts,
      totalCount: val.total,
    });
  });

  groups.sort((a, b) => b.totalCount - a.totalCount);
  standalones.sort((a, b) => b.count - a.count);
  return { groups, standalones };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const FloorSectionMappingPanel: React.FC<FloorSectionMappingPanelProps> = ({
  estimateData,
  projectId,
  onMappingsChange,
  onApplySectionCodes,
}) => {
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  const [localActivityMappings, setLocalActivityMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: dbMappings = [], isLoading } = useFloorSectionMappings(projectId);
  const batchSave = useBatchSaveFloorSectionMappings();

  // Floor counts
  const floorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    estimateData.forEach(item => {
      const f = (item.floor || '').trim();
      if (f) counts[f] = (counts[f] || 0) + 1;
    });
    return counts;
  }, [estimateData]);

  const { groups, standalones } = useMemo(() => groupFloors(floorCounts), [floorCounts]);

  // Custom codes from current mappings
  const customCodes = useMemo(() => {
    const commonValues = new Set(COMMON_SECTION_CODES.map(c => c.value));
    const custom: Array<{ value: string; label: string }> = [];
    Object.values(localMappings).forEach(code => {
      if (code && !commonValues.has(code) && !custom.find(c => c.value === code)) {
        custom.push({ value: code, label: 'Custom' });
      }
    });
    return custom;
  }, [localMappings]);

  // Init from DB
  useEffect(() => {
    if (dbMappings.length > 0) {
      const sec: Record<string, string> = {};
      const act: Record<string, string> = {};
      dbMappings.forEach(m => {
        sec[m.floor_pattern] = m.section_code;
        act[m.floor_pattern] = m.activity_code || '0000';
      });
      setLocalMappings(sec);
      setLocalActivityMappings(act);
      setHasChanges(false);
    }
  }, [dbMappings]);

  useEffect(() => {
    onMappingsChange?.(localMappings);
  }, [localMappings, onMappingsChange]);

  // Item counts
  const itemCounts = useMemo(() => {
    const withCodes = estimateData.filter(item => item.costCode && item.costCode.trim()).length;
    const totalWithFloor = estimateData.filter(item => item.floor && item.floor.trim()).length;
    return { withCodes, totalWithFloor, total: estimateData.length };
  }, [estimateData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSectionChangeForFloors = useCallback((childFloors: string[], sectionCode: string) => {
    setLocalMappings(prev => {
      const next = { ...prev };
      childFloors.forEach(f => { next[f] = sectionCode; });
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleActivityChangeForFloor = useCallback((floor: string, activityCode: string) => {
    setLocalActivityMappings(prev => ({ ...prev, [floor]: activityCode }));
    setHasChanges(true);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!projectId) {
      toast({ title: "No Project Selected", description: "Please select a project to save floor mappings.", variant: "destructive" });
      return;
    }
    const mappingsToSave = Object.entries(localMappings).map(([floorPattern, sectionCode]) => ({
      floorPattern,
      sectionCode,
      activityCode: localActivityMappings[floorPattern] || '0000',
    }));
    try {
      await batchSave.mutateAsync({ projectId, mappings: mappingsToSave });
      setHasChanges(false);
      toast({ title: "Mappings Saved", description: `Saved ${mappingsToSave.length} floor-to-section mappings.` });
    } catch {
      toast({ title: "Save Failed", description: "Failed to save floor mappings. Please try again.", variant: "destructive" });
    }
  }, [projectId, localMappings, localActivityMappings, batchSave]);

  const handleApplySectionCodes = useCallback(() => {
    if (onApplySectionCodes) {
      onApplySectionCodes(localMappings);
      toast({
        title: "Section Codes Applied",
        description: `Updated section codes on ${itemCounts.withCodes} items with labor codes.`,
      });
    }
  }, [localMappings, onApplySectionCodes, itemCounts]);

  const handleReset = useCallback(() => {
    const sec: Record<string, string> = {};
    const act: Record<string, string> = {};
    dbMappings.forEach(m => {
      sec[m.floor_pattern] = m.section_code;
      act[m.floor_pattern] = m.activity_code || '0000';
    });
    setLocalMappings(sec);
    setLocalActivityMappings(act);
    setHasChanges(false);
  }, [dbMappings]);

  const handleAutoSuggestAll = useCallback(() => {
    const newSec: Record<string, string> = {};
    const newAct: Record<string, string> = {};

    // Building groups: section from building key, activity per floor
    groups.forEach(group => {
      const sec = suggestSection(group.buildingKey);
      group.childFloors.forEach(floor => {
        newSec[floor] = sec || localMappings[floor] || '';
        // Only suggest activity when there are multiple floors to disambiguate
        newAct[floor] = group.childFloors.length > 1
          ? suggestActivity(floor)
          : '0000';
      });
    });

    // Standalones: section from name, activity from name
    standalones.forEach(({ floor }) => {
      newSec[floor] = suggestSection(floor) || localMappings[floor] || '';
      newAct[floor] = suggestActivity(floor);
    });

    setLocalMappings(newSec);
    setLocalActivityMappings(newAct);
    setHasChanges(true);
    toast({ title: "Auto-Suggestions Applied", description: "Review section & activity codes, then save." });
  }, [groups, standalones, localMappings]);

  // ── Expand/Collapse ──────────────────────────────────────────────────────
  const toggleGroup = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const isExpanded = (key: string) => !collapsed.has(key);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (Object.keys(floorCounts).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Floor to Section Mapping
          </CardTitle>
          <CardDescription>
            No floor data found in the estimate. Upload an estimate with floor information to configure section mappings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ── Grid column layout ───────────────────────────────────────────────────
  const gridCols = 'grid grid-cols-[1fr_220px_160px_130px] items-center';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Floor to Section Mapping
            </CardTitle>
            <CardDescription>
              Map buildings to section codes and floors to activity codes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAutoSuggestAll} disabled={isLoading}>
              <Wand2 className="h-4 w-4 mr-1" />
              Auto-Suggest
            </Button>
            {itemCounts.withCodes > 0 && onApplySectionCodes && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (hasChanges) {
                    handleSaveAll().then(() => handleApplySectionCodes());
                  } else {
                    handleApplySectionCodes();
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-apply Sections ({itemCounts.withCodes.toLocaleString()} items)
              </Button>
            )}
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button size="sm" onClick={handleSaveAll} disabled={batchSave.isPending}>
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
          <>
            {/* Summary bar */}
            <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
              <div className="text-sm font-medium mb-2">Item Summary</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="ml-2 font-semibold">{itemCounts.total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">With Floor Value:</span>
                  <span className="ml-2 font-semibold">{itemCounts.totalWithFloor.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">With Labor Code:</span>
                  <span className="ml-2 font-semibold text-green-600">{itemCounts.withCodes.toLocaleString()}</span>
                  {itemCounts.total - itemCounts.withCodes > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({(itemCounts.total - itemCounts.withCodes).toLocaleString()} uncoded)
                    </span>
                  )}
                </div>
              </div>
              {itemCounts.withCodes < itemCounts.totalWithFloor && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ {(itemCounts.totalWithFloor - itemCounts.withCodes).toLocaleString()} items have floor values but no labor code yet.
                </p>
              )}
            </div>

            {/* Column headers */}
            <div className={cn(gridCols, "px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b")}>
              <div>Floor Value</div>
              <div>Section Code</div>
              <div>Activity Code</div>
              <div className="text-right">Item Count</div>
            </div>

            {/* Building groups */}
            {groups.map(group => {
              const expanded = isExpanded(group.buildingKey);
              const buildingSection = localMappings[group.childFloors[0]] || '';

              return (
                <div key={group.buildingKey} className="border-b last:border-b-0">
                  {/* Parent row — building level */}
                  <div className={cn(gridCols, "px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors")}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleGroup(group.buildingKey)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span className="font-medium">{group.buildingKey}</span>
                      <span className="text-xs text-muted-foreground">
                        ({group.childFloors.length} floor{group.childFloors.length !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Section — applies to all children */}
                    <SectionCodeInput
                      value={buildingSection}
                      onChange={(val) => handleSectionChangeForFloors(group.childFloors, val)}
                      customCodes={customCodes}
                      className="h-8"
                    />

                    {/* Activity — varies per child, show dash */}
                    <div className="text-sm text-muted-foreground pl-2">—</div>

                    {/* Total count */}
                    <div className="text-right">
                      <Badge variant="secondary">{group.totalCount.toLocaleString()} items</Badge>
                    </div>
                  </div>

                  {/* Child floor rows */}
                  {expanded && group.childFloors.map(floor => {
                    const floorLabel = floor.substring(group.buildingKey.length + 3);
                    const count = group.floorCounts[floor] || 0;
                    return (
                      <div key={floor} className={cn(gridCols, "px-3 py-1.5 pl-10 border-t border-dashed border-border/50 hover:bg-muted/20 transition-colors")}>
                        {/* Indented floor label */}
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-4 bg-border rounded-full flex-shrink-0" />
                          <span className="text-sm">{floorLabel || floor}</span>
                        </div>

                        {/* Section — inherited, read-only */}
                        <div className="text-sm font-mono text-muted-foreground pl-2">
                          {localMappings[floor] || '—'}
                        </div>

                        {/* Activity — per-floor input */}
                        <Input
                          value={localActivityMappings[floor] || '0000'}
                          onChange={(e) => handleActivityChangeForFloor(floor, e.target.value.toUpperCase().slice(0, 8))}
                          className="h-7 font-mono text-sm w-24"
                          placeholder="0000"
                          maxLength={8}
                        />

                        {/* Per-floor count */}
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">{count.toLocaleString()} items</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Standalone rows (Roof, Crawl Space, UG, etc.) */}
            {standalones.map(({ floor, count }) => (
              <div key={floor} className={cn(gridCols, "px-3 py-2 border-b last:border-b-0 hover:bg-muted/20 transition-colors")}>
                <div className="font-medium">{floor}</div>

                <SectionCodeInput
                  value={localMappings[floor] || ''}
                  onChange={(val) => handleSectionChangeForFloors([floor], val)}
                  customCodes={customCodes}
                  className="h-8"
                />

                <Input
                  value={localActivityMappings[floor] || '0000'}
                  onChange={(e) => handleActivityChangeForFloor(floor, e.target.value.toUpperCase().slice(0, 8))}
                  className="h-7 font-mono text-sm w-24"
                  placeholder="0000"
                  maxLength={8}
                />

                <div className="text-right">
                  <Badge variant="secondary">{count.toLocaleString()} items</Badge>
                </div>
              </div>
            ))}
          </>
        )}

        {hasChanges && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            You have unsaved changes. Click "Save All" to persist floor-to-section mappings.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
