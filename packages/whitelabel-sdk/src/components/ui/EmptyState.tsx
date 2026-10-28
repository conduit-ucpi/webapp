import { ReactNode } from 'react';
import Button from './Button';
import Link from 'next/link';
import { useT } from '../../i18n';

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
      <circle cx="48" cy="48" r="48" fill="rgb(var(--wl-green-50))" />
      <rect x="28" y="20" width="40" height="52" rx="4" fill="white" stroke="rgb(var(--wl-gray-300))" strokeWidth="2" />
      <rect x="32" y="28" width="24" height="3" rx="1.5" fill="rgb(var(--wl-primary-500))" />
      <rect x="32" y="36" width="32" height="2" rx="1" fill="rgb(var(--wl-gray-200))" />
      <rect x="32" y="42" width="28" height="2" rx="1" fill="rgb(var(--wl-gray-200))" />
      <rect x="32" y="48" width="24" height="2" rx="1" fill="rgb(var(--wl-gray-200))" />
      <circle cx="56" cy="60" r="8" fill="rgb(var(--wl-primary-500))" />
      <path d="m52 60 2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="rgb(var(--wl-amber-100))" />
      <circle cx="42" cy="42" r="14" fill="none" stroke="rgb(var(--wl-amber-500))" strokeWidth="3" />
      <path d="m52 52 8 8" stroke="rgb(var(--wl-amber-500))" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="42" r="8" fill="rgb(var(--wl-amber-400))" opacity="0.2" />
    </svg>
  );
}

function ErrorIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="rgb(var(--wl-red-50))" />
      <circle cx="48" cy="48" r="20" fill="none" stroke="rgb(var(--wl-red-500))" strokeWidth="3" />
      <path d="M48 40v8m0 4h.01" stroke="rgb(var(--wl-red-500))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterEmptyIllustration() {
  return (
    <svg className="w-full h-full" viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="48" fill="rgb(var(--wl-blue-50))" />
      <path d="M24 32h48l-16 16v12l-8 4v-16L24 32z" fill="rgb(var(--wl-blue-500))" opacity="0.7" />
      <circle cx="64" cy="24" r="8" fill="rgb(var(--wl-gray-100))" stroke="rgb(var(--wl-gray-500))" strokeWidth="2" />
      <path d="m62 24 2 2 4-4" stroke="rgb(var(--wl-gray-500))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const t = useT();
  const messages = {
    buyer: {
      title: t('emptyState.buyerTitle'),
      description: t('emptyState.buyerDescription')
    },
    seller: {
      title: t('emptyState.sellerTitle'),
      description: t('emptyState.sellerDescription')
    },
    any: {
      title: t('emptyState.anyTitle'),
      description: t('emptyState.anyDescription')
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
          label: t('wizard.submit'),
          href: "/create"
        } : undefined
      }
      secondaryAction={
        onShowDemo ? {
          label: t('emptyState.viewDemoData'),
          onClick: onShowDemo
        } : {
          label: t('emptyState.seeHowItWorks'),
          href: "/#how-it-works"
        }
      }
    />
  );
}

export function SearchEmptyState({ searchTerm }: { searchTerm: string }) {
  const t = useT();
  return (
    <EmptyState
      illustration={<SearchIllustration />}
      title={t('emptyState.noMatchesFound')}
      description={t('emptyState.noMatchesDescription', { searchTerm })}
      secondaryAction={{
        label: t('emptyState.clearSearch'),
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
  const t = useT();
  return (
    <EmptyState
      illustration={<ErrorIllustration />}
      title={t('emptyState.connectionTrouble')}
      description={t('emptyState.connectionTroubleDescription')}
      action={{
        label: t('contractList.tryAgain'),
        onClick: onRetry
      }}
      secondaryAction={{
        label: t('emptyState.checkStatus'),
        href: "mailto:support@conduit.example.com?subject=Connection Issues"
      }}
    />
  );
}

// New filtered view empty states
export function ActiveContractsEmptyState() {
  const t = useT();
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title={t('emptyState.noActiveContracts')}
      description={t('emptyState.noActiveContractsDescription')}
      action={{
        label: t('wizard.submit'),
        href: "/create"
      }}
      secondaryAction={{
        label: t('emptyState.viewAllContracts'),
        onClick: () => {
          const allTab = document.querySelector('[data-tab="ALL"]') as HTMLElement;
          if (allTab) allTab.click();
        }
      }}
    />
  );
}

export function ActionNeededEmptyState() {
  const t = useT();
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title={t('emptyState.allCaughtUp')}
      description={t('emptyState.allCaughtUpDescription')}
      secondaryAction={{
        label: t('emptyState.viewAllContracts'),
        onClick: () => {
          const allTab = document.querySelector('[data-tab="ALL"]') as HTMLElement;
          if (allTab) allTab.click();
        }
      }}
    />
  );
}

export function CompletedContractsEmptyState() {
  const t = useT();
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title={t('emptyState.noCompletedContractsYet')}
      description={t('emptyState.noCompletedDescription')}
      action={{
        label: t('wizard.submit'),
        href: "/create"
      }}
      secondaryAction={{
        label: t('emptyState.viewActiveContracts'),
        onClick: () => {
          const activeTab = document.querySelector('[data-tab="ACTIVE"]') as HTMLElement;
          if (activeTab) activeTab.click();
        }
      }}
    />
  );
}

export function DisputedContractsEmptyState() {
  const t = useT();
  return (
    <EmptyState
      illustration={<FilterEmptyIllustration />}
      title={t('emptyState.noDisputedContracts')}
      description={t('emptyState.noDisputedDescription')}
      secondaryAction={{
        label: t('emptyState.learnAboutDisputes'),
        href: "/dispute-policy"
      }}
    />
  );
}