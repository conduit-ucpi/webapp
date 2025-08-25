'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import { useRouter } from 'next/router';
import Button from '@/components/ui/Button';
import TransactionWalkthrough from './TransactionWalkthrough';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
  checkCondition: () => boolean;
}

interface ProgressChecklistProps {
  onClose?: () => void;
}

export default function ProgressChecklist({ onClose }: ProgressChecklistProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [contractsExist, setContractsExist] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Check if user has contracts
  useEffect(() => {
    const checkContracts = async () => {
      if (!user) return;
      
      try {
        const response = await fetch('/api/combined-contracts');
        if (response.ok) {
          const contracts = await response.json();
          setContractsExist(Array.isArray(contracts) && contracts.length > 0);
        }
      } catch (error) {
        console.error('Failed to check contracts:', error);
      }
    };

    checkContracts();
  }, [user]);

  const checklistItems: ChecklistItem[] = [
    {
      id: 'connect-wallet',
      title: 'Connect Your Wallet',
      description: 'Link your crypto wallet to start creating secure payment agreements',
      checkCondition: () => !!user?.walletAddress,
    },
    {
      id: 'understand-usdc',
      title: 'Learn About USDC',
      description: 'Understand how to get and use USDC for your transactions',
      action: 'Learn More',
      actionLink: '/buy-usdc',
      checkCondition: () => localStorage.getItem('onboarding-usdc-learned') === 'true',
    },
    {
      id: 'create-contract',
      title: 'Create Your First Payment Request',
      description: 'Set up a secure escrow payment to see how it works',
      action: contractsExist ? 'Create Another' : 'Try Sample First',
      actionLink: contractsExist ? '/create' : undefined,
      checkCondition: () => contractsExist,
    },
    {
      id: 'sample-walkthrough',
      title: 'Learn with Sample Transaction',
      description: 'Complete the interactive tutorial to understand the process',
      action: 'Start Tutorial',
      checkCondition: () => localStorage.getItem('onboarding-walkthrough-completed') === 'true',
    },
    {
      id: 'explore-dashboard',
      title: 'Explore Your Dashboard',
      description: 'Take the guided tour to learn about tracking and managing payments',
      action: 'Start Tour',
      checkCondition: () => localStorage.getItem('dashboardTourCompleted') === 'true',
    },
    {
      id: 'learn-dispute-resolution',
      title: 'Understand Dispute Resolution',
      description: 'Learn how disputes work and how to protect yourself',
      action: 'Read Guide',
      actionLink: '/faq',
      checkCondition: () => localStorage.getItem('onboarding-disputes-learned') === 'true',
    },
  ];

  // Update completed items when conditions change
  useEffect(() => {
    const completed = checklistItems
      .filter(item => item.checkCondition())
      .map(item => item.id);
    setCompletedItems(completed);
  }, [user, contractsExist]);

  // Show checklist for new users
  useEffect(() => {
    if (!user) return;

    const hasSeenChecklist = localStorage.getItem('onboarding-checklist-seen');
    const allCompleted = checklistItems.every(item => item.checkCondition());

    if (!hasSeenChecklist && !allCompleted) {
      setIsVisible(true);
    }
  }, [user, contractsExist]);

  const handleAction = (item: ChecklistItem) => {
    if (item.id === 'start-tour') {
      // Trigger dashboard tour
      localStorage.removeItem('dashboardTourCompleted');
      window.location.reload();
      return;
    }

    if (item.id === 'understand-usdc') {
      localStorage.setItem('onboarding-usdc-learned', 'true');
      if (item.actionLink) {
        router.push(item.actionLink);
      }
      return;
    }

    if (item.id === 'create-contract' && !contractsExist) {
      // Show walkthrough for first-time users
      setShowWalkthrough(true);
      return;
    }

    if (item.id === 'sample-walkthrough') {
      // Start the walkthrough tutorial
      setShowWalkthrough(true);
      return;
    }

    if (item.id === 'learn-dispute-resolution') {
      localStorage.setItem('onboarding-disputes-learned', 'true');
      if (item.actionLink) {
        router.push(item.actionLink);
      }
      return;
    }

    if (item.actionLink) {
      router.push(item.actionLink);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('onboarding-checklist-seen', 'true');
    setIsVisible(false);
    onClose?.();
  };

  const completedCount = completedItems.length;
  const totalCount = checklistItems.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  if (!isVisible || !user) return null;

  return (
    <div className="bg-white border border-primary-200 rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Welcome to Instant Escrow!</h3>
            <p className="text-sm text-gray-600">Complete these steps to get the most out of your escrow platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} 
              />
            </svg>
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <>
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-500">{completedCount} of {totalCount} completed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div className="space-y-4">
        {checklistItems.map((item) => {
          const isCompleted = completedItems.includes(item.id);
          
          return (
            <div key={item.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-5 h-5 bg-success-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" 
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                  {item.title}
                </h4>
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                {!isCompleted && item.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item)}
                    className="mt-2"
                  >
                    {item.action}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
          </div>

          {/* Completion message */}
          {completedCount === totalCount && (
        <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-success-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                clipRule="evenodd" 
              />
            </svg>
            <span className="text-sm font-medium text-success-800">
              Congratulations! You've completed the onboarding checklist.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            className="mt-3 border-success-300 text-success-700 hover:bg-success-100"
          >
            Dismiss Checklist
          </Button>
          </div>
          )}
        </>
      )}

      {/* Transaction Walkthrough Modal */}
      <TransactionWalkthrough
        isOpen={showWalkthrough}
        onClose={() => setShowWalkthrough(false)}
        onComplete={() => {
          // Refresh the checklist to show walkthrough as completed
          window.location.reload();
        }}
      />
    </div>
  );
}