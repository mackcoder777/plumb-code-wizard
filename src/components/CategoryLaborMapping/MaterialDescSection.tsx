import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Check, ChevronsUpDown, ChevronDown, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { CategoryMaterialDescOverride } from '@/hooks/useCategoryMaterialDescOverrides';
import type { MaterialDescLaborPattern } from '@/hooks/useMaterialDescLaborPatterns';
import { getSuggestionForMaterialDesc } from '@/hooks/useMaterialDescLaborPatterns';
import type { CategoryItemNameOverride } from '@/hooks/useCategoryItemNameOverrides';

interface LaborCode {
  code: string;
  description: string;
}

type RawItem = { drawing?: string; system?: string; itemName?: string; size?: string; qty?: number; hours?: number };

interface MaterialDescGroup {
  desc: string;
  items: number;
  hours: number;
  samples: string[];
  rawItems: RawItem[];
}

interface MaterialDescSectionProps {
  categoryName: string;
  categoryLaborCode: string | null;
  materialDescGroups: MaterialDescGroup[];
  materialDescOverrides: CategoryMaterialDescOverride[];
  itemNameOverrides: CategoryItemNameOverride[];
  laborCodes: LaborCode[];
  patterns: MaterialDescLaborPattern[];
  onSave: (materialDescription: string, laborCode: string) => Promise<void>;
  onDelete: (materialDescription: string) => Promise<void>;
  onSaveItemOverride: (materialDescription: string, itemName: string, laborCode: string) => Promise<void>;
  onDeleteItemOverride: (materialDescription: string, itemName: string) => Promise<void>;
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
          disabled={saving}
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
            <CommandEmpty>{laborCodes.length === 0 ? 'Loading codes…' : 'No codes found'}</CommandEmpty>
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
  rawItems: RawItem[];
  categoryName: string;
  categoryLaborCode: string | null;
  existing: CategoryMaterialDescOverride | undefined;
  itemNameOverrides: CategoryItemNameOverride[];
  laborCodes: LaborCode[];
  patterns: MaterialDescLaborPattern[];
  isSelected: boolean;
  onToggleSelect: (desc: string, checked: boolean) => void;
  onSave: (materialDescription: string, laborCode: string) => Promise<void>;
  onDelete: (materialDescription: string) => Promise<void>;
  onSaveItemOverride: (materialDescription: string, itemName: string, laborCode: string) => Promise<void>;
  onDeleteItemOverride: (materialDescription: string, itemName: string) => Promise<void>;
}

