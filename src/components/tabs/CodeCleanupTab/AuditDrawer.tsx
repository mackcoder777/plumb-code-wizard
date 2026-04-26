/**
 * AuditDrawer — side drawer showing every persisted Code Cleanup decision
 * with provenance. Reads from the cleanup-merges and hour-redistributions
 * tables (the audit columns: operation_type, pm_email, field_scope_note,
 * created_at). Spec §6.6 + §9.
 */
import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useCleanupMerges, useHourRedistributions } from './hooks/useApplyDecisions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}

const OP_LABEL: Record<string, string> = {
  pool_to_40: 'Pool to 40',
  reroute_global: 'Reroute globally',
  fold_to_plmb: 'Fold to PLMB',
  combine_sections: 'Combine sections',
  cleanup_reroute: 'Step 3 reroute',
  cleanup_custom: 'Custom',
  redistribute: 'Redistribute',
};

export const AuditDrawer: React.FC<Props> = ({ open, onOpenChange, projectId }) => {
  const { data: merges = [] } = useCleanupMerges(projectId);
  const { data: redists = [] } = useHourRedistributions(projectId);

  // Group merges into logical operations: same op + target_sec + target_head
  // + pm_email written within a 2-second window. Avoids one Pool-to-40 of
  // DRNS×5 showing as five separate audit entries (per the user's flag).
  type AnyRow = (typeof merges)[number];
  const groups = React.useMemo(() => {
    const sorted = [...merges].sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at))
    );
    const out: Array<{ key: string; op: string; rows: AnyRow[] }> = [];
    for (const r of sorted) {
      const op = (r.operation_type as string) || 'cleanup_custom';
      const targetSec = r.reassign_to_sec ?? r.sec_code;
      const targetHead = r.reassign_to_head ?? r.cost_head;
      const ts = new Date(String(r.created_at)).getTime();
      const last = out[out.length - 1];
      const lastTs = last ? new Date(String(last.rows[last.rows.length - 1].created_at)).getTime() : 0;
      const lastTargetSec = last
        ? (last.rows[0].reassign_to_sec ?? last.rows[0].sec_code)
        : '';
      const lastTargetHead = last
        ? (last.rows[0].reassign_to_head ?? last.rows[0].cost_head)
        : '';
      if (
        last &&
        last.op === op &&
        lastTargetSec === targetSec &&
        lastTargetHead === targetHead &&
        last.rows[0].pm_email === r.pm_email &&
        Math.abs(ts - lastTs) < 2000
      ) {
        last.rows.push(r);
      } else {
        out.push({ key: `${op}-${targetSec}-${targetHead}-${ts}`, op, rows: [r] });
      }
    }
    return out;
  }, [merges]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Code Cleanup audit</SheetTitle>
          <SheetDescription>
            Every persisted cleanup decision with full provenance.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <section>
            <h3 className="text-sm font-semibold mb-2">Merges & reassigns ({groups.length})</h3>
            {groups.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No persisted cleanup merges yet.</p>
            )}
            <div className="space-y-3">
              {groups.map(g => {
                const targetSec = g.rows[0].reassign_to_sec ?? g.rows[0].sec_code;
                const targetAct = g.rows[0].reassign_to_act ?? '0000';
                const targetHead = g.rows[0].reassign_to_head ?? g.rows[0].cost_head;
                return (
                  <div key={g.key} className="rounded border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">{OP_LABEL[g.op] ?? g.op}</Badge>
                      <span className="text-muted-foreground">
                        {g.rows.length} source row{g.rows.length === 1 ? '' : 's'}
                      </span>
                      <span className="text-muted-foreground">
                        {g.rows[0].pm_email ?? 'system'} ·{' '}
                        {new Date(String(g.rows[0].created_at)).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-mono pl-2 border-l-2 border-muted">
                      {g.rows.map(r => (
                        <div key={r.id}>
                          {r.sec_code} {r.merged_act} {r.cost_head}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-mono">
                      → <span className="font-semibold">{targetSec} {targetAct} {targetHead}</span>
                    </div>
                    {g.rows[0].field_scope_note && (
                      <p className="text-xs italic text-muted-foreground">
                        Scope: {g.rows[0].field_scope_note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Hour redistributions ({redists.length})</h3>
            {redists.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No persisted redistributions yet.</p>
            )}
            <div className="space-y-2">
              {redists.map(r => (
                <div key={r.id} className="rounded border p-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Redistribute</Badge>
                    <span className="text-muted-foreground">
                      {r.pm_email ?? 'system'} · {new Date(String(r.created_at)).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-mono">
                    {r.sec_code} {r.act_code} {r.source_head} → {r.target_head} :{' '}
                    <span className="font-semibold">{Math.round(Number(r.hours_moved))}h</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};