import React from "react";
import { ChevronDown, ChevronRight, ArrowRight, GitMerge, Shuffle, ArrowRightLeft, Shield } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TableRow, TableCell } from "@/components/ui/table";

interface SourceLine {
  code: string;
  hours: number;
  act: string;
}

interface CodeHistoryDetailProps {
  sec: string;
  head: string;
  /** Pre-merge source lines from adjustedLaborSummary */
  sourceLines: SourceLine[];
  /** Action type resolved from saved merge */
  actionType: 'merge' | 'reassign' | 'redistribute' | 'keep' | 'accepted' | null;
  /** For reassign: the target cost head */
  reassignTarget?: string | null;
  /** For redistribute: the adjustment deltas { activityCode: deltaHours } */
  redistributeDeltas?: Record<string, number> | null;
  /** Post-pipeline hours at the target key(s) from finalLaborSummary */
  targetEntries: Array<{ code: string; hours: number }>;
  /** Total hours after pipeline for this sec|head */
  finalHours: number;
  /** Whether the row is expanded */
  isOpen: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Number of columns in parent table for colspan (0 = standalone/non-table mode) */
  colSpan: number;
}

export const CodeHistoryDetail: React.FC<CodeHistoryDetailProps> = ({
  sec,
  head,
  sourceLines,
  actionType,
  reassignTarget,
  redistributeDeltas,
  targetEntries,
  finalHours,
  isOpen,
  onToggle,
  colSpan,
}) => {
  if (!actionType || actionType === 'keep' || actionType === 'accepted') return null;

  const actionLabel = actionType === 'merge'
    ? 'Merge'
    : actionType === 'reassign'
    ? 'Reassign'
    : 'Redistribute';

  const ActionIcon = actionType === 'merge'
    ? GitMerge
    : actionType === 'reassign'
    ? ArrowRight
    : Shuffle;

  const totalSourceHours = sourceLines.reduce((s, l) => s + l.hours, 0);

  const standalone = colSpan === 0;

  const innerContent = (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-1.5 px-4 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <ActionIcon className="h-3 w-3" />
          <span>Code History</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
            <div className="px-6 pb-3 pt-1 space-y-2 bg-muted/10 border-t border-border/30">
              {/* Source codes */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Source Codes (Pre-Pipeline)
                </div>
                <div className="space-y-0.5">
                  {sourceLines.length > 0 ? sourceLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-foreground">{line.code}</span>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-orange-400 font-semibold">{line.hours.toFixed(1)}h</span>
                    </div>
                  )) : (
                    <div className="text-xs text-muted-foreground italic">No pre-merge data available</div>
                  )}
                  {sourceLines.length > 1 && (
                    <div className="flex items-center gap-2 text-xs font-mono border-t border-border/30 pt-0.5 mt-0.5">
                      <span className="text-muted-foreground">Total</span>
                      <span className="text-orange-400 font-semibold">{totalSourceHours.toFixed(1)}h</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action applied */}
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-3 w-3 text-primary" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Action Applied
                </span>
                <span className="text-xs font-mono text-primary font-semibold">{actionLabel}</span>
              </div>

              {/* Redistribute detail */}
              {actionType === 'redistribute' && redistributeDeltas && Object.keys(redistributeDeltas).length > 0 && (
                <div className="ml-5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Hour Adjustments by Activity
                  </div>
                  <div className="space-y-0.5">
                    {Object.entries(redistributeDeltas).map(([act, delta]) => {
                      // Find the source line for this activity to show before/after
                      const sourceLine = sourceLines.find(l => l.act === act);
                      const beforeHours = sourceLine?.hours ?? 0;
                      const afterHours = beforeHours + delta;
                      return (
                        <div key={act} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-muted-foreground w-12">{act}</span>
                          <span className="text-orange-400">{beforeHours.toFixed(1)}h</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className={afterHours > 0 ? 'text-green-500' : 'text-destructive'}>
                            {afterHours.toFixed(1)}h
                          </span>
                          <span className={`text-[10px] ${delta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                            ({delta >= 0 ? '+' : ''}{delta.toFixed(1)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target / destination */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {actionType === 'redistribute' ? 'Result in Final Summary' : 'Target Destination'}
                </div>
                {actionType === 'reassign' && reassignTarget && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-foreground">{sec} 0000 {reassignTarget}</span>
                    {targetEntries.length > 0 && (
                      <>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-green-500 font-semibold">
                          {targetEntries.reduce((s, e) => s + e.hours, 0).toFixed(1)}h (total at target)
                        </span>
                      </>
                    )}
                  </div>
                )}
                {actionType === 'merge' && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-foreground">{sec} 0000 {head}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-green-500 font-semibold">{finalHours.toFixed(1)}h</span>
                  </div>
                )}
                {actionType === 'redistribute' && (
                  <div className="space-y-0.5">
                    {targetEntries.length > 0 ? targetEntries.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-foreground">{entry.code}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-green-500 font-semibold">{entry.hours.toFixed(1)}h</span>
                      </div>
                    )) : (
                      <div className="text-xs text-muted-foreground italic">
                        Hours absorbed into matching codes
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Zero-sum check */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Source: {totalSourceHours.toFixed(1)}h → Final: {finalHours.toFixed(1)}h
                  {Math.abs(totalSourceHours - finalHours) < 0.1
                    ? ' ✓ Balanced'
                    : ` (Δ ${(finalHours - totalSourceHours).toFixed(1)}h — hours moved to target)`
                  }
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  );
};
