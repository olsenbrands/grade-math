/**
 * Stripe Client Configuration
 *
 * Server-side only - do not import in client components
 */

import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-11-17.clover',
    typescript: true,
  });

  return stripeInstance;
}

// Export stripe for convenience - will throw at runtime if not configured
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const instance = getStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (instance as any)[prop];
  },
});

/**
 * Plan ID to Stripe Price ID mapping
 * These IDs should match the stripe_price_id values in the subscription_plans table
 */
export const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  classroom: process.env.STRIPE_PRICE_CLASSROOM || '',
  heavy: process.env.STRIPE_PRICE_HEAVY || '',
};

export const OVERAGE_PRICE_ID = process.env.STRIPE_PRICE_OVERAGE || '';

/**
 * Add-on price IDs
 */
export const ADDON_PRICE_IDS: Record<string, string> = {
  smart_explanations: process.env.STRIPE_PRICE_SMART_EXPLANATIONS || '',
};

/**
 * Get the app URL for redirects
 */
export function getAppUrl(): string {
  // Vercel deployment URLs
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Custom domain
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Local development
  return 'http://localhost:3000';
}
