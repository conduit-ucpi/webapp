/**
 * The arbiter's queue and case record, exactly as disputeservice serves them through
 * /api/admin/disputes. Presentation types only — every decision about a case is made in
 * disputeservice; the browser shows the record and relays an admin's actions.
 */

export type DisputeCaseStatus =
  | 'OPEN' | 'AWAITING_SEAT' | 'AWAITING_RESPONSE' | 'HOLD' | 'READY_TO_EXECUTE' | 'PROPOSED'
  | 'VOTED_AWAITING_MATCH' | 'EXECUTED' | 'ESCALATED' | 'OUT_OF_SCOPE' | 'UNREADABLE' | 'SETTLED' | 'DEPARTED';

export interface DisputeSummary {
  contractId: string;
  escrowAddress: string | null;
  description: string;
  amountMicro: number | string;
  maturity: number;
  daysPastMaturity: number;
  status: DisputeCaseStatus | null;
  caseApplied: string | null;
  buyerPercentage: number | null;
  escalationReason: string | null;
  responseDeadline: number | null;
  holdDeadline: number | null;
  safeTxHash: string | null;
}

export interface DisputeNotice {
  kind: string;
  party: 'buyer' | 'seller';
  recipientWallet: string | null;
  channel: string;
  sentAt: number;
  messageId: string | null;
  outcome: 'sent' | 'failed' | 'no-address';
  deadline: number | null;
}

export interface DisputeDecisionRecord {
  at: number;
  decider: string;
  deciderVersion: string;
  action: string;
  caseApplied: string | null;
  buyerPercentage: number | null;
  confidence: string | null;
  reasoning: string;
  evidenceRelied: string[];
  inputsHash: string;
}

export interface DisputeCaseEvent {
  at: number;
  type: string;
  detail: string | null;
}

export interface DisputeCase {
  status: DisputeCaseStatus;
  escrowAddress: string | null;
  openedAt: number;
  seatedAt: number | null;
  responseDeadline: number | null;
  holdDeadline: number | null;
  action: string | null;
  caseApplied: string | null;
  buyerPercentage: number | null;
  reasoning: string | null;
  escalationReason: string | null;
  safeTxHash: string | null;
  executionTxHash: string | null;
  reachability: Record<string, string>;
  notices: DisputeNotice[];
  decisions: DisputeDecisionRecord[];
  events: DisputeCaseEvent[];
  version: number;
  updatedAt: number;
}

export interface DisputeFiling {
  party: 'BUYER' | 'SELLER';
  reason: string;
  refundPercent: number | null;
  timestamp: number;
  wallet: string | null;
}

export interface DisputeFacts {
  contractId: string;
  escrowAddress: string;
  description: string;
  currency: string;
  amountMicro: number | string;
  expiryTimestamp: number;
  daysPastMaturity: number;
  filings: DisputeFiling[];
  chain: {
    status: string | null;
    seated: boolean;
    isDefaultArbiter: boolean | null;
    buyerVote: number | null;
    sellerVote: number | null;
    arbiterVote: number | null;
    consensusReached: boolean | null;
    buyer: string | null;
    seller: string | null;
  };
  reachability: Record<string, string>;
}

export interface DisputeCaseDetail {
  facts: DisputeFacts;
  disputeCase: DisputeCase | null;
}

export interface ReleaseResult {
  proposed: string[];
  rejected: Record<string, string>;
  safeTxHash: string | null;
  safeAppUrl: string | null;
  nonce: number | null;
  error: string | null;
}

export interface SweepSummary {
  at: number;
  queued: number;
  processed: number;
  changed: number;
  failed: number;
  results: Array<{ contractId: string; before: string | null; after: string; note: string | null }>;
}

/** Colour by what the operator has to do about it, not by alphabet. */
export function disputeStatusColor(status: DisputeCaseStatus | null): string {
  switch (status) {
    case 'ESCALATED':
      return 'bg-red-100 text-red-800';
    case 'READY_TO_EXECUTE':
      return 'bg-orange-100 text-orange-800';
    case 'HOLD':
    case 'PROPOSED':
    case 'VOTED_AWAITING_MATCH':
      return 'bg-blue-100 text-blue-800';
    case 'AWAITING_SEAT':
    case 'AWAITING_RESPONSE':
    case 'OPEN':
      return 'bg-yellow-100 text-yellow-800';
    case 'EXECUTED':
    case 'SETTLED':
      return 'bg-green-100 text-green-800';
    case 'OUT_OF_SCOPE':
    case 'UNREADABLE':
    case 'DEPARTED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}
