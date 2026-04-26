/**
 * CodeCleanupTab — top-level page.
 * Spec: CODE_CLEANUP_TAB_SPEC.md.
 *
 * Reads finalLaborSummary + thresholds from CodeCleanupContext (mounted in
 * Index.tsx). Owns the in-flight PendingDecisions state and orchestrates
 * detection + live recompute + persistence.
 */
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { useCodeCleanup } from '@/contexts/CodeCleanupContext';
import {
  applyPendingDecisions,
  detectCandidates,
  previewDelta,
} from '@/utils/codeCleanupDetector';
import { usePendingDecisions } from './hooks/usePendingDecisions';
import { useApplyDecisions } from './hooks/useApplyDecisions';
import { CodeCleanupHeader } from './CodeCleanupHeader';
import { Step1HeadCards } from './Step1HeadCards';
import { Step2SectionCards } from './Step2SectionCards';
import { Step3RowList } from './Step3RowList';
import { PreviewFooter } from './PreviewFooter';
import { AuditDrawer } from './AuditDrawer';

export const CodeCleanupTab: React.FC = () => {
  const { projectId, pmEmail, finalLaborSummary, thresholds } = useCodeCleanup();
  const pending = usePendingDecisions();
  const apply = useApplyDecisions();
  const [auditOpen, setAuditOpen] = useState(false);

  // Initial detection — what the PM sees before they touch anything.
  const detection = useMemo(
    () => detectCandidates(finalLaborSummary, thresholds),
    [finalLaborSummary, thresholds]
  );

  // Live preview after pending decisions are applied — drives Step 2/3 cards
  // recomputing as Step 1 selections come in, and the footer's delta.
  const livePreview = useMemo(
    () => applyPendingDecisions(finalLaborSummary, pending.decisions),
    [finalLaborSummary, pending.decisions]
  );

  // Step 2 + 3 re-detect against the live preview so cards reflect the
  // post-Step-1 reality (e.g., L2's DRNS vanishes if Step 1 pools DRNS).
  const liveDetection = useMemo(
    () => detectCandidates(livePreview, thresholds),
    [livePreview, thresholds]
  );

  const delta = useMemo(
    () => previewDelta(finalLaborSummary, livePreview, thresholds),
    [finalLaborSummary, livePreview, thresholds]
  );

  if (!projectId || projectId === 'default') {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Load a project to use Code Cleanup.
      </div>
    );
  }

  if (Object.keys(finalLaborSummary).length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Code Cleanup is empty — visit the Budget Builder once to compute the post-merge summary.
      </div>
    );
  }

  const handleApply = () => {
    apply.applyAll(projectId, pmEmail, finalLaborSummary, pending.decisions, () => {
      pending.reset();
    });
  };

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">🧹 Code Cleanup</h2>
          <p className="text-sm text-muted-foreground mt-1">
            One workflow for small-code consolidation. Step 1 first (global decisions enforce
            field consistency), then Step 2 (section folds), then Step 3 (residuals).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAuditOpen(true)}>
          <ClipboardList className="h-4 w-4 mr-1" />
          Audit
        </Button>
      </div>

      <CodeCleanupHeader detection={detection} />

      <section className="space-y-3">
        <SectionTitle index={1} title="Global head decisions" subtitle="One choice per cost head, applied project-wide." />
        <Step1HeadCards
          detection={detection}
          decisions={pending.decisions}
          onChange={pending.setStep1}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle
          index={2}
          title="Section folds"
          subtitle="List is pinned from initial detection; per-card hour previews update as Step 1 selections come in."
        />
        <Step2SectionCards
          detection={detection}
          liveDetection={liveDetection}
          decisions={pending.decisions}
          onChange={pending.setStep2}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle index={3} title="What's left" subtitle="Lines still under floor after Steps 1 + 2." />
        <Step3RowList
          detection={detection}
          decisions={pending.decisions}
          livePreview={livePreview}
          onChange={pending.setStep3}
        />
      </section>

      <PreviewFooter
        beforeLines={delta.beforeLines}
        afterLines={delta.afterLines}
        beforeBelowFloor={delta.beforeBelowFloor}
        afterBelowFloor={delta.afterBelowFloor}
        pendingCount={pending.count}
        isApplying={apply.isApplying}
        onApplyAll={handleApply}
        onReset={pending.reset}
      />

      <AuditDrawer open={auditOpen} onOpenChange={setAuditOpen} projectId={projectId} />
    </div>
  );
};

const SectionTitle: React.FC<{ index: number; title: string; subtitle: string }> = ({
  index,
  title,
  subtitle,
}) => (
  <div>
    <h3 className="text-lg font-semibold flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
        {index}
      </span>
      {title}
    </h3>
    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
);

export default CodeCleanupTab;