interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export default function Skeleton({ 
  className = '', 
  width, 
  height, 
  variant = 'rectangular' 
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-secondary-200';
  
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  };
  
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;
  
  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Common skeleton patterns
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i}
          variant="text" 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-secondary-200 rounded-lg p-6 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="text-right">
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      
      <div className="space-y-3">
        <SkeletonText lines={2} />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonButton({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-10 w-24 rounded-md ${className}`} />;
}