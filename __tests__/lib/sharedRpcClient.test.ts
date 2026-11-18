/**
 * The read endpoint is a public, rate-limited one. A client that is not told its chain asks the
 * node for it before reading, and requests spread over several clients are never folded into
 * one. So every reader takes the same pinned client for an endpoint.
 */
import { RpcClient, sharedRpcClient, rememberChain, forgetSharedRpcClients } from '@/lib/rpc/RpcClient';

const RPC = 'https://rpc.example';

describe('one chain client per endpoint', () => {
  beforeEach(() => forgetSharedRpcClients());

  it('hands every caller the same client for an endpoint', () => {
    rememberChain(RPC, 8453);
    expect(sharedRpcClient(RPC)).toBe(sharedRpcClient(RPC));
    expect(sharedRpcClient(RPC)).toBe(sharedRpcClient(RPC, 8453));
    expect(sharedRpcClient(RPC)).toBeInstanceOf(RpcClient);
  });

  it('keeps endpoints apart', () => {
    expect(sharedRpcClient(RPC, 8453)).not.toBe(sharedRpcClient('https://other.example', 8453));
  });

  it('pins the client to the remembered chain, so it never asks the node which chain it is on', async () => {
    rememberChain(RPC, '8453');
    const provider = sharedRpcClient(RPC).getProvider();
    const send = jest.spyOn(provider, 'send');
    const network = await provider.getNetwork();
    expect(Number(network.chainId)).toBe(8453);
    expect(send).not.toHaveBeenCalled();
  });

  it('replaces a client built before the chain was known with a pinned one', () => {
    const early = sharedRpcClient(RPC);
    rememberChain(RPC, 8453);
    const later = sharedRpcClient(RPC);
    expect(later).not.toBe(early);
    expect(sharedRpcClient(RPC)).toBe(later);
  });

  it('ignores a chain that is not a positive whole number', () => {
    rememberChain(RPC, undefined);
    rememberChain(RPC, 'base');
    rememberChain(undefined, 8453);
    const early = sharedRpcClient(RPC);
    expect(sharedRpcClient(RPC)).toBe(early);
  });
});
