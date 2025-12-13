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
import { createOverageCheckout } from '@/lib/services/subscriptions';

interface FreePapersBlockingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFreeTrial?: boolean;
}

/**
 * FreePapersBlockingModal - Shows when user has 0 papers remaining
 *
 * This modal BLOCKS grading and provides clear next steps.
 * Copy is trust-focused and teacher-friendly.
 */
export function FreePapersBlockingModal({
  open,
  onOpenChange,
  isFreeTrial = true,
}: FreePapersBlockingModalProps) {
  const [loading, setLoading] = useState(false);

  const handleAddPapers = async () => {
    setLoading(true);
    try {
      const checkoutUrl = await createOverageCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
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
            <DialogTitle className="text-xl">
              {isFreeTrial ? "You've used your free papers" : "You've used all your papers"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {isFreeTrial
              ? "You've graded all 10 free papers. Keep grading by adding more papers or upgrading your plan."
              : "You've used all your papers this month. Keep grading by adding more papers or upgrading your plan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Add Option - Primary */}
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
                  {loading ? 'Processing...' : 'Add 100 papers — $5'}
                </Button>
              </div>
            </div>
          </div>

          {/* Upgrade Option - Secondary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                <ArrowUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Upgrade to a plan</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Get up to 1,000 papers/month starting at $9/mo
                </p>
                <Link href="/pricing">
                  <Button
                    variant="outline"
                    className="mt-3"
                    size="sm"
                  >
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <p className="text-xs text-muted-foreground text-center sm:text-left flex-1">
            Your uploaded assignments are saved — nothing is lost.
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
