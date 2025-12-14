import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Wrench, 
  Award,
  Calculator,
  Info,
  DollarSign
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Tax rate lookup by ZIP code (expandable)
const CA_TAX_RATES: Record<string, { rate: number; jurisdiction: string }> = {
  '90001': { rate: 9.5, jurisdiction: 'Los Angeles' },
  '90210': { rate: 9.5, jurisdiction: 'Beverly Hills' },
  '90802': { rate: 10.25, jurisdiction: 'Long Beach' },
  '91101': { rate: 10.25, jurisdiction: 'Pasadena' },
  '92602': { rate: 7.75, jurisdiction: 'Irvine' },
  '92801': { rate: 7.75, jurisdiction: 'Anaheim' },
  '92101': { rate: 7.75, jurisdiction: 'San Diego' },
  'default': { rate: 7.25, jurisdiction: 'California State Minimum' },
};

// Material codes that are typically TAXABLE
const TAXABLE_MATERIAL_CODES = [
  '9510', '9512', '9514', '9515', '9520', '9521', '9522', '9523', '9524', '9525'
];

interface LaborCodeSummary {
  code: string;
  description: string;
  fieldHours: number;
  rate: number;
}

interface MaterialCodeSummary {
  code: string;
  description: string;
  amount: number;
}

interface FabricationConfig {
  enabled: boolean;
  percentage: number;
}

export interface BudgetAdjustments {
  jobsiteZipCode: string;
  taxRate: number;
  taxJurisdiction: string;
  foremanBonusEnabled: boolean;
  foremanBonusPercent: number;
  foremanBonusHours: number;
  foremanBonusDollars: number;
  fabricationConfigs: Record<string, FabricationConfig>;
  fabricationSummary: Array<{
    code: string;
    description: string;
    fabCode: string;
    strippedHours: number;
    remainingFieldHours: number;
  }>;
  materialTaxOverrides: Record<string, boolean>;
  materialTaxSummary: Array<{
    code: string;
    description: string;
    amount: number;
    taxable: boolean;
    taxAmount: number;
  }>;
  totalMaterialTax: number;
  adjustedLaborSummary: Record<string, {
    code: string;
    description: string;
    hours: number;
    rate: number;
    dollars: number;
    type: 'field' | 'fab' | 'foreman';
  }>;
  totalFieldHours: number;
  totalFabHours: number;
  totalLaborDollars: number;
  totalMaterialWithTax: number;
  totalMaterialPreTax: number;
}

interface BudgetAdjustmentsPanelProps {
  laborSummary: Record<string, LaborCodeSummary>;
  materialSummary: Record<string, MaterialCodeSummary>;
  bidLaborRate: number;
  onAdjustmentsChange: (adjustments: BudgetAdjustments) => void;
}

