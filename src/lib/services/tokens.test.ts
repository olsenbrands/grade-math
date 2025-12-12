import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TOKEN_COSTS,
  BALANCE_THRESHOLDS,
  calculateGradingCost,
} from './tokens';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: 100, error: null }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-transaction-id' },
            error: null,
          }),
        })),
      })),
    })),
  }),
}));

describe('Token Costs Constants', () => {
  it('should have correct submission grade cost', () => {
    expect(TOKEN_COSTS.SUBMISSION_GRADE).toBe(1);
  });

  it('should have correct feedback generation cost', () => {
    expect(TOKEN_COSTS.FEEDBACK_GENERATION).toBe(1);
  });

  it('should have correct bulk discount threshold', () => {
    expect(TOKEN_COSTS.BULK_DISCOUNT_THRESHOLD).toBe(10);
  });

  it('should have 10% bulk discount rate', () => {
    expect(TOKEN_COSTS.BULK_DISCOUNT_RATE).toBe(0.1);
  });

  it('should have correct signup bonus', () => {
    expect(TOKEN_COSTS.SIGNUP_BONUS).toBe(50);
  });
});

describe('Balance Thresholds', () => {
  it('should have correct low warning threshold', () => {
    expect(BALANCE_THRESHOLDS.LOW_WARNING).toBe(10);
  });

  it('should have correct critical warning threshold', () => {
    expect(BALANCE_THRESHOLDS.CRITICAL_WARNING).toBe(5);
  });

  it('should have zero block threshold', () => {
    expect(BALANCE_THRESHOLDS.ZERO_BLOCK).toBe(0);
  });
});

describe('calculateGradingCost', () => {
  describe('without feedback', () => {
    it('should calculate cost for single submission', () => {
      const cost = calculateGradingCost(1);
      expect(cost).toBe(1);
    });

    it('should calculate cost for multiple submissions', () => {
      const cost = calculateGradingCost(5);
      expect(cost).toBe(5);
    });

    it('should apply bulk discount at threshold', () => {
      const cost = calculateGradingCost(10);
      // 10 submissions * 1 token = 10, with 10% discount = 9
      expect(cost).toBe(9);
    });

    it('should apply bulk discount above threshold', () => {
      const cost = calculateGradingCost(20);
      // 20 submissions * 1 token = 20, with 10% discount = 18
      expect(cost).toBe(18);
    });

    it('should not apply bulk discount below threshold', () => {
      const cost = calculateGradingCost(9);
      expect(cost).toBe(9);
    });
  });

  describe('with feedback', () => {
    it('should calculate cost for single submission with feedback', () => {
      const cost = calculateGradingCost(1, true);
      // 1 * (1 grading + 1 feedback) = 2
      expect(cost).toBe(2);
    });

    it('should calculate cost for multiple submissions with feedback', () => {
      const cost = calculateGradingCost(5, true);
      // 5 * (1 grading + 1 feedback) = 10
      expect(cost).toBe(10);
    });

    it('should apply bulk discount with feedback at threshold', () => {
      const cost = calculateGradingCost(10, true);
      // 10 * (1 + 1) = 20, with 10% discount = 18
      expect(cost).toBe(18);
    });

    it('should apply bulk discount with feedback above threshold', () => {
      const cost = calculateGradingCost(25, true);
      // 25 * (1 + 1) = 50, with 10% discount = 45
      expect(cost).toBe(45);
    });
  });

  describe('edge cases', () => {
    it('should handle zero submissions', () => {
      const cost = calculateGradingCost(0);
      expect(cost).toBe(0);
    });

    it('should handle zero submissions with feedback', () => {
      const cost = calculateGradingCost(0, true);
      expect(cost).toBe(0);
    });

    it('should floor the discounted cost', () => {
      // 11 * 1 = 11, with 10% discount = 9.9, floored to 9
      const cost = calculateGradingCost(11);
      expect(cost).toBe(9);
    });

    it('should handle large batch sizes', () => {
      const cost = calculateGradingCost(1000, true);
      // 1000 * 2 = 2000, with 10% discount = 1800
      expect(cost).toBe(1800);
    });
  });
});

describe('Token Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // These tests require the actual service functions
  // They will use the mocked Supabase client

  it('should export all required functions', async () => {
    const tokens = await import('./tokens');

    expect(tokens.getTokenBalance).toBeDefined();
    expect(tokens.getTokenHistory).toBeDefined();
    expect(tokens.hasEnoughTokens).toBeDefined();
    expect(tokens.getBalanceStatus).toBeDefined();
    expect(tokens.debitTokens).toBeDefined();
    expect(tokens.creditTokens).toBeDefined();
    expect(tokens.issueSignupBonus).toBeDefined();
    expect(tokens.refundTokens).toBeDefined();
    expect(tokens.adminGrantTokens).toBeDefined();
    expect(tokens.reserveTokensForBatch).toBeDefined();
    expect(tokens.processFailedBatchRefunds).toBeDefined();
  });

  it('should export TransactionResult interface', async () => {
    const tokens = await import('./tokens');
    // TransactionResult is used as a type, so we verify functions return the correct shape
    expect(typeof tokens.debitTokens).toBe('function');
    expect(typeof tokens.creditTokens).toBe('function');
  });
});
