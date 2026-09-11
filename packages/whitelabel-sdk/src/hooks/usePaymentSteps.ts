import { useState, useCallback, useRef } from 'react';
import type { PaymentStep } from '@/components/contracts/PaymentProgress';

interface UsePaymentStepsResult {
  steps: PaymentStep[];
  /**
   * Set a step's status. When marking a step 'active', all EARLIER steps are
   * forced to 'completed' (so jumping ahead leaves no gaps). Extracted verbatim
   * from the identical updatePaymentStep in both payment pages.
   */
  updateStep: (stepId: string, status: 'active' | 'completed' | 'error') => void;
  /** Replace the whole list — used to reset with page-specific step labels. */
  setSteps: (next: PaymentStep[]) => void;
  /** The step currently 'active', or undefined. Reads the latest state. */
  getActiveStep: () => PaymentStep | undefined;
}

/**
 * Owns the payment-step list and its update algorithm, shared by contract-create
 * and contract-pay. The initial steps (and the labels used on reset) are
 * page-specific and passed in; the update logic is shared.
 *
 * getActiveStep reads through a ref so it returns the freshest steps even when
 * called from within an async payment flow (the orchestration hook uses it to
 * mark the active step errored on failure).
 */
export function usePaymentSteps(initialSteps: PaymentStep[]): UsePaymentStepsResult {
  const [steps, setStepsState] = useState<PaymentStep[]>(initialSteps);
  const stepsRef = useRef<PaymentStep[]>(initialSteps);
  stepsRef.current = steps;

  const setSteps = useCallback((next: PaymentStep[]) => {
    stepsRef.current = next;
    setStepsState(next);
  }, []);

  const updateStep = useCallback((stepId: string, status: 'active' | 'completed' | 'error') => {
    setStepsState((prev) => {
      const next = prev.map((step) => {
        if (step.id === stepId) {
          return { ...step, status };
        }
        // When marking a step active, ensure all previous steps are completed.
        if (status === 'active') {
          const currentIndex = prev.findIndex((s) => s.id === stepId);
          const stepIndex = prev.findIndex((s) => s.id === step.id);
          if (stepIndex < currentIndex) {
            return { ...step, status: 'completed' as const };
          }
        }
        return step;
      });
      stepsRef.current = next;
      return next;
    });
  }, []);

  const getActiveStep = useCallback(
    () => stepsRef.current.find((s) => s.status === 'active'),
    []
  );

  return { steps, updateStep, setSteps, getActiveStep };
}
