/**
 * @file Button.jsx
 * Clinical grade button component with multiple visual variants, sizes, icon slots, and loading spinner.
 */

import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/20 focus-visible:ring-primary-500 active:bg-primary-800',
  secondary:
    'bg-surface-elevated hover:bg-surface-sunken text-surface-foreground border border-surface-border shadow-xs focus-visible:ring-primary-500',
  outline:
    'border border-primary-500/40 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 focus-visible:ring-primary-500',
  danger:
    'bg-danger-600 hover:bg-danger-700 text-white shadow-sm shadow-danger-500/20 focus-visible:ring-danger-500 active:bg-danger-800',
  ghost:
    'text-surface-muted hover:text-surface-foreground hover:bg-surface-elevated focus-visible:ring-primary-500',
  success:
    'bg-success-600 hover:bg-success-700 text-white shadow-sm shadow-success-500/20 focus-visible:ring-success-500',
};

const SIZES = {
  xs: 'text-xs px-2 py-1 gap-1 rounded-md font-medium',
  sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-lg font-medium',
  md: 'text-sm px-3.5 py-2 gap-2 rounded-lg font-medium',
  lg: 'text-base px-4 py-2.5 gap-2.5 rounded-xl font-semibold',
  icon: 'p-2 rounded-lg',
};

export const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    icon: Icon = null,
    iconRight: IconRight = null,
    type = 'button',
    onClick,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-base',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none filter grayscale-[30%]',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight className="w-4 h-4 shrink-0" /> : null}
    </button>
  );
});

export default Button;
