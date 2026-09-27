import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    // Corners and the primary colours come from the theme's button settings (BrandTheme.button),
    // so a look restyles every button without touching the components that use one.
    const baseClasses = 'inline-flex items-center justify-center rounded-[var(--wl-button-radius)] font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      primary: 'bg-[color:var(--wl-button-bg)] text-[color:var(--wl-button-fg)] hover:bg-[color:var(--wl-button-hover-bg)] dark:bg-[color:var(--wl-button-dark-bg)] dark:text-[color:var(--wl-button-dark-fg)] dark:hover:bg-[color:var(--wl-button-dark-hover-bg)]',
      secondary: 'bg-secondary-700 dark:bg-secondary-200 text-white dark:text-secondary-900 hover:bg-secondary-600 dark:hover:bg-secondary-300',
      outline: 'border border-secondary-300 dark:border-secondary-600 bg-transparent text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-800 hover:text-secondary-900 dark:hover:text-white',
      ghost: 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800 hover:text-secondary-900 dark:hover:text-white',
      success: 'bg-success-500 text-white hover:bg-success-600',
      error: 'bg-error-500 text-white hover:bg-error-600',
    };

    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-10 px-4 py-2',
      lg: 'h-11 px-8',
    };

    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;