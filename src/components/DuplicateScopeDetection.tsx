import React, { useMemo, useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Merge, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface DuplicateScopeDetectionProps {
  adjustedLaborSummary: Record<string, { code: string; hours: number; dollars: number; description?: string }> | null;
  projectId: string;
  dismissedFlags: string[];
  onDismissFlag: (flag: string) => void;
  onMergesChanged: () => void;
}

// Known alias pairs where both in the same SEC-ACT section is likely duplicate scope
const ALIAS_PAIRS: Array<[string, string, string]> = [
  ['WATR', 'DWTR', 'Both track domestic water scope — likely duplicate'],
];

interface DuplicateFlag {
  flagKey: string;
  secAct: string;
  head1: string;
  head2: string;
  hours1: number;
  hours2: number;
  code1: string;
  code2: string;
  reason: string;
  mergeInto: string; // Which code to keep (the primary/larger one)
  mergeFrom: string; // Which code to remove
}

export const DuplicateScopeDetection: React.FC<DuplicateScopeDetectionProps> = ({
  adjustedLaborSummary,
  projectId,
  dismissedFlags,
  onDismissFlag,
  onMergesChanged,
}) => {
  const [saving, setSaving] = useState(false);

  const duplicates = useMemo<DuplicateFlag[]>(() => {
    if (!adjustedLaborSummary) return [];

    // Build lookup: sec-act -> { head -> { code, hours } }
    const secActMap = new Map<string, Map<string, { code: string; hours: number }>>();

    Object.entries(adjustedLaborSummary).forEach(([key, val]) => {
      const parts = key.trim().split(/\s+/);
      const sec = parts[0] || '';
      const act = parts[1] || '0000';
      const head = parts.slice(2).join(' ') || '';
      const secAct = `${sec} ${act}`;

      if (!secActMap.has(secAct)) secActMap.set(secAct, new Map());
      secActMap.get(secAct)!.set(head, { code: key, hours: val.hours ?? 0 });
    });

    const flags: DuplicateFlag[] = [];

    secActMap.forEach((headMap, secAct) => {
      ALIAS_PAIRS.forEach(([h1, h2, reason]) => {
        const entry1 = headMap.get(h1);
        const entry2 = headMap.get(h2);

        if (entry1 && entry2 && entry1.hours > 0 && entry2.hours > 0) {
          const flagKey = `${secAct}|${h1}|${h2}`;
          if (dismissedFlags.includes(flagKey)) return;

          // Merge into the primary (first in pair), not the alias
          flags.push({
            flagKey,
            secAct,
            head1: h1,
            head2: h2,
            hours1: entry1.hours,
            hours2: entry2.hours,
            code1: entry1.code,
            code2: entry2.code,
            reason,
            mergeInto: entry1.code,
            mergeFrom: entry2.code,
          });
        }
      });
    });

    return flags;
  }, [adjustedLaborSummary, dismissedFlags]);

  const handleMerge = useCallback(async (flag: DuplicateFlag) => {
    setSaving(true);
    try {
      const fromParts = flag.mergeFrom.trim().split(/\s+/);
      const fromSec = fromParts[0] || '';
      const fromHead = fromParts.slice(2).join(' ') || '';

      // Save a reassign merge: move from-code hours into to-code
      const { error } = await (supabase as any)
        .from('project_small_code_merges')
        .insert({
          project_id: projectId,
          sec_code: fromSec,
          cost_head: fromHead,
          reassign_to_head: flag.head1, // Merge into the primary head
          merged_act: '0000',
        });

      if (error) throw error;

      toast({
        title: `Merged ${flag.head2} → ${flag.head1}`,
        description: `${flag.hours2.toLocaleString()}h moved to ${flag.head1} in section ${flag.secAct}`,
      });
      onMergesChanged();
    } catch (err: any) {
      toast({ title: 'Merge failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [projectId, onMergesChanged]);

  const handleDismiss = useCallback(async (flag: DuplicateFlag) => {
    onDismissFlag(flag.flagKey);

    if (projectId) {
      try {
        // Fetch current flags
        const { data } = await (supabase as any)
          .from('estimate_projects')
          .select('dismissed_duplicate_flags')
          .eq('id', projectId)
          .single();

        const current = (data?.dismissed_duplicate_flags || []) as string[];
        if (!current.includes(flag.flagKey)) {
          const { error } = await (supabase as any)
            .from('estimate_projects')
            .update({ dismissed_duplicate_flags: [...current, flag.flagKey] })
            .eq('id', projectId);
          if (error) console.error('Failed to persist dismiss:', error);
        }
      } catch {
        // Ignore persistence errors — local state already updated
      }
    }
  }, [projectId, onDismissFlag]);

  if (duplicates.length === 0) return null;

  return (
    <div className="space-y-2">
      {duplicates.map(flag => (
        <div
          key={flag.flagKey}
          className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-medium">Section {flag.secAct}</span> has both{' '}
            <span className="font-mono font-medium">{flag.head1}</span>{' '}
            <Badge variant="outline" className="text-[10px] px-1">{flag.hours1.toLocaleString()}h</Badge>
            {' '}and{' '}
            <span className="font-mono font-medium">{flag.head2}</span>{' '}
            <Badge variant="outline" className="text-[10px] px-1">{flag.hours2.toLocaleString()}h</Badge>
            {' '}— {flag.reason}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handleDismiss(flag)}
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs px-2 bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() => handleMerge(flag)}
              disabled={saving}
            >
              <Merge className="w-3 h-3 mr-1" />
              Merge to {flag.head1}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
