import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BuyerInput from '@/components/ui/BuyerInput';
import { useCreateContract } from '@/hooks/useCreateContract';

export default function CreateContract() {
  const {
    // Form state
    form,
    updateForm,
    updateBuyerInput,
    updatePayoutTimestamp,

    // Validation
    errors,

    // Loading state
    isLoading,
    loadingMessage,

    // Helper functions
    getCurrentLocalDatetime,
    getMaxLocalDatetime,
    getRelativeTime,
    timestampToDatetimeLocal,

    // Actions
    submitContract
  } = useCreateContract();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitContract();
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <BuyerInput
          label="Request payment from buyer:"
          value={form.buyerEmail}
          onChange={updateBuyerInput}
          error={errors.buyerEmail}
          placeholder="Search Farcaster user or enter email"
          helpText="You can search for Farcaster users or enter an email address"
        />

        <div>
          <Input
            label="Amount (USDC)"
            type="number"
            step="0.001"
            min="0"
            value={form.amount}
            onChange={(e) => updateForm({ amount: e.target.value })}
            placeholder="100.00"
            error={errors.amount}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">(includes $1 fee, amount must be over $1, or exactly 0.001 for your testing)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payout Date & Time
            <span className="ml-2 text-xs font-normal text-gray-500">
              (Your local time)
            </span>
          </label>
          <input
            type="datetime-local"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={timestampToDatetimeLocal(form.payoutTimestamp)}
            onChange={(e) => updatePayoutTimestamp(e.target.value)}
            min={getCurrentLocalDatetime()}
            max={getMaxLocalDatetime()}
            disabled={isLoading}
          />
          {errors.expiry && <p className="text-sm text-red-600 mt-1">{errors.expiry}</p>}
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">
              Funds will be released at this time (your local timezone)
            </p>
            {form.payoutTimestamp && !errors.expiry && (
              <p className="text-xs font-medium text-primary-600">
                {getRelativeTime(form.payoutTimestamp)}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description ({form.description.length}/160)
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            maxLength={160}
            value={form.description}
            onChange={(e) => updateForm({ description: e.target.value })}
            placeholder="Brief description of the escrow agreement..."
            disabled={isLoading}
          />
          {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-500 hover:bg-primary-600"
        >
          {isLoading ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              {loadingMessage}
            </>
          ) : (
            'Request Payment from Buyer'
          )}
        </Button>
      </form>
    </div>
  );
}