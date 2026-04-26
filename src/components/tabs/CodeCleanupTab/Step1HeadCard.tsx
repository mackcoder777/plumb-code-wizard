/**
 * Step 1 card — one cost head's global decision.
 * Spec §6.3: header (head name, section count, total hours), instance list
 * with small flagged red, four radio options, audit link.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step1Candidate, Step1Decision } from '@/utils/codeCleanupDetector';

interface Props {
  candidate: Step1Candidate;
  decision: Step1Decision | undefined;
  onChange: (decision: Step1Decision | null) => void;
}

type RadioValue = 'pool_to_40' | 'reroute_global' | 'keep_distributed' | 'custom';

function decisionToValue(d: Step1Decision | undefined): RadioValue | '' {
  if (!d) return '';
  return d.kind;
}

export const Step1HeadCard: React.FC<Props> = ({ candidate, decision, onChange }) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const [rerouteTarget, setRerouteTarget] = useState(
    decision?.kind === 'reroute_global' ? decision.targetHead : ''
  );
  const [customSec, setCustomSec] = useState(decision?.kind === 'custom' ? decision.targetSec : '');
  const [customAct, setCustomAct] = useState(decision?.kind === 'custom' ? decision.targetAct : '0000');
  const [customHead, setCustomHead] = useState(
    decision?.kind === 'custom' ? decision.targetHead : candidate.head
  );

  const value = decisionToValue(decision);

  const handleRadio = (v: string) => {
    const next = v as RadioValue;
    if (next === 'pool_to_40') onChange({ kind: 'pool_to_40' });
    else if (next === 'keep_distributed') onChange({ kind: 'keep_distributed' });
    else if (next === 'reroute_global') onChange({ kind: 'reroute_global', targetHead: rerouteTarget || '' });
    else if (next === 'custom')
      onChange({ kind: 'custom', targetSec: customSec, targetAct: customAct || '0000', targetHead: customHead });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-lg">{candidate.head}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {candidate.nTotal} section{candidate.nTotal === 1 ? '' : 's'} · {Math.round(candidate.totalHours).toLocaleString()}h job-wide ·{' '}
              <span className="text-destructive font-medium">{candidate.nSmall} small</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setAuditOpen(o => !o)}
          >
            {auditOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
            View audit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {candidate.instances.map(inst => (
            <Badge
              key={`${inst.sec}-${inst.act}`}
              variant={inst.isSmall ? 'destructive' : 'secondary'}
              className="font-mono text-xs"
            >
              {inst.sec} {inst.act}: {Math.round(inst.hours)}h
            </Badge>
          ))}
        </div>

        <RadioGroup value={value} onValueChange={handleRadio} className="space-y-2 pt-1">
          <Option
            id={`p40-${candidate.head}`}
            value="pool_to_40"
            label={`Pool ALL to 40 0000 ${candidate.head}`}
            note="Section dimension dies; head preserved. One global rule, field tracks one bucket."
          />
          <Option
            id={`rr-${candidate.head}`}
            value="reroute_global"
            label="Reroute ALL to a peer head"
            note="Use when this head's work always rolls into another head (e.g., COND → WATR)."
            rightSlot={
              value === 'reroute_global' ? (
                <Input
                  value={rerouteTarget}
                  onChange={e => {
                    setRerouteTarget(e.target.value.toUpperCase());
                    onChange({ kind: 'reroute_global', targetHead: e.target.value.toUpperCase() });
                  }}
                  placeholder="WATR"
                  className="w-24 h-8 font-mono text-xs"
                />
              ) : null
            }
          />
          <Option
            id={`kd-${candidate.head}`}
            value="keep_distributed"
            label="Keep distributed"
            note="Defer small instances to Step 3 for per-instance handling."
          />
          <Option
            id={`cs-${candidate.head}`}
            value="custom"
            label="Custom"
            note="Type a target SEC ACT HEAD."
            rightSlot={
              value === 'custom' ? (
                <div className="flex gap-1">
                  <Input
                    value={customSec}
                    onChange={e => {
                      const v = e.target.value.toUpperCase();
                      setCustomSec(v);
                      onChange({ kind: 'custom', targetSec: v, targetAct: customAct, targetHead: customHead });
                    }}
                    placeholder="SEC"
                    className="w-16 h-8 font-mono text-xs"
                  />
                  <Input
                    value={customAct}
                    onChange={e => {
                      setCustomAct(e.target.value);
                      onChange({ kind: 'custom', targetSec: customSec, targetAct: e.target.value, targetHead: customHead });
                    }}
                    placeholder="0000"
                    className="w-20 h-8 font-mono text-xs"
                  />
                  <Input
                    value={customHead}
                    onChange={e => {
                      const v = e.target.value.toUpperCase();
                      setCustomHead(v);
                      onChange({ kind: 'custom', targetSec: customSec, targetAct: customAct, targetHead: v });
                    }}
                    placeholder="HEAD"
                    className="w-24 h-8 font-mono text-xs"
                  />
                </div>
              ) : null
            }
          />
        </RadioGroup>

        {auditOpen && (
          <div className="rounded-md border border-dashed p-3 bg-muted/30 space-y-1 text-xs">
            <p className="font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Provenance
            </p>
            {candidate.instances.map(inst => (
              <div key={`audit-${inst.sec}-${inst.act}`} className="font-mono">
                {inst.sec} {inst.act} {candidate.head}: {Math.round(inst.hours)}h
              </div>
            ))}
            <p className="text-muted-foreground pt-1">
              Audit row captured at Apply: operation type · sources · target · hours · PM identity · timestamp.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Option: React.FC<{
  id: string;
  value: string;
  label: string;
  note: string;
  rightSlot?: React.ReactNode;
}> = ({ id, value, label, note, rightSlot }) => (
  <div className={cn('flex items-start gap-3 rounded-md border p-2.5 hover:bg-accent/30 transition')}>
    <RadioGroupItem value={value} id={id} className="mt-1" />
    <Label htmlFor={id} className="flex-1 cursor-pointer space-y-0.5">
      <span className="text-sm font-medium block">{label}</span>
      <span className="text-xs text-muted-foreground block">{note}</span>
    </Label>
    {rightSlot}
  </div>
);