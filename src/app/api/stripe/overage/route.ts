/**
 * Stripe Overage Purchase API
 *
 * Creates a one-time checkout session for purchasing additional papers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, OVERAGE_PRICE_ID, getAppUrl } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!OVERAGE_PRICE_ID) {
      return NextResponse.json(
        { error: 'Overage price not configured' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Store customer ID
      await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const appUrl = getAppUrl();

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: OVERAGE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings?overage=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?overage=canceled`,
      payment_intent_data: {
        metadata: {
          supabase_user_id: user.id,
          type: 'overage',
          papers: '100',
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Overage checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create overage checkout' },
      { status: 500 }
    );
  }
}
