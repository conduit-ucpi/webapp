/**
 * RpcClient — the single owner of read-only blockchain RPC.
 *
 * GOAL: every read against our own rpcUrl flows through here, so the rest of
 * the app never instantiates `new ethers.JsonRpcProvider` or issues raw
 * `fetch(rpcUrl)` JSON-RPC itself. (Enforced by an architecture test.)
 *
 * This is a READ-ONLY client: it holds an ethers JsonRpcProvider built from the
 * rpcUrl and exposes the read methods the app needs. It never signs or sends
 * transactions — wallet-initiated signing stays with the wallet provider.
 *
 * Behavior here is intentionally byte-identical to the inline logic it
 * replaces (Web3Service read methods + the duplicated page/component reads),
 * including ABIs, formatUnits/formatEther decoding, and field coercions. The
 * Phase 0 regression net and RpcClient.test.ts pin this.
 */

import { ethers } from 'ethers';
import { ERC20_ABI, ESCROW_CONTRACT_ABI, NO_VOTE_SENTINEL, OFFER_VAULT_ABI, OFFER_VAULT_STATUS } from '@/lib/web3';

export interface TokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface EscrowContractInfo {
  buyer: string;
  seller: string;
  amount: string; // formatted USDC (6 decimals)
  expiryTimestamp: number;
  descriptionHash: string;
  currentState: number;
  currentTimestamp: number;
}

export interface EscrowContractState {
  isExpired: boolean;
  canClaim: boolean;
  canDispute: boolean;
  isFunded: boolean;
  canDeposit: boolean;
  isDisputed: boolean;
  isClaimed: boolean;
}

/**
 * Who currently holds which settlement figure on a disputed escrow.
 *
 * A `null` figure means that party has not voted. `resolvedBuyerPercentage` being non-null means
 * the dispute is over and the money has already moved.
 */
export interface EscrowSettlementState {
  buyer: string;
  /** The CURRENT recipient — after a marketplace sale this is the LP, not the original seller. */
  recipient: string;
  /** null while the seat is empty, which is an ordinary mid-life state after a sale (§3.3A). */
  arbiter: string | null;
  buyerVote: number | null;
  recipientVote: number | null;
  arbiterVote: number | null;
  resolvedBuyerPercentage: number | null;
}

/** One offer vault's terms, read straight from the vault itself. */
export interface OfferVaultState {
  vaultAddress: string;
  escrowContract: string;
  lp: string;
  seller: string;
  token: string;
  offerAmount: bigint;
  /** What the seller actually receives: `offerAmount − fee − holdback` (§8.5a). */
  netAmount: bigint;
  fee: bigint;
  holdback: bigint;
  offerExpiry: number;
  status: string;
  /**
   * What the vault actually holds, in base units.
   *
   * ⚠️ THE ONLY WITNESS TO A DIRECT-TRANSFER DEPOSIT. Funding is a plain ERC20 transfer, so
   *    capital can arrive without `fund()` opening the offer — and a bare transfer emits no
   *    marketplace event at all, so the index cannot see it. A `PENDING` vault with a
   *    non-zero balance is an LP's parked deposit; the same vault at zero is an offer nobody
   *    funded. Nothing but this read distinguishes them.
   */
  depositedAmount: bigint;
}

/** Minimal metadata ABI (symbol/decimals/name) for token detail reads. */
const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
];

export class RpcClient {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly rpcUrl: string;