const BudgetAdjustmentsPanel: React.FC<BudgetAdjustmentsPanelProps> = ({
  laborSummary,
  materialSummary,
  bidLaborRate,
  onAdjustmentsChange,
}) => {
  const [jobsiteZipCode, setJobsiteZipCode] = useState('');
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null);
  const [foremanBonusEnabled, setForemanBonusEnabled] = useState(true);
  const [foremanBonusPercent, setForemanBonusPercent] = useState(1);
  const [fabricationConfigs, setFabricationConfigs] = useState<Record<string, FabricationConfig>>({});
  const [materialTaxOverrides, setMaterialTaxOverrides] = useState<Record<string, boolean>>({});

  const taxInfo = useMemo(() => {
    if (customTaxRate !== null) {
      return { rate: customTaxRate, jurisdiction: 'Custom Rate' };
    }
    if (jobsiteZipCode && jobsiteZipCode.length === 5) {
      return CA_TAX_RATES[jobsiteZipCode] || CA_TAX_RATES['default'];
    }
    return CA_TAX_RATES['default'];
  }, [jobsiteZipCode, customTaxRate]);

  const calculations = useMemo(() => {
    const originalTotalHours = Object.values(laborSummary)
      .reduce((sum, item) => sum + (item.fieldHours || 0), 0);

    const foremanBonusHours = foremanBonusEnabled 
      ? originalTotalHours * (foremanBonusPercent / 100) 
      : 0;
    const foremanBonusDollars = foremanBonusHours * bidLaborRate;

    const hoursAfterForemanStrip = originalTotalHours - foremanBonusHours;
    const foremanStripRatio = originalTotalHours > 0 ? hoursAfterForemanStrip / originalTotalHours : 1;

    const fabricationSummary: BudgetAdjustments['fabricationSummary'] = [];
    const adjustedLaborSummary: BudgetAdjustments['adjustedLaborSummary'] = {};

    let totalFieldHours = 0;
    let totalFabHours = 0;

    Object.entries(laborSummary).forEach(([code, data]) => {
      const hoursAfterForeman = (data.fieldHours || 0) * foremanStripRatio;
      const fabConfig = fabricationConfigs[code];
      const fabEnabled = fabConfig?.enabled || false;
      const fabPercent = fabConfig?.percentage || 0;

      if (fabEnabled && fabPercent > 0) {
        const fabHours = hoursAfterForeman * (fabPercent / 100);
        const fieldHours = hoursAfterForeman - fabHours;

        adjustedLaborSummary[code] = {
          code,
          description: data.description,
          hours: fieldHours,
          rate: data.rate || bidLaborRate,
          dollars: fieldHours * (data.rate || bidLaborRate),
          type: 'field'
        };

        const fabCode = code.replace(/(\w+)$/, 'FAB$1');
        adjustedLaborSummary[fabCode] = {
          code: fabCode,
          description: `FAB - ${data.description}`,
          hours: fabHours,
          rate: data.rate || bidLaborRate,
          dollars: fabHours * (data.rate || bidLaborRate),
          type: 'fab'
        };

        fabricationSummary.push({
          code,
          description: data.description,
          fabCode,
          strippedHours: fabHours,
          remainingFieldHours: fieldHours
        });

        totalFieldHours += fieldHours;
        totalFabHours += fabHours;
      } else {
        adjustedLaborSummary[code] = {
          code,
          description: data.description,
          hours: hoursAfterForeman,
          rate: data.rate || bidLaborRate,
          dollars: hoursAfterForeman * (data.rate || bidLaborRate),
          type: 'field'
        };
        totalFieldHours += hoursAfterForeman;
      }
    });

    if (foremanBonusEnabled && foremanBonusHours > 0) {
      adjustedLaborSummary['FOREMAN_BONUS'] = {
        code: '01 0000 FRMN',
        description: 'FOREMAN FIELD BONUS',
        hours: foremanBonusHours,
        rate: bidLaborRate,
        dollars: foremanBonusDollars,
        type: 'foreman'
      };
    }

    const totalLaborDollars = Object.values(adjustedLaborSummary)
      .reduce((sum, item) => sum + item.dollars, 0);

    const materialTaxSummary: BudgetAdjustments['materialTaxSummary'] = [];
    let totalMaterialTax = 0;
    let totalMaterialPreTax = 0;

    Object.entries(materialSummary).forEach(([code, data]) => {
      const amount = data.amount || 0;
      const isTaxable = materialTaxOverrides[code] !== undefined
        ? materialTaxOverrides[code]
        : TAXABLE_MATERIAL_CODES.includes(code);
      const taxAmount = isTaxable ? amount * (taxInfo.rate / 100) : 0;

      materialTaxSummary.push({
        code,
        description: data.description,
        amount,
        taxable: isTaxable,
        taxAmount
      });

      totalMaterialPreTax += amount;
      totalMaterialTax += taxAmount;
    });

    const totalMaterialWithTax = totalMaterialPreTax + totalMaterialTax;

    return {
      foremanBonusHours,
      foremanBonusDollars,
      fabricationSummary,
      adjustedLaborSummary,
      totalFieldHours,
      totalFabHours,
      totalLaborDollars,
      materialTaxSummary,
      totalMaterialTax,
      totalMaterialWithTax,
      totalMaterialPreTax
    };
  }, [laborSummary, materialSummary, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, taxInfo, bidLaborRate]);

  useEffect(() => {
    onAdjustmentsChange({
      jobsiteZipCode,
      taxRate: taxInfo.rate,
      taxJurisdiction: taxInfo.jurisdiction,
      foremanBonusEnabled,
      foremanBonusPercent,
      foremanBonusHours: calculations.foremanBonusHours,
      foremanBonusDollars: calculations.foremanBonusDollars,
      fabricationConfigs,
      fabricationSummary: calculations.fabricationSummary,
      materialTaxOverrides,
      materialTaxSummary: calculations.materialTaxSummary,
      totalMaterialTax: calculations.totalMaterialTax,
      adjustedLaborSummary: calculations.adjustedLaborSummary,
      totalFieldHours: calculations.totalFieldHours,
      totalFabHours: calculations.totalFabHours,
      totalLaborDollars: calculations.totalLaborDollars,
      totalMaterialWithTax: calculations.totalMaterialWithTax,
      totalMaterialPreTax: calculations.totalMaterialPreTax,
    });
  }, [calculations, jobsiteZipCode, taxInfo, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, onAdjustmentsChange]);

  const toggleFabForCode = (code: string, enabled: boolean) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled, percentage: prev[code]?.percentage || 15 }
    }));
  };

  const setFabPercentForCode = (code: string, percentage: number) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled: prev[code]?.enabled || false, percentage }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Project Location & Sales Tax */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-blue-500" />
            Project Location & Sales Tax
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="zipcode">Jobsite ZIP Code</Label>
              <Input
                id="zipcode"
                placeholder="e.g., 90802"
                value={jobsiteZipCode}
                onChange={(e) => setJobsiteZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Tax Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="15"
                  value={customTaxRate ?? taxInfo.rate}
                  onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || null)}
                  className="font-mono"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label>Jurisdiction</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md border text-sm">
                {taxInfo.jurisdiction}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="text-blue-800 dark:text-blue-200 font-medium">Total Material (Pre-Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100">
                ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-blue-700 dark:text-blue-300">Sales Tax ({taxInfo.rate}%)</span>
              <span className="font-mono text-blue-800 dark:text-blue-200">
                +${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="text-blue-900 dark:text-blue-100 font-bold">Total Material (With Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100 text-lg">
                ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foreman Field Bonus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-amber-500" />
            Foreman Field Bonus Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Strips a percentage of total field hours to fund foreman incentive bonus.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={foremanBonusEnabled} onCheckedChange={setForemanBonusEnabled} />
              <span className={foremanBonusEnabled ? 'text-foreground' : 'text-muted-foreground'}>
                Enable Foreman Bonus Strip
              </span>
            </div>

            {foremanBonusEnabled && (
              <div className="flex items-center gap-3">
                <Label>Strip Percentage:</Label>
                <div className="flex items-center gap-2 w-32">
                  <Slider
                    value={[foremanBonusPercent]}
                    onValueChange={([val]) => setForemanBonusPercent(val)}
                    min={0.5}
                    max={3}
                    step={0.25}
                    className="w-20"
                  />
                  <span className="font-mono font-bold text-amber-600 w-12">{foremanBonusPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {foremanBonusEnabled && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Hours Stripped</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    {calculations.foremanBonusHours?.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Rate</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${bidLaborRate.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Foreman Bonus Value</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${calculations.foremanBonusDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fabrication Hours Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-purple-500" />
            Fabrication Hours Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>For jobs with shop fabrication, strip a percentage of field hours to create separate fabrication budget codes.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">FAB</TableHead>
                <TableHead>Labor Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Original Hours</TableHead>
                <TableHead className="text-center w-32">Strip %</TableHead>
                <TableHead className="text-right">Field Hours</TableHead>
                <TableHead className="text-right">Fab Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(laborSummary).map(([code, data]) => {
                const fabConfig = fabricationConfigs[code];
                const isEnabled = fabConfig?.enabled || false;
                const fabPercent = fabConfig?.percentage || 15;

                const originalHours = data.fieldHours || 0;
                const foremanStripRatio = foremanBonusEnabled ? (1 - foremanBonusPercent / 100) : 1;
                const hoursAfterForeman = originalHours * foremanStripRatio;
                const fabHours = isEnabled ? hoursAfterForeman * (fabPercent / 100) : 0;
                const fieldHours = hoursAfterForeman - fabHours;

                return (
                  <TableRow key={code} className={isEnabled ? 'bg-purple-50 dark:bg-purple-950' : ''}>
                    <TableCell>
                      <Switch checked={isEnabled} onCheckedChange={(checked) => toggleFabForCode(code, checked)} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{code}</TableCell>
                    <TableCell>{data.description}</TableCell>
                    <TableCell className="text-right font-mono">{originalHours.toFixed(1)}</TableCell>
                    <TableCell>
                      {isEnabled ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            value={fabPercent}
                            onChange={(e) => setFabPercentForCode(code, parseInt(e.target.value) || 15)}
                            className="w-16 h-8 text-center font-mono"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-green-600">{fieldHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-purple-600">
                      {isEnabled ? fabHours.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {calculations.totalFabHours > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Field Hours</span>
                <span className="font-mono font-bold text-green-700">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Fabrication Hours</span>
                <span className="font-mono font-bold text-purple-700">{calculations.totalFabHours?.toFixed(1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Tax Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-green-500" />
            Material Tax Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">TAX</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Tax ({taxInfo.rate}%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.materialTaxSummary?.map((item) => (
                <TableRow key={item.code} className={item.taxable ? '' : 'bg-muted/50'}>
                  <TableCell>
                    <Switch
                      checked={item.taxable}
                      onCheckedChange={(checked) => {
                        setMaterialTaxOverrides(prev => ({ ...prev, [item.code]: checked }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    {item.taxable ? `$${item.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${(item.amount + item.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Final Budget Summary */}
      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-200">
            <Calculator className="h-5 w-5" />
            Adjusted Budget Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Labor</h4>
              <div className="flex justify-between text-sm">
                <span>Field Hours</span>
                <span className="font-mono">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              {calculations.totalFabHours > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Fabrication Hours</span>
                  <span className="font-mono">{calculations.totalFabHours?.toFixed(1)}</span>
                </div>
              )}
              {foremanBonusEnabled && (
                <div className="flex justify-between text-sm">
                  <span>Foreman Bonus Hours</span>
                  <span className="font-mono">{calculations.foremanBonusHours?.toFixed(1)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Labor</span>
                <span className="font-mono">
                  ${calculations.totalLaborDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Material</h4>
              <div className="flex justify-between text-sm">
                <span>Material (Pre-Tax)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sales Tax ({taxInfo.rate}%)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Material</span>
                <span className="font-mono">
                  ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between items-center text-xl">
            <span className="font-bold text-green-900 dark:text-green-100">GRAND TOTAL</span>
            <span className="font-mono font-bold text-green-900 dark:text-green-100">
              ${((calculations.totalLaborDollars || 0) + (calculations.totalMaterialWithTax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetAdjustmentsPanel;
