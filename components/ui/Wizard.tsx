import { ReactNode, useState } from 'react';
import Button from './Button';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  children: ReactNode;
  className?: string;
}

export function Wizard({ 
  steps, 
  currentStep, 
  onStepChange, 
  children, 
  className = '' 
}: WizardProps) {
  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* Progress indicator */}
      <WizardProgress steps={steps} currentStep={currentStep} onStepChange={onStepChange} />
      
      {/* Step content */}
      <div className="mt-8">
        {children}
      </div>
    </div>
  );
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange?: (step: number) => void;
}

function WizardProgress({ steps, currentStep, onStepChange }: WizardProgressProps) {
  return (
    <nav aria-label="Progress">
      {/* Mobile progress bar */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-secondary-900">
            Step {currentStep + 1} of {steps.length}
          </p>
          <p className="text-sm text-secondary-500">
            {Math.round(((currentStep + 1) / steps.length) * 100)}% complete
          </p>
        </div>
        <div className="w-full bg-secondary-200 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-secondary-900">
            {steps[currentStep]?.title}
          </h2>
          {steps[currentStep]?.description && (
            <p className="text-sm text-secondary-600 mt-1">
              {steps[currentStep].description}
            </p>
          )}
        </div>
      </div>

      {/* Desktop step indicator */}
      <ol className="hidden sm:flex items-center justify-center space-x-8 lg:space-x-12">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepChange && index <= currentStep;

          return (
            <li key={step.id} className="flex items-center">
              {index > 0 && (
                <div className="flex items-center">
                  <div 
                    className={`w-8 h-0.5 ${
                      isCompleted ? 'bg-primary-500' : 'bg-secondary-200'
                    } transition-colors duration-300`}
                  />
                </div>
              )}
              
              <button
                onClick={() => isClickable ? onStepChange(index) : undefined}
                disabled={!isClickable}
                className={`flex flex-col items-center group ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    transition-all duration-300
                    ${isCompleted 
                      ? 'bg-primary-500 text-white' 
                      : isCurrent 
                        ? 'bg-primary-50 border-2 border-primary-500 text-primary-600'
                        : 'bg-secondary-100 text-secondary-400'
                    }
                    ${isClickable && !isCurrent ? 'group-hover:bg-primary-100 group-hover:text-primary-600' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${
                    isCurrent ? 'text-primary-600' : 'text-secondary-500'
                  }`}>
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-secondary-400 mt-1 max-w-24">
                      {step.description}
                    </p>
                  )}
                  {step.isOptional && (
                    <p className="text-xs text-secondary-400 mt-1">Optional</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface WizardStepProps {
  children: ReactNode;
  className?: string;
}

export function WizardStep({ children, className = '' }: WizardStepProps) {
  return (
    <div className={`bg-white rounded-lg border border-secondary-200 p-6 sm:p-8 ${className}`}>
      {children}
    </div>
  );
}

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  skipLabel?: string;
  isNextDisabled?: boolean;
  isNextLoading?: boolean;
  canSkip?: boolean;
  className?: string;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  nextLabel = 'Continue',
  previousLabel = 'Back',
  skipLabel = 'Skip',
  isNextDisabled = false,
  isNextLoading = false,
  canSkip = false,
  className = ''
}: WizardNavigationProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 ${className}`}>
      {/* Previous button */}
      {!isFirstStep && onPrevious && (
        <Button
          variant="outline"
          onClick={onPrevious}
          className="order-2 sm:order-1 w-full sm:w-auto min-h-[44px]"
        >
          {previousLabel}
        </Button>
      )}
      
      {/* Skip button */}
      {canSkip && onSkip && (
        <Button
          variant="ghost"
          onClick={onSkip}
          className="order-3 sm:order-2 w-full sm:w-auto min-h-[44px]"
        >
          {skipLabel}
        </Button>
      )}
      
      {/* Next button */}
      {onNext && (
        <Button
          onClick={onNext}
          disabled={isNextDisabled || isNextLoading}
          className="order-1 sm:order-3 w-full sm:w-auto ml-auto min-h-[44px]"
        >
          {isNextLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Processing...
            </>
          ) : (
            isLastStep ? 'Create Payment Request' : nextLabel
          )}
        </Button>
      )}
    </div>
  );
}