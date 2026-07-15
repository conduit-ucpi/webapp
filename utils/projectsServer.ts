/**
 * Server-side orchestration for the Projects feature. Used ONLY by
 * pages/api/projects/* routes: talks to contractfanoutservice (off-chain tree
 * records) and fanOutChainService (chain reads/ops), merges the results into
 * view-ready shapes, and performs every derivation the UI displays
 * (thin-frontend rule — client components render, never compute).
 */
import type { NextApiRequest } from 'next';
import {
  CreateProjectRequest,
  ProjectDraft,
  ProjectNode,
  ProjectNodeChainState,
  ProjectNodeView,
  ProjectRole,
  ProjectTreeView,
} from '@/types/projects';
import { amountsToBps, fromBaseUnits, percentToBps, splitByBps, toBaseUnits } from '@/utils/projectMath';

/**
 * Convert a wizard draft (dollar amounts or percentages per recipient) into the
 * canonical bps-based create request contractfanoutservice expects. This is the
 * authoritative $→bps conversion — it lives here, server-side, so the client
 * never owns it. Throws (surfaced as 400) on invalid splits.
 */
export function draftToCreateRequest(draft: ProjectDraft): CreateProjectRequest {
  if (!draft.recipients || draft.recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }
  const bps =
    draft.splitMode === 'percent'
      ? normalizePercents(draft.recipients.map((r) => r.value))
      : amountsToBps(draft.recipients.map((r) => r.value));

  return {
    root: {
      sellerAddress: draft.sellerAddress,
      sellerEmail: draft.sellerEmail ?? null,
      buyerEmail: draft.buyerEmail ?? null,
      verifierAddress: draft.verifierAddress ?? null,
      amount: draft.totalAmount,
      currency: draft.currency,
      currencySymbol: draft.currencySymbol ?? null,
      expiryTimestamp: draft.expiryTimestamp,
      chainId: draft.chainId ?? null,
      description: draft.description,
      recipients: draft.recipients.map((r, i) => ({ bps: bps[i], address: r.address, child: null })),
    },
    serviceLink: draft.serviceLink,
    suppressSending: draft.suppressSending ?? false,
  };
}

/** Percentages → bps summing to exactly 10000, residue on the largest share. */
function normalizePercents(percents: number[]): number[] {
  const bps = percents.map((p) => percentToBps(p));
  const residue = 10000 - bps.reduce((a, b) => a + b, 0);
  if (residue !== 0) {
    const largest = bps.indexOf(Math.max(...bps));
    bps[largest] += residue;
    if (bps[largest] <= 0) throw new Error('Percentages must sum to 100%');
  }
  return bps;
}

export function fanoutServiceUrl(): string {
  const url = process.env.FANOUT_SERVICE_URL;
  if (!url) throw new Error('FANOUT_SERVICE_URL is not configured');
  return url;
}

export function fanoutChainServiceUrl(): string {
  const url = process.env.FANOUT_CHAIN_SERVICE_URL;
  if (!url) throw new Error('FANOUT_CHAIN_SERVICE_URL is not configured');
  return url;
}

/** Standard headers for forwarding an authenticated request to a service. */
export function serviceHeaders(req: NextApiRequest, authToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    Cookie: req.headers.cookie || '',
  };
  if (process.env.X_API_KEY) headers['X-API-Key'] = process.env.X_API_KEY;
  return headers;
}

/**
 * The viewer's wallet, from the `viewer` query param. Display-only: it selects
 * which role badges/actions the UI shows. Authorization is enforced by the
 * services (party checks) and on-chain (signatures), never by this value.
 */
export function viewerWallet(req: NextApiRequest): string | null {
  const viewer = req.query.viewer;
  return typeof viewer === 'string' && viewer.startsWith('0x') ? viewer.toLowerCase() : null;
}

