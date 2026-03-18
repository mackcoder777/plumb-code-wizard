import React, { useState, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, ChevronDown, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryMaterialDescOverride } from '@/hooks/useCategoryMaterialDescOverrides';
import type { MaterialDescLaborPattern } from '@/hooks/useMaterialDescLaborPatterns';
import { getSuggestionForMaterialDesc } from '@/hooks/useMaterialDescLaborPatterns';

interface LaborCode {
  code: string;
  description: string;
}

interface MaterialDescGroup {
  desc: string;
  items: number;
  hours: number;
  samples: string[];
}

interface MaterialDescSectionProps {
  categoryName: string;
  categoryLaborCode: string | null;
  materialDescGroups: MaterialDescGroup[];
  materialDescOverrides: CategoryMaterialDescOverride[];
  laborCodes: LaborCode[];
  patterns: MaterialDescLaborPattern[];
  onSave: (materialDescription: string, laborCode: string) => Promise<void>;
  onDelete: (materialDescription: string) => Promise<void>;
}

// ── Searchable combobox ──────────────────────────────────────────────────────

interface CodeComboboxProps {
  value: string;
  categoryLaborCode: string | null;
  laborCodes: LaborCode[];
  onChange: (code: string) => void;
  isOverridden: boolean;
  saving?: boolean;
}

