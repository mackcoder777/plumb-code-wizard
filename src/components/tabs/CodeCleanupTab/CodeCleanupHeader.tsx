/**
 * Code Cleanup tab header — read-only metrics + the threshold knob.
 * The threshold knob is the single PM-facing control shared with Code Health
 * (writes to consolidation_thresholds via setThresholds in the context).
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCodeCleanup } from '@/contexts/CodeCleanupContext';
import type { DetectionResult } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
}

export const CodeCleanupHeader: React.FC<Props> = ({ detection }) => {
  const { thresholds, setThresholds } = useCodeCleanup();
  const { meta } = detection;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Budget lines" value={meta.totalLines.toLocaleString()} />
          <Metric label="Total hours" value={Math.round(meta.totalHours).toLocaleString()} />
          <Metric
            label="Lines below floor"
            value={meta.linesBelowFloor.toLocaleString()}
            tone={meta.linesBelowFloor > 0 ? 'warning' : 'ok'}
          />
          <Metric
            label="Hours affected"
            value={Math.round(meta.hoursAffected).toLocaleString()}
            tone={meta.hoursAffected > 0 ? 'warning' : 'ok'}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4 pt-2 border-t">
          <div className="space-y-1">
            <Label htmlFor="cc-line-floor" className="text-xs uppercase tracking-wide text-muted-foreground">
              Line floor (hrs)
            </Label>
            <Input
              id="cc-line-floor"
              type="number"
              min={1}
              max={40}
              value={thresholds.lineFloor}
              onChange={e =>
                setThresholds({ ...thresholds, lineFloor: Number(e.target.value) || thresholds.lineFloor })
              }
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cc-section-threshold" className="text-xs uppercase tracking-wide text-muted-foreground">
              Section threshold (hrs)
            </Label>
            <Input
              id="cc-section-threshold"
              type="number"
              min={10}
              max={500}
              value={thresholds.sectionThreshold}
              onChange={e =>
                setThresholds({
                  ...thresholds,
                  sectionThreshold: Number(e.target.value) || thresholds.sectionThreshold,
                })
              }
              className="w-24"
            />
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Threshold changes recompute the workflow live and apply to Code Health.
            Default 12h / 80h.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: 'ok' | 'warning' }> = ({
  label,
  value,
  tone = 'ok',
}) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p
      className={
        tone === 'warning'
          ? 'text-2xl font-bold text-destructive'
          : 'text-2xl font-bold text-foreground'
      }
    >
      {value}
    </p>
  </div>
);