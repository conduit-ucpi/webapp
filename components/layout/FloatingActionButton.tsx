import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Transition } from '@headlessui/react';
import {
  PlusIcon,
  XMarkIcon,
  HomeIcon,
  RectangleStackIcon,
  WalletIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth';

interface FABAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
}

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Don't show FAB on contract-create page (plugin users)
  if (router.pathname === '/contract-create') {
    return null;
  }

  const actions: FABAction[] = [
    {
      label: 'New Payment Request',
      href: '/create',
      icon: PlusIcon,
      requiresAuth: true,
    },
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: RectangleStackIcon,
      requiresAuth: true,
    },
    {
      label: 'Wallet',
      href: '/wallet',
      icon: WalletIcon,
      requiresAuth: true,
    },
    {
      label: 'Buy Tokens',
      href: '/buy-token',
      icon: CreditCardIcon,
    },
    {
      label: 'Home',
      href: '/',
      icon: HomeIcon,
    },
  ];

  const visibleActions = actions.filter(
    action => !action.requiresAuth || isAuthenticated
  );

  const primaryAction = visibleActions.find(a => a.href === '/create') || visibleActions[0];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Quick action buttons */}
      <Transition
        show={isOpen}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <div className="absolute bottom-16 right-0 mb-2 space-y-2">
          {visibleActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center justify-end"
              onClick={() => setIsOpen(false)}
            >
              <span className="mr-3 px-3 py-2 bg-white dark:bg-secondary-800 rounded-lg shadow-lg text-sm font-medium text-secondary-700 dark:text-secondary-200 whitespace-nowrap">
                {action.label}
              </span>
              <div className="w-12 h-12 bg-white dark:bg-secondary-800 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
                <action.icon className="w-6 h-6 text-secondary-600 dark:text-secondary-300" />
              </div>
            </Link>
          ))}
        </div>
      </Transition>

      {/* Main FAB button */}
      <button
        onClick={() => {
          if (!isOpen && primaryAction && router.pathname !== primaryAction.href) {
            // If closed and not on the primary action page, navigate directly
            router.push(primaryAction.href);
          } else {
            // Otherwise toggle the menu
            setIsOpen(!isOpen);
          }
        }}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 ${
          isOpen 
            ? 'bg-secondary-600 dark:bg-secondary-700' 
            : 'bg-primary-600 dark:bg-primary-500'
        }`}
      >
        {isOpen ? (
          <XMarkIcon className="w-7 h-7 text-white" />
        ) : (
          <PlusIcon className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 -z-10 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}