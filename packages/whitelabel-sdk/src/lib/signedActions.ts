/**
 * Party actions sent as a SIGNED MESSAGE: the wallet signs, chainservice delivers and pays.
 *
 * A party with no ETH cannot call their own contract. We used to hand their wallet ETH and have
 * it send the call (fund-then-send), but nothing makes a wallet spend gas on what it asked for.
 * On a contract that has the signed route the party signs a typed message instead; chainservice
 * wraps it in `executeSigned`, sends it and pays; the contract checks the signature and acts for
 * the signer. No ETH reaches the wallet. (GAS_SPONSORSHIP_PLAN.md)
 *
 * ⚠️ NOT EVERY CONTRACT HAS IT. Contracts created before the route do not, and never will. So
 *    every caller asks `signedCallSupport` first and keeps the older route for a "no".
 *
 * Two kinds of contract take them: the payment contract (votes, the arbiter and recipient
 * actions) and the marketplace's offer vault (the seller accepts or rejects an offer). Each takes
 * only its own actions, so every action below names the contract it belongs to.
 *
 * ⚠️ THE TYPES BELOW ARE THE CONTRACT'S, WORD FOR WORD (`_signedMessage` in EscrowContract.sol
 *    and OfferVault.sol, and SignedCallService in chainservice). The wallet shows these field names to the person
 *    signing, and the contract rebuilds the same message to check the signature: a renamed
 *    field, a reordered one or a changed type is a signature the contract refuses.
 */

/** The contract function each action calls. */
export type SignedActionName =
  | 'raiseDispute'
  | 'submitResolutionVote'
  | 'nominateArbiter'
  | 'evictArbiter'
  | 'resignArbiter'
  | 'changeRecipient'
  | 'approveRecipientTransfer'
  | 'accept'
  | 'reject';

/** The contract an action is made on: the payment contract, or an offer on it. */
export type SignedActionContract = 'escrow' | 'vault';

interface Field {
  name: string;
  type: 'uint256' | 'address';
}

interface ActionSpec {
  contract: SignedActionContract;
  /** The EIP-712 message type: what the wallet shows as the thing being signed. */
  primaryType: string;
  /** The action's own arguments, in the order the contract function takes them. */
  fields: Field[];
  /** The route under /api/chain/signed/. Null for raiseDispute, which has its own. */
  endpoint: string | null;
}

export const SIGNED_ACTIONS: Record<SignedActionName, ActionSpec> = {
  raiseDispute: { contract: 'escrow', primaryType: 'RaiseDispute', fields: [], endpoint: null },
  submitResolutionVote: {
    contract: 'escrow',
    primaryType: 'Vote',
    fields: [{ name: 'refundToBuyerPercent', type: 'uint256' }],
    endpoint: 'submit-resolution-vote'
  },
  nominateArbiter: {
    contract: 'escrow',
    primaryType: 'NominateArbiter',
    fields: [{ name: 'candidate', type: 'address' }],
    endpoint: 'nominate-arbiter'
  },
  evictArbiter: { contract: 'escrow', primaryType: 'EvictArbiter', fields: [], endpoint: 'evict-arbiter' },
  resignArbiter: { contract: 'escrow', primaryType: 'ResignArbiter', fields: [], endpoint: 'resign-arbiter' },
  changeRecipient: {
    contract: 'escrow',
    primaryType: 'ChangeRecipient',
    fields: [{ name: 'newRecipient', type: 'address' }],
    endpoint: 'change-recipient'
  },
  approveRecipientTransfer: {
    contract: 'escrow',
    primaryType: 'ApproveRecipientTransfer',
    fields: [
      { name: 'operator', type: 'address' },
      { name: 'newRecipient', type: 'address' }
    ],
    endpoint: 'approve-recipient-transfer'
  },
  // The offer vault's. Signed under the VAULT's domain: `contractAddress` is the vault.
  accept: { contract: 'vault', primaryType: 'AcceptOffer', fields: [], endpoint: 'accept-offer' },
  reject: { contract: 'vault', primaryType: 'RejectOffer', fields: [], endpoint: 'reject-offer' }
};

/**
 * Whether [name] is a signed action, on [contract] when one is given. A vault and an escrow never
 * share an action here, but the question is asked by contract so that one cannot be sent to the other.
 */
export function isSignedAction(name: string, contract?: SignedActionContract): name is SignedActionName {
  if (!Object.prototype.hasOwnProperty.call(SIGNED_ACTIONS, name)) return false;
  return contract === undefined || SIGNED_ACTIONS[name as SignedActionName].contract === contract;
}

/** The EIP-712 domain a contract's signed messages are bound to, as chainservice reports it. */
export interface SignedCallDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/** What travels with every signed action besides its own arguments. */
export interface SignedMessage {
  nonce: string;
  deadline: string;
  signature: string;
}

