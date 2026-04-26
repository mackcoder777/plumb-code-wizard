import React from 'react';
import { Step2SectionCard } from './Step2SectionCard';
import type { DetectionResult, PendingDecisions, Step2Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  decisions: PendingDecisions;
  onChange: (sec: string, decision: Step2Decision | null) => void;
}

export const Step2SectionCards: React.FC<Props> = ({ detection, decisions, onChange }) => {
  if (detection.step2Candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No section folds needed — every section is above the section threshold after Step 1.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {detection.step2Candidates.map(c => (
        <Step2SectionCard
          key={c.sec}
          candidate={c}
          partnerOptions={detection.step2Candidates}
          decision={decisions.step2[c.sec]}
          onChange={d => onChange(c.sec, d)}
        />
      ))}
    </div>
  );
};