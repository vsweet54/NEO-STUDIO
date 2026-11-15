import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'cyan' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98] rounded-lg';

    const variants = {
      primary:
        'bg-accent-purple hover:bg-accent-purple-hover text-white shadow-sm shadow-purple-950/40 focus:ring-accent-purple border border-purple-500/30',
      cyan:
        'bg-accent-cyan hover:bg-accent-cyan-hover text-black font-semibold shadow-sm shadow-cyan-950/40 focus:ring-accent-cyan border border-cyan-400/30',
      secondary:
        'bg-secondary hover:bg-secondary-hover text-gray-200 border border-border focus:ring-accent-purple',
      outline:
        'bg-transparent hover:bg-surface text-gray-300 border border-border hover:border-gray-600 focus:ring-accent-purple',
      ghost:
        'bg-transparent hover:bg-surface text-gray-400 hover:text-gray-100 focus:ring-accent-purple',
      danger:
        'bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-700/50 focus:ring-red-500',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-3.5 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
      icon: 'p-2 aspect-square',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
