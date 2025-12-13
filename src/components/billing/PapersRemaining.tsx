'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getCurrentUsage, type UsageInfo } from '@/lib/services/subscriptions';

interface PapersRemainingProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onUsageChange?: (usage: UsageInfo | null) => void;
}

/**
 * PapersRemaining - Displays paper balance in a calm, teacher-friendly way
 *
 * Language: Always "papers" never "tokens"
 * Tone: Informative, not alarming
 */
export function PapersRemaining({
  className,
  showLabel = true,
  size = 'md',
  onUsageChange,
}: PapersRemainingProps) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getCurrentUsage();
      setUsage(result);
      onUsageChange?.(result);
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onUsageChange]);

  useEffect(() => {
    fetchUsage();

    // Refresh every 60 seconds
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  const papersRemaining = usage?.papers_remaining ?? 0;
  const totalPapers = usage ? usage.papers_limit + usage.overage_papers : 0;
  const isLow = papersRemaining > 0 && papersRemaining <= 5;
  const isZero = papersRemaining === 0;

  // Size variants
  const sizeClasses = {
    sm: 'text-xs gap-1 px-2 py-0.5',
    md: 'text-sm gap-1.5 px-3 py-1',
    lg: 'text-base gap-2 px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  // Status colors - calm, not alarming
  const getStatusColors = () => {
    if (isZero) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (isLow) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center rounded-full border animate-pulse',
          sizeClasses[size],
          'bg-muted border-muted',
          className
        )}
      >
        <FileText className={cn(iconSizes[size], 'text-muted-foreground')} />
        <span className="text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center rounded-full border',
              sizeClasses[size],
              getStatusColors(),
              className
            )}
          >
            {isZero ? (
              <AlertCircle className={cn(iconSizes[size])} />
            ) : (
              <FileText className={cn(iconSizes[size])} />
            )}
            <span className="font-medium">{papersRemaining}</span>
            {showLabel && (
              <span className="text-muted-foreground">
                {papersRemaining === 1 ? 'paper' : 'papers'}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">
              {papersRemaining} paper{papersRemaining !== 1 ? 's' : ''} remaining
            </p>
            {usage && (
              <p className="text-xs text-muted-foreground">
                {usage.papers_graded} of {totalPapers} used this period
              </p>
            )}
            {isZero && (
              <p className="text-xs text-amber-600">
                Add more papers to continue grading
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * PapersRemainingInline - Simple inline text for grading flow
 * Shows: "7 free papers remaining" or "3 papers remaining"
 */
interface PapersRemainingInlineProps {
  papersRemaining: number;
  isFreeTrial?: boolean;
  className?: string;
}

export function PapersRemainingInline({
  papersRemaining,
  isFreeTrial = false,
  className,
}: PapersRemainingInlineProps) {
  if (papersRemaining <= 0) return null;

  // Only show when papers are getting low (10 or fewer)
  if (papersRemaining > 10) return null;

  return (
    <span className={cn('text-sm text-muted-foreground', className)}>
      {papersRemaining} {isFreeTrial ? 'free ' : ''}paper{papersRemaining !== 1 ? 's' : ''} remaining
    </span>
  );
}
