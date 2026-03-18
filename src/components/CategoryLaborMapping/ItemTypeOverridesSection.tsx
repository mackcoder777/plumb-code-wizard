import React, { useMemo } from 'react';
import { EstimateItem } from '@/types/estimate';
import { CategoryItemTypeOverride } from '@/hooks/useCategoryItemTypeOverrides';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { CostCode } from '@/hooks/useCostCodes';
import { UseMutationResult } from '@tanstack/react-query';

interface ItemTypeOverridesSectionProps {
  category: string;
  currentCategoryCode: string | undefined;
  data: EstimateItem[];
  laborCodes: CostCode[];
  itemTypeOverrides: CategoryItemTypeOverride[];
  saveOverride: UseMutationResult<void, Error, { categoryName: string; itemType: string; laborCode: string }>;
  deleteOverride: UseMutationResult<void, Error, { categoryName: string; itemType: string }>;
  selectedItemTypes: Record<string, Set<string>>;
  setSelectedItemTypes: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
}

export const ItemTypeOverridesSection: React.FC<ItemTypeOverridesSectionProps> = ({
  category,
  currentCategoryCode,
  data,
  laborCodes,
  itemTypeOverrides,
  saveOverride,
  deleteOverride,
  selectedItemTypes,
  setSelectedItemTypes,
}) => {
  const itemTypeGroups = useMemo(() => {
    const groups: Record<string, { items: number; hours: number; samples: string[] }> = {};
    data
      .filter(item => item.reportCat === category)
      .forEach(item => {
        const t = item.itemType || 'Unknown';
        if (!groups[t]) groups[t] = { items: 0, hours: 0, samples: [] };
        groups[t].items++;
        groups[t].hours += item.hours || 0;
        if (groups[t].samples.length < 2 && item.itemName) {
          groups[t].samples.push(item.itemName);
        }
      });
    return Object.entries(groups).sort((a, b) => b[1].hours - a[1].hours);
  }, [data, category]);

  const overrideCount = itemTypeOverrides.filter(
    o => o.category_name === category && o.labor_code !== '__CATEGORY__'
  ).length;

  const selected = selectedItemTypes[category] ?? new Set<string>();

  const handleOverrideChange = async (itemType: string, code: string) => {
    if (code === '__CATEGORY__') {
      const existing = itemTypeOverrides.find(
        o => o.category_name === category && o.item_type === itemType
      );
      if (existing) {
        await deleteOverride.mutateAsync({ categoryName: category, itemType });
        toast({ title: 'Override Removed', description: `"${itemType}" will use category default` });
      }
    } else {
      await saveOverride.mutateAsync({ categoryName: category, itemType, laborCode: code });
      toast({ title: 'Override Saved', description: `"${itemType}" → ${code}` });
    }
  };

  const handleBulkAssign = async (code: string) => {
    if (!code) return;
    for (const itemType of selected) {
      if (code === '__CATEGORY__') {
        const existing = itemTypeOverrides.find(
          o => o.category_name === category && o.item_type === itemType
        );
        if (existing) {
          await deleteOverride.mutateAsync({ categoryName: category, itemType });
        }
      } else {
        await saveOverride.mutateAsync({ categoryName: category, itemType, laborCode: code });
      }
    }
    setSelectedItemTypes(prev => ({ ...prev, [category]: new Set() }));
    toast({ title: 'Bulk Assign Complete', description: `Updated ${selected.size} item types` });
  };

  if (itemTypeGroups.length <= 1) return null; // No point showing overrides for single item type

  const laborCodeOptions = laborCodes.map(c => ({ code: c.code, description: c.description }));

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Item Type Overrides
        </span>
        {overrideCount > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {overrideCount} active
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          — override the category code for specific item types
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2">
          <span className="text-xs font-medium text-accent-foreground">
            {selected.size} selected:
          </span>
          <Select onValueChange={handleBulkAssign}>
            <SelectTrigger className="h-7 w-56 text-xs">
              <SelectValue placeholder="Assign code to selected…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__CATEGORY__">
                <span className="text-muted-foreground">↑ Use Category Default</span>
              </SelectItem>
              <SelectSeparator />
              {laborCodes.map(c => (
                <SelectItem key={c.id} value={c.code}>
                  <span className="font-mono">{c.code}</span>
                  <span className="ml-2 text-muted-foreground">- {c.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        {itemTypeGroups.map(([itemType, groupData]) => {
          const existing = itemTypeOverrides.find(
            o => o.category_name === category && o.item_type === itemType
          );
          const currentCode = existing?.labor_code ?? '__CATEGORY__';
          const isOverridden = !!existing && currentCode !== '__CATEGORY__';
          const isSelected = selected.has(itemType);

          return (
            <div
              key={itemType}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2",
                isOverridden ? "bg-primary/5 border border-primary/20" : "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    setSelectedItemTypes(prev => {
                      const next = new Set(prev[category] ?? []);
                      checked ? next.add(itemType) : next.delete(itemType);
                      return { ...prev, [category]: next };
                    });
                  }}
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{itemType}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {groupData.items} items · {groupData.hours.toFixed(1)} hrs
                  </span>
                  {groupData.samples.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      e.g. {groupData.samples.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={currentCode}
                  onValueChange={(val) => handleOverrideChange(itemType, val)}
                >
                  <SelectTrigger className={cn(
                    "h-8 w-52 text-xs",
                    isOverridden && "border-primary/50"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__CATEGORY__">
                      <span className="text-muted-foreground">
                        ↑ Use Category ({currentCategoryCode || 'unmapped'})
                      </span>
                    </SelectItem>
                    <SelectSeparator />
                    {laborCodes.map(c => (
                      <SelectItem key={c.id} value={c.code}>
                        <span className="font-mono">{c.code}</span>
                        <span className="ml-2 text-muted-foreground">- {c.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isOverridden && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary">
                    override
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
