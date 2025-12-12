import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextResponse } from 'next/server';

// Mock Supabase server client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Token API - GET /api/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return balance and healthy status for high balance', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 50, error: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.balance).toBe(50);
    expect(data.status).toBe('healthy');
    expect(data.canGrade).toBe(true);
  });

  it('should return low status for balance <= 10', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 8, error: null });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('low');
    expect(data.canGrade).toBe(true);
  });

  it('should return critical status for balance <= 5', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 3, error: null });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('critical');
    expect(data.canGrade).toBe(true);
  });

  it('should return zero status and canGrade false for balance <= 0', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 0, error: null });

    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('zero');
    expect(data.canGrade).toBe(false);
  });
});

describe('Token API - POST /api/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ action: 'history' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for unknown action', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid-action' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unknown action');
  });

  it('should return 400 for check-cost without submissionCount', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({ action: 'check-cost' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('submissionCount required');
  });

  it('should calculate cost correctly without discount', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 50, error: null });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({
        action: 'check-cost',
        submissionCount: 5,
        includeFeedback: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cost).toBe(5);
    expect(data.hasDiscount).toBe(false);
    expect(data.canAfford).toBe(true);
  });

  it('should calculate cost with bulk discount for 10+ submissions', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 50, error: null });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({
        action: 'check-cost',
        submissionCount: 10,
        includeFeedback: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cost).toBe(9); // 10 * 1 * 0.9 = 9
    expect(data.hasDiscount).toBe(true);
    expect(data.savings).toBe(1);
  });

  it('should include feedback cost when requested', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 50, error: null });

    const request = new Request('http://localhost/api/tokens', {
      method: 'POST',
      body: JSON.stringify({
        action: 'check-cost',
        submissionCount: 5,
        includeFeedback: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cost).toBe(10); // 5 * (1 + 1) = 10
  });
});
