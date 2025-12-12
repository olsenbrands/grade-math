'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface BatchGradingState {
  isActive: boolean;
  queue: string[]; // submission IDs waiting
  currentId: string | null; // currently grading
  completed: string[]; // successfully graded
  failed: string[]; // failed after retry
  needsReview: string[]; // completed but needs review
  totalCount: number;
  startTime: number | null;
}

interface BatchGradingProgressProps {
  state: BatchGradingState;
  onCancel: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  onMaximize?: () => void;
}

export function BatchGradingProgress({
  state,
  onCancel,
  onMinimize,
  isMinimized,
  onMaximize,
}: BatchGradingProgressProps) {
  const { isActive, queue, currentId, completed, failed, needsReview, totalCount, startTime } = state;

  const processedCount = completed.length + failed.length;
  const realPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;
  const nextMilestone = totalCount > 0 ? ((processedCount + 1) / totalCount) * 100 : 100;

  // Simulated creeping progress
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    if (!isActive) {
      // When not active, show real percentage
      setDisplayPercentage(realPercentage);
      return;
    }

    // If we're behind the real percentage, snap to it
    if (displayPercentage < realPercentage) {
      setDisplayPercentage(realPercentage);
    }

    // Start creeping toward next milestone (but only go 80% of the way)
    const maxCreep = realPercentage + (nextMilestone - realPercentage) * 0.8;

    animationRef.current = setInterval(() => {
      setDisplayPercentage((prev) => {
        // Don't exceed our max creep point
        if (prev >= maxCreep) return prev;
        // Creep by small increment (slower as we approach the limit)
        const remaining = maxCreep - prev;
        const increment = Math.max(0.1, remaining * 0.05);
        return Math.min(prev + increment, maxCreep);
      });
    }, 200);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isActive, realPercentage, nextMilestone, currentId]);

  // Snap to real percentage when items complete
  useEffect(() => {
    if (displayPercentage < realPercentage) {
      setDisplayPercentage(realPercentage);
    }
  }, [realPercentage]);

  if (!isActive && completed.length === 0 && failed.length === 0) {
    return null;
  }

  const percentage = Math.round(displayPercentage);
  const remainingCount = queue.length + (currentId ? 1 : 0);

  // Estimate time remaining based on average processing time
  const avgTimePerItem = startTime && processedCount > 0
    ? (Date.now() - startTime) / processedCount
    : 25000; // Default 25 seconds
  const estimatedRemainingMs = remainingCount * avgTimePerItem;
  const estimatedRemainingMinutes = Math.ceil(estimatedRemainingMs / 60000);

  // Minimized view - small floating indicator
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 cursor-pointer"
        onClick={onMaximize}
      >
        <div className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-shadow">
          {isActive ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium">
                Grading {processedCount + 1}/{totalCount}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium">
              Batch complete
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full popup view
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {isActive ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Batch Grading
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 text-green-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Batch Complete
                </>
              )}
            </CardTitle>
            {onMinimize && isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMinimize}
                className="h-8 w-8 p-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isActive
                  ? `Grading ${processedCount + 1} of ${totalCount}...`
                  : `Processed ${processedCount} of ${totalCount}`}
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Estimated time */}
          {isActive && remainingCount > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              ~{estimatedRemainingMinutes} minute{estimatedRemainingMinutes !== 1 ? 's' : ''} remaining
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-lg font-bold text-green-600">{completed.length - needsReview.length}</div>
              <div className="text-xs text-green-600/80">Completed</div>
            </div>
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-lg font-bold text-yellow-600">{needsReview.length}</div>
              <div className="text-xs text-yellow-600/80">Review</div>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-lg font-bold text-red-600">{failed.length}</div>
              <div className="text-xs text-red-600/80">Failed</div>
            </div>
          </div>

          {/* Queue indicator */}
          {isActive && queue.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {queue.length} submission{queue.length !== 1 ? 's' : ''} in queue
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            {isActive ? (
              <Button variant="destructive" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Button onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Initial state factory
export function createInitialBatchState(): BatchGradingState {
  return {
    isActive: false,
    queue: [],
    currentId: null,
    completed: [],
    failed: [],
    needsReview: [],
    totalCount: 0,
    startTime: null,
  };
}
