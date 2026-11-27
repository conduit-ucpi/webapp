import { apiFetch } from '@/lib/apiFetch';
import { useCallback } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI, ESCROW_CONTRACT_ABI, OFFER_VAULT_ABI, EstimationRevertedError } from '@/lib/web3';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import type { CreateOfferResponse } from '@/types/marketplace';
import { isSignedAction, sendSignedAction } from '@/lib/signedActions';

/**
 * Every on-chain action the dispute, arbiter and marketplace screens take
 * (MARKETPLACE_OPENSPEC §15.6b–d).
 *
 * ⚠️ TWO ROUTES FOR A PARTY'S OWN ACTION, AND THE CONTRACT DECIDES WHICH.
 *
 *    A contract that takes SIGNED MESSAGES (lib/signedActions.ts): the wallet signs a typed
 *    message, chainservice delivers it and pays the gas. No ETH reaches the wallet. This is for
 *    the escrow's party actions (votes, the arbiter and recipient actions) and the offer vault's
 *    (the seller accepting or rejecting an offer).
 *
 *    Every other call — an escrow from before the signed route, and token transfers:
 *    fund-then-send. A seller's accept or reject has NO such
 *    fallback: vaults from before the signed route are not supported, so a vault that cannot be
 *    confirmed to take signed calls is refused, with nothing sent. The UI encodes
 *    the call, `fundAndSendTransaction` estimates it and asks chainservice to move ETH into the
 *    user's own wallet, and the user's provider broadcasts. This exists because most wallet
 *    providers (MetaMask, Farcaster, anything over WalletConnect) will not sign a TRANSACTION
 *    without also sending it, so there is no signed transaction to hand to a backend. They will
 *    all sign a message, which is why the first route works.
 *
 * Calls that need no signature at all go through chainservice, which sends and pays, because each
 * is permissionless on-chain and lets the caller choose nothing: `seatDefaultArbiter` seats the
 * DEFAULT_ARBITER Safe rather than the caller; `createOffer` deploys an empty vault that only the
 * named LP can fund; `fund`, `withdraw` and `releaseHoldback` on a vault move money only to
 * addresses fixed in the vault or read off the escrow.
 */

