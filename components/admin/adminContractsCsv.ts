import { PendingContract } from '@/types';
import { toCsv } from '@/utils/csv';

/**
 * The admin page's Local Database Contracts list as a CSV for colleagues: the rows the list is
 * showing (search, status and date range applied, every page, in the list's order).
 *
 * Dates are UTC ISO-8601 so a colleague in another timezone reads the same instant, and amounts
 * are in whole tokens: contractservice stores micro-units (6 decimals) for every token.
 */

const HEADER = [
  'Payment ID',
  'Created (UTC)',
  'Status',
  'Amount',
  'Token',
  'Seller email',
  'Buyer email',
  'Seller wallet',
  'Buyer wallet',
  'Third voter wallet',
  'Third voter email',
  'Payout date (UTC)',
  'Description',
  'Escrow address',
  'Chain ID',
  'Brand'
];

/** Seconds or milliseconds, as the list itself accepts; blank when absent or unreadable. */
function utc(timestamp: number | string | null | undefined): string {
  const n = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (!n || !Number.isFinite(n) || n <= 0) return '';
  const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

export function buildAdminContractsCsv(
  contracts: PendingContract[],
  statusOf: (contract: PendingContract) => string
): string {
  return toCsv(
    HEADER,
    contracts.map((c) => [
      c.id,
      utc(c.createdAt),
      statusOf(c),
      typeof c.amount === 'number' ? c.amount / 1_000_000 : null,
      c.currencySymbol || 'USDC',
      c.sellerEmail,
      c.buyerEmail,
      c.sellerAddress,
      c.buyerAddress,
      c.arbiterAddress,
      c.arbiterEmail,
      utc(c.expiryTimestamp),
      c.description,
      c.chainAddress,
      c.chainId,
      c.brandId
    ])
  );
}

/** e.g. stabledrop-contracts-month-2026-10-09.csv */
export function adminContractsCsvFilename(range: string, now = new Date()): string {
  return `stabledrop-contracts-${range.toLowerCase()}-${now.toISOString().slice(0, 10)}.csv`;
}
