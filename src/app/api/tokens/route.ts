/**
 * Token Management API
 *
 * Handles token balance queries and operations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET - Get current user's token balance and status
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get balance using RPC
    const { data: balance, error: balanceError } = await supabase.rpc(
      'get_token_balance',
      { p_user_id: user.id }
    );

    if (balanceError) {
      console.error('Error fetching balance:', balanceError);
      return NextResponse.json(
        { error: 'Failed to fetch balance' },
        { status: 500 }
      );
    }

    // Determine status
    const currentBalance = balance || 0;
    let status: 'healthy' | 'low' | 'critical' | 'zero' = 'healthy';
    if (currentBalance <= 0) status = 'zero';
    else if (currentBalance <= 5) status = 'critical';
    else if (currentBalance <= 10) status = 'low';

    return NextResponse.json({
      balance: currentBalance,
      status,
      canGrade: currentBalance > 0,
    });
  } catch (error) {
    console.error('Token API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Token operations (admin only for grants, user for history)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'history': {
        // Get transaction history
        const { limit = 20 } = body;

        const { data, error } = await supabase
          .from('token_ledger')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          return NextResponse.json(
            { error: 'Failed to fetch history' },
            { status: 500 }
          );
        }

        return NextResponse.json({ transactions: data || [] });
      }

      case 'check-cost': {
        // Check if user can afford an operation
        const { submissionCount, includeFeedback = false } = body;

        if (!submissionCount || submissionCount < 1) {
          return NextResponse.json(
            { error: 'submissionCount required' },
            { status: 400 }
          );
        }

        // Get current balance
        const { data: balance } = await supabase.rpc('get_token_balance', {
          p_user_id: user.id,
        });

        const currentBalance = balance || 0;

        // Calculate cost
        const baseCost = submissionCount * (1 + (includeFeedback ? 1 : 0));
        const hasDiscount = submissionCount >= 10;
        const cost = hasDiscount ? Math.floor(baseCost * 0.9) : baseCost;
        const canAfford = currentBalance >= cost;

        return NextResponse.json({
          cost,
          currentBalance,
          canAfford,
          remaining: currentBalance - cost,
          hasDiscount,
          savings: hasDiscount ? baseCost - cost : 0,
        });
      }

      case 'admin-grant': {
        // Admin-only operation to grant tokens
        const { targetUserId, amount, reason } = body;

        // TODO: Add proper admin check
        // For now, check if user is granting to themselves (demo mode)
        if (targetUserId !== user.id) {
          return NextResponse.json(
            { error: 'Admin privileges required' },
            { status: 403 }
          );
        }

        if (!amount || amount <= 0) {
          return NextResponse.json(
            { error: 'Valid amount required' },
            { status: 400 }
          );
        }

        // Get current balance
        const { data: currentBalance } = await supabase.rpc('get_token_balance', {
          p_user_id: targetUserId,
        });

        const newBalance = (currentBalance || 0) + amount;

        // Insert transaction
        const { data: transaction, error: insertError } = await supabase
          .from('token_ledger')
          .insert({
            user_id: targetUserId,
            amount: amount,
            balance_after: newBalance,
            operation: 'admin_grant',
            notes: reason || 'Admin grant',
          })
          .select('id')
          .single();

        if (insertError) {
          return NextResponse.json(
            { error: 'Failed to grant tokens' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          transactionId: transaction.id,
          newBalance,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Token API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
