import React, { useMemo } from 'react';
import { BudgetAdjustments } from './BudgetAdjustmentsPanel';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface HourReconciliationBarProps {
  estimateData: Array<{ hours?: number; fieldHours?: number }>;
  budgetAdjustments: BudgetAdjustments | null;
}

export const HourReconciliationBar: React.FC<HourReconciliationBarProps> = ({
  estimateData,
  budgetAdjustments,
}) => {
  const metrics = useMemo(() => {
    const estimateHours = estimateData.reduce((sum, item) => {
      return sum + (parseFloat(String(item.hours)) || 0);
    }, 0);

    const codedHours = estimateData.reduce((sum, item: any) => {
      const costHead = item.laborCostHead || item.costCode || '';
      const hours = parseFloat(String(item.hours)) || 0;
      return sum + (costHead ? hours : 0);
    }, 0);

    let exportHours = 0;
    if (budgetAdjustments?.adjustedLaborSummary) {
      Object.values(budgetAdjustments.adjustedLaborSummary).forEach(entry => {
        if (entry.type === 'field') {
          exportHours += entry.hours || 0;
        }
      });
    }

    // Add fab hours back for reconciliation (they're legitimately moved, not lost)
    const fabHours = budgetAdjustments?.fabricationSummary?.reduce(
      (sum, strip) => sum + strip.strippedHours, 0
    ) || 0;

    const exportPlusFab = exportHours + fabHours;
    const estimateVsExportDelta = Math.abs(estimateHours - exportPlusFab);
    const codedVsEstimateDelta = Math.abs(estimateHours - codedHours);

    return {
      estimateHours,
      codedHours,
      exportHours,
      fabHours,
      exportPlusFab,
      estimateVsExportDelta,
      codedVsEstimateDelta,
    };
  }, [estimateData, budgetAdjustments]);

  if (estimateData.length === 0) return null;

  const hasExportData = budgetAdjustments?.adjustedLaborSummary && Object.keys(budgetAdjustments.adjustedLaborSummary).length > 0;
  const uncodedDelta = metrics.estimateHours - metrics.codedHours;

  // Status: green if all match, yellow if uncoded items exist, red if export drift
  let status: 'green' | 'yellow' | 'red' = 'green';
  if (hasExportData && metrics.estimateVsExportDelta > 0.5) {
    status = 'red';
  } else if (uncodedDelta > 0.5) {
    status = 'yellow';
  }

  const statusColors = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`border-b px-4 py-2 flex items-center gap-6 text-sm ${statusColors[status]}`}>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 opacity-60" />
        <span className="font-medium">Hour Reconciliation</span>
      </div>

      <div className="flex items-center gap-4 flex-1">
        <Metric label="Estimate" value={metrics.estimateHours} />

        <span className="text-xs opacity-40">→</span>

        <Metric
          label="Coded"
          value={metrics.codedHours}
          delta={uncodedDelta > 0.5 ? -uncodedDelta : undefined}
        />

        {hasExportData && (
          <>
            <span className="text-xs opacity-40">→</span>
            <Metric
              label="Export"
              value={metrics.exportHours}
              suffix={metrics.fabHours > 0 ? `+${metrics.fabHours.toFixed(0)} fab` : undefined}
              delta={metrics.estimateVsExportDelta > 0.5 ? -(metrics.estimateHours - metrics.exportPlusFab) : undefined}
            />
          </>
        )}
      </div>

      {status === 'green' && (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      )}
      {status === 'yellow' && (
        <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {uncodedDelta.toFixed(0)}h uncoded
        </div>
      )}
      {status === 'red' && (
        <div className="flex items-center gap-1 text-xs font-bold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          {metrics.estimateVsExportDelta.toFixed(1)}h missing
        </div>
      )}
    </div>
  );
};

function Metric({ label, value, delta, suffix }: {
  label: string;
  value: number;
  delta?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs opacity-60">{label}:</span>
      <span className="font-bold tabular-nums">{value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
      {suffix && <span className="text-xs opacity-50">({suffix})</span>}
      {delta !== undefined && (
        <span className={`text-xs font-semibold ${delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}h
        </span>
      )}
    </div>
  );
}

export default HourReconciliationBar;
