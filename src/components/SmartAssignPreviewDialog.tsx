import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { EstimateItem } from '@/types/estimate';
import { DESCRIPTION_CODE_KEYWORDS } from '@/hooks/useMaterialMappingPatterns';
import { getCodeDescriptionShort } from '@/utils/codeDescriptions';

interface SmartAssignPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codeGroups: Record<string, EstimateItem[]>;
  unmatched: EstimateItem[];
  onConfirm: () => void;
  isSaving: boolean;
  materialCodes?: Array<{ code: string; description: string }>;
}

interface GroupedRow {
  description: string;
  qty: number;
  totalDollars: number;
  matchedKeyword?: string;
}

const formatDollars = (val: number) =>
  '$' + Math.round(val).toLocaleString('en-US');

const findMatchedKeyword = (description: string): string | undefined => {
  const text = description.toLowerCase();
  for (const [code, keywords] of Object.entries(DESCRIPTION_CODE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) return keyword;
    }
  }
  return undefined;
};

const aggregateItems = (items: EstimateItem[]): GroupedRow[] => {
  const map = new Map<string, GroupedRow>();

  for (const item of items) {
    const desc = (item.materialDesc || item.itemName || 'Unknown').trim();
    const key = desc.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.quantity || 1;
      existing.totalDollars += item.materialDollars || 0;
    } else {
      map.set(key, {
        description: desc,
        qty: item.quantity || 1,
        totalDollars: item.materialDollars || 0,
        matchedKeyword: findMatchedKeyword(desc),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalDollars - a.totalDollars);
};

const getCodeLabel = (code: string, materialCodes?: Array<{ code: string; description: string }>) => {
  const found = materialCodes?.find(c => c.code === code);
  return found ? `${code} - ${found.description}` : code;
};

export const SmartAssignPreviewDialog: React.FC<SmartAssignPreviewDialogProps> = ({
  open,
  onOpenChange,
  codeGroups,
  unmatched,
  onConfirm,
  isSaving,
  materialCodes,
}) => {
  const codes = Object.keys(codeGroups);
  const totalAssigned = Object.values(codeGroups).reduce((s, arr) => s + arr.length, 0);
  const totalItems = totalAssigned + unmatched.length;

  const aggregatedGroups = useMemo(() => {
    const result: Record<string, GroupedRow[]> = {};
    for (const [code, items] of Object.entries(codeGroups)) {
      result[code] = aggregateItems(items);
    }
    return result;
  }, [codeGroups]);

  const aggregatedUnmatched = useMemo(() => aggregateItems(unmatched), [unmatched]);

  const defaultTab = codes[0] || 'unmatched';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Smart Assign Preview</DialogTitle>
          <DialogDescription>
            {totalAssigned} of {totalItems} items will be assigned to {codes.length} code{codes.length !== 1 ? 's' : ''}
            {unmatched.length > 0 && (
              <span className="text-muted-foreground"> · {unmatched.length} unmatched</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs key={defaultTab} defaultValue={defaultTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {codes.map(code => (
              <TabsTrigger key={code} value={code} className="text-xs gap-1">
                <Check className="h-3 w-3" />
                {code}
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {codeGroups[code].length}
                </Badge>
              </TabsTrigger>
            ))}
            {unmatched.length > 0 && (
              <TabsTrigger value="unmatched" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                Unmatched
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {unmatched.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <ScrollArea className="flex-1 min-h-0 mt-2">
            {codes.map(code => (
              <TabsContent key={code} value={code} className="mt-0">
                <div className="mb-2">
                  <p className="text-sm font-medium text-foreground">
                    {getCodeLabel(code, materialCodes)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {codeGroups[code].length} items · {formatDollars(codeGroups[code].reduce((s, i) => s + (i.materialDollars || 0), 0))} total
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-20">Value</TableHead>
                      <TableHead className="w-28">Keyword</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedGroups[code]?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.qty}</TableCell>
                        <TableCell className="text-xs truncate max-w-[250px]">{row.description}</TableCell>
                        <TableCell className="text-xs text-right">{formatDollars(row.totalDollars)}</TableCell>
                        <TableCell>
                          {row.matchedKeyword && (
                            <Badge variant="outline" className="text-[10px]">{row.matchedKeyword}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            ))}

            {unmatched.length > 0 && (
              <TabsContent value="unmatched" className="mt-0">
                <p className="text-xs text-muted-foreground mb-2">
                  These items didn't match any keyword rules and will remain unassigned.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-20">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedUnmatched.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.qty}</TableCell>
                        <TableCell className="text-xs truncate max-w-[250px]">{row.description}</TableCell>
                        <TableCell className="text-xs text-right">{formatDollars(row.totalDollars)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>Apply All ({totalAssigned} items)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
