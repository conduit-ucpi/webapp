/**
 * A party action sent as a signed message: the wallet signs typed data, chainservice delivers it.
 *
 * The first block is the one that matters most. The contract rebuilds the message from the call
 * it is handed and checks the signature against that; if what the wallet signs differs by one
 * field name, the contract refuses it. So the digest of the typed data built here is compared
 * with the digest computed the way EscrowContract.sol and OfferVault.sol compute it.
 */

import { ethers } from 'ethers';
import {
  SIGNED_ACTIONS,
  SIGNATURE_LIFETIME_SECONDS,
  SignedActionName,
  SignedCallDomain,
  forgetSignedCallSupport,
  isSignedAction,
  namedArguments,
  newNonce,
  raiseDisputeSigned,
  sendSignedAction,
  signedCallSupport,
  typedDataFor
} from '@/lib/signedActions';

const CONTRACT = '0x9a4264B3173FA692bDd159cB226e4ae491e2989c';
const BUYER = '0x54b8AbfCfb942A77d01dc24478526AE3aC950A00';
const OTHER = '0x000000000000000000000000000000000000CA4D';
const DOMAIN: SignedCallDomain = { name: 'Stabledrop', version: '1', chainId: 8453, verifyingContract: CONTRACT };

const escrow = new ethers.Interface([
  'function raiseDispute()',
  'function submitResolutionVote(uint256 _buyerPercentage)',
  'function nominateArbiter(address candidate)',
  'function evictArbiter()',
  'function resignArbiter()',
  'function changeRecipient(address newSeller)',
  'function approveRecipientTransfer(address operator, address newRecipient)',
  // OfferVault.sol's
  'function accept()',
  'function reject()'
]);

// The message types exactly as EscrowContract.sol and OfferVault.sol declare them.
const CONTRACT_TYPES: Record<SignedActionName, string> = {
  raiseDispute: 'RaiseDispute(uint256 nonce,uint256 deadline)',
  submitResolutionVote: 'Vote(uint256 refundToBuyerPercent,uint256 nonce,uint256 deadline)',
  nominateArbiter: 'NominateArbiter(address candidate,uint256 nonce,uint256 deadline)',
  evictArbiter: 'EvictArbiter(uint256 nonce,uint256 deadline)',
  resignArbiter: 'ResignArbiter(uint256 nonce,uint256 deadline)',
  changeRecipient: 'ChangeRecipient(address newRecipient,uint256 nonce,uint256 deadline)',
  approveRecipientTransfer: 'ApproveRecipientTransfer(address operator,address newRecipient,uint256 nonce,uint256 deadline)',
  accept: 'AcceptOffer(uint256 nonce,uint256 deadline)',
  reject: 'RejectOffer(uint256 nonce,uint256 deadline)'
};

const ARGS: Record<SignedActionName, unknown[]> = {
  raiseDispute: [],
  submitResolutionVote: [30],
  nominateArbiter: [OTHER],
  evictArbiter: [],
  resignArbiter: [],
  changeRecipient: [OTHER],
  approveRecipientTransfer: [OTHER, BUYER],
  accept: [],
  reject: []
};

/** keccak256(0x1901 ‖ domainSeparator ‖ keccak256(typeHash ‖ call arguments ‖ nonce ‖ deadline)), as the contract does it. */
function digestTheContractChecks(action: SignedActionName, nonce: string, deadline: string): string {
  const call = escrow.encodeFunctionData(action, ARGS[action].map(a => (typeof a === 'string' ? a.toLowerCase() : a)));
  const structHash = ethers.keccak256(
    ethers.concat([
      ethers.id(CONTRACT_TYPES[action]),
      ethers.dataSlice(call, 4),
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [nonce, deadline])
    ])
  );
  return ethers.keccak256(
    ethers.concat(['0x1901', ethers.TypedDataEncoder.hashDomain({ ...DOMAIN, verifyingContract: CONTRACT.toLowerCase() }), structHash])
  );
}

const actions = Object.keys(SIGNED_ACTIONS) as SignedActionName[];

