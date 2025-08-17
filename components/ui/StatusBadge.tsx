import { getStatusDisplay } from '@/utils/validation';
import {
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface StatusBadgeProps {
  status: string;
  isBuyer?: boolean;
  isSeller?: boolean;
  showDescription?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const iconMap = {
  'clock': ClockIcon,
  'shield-check': ShieldCheckIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'exclamation-circle': ExclamationCircleIcon,
  'check-circle': CheckCircleIcon,
  'question-mark-circle': QuestionMarkCircleIcon,
  'arrow-down-tray': ArrowDownTrayIcon,
};

export default function StatusBadge({ 
  status, 
  isBuyer = false, 
  isSeller = false, 
  showDescription = false,
  size = 'md'
}: StatusBadgeProps) {
  const statusInfo = getStatusDisplay(status, isBuyer, isSeller);
  const IconComponent = iconMap[statusInfo.icon as keyof typeof iconMap] || QuestionMarkCircleIcon;
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className="flex flex-col">
      <div className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${statusInfo.color}
        ${sizeClasses[size]}
      `}>
        <IconComponent className={iconSizes[size]} />
        {statusInfo.label}
      </div>
      {showDescription && (
        <p className="text-xs text-secondary-600 mt-1 max-w-xs">
          {statusInfo.description}
        </p>
      )}
    </div>
  );
}