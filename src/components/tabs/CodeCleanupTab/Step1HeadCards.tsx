import React from 'react';
import { Step1HeadCard } from './Step1HeadCard';
import type { DetectionResult, PendingDecisions, Step1Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  decisions: PendingDecisions;
  onChange: (head: string, decision: Step1Decision | null) => void;
  /** All heads present in the project — fuels Reroute dropdown options. */
  projectHeads: string[];
}

export const Step1HeadCards: React.FC<Props> = ({
  detection,
  decisions,
  onChange,
  projectHeads,
}) => {
  if (detection.step1Candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No global head decisions needed — every cost head is healthy across the project.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {detection.step1Candidates.map(c => (
        <Step1HeadCard
          key={c.head}
          candidate={c}
          decision={decisions.step1[c.head]}
          onChange={d => onChange(c.head, d)}
          projectHeads={projectHeads}
        />
      ))}
    </div>
  );
};