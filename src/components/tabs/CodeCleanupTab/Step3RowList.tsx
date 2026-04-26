import React from 'react';
import { Step3Row } from './Step3Row';
import type { DetectionResult, FinalLaborSummary, PendingDecisions, Step3Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  /**
   * Live detection — recomputed against the post-Step-1/Step-2 preview, with
   * `committedStep1Heads` honored. This is the SSOT for which residual lines
   * Step 3 displays. `detection` (initial pessimistic pass) is kept around in
   * case future tooling needs it (audit/debug), but the rendered list comes
   * from `liveDetection` so a `keep_distributed` choice in Step 1 correctly
   * surfaces the head's small instances here per spec §7.1.
   */
  liveDetection: DetectionResult;
  decisions: PendingDecisions;
  livePreview: FinalLaborSummary;
  onChange: (key: string, decision: Step3Decision | null) => void;
}

export const Step3RowList: React.FC<Props> = ({ detection, liveDetection, decisions, livePreview, onChange }) => {
  // Render off liveDetection so committedStep1Heads filtering takes effect.
  // `detection` is intentionally referenced (prop kept) but not iterated.
  void detection;
  if (liveDetection.step3Candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No residual lines below the floor — Steps 1 and 2 cleared everything.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {liveDetection.step3Candidates.map(c => (
        <Step3Row
          key={c.key}
          candidate={c}
          decision={decisions.step3[c.key]}
          livePreview={livePreview}
          onChange={d => onChange(c.key, d)}
        />
      ))}
    </div>
  );
};