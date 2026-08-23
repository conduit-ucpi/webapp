import { useCallback } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI, ESCROW_CONTRACT_ABI, OFFER_VAULT_ABI } from '@/lib/web3';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import type { CreateOfferResponse } from '@/types/marketplace';

/**
 * Every on-chain action the dispute, arbiter and marketplace screens take
 * (MARKETPLACE_OPENSPEC §15.6b–d).
 *
 * ⚠️ ALMOST NOTHING HERE IS RELAYED, AND THAT IS NOT A CHOICE. Embedded wallet providers
 *    (Farcaster, Dynamic, WalletConnect) do not expose raw transaction signing, and calling
 *    `getSigner()` after connection is forbidden on them — so there is no signed transaction to
 *    hand to a backend. Gas sponsorship works the other way round: the UI encodes the call,
 *    `fundAndSendTransaction` estimates it and asks chainservice to move ETH into the user's own
 *    wallet, and the user's provider broadcasts. Any endpoint asking for a `signedTransaction` is
 *    the wrong shape and should not exist.
 *
 * The exceptions all go through chainservice, and the test each one passes is the same: could the
 * SENDER choose anything? `seatDefaultArbiter` seats the DEFAULT_ARBITER Safe rather than the
 * caller; `createOffer` deploys an empty vault only the named LP can fund; `fund()` takes no
 * arguments and merely observes a balance; `withdraw()` pays the `lp` fixed at deployment an
 * amount fixed by state; and `releaseHoldback()` splits the reserve between a funder fixed at
 * deployment and a beneficiary read live off the escrow. None of them lets a relayer decide
 * anything, which is why the contracts make them permissionless and why we may send them.
 *
 * What is left on the wallet is exactly what has a chooser: `accept` pays `msg.sender`, `reject`
 * answers only to the seller, and the dispute votes are the caller's own position.
 */