export interface TypedData {
  types: Record<string, Field[] | Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: SignedCallDomain;
  message: Record<string, string | number>;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Browser-console trace of a signed action, one line per step, so a first run can be followed. */
function trace(step: string, detail?: unknown): void {
  if (detail === undefined) console.log(`[signed-action] ${step}`);
  else console.log(`[signed-action] ${step}`, detail);
}

/** How long a signed message may be delivered for. Long enough for a slow chain, no longer. */
export const SIGNATURE_LIFETIME_SECONDS = 10 * 60;

/**
 * A nonce nobody has used: 128 random bits, as a decimal string. The contract takes any number a
 * signer has not spent on it before; random rather than counted, so two tabs cannot collide.
 */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let value = BigInt(0);
  bytes.forEach(byte => {
    value = (value << BigInt(8)) | BigInt(byte);
  });
  return value.toString();
}

/** The contract function's positional arguments, as the message's named fields. */
export function namedArguments(action: SignedActionName, args: readonly unknown[]): Record<string, string | number> {
  const { fields } = SIGNED_ACTIONS[action];
  if (args.length !== fields.length) {
    throw new Error(`${action} takes ${fields.length} argument(s), not ${args.length}`);
  }
  const named: Record<string, string | number> = {};
  fields.forEach((field, index) => {
    const value = args[index];
    if (field.type === 'address') {
      if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
        throw new Error(`${field.name} is not an address`);
      }
      named[field.name] = value;
    } else {
      const number = typeof value === 'bigint' ? Number(value) : value;
      if (typeof number !== 'number' || !Number.isInteger(number) || number < 0) {
        throw new Error(`${field.name} is not a whole number`);
      }
      named[field.name] = number;
    }
  });
  return named;
}

/**
 * The typed data a wallet signs for [action]: the message type's fields are the action's
 * arguments, then `nonce`, then `deadline`, under the contract's own domain.
 */
export function typedDataFor(
  domain: SignedCallDomain,
  action: SignedActionName,
  named: Record<string, string | number>,
  nonce: string,
  deadline: string
): TypedData {
  const spec = SIGNED_ACTIONS[action];
  // Lower-case every address. A wallet checks the checksum of a mixed-case address and refuses
  // one that is wrong, and addresses reach us in whatever case a record or a person gave them.
  // Lower case carries no checksum to get wrong, and hashes to exactly the same message.
  const lower = (value: string | number) => (typeof value === 'string' ? value.toLowerCase() : value);
  const message: Record<string, string | number> = {};
  spec.fields.forEach(field => {
    message[field.name] = field.type === 'address' ? lower(named[field.name]) : named[field.name];
  });
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      [spec.primaryType]: [...spec.fields, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }]
    },
    primaryType: spec.primaryType,
    domain: { ...domain, verifyingContract: domain.verifyingContract.toLowerCase() },
    message: { ...message, nonce, deadline }
  };
}

// A deployed contract's answer does not change, so a "yes" is kept for the life of the page.
// A "no" is not: the same address answers differently once a counterfactual contract is deployed.
const supported = new Map<string, SignedCallDomain>();

/** For tests. */
export function forgetSignedCallSupport(): void {
  supported.clear();
}

/**
 * The domain to sign under if [contractAddress] takes signed actions, or null if it does not.
 *
 * ⚠️ NEVER THROWS. "Could not tell" is answered like "no": the older route still works for
 *    every contract, so a failed check must fall back to it, not block the action.
 */
export async function signedCallSupport(contractAddress: string, fetcher: Fetcher): Promise<SignedCallDomain | null> {
  const key = contractAddress.toLowerCase();
  const known = supported.get(key);
  if (known) return known;
  try {
    const response = await fetcher(`/api/chain/contract/${contractAddress}/signed-calls`);
    if (!response.ok) {
      trace(`support check for ${contractAddress} answered ${response.status}: using the older route`);
      return null;
    }
    const answer = await response.json();
    if (!answer?.supported || !answer.domain) {
      trace(`${contractAddress} does not take signed actions: using the older route`);
      return null;
    }
    trace(`${contractAddress} takes signed actions`, answer.domain);
    supported.set(key, answer.domain as SignedCallDomain);
    return answer.domain as SignedCallDomain;
  } catch (error) {
    trace(`support check for ${contractAddress} failed: using the older route`, error);
    return null;
  }
}

/** What the wallet side has to be able to do. Web3Service does; tests pass a stand-in. */
export interface SigningWallet {
  getUserAddress(): Promise<string>;
  /** Runs the call from the user's address without sending it; throws if the contract would refuse. */
  simulateCall(tx: { to: string; data: string }): Promise<void>;
  signTypedData(
    typedData: TypedData,
    prompt?: { summary?: string; walletDescription?: string; movesFunds?: boolean }
  ): Promise<string>;
}

