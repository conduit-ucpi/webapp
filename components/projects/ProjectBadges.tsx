import { ProjectChainStatus, ProjectRole } from '@/types/projects';

/** Human labels + tones for a node's on-chain status. */
const STATUS_META: Record<ProjectChainStatus | 'OFFCHAIN', { label: string; tone: string }> = {
  OFFCHAIN: { label: 'Not deployed', tone: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300' },
  CREATED: { label: 'Awaiting deposit', tone: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300' },
  ACTIVE: { label: 'Funded', tone: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  AWAITING_VERIFICATION: { label: 'Awaiting verification', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  DISPUTED: { label: 'Disputed', tone: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  RESOLVED: { label: 'Resolved', tone: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  CLAIMED: { label: 'Paid out', tone: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  UNKNOWN: { label: 'Unknown', tone: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300' },
};

const ROLE_LABEL: Record<ProjectRole, string> = {
  buyer: 'Buyer',
  seller: 'Supplier',
  verifier: 'Verifier',
  recipient: 'Recipient',
};

export function StatusBadge({ status }: { status: ProjectChainStatus | null }) {
  const meta = STATUS_META[status ?? 'OFFCHAIN'] ?? STATUS_META.UNKNOWN;
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>;
}

/**
 * Whether one contract's verifier has signed its terms off. Carries a glyph and
 * a word, so approval never reads as colour alone. Deployed contracts don't get
 * one — their terms are settled and the status badge already says so.
 */
export function ApprovalBadge({ approved }: { approved: boolean }) {
  const tone = approved
    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      <span aria-hidden="true">{approved ? '✓' : '○'}</span>
      {approved ? 'Verified' : 'Not verified'}
    </span>
  );
}

export function RoleBadges({ roles }: { roles: ProjectRole[] }) {
  if (!roles.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r}
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-secondary-900 text-white dark:bg-white dark:text-secondary-900"
        >
          {ROLE_LABEL[r]}
        </span>
      ))}
    </span>
  );
}