const escrowInterface = new ethers.Interface(ESCROW_CONTRACT_ABI);
const vaultInterface = new ethers.Interface(OFFER_VAULT_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

/** Which signed actions, if any, a call through [abi] may be. */
const signedContractOf = (abi: ethers.Interface) =>
  abi === escrowInterface ? 'escrow' : abi === vaultInterface ? 'vault' : null;

/**
 * The refusals a party can actually cause from these screens: the escrow's, and the offer vault's
 * (with the escrow's own that surface through `accept`). The ABIs above carry functions only, so
 * without these a refusal reaches the user as "execution reverted".
 */
const contractErrors = new ethers.Interface([
  'error InvalidArbiterCandidate(address candidate)',
  'error NotDisputeParty(address caller)',
  'error NotFundedOrAlreadyProcessed()',
  'error NotAuthorizedToVote()',
  'error ContractMustBeDisputed()',
  'error ConsensusAlreadyReached()',
  'error InvalidPercentage()',
  'error OfferNotOpen()',
  'error OfferExpiredError()',
  'error OfferStale()',
  'error NotEscrowRecipient(address caller)',
  'error EscrowNotSellable()',
  'error OffersPaused()',
  'error NotApprovedOperator()',
  'error ApprovedTargetMismatch()',
  'error RecipientApprovalExpired()'
]);

/**
 * A transaction the chain refused, with the escrow's own reason when it gave one we know.
 * `from` is the wallet it would have been sent from, which is the whole story for NotDisputeParty
 * and NotAuthorizedToVote (neither of which says who asked).
 */
export class ContractRefusedError extends Error {
  constructor(
    message: string,
    readonly reason: { name: string; args: string[] } | null,
    readonly from?: string
  ) {
    super(message);
    this.name = 'ContractRefusedError';
  }
}

function decodeRefusal(error: unknown): ContractRefusedError | null {
  if (!(error instanceof EstimationRevertedError)) return null;
  let reason: { name: string; args: string[] } | null = null;
  try {
    const parsed = error.data ? contractErrors.parseError(error.data) : null;
    if (parsed) reason = { name: parsed.name, args: parsed.args.map(String) };
  } catch {
    // Not one of ours: keep the RPC's own words.
  }
  return new ContractRefusedError(error.message, reason, error.from);
}

export interface RelayedResult {
  success: boolean;
  transactionHash?: string | null;
  error?: string | null;
}

export function useMarketplaceActions() {
  const { getWeb3Service } = useSimpleEthers();

  /**
   * Encode a call and send it from the user's own wallet, gas-funded by chainservice.
   *
   * Gas is estimated per transaction rather than per flow, which matters more here than
   * elsewhere: a first settlement vote is ~28k gas, while the vote that triggers consensus is
   * ~99k (worst observed ~160k) because that transaction executes the entire payout. A funding
   * figure derived from the first and reused would strand precisely the transaction that moves
   * the money (§15.6b).
   */
  const send = useCallback(
    async (
      to: string,
      abi: ethers.Interface,
      fn: string,
      args: unknown[] = [],
      /** What the wallet's own screen says, and whether anything moves (walletPromptChannel). */
      prompt?: { walletDescription?: string; movesFunds?: boolean }
    ): Promise<string> => {
      const web3Service = await getWeb3Service();
      const data = abi.encodeFunctionData(fn, args);
      try {
        // A party action on a contract that takes signed messages: the wallet signs, chainservice
        // delivers and pays, and no ETH is handed to the wallet (lib/signedActions.ts). Null
        // means this contract does not, and the older route below is the only one it has.
        const contract = signedContractOf(abi);
        if (contract && isSignedAction(fn, contract) && fn !== 'raiseDispute') {
          const delivered = await sendSignedAction(
            { fetcher: apiFetch, wallet: web3Service },
            { contractAddress: to, action: fn, args, data, prompt }
          );
          if (delivered) return delivered;
          // An offer vault is only ever acted on by signature; there is no older route to fall to.
          if (contract === 'vault') {
            throw new Error('This offer could not be confirmed on the marketplace, so nothing was sent. Try again.');
          }
        }
        return await web3Service.fundAndSendTransaction({ to, data, value: '0', ...prompt });
      } catch (error) {
        throw decodeRefusal(error) ?? error;
      }
    },
    [getWeb3Service]
  );

  /**
   * Have chainservice send a permissionless vault call (`withdraw`, `releaseHoldback`) and pay
   * for it. No wallet is involved: nothing is signed and no ETH is handed out. Resolves with the
   * transaction hash once mined; throws with chainservice's reason when it refused (it checks
   * before sending, so a refusal costs nothing) or the transaction failed.
   */
  const relay = useCallback(async (endpoint: 'withdraw-offer' | 'release-holdback', vaultAddress: string): Promise<string> => {
    const response = await apiFetch(`/api/chain/marketplace/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultAddress })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false || !data.transactionHash) {
      throw new Error(data.error || 'That could not be sent. Nothing was changed; try again.');
    }
    return data.transactionHash as string;
  }, []);

  // ── Dispute settlement (§15.6b) ────────────────────────────────────────────

  /**
   * Put a settlement figure on-chain.
   *
   * ⚠️ THIS IS A BINDING OFFER, NOT A PROPOSAL. The contract stores one value per role and
   *    cannot distinguish "I propose 40%" from "I accept 40%" — they are the same transaction.
   *    It settles the instant any two of the three current votes match, paying out in that same
   *    transaction. Callers must present it that way before asking for the signature.
   */
  const submitSettlementVote = useCallback(
    (escrowAddress: string, buyerPercentage: number, prompt?: { walletDescription?: string; movesFunds?: boolean }) =>
      send(escrowAddress, escrowInterface, 'submitResolutionVote', [Math.round(buyerPercentage)], prompt),
    [send]
  );

  // ── Arbiter seat (§15.6c) ──────────────────────────────────────────────────

  /**
   * Name a candidate for the arbiter seat — empty or occupied. A match replaces the incumbent
   * (§3.3A1b); the only address the contract refuses is the one already seated.
   *
   * ⚠️ A MATCH SEATS THEM IMMEDIATELY, in this transaction, irreversibly. Nominating the address
   *    the other party already named is not a step towards agreement — it is the agreement.
   */
  const nominateArbiter = useCallback(
    (escrowAddress: string, candidate: string) =>
      send(escrowAddress, escrowInterface, 'nominateArbiter', [candidate]),
    [send]
  );

  /**
   * The wallet a Third Voter given by email will be nominated as. userservice owns the mapping, so
   * the same email always names the same wallet: two parties who type the same address nominate
   * the same person, and that person reaches the seat by signing in with it.
   *
   * `create: false` is the live preview while the party types: it only looks up, and answers null
   * for an email nobody has signed in with, so a half-typed address never gets a wallet made for
   * it. `create: true` is Nominate, and makes the wallet if there is none yet.
   */
  const resolveArbiterEmail = useCallback(
    async (email: string, { create }: { create: boolean }): Promise<string | null> => {
      const response = await apiFetch('/api/users/wallet-for-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, create })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404 && !create) return null;
      if (!response.ok || !data?.walletAddress) {
        throw new Error(data?.error || `Could not find a wallet for ${email} (${response.status})`);
      }
      return data.walletAddress as string;
    },
    []
  );

  /** Clear a seat whose arbiter has been silent 30 days. Moves no funds and closes nothing. */
  const evictArbiter = useCallback(
    (escrowAddress: string) => send(escrowAddress, escrowInterface, 'evictArbiter'),
    [send]
  );

  /**
   * The seated arbiter steps down (§3.3A1c). Only the arbiter's own wallet can send it; the seat
   * is empty afterwards exactly as after an eviction, and their standing vote stops counting.
   */
  const resignArbiter = useCallback(
    (escrowAddress: string) => send(escrowAddress, escrowInterface, 'resignArbiter'),
    [send]
  );

  /**
   * Fire the permissionless fallback from the platform relayer — the one dispute action the
   * platform sends itself, because it needs no signature and can only seat the Safe.
   *
   * A revert is an ordinary race, not an error: a late matching nomination still wins right up
   * until this executes. Re-read the state and re-render.
   */
  const seatDefaultArbiter = useCallback(async (escrowAddress: string): Promise<RelayedResult> => {
    const response = await apiFetch('/api/chain/seat-default-arbiter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractAddress: escrowAddress })
    });
    const data = await response.json().catch(() => ({}));
    return {
      success: response.ok && data.success !== false,
      transactionHash: data.transactionHash,
      error: data.error
    };
  }, []);

  // ── Marketplace (§15.6d) ───────────────────────────────────────────────────

  /**
   * Deploy an offer vault for this LP. ⚠️ Moves no money — the vault is created empty and
   * PENDING, and only the named LP can fund it. Making an offer is therefore two transactions,
   * mirroring create-then-deposit on an escrow.
   */
  const createOfferVault = useCallback(
    async (params: {
      escrowContract: string;
      lp: string;
      offerAmount: string;
      holdback?: string;
      offerDurationSeconds?: number;
    }): Promise<CreateOfferResponse> => {
      const response = await apiFetch('/api/chain/marketplace/create-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escrowContract: params.escrowContract,
          lp: params.lp,
          offerAmount: params.offerAmount,
          holdback: params.holdback || '0',
          // 0 means "use the venue's configured default duration".
          offerDurationSeconds: params.offerDurationSeconds ?? 0
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          error: data.error || (response.status === 503
            ? 'The marketplace is not available on this deployment yet.'
            : `Offer creation failed (${response.status})`)
        };
      }
      return data as CreateOfferResponse;
    },
    []
  );

  /**
   * The LP's own deposit into their vault — this is the transaction that makes an offer real.
   *
   * ⚠️ FUNDING IS A PLAIN ERC20 TRANSFER, exactly as escrow funding is (`transferToContract`
   *    + `checkAndActivate`). The LP sends the offer token straight to the vault address and
   *    signs nothing else; `fund()` is then relayed by chainservice, which only observes the
   *    balance and flips the offer live. It is permissionless on-chain — it takes no
   *    arguments, so a caller chooses no destination, and the vault's `lp` was fixed at
   *    deployment — which is why the platform may send it.
   *
   *    The alternative, approve + `transferFrom`, cost the LP two signatures and presented
   *    the second as an opaque call on a freshly-cloned proxy that no wallet could decode —
   *    which wallets render as a bare native-value transaction, i.e. an ETH payment prompt
   *    on a USDC offer. A `transfer` is the one call every wallet displays honestly.
   */
  const fundOffer = useCallback(
    async (
      vaultAddress: string,
      tokenAddress: string,
      amount: string,
      /**
       * ⚠️ Fired the moment the LP's capital has left their wallet, BEFORE the offer is
       *    opened. Callers must use it to make any retry open the existing deposit rather
       *    than send another — the two halves fail independently, and only the second is
       *    safe to repeat. Throwing from this hook says nothing about where the money is.
       */
      onDeposited?: () => void
    ): Promise<string> => {
      const web3Service = await getWeb3Service();

      // 1. The LP's single signature: their capital, from their wallet, to their vault.
      const transferHash = await web3Service.fundAndSendTransaction({
        to: tokenAddress,
        data: erc20Interface.encodeFunctionData('transfer', [vaultAddress, amount]),
        value: '0'
      });
      onDeposited?.();

      // 2. Open the offer. Moves nothing — see above. Relayed so the LP pays for one
      //    transaction rather than two.
      const response = await apiFetch('/api/chain/marketplace/fund-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultAddress })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        // The money is safely in the LP's own vault at this point; only the flip failed.
        // Retrying `fund-offer` alone is the fix — never re-send the transfer.
        throw new Error(
          data.error || 'Your deposit arrived, but the offer could not be opened. Retry opening it.'
        );
      }

      return transferHash;
    },
    [getWeb3Service]
  );

  /**
   * Open an offer whose deposit already landed but whose `fund()` did not — the retry for the
   * second half of `fundOffer` alone. Sending the transfer again would double the deposit.
   */
  const openFundedOffer = useCallback(async (vaultAddress: string): Promise<RelayedResult> => {
    const response = await apiFetch('/api/chain/marketplace/fund-offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaultAddress })
    });
    const data = await response.json().catch(() => ({}));
    return {
      success: response.ok && data.success !== false,
      transactionHash: data.transactionHash,
      error: data.error
    };
  }, []);

  /**
   * Approve this offer's vault to pull the recipient role. Step one of two, and it expires in
   * five minutes (`RECIPIENT_APPROVAL_TTL`).
   *
   * The operator is **that offer's own vault**, not a global venue address, and the destination
   * is bound at grant time — so even a malicious operator could only execute the exact move the
   * seller sanctioned.
   */
  const approveRecipientTransfer = useCallback(
    (escrowAddress: string, vaultAddress: string, newRecipient: string) =>
      send(escrowAddress, escrowInterface, 'approveRecipientTransfer', [vaultAddress, newRecipient]),
    [send]
  );

  /**
   * Accept an offer: the atomic swap. Must land within five minutes of the approval above.
   *
   * The seller signs `AcceptOffer` and chainservice delivers it, as the approval before it; each
   * returns only once mined, so the second is never early. There is no wallet-sent fallback.
   *
   * If the window lapses, just re-prompt for the approval. An expired approval is inert and
   * nothing is at risk — treat expiry as a retry, never as an error state needing recovery.
   */
  const acceptOffer = useCallback(
    (vaultAddress: string) => send(vaultAddress, vaultInterface, 'accept'),
    [send]
  );

  /** Decline an offer. The vault stays put; the LP withdraws their own capital afterwards. */
  const rejectOffer = useCallback(
    (vaultAddress: string) => send(vaultAddress, vaultInterface, 'reject'),
    [send]
  );

  /**
   * Recover an LP's capital from a vault that can no longer be accepted.
   *
   * ⚠️ Nothing on-chain notifies anyone that this became possible. Expiry, rejection, staleness
   *    after someone else's acceptance, and dispute-triggered withdrawability are all lazy
   *    conditions the UI must detect and prompt — an LP who is never told simply never withdraws.
   */
  const withdrawOffer = useCallback((vaultAddress: string) => relay('withdraw-offer', vaultAddress), [relay]);

  /**
   * Return a settled escrow's reserve to its funder and beneficiary, sent by chainservice.
   *
   * Permissionless on-chain (§6.7): the funder is fixed in the vault, the beneficiary read live
   * off the escrow, and the split falls out of the escrow's final state, so the platform sending
   * it changes nothing about who is paid what. Nothing announces that an escrow settled, so if
   * the UI does not detect a settled escrow with a live reserve and offer this, it simply sits.
   */
  const releaseHoldback = useCallback((vaultAddress: string) => relay('release-holdback', vaultAddress), [relay]);

  return {
    submitSettlementVote,
    nominateArbiter,
    resolveArbiterEmail,
    evictArbiter,
    resignArbiter,
    seatDefaultArbiter,
    createOfferVault,
    fundOffer,
    openFundedOffer,
    approveRecipientTransfer,
    acceptOffer,
    rejectOffer,
    withdrawOffer,
    releaseHoldback
  };
}
