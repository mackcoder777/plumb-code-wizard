import React from 'react';
import { Step2SectionCard } from './Step2SectionCard';
import type {
  DetectionResult,
  PendingDecisions,
  Step2Candidate,
  Step2Decision,
} from '@/utils/codeCleanupDetector';

interface Props {
  /** Pinned candidate set — list never collapses while PM works. */
  detection: DetectionResult;
  /** Live (post-decision) detection — used only for inline live numbers. */
  liveDetection: DetectionResult;
  decisions: PendingDecisions;
  onChange: (sec: string, decision: Step2Decision | null) => void;
}

export const Step2SectionCards: React.FC<Props> = ({
  detection,
  liveDetection,
  decisions,
  onChange,
}) => {
  if (detection.step2Candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No section folds needed — every section is above the section threshold after Step 1.
      </p>
    );
  }
  // Index live candidates by sec so each card can show its current post-Step-1
  // remaining numbers without re-deriving the list.
  const liveBySec = new Map<string, Step2Candidate>(
    liveDetection.step2Candidates.map(c => [c.sec, c])
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {detection.step2Candidates.map(c => (
        <Step2SectionCard
          key={c.sec}
          candidate={c}
          liveCandidate={liveBySec.get(c.sec)}
          partnerOptions={detection.step2Candidates}
          decision={decisions.step2[c.sec]}
          onChange={d => onChange(c.sec, d)}
        />
      ))}
    </div>
  );
};