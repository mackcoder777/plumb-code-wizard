import React, { useMemo, useState } from 'react';
import { EstimateItem } from '@/types/estimate';
import { CategoryMaterialDescOverride } from '@/hooks/useCategoryMaterialDescOverrides';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Layers, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { CostCode } from '@/hooks/useCostCodes';
import { UseMutationResult } from '@tanstack/react-query';

interface MaterialDescSectionProps {
  category: string;
  data: EstimateItem[];
  laborCodes: CostCode[];
  overrides: CategoryMaterialDescOverride[];
  saveOverride: UseMutationResult<void, Error, { categoryName: string; materialDescription: string; laborCode: string }>;
  deleteOverride: UseMutationResult<void, Error, { categoryName: string; materialDescription: string }>;
}

export const MaterialDescSection: React.FC<MaterialDescSectionProps> = ({
  category,
  data,
  laborCodes,
  overrides,
  saveOverride,
  deleteOverride,
}) => {
  const [selectedDescs, setSelectedDescs] = useState<Set<string>>(new Set());

  const categoryItems = useMemo(
    () => data.filter(item => item.reportCat === category),
    [data, category]
  );

  // Group items by materialDesc, sorted by hours
  const materialDescGroups = useMemo(() => {
    const groups: Record<string, { items: number; hours: number; samples: string[] }> = {};
    categoryItems.forEach(item => {
      const desc = item.materialDesc || 'No Description';
      if (!groups[desc]) groups[desc] = { items: 0, hours: 0, samples: [] };
      groups[desc].items++;
      groups[desc].hours += item.hours || 0;
      if (groups[desc].samples.length < 2 && item.itemName) {
        groups[desc].samples.push(item.itemName);
      }
    });
    return Object.entries(groups).sort((a, b) => b[1].hours - a[1].hours);
  }, [categoryItems]);

  const handleAssign = async (desc: string, code: string) => {
    if (code === '__CATEGORY__') {
      const existing = overrides.find(
        o => o.category_name === category && o.material_description === desc
      );
      if (existing) {
        await deleteOverride.mutateAsync({ categoryName: category, materialDescription: desc });
        toast({ title: 'Override Removed', description: `"${desc}" will use category default` });
      }
    } else {
      await saveOverride.mutateAsync({ categoryName: category, materialDescription: desc, laborCode: code });
      toast({ title: 'Override Saved', description: `"${desc}" → ${code}` });
    }
  };

  const handleBulkAssign = async (code: string) => {
    if (!code) return;
    for (const desc of selectedDescs) {
      if (code === '__CATEGORY__') {
        const existing = overrides.find(
          o => o.category_name === category && o.material_description === desc
        );
        if (existing) {
          await deleteOverride.mutateAsync({ categoryName: category, materialDescription: desc });
        }
      } else {
        await saveOverride.mutateAsync({ categoryName: category, materialDescription: desc, laborCode: code });
      }
    }
    setSelectedDescs(new Set());
    toast({
      title: 'Bulk Assign Complete',
      description: `Applied ${code === '__CATEGORY__' ? 'category default' : code} to ${selectedDescs.size} material descriptions`,
    });
  };

  const toggleSelected = (desc: string) => {
    setSelectedDescs(prev => {
      const next = new Set(prev);
      if (next.has(desc)) next.delete(desc);
      else next.add(desc);
      return next;
    });
  };

  if (materialDescGroups.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Material Description Routing
        </span>
        {overrides.filter(o => o.category_name === category).length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {overrides.filter(o => o.category_name === category).length} overrides
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          — assign labor codes by product family, overrides category default
        </span>
      </div>

      {/* Bulk assign bar */}
      {selectedDescs.size > 0 && (
        <div className="flex items-center gap-2 mb-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
          <span className="text-xs font-medium text-primary">
            {selectedDescs.size} selected:
          </span>
          <Select onValueChange={handleBulkAssign}>
            <SelectTrigger className="h-7 w-56 text-xs">
              <SelectValue placeholder="Assign to selected…" />
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

      {/* Material description rows */}
      <div className="space-y-1">
        {materialDescGroups.map(([desc, groupData]) => {
          const existing = overrides.find(
            o => o.category_name === category && o.material_description === desc
          );
          const currentCode = existing?.labor_code ?? '__CATEGORY__';
          const isOverridden = !!existing && currentCode !== '__CATEGORY__';
          const isSelected = selectedDescs.has(desc);

          return (
            <div
              key={desc}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                isOverridden ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-transparent"
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelected(desc)}
                className="shrink-0"
              />

              <div className="flex-1 min-w-0">
                <span className={cn("text-xs font-medium block truncate", isOverridden && "text-primary")}>
                  {desc}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {groupData.items} items · {groupData.hours.toFixed(1)} hrs
                  {groupData.samples.length > 0 && (
                    <span className="ml-1">— e.g. {groupData.samples.join(', ')}</span>
                  )}
                </span>
              </div>

              <Select
                value={currentCode}
                onValueChange={(value) => handleAssign(desc, value)}
              >
                <SelectTrigger className={cn(
                  "h-7 w-56 shrink-0 text-xs",
                  isOverridden && "border-primary/50"
                )}>
                  <SelectValue />
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

              {isOverridden && (
                <Badge variant="outline" className="shrink-0 font-mono text-[10px] border-primary/30 text-primary">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  {currentCode}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