function rolesFor(node: ProjectNode, wallet: string | null): ProjectRole[] {
  if (!wallet) return [];
  const roles: ProjectRole[] = [];
  const is = (a: string | null | undefined) => a != null && a.toLowerCase() === wallet;
  if (is(node.buyerAddress)) roles.push('buyer');
  if (is(node.sellerAddress)) roles.push('seller');
  // An unset verifier defaults to the buyer on-chain.
  if (is(node.verifierAddress) || (!node.verifierAddress && is(node.buyerAddress))) roles.push('verifier');
  if (node.recipients.some((r) => is(r.address))) roles.push('recipient');
  return roles;
}

/** Batch-read live chain state for every deployed node of a tree. */
export async function fetchChainStates(
  req: NextApiRequest,
  authToken: string,
  nodes: ProjectNode[]
): Promise<Map<string, ProjectNodeChainState>> {
  const addresses = nodes.map((n) => n.chainAddress).filter((a): a is string => !!a);
  const states = new Map<string, ProjectNodeChainState>();
  if (addresses.length === 0) return states;

  const response = await fetch(`${fanoutChainServiceUrl()}/api/chain/contracts/batch-info`, {
    method: 'POST',
    headers: serviceHeaders(req, authToken),
    body: JSON.stringify({ contractAddresses: addresses }),
  });
  if (!response.ok) {
    console.error('projects: batch-info failed', response.status);
    return states;
  }
  const data = await response.json();
  const contracts = data.contracts || data;
  for (const address of addresses) {
    const info = contracts[address] || contracts[address.toLowerCase()];
    if (info) {
      states.set(address.toLowerCase(), {
        status: info.status || 'UNKNOWN',
        funded: !!info.funded,
        balance: info.balance,
        verifier: info.verifier ?? null,
        recipients: info.recipients,
        recipientBps: info.recipientBps,
      });
    }
  }
  return states;
}

/**
 * Platform fee for a node in base units. Top-level nodes (no parent links) pay
 * the fee; children are exempt. The formula lives in the factory contract —
 * fanOutChainService quotes it via eth_call; we never hardcode it here.
 */
export async function fetchFeeBaseUnits(
  req: NextApiRequest,
  authToken: string,
  node: ProjectNode,
  decimals: number = 6
): Promise<string> {
  const isChild = node.depth > 0 || !!node.parentNodeId;
  if (isChild) return '0';
  const amount = toBaseUnits(node.amount, decimals);
  const response = await fetch(
    `${fanoutChainServiceUrl()}/api/chain/fee-quote?amount=${amount}&isChild=false`,
    { headers: serviceHeaders(req, authToken) }
  );
  if (!response.ok) {
    throw new Error(`Fee quote failed (${response.status})`);
  }
  const data = await response.json();
  return String(data.fee);
}

/** Merge off-chain nodes, chain state, roles, fee, and payout previews. */
export async function buildTreeView(
  req: NextApiRequest,
  authToken: string,
  groupId: string,
  nodes: ProjectNode[],
  decimals: number = 6
): Promise<ProjectTreeView> {
  const wallet = viewerWallet(req);
  const chainStates = await fetchChainStates(req, authToken, nodes);

  const views: ProjectNodeView[] = await Promise.all(
    nodes.map(async (node) => {
      const feeBaseUnits = await fetchFeeBaseUnits(req, authToken, node, decimals);
      const escrow = toBaseUnits(node.amount, decimals) - BigInt(feeBaseUnits);
      const payouts = splitByBps(
        escrow,
        node.recipients.map((r) => r.bps)
      );
      return {
        ...node,
        chainState: node.chainAddress ? chainStates.get(node.chainAddress.toLowerCase()) ?? null : null,
        viewerRoles: rolesFor(node, wallet),
        feeBaseUnits,
        recipientPayoutsBaseUnits: payouts.map((p) => p.toString()),
      };
    })
  );

  return { groupId, nodes: views };
}

export { fromBaseUnits };
