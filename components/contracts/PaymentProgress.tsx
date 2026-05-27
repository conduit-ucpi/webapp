import LoadingSpinner from '@/components/ui/LoadingSpinner';

export type PaymentStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
};

interface PaymentProgressProps {
  steps: PaymentStep[];
  loadingMessage: string;
}

/**
 * The payment progress step-list, shared by contract-create and contract-pay.
 * Pure presentation: render each step with a status-appropriate icon + text
 * color, and show the loading message when present. The caller decides WHETHER
 * to render this (it gates on its own in-progress flag) and owns the step state.
 *
 * Extracted verbatim — the markup was byte-for-byte identical in both pages.
 */
export default function PaymentProgress({ steps, loadingMessage }: PaymentProgressProps) {
  return (
    <div className="mb-6 p-4 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
      <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-200 mb-3">Payment Progress</h3>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              {step.status === 'completed' ? (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : step.status === 'active' ? (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <LoadingSpinner className="w-3 h-3 text-white" />
                </div>
              ) : step.status === 'error' ? (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 bg-secondary-300 dark:bg-secondary-600 rounded-full"></div>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm ${
                step.status === 'completed' ? 'text-green-700 dark:text-green-400' :
                step.status === 'active' ? 'text-blue-700 dark:text-blue-400 font-medium' :
                step.status === 'error' ? 'text-red-700 dark:text-red-400' :
                'text-secondary-500 dark:text-secondary-400'
              }`}>
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
      {loadingMessage && (
        <p className="mt-3 text-sm text-secondary-600 dark:text-secondary-300 italic whitespace-pre-line">{loadingMessage}</p>
      )}
    </div>
  );
}