describe('what the wallet signs is what the contract checks', () => {
  it.each(actions)('%s', action => {
    const typed = typedDataFor(DOMAIN, action, namedArguments(action, ARGS[action]), '7', '4102444800');
    const { EIP712Domain: _domain, ...types } = typed.types;

    expect(ethers.TypedDataEncoder.hash(typed.domain, types as any, typed.message)).toBe(
      digestTheContractChecks(action, '7', '4102444800')
    );
    expect(ethers.TypedDataEncoder.from(types as any).encodeType(typed.primaryType)).toBe(CONTRACT_TYPES[action]);
  });

  it('a signature over it recovers to the signer, bound to this contract and chain', async () => {
    const wallet = new ethers.Wallet('0x' + '11'.repeat(32));
    const typed = typedDataFor(DOMAIN, 'submitResolutionVote', { refundToBuyerPercent: 30 }, '7', '4102444800');
    const { EIP712Domain: _domain, ...types } = typed.types;
    const signature = await wallet.signTypedData(typed.domain, types as any, typed.message);

    expect(ethers.recoverAddress(digestTheContractChecks('submitResolutionVote', '7', '4102444800'), signature)).toBe(wallet.address);
    const elsewhere = { ...DOMAIN, verifyingContract: OTHER.toLowerCase() };
    expect(ethers.verifyTypedData(elsewhere, types as any, typed.message, signature)).not.toBe(wallet.address);
  });

  it('names the fields the wallet will show', () => {
    const typed = typedDataFor(DOMAIN, 'submitResolutionVote', { refundToBuyerPercent: 30 }, '7', '4102444800');
    expect(typed.primaryType).toBe('Vote');
    expect(typed.message).toEqual({ refundToBuyerPercent: 30, nonce: '7', deadline: '4102444800' });
    expect(typed.domain.name).toBe('Stabledrop');
  });

  it('hands the wallet lower-case addresses, which carry no checksum for it to reject', () => {
    // Mixed case with a wrong checksum, as a record or a person might supply it.
    const typed = typedDataFor({ ...DOMAIN, verifyingContract: CONTRACT }, 'nominateArbiter', { candidate: BUYER }, '7', '4102444800');
    expect(typed.message.candidate).toBe(BUYER.toLowerCase());
    expect(typed.domain.verifyingContract).toBe(CONTRACT.toLowerCase());
  });

  it('knows which contract each action is made on, so one is never sent to the other', () => {
    expect(isSignedAction('accept', 'vault')).toBe(true);
    expect(isSignedAction('accept', 'escrow')).toBe(false);
    expect(isSignedAction('submitResolutionVote', 'vault')).toBe(false);
    expect(isSignedAction('approveRecipientTransfer', 'escrow')).toBe(true);
    expect(isSignedAction('withdraw', 'vault')).toBe(false);
  });

  it('refuses arguments that are not what the action takes', () => {
    expect(() => namedArguments('submitResolutionVote', [])).toThrow();
    expect(() => namedArguments('submitResolutionVote', [30.5])).toThrow();
    expect(() => namedArguments('submitResolutionVote', [-1])).toThrow();
    expect(() => namedArguments('nominateArbiter', ['the arbiter'])).toThrow();
    expect(() => namedArguments('evictArbiter', [OTHER])).toThrow();
    expect(namedArguments('submitResolutionVote', [BigInt(30)])).toEqual({ refundToBuyerPercent: 30 });
  });

  it('makes a fresh nonce every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    nonces.forEach(nonce => expect(nonce).toMatch(/^\d{1,39}$/));
  });
});

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

