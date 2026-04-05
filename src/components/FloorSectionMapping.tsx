import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import type { EstimateItem } from '@/types/estimate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { toast } from '@/components/ui/use-toast';
import { Layers, Save, RotateCcw, Loader2, ChevronsUpDown, Check, Plus, RefreshCw, ChevronDown, ChevronRight, Wand2, Info, Shuffle, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, normalizeActivityCode } from '@/lib/utils';
import {
  useFloorSectionMappings,
  useBatchSaveFloorSectionMappings,
  FloorSectionMapping,
} from '@/hooks/useFloorSectionMappings';
import { BuildingSectionMapping } from '@/hooks/useBuildingSectionMappings';
import { supabase } from '@/integrations/supabase/client';
import { DatasetProfile, describeProfile, PatternOverride, getPatternLabel, getProfileFromOverride } from '@/utils/datasetProfiler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FloorSectionMappingPanelProps {
  estimateData: EstimateItem[];
  projectId: string | null;
  onMappingsChange?: (mappings: Record<string, string>) => void;
  onApplySectionCodes?: (mappings: Record<string, string>, activityMappings: Record<string, string>) => void;
  datasetProfile?: DatasetProfile | null;
  onProfileOverride?: (override: PatternOverride | null) => void;
  onReanalyze?: () => void;
  buildingMappings?: BuildingSectionMapping[];
  onBuildingMappingsChanged?: () => void;
  costHeadActivityOverrides?: Array<{ cost_head: string; use_level_activity: boolean }>;
  onCostHeadOverridesChange?: (overrides: Array<{ costHead: string; useLevelActivity: boolean }>) => void;
  codeFormatMode?: 'standard' | 'multitrade';
  tradePrefix?: string;
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
  onAddCustomCode?: (code: string, label: string) => void;
  customCodes: Array<{ value: string; label: string }>;
  className?: string;
}

