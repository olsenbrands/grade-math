'use client';

/**
 * Token Balance Component
 *
 * Displays token balance with status indicators for header/nav
 */

import { useEffect, useState, useCallback } from 'react';
import { Coins, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getBalanceStatus, BALANCE_THRESHOLDS } from '@/lib/services/tokens';

interface TokenBalanceProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onBalanceChange?: (balance: number) => void;
}

export function TokenBalance({
  className,
  showLabel = true,
  size = 'md',
  onBalanceChange,
}: TokenBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [status, setStatus] = useState<'healthy' | 'low' | 'critical' | 'zero'>('healthy');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getBalanceStatus();
      setBalance(result.balance);
      setStatus(result.status);
      onBalanceChange?.(result.balance);
    } catch (err) {
      console.error('Failed to fetch token balance:', err);
      setError('Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [onBalanceChange]);

  useEffect(() => {
    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Size variants
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  // Status colors
  const statusColors = {
    healthy: 'text-green-600',
    low: 'text-yellow-600',
    critical: 'text-orange-600',
    zero: 'text-red-600',
  };

  const statusBgColors = {
    healthy: 'bg-green-50 border-green-200',
    low: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-orange-50 border-orange-200',
    zero: 'bg-red-50 border-red-200',
  };

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBalance}
              className={cn('gap-1 text-muted-foreground', className)}
            >
              <RefreshCw className={iconSizes[size]} />
              <span>Retry</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Failed to load token balance. Click to retry.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center rounded-full border px-3 py-1',
              sizeClasses[size],
              statusBgColors[status],
              className
            )}
          >
            {status === 'zero' ? (
              <AlertCircle className={cn(iconSizes[size], statusColors[status])} />
            ) : status === 'critical' || status === 'low' ? (
              <AlertTriangle className={cn(iconSizes[size], statusColors[status])} />
            ) : (
              <Coins className={cn(iconSizes[size], statusColors[status])} />
            )}
            <span className={cn('font-medium', statusColors[status])}>
              {isLoading ? '...' : balance}
            </span>
            {showLabel && (
              <span className="text-muted-foreground">tokens</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Token Balance: {balance}</p>
            {status === 'zero' && (
              <p className="text-red-500">No tokens remaining. Purchase more to continue grading.</p>
            )}
            {status === 'critical' && (
              <p className="text-orange-500">Critical: Only {balance} tokens left!</p>
            )}
            {status === 'low' && (
              <p className="text-yellow-600">Low balance warning</p>
            )}
            <p className="text-xs text-muted-foreground">
              1 token = 1 submission graded
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Low Balance Warning Banner
 */
interface LowBalanceWarningProps {
  balance: number;
  onDismiss?: () => void;
  className?: string;
}

export function LowBalanceWarning({
  balance,
  onDismiss,
  className,
}: LowBalanceWarningProps) {
  if (balance > BALANCE_THRESHOLDS.LOW_WARNING) {
    return null;
  }

  const isZero = balance <= BALANCE_THRESHOLDS.ZERO_BLOCK;
  const isCritical = balance <= BALANCE_THRESHOLDS.CRITICAL_WARNING;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border p-4',
        isZero
          ? 'border-red-200 bg-red-50'
          : isCritical
          ? 'border-orange-200 bg-orange-50'
          : 'border-yellow-200 bg-yellow-50',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {isZero ? (
          <AlertCircle className="h-5 w-5 text-red-600" />
        ) : (
          <AlertTriangle className={cn('h-5 w-5', isCritical ? 'text-orange-600' : 'text-yellow-600')} />
        )}
        <div>
          <p
            className={cn(
              'font-medium',
              isZero ? 'text-red-700' : isCritical ? 'text-orange-700' : 'text-yellow-700'
            )}
          >
            {isZero
              ? 'No tokens remaining'
              : isCritical
              ? 'Critical: Low token balance'
              : 'Low token balance'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isZero
              ? 'You cannot grade submissions until you add more tokens.'
              : `You have ${balance} token${balance !== 1 ? 's' : ''} remaining.`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={isZero ? 'default' : 'outline'}>
          Get Tokens
        </Button>
        {onDismiss && !isZero && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Cost Preview Component
 */
interface CostPreviewProps {
  submissionCount: number;
  includeFeedback?: boolean;
  currentBalance: number;
  className?: string;
}

export function CostPreview({
  submissionCount,
  includeFeedback = false,
  currentBalance,
  className,
}: CostPreviewProps) {
  // Import inline to avoid circular dependency
  const { calculateGradingCost, TOKEN_COSTS } = require('@/lib/services/tokens');

  const cost = calculateGradingCost(submissionCount, includeFeedback);
  const hasDiscount =
    submissionCount >= TOKEN_COSTS.BULK_DISCOUNT_THRESHOLD;
  const baseCost = submissionCount * (TOKEN_COSTS.SUBMISSION_GRADE + (includeFeedback ? TOKEN_COSTS.FEEDBACK_GENERATION : 0));
  const savings = baseCost - cost;
  const canAfford = currentBalance >= cost;
  const remaining = currentBalance - cost;

  return (
    <div className={cn('rounded-lg border bg-muted/50 p-4', className)}>
      <h4 className="font-medium mb-3">Cost Estimate</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Submissions to grade</span>
          <span>{submissionCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Cost per submission</span>
          <span>
            {TOKEN_COSTS.SUBMISSION_GRADE}
            {includeFeedback ? ` + ${TOKEN_COSTS.FEEDBACK_GENERATION} (feedback)` : ''} token
            {TOKEN_COSTS.SUBMISSION_GRADE + (includeFeedback ? TOKEN_COSTS.FEEDBACK_GENERATION : 0) !== 1 ? 's' : ''}
          </span>
        </div>
        {hasDiscount && (
          <div className="flex justify-between text-green-600">
            <span>Bulk discount (10%)</span>
            <span>-{savings} tokens</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Total cost</span>
          <span>{cost} tokens</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span>Current balance</span>
          <span>{currentBalance} tokens</span>
        </div>
        <div
          className={cn(
            'flex justify-between font-medium',
            canAfford ? 'text-green-600' : 'text-red-600'
          )}
        >
          <span>After grading</span>
          <span>{remaining} tokens</span>
        </div>
        {!canAfford && (
          <div className="mt-2 rounded bg-red-50 p-2 text-red-600 text-center">
            Insufficient tokens. Need {cost - currentBalance} more.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline cost indicator for buttons
 */
interface CostBadgeProps {
  cost: number;
  className?: string;
}

export function CostBadge({ cost, className }: CostBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('ml-2', className)}>
      <Coins className="h-3 w-3 mr-1" />
      {cost}
    </Badge>
  );
}
