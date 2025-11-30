import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstimateItem } from '@/types/estimate';
import { TableRowCombobox } from './TableRowCombobox';

interface ItemTypeBreakdown {
  itemType: string;
  count: number;
  items: EstimateItem[];
  materialCode?: string;
  laborCode?: string;
}

interface ItemTypeMappingCardProps {
  system: string;
  itemCount: number;
  items: EstimateItem[];
  systemMaterialCode?: string;
  systemLaborCode?: string;
  itemTypeMappings: Record<string, { materialCode?: string; laborCode?: string }>;
  onSystemMaterialCodeChange: (value: string) => void;
  onSystemLaborCodeChange: (value: string) => void;
  onItemTypeMappingChange: (itemType: string, type: 'materialCode' | 'laborCode', value: string) => void;
  materialCodes: Array<{ code: string; description: string; category: string; keywords: string[] }>;
  laborCodes: Array<{ code: string; description: string; category: string; keywords: string[] }>;
}

export const ItemTypeMappingCard: React.FC<ItemTypeMappingCardProps> = ({
  system,
  itemCount,
  items,
  systemMaterialCode,
  systemLaborCode,
  itemTypeMappings,
  onSystemMaterialCodeChange,
  onSystemLaborCodeChange,
  onItemTypeMappingChange,
  materialCodes,
  laborCodes,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Group items by item type
  const itemTypeBreakdown = useMemo((): ItemTypeBreakdown[] => {
    const typeMap = new Map<string, { count: number; items: EstimateItem[] }>();
    
    items.forEach(item => {
      const itemType = item.itemType?.trim() || 'Other';
      if (!typeMap.has(itemType)) {
        typeMap.set(itemType, { count: 0, items: [] });
      }
      const entry = typeMap.get(itemType)!;
      entry.count++;
      entry.items.push(item);
    });

    return Array.from(typeMap.entries())
      .map(([itemType, { count, items }]) => ({
        itemType,
        count,
        items,
        materialCode: itemTypeMappings[itemType]?.materialCode,
        laborCode: itemTypeMappings[itemType]?.laborCode,
      }))
      .sort((a, b) => b.count - a.count);
  }, [items, itemTypeMappings]);

  const hasMultipleItemTypes = itemTypeBreakdown.length > 1;
  const hasItemTypeMappings = Object.keys(itemTypeMappings).length > 0;

  const getStatusIcon = () => {
    const hasSystemMapping = systemMaterialCode && systemLaborCode;
    const hasPartial = systemMaterialCode || systemLaborCode || hasItemTypeMappings;
    
    if (hasSystemMapping) return <CheckCircle className="w-5 h-5 text-success" />;
    if (hasPartial) return <AlertCircle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    const hasSystemMapping = systemMaterialCode && systemLaborCode;
    const hasPartial = systemMaterialCode || systemLaborCode;
    
    if (hasSystemMapping) {
      return <Badge className="bg-success text-success-foreground">Fully Mapped</Badge>;
    } else if (hasPartial || hasItemTypeMappings) {
      return <Badge variant="secondary" className="bg-warning text-warning-foreground">Partial</Badge>;
    }
    return <Badge variant="outline">Unmapped</Badge>;
  };

  return (
    <Card className={cn(
      "transition-all hover:shadow-lg",
      systemMaterialCode && systemLaborCode ? 'border-success/50 bg-success/5' : '',
      (systemMaterialCode || systemLaborCode) && !(systemMaterialCode && systemLaborCode) ? 'border-warning/50 bg-warning/5' : ''
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{system}</h3>
              <p className="text-sm text-muted-foreground">
                {itemCount} items
                {hasMultipleItemTypes && (
                  <span className="ml-2 text-primary">
                    • {itemTypeBreakdown.length} item types
                  </span>
                )}
              </p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* System-level codes (default for all item types) */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">System Default Codes</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Material</label>
              <TableRowCombobox
                value={systemMaterialCode}
                options={materialCodes}
                placeholder="Select material..."
                onValueChange={onSystemMaterialCodeChange}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Labor</label>
              <TableRowCombobox
                value={systemLaborCode}
                options={laborCodes}
                placeholder="Select labor..."
                onValueChange={onSystemLaborCodeChange}
              />
            </div>
          </div>
        </div>

        {/* Item Type Breakdown - Expandable */}
        {hasMultipleItemTypes && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Item Type Overrides
                  {hasItemTypeMappings && (
                    <Badge variant="secondary" className="ml-2">
                      {Object.keys(itemTypeMappings).length} set
                    </Badge>
                  )}
                </span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Set different codes for specific item types (overrides system default)
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Item Type</th>
                      <th className="text-center p-2 font-medium text-xs">Items</th>
                      <th className="text-left p-2 font-medium">Material Override</th>
                      <th className="text-left p-2 font-medium">Labor Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {itemTypeBreakdown.map((breakdown) => (
                      <tr key={breakdown.itemType} className="hover:bg-muted/30">
                        <td className="p-2 font-medium text-sm">{breakdown.itemType}</td>
                        <td className="p-2 text-center tabular-nums text-muted-foreground">{breakdown.count}</td>
                        <td className="p-2">
                          <TableRowCombobox
                            value={breakdown.materialCode}
                            options={materialCodes}
                            placeholder="Use system default"
                            onValueChange={(value) => onItemTypeMappingChange(breakdown.itemType, 'materialCode', value)}
                          />
                        </td>
                        <td className="p-2">
                          <TableRowCombobox
                            value={breakdown.laborCode}
                            options={laborCodes}
                            placeholder="Use system default"
                            onValueChange={(value) => onItemTypeMappingChange(breakdown.itemType, 'laborCode', value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Simple item type list when only one or no item types */}
        {!hasMultipleItemTypes && itemTypeBreakdown.length === 1 && (
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            All items are: <span className="font-medium">{itemTypeBreakdown[0].itemType}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