  constructor(rpcUrl: string) {
    // Mirror the prior Web3Service.readProvider behavior exactly: pass the
    // configured rpcUrl straight to ethers (which tolerates an absent URL,
    // e.g. during provider-switching teardown with an empty config). We do not
    // throw here, so constructing Web3Service never regresses on empty config.
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /** Underlying read-only provider, for the few low-level reads that need it. */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  // ---- Network / chain reads --------------------------------------------

  /** The ethers Network object (chainId, name). */
  async getNetwork(): Promise<ethers.Network> {
    return this.provider.getNetwork();
  }

  /** chainId as a JS number. */
  async getChainId(): Promise<number> {
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }

  /** Latest block number. */
  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  /** Nonce (transaction count) for an address. */
  async getTransactionCount(
    address: string,
    blockTag?: ethers.BlockTag
  ): Promise<number> {
    return this.provider.getTransactionCount(address, blockTag);
  }

  // ---- Fee / gas reads ---------------------------------------------------

  /** Provider fee data (gasPrice / maxFeePerGas / maxPriorityFeePerGas). */
  async getFeeData(): Promise<ethers.FeeData> {
    return this.provider.getFeeData();
  }

  /**
   * Raw eth_gasPrice via direct JSON-RPC, with a hardcoded 1-gwei fallback.
   *
   * This reproduces FarcasterSyntheticProvider.getFeeData()'s deliberate
   * behavior: it bypasses ethers' provider.getFeeData() "to avoid inflated gas
   * values", reads eth_gasPrice directly, and falls back to exactly 1 gwei
   * (1_000_000_000n) when the RPC is unavailable, returns no result, or the
   * HTTP response is not ok. Callers that need the {gasPrice, maxFeePerGas,
   * maxPriorityFeePerGas} shape can wrap this.
   */
  async getRawGasPriceWithFallback(): Promise<bigint> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.result) {
          return BigInt(result.result);
        }
      }
    } catch (error) {
      console.warn('Failed to get gas price from RPC in RpcClient:', error);
    }
    return BigInt('1000000000'); // 1 gwei fallback
  }

  // ---- Balances ----------------------------------------------------------

  /** ERC-20 balance, formatted with the token's own decimals. */
  async getTokenBalance(userAddress: string, tokenAddress: string): Promise<string> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance = await token.balanceOf(userAddress);
    const decimals = await token.decimals();
    return ethers.formatUnits(balance, decimals);
  }

  /** Native (gas) balance, formatted as ether. */
  async getNativeBalance(userAddress: string): Promise<string> {
    const balance = await this.provider.getBalance(userAddress);
    return ethers.formatEther(balance);
  }

  // ---- Token reads -------------------------------------------------------

  /** symbol / decimals / name, with decimals coerced to a JS number. */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    const token = new ethers.Contract(tokenAddress, ERC20_METADATA_ABI, this.provider);
    const [symbol, decimals, name] = await Promise.all([
      token.symbol(),
      token.decimals(),
      token.name(),
    ]);
    return { address: tokenAddress, symbol, decimals: Number(decimals), name };
  }

  /** ERC-20 allowance, formatted with the token's own decimals. */
  async getTokenAllowance(
    userAddress: string,
    spenderAddress: string,
    tokenAddress: string
  ): Promise<string> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const allowance = await token.allowance(userAddress, spenderAddress);
    const decimals = await token.decimals();
    return ethers.formatUnits(allowance, decimals);
  }

  // ---- Escrow contract reads --------------------------------------------

  /** getContractInfo() tuple, with USDC 6-decimal amount and numeric fields. */
  async getContractInfo(contractAddress: string): Promise<EscrowContractInfo> {
    const contract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI, this.provider);
    const info = await contract.getContractInfo();
    return {
      buyer: info._buyer,
      seller: info._seller,
      amount: ethers.formatUnits(info._amount, 6), // USDC has 6 decimals
      expiryTimestamp: Number(info._expiryTimestamp),
      descriptionHash: info._descriptionHash,
      currentState: Number(info._currentState),
      currentTimestamp: Number(info._currentTimestamp),
    };
  }

  /** The seven boolean escrow state flags, read in parallel. */
  async getContractState(contractAddress: string): Promise<EscrowContractState> {
    const contract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI, this.provider);
    const [isExpired, canClaim, canDispute, isFunded, canDeposit, isDisputed, isClaimed] =
      await Promise.all([
        contract.isExpired(),
        contract.canClaim(),
        contract.canDispute(),
        contract.isFunded(),
        contract.canDeposit(),
        contract.isDisputed(),
        contract.isClaimed(),
      ]);
    return { isExpired, canClaim, canDispute, isFunded, canDeposit, isDisputed, isClaimed };
  }

  // ---- Dispute settlement reads (MARKETPLACE_OPENSPEC §15.6b) -------------

  /**
   * Every standing settlement figure on a disputed escrow, and whether it has already settled.
   *
   * ⚠️ READ THIS FROM THE CHAIN, NOT FROM OUR OWN RECORDS. The escrow settles itself the instant
   *    any two of the three current votes match, in the same transaction as the second vote — so
   *    "has this settled" is a chain fact that no off-chain record observes. contractservice's
   *    dispute history is a record of the conversation and may legitimately lag it (§15.3a).
   *
   * A figure of `null` means that party has not voted: the contract's sentinel is 255, because 0
   * is itself a valid settlement (everything to the seller) and could not stand for absence.
   */
  async getSettlementState(contractAddress: string): Promise<EscrowSettlementState> {
    const contract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI, this.provider);

    const [buyer, recipient, arbiter, resolved] = await Promise.all([
      contract.BUYER(),
      contract.recipient(),
      contract.ARBITER(),
      contract.resolvedBuyerPercentage(),
    ]);

    const seated = arbiter && arbiter !== ethers.ZeroAddress;

    const [buyerVote, recipientVote, arbiterVote] = await Promise.all([
      contract.resolutionVotes(buyer),
      contract.resolutionVotes(recipient),
      seated ? contract.resolutionVotes(arbiter) : Promise.resolve(NO_VOTE_SENTINEL),
    ]);

    const asFigure = (raw: unknown): number | null => {
      const value = Number(raw);
      return value === NO_VOTE_SENTINEL ? null : value;
    };

    return {
      buyer,
      recipient,
      arbiter: seated ? arbiter : null,
      buyerVote: asFigure(buyerVote),
      recipientVote: asFigure(recipientVote),
      arbiterVote: asFigure(arbiterVote),
      resolvedBuyerPercentage: asFigure(resolved),
    };
  }

  /**
   * The net figure the recipient collects at maturity — `AMOUNT − CREATOR_FEE`.
   *
   * This, not the gross escrow amount, is what an LP prices against (§3.1). Quoting a discount
   * off the gross would overstate every offer by the creator fee.
   */
  async getPayoutAmount(contractAddress: string): Promise<bigint> {
    const contract = new ethers.Contract(contractAddress, ESCROW_CONTRACT_ABI, this.provider);
    return contract.payoutAmount();
  }

  // ---- Offer vault reads (MARKETPLACE_OPENSPEC §5.0) ---------------------

  /**
   * One offer vault's terms and current status.
   *
   * The offer book comes from contractservice's index; this is for the moment before a party
   * signs, when the figures on screen are about to become a transaction. The index is a mirror
   * and may lag the chain by a reconcile — an acceptance elsewhere is exactly the event that
   * arrives late (§15.6f).
   */
  async getOfferVaultState(vaultAddress: string): Promise<OfferVaultState> {
    const vault = new ethers.Contract(vaultAddress, OFFER_VAULT_ABI, this.provider);

    const [escrowContract, lp, seller, token, offerAmount, netAmount, fee, holdback, offerExpiry, status] =
      await Promise.all([
        vault.escrowContract(),
        vault.lp(),
        vault.seller(),
        vault.token(),
        vault.offerAmount(),
        vault.netAmount(),
        vault.fee(),
        vault.holdback(),
        vault.offerExpiry(),
        vault.status(),
      ]);

    // Sequenced after the token address rather than folded into the batch above: the
    // balance is read from the token the vault itself names, never a caller-supplied one.
    const depositedAmount = await this.getVaultDeposit(vaultAddress, token);

    return {
      vaultAddress,
      escrowContract,
      lp,
      seller,
      token,
      offerAmount,
      netAmount,
      fee,
      holdback,
      offerExpiry: Number(offerExpiry),
      status: OFFER_VAULT_STATUS[Number(status)] ?? 'UNKNOWN',
      depositedAmount,
    };
  }

  /**
   * What a vault is holding of its own offer token, in base units.
   *
   * Split out because the PENDING case needs only this — enriching a list of offers with a
   * full `getOfferVaultState` each would be ten calls per row to answer one question.
   */
  async getVaultDeposit(vaultAddress: string, tokenAddress: string): Promise<bigint> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    return await token.balanceOf(vaultAddress);
  }
}
