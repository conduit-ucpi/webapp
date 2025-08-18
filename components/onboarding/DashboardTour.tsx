'use client';
import { useEffect } from 'react';
import { useTour } from './TourProvider';
import { useAuth } from '@/components/auth/AuthProvider';

const dashboardTourSteps = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome to Your Dashboard!',
    content: 'This is your command center where you can manage all your payment agreements and see important stats.',
    placement: 'bottom' as const,
  },
  {
    id: 'stats',
    target: '[data-tour="stats-cards"]',
    title: 'Track Your Payments',
    content: 'These cards show you a quick overview: active contracts, pending payments, completed deals, and total value.',
    placement: 'bottom' as const,
  },
  {
    id: 'create-button',
    target: '[data-tour="create-button"]',
    title: 'Create Payment Requests',
    content: 'Click here anytime to create a new secure payment request for your buyers.',
    placement: 'left' as const,
  },
  {
    id: 'search',
    target: '[data-tour="search-bar"]',
    title: 'Find Contracts Fast',
    content: 'Search through your contracts by description, email, or contract address.',
    placement: 'bottom' as const,
  },
  {
    id: 'tabs',
    target: '[data-tour="filter-tabs"]',
    title: 'Filter Your View',
    content: 'Use these tabs to see contracts that need action, active ones, completed deals, or disputed payments.',
    placement: 'bottom' as const,
  },
  {
    id: 'wallet-info',
    target: '[data-tour="wallet-section"]',
    title: 'Wallet Management',
    content: 'Keep track of your connected wallet and manage your USDC balance for transactions.',
    placement: 'top' as const,
  },
];

export default function DashboardTour() {
  const { startTour } = useTour();
  const { user } = useAuth();

  useEffect(() => {
    // Check if user is authenticated and hasn't seen the tour
    if (user && !localStorage.getItem('dashboardTourCompleted')) {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        startTour(dashboardTourSteps);
        localStorage.setItem('dashboardTourCompleted', 'true');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, startTour]);

  // This component doesn't render anything visible
  return null;
}