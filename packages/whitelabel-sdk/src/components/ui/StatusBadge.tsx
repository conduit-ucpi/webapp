interface StatusBadgeProps {
  status: string | undefined;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusBadge({ 
  status,
  label,
  color,
  size = 'md'
}: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const defaultColor = 'bg-secondary-50 text-secondary-600 border-secondary-200';

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full border font-medium
      ${color || defaultColor}
      ${sizeClasses[size]}
    `}>
      {label || status || 'Unknown'}
    </div>
  );
}