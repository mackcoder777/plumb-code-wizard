import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShoppingCart, Download, TrendingUp, TrendingDown, Package,
  DollarSign, BarChart3, ArrowUpDown, Layers,
} from 'lucide-react';
import { useMaterialCodes, CostCode } from '@/hooks/useCostCodes';
import {
  BuyoutLine, BuyoutStatus, BuyoutVendorData,
  BUYOUT_STATUS_CONFIG,
} from '@/types/buyout';
import { exportBuyoutPackage } from '@/utils/buyoutExport';
import { EstimateItem } from '@/types/estimate';

interface BulkBuyoutTabProps {
  estimateData: EstimateItem[];
  projectId: string;
}

type SortField = 'savings' | 'materialCostCode' | 'status' | 'estimateTotal' | 'materialSpec';
type SortDir = 'asc' | 'desc';

// ---------- helpers ----------

function makeBuyoutId(spec: string, size: string): string {
  return `${(spec || '').trim().toLowerCase()}||${(size || '').trim().toLowerCase()}`;
}

function suggestMaterialCode(spec: string, codes: CostCode[]): string {
  if (!spec || codes.length === 0) return '';
  const specLower = spec.toLowerCase();

  // Pattern-based matching for common plumbing material specs
  const patterns: [RegExp, string[]][] = [
    [/cast\s*iron|ci\s*-?no.?hub|no.?hub/i, ['CINH', 'CI']],
    [/copper|cu\s/i, ['COPP', 'CU']],
    [/pvc|poly.*vinyl/i, ['PVC']],
    [/stainless|ss\s/i, ['SS', 'STLS']],
    [/carbon\s*steel|cs\s/i, ['CS']],
    [/hanger|support|clevis|strut|unistrut/i, ['HNGS', 'HNGR']],
    [/valve/i, ['VALV']],
    [/fixture|toilet|lavatory|urinal|sink|water\s*closet/i, ['FIXT', 'FNSH']],
    [/insulation|insul/i, ['INSL']],
    [/cpvc/i, ['CPVC']],
    [/grooved|victaulic/i, ['GRVD']],
    [/brass/i, ['BRSS']],
    [/galvanized|galv/i, ['GALV']],
    [/ductile|di\s/i, ['DI']],
    [/press/i, ['PRES']],
    [/solder/i, ['SOLD']],
  ];

  for (const [pattern, candidates] of patterns) {
    if (pattern.test(specLower)) {
      // Try to find one of the candidates in the DB codes
      for (const candidate of candidates) {
        const match = codes.find(
          (c) => c.code.toUpperCase() === candidate.toUpperCase(),
        );
        if (match) return match.code;
      }
    }
  }

  // Fallback: fuzzy keyword match against code descriptions
  const specWords = specLower.split(/[\s\-\/]+/).filter((w) => w.length > 2);
  let bestMatch = '';
  let bestScore = 0;
  for (const code of codes) {
    const descLower = code.description.toLowerCase();
    let score = 0;
    for (const word of specWords) {
      if (descLower.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = code.code;
    }
  }
  return bestScore >= 1 ? bestMatch : '';
}

const STATUS_ORDER: BuyoutStatus[] = [
  'not_started', 'quoted', 'awarded', 'po_issued', 'delivered',
];

// ---------- component ----------

const BulkBuyoutTab: React.FC<BulkBuyoutTabProps> = ({ estimateData, projectId }) => {
  const { data: materialCodes = [] } = useMaterialCodes();

  // Buyout percentage
  const [buyoutPercent, setBuyoutPercent] = useState<number>(() => {
    const saved = localStorage.getItem(`buyout_pct_${projectId}`);
    return saved ? parseInt(saved, 10) : 100;
  });

  // Vendor data keyed by buyout line id
  const [vendorData, setVendorData] = useState<Record<string, BuyoutVendorData>>(() => {
    try {
      const saved = localStorage.getItem(`buyout_vendor_${projectId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sort state
  const [sortField, setSortField] = useState<SortField>('estimateTotal');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Persist
  useEffect(() => {
    localStorage.setItem(`buyout_pct_${projectId}`, String(buyoutPercent));
  }, [buyoutPercent, projectId]);

  useEffect(() => {
    localStorage.setItem(`buyout_vendor_${projectId}`, JSON.stringify(vendorData));
  }, [vendorData, projectId]);

  // ---------- consolidation ----------

  const consolidatedLines = useMemo<BuyoutLine[]>(() => {
    const groups: Record<string, {
      materialSpec: string;
      size: string;
      materialDesc: string;
      totalQty: number;
      totalMaterialDollars: number;
      totalListPrice: number;
      qtyWithPrice: number;
      itemCount: number;
    }> = {};

    estimateData.forEach((item) => {
      const key = makeBuyoutId(item.materialSpec, item.size);
      if (!groups[key]) {
        groups[key] = {
          materialSpec: item.materialSpec || '(blank)',
          size: item.size || '—',
          materialDesc: item.materialDesc || item.itemName || '',
          totalQty: 0,
          totalMaterialDollars: 0,
          totalListPrice: 0,
          qtyWithPrice: 0,
          itemCount: 0,
        };
      }
      const g = groups[key];
      g.totalQty += item.quantity || 0;
      g.totalMaterialDollars += item.materialDollars || 0;
      if (item.listPrice && item.listPrice > 0) {
        g.totalListPrice += item.listPrice * (item.quantity || 0);
        g.qtyWithPrice += item.quantity || 0;
      }
      g.itemCount++;
      // keep first non-empty desc
      if (!g.materialDesc && (item.materialDesc || item.itemName)) {
        g.materialDesc = item.materialDesc || item.itemName || '';
      }
    });

    return Object.entries(groups).map(([id, g]) => {
      const vd = vendorData[id];
      const estimateUnitCost =
        g.qtyWithPrice > 0 ? g.totalListPrice / g.qtyWithPrice : 0;
      const buyoutQty = Math.round(g.totalQty * (buyoutPercent / 100));
      const estimateTotal = estimateUnitCost * buyoutQty;
      const quotedUnitPrice = vd?.quotedUnitPrice ?? null;
      const quotedTotal =
        quotedUnitPrice !== null ? quotedUnitPrice * buyoutQty : 0;
      const savings =
        quotedUnitPrice !== null ? estimateTotal - quotedTotal : 0;
      const savingsPercent =
        quotedUnitPrice !== null && estimateTotal > 0
          ? (savings / estimateTotal) * 100
          : 0;

      const autoCode = suggestMaterialCode(g.materialSpec, materialCodes);

      return {
        id,
        materialSpec: g.materialSpec,
        size: g.size,
        materialDesc: g.materialDesc,
        totalEstimateQty: g.totalQty,
        buyoutPercent,
        buyoutQty,
        estimateUnitCost,
        estimateTotal,
        materialCostCode: vd?.materialCostCode || autoCode,
        vendorName: vd?.vendorName || '',
        quotedUnitPrice,
        quotedTotal,
        savings,
        savingsPercent,
        poNumber: vd?.poNumber || '',
        status: vd?.status || 'not_started',
        sourceItemCount: g.itemCount,
      } satisfies BuyoutLine;
    });
  }, [estimateData, buyoutPercent, vendorData, materialCodes]);

  // ---------- sorting ----------

  const sortedLines = useMemo(() => {
    const sorted = [...consolidatedLines];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'savings':
          cmp = a.savings - b.savings;
          break;
        case 'materialCostCode':
          cmp = (a.materialCostCode || '').localeCompare(b.materialCostCode || '');
          break;
        case 'status':
          cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case 'estimateTotal':
          cmp = a.estimateTotal - b.estimateTotal;
          break;
        case 'materialSpec':
          cmp = a.materialSpec.localeCompare(b.materialSpec);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [consolidatedLines, sortField, sortDir]);

  // ---------- summary ----------

  const summary = useMemo(() => {
    const totalEstimateValue = consolidatedLines.reduce(
      (s, l) => s + l.estimateTotal, 0,
    );
    const quotedLines = consolidatedLines.filter(
      (l) => l.quotedUnitPrice !== null,
    );
    const totalQuotedValue = quotedLines.reduce(
      (s, l) => s + l.quotedTotal, 0,
    );
    const totalSavings = quotedLines.reduce((s, l) => s + l.savings, 0);
    const totalSavingsPercent =
      totalEstimateValue > 0
        ? (totalSavings / totalEstimateValue) * 100
        : 0;
    const awardedLines = consolidatedLines.filter(
      (l) => l.status === 'awarded' || l.status === 'po_issued' || l.status === 'delivered',
    ).length;

    const byMaterialCode: Record<string, { code: string; estimateValue: number; quotedValue: number; savings: number }> = {};
    consolidatedLines.forEach((l) => {
      const code = l.materialCostCode || 'UNASSIGNED';
      if (!byMaterialCode[code]) {
        byMaterialCode[code] = { code, estimateValue: 0, quotedValue: 0, savings: 0 };
      }
      byMaterialCode[code].estimateValue += l.estimateTotal;
      byMaterialCode[code].quotedValue += l.quotedTotal;
      byMaterialCode[code].savings += l.savings;
    });

    return {
      totalEstimateValue,
      totalQuotedValue,
      totalSavings,
      totalSavingsPercent,
      totalLines: consolidatedLines.length,
      awardedLines,
      byMaterialCode,
    };
  }, [consolidatedLines]);

  // ---------- mutations ----------

  const updateVendor = useCallback(
    (id: string, patch: Partial<BuyoutVendorData>) => {
      setVendorData((prev) => {
        const existing = prev[id] || {
          vendorName: '',
          quotedUnitPrice: null,
          poNumber: '',
          status: 'not_started' as BuyoutStatus,
          materialCostCode: '',
        };
        return { ...prev, [id]: { ...existing, ...patch } };
      });
    },
    [],
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField],
  );

  // ---------- buyout total for header ----------

  const buyoutTotal = useMemo(() => {
    return consolidatedLines
      .filter((l) => l.status === 'awarded' || l.status === 'po_issued' || l.status === 'delivered')
      .reduce((s, l) => s + (l.quotedTotal || l.estimateTotal), 0);
  }, [consolidatedLines]);

  // ---------- render ----------

  if (estimateData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Estimate Data Loaded</h3>
        <p className="text-muted-foreground">
          Upload an estimate file first to generate buyout lines.
        </p>
      </div>
    );
  }

  const progressPercent =
    summary.totalLines > 0
      ? Math.round((summary.awardedLines / summary.totalLines) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Bulk Buyout
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {summary.totalLines} consolidated lines from{' '}
            {estimateData.length.toLocaleString()} estimate items
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Buyout % slider */}
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Buyout %
            </span>
            <Slider
              min={50}
              max={100}
              step={10}
              value={[buyoutPercent]}
              onValueChange={(v) => setBuyoutPercent(v[0])}
              className="w-32"
            />
            <span className="font-mono text-sm font-bold text-foreground w-10 text-right">
              {buyoutPercent}%
            </span>
          </div>
          <Button
            onClick={() => exportBuyoutPackage(sortedLines, `Project_${projectId}`)}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Generate Buyout Package
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase mb-1">
              <DollarSign className="w-3.5 h-3.5" /> Estimate Value
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              ${summary.totalEstimateValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase mb-1">
              <ShoppingCart className="w-3.5 h-3.5" /> Quoted Value
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              ${summary.totalQuotedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase mb-1">
              {summary.totalSavings >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
              )}
              Savings
            </div>
            <div className={`text-xl font-bold font-mono ${summary.totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(summary.totalSavings).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm ml-1">
                ({summary.totalSavingsPercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase mb-1">
              <Layers className="w-3.5 h-3.5" /> Lines
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {summary.totalLines}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase mb-1">
              <BarChart3 className="w-3.5 h-3.5" /> Awarded
            </div>
            <div className="text-sm font-medium text-foreground mb-1">
              {summary.awardedLines} of {summary.totalLines}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by:</span>
        {([
          ['estimateTotal', 'Value'],
          ['savings', 'Savings'],
          ['materialCostCode', 'Code'],
          ['materialSpec', 'Spec'],
          ['status', 'Status'],
        ] as [SortField, string][]).map(([field, label]) => (
          <Button
            key={field}
            size="sm"
            variant={sortField === field ? 'default' : 'outline'}
            onClick={() => toggleSort(field)}
            className="gap-1 h-7 text-xs"
          >
            {label}
            {sortField === field && (
              <ArrowUpDown className="w-3 h-3" />
            )}
          </Button>
        ))}
      </div>

      {/* Main Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Material Spec</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Est Qty</TableHead>
                <TableHead className="text-right">Buyout Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Est Total</TableHead>
                <TableHead className="w-[130px]">Code</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Quoted Price</TableHead>
                <TableHead className="text-right">Quoted Total</TableHead>
                <TableHead className="text-right">Savings</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLines.map((line, idx) => {
                const hasSavings = line.quotedUnitPrice !== null;
                return (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {idx + 1}
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                        {line.sourceItemCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[180px] truncate" title={line.materialSpec}>
                      {line.materialSpec}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{line.size}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate text-muted-foreground" title={line.materialDesc}>
                      {line.materialDesc}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.totalEstimateQty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {line.buyoutQty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${line.estimateUnitCost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      ${line.estimateTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.materialCostCode || '__none__' }
                        onValueChange={(v) =>
                          updateVendor(line.id, {
                            materialCostCode: v === '__none__' ? '' : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-[120px]">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— None —</SelectItem>
                          {materialCodes.map((c) => (
                            <SelectItem key={c.id} value={c.code}>
                              {c.code} - {c.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-[100px]"
                        placeholder="Vendor"
                        value={line.vendorName}
                        onChange={(e) =>
                          updateVendor(line.id, { vendorName: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="h-7 text-xs w-[90px] text-right font-mono"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={line.quotedUnitPrice ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateVendor(line.id, {
                            quotedUnitPrice: val === '' ? null : parseFloat(val),
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {hasSavings
                        ? `$${line.quotedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {hasSavings ? (
                        <span
                          className={`font-mono text-sm font-medium ${
                            line.savings >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {line.savings >= 0 ? '+' : ''}
                          ${line.savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-xs ml-1">
                            ({line.savingsPercent.toFixed(1)}%)
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-7 text-xs w-[90px]"
                        placeholder="PO #"
                        value={line.poNumber}
                        onChange={(e) =>
                          updateVendor(line.id, { poNumber: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.status}
                        onValueChange={(v) =>
                          updateVendor(line.id, {
                            status: v as BuyoutStatus,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-[130px] p-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${BUYOUT_STATUS_CONFIG[line.status].bgColor}`}
                            />
                            <span className={BUYOUT_STATUS_CONFIG[line.status].color}>
                              {BUYOUT_STATUS_CONFIG[line.status].label}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${BUYOUT_STATUS_CONFIG[s].bgColor}`}
                                />
                                {BUYOUT_STATUS_CONFIG[s].label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Breakdown by Material Code */}
      {Object.keys(summary.byMaterialCode).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Breakdown by Material Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(summary.byMaterialCode)
                .sort((a, b) => b.estimateValue - a.estimateValue)
                .map((entry) => (
                  <div
                    key={entry.code}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {entry.code}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Est: ${entry.estimateValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    {entry.quotedValue > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Quoted: ${entry.quotedValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            entry.savings >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {entry.savings >= 0 ? '+' : ''}
                          ${entry.savings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkBuyoutTab;
