/**
 * usePendingDecisions — local state for the Code Cleanup tab.
 *
 * Holds Step 1/2/3 selections in memory. Save Draft + Apply All are owned by
 * useApplyDecisions. This hook is the in-flight view; persistence happens
 * downstream.
 */
import { useCallback, useState } from 'react';
import {
  EMPTY_PENDING,
  type PendingDecisions,
  type Step1Decision,
  type Step2Decision,
  type Step3Decision,
} from '@/utils/codeCleanupDetector';

export interface PendingDecisionsApi {
  decisions: PendingDecisions;
  setStep1: (head: string, decision: Step1Decision | null) => void;
  setStep2: (sec: string, decision: Step2Decision | null) => void;
  setStep3: (key: string, decision: Step3Decision | null) => void;
  reset: () => void;
  count: number;
}

export function usePendingDecisions(): PendingDecisionsApi {
  const [decisions, setDecisions] = useState<PendingDecisions>(EMPTY_PENDING);

  const setStep1 = useCallback((head: string, decision: Step1Decision | null) => {
    setDecisions(prev => {
      const next = { ...prev.step1 };
      if (decision === null) delete next[head];
      else next[head] = decision;
      return { ...prev, step1: next };
    });
  }, []);

  const setStep2 = useCallback((sec: string, decision: Step2Decision | null) => {
    setDecisions(prev => {
      const next = { ...prev.step2 };
      if (decision === null) delete next[sec];
      else next[sec] = decision;
      return { ...prev, step2: next };
    });
  }, []);

  const setStep3 = useCallback((key: string, decision: Step3Decision | null) => {
    setDecisions(prev => {
      const next = { ...prev.step3 };
      if (decision === null) delete next[key];
      else next[key] = decision;
      return { ...prev, step3: next };
    });
  }, []);

  const reset = useCallback(() => setDecisions(EMPTY_PENDING), []);

  const count =
    Object.keys(decisions.step1).length +
    Object.keys(decisions.step2).length +
    Object.keys(decisions.step3).length;

  return { decisions, setStep1, setStep2, setStep3, reset, count };
}