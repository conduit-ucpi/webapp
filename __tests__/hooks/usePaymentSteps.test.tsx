/**
 * TDD spec for usePaymentSteps — the payment-step state + updatePaymentStep
 * logic extracted (identical) from contract-create.tsx and contract-pay.tsx.
 *
 * Behavior locked (the updatePaymentStep algorithm was byte-identical in both):
 *  - holds a PaymentStep[] initialised from the passed-in steps
 *  - updateStep(id, status) sets that step's status; additionally, when marking
 *    a step 'active', every EARLIER step is forced to 'completed'
 *  - setSteps(next) replaces the list (used to reset with page-specific labels)
 *  - getActiveStep() returns the step currently 'active', or undefined
 */

import { renderHook, act } from '@testing-library/react';
import { usePaymentSteps } from '@/hooks/usePaymentSteps';
import type { PaymentStep } from '@/components/contracts/PaymentProgress';

const initial: PaymentStep[] = [
  { id: 'verify', label: 'Verify', status: 'pending' },
  { id: 'transfer', label: 'Transfer', status: 'pending' },
  { id: 'confirm', label: 'Confirm', status: 'pending' },
  { id: 'complete', label: 'Complete', status: 'pending' },
];

describe('usePaymentSteps', () => {
  it('initialises with the provided steps', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    expect(result.current.steps.map((s) => s.id)).toEqual(['verify', 'transfer', 'confirm', 'complete']);
    expect(result.current.steps.every((s) => s.status === 'pending')).toBe(true);
  });

  it('sets a step status directly', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    act(() => result.current.updateStep('verify', 'completed'));
    expect(result.current.steps.find((s) => s.id === 'verify')!.status).toBe('completed');
  });

  it('forces all earlier steps to completed when a later step becomes active', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    // Jump straight to marking 'confirm' active — verify + transfer should auto-complete.
    act(() => result.current.updateStep('confirm', 'active'));
    const byId = Object.fromEntries(result.current.steps.map((s) => [s.id, s.status]));
    expect(byId.verify).toBe('completed');
    expect(byId.transfer).toBe('completed');
    expect(byId.confirm).toBe('active');
    expect(byId.complete).toBe('pending'); // a later step is untouched
  });

  it('does not auto-complete later steps when marking completed/error', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    act(() => result.current.updateStep('transfer', 'error'));
    const byId = Object.fromEntries(result.current.steps.map((s) => [s.id, s.status]));
    expect(byId.verify).toBe('pending'); // not forced, since status is 'error' not 'active'
    expect(byId.transfer).toBe('error');
  });

  it('getActiveStep returns the active step or undefined', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    expect(result.current.getActiveStep()).toBeUndefined();
    act(() => result.current.updateStep('transfer', 'active'));
    expect(result.current.getActiveStep()?.id).toBe('transfer');
  });

  it('setSteps replaces the list (reset with new page-specific labels)', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    const legacySteps: PaymentStep[] = [
      { id: 'verify', label: 'Verify', status: 'pending' },
      { id: 'approve', label: 'Approve USDC', status: 'pending' },
      { id: 'escrow', label: 'Securing funds', status: 'pending' },
    ];
    act(() => result.current.setSteps(legacySteps));
    expect(result.current.steps.map((s) => s.id)).toEqual(['verify', 'approve', 'escrow']);
  });

  it('updateStep and getActiveStep operate on the latest steps after a setSteps reset', () => {
    const { result } = renderHook(() => usePaymentSteps(initial));
    act(() => result.current.setSteps([
      { id: 'verify', label: 'Verify', status: 'pending' },
      { id: 'approve', label: 'Approve', status: 'pending' },
    ]));
    act(() => result.current.updateStep('approve', 'active'));
    expect(result.current.getActiveStep()?.id).toBe('approve');
    expect(result.current.steps.find((s) => s.id === 'verify')!.status).toBe('completed');
  });
});
