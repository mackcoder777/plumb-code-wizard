/**
 * Step 2 card — one section's fold decision.
 * Per §6.4 + v5 mockup: explicit Accept-fold toggle (default OFF — no decision
 * recorded until PM commits), editable [SEC] [ACT] [HEAD] target string,
 * optional Combine flow that expands inline (does NOT collapse the card),
 * audit link. The card stays in the list while the PM works — list is pinned
 * by the parent against initial detection.
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Step2Candidate, Step2Decision } from '@/utils/codeCleanupDetector';

interface Props {
  /** Pinned candidate from initial detection — drives identity + provenance. */
  candidate: Step2Candidate;
  /** Same sec recomputed against livePreview — for the "after Step 1" hour line. */
  liveCandidate?: Step2Candidate;
  partnerOptions: Step2Candidate[];
  decision: Step2Decision | undefined;
  onChange: (decision: Step2Decision | null) => void;
}

const DEFAULT_TARGET_ACT = '0000';
const DEFAULT_TARGET_HEAD = 'PLMB';

export const Step2SectionCard: React.FC<Props> = ({
  candidate,
  liveCandidate,
  partnerOptions,
  decision,
  onChange,
}) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const isAccepted = !!decision;
  const isCombine = decision?.kind === 'combine';

  // Target editor state — preserved across toggles.
  const [targetSec, setTargetSec] = useState(
    decision?.kind === 'combine' && decision.combinedSec ? decision.combinedSec : candidate.sec
  );
  const [targetAct, setTargetAct] = useState(decision?.targetAct ?? DEFAULT_TARGET_ACT);
  const [targetHead, setTargetHead] = useState(decision?.targetHead ?? DEFAULT_TARGET_HEAD);

  // Combine sub-state.
  const [partnerSec, setPartnerSec] = useState(decision?.combineWithSec ?? '');
  const [scopeNote, setScopeNote] = useState(decision?.fieldScopeNote ?? '');

  // If decision is cleared externally (e.g., Reset), restore defaults.
  useEffect(() => {
    if (!decision) {
      setTargetSec(candidate.sec);
      setTargetAct(DEFAULT_TARGET_ACT);
      setTargetHead(DEFAULT_TARGET_HEAD);
      setPartnerSec('');
      setScopeNote('');
    }
  }, [decision, candidate.sec]);

  const remainingTotal = liveCandidate?.remainingTotal ?? candidate.remainingTotal;
  const remainingCodes = liveCandidate?.remainingCodes ?? candidate.remainingCodes;
  const headsToList = liveCandidate?.heads ?? candidate.heads;
  const headList = headsToList.map(h => `${h.head} (${Math.round(h.hours)}h)`).join(', ');

  // Build a Step2Decision from current form state. Used after every edit.
  const buildDecision = (overrides: Partial<{
    isCombine: boolean;
    targetSec: string;
    targetAct: string;
    targetHead: string;
    partnerSec: string;
    scopeNote: string;
  }> = {}): Step2Decision => {
    const combine = overrides.isCombine ?? isCombine;
    const tSec = overrides.targetSec ?? targetSec;
    const tAct = overrides.targetAct ?? targetAct;
    const tHead = overrides.targetHead ?? targetHead;
    const pSec = overrides.partnerSec ?? partnerSec;
    const note = overrides.scopeNote ?? scopeNote;
    if (combine) {
      return {
        kind: 'combine',
        combineWithSec: pSec || undefined,
        combinedSec: tSec || undefined,
        fieldScopeNote: note || undefined,
        targetAct: tAct || undefined,
        targetHead: tHead || undefined,
      };
    }
    return {
      kind: 'fold',
      targetAct: tAct !== DEFAULT_TARGET_ACT ? tAct : undefined,
      targetHead: tHead !== DEFAULT_TARGET_HEAD ? tHead : undefined,
    };
  };

  // Toggle Accept-fold checkbox: on => commit a fold decision; off => clear.
  const toggleAccept = (checked: boolean) => {
    if (checked) {
      onChange(buildDecision({ isCombine: false }));
    } else {
      onChange(null);
    }
  };

  // Toggle Combine sub-flow. Only meaningful while Accept-fold is on.
  const toggleCombine = (checked: boolean) => {
    if (!isAccepted && checked) {
      // Auto-promote: turning on Combine implies committing a decision.
      onChange(buildDecision({ isCombine: true }));
      return;
    }
    if (!isAccepted) return;
    onChange(buildDecision({ isCombine: checked }));
  };

  // Live preview string — what the fold will produce.
  const previewString = `${targetSec || candidate.sec} ${targetAct || DEFAULT_TARGET_ACT} ${targetHead || DEFAULT_TARGET_HEAD}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-lg">Section {candidate.sec}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {remainingCodes} code{remainingCodes === 1 ? '' : 's'} ·{' '}
              {Math.round(remainingTotal).toLocaleString()}h after Step 1
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

        {/* Editable target — three fields side by side. */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fold target</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              value={targetSec}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setTargetSec(v);
                if (isAccepted) onChange(buildDecision({ targetSec: v }));
              }}
              placeholder="SEC"
              className="w-20 h-9 font-mono text-sm"
            />
            <Input
              value={targetAct}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setTargetAct(v);
                if (isAccepted) onChange(buildDecision({ targetAct: v }));
              }}
              placeholder="0000"
              className="w-24 h-9 font-mono text-sm"
            />
            <Input
              value={targetHead}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setTargetHead(v);
                if (isAccepted) onChange(buildDecision({ targetHead: v }));
              }}
              placeholder="PLMB"
              className="w-24 h-9 font-mono text-sm"
            />
            <span className="text-xs text-muted-foreground ml-1">
              → <span className="font-mono">{previewString}</span>
              {isCombine ? ' (combined)' : ' (fold)'}
            </span>
          </div>
        </div>

        {/* Accept-fold toggle. Default OFF — section stays untouched until PM commits. */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Checkbox
            id={`accept-${candidate.sec}`}
            checked={isAccepted}
            onCheckedChange={c => toggleAccept(!!c)}
          />
          <Label htmlFor={`accept-${candidate.sec}`} className="cursor-pointer text-sm font-medium">
            Accept fold {isAccepted && <span className="text-xs text-muted-foreground">— committed</span>}
          </Label>
        </div>

        {/* Combine sub-flow. */}
        <div className="space-y-2">
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
            <div className="space-y-2 pl-6 rounded-md bg-muted/30 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Partner section:</Label>
                <Select
                  value={partnerSec}
                  onValueChange={v => {
                    setPartnerSec(v);
                    onChange(buildDecision({ partnerSec: v, isCombine: true }));
                  }}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Pick a section…" />
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
              <div className="space-y-1">
                <Label className="text-xs">Field scope note:</Label>
                <Input
                  value={scopeNote}
                  onChange={e => {
                    setScopeNote(e.target.value);
                    onChange(buildDecision({ scopeNote: e.target.value, isCombine: true }));
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