const MaterialDescRow = React.memo(function MaterialDescRow({
  desc,
  data,
  rawItems,
  categoryName,
  categoryLaborCode,
  existing,
  itemNameOverrides,
  laborCodes,
  patterns,
  isSelected,
  onToggleSelect,
  onSave,
  onDelete,
  onSaveItemOverride,
  onDeleteItemOverride,
}: MaterialDescRowProps) {
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  const currentCode = existing?.labor_code ?? '__CATEGORY__';
  const isOverridden = !!existing && currentCode !== '__CATEGORY__';

  const suggestion = useMemo(() => {
    if (isOverridden) return null;
    return getSuggestionForMaterialDesc(desc, patterns);
  }, [desc, patterns, isOverridden]);

  const handleChange = useCallback(async (code: string) => {
    const requestId = ++requestIdRef.current;
    setSaving(true);

    try {
      if (code === '__CATEGORY__' || code === 'none' || code === '') {
        if (existing) await onDelete(desc);
        if (requestId !== requestIdRef.current) return;
        toast({
          title: 'Override removed',
          description: `"${desc}" will now use the category default.`,
        });
      } else {
        await onSave(desc, code);
        if (requestId !== requestIdRef.current) return;
        toast({
          title: 'Override saved',
          description: `"${desc}" → ${code}`,
        });
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast({
        title: 'Failed to save override',
        description: 'Please try again.',
        variant: 'destructive',
      });
      console.error('MaterialDescSection save error:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setSaving(false);
      }
    }
  }, [desc, existing, onSave, onDelete]);

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      savedFlash ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' :
      isOverridden ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent hover:border-border'
    )}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Expand chevron — dedicated column, always visible */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={expanded ? 'Collapse' : `Preview ${rawItems.length} items`}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>

        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => onToggleSelect(desc, e.target.checked)}
          className="shrink-0 rounded border-border"
        />

        {/* Text block — constrained so it never pushes right-side controls off screen */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("truncate text-xs font-medium", isOverridden && "text-primary")}>{desc}</span>
            <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
              {data.items} items · {data.hours.toFixed(1)} hrs
            </span>
          </div>
          {!expanded && data.samples.length > 0 && (
            <p className="truncate text-[10px] text-muted-foreground">e.g. {data.samples.join(', ')}</p>
          )}
          {suggestion && !expanded && (
            <button
              onClick={() => handleChange(suggestion.laborCode)}
              className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 transition-colors dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/40"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Suggest: {suggestion.laborCode}
              <span className="opacity-60">({Math.round(suggestion.confidence * 100)}%)</span>
            </button>
          )}
        </div>

        {/* Right-side controls — shrink-0 so they never get squeezed */}
        <div className="shrink-0 flex items-center gap-2">
          <CodeCombobox
            value={currentCode}
            categoryLaborCode={categoryLaborCode}
            laborCodes={laborCodes}
            onChange={handleChange}
            isOverridden={isOverridden}
            saving={saving}
          />
          {savedFlash && (
            <span className="whitespace-nowrap text-xs font-semibold text-green-600">✓ Saved</span>
          )}
          {!savedFlash && !saving && isOverridden && (
            <Badge variant="outline" className="shrink-0 font-mono text-[10px] border-primary/30 text-primary">
              <Check className="h-2.5 w-2.5 mr-0.5" />
              {currentCode}
            </Badge>
          )}
        </div>
      </div>

      {/* Expanded item preview */}
      {expanded && (() => {
        const sortedItems = [...rawItems].sort((a, b) => (b.hours || 0) - (a.hours || 0)).slice(0, 30);
        const itemOverrideMap = new Map<string, string>();
        itemNameOverrides
          .filter(o => o.category_name === categoryName && o.material_description === desc)
          .forEach(o => itemOverrideMap.set(o.item_name, o.labor_code));
        const itemOverrideCount = itemOverrideMap.size;

        const handleItemSelect = (itemName: string, checked: boolean) => {
          setSelectedItems(prev => {
            const next = new Set(prev);
            checked ? next.add(itemName) : next.delete(itemName);
            return next;
          });
        };

        const handleItemBulkAssign = async (code: string) => {
          const items = Array.from(selectedItems);
          for (const itemName of items) {
            if (code === '__CATEGORY__') {
              if (itemOverrideMap.has(itemName)) {
                await onDeleteItemOverride(desc, itemName);
              }
            } else {
              await onSaveItemOverride(desc, itemName, code);
            }
          }
          setSelectedItems(new Set());
          toast({ title: 'Item overrides saved', description: `${items.length} items updated` });
        };

        return (
          <div className="border-t border-border mx-3 mb-2">
            {/* Item-level floating action bar */}
            {selectedItems.size > 0 && (
              <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 mt-2">
                <span className="text-xs font-medium text-primary">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected:
                </span>
                <BulkCombobox
                  categoryLaborCode={categoryLaborCode}
                  laborCodes={laborCodes}
                  onAssign={handleItemBulkAssign}
                />
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedItems(new Set())}>
                  Clear
                </Button>
              </div>
            )}
            {itemOverrideCount > 0 && (
              <div className="mt-1.5 mb-1">
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                  {itemOverrideCount} item override{itemOverrideCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="text-muted-foreground uppercase tracking-wide text-[10px]">
                  <th className="w-6 pb-1"></th>
                  <th className="text-left pb-1 font-medium">Item</th>
                  <th className="text-left pb-1 font-medium">System</th>
                  <th className="text-left pb-1 font-medium">Size</th>
                  <th className="text-right pb-1 font-medium">Qty</th>
                  <th className="text-right pb-1 font-medium">Hrs</th>
                  <th className="text-right pb-1 font-medium">Override</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, i) => {
                  const itemName = item.itemName || '';
                  const override = itemOverrideMap.get(itemName);
                  const isChecked = selectedItems.has(itemName);
                  return (
                    <tr key={i} className={cn(
                      "border-t border-border/50",
                      override && "bg-primary/5"
                    )}>
                      <td className="py-1 pr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => handleItemSelect(itemName, e.target.checked)}
                          className="shrink-0 rounded border-border h-3 w-3"
                          disabled={!itemName}
                        />
                      </td>
                      <td className="py-1 pr-3 text-foreground max-w-[200px] truncate">{itemName || '—'}</td>
                      <td className="py-1 pr-3 text-muted-foreground max-w-[120px] truncate">{item.system || '—'}</td>
                      <td className="py-1 pr-3 text-muted-foreground">{item.size || '—'}</td>
                      <td className="py-1 text-right text-foreground tabular-nums">{item.qty ?? '—'}</td>
                      <td className="py-1 text-right text-foreground tabular-nums">{item.hours?.toFixed(1) ?? '—'}</td>
                      <td className="py-1 text-right">
                        {override && (
                          <Badge variant="outline" className="font-mono text-[9px] h-4 px-1 border-primary/30 text-primary">
                            {override}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rawItems.length > 30 && (
              <p className="mt-1.5 text-[10px] text-muted-foreground pb-1">
                Showing 30 of {rawItems.length} items (sorted by hours).
              </p>
            )}
          </div>
        );
      })()}
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
  const [bulkProgress, setBulkProgress] = useState<{ active: boolean; completed: number; total: number }>({ active: false, completed: 0, total: 0 });

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
    const descs = Array.from(selectedDescs);
    const total = descs.length;
    let completed = 0;
    setBulkProgress({ active: true, completed: 0, total });

    await Promise.all(
      descs.map(async (desc) => {
        if (code === '__CATEGORY__') {
          if (overrideMap.has(desc)) await onDelete(desc);
        } else {
          await onSave(desc, code);
        }
        completed += 1;
        setBulkProgress({ active: true, completed, total });
      })
    );

    setBulkProgress({ active: false, completed: 0, total: 0 });
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
            {bulkProgress.active ? (
              <span className="text-xs font-medium text-primary animate-pulse">
                Saving {bulkProgress.completed} of {bulkProgress.total}…
              </span>
            ) : (
              <>
                <span className="text-xs font-medium text-primary">
                  {selectedDescs.size} selected:
                </span>
                <BulkCombobox
                  categoryLaborCode={categoryLaborCode}
                  laborCodes={laborCodes}
                  onAssign={handleBulkAssign}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {visibleGroups.map((group) => (
          <MaterialDescRow
            key={group.desc}
            desc={group.desc}
            data={group}
            rawItems={group.rawItems}
            categoryName={categoryName}
            categoryLaborCode={categoryLaborCode}
            existing={overrideMap.get(group.desc)}
            itemNameOverrides={itemNameOverrides}
            laborCodes={laborCodes}
            patterns={patterns}
            isSelected={selectedDescs.has(group.desc)}
            onToggleSelect={handleToggleSelect}
            onSave={onSave}
            onDelete={onDelete}
            onSaveItemOverride={onSaveItemOverride}
            onDeleteItemOverride={onDeleteItemOverride}
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