const escrowInterface = new ethers.Interface(ESCROW_CONTRACT_ABI);
const vaultInterface = new ethers.Interface(OFFER_VAULT_ABI);
const erc20Interface = new ethers.Interface(ERC20_ABI);

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
    async (to: string, abi: ethers.Interface, fn: string, args: unknown[] = []): Promise<string> => {
      const web3Service = await getWeb3Service();
      return web3Service.fundAndSendTransaction({
        to,
        data: abi.encodeFunctionData(fn, args),
        value: '0'
      });
    },
    [getWeb3Service]
  );

  /**
   * Tell chainservice this offer is over.
   *
   * ⚠️ NEVER ALLOWED TO FAIL THE ACTION. The transaction has already landed on-chain by the
   *    time this runs; a rejected notification means a cache is briefly stale, while a thrown
   *    error here would tell a seller their accept did not go through and invite them to sign
   *    it again. So it is awaited (the next read should see the corrected answer) but its
   *    failure is swallowed.
   *
   * Skipped silently when the escrow is unknown — the notification is keyed on it, and a
   * guessed key would evict the wrong escrow's offers.
   */
  const notifyOfferEnded = useCallback(
    async (vaultAddress: string, escrowContract: string | null | undefined, accepted: boolean) => {
      if (!escrowContract) return;
      try {
        await fetch('/api/chain/marketplace/offer-ended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultAddress, escrowContract, accepted })
        });
      } catch (e) {
        console.warn('Could not tell chainservice the offer ended:', e);
      }
    },
    []
  );

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
    (escrowAddress: string, buyerPercentage: number) =>
      send(escrowAddress, escrowInterface, 'submitResolutionVote', [Math.round(buyerPercentage)]),
    [send]
  );

  // ── Arbiter seat (§15.6c) ──────────────────────────────────────────────────

  /**
   * Name a candidate for the empty arbiter seat.
   *
   * ⚠️ A MATCH SEATS THEM IMMEDIATELY, in this transaction, irreversibly. Nominating the address
   *    the other party already named is not a step towards agreement — it is the agreement.
   */
  const nominateArbiter = useCallback(
    (escrowAddress: string, candidate: string) =>
      send(escrowAddress, escrowInterface, 'nominateArbiter', [candidate]),
    [send]
  );

  /** Clear a seat whose arbiter has been silent 30 days. Moves no funds and closes nothing. */
  const evictArbiter = useCallback(
    (escrowAddress: string) => send(escrowAddress, escrowInterface, 'evictArbiter'),
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
    const response = await fetch('/api/chain/seat-default-arbiter', {
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
      const response = await fetch('/api/chain/marketplace/create-offer', {
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
      const response = await fetch('/api/chain/marketplace/fund-offer', {
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
    const response = await fetch('/api/chain/marketplace/fund-offer', {
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
   * If the window lapses, just re-prompt for the approval. An expired approval is inert and
   * nothing is at risk — treat expiry as a retry, never as an error state needing recovery.
   */
  const acceptOffer = useCallback(
    async (vaultAddress: string, escrowContract?: string | null) => {
      const hash = await send(vaultAddress, vaultInterface, 'accept');
      // `accepted` matters: it tells chainservice to drop the WHOLE escrow, because acceptance
      // rewrites the recipient and makes every other offer on it stale at the same instant.
      await notifyOfferEnded(vaultAddress, escrowContract, true);
      return hash;
    },
    [send, notifyOfferEnded]
  );

  /**
   * Decline an offer. The vault stays put, holding the LP's capital until it is withdrawn — which
   * needs nothing from the seller and nothing from the LP either: `withdrawOffer` below is
   * relayed, and the platform's sweep returns it unprompted.
   */
  const rejectOffer = useCallback(
    async (vaultAddress: string, escrowContract?: string | null) => {
      const hash = await send(vaultAddress, vaultInterface, 'reject');
      await notifyOfferEnded(vaultAddress, escrowContract, false);
      return hash;
    },
    [send, notifyOfferEnded]
  );

  /**
   * Recover an LP's capital from a vault that can no longer be accepted.
   *
   * ⚠️ RELAYED, AND THE THIRD EXCEPTION TO THE RULE AT THE TOP OF THIS FILE. `withdraw()` is
   *    permissionless on-chain: it takes no arguments, pays the `lp` fixed when the vault was
   *    deployed, and the amount is fixed by state — so the sender chooses nothing and there is
   *    nothing for a signature to authorise. The LP presses a button and their capital comes
   *    back, with no wallet prompt and no gas of their own.
   *
   * ⚠️ Nothing on-chain notifies anyone that this became possible. Expiry, rejection, staleness
   *    after someone else's acceptance, and dispute-triggered withdrawability are all lazy
   *    conditions the UI must detect and prompt. The platform now sweeps lapsed offers on a
   *    timer as well, so this button is the LP's way of not waiting for it — which means the
   *    two can race, and the loser gets a refusal rather than an error.
   *
   * ⚠️ NO `offer-ended` CALL, UNLIKE ACCEPT AND REJECT. That notification exists because those
   *    go from the party's own wallet and chainservice never sees them. This one IS chainservice's
   *    own transaction: it records the ending and indexes the receipt itself, and telling it
   *    again would be a second, later claim about a cache it has already corrected.
   */
  const withdrawOffer = useCallback(async (vaultAddress: string): Promise<RelayedResult> => {
    const response = await fetch('/api/chain/marketplace/withdraw-offer', {
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
   * Settle a finished escrow's reserve between its funder and the position's holder.
   *
   * ⚠️ RELAYED, on the same test as `withdrawOffer`: the sender chooses nothing. The funder was
   *    fixed when the vault was deployed, the beneficiary is `escrow.recipient()` read live, and
   *    the split comes out of the escrow's final state — a dispute's award to the buyer comes off
   *    the reserve first, and only the remainder returns to the funder. So neither party signs.
   *
   * ⚠️ A DISPUTED ESCROW THAT RESOLVED IS RELEASABLE, and that is the case the split exists for.
   *    Resolution marks the escrow claimed in the same transaction that pays it out. Never gate
   *    this on "was there a dispute" — that strands the reserve precisely when it is doing work.
   *
   * ⚠️ NOBODY SWEEPS IT. Unlike a lapsed offer, no keeper fires this, so the UI detecting a
   *    settled escrow with a live reserve is still what gets it paid out.
   */
  const releaseHoldback = useCallback(async (vaultAddress: string): Promise<RelayedResult> => {
    const response = await fetch('/api/chain/marketplace/release-holdback', {
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

  return {
    submitSettlementVote,
    nominateArbiter,
    evictArbiter,
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
