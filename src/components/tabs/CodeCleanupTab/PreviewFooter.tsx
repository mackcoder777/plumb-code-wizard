/**
 * Sticky footer — Before / After preview + Apply All / reset.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Props {
  beforeLines: number;
  afterLines: number;
  beforeBelowFloor: number;
  afterBelowFloor: number;
  pendingCount: number;
  isApplying: boolean;
  onApplyAll: () => void;
  onReset: () => void;
}

export const PreviewFooter: React.FC<Props> = ({
  beforeLines,
  afterLines,
  beforeBelowFloor,
  afterBelowFloor,
  pendingCount,
  isApplying,
  onApplyAll,
  onReset,
}) => {
  const lineDelta = afterLines - beforeLines;
  const floorDelta = afterBelowFloor - beforeBelowFloor;
  return (
    <Card className="sticky bottom-4 shadow-lg border-2">
      <CardContent className="pt-4 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <Stat label="Budget lines" before={beforeLines} after={afterLines} delta={lineDelta} />
          <Stat
            label="Lines below floor"
            before={beforeBelowFloor}
            after={afterBelowFloor}
            delta={floorDelta}
            tone="floor"
          />
          <div className="text-xs text-muted-foreground self-end">
            {pendingCount} pending decision{pendingCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset} disabled={pendingCount === 0 || isApplying}>
            Reset
          </Button>
          <Button size="sm" onClick={onApplyAll} disabled={pendingCount === 0 || isApplying}>
            {isApplying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            Apply All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Stat: React.FC<{
  label: string;
  before: number;
  after: number;
  delta: number;
  tone?: 'floor';
}> = ({ label, before, after, delta, tone }) => {
  const positive = delta > 0;
  const negative = delta < 0;
  const desirable = tone === 'floor' ? negative : negative; // fewer lines is good
  const deltaColor =
    delta === 0
      ? 'text-muted-foreground'
      : desirable
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-destructive';
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">
        <span className="font-mono">{before}</span> →{' '}
        <span className="font-mono font-semibold">{after}</span>{' '}
        <span className={`text-xs ${deltaColor}`}>
          {positive ? '+' : ''}
          {delta}
        </span>
      </p>
    </div>
  );
};