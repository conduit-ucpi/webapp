import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      data-testid="loading-spinner"
      className={cn(
        'animate-spin rounded-full border-2 border-gray-300 border-t-primary-500',
        sizes[size],
        className
      )}
    />
  );
}