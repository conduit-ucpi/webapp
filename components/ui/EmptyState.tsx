import { ReactNode } from 'react';
import Button from './Button';
import Link from 'next/link';

interface EmptyStateProps {
  illustration?: ReactNode;
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function EmptyState({
  illustration,
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-16 px-4 ${className}`}>
      {illustration ? (
        <div className="mx-auto w-24 h-24 mb-6">
          {illustration}
        </div>
      ) : icon && (
        <div className="mx-auto h-16 w-16 text-primary-400 mb-6">
          {icon}
        </div>
      )}
      
      <h3 className="text-xl font-semibold text-secondary-900 mb-3">
        {title}
      </h3>
      
      <p className="text-base text-secondary-600 mb-8 max-w-lg mx-auto leading-relaxed">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {action && (
          action.href ? (
            <Link href={action.href}>
              <Button className="w-full sm:w-auto min-h-[48px] px-6">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button 
              onClick={action.onClick}
              className="w-full sm:w-auto min-h-[48px] px-6"
            >
              {action.label}
            </Button>
          )
        )}
        
        {secondaryAction && (
          secondaryAction.href ? (
            <Link href={secondaryAction.href}>
              <Button variant="outline" className="w-full sm:w-auto min-h-[48px] px-6">
                {secondaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button 
              variant="outline"
              onClick={secondaryAction.onClick}
              className="w-full sm:w-auto min-h-[48px] px-6"
            >
              {secondaryAction.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// Illustration components for better visual appeal
function ContractIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="#f0fdf4" />
      <rect x="28" y="20" width="40" height="52" rx="4" fill="white" stroke="#d1d5db" strokeWidth="2" />
      <rect x="32" y="28" width="24" height="3" rx="1.5" fill="#10b981" />
      <rect x="32" y="36" width="32" height="2" rx="1" fill="#e5e7eb" />
      <rect x="32" y="42" width="28" height="2" rx="1" fill="#e5e7eb" />
      <rect x="32" y="48" width="24" height="2" rx="1" fill="#e5e7eb" />
      <circle cx="56" cy="60" r="8" fill="#10b981" />
      <path d="m52 60 2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="#fef3c7" />
      <circle cx="42" cy="42" r="14" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <path d="m52 52 8 8" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="42" r="8" fill="#fbbf24" opacity="0.2" />
    </svg>
  );
}

function ErrorIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="#fef2f2" />
      <circle cx="48" cy="48" r="20" fill="none" stroke="#ef4444" strokeWidth="3" />
      <path d="M48 40v8m0 4h.01" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterEmptyIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="#eff6ff" />
      <path d="M24 32h48l-16 16v12l-8 4v-16L24 32z" fill="#3b82f6" opacity="0.7" />
      <circle cx="64" cy="24" r="8" fill="#f3f4f6" stroke="#6b7280" strokeWidth="2" />
      <path d="m62 24 2 2 4-4" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Pre-configured empty states for common scenarios
export function NoContractsEmptyState({ 
  userRole, 
  onShowDemo 
}: { 
  userRole: 'buyer' | 'seller' | 'any';
  onShowDemo?: () => void;
}) {
  const messages = {
    buyer: {
      title: "Ready to receive payments",
      description: "When someone sends you a payment request, it will appear here. You'll get an email notification and can accept or decline the request safely."
    },
    seller: {
      title: "Start getting paid securely",
      description: "Create your first payment request to start receiving protected payments. Your buyers will get an email notification and can pay with confidence knowing funds are secured."
    },
    any: {
      title: "Your payment agreements await",
      description: "This is where all your secure payment contracts will appear. Create a payment request or wait for someone to send you one - either way, your funds are protected."
    }
  };

  const message = messages[userRole];

  return (
    <EmptyState
      illustration={<ContractIllustration />}
      title={message.title}
      description={message.description}
      action={
        userRole === 'seller' || userRole === 'any' ? {
          label: "Create Payment Request",
          href: "/create"
        } : undefined
      }
      secondaryAction={
        onShowDemo ? {
          label: "View Demo Data",
          onClick: onShowDemo
        } : {
          label: "See How It Works",
          href: "/#how-it-works"
        }
      }
    />
  );
}

export function SearchEmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <EmptyState
      illustration={<SearchIllustration />}
      title="No matches found"
      description={`We couldn't find any contracts matching "${searchTerm}". Try adjusting your search terms or browse all contracts instead.`}
      secondaryAction={{
        label: "Clear Search",
        onClick: () => {
          const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }}
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      illustration={<ErrorIllustration />}
      title="Connection trouble"
      description="We're having trouble loading your contracts right now. This could be due to a temporary network issue or server maintenance."
      action={{
        label: "Try Again",
        onClick: onRetry
      }}
      secondaryAction={{
        label: "Check Status",
        href: "mailto:support@conduit.example.com?subject=Connection Issues"
      }}
    />
  );
}

// New filtered view empty states
export function ActiveContractsEmptyState() {
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title="No active contracts"
      description="You don't have any active payment contracts right now. Active contracts are those where funds have been deposited and are awaiting completion or dispute."
      action={{
        label: "Create Payment Request",
        href: "/create"
      }}
      secondaryAction={{
        label: "View All Contracts",
        onClick: () => {
          const allTab = document.querySelector('[data-tab="ALL"]') as HTMLElement;
          if (allTab) allTab.click();
        }
      }}
    />
  );
}

export function ActionNeededEmptyState() {
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title="All caught up!"
      description="Great news! You don't have any contracts requiring immediate action. No expired contracts to claim, no active contracts to dispute."
      secondaryAction={{
        label: "View All Contracts",
        onClick: () => {
          const allTab = document.querySelector('[data-tab="ALL"]') as HTMLElement;
          if (allTab) allTab.click();
        }
      }}
    />
  );
}

export function CompletedContractsEmptyState() {
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title="No completed contracts yet"
      description="Once your payment contracts are successfully fulfilled (either claimed by sellers or resolved through disputes), they'll appear here."
      action={{
        label: "Create Payment Request",
        href: "/create"
      }}
      secondaryAction={{
        label: "View Active Contracts",
        onClick: () => {
          const activeTab = document.querySelector('[data-tab="ACTIVE"]') as HTMLElement;
          if (activeTab) activeTab.click();
        }
      }}
    />
  );
}

export function DisputedContractsEmptyState() {
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title="No disputed contracts"
      description="That's a good thing! None of your contracts are currently in dispute. This means all parties are satisfied with their transactions."
      secondaryAction={{
        label: "Learn About Disputes",
        href: "/arbitration-policy"
      }}
    />
  );
}