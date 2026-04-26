/**
 * Step 3 row — one residual below-floor line, four-button toolbar.
 * Per §6.5: identity, action toolbar (Accept / Redistribute / Reroute / Custom),
 * inline expand for sub-controls, audit link.
 */
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { FinalLaborSummary, Step3Candidate, Step3Decision } from '@/utils/codeCleanupDetector';
import { cn } from '@/lib/utils';

interface Props {
  candidate: Step3Candidate;
  decision: Step3Decision | undefined;
  // Live (post-Steps 1+2) summary so Redistribute can pick from same-section peers.
  livePreview: FinalLaborSummary;
  onChange: (decision: Step3Decision | null) => void;
}

type Mode = 'accept' | 'redistribute' | 'reroute' | 'custom' | '';

function modeFromDecision(d: Step3Decision | undefined, def: 'accept' | ''): Mode {
  if (!d) return def;
  if (d.kind === 'redistribute') return 'redistribute';
  if (d.kind === 'reroute') return 'reroute';
  if (d.kind === 'custom') return 'custom';
  return 'accept';
}

export const Step3Row: React.FC<Props> = ({ candidate, decision, livePreview, onChange }) => {
  const defaultMode: Mode = candidate.defaultAction === 'accept' ? 'accept' : '';
  const mode = modeFromDecision(decision, defaultMode);

  const [redistSrc, setRedistSrc] = useState(
    decision?.kind === 'redistribute' ? decision.sourceHead : ''
  );
  const [redistHrs, setRedistHrs] = useState(
    decision?.kind === 'redistribute' ? decision.hours : 0
  );
  const [rerouteTargetKey, setRerouteTargetKey] = useState(
    decision?.kind === 'reroute' ? `${decision.targetSec} ${decision.targetAct} ${decision.targetHead}` : ''
  );
  const [customSec, setCustomSec] = useState(
    decision?.kind === 'custom' ? decision.targetSec : candidate.sec
  );
  const [customAct, setCustomAct] = useState(
    decision?.kind === 'custom' ? decision.targetAct : '0000'
  );
  const [customHead, setCustomHead] = useState(
    decision?.kind === 'custom' ? decision.targetHead : candidate.head
  );

  // Same-section peers for Redistribute and Reroute targets.
  const sectionPeers = useMemo(
    () =>
      Object.entries(livePreview)
        .map(([k, v]) => {
          const parts = k.trim().split(/\s+/);
          return { sec: parts[0], act: parts[1], head: parts.slice(2).join(' '), hours: v.hours ?? 0, key: k };
        })
        .filter(p => p.sec === candidate.sec && p.head !== candidate.head)
        .sort((a, b) => b.hours - a.hours),
    [livePreview, candidate.sec, candidate.head]
  );

  const setMode = (next: Mode) => {
    if (next === '' || next === mode) return;
    if (next === 'accept') onChange({ kind: 'accept' });
    else if (next === 'redistribute')
      onChange({ kind: 'redistribute', sourceHead: redistSrc, hours: redistHrs });
    else if (next === 'reroute') {
      const parts = rerouteTargetKey.trim().split(/\s+/);
      onChange({
        kind: 'reroute',
        targetSec: parts[0] ?? candidate.sec,
        targetAct: parts[1] ?? '0000',
        targetHead: parts.slice(2).join(' ') || candidate.head,
      });
    } else if (next === 'custom') {
      onChange({ kind: 'custom', targetSec: customSec, targetAct: customAct, targetHead: customHead });
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-mono text-sm">
            {candidate.sec} {candidate.act} {candidate.head}{' '}
            <span className="text-destructive ml-2">{Math.round(candidate.hours)}h</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Section total {Math.round(candidate.sectionTotal)}h ·{' '}
            <Badge variant={candidate.sectionIsHealthy ? 'secondary' : 'destructive'} className="text-[10px]">
              {candidate.sectionIsHealthy ? 'healthy section' : 'small section'}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <ModeButton active={mode === 'accept'} onClick={() => setMode('accept')}>
            Accept
          </ModeButton>
          <ModeButton active={mode === 'redistribute'} onClick={() => setMode('redistribute')}>
            Redistribute
          </ModeButton>
          <ModeButton active={mode === 'reroute'} onClick={() => setMode('reroute')}>
            Reroute
          </ModeButton>
          <ModeButton active={mode === 'custom'} onClick={() => setMode('custom')}>
            Custom
          </ModeButton>
        </div>
      </div>

      {mode === 'redistribute' && (
        <div className="rounded-md bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Source head (same section)</Label>
              <Select
                value={redistSrc}
                onValueChange={v => {
                  setRedistSrc(v);
                  onChange({ kind: 'redistribute', sourceHead: v, hours: redistHrs });
                }}
              >
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="Pick a peer" />
                </SelectTrigger>
                <SelectContent>
                  {sectionPeers.map(p => (
                    <SelectItem key={p.key} value={p.head} className="font-mono">
                      {p.head} ({Math.round(p.hours)}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hours to move</Label>
              <Input
                type="number"
                min={0}
                value={redistHrs}
                onChange={e => {
                  const v = Number(e.target.value) || 0;
                  setRedistHrs(v);
                  onChange({ kind: 'redistribute', sourceHead: redistSrc, hours: v });
                }}
                className="w-20 h-8 text-xs"
              />
            </div>
          </div>
          {redistSrc && redistHrs > 0 && (
            <p className="text-xs text-muted-foreground font-mono">
              {candidate.sec} {candidate.act} {candidate.head}: {Math.round(candidate.hours)}h →{' '}
              {Math.round(candidate.hours + redistHrs)}h ·{' '}
              {candidate.sec} {candidate.act} {redistSrc}: {Math.round(sectionPeers.find(p => p.head === redistSrc)?.hours ?? 0)}h →{' '}
              {Math.round((sectionPeers.find(p => p.head === redistSrc)?.hours ?? 0) - redistHrs)}h · section unchanged
            </p>
          )}
        </div>
      )}

      {mode === 'reroute' && (
        <div className="rounded-md bg-muted/30 p-3 space-y-2">
          <Label className="text-xs">Target (same section, healthy peer)</Label>
          <Select
            value={rerouteTargetKey}
            onValueChange={v => {
              setRerouteTargetKey(v);
              const parts = v.trim().split(/\s+/);
              onChange({
                kind: 'reroute',
                targetSec: parts[0],
                targetAct: parts[1],
                targetHead: parts.slice(2).join(' '),
              });
            }}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Pick a target" />
            </SelectTrigger>
            <SelectContent>
              {sectionPeers.map(p => (
                <SelectItem key={p.key} value={p.key} className="font-mono">
                  {p.sec} {p.act} {p.head} ({Math.round(p.hours)}h)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {mode === 'custom' && (
        <div className="rounded-md bg-muted/30 p-3 flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">SEC</Label>
            <Input
              value={customSec}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setCustomSec(v);
                onChange({ kind: 'custom', targetSec: v, targetAct: customAct, targetHead: customHead });
              }}
              className="w-16 h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">ACT</Label>
            <Input
              value={customAct}
              onChange={e => {
                setCustomAct(e.target.value);
                onChange({ kind: 'custom', targetSec: customSec, targetAct: e.target.value, targetHead: customHead });
              }}
              className="w-20 h-8 font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">HEAD</Label>
            <Input
              value={customHead}
              onChange={e => {
                const v = e.target.value.toUpperCase();
                setCustomHead(v);
                onChange({ kind: 'custom', targetSec: customSec, targetAct: customAct, targetHead: v });
              }}
              className="w-24 h-8 font-mono text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <Button
    type="button"
    size="sm"
    variant={active ? 'default' : 'outline'}
    onClick={onClick}
    className={cn('h-7 text-xs', active && 'shadow-sm')}
  >
    {children}
  </Button>
);