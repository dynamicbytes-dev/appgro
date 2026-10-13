import React from 'react';
import { safeText } from '../../utils/safeText';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  className = '',
  icon,
}) => {
  const variantStyles = {
    success: 'bg-[#4E9F3D]/15 text-[#4E9F3D] border-[#4E9F3D]/30 dark:bg-[#4E9F3D]/25 dark:text-[#6DBF5C]',
    primary: 'bg-[#1B4D3E]/15 text-[#1B4D3E] border-[#1B4D3E]/30 dark:bg-[#1B4D3E]/30 dark:text-[#6DBF5C]',
    warning: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
    danger: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400',
    info: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400',
  };

  const safeChildren = React.isValidElement(children) ? children : safeText(children);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}>
      {icon && <span className="mr-1.5 shrink-0">{icon}</span>}
      {safeChildren}
    </span>
  );
};
