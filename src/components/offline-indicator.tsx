'use client';

/**
 * Offline Indicator Component
 *
 * Shows network status awareness throughout the app
 */

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Hook to track online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Global offline banner - shows at top of page when offline
 */
export function OfflineBanner({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when coming back online
  useEffect(() => {
    if (isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-950 px-4 py-2',
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            You&apos;re offline. Some features may not work.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-yellow-950 hover:text-yellow-900 hover:bg-yellow-400"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact offline indicator for header/nav
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs',
        isOnline ? 'text-green-600' : 'text-yellow-600',
        className
      )}
      title={isOnline ? 'Online' : 'Offline'}
    >
      {isOnline ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
    </div>
  );
}

/**
 * Offline-aware action wrapper
 * Disables actions and shows message when offline
 */
interface OfflineAwareProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showWarning?: boolean;
}

export function OfflineAware({
  children,
  fallback,
  showWarning = true,
}: OfflineAwareProps) {
  const isOnline = useOnlineStatus();

  if (!isOnline) {
    if (fallback) return <>{fallback}</>;

    if (showWarning) {
      return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Offline</p>
              <p className="text-sm text-yellow-600">
                This feature requires an internet connection.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}

/**
 * Sync status indicator for data that may be out of sync
 */
interface SyncStatusProps {
  lastSynced?: Date;
  isSyncing?: boolean;
  onSync?: () => void;
  className?: string;
}

export function SyncStatus({
  lastSynced,
  isSyncing = false,
  onSync,
  className,
}: SyncStatusProps) {
  const isOnline = useOnlineStatus();

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      {!isOnline && (
        <span className="flex items-center gap-1 text-yellow-600">
          <WifiOff className="h-3 w-3" />
          Offline
        </span>
      )}
      {lastSynced && (
        <span className="text-muted-foreground">
          Synced {getTimeAgo(lastSynced)}
        </span>
      )}
      {onSync && isOnline && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="h-6 px-2"
        >
          <RefreshCw
            className={cn('h-3 w-3', isSyncing && 'animate-spin')}
          />
        </Button>
      )}
    </div>
  );
}

/**
 * Queued action indicator
 * Shows when actions are queued for when back online
 */
interface QueuedActionsProps {
  count: number;
  onClear?: () => void;
  className?: string;
}

export function QueuedActions({
  count,
  onClear,
  className,
}: QueuedActionsProps) {
  const isOnline = useOnlineStatus();

  if (count === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        isOnline
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-yellow-200 bg-yellow-50 text-yellow-700',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>
        {count} action{count !== 1 ? 's' : ''}{' '}
        {isOnline ? 'syncing...' : 'queued'}
      </span>
      {onClear && !isOnline && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 px-2 ml-auto"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
