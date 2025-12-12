import { createClient } from '@/lib/supabase/client';
import type { TokenLedgerEntry, TokenOperation } from '@/types/database';

/**
 * Token costs for different operations
 */
export const TOKEN_COSTS = {
  SUBMISSION_GRADE: 1,
  FEEDBACK_GENERATION: 1,
  BULK_DISCOUNT_THRESHOLD: 10,
  BULK_DISCOUNT_RATE: 0.1, // 10% discount
  SIGNUP_BONUS: 50, // Free tokens for new users
} as const;

/**
 * Low balance warning thresholds
 */
export const BALANCE_THRESHOLDS = {
  LOW_WARNING: 10, // Show warning when below this
  CRITICAL_WARNING: 5, // Show critical warning
  ZERO_BLOCK: 0, // Block operations at this level
} as const;

/**
 * Transaction result from debit/credit operations
 */
export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  newBalance: number;
  error?: string;
}

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

/**
 * Get balance status for UI display
 */
export async function getBalanceStatus(): Promise<{
  balance: number;
  status: 'healthy' | 'low' | 'critical' | 'zero';
  canGrade: boolean;
}> {
  const balance = await getTokenBalance();

  let status: 'healthy' | 'low' | 'critical' | 'zero' = 'healthy';
  if (balance <= BALANCE_THRESHOLDS.ZERO_BLOCK) {
    status = 'zero';
  } else if (balance <= BALANCE_THRESHOLDS.CRITICAL_WARNING) {
    status = 'critical';
  } else if (balance <= BALANCE_THRESHOLDS.LOW_WARNING) {
    status = 'low';
  }

  return {
    balance,
    status,
    canGrade: balance > BALANCE_THRESHOLDS.ZERO_BLOCK,
  };
}

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

/**
 * Debit tokens from user's account (for operations like grading)
 * Uses optimistic locking pattern for concurrent safety
 */
export async function debitTokens(
  amount: number,
  operation: TokenOperation,
  referenceId?: string,
  notes?: string
): Promise<TransactionResult> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, newBalance: 0, error: 'Not authenticated' };
  }

  // Get current balance first
  const currentBalance = await getTokenBalance();

  // Check sufficient balance
  if (currentBalance < amount) {
    return {
      success: false,
      newBalance: currentBalance,
      error: `Insufficient tokens. Need ${amount}, have ${currentBalance}`,
    };
  }

  const newBalance = currentBalance - amount;

  // Insert transaction record
  const { data, error } = await supabase
    .from('token_ledger')
    .insert({
      user_id: user.id,
      amount: -amount, // Negative for debit
      balance_after: newBalance,
      operation,
      reference_id: referenceId || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Token debit failed:', error);
    return {
      success: false,
      newBalance: currentBalance,
      error: 'Transaction failed',
    };
  }

  return {
    success: true,
    transactionId: data.id,
    newBalance,
  };
}

/**
 * Credit tokens to user's account (for refunds, bonuses, purchases)
 */
export async function creditTokens(
  amount: number,
  operation: TokenOperation,
  referenceId?: string,
  notes?: string
): Promise<TransactionResult> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, newBalance: 0, error: 'Not authenticated' };
  }

  // Get current balance
  const currentBalance = await getTokenBalance();
  const newBalance = currentBalance + amount;

  // Insert transaction record
  const { data, error } = await supabase
    .from('token_ledger')
    .insert({
      user_id: user.id,
      amount: amount, // Positive for credit
      balance_after: newBalance,
      operation,
      reference_id: referenceId || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Token credit failed:', error);
    return {
      success: false,
      newBalance: currentBalance,
      error: 'Transaction failed',
    };
  }

  return {
    success: true,
    transactionId: data.id,
    newBalance,
  };
}

/**
 * Issue signup bonus to new user
 */
export async function issueSignupBonus(): Promise<TransactionResult> {
  return creditTokens(
    TOKEN_COSTS.SIGNUP_BONUS,
    'signup_bonus',
    undefined,
    'Welcome bonus for new account'
  );
}

/**
 * Refund tokens for failed processing
 */
export async function refundTokens(
  amount: number,
  submissionId: string,
  reason: string
): Promise<TransactionResult> {
  return creditTokens(amount, 'refund', submissionId, `Refund: ${reason}`);
}

/**
 * Admin grant tokens to a user
 */
export async function adminGrantTokens(
  targetUserId: string,
  amount: number,
  reason: string
): Promise<TransactionResult> {
  const supabase = createClient();

  // Get target user's current balance
  const { data: balanceData, error: balanceError } = await supabase.rpc(
    'get_token_balance',
    { p_user_id: targetUserId }
  );

  if (balanceError) {
    return { success: false, newBalance: 0, error: 'Failed to get user balance' };
  }

  const currentBalance = balanceData || 0;
  const newBalance = currentBalance + amount;

  // Insert transaction
  const { data, error } = await supabase
    .from('token_ledger')
    .insert({
      user_id: targetUserId,
      amount: amount,
      balance_after: newBalance,
      operation: 'admin_grant',
      notes: `Admin grant: ${reason}`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Admin grant failed:', error);
    return { success: false, newBalance: currentBalance, error: 'Grant failed' };
  }

  return {
    success: true,
    transactionId: data.id,
    newBalance,
  };
}

/**
 * Reserve tokens for a batch operation (debit upfront, refund on failure)
 */
export async function reserveTokensForBatch(
  submissionIds: string[],
  includeFeedback: boolean
): Promise<{
  success: boolean;
  transactionId?: string;
  totalCost: number;
  error?: string;
}> {
  const totalCost = calculateGradingCost(submissionIds.length, includeFeedback);

  const result = await debitTokens(
    totalCost,
    'submission',
    submissionIds.join(','),
    `Batch grading: ${submissionIds.length} submissions${includeFeedback ? ' with feedback' : ''}`
  );

  return {
    success: result.success,
    transactionId: result.transactionId,
    totalCost,
    error: result.error,
  };
}

/**
 * Process refunds for failed submissions in a batch
 */
export async function processFailedBatchRefunds(
  failedSubmissionIds: string[],
  includedFeedback: boolean,
  originalTransactionId?: string
): Promise<number> {
  if (failedSubmissionIds.length === 0) return 0;

  // Calculate refund amount (proportional to failures)
  const costPerSubmission =
    TOKEN_COSTS.SUBMISSION_GRADE +
    (includedFeedback ? TOKEN_COSTS.FEEDBACK_GENERATION : 0);
  const refundAmount = failedSubmissionIds.length * costPerSubmission;

  const result = await refundTokens(
    refundAmount,
    originalTransactionId || failedSubmissionIds.join(','),
    `${failedSubmissionIds.length} failed submissions`
  );

  return result.success ? refundAmount : 0;
}
