import { EscrowSettlementState } from '@/lib/rpc/RpcClient';
import { displayCurrency } from '@/utils/validation';

interface StandingFiguresPanelProps {
  state: EscrowSettlementState | null;
  loading: boolean;
  /** Escrow amount in microUSDC, for showing what each figure actually pays. */
  amount: number;
  tokenSymbol: string;
  /** The connected wallet, so the user's own figure can be labelled as theirs. */
  walletAddress?: string;
}

interface Figure {
  role: string;
  address: string | null;
  percent: number | null;
  isYou: boolean;
}

/**
 * The settlement figures currently standing on-chain (MARKETPLACE_OPENSPEC §15.1, §15.6b).
 *
 * ⚠️ THIS PANEL IS A SAFETY OBLIGATION, NOT DECORATION. The escrow settles the instant any two
 *    of the three current figures match, and the contract cannot tell a proposal from an
 *    acceptance — so the numbers shown here are the numbers that end the dispute if a user
 *    submits one of them. A user who cannot see the other side's standing figure cannot know
 *    which number is an offer and which is a settlement.
 *
 * Note "any two of three": once an arbiter is seated, matching the ARBITER's figure settles the
 * dispute without the other party's assent. That is not a footnote — it is often the fastest way
 * out of a dispute, and it is invisible unless the arbiter's figure is on screen.
 */
export default function StandingFiguresPanel({
  state,
  loading,
  amount,
  tokenSymbol,
  walletAddress
}: StandingFiguresPanelProps) {
  if (loading && !state) {
    return (
      <div className="text-sm text-gray-500 dark:text-secondary-400">
        Reading the current figures from the chain…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="text-sm text-gray-500 dark:text-secondary-400">
        The standing figures could not be read from the chain. Submitting is still safe — the
        contract checks for a match itself — but you cannot see what the other party is holding.
      </div>
    );
  }

  if (state.resolvedBuyerPercentage !== null) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
        <div className="font-medium text-green-800 dark:text-green-200">
          This dispute has settled at {state.resolvedBuyerPercentage}% to the buyer
        </div>
        <div className="text-sm text-green-700 dark:text-green-300 mt-1">
          Two figures matched and the funds moved in that same transaction. Nothing further is
          needed, and nothing here can be changed.
        </div>
      </div>
    );
  }

  const isYou = (address: string | null) =>
    !!address && !!walletAddress && address.toLowerCase() === walletAddress.toLowerCase();

  const figures: Figure[] = [
    { role: 'Buyer', address: state.buyer, percent: state.buyerVote, isYou: isYou(state.buyer) },
    { role: 'Recipient', address: state.recipient, percent: state.recipientVote, isYou: isYou(state.recipient) },
    ...(state.arbiter
      ? [{ role: 'Arbiter', address: state.arbiter, percent: state.arbiterVote, isYou: isYou(state.arbiter) }]
      : [])
  ];

  const standing = figures.filter((f) => f.percent !== null);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-secondary-700 p-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-1">Figures standing on-chain</h4>
      <p className="text-sm text-gray-600 dark:text-secondary-300 mb-3">
        Any two of these matching settles the dispute immediately. Submitting a figure that equals
        one below pays the escrow out in that transaction.
      </p>

      {standing.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-secondary-400">
          Nobody has submitted a figure yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {figures.map((figure) => (
            <li
              key={figure.role}
              className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-secondary-800 last:border-b-0 pb-2 last:pb-0"
            >
              <span className="text-gray-700 dark:text-secondary-200">
                {figure.role}
                {figure.isYou && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-secondary-400">(you)</span>
                )}
              </span>
              {figure.percent === null ? (
                <span className="text-gray-400 dark:text-secondary-500">No figure submitted</span>
              ) : (
                <span className="font-medium text-gray-900 dark:text-white">
                  {figure.percent}% to buyer
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-secondary-400">
                    ({displayCurrency((amount * figure.percent) / 100, 'microUSDC')} {tokenSymbol})
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!state.arbiter && (
        <p className="text-xs text-gray-500 dark:text-secondary-400 mt-3">
          No arbiter is seated, so only the buyer and recipient can settle this between them.
        </p>
      )}
    </div>
  );
}
