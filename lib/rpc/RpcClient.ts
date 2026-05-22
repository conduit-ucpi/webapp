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
import { ERC20_ABI, ESCROW_CONTRACT_ABI } from '@/lib/web3';

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

/** Minimal metadata ABI (symbol/decimals/name) for token detail reads. */
const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
];

export class RpcClient {
  private readonly provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string) {
    // Mirror the prior Web3Service.readProvider behavior exactly: pass the
    // configured rpcUrl straight to ethers (which tolerates an absent URL,
    // e.g. during provider-switching teardown with an empty config). We do not
    // throw here, so constructing Web3Service never regresses on empty config.
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /** Underlying read-only provider, for the few low-level reads that need it. */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
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
}
