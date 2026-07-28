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
  /**
   * Rollups over the whole chain — this tree plus every subcontract below it.
   * Present on list responses (roots) only; computed by contractfanoutservice.
   */
  nodeCount?: number;
  /** Contracts whose verifier has signed off (deployed ones count as settled). */
  approvedCount?: number;
  deployedCount?: number;
  /** Contracts waiting on the viewer's own approval, as their verifier. */
  awaitingYouCount?: number;
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
  chainId: string | null;
  chainAddress: string | null;
  description: string;
  productName: string | null;
  createdAt: number;
  state: string;
  /**
   * When this contract's verifier signed off on its terms. Null means not yet
   * approved — deploy refuses while any contract in the chain is unapproved.
   * Editing a node clears it, so changed terms need approving again.
   */
  markedReadyAt?: number | null;
  markedReadyBy?: string | null;
}

/** Live on-chain state of one deployed node (fanOutChainService read). */
export type ProjectChainStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'AWAITING_VERIFICATION'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'CLAIMED'
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
  /**
   * Who actually holds the buyer role — the party who can raise a dispute.
   * The recorded buyer, or for a committed child the parent node's supplier
   * (the subcontractor's client), which is what the child deploys with. The
   * record's own buyerAddress is null until deploy stamps it.
   */
  effectiveBuyerAddress: string | null;
  /** True when the buyer above is inherited from the parent node. */
  buyerFromParent: boolean;
  /** Verifier, falling back to the buyer (an unset verifier is the buyer on-chain). */
  effectiveVerifierAddress: string | null;
  /** True when the verifier above is the buyer by default rather than nominated. */
  verifierIsBuyer: boolean;
  /** Platform fee for this node in base units (root nodes only; "0" for children). */
  feeBaseUnits: string;
  /** Per-recipient payout preview, net of fee, in base units (floor; last slice absorbs dust). */
  recipientPayoutsBaseUnits: string[];
}

/**
 * A subcontract tree below the requested one, at any depth. contractfanoutservice
 * resolves the whole downstream chain — children, grandchildren and deeper — and
 * authorizes ancestors to see it, so the webapp neither re-fetches nor filters.
 */
export interface ProjectDescendantTree {
  groupId: string;
  /** Where it attaches: the tree and node whose slice it subcontracts. */
  parentGroupId: string | null;
  parentNodeId: string | null;
  description: string;
  amount: number;
  currency: string;
  currencySymbol: string;
  chainAddress: string | null;
  state: string;
  nodeCount: number;
  nodes: ProjectNode[];
}

/**
 * Whether the tree can be committed on-chain yet. A project is saved as a
 * draft first; deploying is a separate, explicit step that needs every wallet
 * address in place. Derived server-side — the client only renders it.
 */
export interface ProjectDeployment {
  /** Every node has a confirmed escrow address. */
  deployed: boolean;
  /** Some but not all nodes are deployed (a partial/failed deploy — retryable). */
  partiallyDeployed: boolean;
  /** All wallet addresses present, so a deploy can be attempted. */
  ready: boolean;
  /** Human-readable reasons the tree is not ready, for display. */
  missing: string[];
  /** Buyer recorded on the root node — who funds, and the on-chain buyer. */
  buyerAddress: string | null;
}

export interface ProjectTreeView {
  groupId: string;
  nodes: ProjectNodeView[];
  /** Every subcontract tree below this one, at any depth, keyed by groupId. */
  descendants?: Record<string, ProjectDescendantTree>;
  deployment: ProjectDeployment;
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
  /** Buyer wallet, recorded at creation so the buyer is a party to their own tree. */
  buyerAddress?: string | null;
  verifierAddress?: string | null;
  amount: number;
  currency: string;
  currencySymbol?: string | null;
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

/**
 * What the creation wizard submits. Recipient shares are given as raw dollar
 * amounts OR percentages (per `splitMode`); the server converts them to
 * canonical basis points (thin-frontend rule — the client never owns the
 * bps conversion). One draft = one node (v1 creates single-node trees).
 */
export interface ProjectDraftRecipient {
  address: string;
  /** Interpreted per splitMode: a dollar amount or a percentage. */
  value: number;
  email?: string | null;
}

export interface ProjectDraft {
  sellerAddress: string;
  sellerEmail?: string | null;
  buyerEmail?: string | null;
  /** Buyer wallet, recorded at creation so the buyer is a party to their own tree. */
  buyerAddress?: string | null;
  verifierAddress?: string | null;
  totalAmount: number;
  currency: string;
  currencySymbol?: string | null;
  chainId?: string | null;
  description: string;
  splitMode: 'amount' | 'percent';
  recipients: ProjectDraftRecipient[];
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
