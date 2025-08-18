'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/components/auth/AuthProvider';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  canProceed: boolean;
}

interface TransactionWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function TransactionWalkthrough({ isOpen, onClose, onComplete }: TransactionWalkthroughProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [sampleData, setSampleData] = useState({
    buyerEmail: '',
    description: '',
    amount: '',
    hours: '24',
    minutes: '0'
  });

  const steps: WalkthroughStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Your First Payment Request!',
      description: 'Let\'s walk through creating a secure escrow payment step by step.',
      content: (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Let's Create a Sample Payment Request
          </h3>
          <p className="text-gray-600 mb-6">
            We'll create a practice payment request to show you how escrow protection works. 
            This is just for learning - you won't send any real emails.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> An escrow payment protects both buyer and seller by holding 
              funds safely until delivery is confirmed.
            </p>
          </div>
        </div>
      ),
      canProceed: true
    },
    {
      id: 'buyer-info',
      title: 'Step 1: Who\'s Paying You?',
      description: 'Enter the buyer\'s information for this payment request.',
      content: (
        <div className="py-4">
          <div className="mb-6">
            <label htmlFor="buyer-email" className="block text-sm font-medium text-gray-700 mb-2">
              Buyer's Email Address
            </label>
            <Input
              id="buyer-email"
              type="email"
              placeholder="customer@example.com"
              value={sampleData.buyerEmail}
              onChange={(e) => setSampleData(prev => ({ ...prev, buyerEmail: e.target.value }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              The buyer will receive an email with payment instructions
            </p>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 mb-2">💡 How This Works:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• The buyer gets a secure link to fund the escrow</li>
              <li>• Funds are held safely until you deliver</li>
              <li>• Once delivered, funds are automatically released to you</li>
            </ul>
          </div>
        </div>
      ),
      canProceed: sampleData.buyerEmail.includes('@')
    },
    {
      id: 'payment-details',
      title: 'Step 2: What Are You Selling?',
      description: 'Describe what you\'re providing and how much it costs.',
      content: (
        <div className="py-4 space-y-6">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Service/Product Description
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Website design for small business..."
              value={sampleData.description}
              onChange={(e) => setSampleData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Be specific - this helps prevent disputes later
            </p>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="amount"
                type="number"
                placeholder="500.00"
                value={sampleData.amount}
                onChange={(e) => setSampleData(prev => ({ ...prev, amount: e.target.value }))}
                className="pl-8"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Payment will be made in USDC (a stable cryptocurrency)
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">✅ Your Protection:</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Funds are guaranteed once buyer pays</li>
              <li>• No chargebacks or payment reversals</li>
              <li>• Automatic release when time expires</li>
            </ul>
          </div>
        </div>
      ),
      canProceed: sampleData.description.trim().length >= 5 && sampleData.amount.trim().length > 0 && !isNaN(parseFloat(sampleData.amount)) && parseFloat(sampleData.amount) > 0
    },
    {
      id: 'timing',
      title: 'Step 3: Delivery Timeline',
      description: 'How long does the buyer have to claim there\'s a problem?',
      content: (
        <div className="py-4">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Window
            </label>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="hours" className="block text-xs text-gray-500 mb-1">Hours</label>
                <Input
                  id="hours"
                  type="number"
                  min="0"
                  max="8760"
                  value={sampleData.hours}
                  onChange={(e) => setSampleData(prev => ({ ...prev, hours: e.target.value }))}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="minutes" className="block text-xs text-gray-500 mb-1">Minutes</label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={sampleData.minutes}
                  onChange={(e) => setSampleData(prev => ({ ...prev, minutes: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              After this time, you can claim the payment even if the buyer disputes
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">⏰ Timeline Example:</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <div className="flex justify-between">
                <span>1. Buyer pays:</span>
                <span className="font-medium">Funds locked in escrow</span>
              </div>
              <div className="flex justify-between">
                <span>2. You deliver:</span>
                <span className="font-medium">Within {sampleData.hours}h {sampleData.minutes}m</span>
              </div>
              <div className="flex justify-between">
                <span>3. Time expires:</span>
                <span className="font-medium">You can claim payment</span>
              </div>
            </div>
          </div>
        </div>
      ),
      canProceed: parseInt(sampleData.hours) > 0 || parseInt(sampleData.minutes) > 0
    },
    {
      id: 'preview',
      title: 'Step 4: Review Your Request',
      description: 'Here\'s what your payment request will look like.',
      content: (
        <div className="py-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Payment Request</h3>
              <p className="text-sm text-gray-600">From: {user?.email}</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Service:</span>
                <span className="font-medium">{sampleData.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium text-lg">${sampleData.amount} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Window:</span>
                <span className="font-medium">{sampleData.hours}h {sampleData.minutes}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Buyer:</span>
                <span className="font-medium">{sampleData.buyerEmail}</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              📧 <strong>Next step:</strong> The buyer will receive an email with secure payment 
              instructions. They'll connect their wallet and pay with USDC.
            </p>
          </div>
        </div>
      ),
      canProceed: true
    },
    {
      id: 'complete',
      title: 'You\'re Ready to Go! 🎉',
      description: 'You\'ve learned how to create secure payment requests.',
      content: (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Great Job! You're Ready for Real Payments
          </h3>
          <p className="text-gray-600 mb-6">
            You've learned how escrow protection works. Now you can create real payment 
            requests with confidence.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h4 className="font-medium text-gray-900 mb-3">What You Learned:</h4>
            <ul className="text-sm text-gray-700 space-y-2 text-left">
              <li>✅ How to create secure payment requests</li>
              <li>✅ Setting appropriate delivery timelines</li>
              <li>✅ How escrow protection works for both parties</li>
              <li>✅ The payment and delivery process</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.push('/create')}
              className="px-6"
            >
              Create Real Payment Request
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="px-6"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      ),
      canProceed: true
    }
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mark walkthrough as completed
      localStorage.setItem('onboarding-walkthrough-completed', 'true');
      onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-walkthrough-completed', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{currentStepData.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{currentStepData.description}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Step {currentStep + 1} of {steps.length}</span>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip Tutorial
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[400px]">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          <Button
            onClick={handleNext}
            disabled={!currentStepData.canProceed}
          >
            {isLastStep ? 'Complete Tutorial' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}