const SectionCodeInput: React.FC<SectionCodeInputProps> = ({ value, onChange, onAddCustomCode, customCodes, className }) => {
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
      const code = customCode.trim().toUpperCase();
      onAddCustomCode?.(code, customLabel.trim() || 'Custom');
      onChange(code);
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
  if (/^roof$/i.test(clean)) return '00RF';
  if (/^crawl/i.test(clean)) return '00CS';
  if (/^ug$/i.test(clean)) return '00UG';
  if (/^site$/i.test(clean)) return '00ST';
  if (/^site\s+above\s+grade$/i.test(clean)) return '00AG';
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

// ─── Standalone floor classification ──────────────────────────────────────────
interface StandaloneFloorInfo {
  type: 'single' | 'dominant' | 'multi' | 'unknown';
  primaryBuilding: string | null;
  primaryPct: number;
  breakdown: Array<{ label: string; count: number; pct: number }>;
}

function classifyStandaloneFloor(
  _floor: string,
  zoneBreakdown: Record<string, number> | undefined
): StandaloneFloorInfo {
  if (!zoneBreakdown || Object.keys(zoneBreakdown).length === 0) {
    return { type: 'unknown', primaryBuilding: null, primaryPct: 0, breakdown: [] };
  }

  const total = Object.values(zoneBreakdown).reduce((s, n) => s + n, 0);
  const sorted = Object.entries(zoneBreakdown)
    .map(([zone, count]) => ({
      label: zone,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const top = sorted[0];
  const topPct = (top.count / total) * 100;

  const bldgMatch = top.label.match(/BLDG\s*[-–]\s*([A-Z0-9]+)/i);
  const primaryBuilding = bldgMatch ? bldgMatch[1].toUpperCase() : null;

  if (topPct === 100) {
    return { type: 'single', primaryBuilding, primaryPct: 100, breakdown: sorted };
  }
  if (topPct >= 80) {
    return { type: 'dominant', primaryBuilding, primaryPct: Math.round(topPct), breakdown: sorted };
  }
  return { type: 'multi', primaryBuilding: null, primaryPct: Math.round(topPct), breakdown: sorted };
}

// ─── StandaloneFloorRow component ─────────────────────────────────────────────
interface StandaloneFloorRowProps {
  floor: string;
  count: number;
  sectionCode: string;
  activityCode: string;
  zoneBreakdown: Record<string, number> | undefined;
  onSectionChange: (floors: string[], section: string) => void;
  onActivityChange: (floor: string, activity: string) => void;
  onAddCustomCode?: (code: string, label: string) => void;
  gridCols: string;
  customCodes: Array<{ value: string; label: string }>;
  buildingMappings?: BuildingSectionMapping[];
  sectionSuggestions?: Array<{ code: string; description: string }>;
  onZonePatternSave?: (zoneLabel: string, sectionCode: string) => void;
  codeFormatMode?: 'standard' | 'multitrade';
  tradePrefix?: string;
}

// ─── Inline zone assignment input with datalist ──────────────────────────────
const ZoneAssignInput: React.FC<{
  sectionSuggestions?: Array<{ code: string; description: string }>;
  onAssign: (sectionCode: string) => void;
  initialValue?: string;
  onCancel?: () => void;
}> = ({ sectionSuggestions, onAssign, initialValue = '', onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const listId = useRef(`zone-dl-${Math.random().toString(36).slice(2, 8)}`).current;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValue) inputRef.current?.focus();
  }, [initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed) {
      onAssign(trimmed);
      setValue('');
    } else if (onCancel) {
      onCancel();
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        ref={inputRef}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
          if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
        }}
        onBlur={handleConfirm}
        placeholder="?"
        className="w-16 text-xs border rounded px-1 py-0.5 font-mono bg-background text-foreground placeholder:text-muted-foreground"
      />
      <datalist id={listId}>
        {sectionSuggestions?.map(s => (
          <option key={s.code} value={s.code}>
            {s.code}{s.description ? ` — ${s.description}` : ''}
          </option>
        ))}
      </datalist>
    </span>
  );
};

const StandaloneFloorRow: React.FC<StandaloneFloorRowProps> = ({
  floor,
  count,
  sectionCode,
  activityCode,
  zoneBreakdown,
  onSectionChange,
  onActivityChange,
  onAddCustomCode,
  gridCols,
  customCodes,
  buildingMappings,
  sectionSuggestions,
  onZonePatternSave,
  codeFormatMode,
  tradePrefix,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const info = classifyStandaloneFloor(floor, zoneBreakdown);

  return (
    <div className="border-b last:border-b-0">
      {/* Main row */}
      <div className={cn(gridCols, "px-3 py-2 hover:bg-muted/20 transition-colors")}>
        {/* Floor label + resolution badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{floor}</span>

          {info.type === 'multi' && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors flex-shrink-0"
              title="This floor spans multiple buildings. Each item resolves to its building via zone at assembly time."
            >
              <Shuffle className="h-3 w-3" />
              Per-item ({info.breakdown.length} zones)
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}

          {info.type === 'single' && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              → {info.breakdown[0]?.label}
            </Badge>
          )}

          {info.type === 'dominant' && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-100 transition-colors flex-shrink-0"
              title={`${info.primaryPct}% of items resolve to ${info.breakdown[0]?.label}`}
            >
              ~{info.primaryPct}% → Bldg {info.primaryBuilding}
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}

          {info.type === 'unknown' && (
            <span className="text-xs text-muted-foreground">(no zone data)</span>
          )}
        </div>

        {/* Section code */}
        <div className="flex items-center gap-1.5">
          {codeFormatMode === 'multitrade' ? (
            <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
              {tradePrefix || 'PL'}
            </Badge>
          ) : (
            <SectionCodeInput
              value={sectionCode}
              onChange={(val) => onSectionChange([floor], val)}
              onAddCustomCode={onAddCustomCode}
              customCodes={customCodes}
              className="h-8"
            />
          )}
        </div>

        {/* Activity */}
        <div className="flex items-center gap-1">
          {codeFormatMode === 'multitrade' ? (
            <SectionCodeInput
              value={sectionCode}
              onChange={(val) => onSectionChange([floor], val)}
              onAddCustomCode={onAddCustomCode}
              customCodes={customCodes}
              className="h-8"
            />
          ) : (
            <>
              <span className="text-xs text-muted-foreground font-medium">ACT</span>
              <Input
                value={activityCode}
                onChange={(e) => onActivityChange(floor, e.target.value.toUpperCase().slice(0, 8))}
                className="h-7 font-mono text-sm w-24"
                placeholder="0000"
                maxLength={8}
              />
            </>
          )}
        </div>

        {/* Count */}
        <div className="text-right">
          <Badge variant="secondary">{count.toLocaleString()} items</Badge>
        </div>
      </div>

      {/* Expanded zone breakdown */}
      {expanded && info.breakdown.length > 0 && (
        <div className="mx-3 mb-3 p-3 bg-muted/30 rounded-lg border border-dashed text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Layers className="h-3.5 w-3.5" />
            At assembly time, each item resolves its section from its zone value:
          </div>

          <div className="space-y-1.5">
            {info.breakdown.map(({ label, count: bCount, pct }) => {
              const bldgMatch = label.match(/BLDG\s*[-–]\s*([A-Z0-9]+)/i);
              const bldgId = bldgMatch ? bldgMatch[1].toUpperCase() : label;
              const matchedMapping = buildingMappings?.find(
                m =>
                  m.building_identifier.toUpperCase() === bldgId.toUpperCase() ||
                  m.building_identifier.toUpperCase() === `B${bldgId}`.toUpperCase() ||
                  m.section_code?.toUpperCase() === bldgId.toUpperCase() ||
                  m.section_code?.toUpperCase() === `B${bldgId}`.toUpperCase()
              );
              const suggestedSection = bldgMatch
                ? (matchedMapping?.section_code || `B${bldgId}`)
                : null;

              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  {/* Progress bar */}
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-muted-foreground">{pct}%</span>
                  <span className="truncate">{label}</span>
                  <span className="text-muted-foreground">→</span>
                  {suggestedSection !== null ? (
                    <span className="font-mono font-medium">{suggestedSection}</span>
                  ) : (() => {
                    const patternMatch = buildingMappings?.find(
                      m => m.zone_pattern && m.zone_pattern.split(',').some(
                        p => label.toLowerCase().includes(p.trim().toLowerCase())
                      )
                    );
                    if (patternMatch) {
                      return <span className="font-mono font-medium">{patternMatch.section_code}</span>;
                    }
                    return (
                      <ZoneAssignInput
                        sectionSuggestions={sectionSuggestions}
                        onAssign={(sectionCode) => onZonePatternSave?.(label, sectionCode)}
                      />
                    );
                  })()}
                  <span className="text-muted-foreground">({bCount.toLocaleString()} items)</span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            The section code above is only used as a fallback when zone resolution yields no match.
            {info.type === 'multi'
              ? ' For this floor, most items will resolve to their own building section.'
              : ` ${info.primaryPct}% will resolve to Bldg ${info.primaryBuilding}.`}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Per-Head Activity Override Section ───────────────────────────────────────
interface CostHeadOverrideSectionProps {
  estimateData: EstimateItem[];
  costHeadActivityOverrides: Array<{ cost_head: string; use_level_activity: boolean }>;
  onCostHeadOverridesChange?: (overrides: Array<{ costHead: string; useLevelActivity: boolean }>) => void;
  onApplySectionCodes?: (mappings: Record<string, string>, activityMappings: Record<string, string>) => void;
  localMappings: Record<string, string>;
  localActivityMappings: Record<string, string>;
}

const CostHeadOverrideSection: React.FC<CostHeadOverrideSectionProps> = ({
  estimateData,
  costHeadActivityOverrides,
  onCostHeadOverridesChange,
  onApplySectionCodes,
  localMappings,
  localActivityMappings,
}) => {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize local state from saved overrides
  useEffect(() => {
    const active = new Set(
      costHeadActivityOverrides
        .filter(o => o.use_level_activity)
        .map(o => o.cost_head)
    );
    setLocalOverrides(active);
    setInitialized(true);
  }, [costHeadActivityOverrides]);

  // Compute unique cost heads with hours from estimate data
  const costHeadSummary = useMemo(() => {
    const map = new Map<string, { costHead: string; hours: number; description: string }>();
    estimateData.forEach(item => {
      const code = item.costCode || '';
      const parts = code.trim().split(/\s+/);
      const head = parts.length >= 3 ? parts.slice(2).join(' ') : '';
      if (!head || head === 'UNCD') return;
      const hours = item.hours || 0;
      const existing = map.get(head);
      if (existing) {
        existing.hours += hours;
      } else {
        map.set(head, { costHead: head, hours, description: '' });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [estimateData]);

  if (costHeadSummary.length === 0) return null;

  const hasOverrideChanges = (() => {
    const savedSet = new Set(
      costHeadActivityOverrides
        .filter(o => o.use_level_activity)
        .map(o => o.cost_head)
    );
    if (localOverrides.size !== savedSet.size) return true;
    for (const h of localOverrides) {
      if (!savedSet.has(h)) return true;
    }
    return false;
  })();

  const handleToggle = (costHead: string) => {
    setLocalOverrides(prev => {
      const next = new Set(prev);
      if (next.has(costHead)) {
        next.delete(costHead);
      } else {
        next.add(costHead);
      }
      return next;
    });
  };

  const handleSaveAndReapply = () => {
    if (!onCostHeadOverridesChange) return;
    const checked = costHeadSummary
      .filter(h => localOverrides.has(h.costHead))
      .map(h => ({ costHead: h.costHead, useLevelActivity: true }));
    onCostHeadOverridesChange(checked);

    // Trigger re-apply
    if (onApplySectionCodes) {
      onApplySectionCodes(localMappings, localActivityMappings);
    }

    toast({
      title: 'Activity overrides saved',
      description: `${checked.length} cost head(s) will use level-based activity codes.`,
    });
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <Collapsible open={overrideOpen} onOpenChange={setOverrideOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary transition-colors">
          {overrideOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Per-Head Activity Overrides
          {localOverrides.size > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">{localOverrides.size} active</Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Checked cost heads will use level-based activity codes (00L1, 00L2, 00RF, etc.) instead of the section's flat mapping.
          </p>
          <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded-md p-2">
            {costHeadSummary.map(h => (
              <label
                key={h.costHead}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={localOverrides.has(h.costHead)}
                  onCheckedChange={() => handleToggle(h.costHead)}
                />
                <span className="font-mono font-medium w-16">{h.costHead}</span>
                <span className="text-muted-foreground flex-1 truncate">{h.description || h.costHead}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{h.hours.toLocaleString(undefined, { maximumFractionDigits: 0 })}h</span>
              </label>
            ))}
          </div>
          {hasOverrideChanges && initialized && (
            <Button size="sm" onClick={handleSaveAndReapply} className="mt-2">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save & Re-apply
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const FloorSectionMappingPanel: React.FC<FloorSectionMappingPanelProps> = ({
  estimateData,
  projectId,
  onMappingsChange,
  onApplySectionCodes,
  datasetProfile,
  onProfileOverride,
  onReanalyze,
  buildingMappings,
  onBuildingMappingsChanged,
  costHeadActivityOverrides = [],
  onCostHeadOverridesChange,
  codeFormatMode = 'standard',
  tradePrefix,
}) => {
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  const [localActivityMappings, setLocalActivityMappings] = useState<Record<string, string>>({});
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: dbMappings = [], isLoading } = useFloorSectionMappings(projectId);
  const batchSave = useBatchSaveFloorSectionMappings();

  // Standalone floor codes that are fallback values, not real building sections
  const STANDALONE_SECTION_CODES = new Set(['RF', 'UG', 'CS', 'ST']);

  // Only show section codes actively assigned in this project's floor mappings
  const allSectionSuggestions = useMemo(() => {
    const codes = new Map<string, string>();
    Object.values(localMappings).forEach(code => {
      if (code && !codes.has(code) && !STANDALONE_SECTION_CODES.has(code.toUpperCase())) {
        codes.set(code, '');
      }
    });
    return Array.from(codes.entries()).map(([code, description]) => ({ code, description }));
  }, [localMappings]);

  // Floor counts
  const floorData = useMemo(() => {
    const counts: Record<string, number> = {};
    const zoneBreakdown: Record<string, Record<string, number>> = {};

    estimateData.forEach(item => {
      const f = (item.floor || '').trim();
      if (!f) return;
      counts[f] = (counts[f] || 0) + 1;

      const z = (item.zone || '').trim();
      if (z) {
        if (!zoneBreakdown[f]) zoneBreakdown[f] = {};
        zoneBreakdown[f][z] = (zoneBreakdown[f][z] || 0) + 1;
      }
    });

    return { counts, zoneBreakdown };
  }, [estimateData]);

  const floorCounts = floorData.counts;
  const floorZoneBreakdown = floorData.zoneBreakdown;

  const { groups, standalones } = useMemo(() => groupFloors(floorCounts), [floorCounts]);

  // Custom codes from current mappings + detected buildings + saved building mappings
  const customCodes = useMemo(() => {
    const commonValues = new Set(COMMON_SECTION_CODES.map(c => c.value));
    const seen = new Set<string>();
    const custom: Array<{ value: string; label: string }> = [];

    const addCode = (code: string, label: string) => {
      const upper = code.toUpperCase().trim();
      if (!upper || commonValues.has(upper) || seen.has(upper)) return;
      seen.add(upper);
      custom.push({ value: upper, label });
    };

    // 1. Codes already assigned in localMappings
    Object.values(localMappings).forEach(code => {
      if (code) addCode(code, customDescriptions[code] || 'Custom');
    });

    // 2. Suggested section codes from every detected building group
    groups.forEach(({ buildingKey }) => {
      const suggested = suggestSection(buildingKey);
      if (suggested) addCode(suggested, `Building ${buildingKey.replace(/^bldg\s*/i, '')}`);
    });

    // 3. Codes from existing buildingMappings prop (already-saved DB records)
    if (buildingMappings) {
      buildingMappings.forEach(bm => {
        if (bm.section_code) addCode(bm.section_code, bm.description || `Building ${bm.building_identifier}`);
      });
    }

    return custom.sort((a, b) => a.value.localeCompare(b.value));
  }, [localMappings, customDescriptions, groups, buildingMappings]);

  // Init from DB
  useEffect(() => {
    if (dbMappings.length > 0) {
      const sec: Record<string, string> = {};
      const act: Record<string, string> = {};
      const descriptions: Record<string, string> = {};
      dbMappings.forEach(m => {
        sec[m.floor_pattern] = m.section_code;
        const storedAct = m.activity_code ?? '0000';
        act[m.floor_pattern] = storedAct;
        if (m.description && m.description !== 'Custom') {
          descriptions[m.section_code] = m.description;
        }
      });
      setLocalMappings(sec);
      setLocalActivityMappings(act);
      setCustomDescriptions(prev => ({ ...prev, ...descriptions }));
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
  const handleAddCustomCode = useCallback((code: string, label: string) => {
    setCustomDescriptions(prev => ({ ...prev, [code]: label }));
  }, []);

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

  const handleZonePatternSave = useCallback(async (zoneLabel: string, sectionCode: string) => {
    if (!sectionCode.trim()) return;
    const code = sectionCode.trim().toUpperCase();
    const mapping = buildingMappings?.find(m => m.section_code.toUpperCase() === code);

    if (!mapping) {
      // Auto-create a new building mapping row with the zone pattern
      if (!projectId) return;
      const { error } = await (supabase as any)
        .from('building_section_mappings')
        .upsert({
          project_id: projectId,
          building_identifier: code,
          section_code: code,
          description: `Building ${code}`,
          zone_pattern: zoneLabel,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'project_id,building_identifier' });

      if (error) {
        toast({ title: 'Error saving zone pattern', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Zone pattern saved', description: `"${zoneLabel}" → ${code} (created)` });
      onBuildingMappingsChanged?.();
      return;
    }

    if (mapping.zone_pattern) {
      // Check if this zone is already included
      const existingPatterns = mapping.zone_pattern.split(',').map(p => p.trim().toLowerCase());
      if (existingPatterns.includes(zoneLabel.toLowerCase())) return; // already saved

      // Append the new pattern
      const updatedPattern = `${mapping.zone_pattern},${zoneLabel}`;
      const { error } = await (supabase as any)
        .from('building_section_mappings')
        .update({ zone_pattern: updatedPattern, updated_at: new Date().toISOString() })
        .eq('id', mapping.id);

      if (error) {
        toast({ title: 'Error saving zone pattern', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Zone pattern saved', description: `"${zoneLabel}" → ${code} (appended)` });
      onBuildingMappingsChanged?.();
      return;
    }

    const { error } = await (supabase as any)
      .from('building_section_mappings')
      .update({ zone_pattern: zoneLabel, updated_at: new Date().toISOString() })
      .eq('id', mapping.id);

    if (error) {
      toast({ title: 'Error saving zone pattern', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Zone pattern saved', description: `"${zoneLabel}" → ${code}` });
    onBuildingMappingsChanged?.();
  }, [buildingMappings, projectId, onBuildingMappingsChanged]);

  const handleSaveAll = useCallback(async () => {
    if (!projectId) {
      toast({ title: "No Project Selected", description: "Please select a project to save floor mappings.", variant: "destructive" });
      return;
    }

    // Union of all floor patterns that have either a section OR an activity edit
    const allPatterns = new Set([
      ...Object.keys(localMappings).filter(p => localMappings[p]?.trim()),
      ...Object.keys(localActivityMappings).filter(p => localActivityMappings[p]?.trim()),
    ]);

    const isMultitrade = codeFormatMode === 'multitrade';
    const mappingsToSave = Array.from(allPatterns).map(floorPattern => ({
      floorPattern,
      sectionCode: isMultitrade ? (tradePrefix ?? 'PL') : (localMappings[floorPattern] || '01'),
      activityCode: isMultitrade ? (localMappings[floorPattern] || '0000') : (localActivityMappings[floorPattern] || '0000'),
      description: customDescriptions[localMappings[floorPattern]] || null,
    }));

    if (mappingsToSave.length === 0) {
      toast({ title: "Nothing to save", description: "No section or activity assignments found.", variant: "destructive" });
      return;
    }

    try {
      await batchSave.mutateAsync({ projectId, mappings: mappingsToSave });
      setHasChanges(false);

      // Sync building_section_mappings from floor mapping groups so the
      // resolver always gets canonical section codes from building records too.
      const buildingGroups: Record<string, string> = {};
      mappingsToSave.forEach(row => {
        const m = (row.floorPattern || '').match(/^bldg\s+([A-Z0-9]+)\s*-/i);
        if (m && row.sectionCode) {
          buildingGroups[m[1].toUpperCase()] = row.sectionCode;
        }
      });
      if (Object.keys(buildingGroups).length > 0) {
        await (supabase as any).from('building_section_mappings').upsert(
          Object.entries(buildingGroups).map(([buildingId, sectionCode]) => ({
            project_id: projectId,
            building_identifier: buildingId,
            section_code: sectionCode,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'project_id,building_identifier' }
        );
        onBuildingMappingsChanged?.();
      }

      toast({ title: "Mappings Saved", description: `Saved ${mappingsToSave.length} floor mapping${mappingsToSave.length !== 1 ? 's' : ''}.` });
    } catch {
      toast({ title: "Save Failed", description: "Failed to save floor mappings. Please try again.", variant: "destructive" });
    }
  }, [projectId, localMappings, localActivityMappings, customDescriptions, batchSave]);

  const handleApplySectionCodes = useCallback(() => {
    if (onApplySectionCodes) {
      onApplySectionCodes(localMappings, localActivityMappings);
      toast({
        title: "Section Codes Applied",
        description: `Updated section codes on ${itemCounts.withCodes} items with labor codes.`,
      });
    }
  }, [localMappings, localActivityMappings, onApplySectionCodes, itemCounts]);

  const handleReset = useCallback(() => {
    const sec: Record<string, string> = {};
    const act: Record<string, string> = {};
    dbMappings.forEach(m => {
      sec[m.floor_pattern] = m.section_code;
      const storedAct = m.activity_code ?? '0000';
      act[m.floor_pattern] = storedAct;
    });
    setLocalMappings(sec);
    setLocalActivityMappings(act);
    setHasChanges(false);
  }, [dbMappings]);

  const handleClearAllActivity = useCallback(() => {
    setLocalActivityMappings(prev => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach(k => { next[k] = '0000'; });
      Object.keys(localMappings).forEach(k => { next[k] = '0000'; });
      return next;
    });
    setHasChanges(true);
    toast({ title: "Activity codes cleared", description: "All activity codes set to 0000. Save to persist." });
  }, [localMappings]);

  const handleClearGroupActivity = useCallback((childFloors: string[]) => {
    setLocalActivityMappings(prev => {
      const next = { ...prev };
      childFloors.forEach(f => { next[f] = '0000'; });
      return next;
    });
    setHasChanges(true);
    toast({
      title: "Activity codes cleared",
      description: `Set ${childFloors.length} floor${childFloors.length !== 1 ? 's' : ''} to 0000.`
    });
  }, []);

  const handleAutoSuggestAll = useCallback(() => {
    const newSec: Record<string, string> = {};
    const newAct: Record<string, string> = {};

    // Building groups: section from building key, activity per floor
    groups.forEach(group => {
      const sec = suggestSection(group.buildingKey);
      group.childFloors.forEach(floor => {
        newSec[floor] = sec || localMappings[floor] || '';
        newAct[floor] = suggestActivity(floor);
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
            Section Mapping
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
              Section Mapping
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Clear Activity
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleClearAllActivity}
                >
                  Set All Activity to 0000
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {itemCounts.withCodes > 0 && onApplySectionCodes && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (hasChanges) {
                    await handleSaveAll();
                  }
                  handleApplySectionCodes();
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

      {datasetProfile && datasetProfile.confidence > 0 && (
        <div className="px-6 pb-2">
          <Alert className="bg-muted/50 border-border">
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-sm">
                <strong>Detected pattern:</strong> {describeProfile(datasetProfile)}.{' '}
                <span className="text-muted-foreground">
                  Confidence: {Math.round(datasetProfile.confidence * 100)}%
                </span>
              </span>
              <div className="flex items-center gap-2">
                {onReanalyze && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onReanalyze}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Re-analyze
                  </Button>
                )}
                {onProfileOverride && (
                  <Select
                    onValueChange={(val) => onProfileOverride(val === 'auto' ? null : val as PatternOverride)}
                  >
                    <SelectTrigger className="w-[220px] h-8 text-xs">
                      <SelectValue placeholder="Override detection ▾" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="pattern1">{getPatternLabel('pattern1')}</SelectItem>
                      <SelectItem value="pattern2">{getPatternLabel('pattern2')}</SelectItem>
                      <SelectItem value="pattern3">{getPatternLabel('pattern3')}</SelectItem>
                      <SelectItem value="pattern4">{getPatternLabel('pattern4')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

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
              <div>{codeFormatMode === 'multitrade' ? 'SEC (fixed)' : 'Section Code'}</div>
              <div>{codeFormatMode === 'multitrade' ? 'ACT Code (building)' : 'Activity Code'}</div>
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

                    {/* Section column */}
                    {codeFormatMode === 'multitrade' ? (
                      <div className="flex items-center pl-2">
                        <Badge variant="secondary" className="font-mono text-sm">{tradePrefix || 'PL'}</Badge>
                      </div>
                    ) : (
                      <SectionCodeInput
                        value={buildingSection}
                        onChange={(val) => handleSectionChangeForFloors(group.childFloors, val)}
                        onAddCustomCode={handleAddCustomCode}
                        customCodes={customCodes}
                        className="h-8"
                      />
                    )}

                    {/* Activity column */}
                    {codeFormatMode === 'multitrade' ? (
                      <SectionCodeInput
                        value={buildingSection}
                        onChange={(val) => handleSectionChangeForFloors(group.childFloors, val)}
                        onAddCustomCode={handleAddCustomCode}
                        customCodes={customCodes}
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-1 pl-2">
                        <span className="text-sm text-muted-foreground">—</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleClearGroupActivity(group.childFloors)}
                        >
                          Clear ACT
                        </Button>
                      </div>
                    )}

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

                        {/* Section — inherited */}
                        {codeFormatMode === 'multitrade' ? (
                          <div className="text-sm font-mono text-muted-foreground pl-2">
                            {tradePrefix || 'PL'}
                          </div>
                        ) : (
                          <div className="text-sm font-mono text-muted-foreground pl-2">
                            {localMappings[floor] || '—'}
                          </div>
                        )}

                        {/* Activity — per-floor */}
                        {codeFormatMode === 'multitrade' ? (
                          <div className="text-sm font-mono text-muted-foreground pl-2">
                            {localMappings[floor] ? normalizeActivityCode(localMappings[floor]) : '—'}
                          </div>
                        ) : (
                          <Input
                            value={localActivityMappings[floor] || '0000'}
                            onChange={(e) => handleActivityChangeForFloor(floor, e.target.value.toUpperCase().slice(0, 8))}
                            className="h-7 font-mono text-sm w-24"
                            placeholder="0000"
                            maxLength={8}
                          />
                        )}

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
              <StandaloneFloorRow
                key={floor}
                floor={floor}
                count={count}
                sectionCode={localMappings[floor] || ''}
                activityCode={localActivityMappings[floor] || '0000'}
                zoneBreakdown={floorZoneBreakdown[floor]}
                onSectionChange={handleSectionChangeForFloors}
                onActivityChange={handleActivityChangeForFloor}
                onAddCustomCode={handleAddCustomCode}
                gridCols={gridCols}
                customCodes={customCodes}
                buildingMappings={buildingMappings}
                sectionSuggestions={allSectionSuggestions}
                onZonePatternSave={handleZonePatternSave}
                codeFormatMode={codeFormatMode}
                tradePrefix={tradePrefix}
              />
            ))}
          </>
        )}

        {/* Per-Head Activity Overrides Section */}
        <CostHeadOverrideSection
          estimateData={estimateData}
          costHeadActivityOverrides={costHeadActivityOverrides}
          onCostHeadOverridesChange={onCostHeadOverridesChange}
          onApplySectionCodes={onApplySectionCodes}
          localMappings={localMappings}
          localActivityMappings={localActivityMappings}
        />

        {hasChanges && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            You have unsaved changes. Click "Save All" to persist floor-to-section mappings.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
