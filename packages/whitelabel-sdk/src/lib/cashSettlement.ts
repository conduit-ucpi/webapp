/**
 * The "I settled in cash" shortcut (ContractActions, DisputeManagementModal).
 *
 * A buyer who paid the seller outside the escrow needs the escrow refunded. On-chain that is an
 * ordinary dispute with a 100% figure; what makes it a shortcut is the fixed reason, which every
 * layer recognises:
 *
 * - the seller's dispute screen offers a one-click "Confirm cash settlement" that matches 100%,
 * - disputeservice (policy/CashSettlement.kt) refuses to decide on the claim alone, so a buyer
 *   cannot use the button to take a refund they are not owed from a seller who is not watching.
 *
 * ⚠️ STORED IN ENGLISH REGARDLESS OF UI LANGUAGE. The string is a protocol value the services
 *    match on, not copy. Translate the button label, never this.
 */
export const SETTLED_IN_CASH_REASON = 'I settled in cash';

/** What the seller's one-click confirmation records alongside their matching 100% vote. */
export const CASH_SETTLEMENT_CONFIRMED_REASON = 'Confirmed: settled in cash';

export function isCashSettlementClaim(reason: string | null | undefined): boolean {
  return (reason ?? '').trim().toLowerCase() === SETTLED_IN_CASH_REASON.toLowerCase();
}
