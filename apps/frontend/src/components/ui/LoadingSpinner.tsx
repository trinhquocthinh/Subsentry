import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 animate-fade-in">
      <div className={`${sizeMap[size]} relative`}>
        <div
          className={`${sizeMap[size]} rounded-full border-2 border-surface-700 border-t-brand-500 animate-spin`}
        />
        <div
          className={`absolute inset-0.5 rounded-full border border-surface-800 border-b-accent-500 animate-spin`}
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
        />
      </div>
      {text && <p className="text-sm text-surface-500 animate-pulse">{text}</p>}
    </div>
  );
}

/**
 * Skeleton shimmer for loading states.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

/**
 * Full-card skeleton for subscription list.
 */
export function SubscriptionSkeleton() {
  return (
    <div className="surface-card p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