function setUp(options: { supported?: boolean; deliver?: Response; simulate?: () => Promise<void> } = {}) {
  const order: string[] = [];
  const fetcher = jest.fn(async (url: string, init?: RequestInit) => {
    order.push(init?.method === 'POST' ? `post ${url}` : `get ${url}`);
    if (url.endsWith('/signed-calls')) {
      return json(200, options.supported === false ? { supported: false } : { supported: true, domain: DOMAIN });
    }
    return options.deliver ?? json(200, { success: true, transactionHash: '0xdelivered', recorded: true });
  });
  const wallet = {
    getUserAddress: jest.fn(async () => BUYER),
    simulateCall: jest.fn(async (_tx: { to: string; data: string }) => {
      order.push('simulate');
      await options.simulate?.();
    }),
    signTypedData: jest.fn(async (_typed: any, _prompt?: any) => {
      order.push('sign');
      return '0x' + 'ab'.repeat(65);
    })
  };
  return { deps: { fetcher, wallet, now: () => 1_794_000_000 }, fetcher, wallet, order };
}

const vote = { contractAddress: CONTRACT, action: 'submitResolutionVote' as const, args: [30], data: '0xf6c5558f' };
const posted = (fetcher: jest.Mock) => {
  const call = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!;
  return { url: call[0], body: JSON.parse(call[1].body) };
};

