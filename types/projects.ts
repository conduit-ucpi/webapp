/**
 * Types for the Projects feature (completion escrow / fan-out trees).
 * Mirrors contractfanoutservice's FanOutContract / FanOutTreeResponse documents
 * and fanOutChainService's contract reads. See PROJECTS_UI_SPEC.md (repo root).
 */

/** One payout slice of a project node; bps across a node sum to 10000. */
export interface RecipientSplit {
  /** Terminal payout wallet, or a committed child node's escrow address. */
  address: string | null;
  bps: number;
  /** Set when this slice is a committed child node in the same tree. */
  childId: string | null;
  /** Set when this slice was subcontracted into a separate loose tree. */
  childGroupId?: string | null;
}

/** One node of a project tree, as stored by contractfanoutservice. */
export interface ProjectNode {
  id: string;
  groupId: string;
  parentId: string | null;
  /** Loose-tree back-link: the tree this subcontract hangs under. */
  parentGroupId?: string | null;
  /** Loose-tree back-link: the node whose slice this subcontract fulfils. */
  parentNodeId?: string | null;
  depth: number;
  sellerEmail: string | null;
  sellerAddress: string;
  buyerEmail: string | null;
  buyerAddress: string | null;
  verifierAddress: string | null;
  amount: number;
  currency: string;
  currencySymbol: string | null;
  recipients: RecipientSplit[];
  expiryTimestamp: number;
  chainId: string | null;
  chainAddress: string | null;
  description: string;
  productName: string | null;
  createdAt: number;
  state: string;
}

/** Live on-chain state of one deployed node (fanOutChainService read). */
export type ProjectChainStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'AWAITING_VERIFICATION'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'CLAIMED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface ProjectNodeChainState {
  status: ProjectChainStatus;
  funded: boolean;
  balance?: string;
  verifier?: string | null;
  recipients?: string[];
  recipientBps?: number[];
}

/** Roles the connected wallet can hold on a node. */
export type ProjectRole = 'buyer' | 'seller' | 'verifier' | 'recipient';

/**
 * View-ready node: off-chain record merged with on-chain state and derived
 * display values. All derivation happens server-side (thin-frontend rule);
 * client components render these fields verbatim.
 */
export interface ProjectNodeView extends ProjectNode {
  chainState: ProjectNodeChainState | null;
  /** Roles the requesting wallet holds on this node. */
  viewerRoles: ProjectRole[];
  /** Platform fee for this node in base units (root nodes only; "0" for children). */
  feeBaseUnits: string;
  /** Per-recipient payout preview, net of fee, in base units (floor; last slice absorbs dust). */
  recipientPayoutsBaseUnits: string[];
}

export interface ProjectTreeView {
  groupId: string;
  nodes: ProjectNodeView[];
}

/** Request bodies the wizard submits (shapes match contractfanoutservice DTOs). */
export interface ProjectRecipientInput {
  bps: number;
  address?: string | null;
  child?: ProjectNodeInput | null;
}

export interface ProjectNodeInput {
  sellerEmail?: string | null;
  sellerAddress: string;
  buyerEmail?: string | null;
  verifierAddress?: string | null;
  amount: number;
  currency: string;
  currencySymbol?: string | null;
  expiryTimestamp: number;
  chainId?: string | null;
  description: string;
  productName?: string | null;
  recipients: ProjectRecipientInput[];
}

export interface CreateProjectRequest {
  root: ProjectNodeInput;
  serviceLink: string;
  suppressSending?: boolean;
}

export interface SubcontractRequest {
  parentNodeId: string;
  sliceIndex: number;
  tree: CreateProjectRequest;
}

export interface DeployProjectRequest {
  tokenAddress: string;
  chainId: string;
  buyerAddress: string;
  tokenDecimals?: number;
}
