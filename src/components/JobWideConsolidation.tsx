import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight, Globe, Undo2, Eye, Merge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface JobWideConsolidationProps {
  finalLaborSummary: Record<string, { code: string; hours: number; dollars: number; description?: string }> | null;
  projectId: string;
  tradePrefix: string;
  codeFormatMode: 'standard' | 'multitrade';
  onMergesChanged: () => void;
  savedMerges: Array<{
    id: string;
    sec_code: string;
    cost_head: string;
    reassign_to_head?: string | null;
    merged_act: string;
  }>;
  // Threshold owned by BudgetAdjustmentsPanel via useBudgetSettings.
  // Replaces the prior local useState(160).
  threshold: number;
  onThresholdChange: (next: number) => void;
}

interface ConsolidationCandidate {
  head: string;
  description: string;
  sections: Array<{ key: string; sec: string; act: string; hours: number }>;
  totalHours: number;
  sectionCount: number;
}

// Identify job-wide merges by merged_act pattern
const JOB_WIDE_MARKER = '__JOBWIDE__';

export const JobWideConsolidation: React.FC<JobWideConsolidationProps> = ({
  finalLaborSummary,
  projectId,
  tradePrefix,
  codeFormatMode,
  onMergesChanged,
  savedMerges,
  threshold,
  onThresholdChange,
}) => {
  const [previewHead, setPreviewHead] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dismissedHeads, setDismissedHeads] = useState<Set<string>>(new Set());

  // Local draft for the threshold input so the user can freely edit digits
  // (delete, retype) without the parent's clamp snapping intermediate values
  // back. Commit to parent on blur or Enter.
  const [thresholdDraft, setThresholdDraft] = useState<string>(String(threshold));
  useEffect(() => {
    setThresholdDraft(String(threshold));
  }, [threshold]);

  const commitThreshold = useCallback(() => {
    const parsed = parseInt(thresholdDraft, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      onThresholdChange(parsed);
    } else {
      // Invalid/empty — revert draft to current prop value
      setThresholdDraft(String(threshold));
    }
  }, [thresholdDraft, threshold, onThresholdChange]);

  // Find existing job-wide merges
  const existingJobWideMerges = useMemo(() => {
    return new Set(
      savedMerges
        .filter(m => m.merged_act === JOB_WIDE_MARKER)
        .map(m => m.cost_head)
    );
  }, [savedMerges]);

  const candidates = useMemo<ConsolidationCandidate[]>(() => {
    if (!finalLaborSummary) return [];

    const headMap = new Map<string, ConsolidationCandidate>();

    Object.entries(finalLaborSummary).forEach(([key, val]) => {
      const parts = key.trim().split(/\s+/);
      const sec = parts[0] || '';
      const act = parts[1] || '0000';
      const head = parts.slice(2).join(' ') || '';
      const hours = val.hours ?? 0;
      if (hours <= 0) return;

      if (!headMap.has(head)) {
        headMap.set(head, {
          head,
          description: val.description || head,
          sections: [],
          totalHours: 0,
          sectionCount: 0,
        });
      }
      const c = headMap.get(head)!;
      c.sections.push({ key, sec, act, hours });
      c.totalHours += hours;
    });

    // Count unique sections
    headMap.forEach(c => {
      c.sectionCount = new Set(c.sections.map(s => `${s.sec}|${s.act}`)).size;
    });

    return Array.from(headMap.values())
      .filter(c => c.sectionCount >= 2 && c.totalHours < threshold && c.totalHours > 0)
      .filter(c => !dismissedHeads.has(c.head) && !existingJobWideMerges.has(c.head))
      .sort((a, b) => a.totalHours - b.totalHours);
  }, [finalLaborSummary, threshold, dismissedHeads, existingJobWideMerges]);

  const handleConsolidate = useCallback(async (candidate: ConsolidationCandidate) => {
    if (!projectId) return;
    setSaving(true);

    try {
      // Create a merge record for each section instance
      const targetSec = codeFormatMode === 'multitrade' ? tradePrefix : candidate.sections[0]?.sec || '01';
      
      const uniqueSecs = [...new Set(candidate.sections.map(s => s.sec))];
      const records = uniqueSecs.map(sec => ({
        project_id: projectId,
        sec_code: sec,
        cost_head: candidate.head,
        reassign_to_head: candidate.head,
        merged_act: JOB_WIDE_MARKER,
      }));

      // Also create a single target entry to indicate the consolidated code
      // The finalLaborSummary pipeline will use merged_act === __JOBWIDE__ to identify these
      const { error } = await (supabase as any)
        .from('project_small_code_merges')
        .upsert(records, { onConflict: 'project_id,sec_code,cost_head,merged_act' });

      if (error) throw error;

      toast({
        title: `Consolidated ${candidate.head}`,
        description: `${candidate.sections.length} instances merged job-wide (${candidate.totalHours.toLocaleString()}h)`,
      });
      onMergesChanged();
    } catch (err: any) {
      toast({ title: 'Consolidation failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [projectId, codeFormatMode, tradePrefix, onMergesChanged]);

  const handleResetAll = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);

    try {
      const { error } = await (supabase as any)
        .from('project_small_code_merges')
        .delete()
        .eq('project_id', projectId)
        .eq('merged_act', JOB_WIDE_MARKER);

      if (error) throw error;

      toast({ title: 'Job-wide merges reset', description: 'All consolidation merges removed.' });
      onMergesChanged();
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [projectId, onMergesChanged]);

  if (!finalLaborSummary) return null;

  const hasExistingMerges = existingJobWideMerges.size > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-5 h-5 text-blue-500" />
            Job-Wide Consolidation
            {candidates.length > 0 && (
              <Badge variant="secondary" className="ml-1">{candidates.length} candidates</Badge>
            )}
          </CardTitle>
          {hasExistingMerges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={saving}
              className="text-xs"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              Reset Job-Wide Merges
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 text-xs">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Job-wide threshold:</Label>
          <Input
            type="number"
            value={thresholdDraft}
            onChange={e => setThresholdDraft(e.target.value)}
            onBlur={commitThreshold}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="w-20 h-7 text-xs"
          />
          <span className="text-muted-foreground">hrs</span>
          <span className="text-muted-foreground ml-2">
            Cost heads below this total (across all sections) are flagged.
          </span>
        </div>

        {existingJobWideMerges.size > 0 && (
          <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-300">
            ✓ {existingJobWideMerges.size} cost head{existingJobWideMerges.size !== 1 ? 's' : ''} already consolidated job-wide:
            {' '}{Array.from(existingJobWideMerges).join(', ')}
          </div>
        )}

        {candidates.length === 0 && !hasExistingMerges ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No cost heads found under {threshold}h across 2+ sections. Your code structure looks healthy!
          </p>
        ) : candidates.length === 0 && hasExistingMerges ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            All eligible candidates have been consolidated or dismissed.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cost Head</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs text-right">Sections</TableHead>
                <TableHead className="text-xs text-right">Total Hours</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map(c => (
                <React.Fragment key={c.head}>
                  <TableRow>
                    <TableCell className="font-mono text-xs py-2">{c.head}</TableCell>
                    <TableCell className="text-xs py-2">{c.description}</TableCell>
                    <TableCell className="text-xs text-right py-2">{c.sectionCount}</TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">{c.totalHours.toLocaleString()}</TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setPreviewHead(previewHead === c.head ? null : c.head)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setDismissedHeads(prev => new Set([...prev, c.head]))}
                        >
                          Keep
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-500 text-white"
                          onClick={() => handleConsolidate(c)}
                          disabled={saving}
                        >
                          <Merge className="w-3 h-3 mr-1" />
                          Consolidate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {previewHead === c.head && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 py-2">
                        <div className="text-xs space-y-1 px-2">
                          <p className="text-muted-foreground mb-1">
                            These codes would collapse into a single <span className="font-mono font-medium">
                              {codeFormatMode === 'multitrade' ? tradePrefix : c.sections[0]?.sec || '??'} 0000 {c.head}
                            </span>:
                          </p>
                          {c.sections.map(s => (
                            <div key={s.key} className="flex justify-between font-mono">
                              <span>{s.key}</span>
                              <span>{s.hours.toLocaleString()}h</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
