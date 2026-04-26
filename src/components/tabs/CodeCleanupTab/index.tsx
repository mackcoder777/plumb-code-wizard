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
import { useHydratedDecisions } from './hooks/useHydratedDecisions';
import { CodeCleanupHeader } from './CodeCleanupHeader';
import { Step1HeadCards } from './Step1HeadCards';
import { Step2SectionCards } from './Step2SectionCards';
import { Step3RowList } from './Step3RowList';
import { PreviewFooter } from './PreviewFooter';
import { AuditDrawer } from './AuditDrawer';

export const CodeCleanupTab: React.FC = () => {
  const { projectId, pmEmail, finalLaborSummary, thresholds } = useCodeCleanup();
  const [auditOpen, setAuditOpen] = useState(false);

  // Initial detection — what the PM sees before they touch anything.
  const detection = useMemo(
    () => detectCandidates(finalLaborSummary, thresholds),
    [finalLaborSummary, thresholds]
  );

  // Hydrate from DB so committed Step 1 / Step 2 decisions survive Apply All.
  // Without this, pending.reset() after a successful write leaves the
  // detector in pessimistic mode and the PM plays whack-a-mole as Step 2
  // candidates re-surface and Step 3 rows blink in/out.
  const hydrated = useHydratedDecisions(projectId, detection);
  const pending = usePendingDecisions({
    initialDecisions: hydrated.decisions,
    hydrationKey: hydrated.hydrationKey,
  });
  const apply = useApplyDecisions();

  // Live preview after pending decisions are applied — drives Step 2/3 cards
  // recomputing as Step 1 selections come in, and the footer's delta.
  const livePreview = useMemo(
    () => applyPendingDecisions(finalLaborSummary, pending.decisions),
    [finalLaborSummary, pending.decisions]
  );

  // Heads the PM has *committed* to global movement. `keep_distributed` is
  // explicitly excluded — those heads stay distributed and their small
  // instances should reappear in Step 3 for per-instance handling.
  const committedStep1Heads = useMemo(() => {
    const set = new Set<string>();
    for (const [head, decision] of Object.entries(pending.decisions.step1)) {
      if (decision.kind !== 'keep_distributed') set.add(head);
    }
    return set;
  }, [pending.decisions.step1]);

  // Sections the PM has *committed* to fold/combine in Step 2. Includes the
  // partner section on `combine` decisions so both sides drop out of Step 3
  // (matches applyPendingDecisions, which moves both sources to the target).
  // Symmetric to committedStep1Heads — without this, Step 3 pessimistically
  // hides every Step 2 *candidate* section's small lines, even ones the PM
  // hasn't decided on (e.g., 1M, 2M leaking SNWV instances).
  const committedStep2Sections = useMemo(() => {
    const set = new Set<string>();
    for (const [sec, decision] of Object.entries(pending.decisions.step2)) {
      if (decision.kind === 'fold' || decision.kind === 'combine') {
        set.add(sec);
        if (decision.kind === 'combine' && decision.combineWithSec) {
          set.add(decision.combineWithSec);
        }
      }
    }
    return set;
  }, [pending.decisions.step2]);

  // Step 2 + 3 re-detect against the live preview so cards reflect the
  // post-Step-1 reality (e.g., L2's DRNS vanishes if Step 1 pools DRNS).
  const liveDetection = useMemo(
    () => detectCandidates(livePreview, thresholds, {
      committedStep1Heads,
      committedStep2Sections,
    }),
    [livePreview, thresholds, committedStep1Heads, committedStep2Sections]
  );

  const delta = useMemo(
    () => previewDelta(finalLaborSummary, livePreview, thresholds),
    [finalLaborSummary, livePreview, thresholds]
  );

  // Project-wide list of cost heads — used by Step 1 Reroute dropdown so the PM
  // picks from real heads in the project instead of typing free-form.
  const projectHeads = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(finalLaborSummary || {})) {
      const parts = k.trim().split(/\s+/);
      if (parts.length >= 3) set.add(parts.slice(2).join(' '));
    }
    return Array.from(set).sort();
  }, [finalLaborSummary]);

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
    if (!hydrated.isReady) return; // double safety against race on first paint
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

      {!hydrated.isReady && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Loading saved decisions…
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle index={1} title="Global head decisions" subtitle="One choice per cost head, applied project-wide." />
        <Step1HeadCards
          detection={detection}
          decisions={pending.decisions}
          onChange={pending.setStep1}
          projectHeads={projectHeads}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle
          index={2}
          title="Section folds"
          subtitle="Per-card hour previews and remaining heads update as Step 1 selections come in."
        />
        <Step2SectionCards
          detection={detection}
          liveDetection={liveDetection}
          decisions={pending.decisions}
          onChange={pending.setStep2}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle
          index={3}
          title="What's left"
          subtitle="Lines still under floor after Steps 1 + 2. List re-evaluates after each Apply — expect new rows to surface as upstream sections are cleaned up."
        />
        <Step3RowList
          detection={detection}
          liveDetection={liveDetection}
          decisions={pending.decisions}
          livePreview={livePreview}
          committedStep1Heads={committedStep1Heads}
          committedStep2Sections={committedStep2Sections}
          onChange={pending.setStep3}
        />
      </section>

      <PreviewFooter
        beforeLines={delta.beforeLines}
        afterLines={delta.afterLines}
        beforeBelowFloor={delta.beforeBelowFloor}
        afterBelowFloor={delta.afterBelowFloor}
        pendingCount={pending.count}
        isApplying={apply.isApplying || !hydrated.isReady}
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