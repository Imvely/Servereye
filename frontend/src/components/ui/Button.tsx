import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500',
  danger:
    'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-indigo-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconOnly = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeClass = iconOnly
      ? iconOnlySizeClasses[size]
      : sizeClasses[size];

    return (
      <button
        ref={ref}
        className={`${base} ${variantClasses[variant]} ${sizeClass} ${className}`}
        disabled={disabled}
        {...props}
      >
        {icon && (
          <span className={children && !iconOnly ? 'mr-1.5' : ''}>
            {icon}
          </span>
        )}
        {!iconOnly && children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
