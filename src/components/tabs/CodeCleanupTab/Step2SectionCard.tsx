/**
 * Step 2 card — one section's fold decision.
 * Per §6.4: header with post-Step-1 codes count + hours, comma-separated head
 * list, fold target display, optional combine block, audit link.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Step2Candidate, Step2Decision } from '@/utils/codeCleanupDetector';

interface Props {
  candidate: Step2Candidate;
  partnerOptions: Step2Candidate[];
  decision: Step2Decision | undefined;
  onChange: (decision: Step2Decision | null) => void;
}

export const Step2SectionCard: React.FC<Props> = ({
  candidate,
  partnerOptions,
  decision,
  onChange,
}) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const isCombine = decision?.kind === 'combine';
  const [combinedSec, setCombinedSec] = useState(decision?.combinedSec ?? '');
  const [partnerSec, setPartnerSec] = useState(decision?.combineWithSec ?? '');
  const [scopeNote, setScopeNote] = useState(decision?.fieldScopeNote ?? '');

  // A section can be a Step 2 card only if undecided. Default behavior is a
  // simple fold — apply that default the first time the user touches the
  // header checkbox below.
  const headList = candidate.heads
    .map(h => `${h.head} (${Math.round(h.hours)}h)`)
    .join(', ');

  const toggleCombine = (checked: boolean) => {
    if (checked) {
      onChange({
        kind: 'combine',
        combineWithSec: partnerSec || undefined,
        combinedSec: combinedSec || undefined,
        fieldScopeNote: scopeNote || undefined,
      });
    } else {
      onChange({ kind: 'fold' });
    }
  };

  const updateCombine = (patch: Partial<{ combineWithSec: string; combinedSec: string; fieldScopeNote: string }>) => {
    onChange({
      kind: 'combine',
      combineWithSec: patch.combineWithSec ?? partnerSec,
      combinedSec: patch.combinedSec ?? combinedSec,
      fieldScopeNote: patch.fieldScopeNote ?? scopeNote,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-lg">Section {candidate.sec}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {candidate.remainingCodes} code{candidate.remainingCodes === 1 ? '' : 's'} ·{' '}
              {Math.round(candidate.remainingTotal).toLocaleString()}h after Step 1
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAuditOpen(o => !o)}>
            {auditOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
            View audit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Heads remaining:</span> {headList || '—'}
        </p>

        <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
          {isCombine && combinedSec
            ? `${combinedSec} 0000 PLMB (combined)`
            : `${candidate.sec} 0000 PLMB (fold)`}
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`combine-${candidate.sec}`}
              checked={isCombine}
              onCheckedChange={c => toggleCombine(!!c)}
            />
            <Label htmlFor={`combine-${candidate.sec}`} className="cursor-pointer text-xs font-medium">
              Combine with another section
            </Label>
          </div>

          {isCombine && (
            <div className="space-y-2 pl-6">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs">Partner section:</Label>
                <Select
                  value={partnerSec}
                  onValueChange={v => {
                    setPartnerSec(v);
                    updateCombine({ combineWithSec: v });
                  }}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Pick…" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerOptions
                      .filter(p => p.sec !== candidate.sec)
                      .map(p => (
                        <SelectItem key={p.sec} value={p.sec} className="font-mono">
                          {p.sec} ({Math.round(p.remainingTotal)}h)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Combined name:</Label>
                <Input
                  value={combinedSec}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setCombinedSec(v);
                    updateCombine({ combinedSec: v });
                  }}
                  placeholder="MZ"
                  className="w-24 h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Field scope note:</Label>
                <Input
                  value={scopeNote}
                  onChange={e => {
                    setScopeNote(e.target.value);
                    updateCombine({ fieldScopeNote: e.target.value });
                  }}
                  placeholder="What does this combined code cover?"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {auditOpen && (
          <div className="rounded-md border border-dashed p-3 bg-muted/30 space-y-1 text-xs">
            <p className="font-medium">Provenance</p>
            {candidate.heads.map(h => (
              <div key={h.head} className="font-mono">
                {candidate.sec} {h.act} {h.head}: {Math.round(h.hours)}h
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};