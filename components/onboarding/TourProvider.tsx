'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';

interface TourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showSkip?: boolean;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const startTour = (tourSteps: TourStep[]) => {
    setSteps(tourSteps);
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    endTour();
    // Mark tour as completed so it doesn't show again
    localStorage.setItem('tourCompleted', 'true');
  };

  const endTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    setTargetElement(null);
  };

  // Update target element and position when step changes
  useEffect(() => {
    if (isActive && steps[currentStep]) {
      const element = document.querySelector(steps[currentStep].target) as HTMLElement;
      if (element) {
        setTargetElement(element);
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Calculate tooltip position
        const rect = element.getBoundingClientRect();
        const placement = steps[currentStep].placement || 'bottom';
        
        let x = rect.left + rect.width / 2;
        let y = rect.bottom + 10;
        
        switch (placement) {
          case 'top':
            y = rect.top - 10;
            break;
          case 'left':
            x = rect.left - 10;
            y = rect.top + rect.height / 2;
            break;
          case 'right':
            x = rect.right + 10;
            y = rect.top + rect.height / 2;
            break;
          default: // bottom
            y = rect.bottom + 10;
        }
        
        setTooltipPosition({ x, y });
      }
    }
  }, [isActive, currentStep, steps]);

  const currentStepData = steps[currentStep];

  return (
    <TourContext.Provider value={{
      isActive,
      currentStep,
      steps,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      endTour
    }}>
      {children}
      
      <AnimatePresence>
        {isActive && targetElement && currentStepData && (
          <>
            {/* Overlay */}
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={endTour}
            />
            
            {/* Highlight */}
            <motion.div
              className="fixed pointer-events-none z-50 border-2 border-primary-500 rounded-lg"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: targetElement.getBoundingClientRect().left - 4,
                y: targetElement.getBoundingClientRect().top - 4,
                width: targetElement.getBoundingClientRect().width + 8,
                height: targetElement.getBoundingClientRect().height + 8,
              }}
              transition={{ duration: 0.3 }}
            />
            
            {/* Tooltip */}
            <motion.div
              className="fixed z-50 max-w-sm"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                x: tooltipPosition.x - 200, // Center the 400px wide tooltip
                y: tooltipPosition.y,
              }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-xl border border-secondary-200 dark:border-secondary-600 p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
                    {currentStepData.title}
                  </h3>
                  <p className="text-sm text-secondary-600 dark:text-secondary-300">
                    {currentStepData.content}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-secondary-500 dark:text-secondary-400">
                      {currentStep + 1} of {steps.length}
                    </span>
                    <div className="flex space-x-1">
                      {steps.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full ${
                            index === currentStep 
                              ? 'bg-primary-500' 
                              : index < currentStep 
                              ? 'bg-primary-300' 
                              : 'bg-secondary-300 dark:bg-secondary-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {currentStepData.showSkip !== false && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={skipTour}
                        className="text-xs"
                      >
                        Skip Tour
                      </Button>
                    )}
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={prevStep}
                        className="text-xs"
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={nextStep}
                      className="text-xs bg-primary-500 hover:bg-primary-600"
                    >
                      {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}