'use client';

/**
 * Skeleton Loading Components
 *
 * Provides skeleton placeholders for various UI elements
 */

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

/**
 * Card skeleton for project/submission cards
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border p-4 space-y-3', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 py-3 px-4 border-b', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === 0 ? 'w-32' : i === columns - 1 ? 'w-16' : 'w-24'
          )}
        />
      ))}
    </div>
  );
}

/**
 * List skeleton for multiple items
 */
export function ListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Stats card skeleton for dashboard
 */
export function StatsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border p-4 space-y-2', className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

/**
 * Dashboard stats grid skeleton
 */
export function DashboardStatsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      <StatsSkeleton />
      <StatsSkeleton />
      <StatsSkeleton />
      <StatsSkeleton />
    </div>
  );
}

/**
 * Result card skeleton
 */
export function ResultCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border p-4 space-y-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="rounded-lg bg-muted p-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
        <Skeleton className="h-2 w-full mt-3 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Submission thumbnail skeleton
 */
export function ThumbnailSkeleton({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-30 w-30',
  };

  return <Skeleton className={cn('rounded-lg', sizes[size], className)} />;
}

/**
 * Thumbnail grid skeleton
 */
export function ThumbnailGridSkeleton({
  count = 6,
  columns = 3,
  className,
}: {
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={cn('grid gap-2', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ThumbnailSkeleton key={i} size="lg" />
      ))}
    </div>
  );
}

/**
 * Form skeleton
 */
export function FormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/**
 * Navigation skeleton
 */
export function NavSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Page header skeleton
 */
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <PageHeaderSkeleton />
      <DashboardStatsSkeleton />
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <ListSkeleton count={3} />
      </div>
    </div>
  );
}
