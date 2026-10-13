/**
 * How a contract's status is shown: the label and the badge colours. One definition for the
 * dashboard card and the details window, so the two always agree.
 *
 * ⚠️ THE STATUS, NOT THE CALL TO ACTION. The backend also sends `ctaLabel` ("Raise Dispute",
 *    "Claim Funds"…) — the thing the user can DO next. That belongs on a button. Shown in the
 *    status badge it read as though "Raise Dispute" were the state of an ordinary active deal.
 */
export interface ContractStatusDisplay {
  label: string;
  color: string;
}

function colorFor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-success-50 text-success-600 border-success-200';
    case 'DISPUTED':
      return 'bg-error-50 text-error-600 border-error-200';
    case 'EXPIRED':
      return 'bg-warning-50 text-warning-600 border-warning-200';
    case 'CLAIMED':
    case 'RESOLVED':
      return 'bg-secondary-50 text-secondary-600 border-secondary-200';
    case 'PENDING':
      return 'bg-primary-50 text-primary-600 border-primary-200';
    default:
      return 'bg-secondary-50 text-secondary-600 border-secondary-200';
  }
}

export function contractStatusDisplay(status: string | undefined, isPending: boolean): ContractStatusDisplay {
  // A pending contract without a status of its own is awaiting the buyer's funding.
  const displayStatus = status || (isPending ? 'PENDING' : '');
  const label = displayStatus.toUpperCase() === 'PENDING' ? 'PENDING FUNDING' : displayStatus || 'Unknown';
  return { label, color: colorFor(displayStatus || 'UNKNOWN') };
}
