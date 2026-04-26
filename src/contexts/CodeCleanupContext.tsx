/**
 * CodeCleanupContext — shared state for the Code Cleanup tab.
 *
 * Replaces the temporary Phase 1 `window.__codeCleanupDebug` publish path.
 * The provider mounts once in Index.tsx and exposes:
 *
 *   - finalLaborSummary (post-merge, same source as the export pipeline —
 *     comes from BudgetAdjustments.adjustedLaborSummary; the field name is
 *     legacy, the runtime value is the final summary)
 *   - thresholds (lineFloor / sectionThreshold) backed by the existing
 *     consolidation_thresholds DB setting; mutating these is the single
 *     knob shared with Code Health
 *   - projectId for downstream persistence calls
 *   - pmEmail captured at apply-time for the audit columns
 */
import React, { createContext, useContext, useMemo } from 'react';
import type { FinalLaborSummary, CleanupThresholds } from '@/utils/codeCleanupDetector';

export interface CodeCleanupContextValue {
  projectId: string | null;
  pmEmail: string | null;
  finalLaborSummary: FinalLaborSummary;
  thresholds: CleanupThresholds;
  setThresholds: (next: CleanupThresholds) => void;
}

const CodeCleanupCtx = createContext<CodeCleanupContextValue | null>(null);

export interface CodeCleanupProviderProps {
  projectId: string | null;
  pmEmail: string | null;
  finalLaborSummary: FinalLaborSummary;
  thresholds: CleanupThresholds;
  setThresholds: (next: CleanupThresholds) => void;
  children: React.ReactNode;
}

export const CodeCleanupProvider: React.FC<CodeCleanupProviderProps> = ({
  projectId,
  pmEmail,
  finalLaborSummary,
  thresholds,
  setThresholds,
  children,
}) => {
  const value = useMemo<CodeCleanupContextValue>(
    () => ({ projectId, pmEmail, finalLaborSummary, thresholds, setThresholds }),
    [projectId, pmEmail, finalLaborSummary, thresholds, setThresholds]
  );
  return <CodeCleanupCtx.Provider value={value}>{children}</CodeCleanupCtx.Provider>;
};

export function useCodeCleanup(): CodeCleanupContextValue {
  const ctx = useContext(CodeCleanupCtx);
  if (!ctx) {
    throw new Error('useCodeCleanup must be used inside <CodeCleanupProvider>');
  }
  return ctx;
}