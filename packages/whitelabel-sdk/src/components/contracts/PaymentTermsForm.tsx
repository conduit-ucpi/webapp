/**
 * "Request a Payment" form - step 2 of the create sequence.
 *
 * Presentation only: validation and submission stay in CreateContractWizard.
 * Everything here is composed from existing pieces rather than reimplemented:
 *   - CurrencyAmountInput (layout="split")  dual amount + live exchange rate
 *   - AmountGuidance                        live fee / minimum / free test
 *   - ReleaseDateField                      payout date, timezone handling
 *   - AdvancedOptions                       collapsed arbiter override
 */

import CurrencyAmountInput from '@/components/ui/CurrencyAmountInput';
import AmountGuidance from '@/components/contracts/AmountGuidance';
import ReleaseDateField from '@/components/contracts/ReleaseDateField';
import AdvancedOptions from '@/components/contracts/AdvancedOptions';
import { TEST_AMOUNT } from '@/utils/escrowFees';
import { useT } from '../../i18n';

interface PaymentTermsFormProps {
  amount: string;
  onAmountChange: (value: string) => void;
  payoutTimestamp: number;
  onPayoutTimestampChange: (timestamp: number) => void;
  /** Release on payment rather than at a date - maps to a zero expiry on-chain */
  instantPayment?: boolean;
  onInstantPaymentChange?: (instant: boolean) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  /** Omit both to hide the arbiter override, for flows that do not take one (/pay). */
  arbiterAddress?: string;
  onArbiterChange?: (value: string) => void;
  /**
   * The fee and "you receive" guidance under the amount — the SELLER's view. Off where the
   * person filling this in is the payer and the fee is quoted separately (/pay).
   */
  showFeeGuidance?: boolean;
  /** Headings over the two amount fields; the seller's wording when omitted. */
  amountLabels?: { requested: string; receiving: string };
  errors: {
    amount?: string;
    expiry?: string;
    description?: string;
    arbiterAddress?: string;
  };
  tokenSymbol: string;
  tokenOptions?: string[];
  onTokenChange?: (symbol: string) => void;
  /** e.g. "Base network" */
  networkLabel?: string;
  /** e.g. "Balance: 342.10 USDC" - omitted while loading */
  balanceText?: string;
}

const DESCRIPTION_MAX = 160;

export default function PaymentTermsForm({
  amount,
  onAmountChange,
  payoutTimestamp,
  onPayoutTimestampChange,
  instantPayment,
  onInstantPaymentChange,
  description,
  onDescriptionChange,
  arbiterAddress,
  onArbiterChange,
  showFeeGuidance = true,
  amountLabels,
  errors,
  tokenSymbol,
  tokenOptions,
  onTokenChange,
  networkLabel,
  balanceText,
}: PaymentTermsFormProps) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 sm:p-6 space-y-6">
      {/* Grouped so the parent's space-y-6 treats input and guidance as one
          block — the note has to read as part of the field, not a sibling. */}
      <div>
        <CurrencyAmountInput
          layout="split"
          value={amount}
          onChange={onAmountChange}
          tokenSymbol={tokenSymbol}
          tokenOptions={tokenOptions}
          onTokenChange={onTokenChange}
          networkLabel={networkLabel}
          balanceText={balanceText}
          splitLabels={amountLabels}
          error={errors.amount}
        />

        {showFeeGuidance && (
          <AmountGuidance
            amount={amount}
            tokenSymbol={tokenSymbol}
            onUseTestAmount={() => onAmountChange(String(TEST_AMOUNT))}
          />
        )}
      </div>

      <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4">
        <ReleaseDateField
          value={payoutTimestamp}
          onChange={onPayoutTimestampChange}
          instant={instantPayment}
          onInstantChange={onInstantPaymentChange}
          error={errors.expiry}
        />
      </div>

      <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="payment-description"
            className="block text-sm font-medium text-secondary-700 dark:text-secondary-200"
          >
            {t('terms.description')}
          </label>
          <span className="text-xs text-secondary-400 dark:text-secondary-500">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
        <input
          id="payment-description"
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          placeholder={t('terms.descriptionPlaceholder')}
          className="mt-2 w-full rounded-lg border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 px-3 py-2.5 text-sm text-secondary-900 dark:text-white placeholder:text-secondary-400 dark:placeholder:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.description}</p>
        )}
      </div>

      {onArbiterChange && (
        <AdvancedOptions
          arbiterAddress={arbiterAddress ?? ''}
          onArbiterChange={onArbiterChange}
          arbiterError={errors.arbiterAddress}
        />
      )}
    </div>
  );
}
