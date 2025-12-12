'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Plus, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PLANS } from '@/lib/services/subscriptions';

interface OveragePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId: string;
  papersNeeded: number;
  onAddPapers: () => void;
  onUpgrade: () => void;
}

/**
 * OveragePrompt - Shown when user tries to grade but has no papers remaining
 *
 * Value-focused messaging:
 * - "Keep grading" not "buy tokens"
 * - Focus on time saved, not technical details
 * - Make adding papers feel frictionless
 */
export function OveragePrompt({
  open,
  onOpenChange,
  currentPlanId,
  papersNeeded,
  onAddPapers,
  onUpgrade,
}: OveragePromptProps) {
  const [loading, setLoading] = useState(false);
  const currentPlan = PLANS[currentPlanId as keyof typeof PLANS];

  // Suggest upgrade path
  const upgradePlan =
    currentPlanId === 'free' || currentPlanId === 'starter'
      ? PLANS.classroom
      : currentPlanId === 'classroom'
        ? PLANS.heavy
        : null;

  const handleAddPapers = async () => {
    setLoading(true);
    try {
      await onAddPapers();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl">You&apos;ve used all your papers</DialogTitle>
          </div>
          <DialogDescription>
            You&apos;ve graded all {currentPlan?.papers || 'your'} papers this month.
            {papersNeeded > 1 && ` You need ${papersNeeded} more papers to continue.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Add Option */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Add 100 papers for $5</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep grading without interruption. Papers never expire while subscribed.
                </p>
                <Button
                  onClick={handleAddPapers}
                  disabled={loading}
                  className="mt-3"
                  size="sm"
                >
                  {loading ? 'Processing...' : 'Add Papers — $5'}
                </Button>
              </div>
            </div>
          </div>

          {/* Upgrade Option */}
          {upgradePlan && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">Upgrade to {upgradePlan.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get {upgradePlan.papers} papers/month for ${upgradePlan.price}/mo
                    {currentPlan && ` (${Math.round((upgradePlan.papers / currentPlan.papers - 1) * 100)}% more papers)`}
                  </p>
                  <Link href="/pricing">
                    <Button
                      variant="outline"
                      onClick={onUpgrade}
                      className="mt-3"
                      size="sm"
                    >
                      View Plans
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Less than $0.10 per paper — hours of your time back
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * UsageBanner - Inline warning shown when papers are running low
 */
interface UsageBannerProps {
  papersRemaining: number;
  totalPapers: number;
  onAddPapers: () => void;
}

export function UsageBanner({ papersRemaining, totalPapers, onAddPapers }: UsageBannerProps) {
  // Only show if low on papers (< 20% remaining)
  const percentRemaining = (papersRemaining / totalPapers) * 100;
  if (percentRemaining > 20 || papersRemaining > 20) return null;

  const isUrgent = papersRemaining <= 5;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        isUrgent
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle
          className={`h-4 w-4 ${
            isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            isUrgent
              ? 'text-red-800 dark:text-red-200'
              : 'text-amber-800 dark:text-amber-200'
          }`}
        >
          {papersRemaining === 0
            ? 'No papers remaining'
            : `${papersRemaining} paper${papersRemaining === 1 ? '' : 's'} remaining`}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onAddPapers}
        className={
          isUrgent
            ? 'border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300'
            : 'border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300'
        }
      >
        Add Papers
      </Button>
    </div>
  );
}