describe('sending a signed action', () => {
  beforeEach(forgetSignedCallSupport);

  it('checks the contract takes it, checks the contract would accept it, has the wallet sign, then delivers', async () => {
    const { deps, fetcher, wallet, order } = setUp();

    await expect(sendSignedAction(deps, { ...vote, prompt: { walletDescription: 'Offer 30%' } })).resolves.toBe('0xdelivered');

    expect(order).toEqual([
      `get /api/chain/contract/${CONTRACT}/signed-calls`,
      'simulate',
      'sign',
      'post /api/chain/signed/submit-resolution-vote'
    ]);
    expect(wallet.simulateCall).toHaveBeenCalledWith({ to: CONTRACT, data: '0xf6c5558f' });
    const [typed, prompt] = wallet.signTypedData.mock.calls[0];
    expect(typed.primaryType).toBe('Vote');
    expect(prompt).toEqual({ walletDescription: 'Offer 30%' });
    expect(posted(fetcher)).toEqual({
      url: '/api/chain/signed/submit-resolution-vote',
      body: {
        contractAddress: CONTRACT,
        signer: BUYER,
        refundToBuyerPercent: 30,
        nonce: typed.message.nonce,
        deadline: String(1_794_000_000 + SIGNATURE_LIFETIME_SECONDS),
        signature: '0x' + 'ab'.repeat(65)
      }
    });
  });

  it('never asks for gas', async () => {
    const { deps, fetcher } = setUp();
    await sendSignedAction(deps, vote);
    expect(fetcher.mock.calls.map(([url]) => url)).not.toContain('/api/chain/fund-wallet');
  });

  it('answers null, and asks the wallet for nothing, when the contract does not take signed actions', async () => {
    const { deps, wallet } = setUp({ supported: false });
    await expect(sendSignedAction(deps, vote)).resolves.toBeNull();
    expect(wallet.simulateCall).not.toHaveBeenCalled();
    expect(wallet.signTypedData).not.toHaveBeenCalled();
  });

  it('does not ask the person to sign what the contract would refuse', async () => {
    const refusal = new Error('execution reverted');
    const { deps, wallet, fetcher } = setUp({ simulate: async () => { throw refusal; } });

    await expect(sendSignedAction(deps, vote)).rejects.toBe(refusal);
    expect(wallet.signTypedData).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it("fails with chainservice's reason when it refuses, and does not fall back", async () => {
    const { deps } = setUp({ deliver: json(400, { success: false, transactionHash: null, error: 'That signature has already been used.' }) });
    await expect(sendSignedAction(deps, vote)).rejects.toThrow('That signature has already been used.');
  });

  it('passes a declined signature on as it is', async () => {
    const { deps, wallet, fetcher } = setUp();
    wallet.signTypedData.mockRejectedValue(new Error('User rejected the request'));
    await expect(sendSignedAction(deps, vote)).rejects.toThrow('User rejected the request');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it.each([
    ['nominateArbiter', [OTHER], 'nominate-arbiter', { candidate: OTHER }],
    ['evictArbiter', [], 'evict-arbiter', {}],
    ['resignArbiter', [], 'resign-arbiter', {}],
    ['changeRecipient', [OTHER], 'change-recipient', { newRecipient: OTHER }],
    ['approveRecipientTransfer', [OTHER, BUYER], 'approve-recipient-transfer', { operator: OTHER, newRecipient: BUYER }]
  ] as const)('%s goes to its own endpoint with its own named arguments', async (action, args, endpoint, fields) => {
    const { deps, fetcher } = setUp();
    await sendSignedAction(deps, { contractAddress: CONTRACT, action, args, data: '0x00' });
    expect(posted(fetcher).url).toBe(`/api/chain/signed/${endpoint}`);
    expect(posted(fetcher).body).toMatchObject({ contractAddress: CONTRACT, signer: BUYER, ...fields });
  });
});

describe('whether a contract takes signed actions', () => {
  beforeEach(forgetSignedCallSupport);

  it('remembers a yes, and asks again after a no', async () => {
    const yes = jest.fn(async () => json(200, { supported: true, domain: DOMAIN }));
    await signedCallSupport(CONTRACT, yes);
    await signedCallSupport(CONTRACT.toLowerCase(), yes);
    expect(yes).toHaveBeenCalledTimes(1);

    forgetSignedCallSupport();
    const no = jest.fn(async () => json(200, { supported: false }));
    await signedCallSupport(CONTRACT, no);
    await signedCallSupport(CONTRACT, no);
    expect(no).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['the check fails', async () => { throw new Error('offline'); }],
    ['the caller is signed out', async () => json(401, { error: 'Authentication required' })],
    ['the answer is not JSON', async () => ({ ok: true, status: 200, json: async () => { throw new Error('x'); } }) as unknown as Response],
    ['it says yes but gives no domain', async () => json(200, { supported: true })]
  ])('answers no, without throwing, when %s', async (_what, fetcher) => {
    await expect(signedCallSupport(CONTRACT, fetcher as any)).resolves.toBeNull();
  });
});

describe('raising a dispute by signed message', () => {
  beforeEach(forgetSignedCallSupport);
  const request = { contractAddress: CONTRACT, data: '0x6daa2d44', reason: 'Never arrived', refundPercent: 100, contractId: '6af90863a1c5f839cca35f47' };

  it('sends the signed message with the record chainservice is to write, and says whether it was written', async () => {
    const { deps, fetcher, wallet } = setUp();

    await expect(raiseDisputeSigned(deps, request)).resolves.toEqual({ transactionHash: '0xdelivered', recorded: true });

    const [typed] = wallet.signTypedData.mock.calls[0];
    expect(typed.primaryType).toBe('RaiseDispute');
    expect(posted(fetcher)).toEqual({
      url: '/api/chain/raise-dispute',
      body: {
        contractAddress: CONTRACT,
        userWalletAddress: BUYER,
        signedCall: { nonce: typed.message.nonce, deadline: typed.message.deadline, signature: '0x' + 'ab'.repeat(65) },
        reason: 'Never arrived',
        refundPercent: 100,
        databaseId: '6af90863a1c5f839cca35f47'
      }
    });
  });

  it('reports a dispute that landed but was not recorded', async () => {
    const { deps } = setUp({ deliver: json(200, { success: true, transactionHash: '0xdelivered', recorded: false }) });
    await expect(raiseDisputeSigned(deps, request)).resolves.toEqual({ transactionHash: '0xdelivered', recorded: false });
  });

  it('answers null when the contract does not take signed actions', async () => {
    const { deps, wallet } = setUp({ supported: false });
    await expect(raiseDisputeSigned(deps, request)).resolves.toBeNull();
    expect(wallet.signTypedData).not.toHaveBeenCalled();
  });

  it("fails with chainservice's reason when the dispute was refused", async () => {
    const { deps } = setUp({ deliver: json(400, { success: false, transactionHash: null, error: 'Only the buyer can do that.' }) });
    await expect(raiseDisputeSigned(deps, request)).rejects.toThrow('Only the buyer can do that.');
  });
});
