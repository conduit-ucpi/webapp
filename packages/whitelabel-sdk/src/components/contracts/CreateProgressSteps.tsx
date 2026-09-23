/**
 * The three-step journey indicator, shared by both sides of a payment request:
 * the seller's create journey (Connect -> Payment Terms -> Complete & Send) and
 * the buyer's pay journey (Add Funds -> Confirm & Send -> Complete Payment).
 *
 * The seller's journey spans TWO components - the signed-out gate on /create and
 * the wizard that renders once connected - so the indicator lives here and both
 * use it. Pass `steps` to switch journeys. It is deliberately separate from the
 * Wizard component's own progress bar, which tracks the wizard's internal steps
 * rather than the whole journey.
 */
import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';

export interface JourneyStep {
  // Catalogue keys rather than sentences: these are module constants, so they
  // cannot call a hook. The component translates them at render time, which is
  // also the only point at which the locale is known.
  titleKey: MessageKey;
  detailKey: MessageKey;
}

export const CREATE_JOURNEY_STEPS: JourneyStep[] = [
  { titleKey: 'steps.connect.title', detailKey: 'steps.connect.detail' },
  { titleKey: 'steps.terms.title', detailKey: 'steps.terms.detail' },
  { titleKey: 'steps.complete.title', detailKey: 'steps.complete.detail' },
];

/** The buyer's side of the same journey, used by contract-pay. */
export const PAY_JOURNEY_STEPS: JourneyStep[] = [
  { titleKey: 'steps.addFunds.title', detailKey: 'steps.addFunds.detail' },
  { titleKey: 'steps.confirmSend.title', detailKey: 'steps.confirmSend.detail' },
  { titleKey: 'steps.completePayment.title', detailKey: 'steps.completePayment.detail' },
];

interface CreateProgressStepsProps {
  /** Index of the active step; earlier steps render as complete. */
  current: number;
  className?: string;
  /** Which journey to render. Defaults to the seller's create journey. */
  steps?: JourneyStep[];
}

export default function CreateProgressSteps({
  current,
  className = 'mb-14',
  steps = CREATE_JOURNEY_STEPS,
}: CreateProgressStepsProps) {
  const t = useT();

  return (
    <ol className={`flex items-start justify-center gap-4 sm:gap-10 ${className}`}>
      {steps.map((step, i) => {
        const isComplete = i < current;
        const isActive = i === current;

        return (
          <li key={step.titleKey} className="flex-1 max-w-[15rem] text-center">
            <div className="flex items-center">
              <div
                className="flex-1 h-px bg-secondary-200 dark:bg-secondary-700"
                aria-hidden="true"
                style={{ visibility: i === 0 ? 'hidden' : undefined }}
              />
              <span
                className={`shrink-0 w-9 h-9 rounded-full grid place-items-center text-sm font-semibold ${
                  isComplete || isActive
                    ? 'bg-secondary-900 text-white dark:bg-white dark:text-secondary-900'
                    : 'bg-secondary-200 text-secondary-500 dark:bg-secondary-700 dark:text-secondary-400'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
                <span className="sr-only">{isComplete ? 'completed' : ''}</span>
              </span>
              <div
                className="flex-1 h-px bg-secondary-200 dark:bg-secondary-700"
                aria-hidden="true"
                style={{ visibility: i === steps.length - 1 ? 'hidden' : undefined }}
              />
            </div>
            <p
              className={`mt-3 text-sm font-semibold ${
                isActive || isComplete
                  ? 'text-secondary-900 dark:text-white'
                  : 'text-secondary-500 dark:text-secondary-400'
              }`}
            >
              {t(step.titleKey)}
            </p>
            <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 leading-snug">
              {t(step.detailKey)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
