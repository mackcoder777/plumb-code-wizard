import React, { useMemo, useState } from 'react';
import { BudgetAdjustments } from './BudgetAdjustmentsPanel';
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface HourReconciliationBarProps {
  estimateData: Array<{ hours?: number; fieldHours?: number }>;
  budgetAdjustments: BudgetAdjustments | null;
}

export const HourReconciliationBar: React.FC<HourReconciliationBarProps> = ({
  estimateData,
  budgetAdjustments,
}) => {
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo(() => {
    const estimateHours = estimateData.reduce((sum, item) => {
      return sum + (parseFloat(String(item.hours)) || 0);
    }, 0);

    const codedHours = estimateData.reduce((sum, item: any) => {
      const costHead = item.laborCostHead || item.costCode || '';
      const hours = parseFloat(String(item.hours)) || 0;
      return sum + (costHead ? hours : 0);
    }, 0);

    let exportFieldHours = 0;
    if (budgetAdjustments?.adjustedLaborSummary) {
      Object.values(budgetAdjustments.adjustedLaborSummary).forEach(entry => {
        if (entry.type === 'field') {
          exportFieldHours += entry.hours || 0;
        }
      });
    }

    const fabHours = budgetAdjustments?.fabricationSummary?.reduce(
      (sum, strip) => sum + strip.strippedHours, 0
    ) || 0;

    const foremanHours = budgetAdjustments?.foremanBonusHours || 0;

    const totalAccounted = exportFieldHours + fabHours + foremanHours;
    const delta = Math.abs(estimateHours - totalAccounted);
    const unaccounted = estimateHours - totalAccounted;

    return {
      estimateHours,
      codedHours,
      exportFieldHours,
      fabHours,
      foremanHours,
      totalAccounted,
      delta,
      unaccounted,
    };
  }, [estimateData, budgetAdjustments]);

  if (estimateData.length === 0) return null;

  const hasExportData = budgetAdjustments?.adjustedLaborSummary && Object.keys(budgetAdjustments.adjustedLaborSummary).length > 0;
  const uncodedDelta = metrics.estimateHours - metrics.codedHours;

  let status: 'green' | 'yellow' | 'red' = 'green';
  if (hasExportData && metrics.delta > 0.5) {
    status = 'red';
  } else if (uncodedDelta > 0.5) {
    status = 'yellow';
  }

  const statusColors = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };

  // Build suffix for export metric
  const exportSuffixParts: string[] = [];
  if (metrics.fabHours > 0) exportSuffixParts.push(`+${metrics.fabHours.toFixed(0)} fab`);
  if (metrics.foremanHours > 0) exportSuffixParts.push(`+${metrics.foremanHours.toFixed(0)} foreman`);
  const exportSuffix = exportSuffixParts.length > 0 ? exportSuffixParts.join(', ') : undefined;

  return (
    <div className={`border-b ${statusColors[status]}`}>
      <div className="px-4 py-2 flex items-center gap-6 text-sm">
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
                value={metrics.exportFieldHours}
                suffix={exportSuffix}
                delta={metrics.delta > 0.5 ? -metrics.unaccounted : undefined}
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
            {metrics.delta.toFixed(1)}h missing
          </div>
        )}

        {hasExportData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            Breakdown
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {expanded && hasExportData && (
        <div className="px-4 pb-3 pt-1 border-t border-current/10">
          <table className="text-xs w-auto">
            <tbody>
              <BreakdownRow label="Estimate total" value={metrics.estimateHours} />
              {metrics.foremanHours > 0 && (
                <BreakdownRow label={`− Foreman strip (${budgetAdjustments?.foremanBonusPct ?? 1}%)`} value={-metrics.foremanHours} />
              )}
              {metrics.fabHours > 0 && (
                <BreakdownRow label="− Fab strip" value={-metrics.fabHours} />
              )}
              <BreakdownRow
                label="= Expected field labor"
                value={metrics.estimateHours - metrics.foremanHours - metrics.fabHours}
                bold
              />
              <BreakdownRow label="Actual export field" value={metrics.exportFieldHours} />
              {metrics.delta > 0.5 && (
                <BreakdownRow label="Unaccounted" value={metrics.unaccounted} bold highlight />
              )}
            </tbody>
          </table>
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

function BreakdownRow({ label, value, bold, highlight }: {
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'text-red-700 font-bold' : ''}>
      <td className={`pr-4 py-0.5 ${bold ? 'font-semibold' : ''}`}>{label}</td>
      <td className={`tabular-nums text-right ${bold ? 'font-semibold' : ''}`}>
        {value < 0 ? '' : ''}{value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </td>
    </tr>
  );
}

export default HourReconciliationBar;
