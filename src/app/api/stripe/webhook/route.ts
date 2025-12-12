/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events for subscription lifecycle and overage purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Extend Stripe types to include properties not in the SDK type definitions
// These properties are present in the API response but missing from TypeScript types in v20
interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

// Use service role for webhook operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map Stripe price IDs to plan IDs
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER || '']: 'starter',
  [process.env.STRIPE_PRICE_CLASSROOM || '']: 'classroom',
  [process.env.STRIPE_PRICE_HEAVY || '']: 'heavy',
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleSubscriptionCheckout(session);
        } else if (session.mode === 'payment') {
          await handleOveragePurchase(session);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No user ID in checkout session metadata');
    return;
  }

  // Get subscription details - cast to extended type that includes period properties
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as SubscriptionWithPeriod;

  const priceId = subscription.items.data[0]?.price.id;
  const planId = (priceId ? PRICE_TO_PLAN[priceId] : null) || session.metadata?.plan_id || 'starter';

  // Update user subscription
  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      plan_id: planId,
      status: 'active',
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`Subscription checkout completed for user ${userId}, plan: ${planId}`);
}

async function handleOveragePurchase(session: Stripe.Checkout.Session) {
  // Get payment intent to access metadata
  const paymentIntentId = session.payment_intent as string;
  if (!paymentIntentId) {
    console.error('No payment intent in checkout session');
    return;
  }

  // Cast to PaymentIntent for type safety
  const paymentIntent = (await stripe.paymentIntents.retrieve(paymentIntentId)) as unknown as Stripe.PaymentIntent;
  const userId = paymentIntent.metadata?.supabase_user_id;
  const papers = parseInt(paymentIntent.metadata?.papers || '100', 10);

  if (!userId) {
    console.error('No user ID in payment intent metadata');
    return;
  }

  // Get current usage period
  const now = new Date().toISOString();
  const { data: usagePeriod } = await supabaseAdmin
    .from('usage_periods')
    .select('id, overage_papers')
    .eq('user_id', userId)
    .lte('period_start', now)
    .gte('period_end', now)
    .single();

  // Create overage purchase record
  await supabaseAdmin.from('overage_purchases').insert({
    user_id: userId,
    usage_period_id: usagePeriod?.id || null,
    papers_purchased: papers,
    price_cents: 500, // $5
    stripe_payment_id: paymentIntentId,
    status: 'completed',
  });

  // Add papers to current usage period
  if (usagePeriod) {
    const newOveragePapers = (usagePeriod.overage_papers || 0) + papers;
    await supabaseAdmin
      .from('usage_periods')
      .update({
        overage_papers: newOveragePapers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usagePeriod.id);
  }

  console.log(`Added ${papers} overage papers for user ${userId}`);
}

async function handleSubscriptionUpdate(subscriptionObj: Stripe.Subscription) {
  // Cast to extended type that includes period properties
  const subscription = subscriptionObj as SubscriptionWithPeriod;
  const customerId = subscription.customer as string;

  // Find user by customer ID
  const { data: userSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userSub) {
    console.error('No user found for customer:', customerId);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const planId = (priceId ? PRICE_TO_PLAN[priceId] : null) || 'starter';

  // Map Stripe status to our status
  let status: 'active' | 'canceled' | 'past_due' | 'trialing' = 'active';
  if (subscription.status === 'canceled') status = 'canceled';
  else if (subscription.status === 'past_due') status = 'past_due';
  else if (subscription.status === 'trialing') status = 'trialing';

  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      plan_id: planId,
      status,
      stripe_subscription_id: subscription.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userSub.user_id);

  console.log(`Subscription updated for user ${userSub.user_id}, status: ${status}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: userSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userSub) return;

  // Revert to free plan
  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      plan_id: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userSub.user_id);

  console.log(`Subscription canceled for user ${userSub.user_id}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Handle successful payment - can be used for email notifications, etc.
  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: userSub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userSub) return;

  // Mark subscription as past_due
  await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userSub.user_id);

  console.log(`Payment failed for user ${userSub.user_id}`);
}
