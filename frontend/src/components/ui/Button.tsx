import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base font-semibold',
  };

  const variantStyles = {
    primary:
      'bg-[#1B4D3E] hover:bg-[#143A2F] text-white focus:ring-[#1B4D3E] active:scale-[0.98]',
    accent:
      'bg-[#4E9F3D] hover:bg-[#3E8230] text-white focus:ring-[#4E9F3D] active:scale-[0.98]',
    outline:
      'border border-gray-300 dark:border-[#263632] bg-white dark:bg-[#18221F] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#263632] focus:ring-[#1B4D3E]',
    danger:
      'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-gray-100 dark:hover:bg-[#263632] text-gray-700 dark:text-gray-200 shadow-none',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="mr-2 shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
