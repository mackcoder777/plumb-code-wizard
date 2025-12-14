import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Edit2,
  Save,
} from 'lucide-react';
import { EstimateItem } from '@/types/estimate';

interface SourceFileStats {
  fileName: string;
  itemCount: number;
  totalHours: number;
  totalMaterial: number;
  totalLabor: number;
  expectedItems?: number;
  expectedHours?: number;
  expectedMaterial?: number;
}

interface SourceFileSummaryProps {
  items: EstimateItem[];
  projectId?: string;
}

const SourceFileSummary: React.FC<SourceFileSummaryProps> = ({ items, projectId }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [expectedValues, setExpectedValues] = useState<Record<string, Partial<SourceFileStats>>>(() => {
    if (!projectId) return {};
    const saved = localStorage.getItem(`audit_expected_${projectId}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Calculate stats by source file
  const sourceFileStats = useMemo(() => {
    const stats: Record<string, SourceFileStats> = {};

    items.forEach(item => {
      // Handle both sourceFile and source_file field names
      const fileName = (item as any).sourceFile || (item as any).source_file || 'Unknown Source';
      
      if (!stats[fileName]) {
        stats[fileName] = {
          fileName,
          itemCount: 0,
          totalHours: 0,
          totalMaterial: 0,
          totalLabor: 0,
        };
      }

      stats[fileName].itemCount += 1;
      stats[fileName].totalHours += item.hours || 0;
      stats[fileName].totalMaterial += item.materialDollars || 0;
      stats[fileName].totalLabor += item.laborDollars || 0;
    });

    // Merge with expected values
    Object.keys(stats).forEach(fileName => {
      if (expectedValues[fileName]) {
        stats[fileName].expectedItems = expectedValues[fileName].expectedItems;
        stats[fileName].expectedHours = expectedValues[fileName].expectedHours;
        stats[fileName].expectedMaterial = expectedValues[fileName].expectedMaterial;
      }
    });

    return Object.values(stats).sort((a, b) => a.fileName.localeCompare(b.fileName));
  }, [items, expectedValues]);

  // Calculate combined totals
  const totals = useMemo(() => {
    return sourceFileStats.reduce(
      (acc, stat) => ({
        itemCount: acc.itemCount + stat.itemCount,
        totalHours: acc.totalHours + stat.totalHours,
        totalMaterial: acc.totalMaterial + stat.totalMaterial,
        totalLabor: acc.totalLabor + stat.totalLabor,
        expectedItems: acc.expectedItems + (stat.expectedItems || 0),
        expectedHours: acc.expectedHours + (stat.expectedHours || 0),
        expectedMaterial: acc.expectedMaterial + (stat.expectedMaterial || 0),
      }),
      { itemCount: 0, totalHours: 0, totalMaterial: 0, totalLabor: 0, expectedItems: 0, expectedHours: 0, expectedMaterial: 0 }
    );
  }, [sourceFileStats]);

  // Variance display helper
  const renderVariance = (actual: number, expected?: number) => {
    if (expected === undefined || expected === 0) return <span className="text-muted-foreground">—</span>;
    
    const variance = actual - expected;
    const pct = expected ? ((variance / expected) * 100).toFixed(1) : '0';
    const isGood = Math.abs(variance) < (expected || 1) * 0.01;
    const isWarning = Math.abs(variance) < (expected || 1) * 0.05;

    if (isGood) {
      return (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {variance === 0 ? '✓ Match' : variance.toFixed(2)}
        </span>
      );
    } else if (isWarning) {
      return (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          {variance > 0 ? '+' : ''}{variance.toFixed(2)} ({pct}%)
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" />
          {variance > 0 ? '+' : ''}{variance.toFixed(2)} ({pct}%)
        </span>
      );
    }
  };

  // Save expected values
  const saveExpectedValues = () => {
    if (projectId) {
      localStorage.setItem(`audit_expected_${projectId}`, JSON.stringify(expectedValues));
    }
    setIsEditing(false);
  };

  // Update expected value for a file
  const updateExpected = (fileName: string, field: keyof SourceFileStats, value: number) => {
    setExpectedValues(prev => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [field]: value,
      },
    }));
  };

  // Export audit report
  const exportAuditReport = async () => {
    const XLSX = await import('xlsx');
    
    const reportData = sourceFileStats.map(stat => ({
      'Source File': stat.fileName,
      'Imported Items': stat.itemCount,
      'Expected Items': stat.expectedItems || '',
      'Items Variance': stat.expectedItems ? stat.itemCount - stat.expectedItems : '',
      'Imported Hours': stat.totalHours.toFixed(3),
      'Expected Hours': stat.expectedHours?.toFixed(3) || '',
      'Hours Variance': stat.expectedHours ? (stat.totalHours - stat.expectedHours).toFixed(3) : '',
      'Imported Material $': stat.totalMaterial.toFixed(2),
      'Expected Material $': stat.expectedMaterial?.toFixed(2) || '',
      'Material Variance': stat.expectedMaterial ? (stat.totalMaterial - stat.expectedMaterial).toFixed(2) : '',
    }));

    // Add totals row
    reportData.push({
      'Source File': 'TOTAL',
      'Imported Items': totals.itemCount,
      'Expected Items': totals.expectedItems || '',
      'Items Variance': totals.expectedItems ? totals.itemCount - totals.expectedItems : '',
      'Imported Hours': totals.totalHours.toFixed(3),
      'Expected Hours': totals.expectedHours?.toFixed(3) || '',
      'Hours Variance': totals.expectedHours ? (totals.totalHours - totals.expectedHours).toFixed(3) : '',
      'Imported Material $': totals.totalMaterial.toFixed(2),
      'Expected Material $': totals.expectedMaterial?.toFixed(2) || '',
      'Material Variance': totals.expectedMaterial ? (totals.totalMaterial - totals.expectedMaterial).toFixed(2) : '',
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Report');
    XLSX.writeFile(wb, `Audit_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Don't show if no items or only one source file with "Unknown Source"
  if (items.length === 0) return null;
  
  // Always show if we have data, even for single source file (for auditing)
  const hasMultipleFiles = sourceFileStats.length > 1 || 
    (sourceFileStats.length === 1 && sourceFileStats[0].fileName !== 'Unknown Source');
  
  if (!hasMultipleFiles && sourceFileStats[0]?.fileName === 'Unknown Source') return null;

  return (
    <Card className="mb-6 border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-900">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 cursor-pointer">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
                Source File Audit
              </CardTitle>
              <Badge variant="secondary" className="ml-2">
                {sourceFileStats.length} file{sourceFileStats.length !== 1 ? 's' : ''}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            
            <div className="flex gap-2">
              {isEditing ? (
                <Button size="sm" onClick={saveExpectedValues} className="gap-1">
                  <Save className="h-4 w-4" />
                  Save Expected
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1">
                  <Edit2 className="h-4 w-4" />
                  Enter Expected
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={exportAuditReport} className="gap-1">
                <Download className="h-4 w-4" />
                Export Audit
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source File</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  {isEditing && <TableHead className="text-right text-xs text-muted-foreground">Expected</TableHead>}
                  <TableHead className="text-right">Field Hours</TableHead>
                  {isEditing && <TableHead className="text-right text-xs text-muted-foreground">Expected</TableHead>}
                  {!isEditing && <TableHead className="text-right">Hours Variance</TableHead>}
                  <TableHead className="text-right">Material $</TableHead>
                  {isEditing && <TableHead className="text-right text-xs text-muted-foreground">Expected</TableHead>}
                  {!isEditing && <TableHead className="text-right">Material Variance</TableHead>}
                  {!isEditing && <TableHead className="text-center">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceFileStats.map(stat => {
                  const hasExpected = stat.expectedItems || stat.expectedHours || stat.expectedMaterial;
                  const itemsMatch = !stat.expectedItems || stat.itemCount === stat.expectedItems;
                  const hoursMatch = !stat.expectedHours || Math.abs(stat.totalHours - stat.expectedHours) < 1;
                  const materialMatch = !stat.expectedMaterial || Math.abs(stat.totalMaterial - stat.expectedMaterial) < 10;
                  const allMatch = itemsMatch && hoursMatch && materialMatch;

                  return (
                    <TableRow key={stat.fileName} className={allMatch && hasExpected ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">{stat.fileName}</span>
                        </div>
                      </TableCell>
                      
                      {/* Items */}
                      <TableCell className="text-right font-mono">
                        {stat.itemCount.toLocaleString()}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={stat.expectedItems || ''}
                            onChange={(e) => updateExpected(stat.fileName, 'expectedItems', parseInt(e.target.value) || 0)}
                            className="w-24 h-8 text-right font-mono"
                            placeholder="Expected"
                          />
                        </TableCell>
                      )}
                      
                      {/* Hours */}
                      <TableCell className="text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        {stat.totalHours.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.001"
                            value={stat.expectedHours || ''}
                            onChange={(e) => updateExpected(stat.fileName, 'expectedHours', parseFloat(e.target.value) || 0)}
                            className="w-28 h-8 text-right font-mono"
                            placeholder="Expected"
                          />
                        </TableCell>
                      )}
                      {!isEditing && (
                        <TableCell className="text-right text-sm">
                          {renderVariance(stat.totalHours, stat.expectedHours)}
                        </TableCell>
                      )}
                      
                      {/* Material */}
                      <TableCell className="text-right font-mono font-bold text-green-700 dark:text-green-300">
                        ${stat.totalMaterial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      {isEditing && (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={stat.expectedMaterial || ''}
                            onChange={(e) => updateExpected(stat.fileName, 'expectedMaterial', parseFloat(e.target.value) || 0)}
                            className="w-32 h-8 text-right font-mono"
                            placeholder="Expected"
                          />
                        </TableCell>
                      )}
                      {!isEditing && (
                        <TableCell className="text-right text-sm">
                          {renderVariance(stat.totalMaterial, stat.expectedMaterial)}
                        </TableCell>
                      )}
                      
                      {/* Status */}
                      {!isEditing && (
                        <TableCell className="text-center">
                          {hasExpected ? (
                            allMatch ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Variance
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell>COMBINED TOTAL</TableCell>
                  <TableCell className="text-right font-mono">
                    {totals.itemCount.toLocaleString()}
                  </TableCell>
                  {isEditing && <TableCell />}
                  <TableCell className="text-right font-mono text-blue-700 dark:text-blue-300">
                    {totals.totalHours.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </TableCell>
                  {isEditing && <TableCell />}
                  {!isEditing && (
                    <TableCell className="text-right">
                      {totals.expectedHours > 0 && renderVariance(totals.totalHours, totals.expectedHours)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono text-green-700 dark:text-green-300">
                    ${totals.totalMaterial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  {isEditing && <TableCell />}
                  {!isEditing && (
                    <TableCell className="text-right">
                      {totals.expectedMaterial > 0 && renderVariance(totals.totalMaterial, totals.expectedMaterial)}
                    </TableCell>
                  )}
                  {!isEditing && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>

            {isEditing && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tip:</strong> Enter the expected values from your original Excel files to verify the import. 
                  Check the bottom totals row of your Raw Data sheets for these values.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default SourceFileSummary;
