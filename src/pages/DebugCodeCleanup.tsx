/**
 * /debug/code-cleanup — DEV-only verification page for the Code Cleanup detector.
 * Spec: CODE_CLEANUP_TAB_SPEC.md §12 Phase 1 risk gate.
 *
 * Reads finalLaborSummary published to window.__codeCleanupDebug by
 * BudgetAdjustmentsPanel (DEV-only effect), runs detectCandidates, dumps JSON.
 *
 * Workflow: open the project in another tab so the panel mounts and publishes
 * its data, then open this page in a new tab. Refresh to re-read.
 *
 * Stripped from production builds — App.tsx gates the route on import.meta.env.DEV.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  detectCandidates,
  type CleanupThresholds,
  type FinalLaborSummary,
} from "@/utils/codeCleanupDetector";

interface DebugWindowPayload {
  projectId: string | null;
  finalLaborSummary: FinalLaborSummary;
  adjustedLaborSummary: FinalLaborSummary;
  timestamp: number;
}

const DEFAULT_THRESHOLDS: CleanupThresholds = {
  lineFloor: 12,
  sectionThreshold: 80,
};

const DebugCodeCleanup: React.FC = () => {
  const [payload, setPayload] = useState<DebugWindowPayload | null>(null);
  const [thresholds, setThresholds] = useState<CleanupThresholds>(DEFAULT_THRESHOLDS);
  const [tick, setTick] = useState(0);

  // Pick up whatever the panel last published. Re-read on every focus.
  useEffect(() => {
    const read = () => {
      const w = (window as any).__codeCleanupDebug;
      setPayload(w ?? null);
    };
    read();
    const onFocus = () => read();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [tick]);

  const result = useMemo(() => {
    if (!payload?.finalLaborSummary) return null;
    return detectCandidates(payload.finalLaborSummary, thresholds);
  }, [payload, thresholds]);

  if (!payload) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Code Cleanup Detector — DEV</h1>
          <Link to="/" className="text-sm underline text-muted-foreground">
            ← Back to app
          </Link>
        </header>
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">No project data published yet.</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the app in another tab (<Link to="/" className="underline">/</Link>).</li>
            <li>Load a project (e.g. Pasadena).</li>
            <li>
              Wait for the Budget Adjustments panel to mount — it publishes
              <code className="mx-1 rounded bg-muted px-1">window.__codeCleanupDebug</code>
              on every recompute.
            </li>
            <li>Return here and click Refresh.</li>
          </ol>
          <button
            type="button"
            className="mt-2 rounded bg-primary px-3 py-1 text-primary-foreground text-sm"
            onClick={() => setTick(t => t + 1)}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Code Cleanup Detector — DEV</h1>
          <p className="text-sm text-muted-foreground">
            Project: <code>{payload.projectId ?? "(none)"}</code> · Last
            published {new Date(payload.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => setTick(t => t + 1)}
          >
            Refresh
          </button>
          <Link to="/" className="text-sm underline text-muted-foreground">
            ← Back to app
          </Link>
        </div>
      </header>

      <section className="rounded-md border p-4 space-y-3">
        <h2 className="font-semibold">Thresholds (spec §4.4 / §7.2)</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            Line floor (h):
            <input
              type="number"
              className="w-20 rounded border px-2 py-1"
              value={thresholds.lineFloor}
              onChange={e =>
                setThresholds(t => ({ ...t, lineFloor: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex items-center gap-2">
            Section threshold (h):
            <input
              type="number"
              className="w-24 rounded border px-2 py-1"
              value={thresholds.sectionThreshold}
              onChange={e =>
                setThresholds(t => ({ ...t, sectionThreshold: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>
      </section>

      {result && (
        <>
          <section className="rounded-md border p-4 space-y-2">
            <h2 className="font-semibold">Meta</h2>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded">
              {JSON.stringify(result.meta, null, 2)}
            </pre>
          </section>

          <section className="rounded-md border p-4 space-y-2">
            <h2 className="font-semibold">
              Step 1 — Global head decisions ({result.step1Candidates.length})
            </h2>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded max-h-[480px] overflow-auto">
              {JSON.stringify(result.step1Candidates, null, 2)}
            </pre>
          </section>

          <section className="rounded-md border p-4 space-y-2">
            <h2 className="font-semibold">
              Step 2 — Section folds ({result.step2Candidates.length})
            </h2>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded max-h-[480px] overflow-auto">
              {JSON.stringify(result.step2Candidates, null, 2)}
            </pre>
          </section>

          <section className="rounded-md border p-4 space-y-2">
            <h2 className="font-semibold">
              Step 3 — What's left ({result.step3Candidates.length})
            </h2>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-3 rounded max-h-[480px] overflow-auto">
              {JSON.stringify(result.step3Candidates, null, 2)}
            </pre>
          </section>
        </>
      )}
    </div>
  );
};

export default DebugCodeCleanup;