import { ReactNode } from 'react';
import Button from './Button';
import Link from 'next/link';

interface EmptyStateProps {
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
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {icon && (
        <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-medium text-secondary-900 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-secondary-600 mb-6 max-w-md mx-auto">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {action && (
          action.href ? (
            <Link href={action.href}>
              <Button className="w-full sm:w-auto min-h-[44px]">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button 
              onClick={action.onClick}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {action.label}
            </Button>
          )
        )}
        
        {secondaryAction && (
          secondaryAction.href ? (
            <Link href={secondaryAction.href}>
              <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                {secondaryAction.label}
              </Button>
            </Link>
          ) : (
            <Button 
              variant="outline"
              onClick={secondaryAction.onClick}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {secondaryAction.label}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoContractsEmptyState({ userRole }: { userRole: 'buyer' | 'seller' | 'any' }) {
  const messages = {
    buyer: {
      title: "No payment requests yet",
      description: "When someone sends you a payment request, it will appear here. You'll be notified by email when a new request arrives."
    },
    seller: {
      title: "No payment requests created",
      description: "Create your first payment request to start receiving secure payments. Your buyers will receive an email notification."
    },
    any: {
      title: "No contracts yet",
      description: "Start by creating a payment request or wait for someone to send you one. All your contracts will appear here."
    }
  };

  const message = messages[userRole];

  return (
    <EmptyState
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
      }
      title={message.title}
      description={message.description}
      action={
        userRole === 'seller' || userRole === 'any' ? {
          label: "Create Payment Request",
          href: "/create"
        } : undefined
      }
      secondaryAction={{
        label: "Learn How It Works",
        href: "/#how-it-works"
      }}
    />
  );
}

export function SearchEmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <EmptyState
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      title="No results found"
      description={`No contracts matching "${searchTerm}". Try adjusting your search or filters.`}
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      title="Unable to load contracts"
      description="There was an error loading your contracts. Please check your connection and try again."
      action={{
        label: "Try Again",
        onClick: onRetry
      }}
    />
  );
}