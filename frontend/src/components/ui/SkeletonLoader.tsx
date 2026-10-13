import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-[#263632] rounded-xl ${className}`} />
);

interface SkeletonLoaderProps {
  type?: 'dashboard' | 'table' | 'cards' | 'lines';
  rows?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'dashboard',
  rows = 5,
}) => {
  if (type === 'table') {
    return (
      <div className="space-y-4 w-full animate-in fade-in duration-200">
        <div className="flex justify-between items-center bg-white dark:bg-[#18221F] p-4 rounded-2xl border border-gray-200 dark:border-[#263632]">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-[#263632] overflow-hidden p-4 space-y-3">
          <div className="grid grid-cols-4 gap-4 pb-3 border-b border-gray-100 dark:border-[#263632]">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={`skel-row-${idx}`} className="grid grid-cols-4 gap-4 py-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full animate-in fade-in duration-200">
        {Array.from({ length: rows || 3 }).map((_, idx) => (
          <div
            key={`skel-card-${idx}`}
            className="p-5 bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-[#263632] space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'lines') {
    return (
      <div className="space-y-2.5 w-full animate-in fade-in duration-200">
        {Array.from({ length: rows }).map((_, idx) => (
          <Skeleton key={`skel-line-${idx}`} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  // Default: Dashboard full view skeleton
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Banner Skeleton */}
      <Skeleton className="h-32 w-full rounded-3xl" />

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={`skel-dash-card-${idx}`}
            className="p-5 bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-[#263632] space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white dark:bg-[#18221F] rounded-2xl border border-gray-200 dark:border-[#263632] p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`skel-dash-row-${idx}`} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
};
