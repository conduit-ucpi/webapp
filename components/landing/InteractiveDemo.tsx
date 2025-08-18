'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';

interface DemoStep {
  id: number;
  title: string;
  description: string;
  visual: React.ReactNode;
  action: string;
}

const DemoCard = ({ children, isActive }: { children: React.ReactNode; isActive: boolean }) => (
  <motion.div
    className={`relative p-6 rounded-lg border-2 transition-all duration-300 ${
      isActive 
        ? 'border-primary-500 bg-primary-50 shadow-lg' 
        : 'border-secondary-200 bg-white hover:border-secondary-300'
    }`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    {children}
  </motion.div>
);

const MoneyIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

const ShieldIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

export default function InteractiveDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const steps: DemoStep[] = [
    {
      id: 1,
      title: "Sarah creates payment request",
      description: "Sarah is selling her laptop for $800. She creates a payment request with a 7-day delivery window.",
      action: "Create Request",
      visual: (
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-semibold">S</span>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-secondary-900">Laptop Sale</h4>
            <p className="text-sm text-secondary-600">$800 • 7 days delivery</p>
          </div>
          <MoneyIcon className="w-6 h-6 text-primary-500" />
        </div>
      )
    },
    {
      id: 2,
      title: "John puts money in secure trust",
      description: "John wants the laptop. He deposits $800 into the secure escrow - money doesn't go to Sarah yet.",
      action: "Fund Escrow",
      visual: (
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">J</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <MoneyIcon className="w-5 h-5 text-green-500" />
                <span className="text-sm text-secondary-600">$800</span>
              </div>
            </div>
            <motion.div
              animate={{ x: [0, 20, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              →
            </motion.div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <ShieldIcon className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Secure Escrow</span>
              <span className="text-sm text-blue-600">$800</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Sarah ships the laptop",
      description: "Sarah sees the payment is secured and ships the laptop to John with tracking.",
      action: "Ship Item",
      visual: (
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-semibold">S</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-secondary-900">Laptop Shipped</h4>
              <p className="text-sm text-secondary-600">Tracking: #TRK123456</p>
            </div>
            <div className="text-green-500">
              <CheckIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <ShieldIcon className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">Funds Still Protected</span>
              <span className="text-sm text-blue-600">$800</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Automatic payment after 7 days",
      description: "Time's up! John received the laptop and didn't dispute. Sarah automatically gets paid.",
      action: "Auto Release",
      visual: (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckIcon className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-green-700">Payment Released</span>
              </div>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-green-600 font-semibold"
              >
                $800
              </motion.div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-semibold">S</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-secondary-900">Sarah gets paid!</h4>
              <p className="text-sm text-secondary-600">Transaction complete</p>
            </div>
            <MoneyIcon className="w-6 h-6 text-green-500" />
          </div>
        </div>
      )
    }
  ];

  const playDemo = async () => {
    setIsPlaying(true);
    setActiveStep(0);
    
    for (let i = 0; i < steps.length; i++) {
      setActiveStep(i);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    setIsPlaying(false);
  };

  return (
    <div className="bg-secondary-50 rounded-2xl p-8 lg:p-12">
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-4">
          See How It Works
        </h2>
        <p className="text-lg text-secondary-600 max-w-2xl mx-auto mb-6">
          Follow Sarah and John through a real transaction to see how secure payments work
        </p>
        <Button
          onClick={playDemo}
          disabled={isPlaying}
          className="bg-primary-500 hover:bg-primary-600 text-white"
        >
          {isPlaying ? 'Playing Demo...' : 'Play Interactive Demo'}
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
          >
            <DemoCard isActive={activeStep === index}>
              <div className="flex items-start space-x-4">
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    activeStep === index
                      ? 'bg-primary-500 text-white'
                      : activeStep > index
                      ? 'bg-green-500 text-white'
                      : 'bg-secondary-200 text-secondary-600'
                  }`}
                  animate={activeStep === index ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: activeStep === index ? Infinity : 0, duration: 1 }}
                >
                  {activeStep > index ? <CheckIcon className="w-4 h-4" /> : step.id}
                </motion.div>
                <div className="flex-1">
                  <h3 className="font-semibold text-secondary-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-secondary-600 mb-4">{step.description}</p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep === index ? 'active' : 'inactive'}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {step.visual}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </DemoCard>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <p className="text-sm text-secondary-600 mb-4">
          Want to try it yourself? Create a test payment with just $0.001
        </p>
        <Button variant="outline" className="border-primary-500 text-primary-600 hover:bg-primary-500 hover:text-white">
          Start Free Test
        </Button>
      </motion.div>
    </div>
  );
}