import React from 'react';
import { safeText } from '../../utils/safeText';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: any;
  subtitle?: any;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
}) => {
  const safeTitle = safeText(title);
  const safeSubtitle = safeText(subtitle);

  return (
    <div className={`bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200/80 dark:border-[#263632] shadow-sm hover:shadow-md transition-shadow p-6 ${className}`}>
      {(safeTitle || action) && (
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-[#263632] pb-3">
          <div>
            {safeTitle && (
              <h3 className="text-lg font-bold text-[#1E1E1E] dark:text-gray-100 tracking-tight">
                {safeTitle}
              </h3>
            )}
            {safeSubtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {safeSubtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
