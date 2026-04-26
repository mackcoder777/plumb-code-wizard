import React from 'react';
import { Step3Row } from './Step3Row';
import type { DetectionResult, FinalLaborSummary, PendingDecisions, Step3Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  /**
   * Live detection — used for the per-row inline numbers (e.g., section
   * totals, peer hours after Step 1/2). The rendered LIST itself is pinned
   * against `detection` so a row never vanishes mid-edit when the PM commits
   * a Step 3 reroute/custom/redistribute on it (those decisions move hours
   * out of livePreview, which would otherwise drop the row from
   * `liveDetection.step3Candidates` while the PM is still working).
   */
  liveDetection: DetectionResult;
  decisions: PendingDecisions;
  livePreview: FinalLaborSummary;
  /** Heads the PM has committed in Step 1 — those rows belong upstream now. */
  committedStep1Heads: Set<string>;
  /** Sections committed in Step 2 (fold/combine) — same reason. */
  committedStep2Sections: Set<string>;
  onChange: (key: string, decision: Step3Decision | null) => void;
}

export const Step3RowList: React.FC<Props> = ({
  detection,
  liveDetection,
  decisions,
  livePreview,
  committedStep1Heads,
  committedStep2Sections,
  onChange,
}) => {
  // Pin the visible list against the initial detection so a Step 3 reroute /
  // custom / redistribute commit on a row doesn't immediately drop the row
  // from the list (applyPendingDecisions moves the source key out of
  // livePreview, which would remove it from liveDetection.step3Candidates).
  // Upstream Step 1/2 commits still hide rows correctly via the committed
  // sets — those are explicit promotions to a higher step, not mid-edit.
  const visible = detection.step3Candidates.filter(
    c => !committedStep1Heads.has(c.head) && !committedStep2Sections.has(c.sec)
  );
  // liveDetection is still consulted (per-row peer numbers come via
  // livePreview); reference it so the prop isn't dead.
  void liveDetection;
  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No residual lines below the floor — Steps 1 and 2 cleared everything.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {visible.map(c => (
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