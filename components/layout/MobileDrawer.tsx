import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  HomeIcon,
  PlusCircleIcon,
  RectangleStackIcon,
  WalletIcon,
  QuestionMarkCircleIcon,
  ScaleIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  UserCircleIcon,
  ArrowLeftOnRectangleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  isAdmin?: boolean;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const router = useRouter();
  const { user, disconnect } = useAuth();
  const { config } = useConfig();
  const isAuthenticated = !!user;
  const isAdmin = (user as any)?.isAdmin;

  const navSections: NavSection[] = [
    {
      items: [
        {
          href: '/',
          label: 'Home',
          icon: HomeIcon,
        },
        {
          href: '/create',
          label: 'New Payment Request',
          icon: PlusCircleIcon,
          requiresAuth: true,
        },
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: RectangleStackIcon,
          requiresAuth: true,
        },
        {
          href: '/wallet',
          label: 'Wallet',
          icon: WalletIcon,
          requiresAuth: true,
        },
      ],
    },
    {
      title: 'Resources',
      items: [
        {
          href: '/buy-usdc',
          label: 'Buy USDC',
          icon: CreditCardIcon,
        },
        {
          href: '/faq',
          label: 'FAQ',
          icon: QuestionMarkCircleIcon,
        },
        {
          href: '/arbitration-policy',
          label: 'Arbitration',
          icon: ScaleIcon,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          href: '/admin',
          label: 'Admin Panel',
          icon: Cog6ToothIcon,
          isAdmin: true,
        },
      ],
    },
  ];

  const legalLinks = [
    {
      href: '/privacy-policy',
      label: 'Privacy',
    },
    {
      href: '/terms-of-service',
      label: 'Terms',
    },
  ];

  const handleNavigation = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleLogout = async () => {
    await disconnect();
    onClose();
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }
    return router.pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem) => {
    // Filter out items that require auth or admin
    if ((item.requiresAuth && !isAuthenticated) || (item.isAdmin && !isAdmin)) {
      return null;
    }

    const active = isActive(item.href);
    const Icon = item.icon;
    
    return (
      <button
        key={item.href}
        onClick={() => handleNavigation(item.href)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-lg ${
          active
            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-800'
        }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          <Transition.Child
            as={Fragment}
            enter="transform transition ease-in-out duration-300"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in-out duration-300"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-auto flex h-full w-full max-w-xs flex-col bg-white dark:bg-secondary-900 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-secondary-200 dark:border-secondary-700">
                <div>
                  <div className="text-lg font-bold italic text-secondary-900 dark:text-white">
                    Instant Escrow
                  </div>
                  <div className="text-xs text-primary-600 dark:text-primary-400">
                    Conduit UCPI
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                  onClick={onClose}
                >
                  <XMarkIcon className="h-5 w-5 text-secondary-500 dark:text-secondary-400" />
                </button>
              </div>

              {/* User info */}
              {isAuthenticated && (
                <div className="mx-4 mt-4 p-3 bg-secondary-50 dark:bg-secondary-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <UserCircleIcon className="w-8 h-8 text-secondary-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900 dark:text-white truncate">
                        {user?.email || 'User'}
                      </p>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        Connected
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                {navSections.map((section, idx) => {
                  const visibleItems = section.items.filter(item => 
                    (!item.requiresAuth || isAuthenticated) && (!item.isAdmin || isAdmin)
                  );
                  
                  if (visibleItems.length === 0) return null;
                  
                  return (
                    <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
                      {section.title && (
                        <h3 className="px-3 mb-2 text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                          {section.title}
                        </h3>
                      )}
                      <div className="space-y-1">
                        {visibleItems.map(renderNavItem)}
                      </div>
                    </div>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="border-t border-secondary-200 dark:border-secondary-700 px-4 py-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-secondary-600 dark:text-secondary-300">
                    Dark Mode
                  </span>
                  <ThemeToggle />
                </div>

                {/* Legal Links */}
                <div className="flex gap-4 mb-3">
                  {legalLinks.map(link => (
                    <button
                      key={link.href}
                      onClick={() => handleNavigation(link.href)}
                      className="text-xs text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200"
                    >
                      {link.label}
                    </button>
                  ))}
                </div>

                {/* Version Info */}
                {config && (config.gitTag || config.gitSha) && (
                  <div className="mb-3 px-2 py-1.5 bg-secondary-50 dark:bg-secondary-800 rounded text-xs text-secondary-500 dark:text-secondary-400">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Version</span>
                      <span className="font-mono">
                        {config.gitTag && config.gitTag !== 'unknown' ? config.gitTag : ''}
                        {config.gitTag && config.gitTag !== 'unknown' && config.gitSha && config.gitSha !== 'unknown' && ' • '}
                        {config.gitSha && config.gitSha !== 'unknown' ? config.gitSha : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Auth Button */}
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors"
                  >
                    <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </button>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mb-2">
                      Connect wallet to access all features
                    </p>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}