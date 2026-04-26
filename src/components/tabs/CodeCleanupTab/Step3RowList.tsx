import React from 'react';
import { Step3Row } from './Step3Row';
import type { DetectionResult, FinalLaborSummary, PendingDecisions, Step3Decision } from '@/utils/codeCleanupDetector';

interface Props {
  detection: DetectionResult;
  /**
   * Live detection — primary source of truth for the visible Step 3 list.
   * The detector already excludes only COMMITTED Step 1 heads / Step 2
   * sections, so heads the PM set to keep_distributed correctly surface
   * their small instances here. We union-merge with `detection` only as a
   * mid-edit fallback (see `visible` computation below).
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
  // Primary source: liveDetection. The detector at codeCleanupDetector.ts
  // (lines ~487–488) excludes only COMMITTED Step 1 heads / Step 2 sections,
  // so a head set to keep_distributed correctly resurfaces its small
  // instances in liveDetection.step3Candidates. Reading from `detection`
  // (initial pessimistic) was the prior bug — it dropped every Step 1
  // candidate's small lines whether the PM committed them or not.
  const byKey = new Map(liveDetection.step3Candidates.map(c => [c.key, c]));

  // Mid-edit fallback: when the PM commits a Step 3 reroute / custom /
  // redistribute, applyPendingDecisions moves hours out of livePreview, so
  // the candidate disappears from liveDetection.step3Candidates. Re-add
  // those rows from the original `detection` snapshot so they don't vanish
  // while the PM is still editing them.
  for (const key of Object.keys(decisions.step3)) {
    if (decisions.step3[key] && !byKey.has(key)) {
      const original = detection.step3Candidates.find(c => c.key === key);
      if (original) byKey.set(key, original);
    }
  }

  // Defensive filter (liveDetection already excludes these; a re-added
  // pinned row needs the same gate) + deterministic sort matching the
  // detector's own `step3Candidates.sort((a, b) => a.hours - b.hours)`.
  const visible = Array.from(byKey.values())
    .filter(c => !committedStep1Heads.has(c.head) && !committedStep2Sections.has(c.sec))
    .sort((a, b) => a.hours - b.hours);
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