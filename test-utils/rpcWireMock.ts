/**
 * Shared wire-level RPC mock harness for RPC abstraction regression tests.
 *
 * WHY THIS EXISTS:
 * We are about to centralize every blockchain RPC call into a single library
 * (lib/rpc/RpcClient). Before moving any code we pin the CURRENT observable
 * RPC behavior at the wire level, so the refactor can be proven to change
 * nothing the chain ever sees.
 *
 * IMPORTANT (discovered while building these tests):
 * - ethers v6 Contract reads do NOT go through global.fetch. They dispatch
 *   through JsonRpcProvider.prototype._send with the raw JSON-RPC payload.
 *   So contract reads (eth_call) must be intercepted at _send.
 * - Code that calls fetch(rpcUrl) directly (gas price, gas estimate, nonce)
 *   IS interceptable via global.fetch, and existing tests already mock it
 *   that way (see __tests__/lib/web3-gas-estimation-simple.test.ts).
 *
 * This harness covers the _send path (ethers provider/contract reads). For
 * the direct-fetch paths, keep using the global.fetch convention.
 */

import { ethers } from 'ethers';

export interface RpcRequest {
  id: number | string;
  method: string;
  params: any[];
}

export type RpcHandler = (req: RpcRequest) => any | undefined;

export interface RpcWireMock {
  /** Every JSON-RPC request seen by the provider, in order. */
  requests: RpcRequest[];
  /** Only eth_call requests (the params[0] tx object is on .params[0]). */
  ethCalls: RpcRequest[];
  /** Restore the original ethers _send. Call in afterEach. */
  restore: () => void;
}

/**
 * Common ERC-20 / escrow function selectors, so tests read clearly.
 * (4-byte keccak selectors of the canonical signatures.)
 */
export const SELECTORS = {
  balanceOf: '0x70a08231',
  decimals: '0x313ce567',
  symbol: '0x95d89b41',
  name: '0x06fdde03',
  allowance: '0xdd62ed3e',
} as const;

/**
 * uint256/uint8 result encoding helper: a value as a 32-byte hex word.
 * Accepts a string for values above Number.MAX_SAFE_INTEGER (e.g. 18-decimal
 * balances) so precision is never lost before reaching BigInt.
 */
export function word(value: bigint | number | string): string {
  return '0x' + BigInt(value).toString(16).padStart(64, '0');
}

/** ABI-encode a string return value (for symbol()/name()). */
export function encodeString(value: string): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(['string'], [value]);
}

/**
 * Install a wire-level mock over ethers JsonRpcProvider._send.
 *
 * @param handler  Return a result value for a given request, or undefined to
 *                 fall through to the default (chainId answered automatically;
 *                 anything else errors so unexpected RPC traffic is caught).
 * @param chainIdHex  chainId to report for eth_chainId (default Base 0x2105).
 */
export function installRpcWireMock(
  handler: RpcHandler,
  chainIdHex: string = '0x2105'
): RpcWireMock {
  const requests: RpcRequest[] = [];

  const respondOne = (req: RpcRequest) => {
    requests.push(req);
    const custom = handler(req);
    if (custom !== undefined) {
      return { id: req.id, result: custom };
    }
    if (req.method === 'eth_chainId') {
      return { id: req.id, result: chainIdHex };
    }
    return {
      id: req.id,
      error: { code: -32601, message: `unexpected RPC method in test: ${req.method}` },
    };
  };

  const spy = jest
    .spyOn(ethers.JsonRpcProvider.prototype as any, '_send')
    .mockImplementation(async (...args: any[]) => {
      const payload = args[0];
      const reqs: RpcRequest[] = Array.isArray(payload) ? payload : [payload];
      return reqs.map(respondOne);
    });

  return {
    requests,
    get ethCalls() {
      return requests.filter((r) => r.method === 'eth_call');
    },
    restore: () => spy.mockRestore(),
  };
}
