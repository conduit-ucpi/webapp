import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatsCard({ 
  title, 
  value, 
  icon, 
  trend, 
  className = '' 
}: StatsCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-secondary-200 p-4 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-600">{title}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-secondary-900">
            {value}
          </p>
          {trend && (
            <div className="mt-2 flex items-center text-sm">
              <span className={`font-medium ${trend.isPositive ? 'text-success-600' : 'text-error-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-secondary-500 ml-2">from last month</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0">
            <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}