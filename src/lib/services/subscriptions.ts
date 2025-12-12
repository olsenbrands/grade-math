import { createClient } from '@/lib/supabase/client';

// ============================================
// TYPES
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  paper_limit: number;
  features: string[];
  stripe_price_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
}

export interface UsageInfo {
  papers_graded: number;
  papers_limit: number;
  papers_remaining: number;
  overage_papers: number;
  period_end: string;
}

export interface SubscriptionWithUsage {
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  usage: UsageInfo | null;
  canGrade: boolean;
  needsUpgrade: boolean;
}

// ============================================
// PLAN DEFINITIONS (for client-side reference)
// ============================================

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    papers: 10,
    description: 'Get 10 papers graded free',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9,
    papers: 100,
    description: 'Perfect for light grading needs',
  },
  classroom: {
    id: 'classroom',
    name: 'Classroom Teacher',
    price: 19,
    papers: 300,
    description: 'Most popular for everyday teachers',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy Grader',
    price: 39,
    papers: 1000,
    description: 'For teachers with high-volume grading',
  },
} as const;

export const OVERAGE_PRICE_CENTS = 500; // $5 for 100 papers
export const OVERAGE_PAPERS = 100;

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching plans:', error);
    // Return client-side fallback
    return Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price_cents: p.price * 100,
      paper_limit: p.papers,
      features: [],
      stripe_price_id: null,
      is_active: true,
      sort_order: 0,
    }));
  }

  return data || [];
}

/**
 * Get user's current subscription
 */
export async function getUserSubscription(): Promise<UserSubscription | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }

  return data;
}

/**
 * Get user's current usage for this billing period
 */
export async function getCurrentUsage(): Promise<UsageInfo | null> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Call the database function
  const { data, error } = await supabase.rpc('get_current_usage', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error fetching usage:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * Get complete subscription info with usage
 */
export async function getSubscriptionWithUsage(): Promise<SubscriptionWithUsage> {
  const [subscription, usage] = await Promise.all([
    getUserSubscription(),
    getCurrentUsage(),
  ]);

  const plan = subscription?.plan as SubscriptionPlan | undefined;
  const papersRemaining = usage?.papers_remaining ?? 0;
  const canGrade = papersRemaining > 0;
  const needsUpgrade = !canGrade && subscription?.plan_id !== 'power';

  return {
    subscription,
    plan: plan ?? null,
    usage,
    canGrade,
    needsUpgrade,
  };
}

/**
 * Check if user can grade a specific number of papers
 */
export async function canGradePapers(count: number = 1): Promise<boolean> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('can_grade_papers', {
    p_user_id: user.id,
    p_count: count,
  });

  if (error) {
    console.error('Error checking grade ability:', error);
    return false;
  }

  return data ?? false;
}

/**
 * Increment the papers graded count
 * Call this after successfully grading papers
 */
export async function incrementPapersGraded(count: number = 1): Promise<boolean> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('increment_papers_graded', {
    p_user_id: user.id,
    p_count: count,
  });

  if (error) {
    console.error('Error incrementing papers:', error);
    return false;
  }

  return data ?? false;
}

/**
 * Get formatted price string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Get formatted usage string (e.g., "45 of 100 papers")
 */
export function formatUsage(usage: UsageInfo | null): string {
  if (!usage) return 'No usage data';
  const total = usage.papers_limit + usage.overage_papers;
  return `${usage.papers_graded} of ${total} papers`;
}

/**
 * Get days remaining in billing period
 */
export function getDaysRemaining(periodEnd: string): number {
  const end = new Date(periodEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate cost per paper for a plan
 */
export function getCostPerPaper(plan: SubscriptionPlan): string {
  const cost = plan.price_cents / plan.paper_limit;
  return `$${(cost / 100).toFixed(2)}`;
}

// ============================================
// STRIPE INTEGRATION
// ============================================

/**
 * Create Stripe checkout session for subscription
 * Returns the checkout URL to redirect to
 */
export async function createCheckoutSession(planId: string): Promise<string | null> {
  try {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Checkout error:', error);
      return null;
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return null;
  }
}

/**
 * Create Stripe checkout for overage purchase (100 papers for $5)
 * Returns the checkout URL to redirect to
 */
export async function createOverageCheckout(): Promise<string | null> {
  try {
    const response = await fetch('/api/stripe/overage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Overage checkout error:', error);
      return null;
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Failed to create overage checkout:', error);
    return null;
  }
}

/**
 * Open Stripe customer portal for managing subscription
 * Returns the portal URL to redirect to
 */
export async function openCustomerPortal(): Promise<string | null> {
  try {
    const response = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Portal error:', error);
      return null;
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Failed to open customer portal:', error);
    return null;
  }
}
