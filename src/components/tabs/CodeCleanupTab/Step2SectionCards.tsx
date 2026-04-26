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
  // Partner dropdown source: prefer live numbers for every pinned candidate so
  // the "(Nh)" hours next to each option reflect post-Step-1 reality. Falls
  // back to the pinned candidate if a section dropped below threshold in the
  // live recompute (still a valid partner — PM may want to combine into it).
  const partnerPool: Step2Candidate[] = detection.step2Candidates.map(
    c => liveBySec.get(c.sec) ?? c
  );
  // A combine decision on owner sec X claims partner sec Y. The partner card
  // must disappear from the list while the combine is active so the PM can't
  // commit a contradictory independent decision on it.
  const claimedBy = new Map<string, string>();
  for (const [ownerSec, decision] of Object.entries(decisions.step2)) {
    if (decision?.kind === 'combine' && decision.combineWithSec) {
      claimedBy.set(decision.combineWithSec, ownerSec);
    }
  }
  const visibleCandidates = detection.step2Candidates.filter(
    c => !claimedBy.has(c.sec)
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {visibleCandidates.map(c => {
        // Reuse the same claimedBy map: hide partners already claimed by
        // another owner, but always allow the current card's own claimed
        // partner to remain selectable in its own dropdown.
        const partnerOptionsForCard = partnerPool.filter(p => {
          if (p.sec === c.sec) return false;
          const claimer = claimedBy.get(p.sec);
          return !claimer || claimer === c.sec;
        });
        return (
          <Step2SectionCard
            key={c.sec}
            candidate={c}
            liveCandidate={liveBySec.get(c.sec)}
            partnerOptions={partnerOptionsForCard}
            decision={decisions.step2[c.sec]}
            onChange={d => onChange(c.sec, d)}
          />
        );
      })}
    </div>
  );
};