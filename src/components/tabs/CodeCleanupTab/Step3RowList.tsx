import React from 'react';
import { Step3Row } from './Step3Row';
import type { DetectionResult, FinalLaborSummary, PendingDecisions, Step3Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  decisions: PendingDecisions;
  livePreview: FinalLaborSummary;
  onChange: (key: string, decision: Step3Decision | null) => void;
}

export const Step3RowList: React.FC<Props> = ({ detection, decisions, livePreview, onChange }) => {
  if (detection.step3Candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No residual lines below the floor — Steps 1 and 2 cleared everything.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {detection.step3Candidates.map(c => (
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