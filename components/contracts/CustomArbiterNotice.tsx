import { formatWalletAddress } from '@/utils/address';

interface CustomArbiterNoticeProps {
  arbiterAddress?: string | null;
}

/**
 * Warning banner shown on the buyer payment page when the pending contract
 * has a custom (non-default) arbiter address configured by the seller.
 *
 * Renders nothing when no arbiter address is present.
 *
 * Styling mirrors the existing yellow notice pattern on /contract-pay
 * (bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200
 * dark:border-yellow-800).
 */
export default function CustomArbiterNotice({ arbiterAddress }: CustomArbiterNoticeProps) {
  // Only render when a non-empty arbiter address is set. Presence of the
  // field means the seller chose a non-default resolver — we don't need to
  // compare against a default.
  if (!arbiterAddress || arbiterAddress.trim() === '') {
    return null;
  }

  return (
    <div
      data-testid="custom-arbiter-notice"
      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6"
    >
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
        Custom dispute resolver
      </p>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
        This contract uses a non-standard arbiter chosen by the seller. If a dispute arises, they — not the Conduit default — will decide the outcome. Verify you trust this arbiter before paying.
      </p>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-2">
        Arbiter:{' '}
        <span
          className="font-mono"
          data-testid="custom-arbiter-address"
          title={arbiterAddress}
        >
          {formatWalletAddress(arbiterAddress)}
        </span>
      </p>
    </div>
  );
}
