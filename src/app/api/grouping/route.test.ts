import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

// Mock the student grouping service
vi.mock('@/lib/services/student-grouping', () => ({
  autoGroupSubmission: vi.fn(),
  batchAutoGroup: vi.fn(),
  manualAssignStudent: vi.fn(),
  createAndAssignStudent: vi.fn(),
  matchNameToRoster: vi.fn(),
  saveTeacherCorrection: vi.fn(),
}));

// Mock Supabase server client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        single: vi.fn(),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('Grouping API - GET /api/grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/grouping?projectId=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when projectId is missing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('projectId required');
  });

  it('should return 404 when project not found', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/grouping?projectId=nonexistent');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });
});

describe('Grouping API - POST /api/grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'auto-group' }),
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

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid-action' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unknown action');
  });

  it('should return 400 for auto-group without submissionId', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'auto-group' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('submissionId required');
  });

  it('should return 400 for batch-auto-group without projectId', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'batch-auto-group' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('projectId required');
  });

  it('should return 400 for manual-assign without required fields', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'manual-assign', submissionId: 'test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('submissionId and studentId required');
  });

  it('should return 400 for create-and-assign without required fields', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'create-and-assign', submissionId: 'test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('submissionId and studentName required');
  });

  it('should return 400 for save-correction without required fields', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'save-correction' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('detectedName and correctStudentId required');
  });

  it('should return 400 for match-preview without detectedName', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({ action: 'match-preview' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('detectedName required');
  });

  it('should call autoGroupSubmission for auto-group action', async () => {
    const { autoGroupSubmission } = await import('@/lib/services/student-grouping');
    (autoGroupSubmission as ReturnType<typeof vi.fn>).mockResolvedValue({
      submissionId: 'test-id',
      assigned: true,
      matches: [],
      needsReview: false,
    });

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const request = new Request('http://localhost/api/grouping', {
      method: 'POST',
      body: JSON.stringify({
        action: 'auto-group',
        submissionId: 'test-id',
        detectedName: 'John Smith',
        nameConfidence: 0.9,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(autoGroupSubmission).toHaveBeenCalledWith('test-id', 'John Smith', 0.9);
    expect(data.submissionId).toBe('test-id');
    expect(data.assigned).toBe(true);
  });
});
