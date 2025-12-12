import { createClient } from '@/lib/supabase/client';
import type { TokenLedgerEntry } from '@/types/database';

/**
 * Get current token balance for the authenticated user
 */
export async function getTokenBalance(): Promise<number> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Call the database function
  const { data, error } = await supabase.rpc('get_token_balance', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error fetching token balance:', error);
    throw new Error('Failed to fetch token balance');
  }

  return data || 0;
}

/**
 * Get token transaction history
 */
export async function getTokenHistory(limit = 20): Promise<TokenLedgerEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('token_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching token history:', error);
    throw new Error('Failed to fetch token history');
  }

  return data || [];
}

/**
 * Check if user has enough tokens for an operation
 */
export async function hasEnoughTokens(cost: number): Promise<boolean> {
  const balance = await getTokenBalance();
  return balance >= cost;
}

// Token costs for operations
export const TOKEN_COSTS = {
  SUBMISSION_GRADE: 1,
  FEEDBACK_GENERATION: 1,
  BULK_DISCOUNT_THRESHOLD: 10,
  BULK_DISCOUNT_RATE: 0.1, // 10% discount
} as const;

/**
 * Calculate cost for grading submissions
 */
export function calculateGradingCost(submissionCount: number, includeFeedback = false): number {
  let baseCost = submissionCount * TOKEN_COSTS.SUBMISSION_GRADE;

  if (includeFeedback) {
    baseCost += submissionCount * TOKEN_COSTS.FEEDBACK_GENERATION;
  }

  // Apply bulk discount
  if (submissionCount >= TOKEN_COSTS.BULK_DISCOUNT_THRESHOLD) {
    baseCost = Math.floor(baseCost * (1 - TOKEN_COSTS.BULK_DISCOUNT_RATE));
  }

  return baseCost;
}
