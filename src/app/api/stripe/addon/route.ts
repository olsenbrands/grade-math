/**
 * Stripe Add-on Checkout Session API
 *
 * Creates a Stripe Checkout session for add-on subscription purchases.
 * Add-ons are additional recurring subscriptions (like Smart Explanations).
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, ADDON_PRICE_IDS, getAppUrl } from '@/lib/stripe';
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

    // Parse request body
    const body = await request.json();
    const { addonId } = body;

    if (!addonId || !ADDON_PRICE_IDS[addonId]) {
      return NextResponse.json(
        { error: 'Invalid add-on ID' },
        { status: 400 }
      );
    }

    const priceId = ADDON_PRICE_IDS[addonId];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price not configured for this add-on' },
        { status: 400 }
      );
    }

    // Check if user already has this add-on
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id, has_smart_explanations')
      .eq('user_id', user.id)
      .single();

    if (addonId === 'smart_explanations' && subscription?.has_smart_explanations) {
      return NextResponse.json(
        { error: 'You already have Smart Explanations' },
        { status: 400 }
      );
    }

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

    // Create checkout session for the add-on
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings?addon_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?addon_checkout=canceled`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          addon_id: addonId,
          is_addon: 'true',
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Add-on checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
