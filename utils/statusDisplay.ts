/**
 * Single source of truth for showing contract statuses to users.
 * Backend statuses are technical enums (ACTIVE, CLAIMED, ...); users should
 * see plain language. Keep every user-facing surface (cards, modals, badges)
 * on this map so the wording can't drift between components.
 */

export interface StatusDisplay {
  /** Human label, e.g. "Payment secured" */
  label: string;
  /** Tailwind classes for the status pill */
  color: string;
}

const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  ACTIVE: {
    label: 'Payment secured',
    color: 'bg-success-50 text-success-600 border-success-200',
  },
  PENDING: {
    label: 'Awaiting payment',
    color: 'bg-primary-50 text-primary-600 border-primary-200',
  },
  CREATED: {
    label: 'Awaiting payment',
    color: 'bg-primary-50 text-primary-600 border-primary-200',
  },
  EXPIRED: {
    label: 'Ready to claim',
    color: 'bg-warning-50 text-warning-600 border-warning-200',
  },
  DISPUTED: {
    label: 'Under review',
    color: 'bg-error-50 text-error-600 border-error-200',
  },
  CLAIMED: {
    label: 'Paid out',
    color: 'bg-secondary-50 text-secondary-600 border-secondary-200',
  },
  RESOLVED: {
    label: 'Dispute resolved',
    color: 'bg-secondary-50 text-secondary-600 border-secondary-200',
  },
  ERROR: {
    label: 'Needs attention',
    color: 'bg-error-50 text-error-600 border-error-200',
  },
};

const UNKNOWN_DISPLAY: StatusDisplay = {
  label: 'Unknown',
  color: 'bg-secondary-50 text-secondary-600 border-secondary-200',
};

export function getStatusDisplay(status: string | undefined | null): StatusDisplay {
  if (!status) return UNKNOWN_DISPLAY;
  return STATUS_DISPLAY[status.toUpperCase()] || { ...UNKNOWN_DISPLAY, label: status };
}