export interface SignedActionDeps {
  fetcher: Fetcher;
  wallet: SigningWallet;
  /** Unix seconds. Injected so a test can hold the clock still. */
  now?: () => number;
}

export interface SignedActionRequest {
  contractAddress: string;
  action: SignedActionName;
  /** The contract function's arguments, in order. */
  args: readonly unknown[];
  /** The encoded direct call, used only to check the contract would accept it before signing. */
  data: string;
  prompt?: { summary?: string; walletDescription?: string; movesFunds?: boolean };
}

async function sign(
  deps: SignedActionDeps,
  domain: SignedCallDomain,
  request: SignedActionRequest
): Promise<{ signer: string; named: Record<string, string | number>; message: SignedMessage }> {
  const named = namedArguments(request.action, request.args);

  // ⚠️ ASK THE CONTRACT BEFORE ASKING THE PERSON. A direct call from this wallet meets the same
  //    checks the signed one will, so if it would be refused (not a party, no open dispute) say
  //    so now, with the contract's own reason, rather than have them sign something doomed.
  trace(`${request.action}: checking the contract would accept it`, named);
  await deps.wallet.simulateCall({ to: request.contractAddress, data: request.data });

  const signer = await deps.wallet.getUserAddress();
  const nonce = newNonce();
  const seconds = (deps.now ?? (() => Math.floor(Date.now() / 1000)))();
  const deadline = String(seconds + SIGNATURE_LIFETIME_SECONDS);
  const typedData = typedDataFor(domain, request.action, named, nonce, deadline);
  trace(`${request.action}: asking the wallet of ${signer} to sign`, typedData);
  const signature = await deps.wallet.signTypedData(typedData, request.prompt);
  trace(`${request.action}: signed (${(signature.length - 2) / 2} bytes)`);
  return { signer, named, message: { nonce, deadline, signature } };
}

async function answerOf(response: Response): Promise<{ success?: boolean; transactionHash?: string | null; error?: string; recorded?: boolean | null }> {
  return response.json().catch(() => ({}));
}

/**
 * Send a party action as a signed message.
 *
 * Resolves with the transaction hash once chainservice has seen it succeed on chain, or with
 * NULL when this contract does not take signed actions: the caller then uses the older route.
 * Throws when the contract would refuse, the person declines to sign, or chainservice refuses.
 */
export async function sendSignedAction(deps: SignedActionDeps, request: SignedActionRequest): Promise<string | null> {
  const { endpoint } = SIGNED_ACTIONS[request.action];
  if (!endpoint) throw new Error(`${request.action} is not sent through sendSignedAction`);

  const domain = await signedCallSupport(request.contractAddress, deps.fetcher);
  if (!domain) return null;

  const { signer, named, message } = await sign(deps, domain, request);
  const response = await deps.fetcher(`/api/chain/signed/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractAddress: request.contractAddress, signer, ...named, ...message })
  });
  const answer = await answerOf(response);
  trace(`${request.action}: /api/chain/signed/${endpoint} answered ${response.status}`, answer);
  if (!response.ok || !answer.success || !answer.transactionHash) {
    throw new Error(answer.error || 'That could not be sent. Nothing was changed; try again.');
  }
  return answer.transactionHash;
}

/**
 * Raise a dispute as a signed message. chainservice delivers it AND records it: pass the record's
 * id, the reason and the figure, and do not record it separately.
 *
 * Resolves with the hash and whether the record was written (`false`: the dispute is on chain
 * but the record is not, so write it again, never raise again), or NULL when this contract does
 * not take signed actions.
 */
export async function raiseDisputeSigned(
  deps: SignedActionDeps,
  request: {
    contractAddress: string;
    data: string;
    reason: string;
    refundPercent: number;
    contractId?: string;
    prompt?: { summary?: string; walletDescription?: string; movesFunds?: boolean };
  }
): Promise<{ transactionHash: string; recorded: boolean | null } | null> {
  const domain = await signedCallSupport(request.contractAddress, deps.fetcher);
  if (!domain) return null;

  const { signer, message } = await sign(deps, domain, {
    contractAddress: request.contractAddress,
    action: 'raiseDispute',
    args: [],
    data: request.data,
    prompt: request.prompt
  });
  const response = await deps.fetcher('/api/chain/raise-dispute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractAddress: request.contractAddress,
      userWalletAddress: signer,
      signedCall: message,
      reason: request.reason,
      refundPercent: request.refundPercent,
      ...(request.contractId ? { databaseId: request.contractId } : {})
    })
  });
  const answer = await answerOf(response);
  trace(`raiseDispute: /api/chain/raise-dispute answered ${response.status}`, answer);
  if (!response.ok || !answer.success || !answer.transactionHash) {
    throw new Error(answer.error || 'The dispute could not be raised. Nothing was changed; try again.');
  }
  return { transactionHash: answer.transactionHash, recorded: answer.recorded ?? null };
}