const CodeCombobox = React.memo(function CodeCombobox({
  value,
  categoryLaborCode,
  laborCodes,
  onChange,
  isOverridden,
  saving,
}: CodeComboboxProps) {
  const [open, setOpen] = useState(false);

  const displayLabel = useMemo(() => {
    if (value === '__CATEGORY__') {
      return categoryLaborCode
        ? `↑ Category (${categoryLaborCode})`
        : '↑ Use Category';
    }
    const found = laborCodes.find(c => c.code === value);
    return found ? `${found.code} – ${found.description}` : value;
  }, [value, categoryLaborCode, laborCodes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-56 shrink-0 justify-between text-xs font-normal",
            isOverridden && "border-primary/50"
          )}
        >
          <span className="truncate">{saving ? 'Saving…' : displayLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search codes…" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No codes found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__category__ use category default"
                onSelect={() => { onChange('__CATEGORY__'); setOpen(false); }}
                className="text-xs"
              >
                <Check className={cn("mr-2 h-3 w-3", value === '__CATEGORY__' ? "opacity-100" : "opacity-0")} />
                ↑ Use Category {categoryLaborCode ? `(${categoryLaborCode})` : ''}
              </CommandItem>
              {laborCodes.map(c => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.description}`}
                  onSelect={() => { onChange(c.code); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === c.code ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono mr-2">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

// ── Single row (memoized) ────────────────────────────────────────────────────

interface MaterialDescRowProps {
  desc: string;
  data: { items: number; hours: number; samples: string[] };
  categoryLaborCode: string | null;
  existing: CategoryMaterialDescOverride | undefined;
  laborCodes: LaborCode[];
  patterns: MaterialDescLaborPattern[];
  isSelected: boolean;
  onToggleSelect: (desc: string, checked: boolean) => void;
  onSave: (materialDescription: string, laborCode: string) => Promise<void>;
  onDelete: (materialDescription: string) => Promise<void>;
}

const MaterialDescRow = React.memo(function MaterialDescRow({
  desc,
  data,
  categoryLaborCode,
  existing,
  laborCodes,
  patterns,
  isSelected,
  onToggleSelect,
  onSave,
  onDelete,
}: MaterialDescRowProps) {
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const currentCode = existing?.labor_code ?? '__CATEGORY__';
  const isOverridden = !!existing && currentCode !== '__CATEGORY__';

  const suggestion = useMemo(() => {
    if (isOverridden) return null;
    return getSuggestionForMaterialDesc(desc, patterns);
  }, [desc, patterns, isOverridden]);

  const handleChange = useCallback(async (code: string) => {
    setSaving(true);
    try {
      if (code === '__CATEGORY__') {
        if (existing) await onDelete(desc);
      } else {
        await onSave(desc, code);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSaving(false);
    }
  }, [desc, existing, onSave, onDelete]);

  const handleCheckbox = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleSelect(desc, e.target.checked);
  }, [desc, onToggleSelect]);

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
      isOverridden ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-transparent"
    )}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleCheckbox}
        className="rounded border-border shrink-0"
      />

      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-medium block truncate", isOverridden && "text-primary")}>
          {desc}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {data.items} items · {data.hours.toFixed(1)} hrs
        </span>
        {data.samples.length > 0 && (
          <span className="text-[10px] text-muted-foreground block truncate">
            e.g. {data.samples.join(', ')}
          </span>
        )}
        {/* Auto-suggestion chip */}
        {suggestion && (
          <button
            onClick={() => handleChange(suggestion.laborCode)}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/40"
            title={`Auto-suggested from past assignments (${Math.round(suggestion.confidence * 100)}% confidence). Click to accept.`}
          >
            <Sparkles className="h-3 w-3" />
            Suggest: {suggestion.laborCode}
            <span className="opacity-60">({Math.round(suggestion.confidence * 100)}%)</span>
          </button>
        )}
      </div>

      <CodeCombobox
        value={currentCode}
        categoryLaborCode={categoryLaborCode}
        laborCodes={laborCodes}
        onChange={handleChange}
        isOverridden={isOverridden}
        saving={saving}
      />

      {savedFlash && (
        <span className="text-xs text-green-600 font-medium shrink-0 animate-in fade-in">✓ Saved</span>
      )}
      {!savedFlash && isOverridden && (
        <Badge variant="outline" className="shrink-0 font-mono text-[10px] border-primary/30 text-primary">
          <Check className="h-2.5 w-2.5 mr-0.5" />
          {currentCode}
        </Badge>
      )}
    </div>
  );
});

// ── Bulk combobox ────────────────────────────────────────────────────────────

function BulkCombobox({ categoryLaborCode, laborCodes, onAssign }: {
  categoryLaborCode: string | null;
  laborCodes: LaborCode[];
  onAssign: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-56 justify-between text-xs font-normal">
          <span>Assign to selected…</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search codes…" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No codes found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__category__ use category default"
                onSelect={() => { onAssign('__CATEGORY__'); setOpen(false); }}
                className="text-xs"
              >
                ↑ Use Category {categoryLaborCode ? `(${categoryLaborCode})` : ''}
              </CommandItem>
              {laborCodes.map(c => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.description}`}
                  onSelect={() => { onAssign(c.code); setOpen(false); }}
                  className="text-xs"
                >
                  <span className="font-mono mr-2">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

const INITIAL_SHOW = 20;

export function MaterialDescSection({
  categoryName,
  categoryLaborCode,
  materialDescGroups,
  materialDescOverrides,
  laborCodes,
  patterns,
  onSave,
  onDelete,
}: MaterialDescSectionProps) {
  const [selectedDescs, setSelectedDescs] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const visibleGroups = useMemo(
    () => showAll ? materialDescGroups : materialDescGroups.slice(0, INITIAL_SHOW),
    [materialDescGroups, showAll]
  );

  const overrideMap = useMemo(() => {
    const map = new Map<string, CategoryMaterialDescOverride>();
    materialDescOverrides
      .filter(o => o.category_name === categoryName)
      .forEach(o => map.set(o.material_description, o));
    return map;
  }, [materialDescOverrides, categoryName]);

  const overrideCount = overrideMap.size;

  const handleToggleSelect = useCallback((desc: string, checked: boolean) => {
    setSelectedDescs(prev => {
      const next = new Set(prev);
      checked ? next.add(desc) : next.delete(desc);
      return next;
    });
  }, []);

  const handleBulkAssign = useCallback(async (code: string) => {
    for (const desc of selectedDescs) {
      if (code === '__CATEGORY__') {
        if (overrideMap.has(desc)) await onDelete(desc);
      } else {
        await onSave(desc, code);
      }
    }
    setSelectedDescs(new Set());
  }, [selectedDescs, overrideMap, onSave, onDelete]);

  const suggestionCount = useMemo(
    () => visibleGroups.filter(g => !overrideMap.has(g.desc) && getSuggestionForMaterialDesc(g.desc, patterns)).length,
    [visibleGroups, overrideMap, patterns]
  );

  if (materialDescGroups.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Material Description Routing
          </span>
          {overrideCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {overrideCount} overrides
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            — override category code by product family
          </span>
          {suggestionCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              {suggestionCount} suggestions
            </Badge>
          )}
        </div>

        {selectedDescs.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary">
              {selectedDescs.size} selected:
            </span>
            <BulkCombobox
              categoryLaborCode={categoryLaborCode}
              laborCodes={laborCodes}
              onAssign={handleBulkAssign}
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        {visibleGroups.map((group) => (
          <MaterialDescRow
            key={group.desc}
            desc={group.desc}
            data={group}
            categoryLaborCode={categoryLaborCode}
            existing={overrideMap.get(group.desc)}
            laborCodes={laborCodes}
            patterns={patterns}
            isSelected={selectedDescs.has(group.desc)}
            onToggleSelect={handleToggleSelect}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      </div>

      {materialDescGroups.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-muted/50"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", showAll && "rotate-180")} />
          {showAll
            ? 'Show less'
            : `Show all ${materialDescGroups.length} (${materialDescGroups.length - INITIAL_SHOW} more)`}
        </button>
      )}
    </div>
  );
}
