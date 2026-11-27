/**
 * The gas cost cap is checked BEFORE the wallet is topped up.
 *
 * It used to run just before the send, after chainservice had already moved ETH into the
 * wallet, so a vote we were going to refuse cost us a sponsorship first, and again on every
 * retry. Production, 2026-10-08: a settling vote (133,760 gas × 1.8 buffer at 0.0789 gwei
 * = 1.90e-5 ETH) against a 14,800 gwei cap was funded, then refused.
 */

import { ethers } from 'ethers';
import { Web3Service, GasCostCapError } from '@/lib/web3';

const USER = '0x78A67E815db3D0D60F5018F1DbFF173fFB25afBD';
const ESCROW = '0xa46c6c37956414bad8c40d8972ef0f59da35a2a5';
const vote = new ethers.Interface(['function submitResolutionVote(uint256)']).encodeFunctionData('submitResolutionVote', [50]);

const config = {
  rpcUrl: 'https://rpc.example',
  chainId: 8453,
  gasPriceBuffer: '1.2',
  maxGasPriceGwei: '0.3',
  maxGasCostGwei: '14800', // production's: 1.48e-5 ETH
  minGasWei: '5'
} as any;

/** The production fees of the refused vote: maxFee 0.078876 gwei. */
const PROD_FEES = { maxFeePerGas: BigInt(78876000), maxPriorityFeePerGas: BigInt(1000000) };

function service(fees = PROD_FEES) {
  Web3Service.clearInstance();
  const svc = Web3Service.getInstance(config) as any;
  svc.provider = { request: jest.fn().mockRejectedValue(new Error('the test must not reach the send')) };
  svc.readProvider = { getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(8453) }) };
  jest.spyOn(svc, 'verifyAndSwitchNetwork').mockResolvedValue(undefined);
  jest.spyOn(svc, 'getUserAddress').mockResolvedValue(USER);
  jest.spyOn(svc, 'isInjectedWalletProvider').mockReturnValue(false);
  jest.spyOn(svc, 'getReliableEIP1559FeeData').mockResolvedValue(fees);
  const topUp = jest.spyOn(svc, 'topUpGasIfShort').mockResolvedValue(true);
  return { svc: svc as Web3Service, topUp };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  Web3Service.clearInstance();
});

describe('the gas cost cap is checked before any sponsorship', () => {
  it('refuses the production vote over the cap without topping the wallet up', async () => {
    const { svc, topUp } = service();

    const sent = svc.fundAndSendTransaction({ to: ESCROW, data: vote, value: '0', gasLimit: BigInt(133760) });

    await expect(sent).rejects.toBeInstanceOf(GasCostCapError);
    expect(topUp).not.toHaveBeenCalled();
  });

  it('says what it would have cost and what the cap is, and is not wrapped as a send failure', async () => {
    const { svc } = service();

    const error = await svc
      .fundAndSendTransaction({ to: ESCROW, data: vote, value: '0', gasLimit: BigInt(133760) })
      .catch((e) => e);

    expect(error.name).toBe('GasCostCapError');
    // 133,760 × 1.8 = 240,768 gas at 78,876,000 wei
    expect(error.costWei).toBe(BigInt(240768) * BigInt(78876000));
    expect(error.capWei).toBe(BigInt(14800) * BigInt(1000000000));
    expect(error.message).not.toMatch(/^Transaction failed:/);
  });

  it('tops up and carries on when the same vote fits under the cap', async () => {
    const { svc, topUp } = service({ maxFeePerGas: BigInt(50000000), maxPriorityFeePerGas: BigInt(1000000) });

    // Past the check, the send itself is not what this test is about: it fails on the stub.
    await svc.fundAndSendTransaction({ to: ESCROW, data: vote, value: '0', gasLimit: BigInt(133760) }).catch(() => {});

    expect(topUp).toHaveBeenCalledTimes(1);
  });

  it('does not cap an injected wallet, which prices its own gas', async () => {
    const { svc, topUp } = service();
    jest.spyOn(svc as any, 'isInjectedWalletProvider').mockReturnValue(true);

    await svc.fundAndSendTransaction({ to: ESCROW, data: vote, value: '0', gasLimit: BigInt(133760) }).catch(() => {});

    expect(topUp).toHaveBeenCalledTimes(1);
  });

  it('never funds ahead, from the prewarm, a transaction the send would refuse', async () => {
    const { svc, topUp } = service();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x20a80' }) }); // 133,760
    global.fetch = fetchMock as any;
    jest.spyOn(svc as any, 'gasPriceForFunding').mockResolvedValue(PROD_FEES.maxFeePerGas);

    await svc.prewarmTransaction({ to: ESCROW, data: vote, value: '0' });

    expect(fetchMock).toHaveBeenCalled();
    expect(topUp).not.toHaveBeenCalled();
  });
});
