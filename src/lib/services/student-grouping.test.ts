import { describe, it, expect, vi } from 'vitest';
import {
  normalizeName,
  extractNameParts,
  stringSimilarity,
  matchNameToRoster,
} from './student-grouping';
import type { Student } from '@/types/database';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            not: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        is: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-student-id', name: 'Test Student' },
            error: null,
          }),
        })),
      })),
    })),
  }),
}));

describe('normalizeName', () => {
  it('should lowercase the name', () => {
    expect(normalizeName('John Smith')).toBe('john smith');
  });

  it('should trim whitespace', () => {
    expect(normalizeName('  John Smith  ')).toBe('john smith');
  });

  it('should remove title prefixes', () => {
    expect(normalizeName('Mr. John Smith')).toBe('john smith');
    expect(normalizeName('Mrs. Jane Doe')).toBe('jane doe');
    expect(normalizeName('Dr. Smith')).toBe('smith');
  });

  it('should remove punctuation', () => {
    expect(normalizeName("O'Connor")).toBe('o connor');
    expect(normalizeName('Smith-Jones')).toBe('smith jones');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeName('John    Smith')).toBe('john smith');
  });

  it('should handle empty string', () => {
    expect(normalizeName('')).toBe('');
  });

  it('should handle single name', () => {
    expect(normalizeName('Madonna')).toBe('madonna');
  });
});

describe('extractNameParts', () => {
  it('should extract first and last name', () => {
    const result = extractNameParts('John Smith');
    expect(result.firstName).toBe('john');
    expect(result.lastName).toBe('smith');
    expect(result.middleName).toBeNull();
  });

  it('should extract first, middle, and last name', () => {
    const result = extractNameParts('John Michael Smith');
    expect(result.firstName).toBe('john');
    expect(result.middleName).toBe('michael');
    expect(result.lastName).toBe('smith');
  });

  it('should handle multiple middle names', () => {
    const result = extractNameParts('John Michael James Smith');
    expect(result.firstName).toBe('john');
    expect(result.middleName).toBe('michael james');
    expect(result.lastName).toBe('smith');
  });

  it('should handle single name', () => {
    const result = extractNameParts('Madonna');
    expect(result.firstName).toBe('madonna');
    expect(result.lastName).toBe('');
    expect(result.middleName).toBeNull();
  });

  it('should handle empty string', () => {
    const result = extractNameParts('');
    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('');
    expect(result.middleName).toBeNull();
  });

  it('should provide normalized full name', () => {
    const result = extractNameParts('John  Smith');
    expect(result.fullNormalized).toBe('john smith');
  });
});

describe('stringSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(stringSimilarity('john', 'john')).toBe(1);
  });

  it('should return 0 for empty strings', () => {
    expect(stringSimilarity('', 'john')).toBe(0);
    expect(stringSimilarity('john', '')).toBe(0);
  });

  it('should return high similarity for similar strings', () => {
    const similarity = stringSimilarity('john', 'jonn');
    expect(similarity).toBeGreaterThan(0.7);
  });

  it('should return low similarity for different strings', () => {
    const similarity = stringSimilarity('john', 'mary');
    expect(similarity).toBeLessThan(0.5);
  });

  it('should handle case-sensitive comparison', () => {
    const similarity = stringSimilarity('John', 'john');
    expect(similarity).toBeLessThan(1);
  });

  it('should handle single character differences', () => {
    const similarity = stringSimilarity('smith', 'smyth');
    expect(similarity).toBeGreaterThan(0.6);
  });

  it('should handle substring matching', () => {
    const similarity = stringSimilarity('mike', 'michael');
    expect(similarity).toBeGreaterThan(0.4);
  });
});

describe('matchNameToRoster', () => {
  const createRoster = (): Student[] => [
    {
      id: '1',
      user_id: 'user-1',
      name: 'John Smith',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      user_id: 'user-1',
      name: 'Jane Doe',
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      user_id: 'user-1',
      name: 'Michael Johnson',
      created_at: new Date().toISOString(),
    },
    {
      id: '4',
      user_id: 'user-1',
      name: 'Sarah Williams',
      created_at: new Date().toISOString(),
    },
  ];

  it('should find exact match', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('John Smith', roster);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.studentName).toBe('John Smith');
    expect(matches[0]?.matchType).toBe('exact');
    expect(matches[0]?.confidence).toBe(1.0);
  });

  it('should find exact match case-insensitive', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('JOHN SMITH', roster);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.studentName).toBe('John Smith');
    expect(matches[0]?.matchType).toBe('exact');
  });

  it('should find fuzzy matches', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('Jon Smith', roster);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.studentName).toBe('John Smith');
    expect(matches[0]?.confidence).toBeGreaterThan(0.8);
  });

  it('should return empty array for no matches', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('Unknown Person', roster);

    expect(matches.length).toBe(0);
  });

  it('should return empty array for empty name', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('', roster);

    expect(matches.length).toBe(0);
  });

  it('should return empty array for empty roster', () => {
    const matches = matchNameToRoster('John Smith', []);

    expect(matches.length).toBe(0);
  });

  it('should sort matches by confidence descending', () => {
    const roster: Student[] = [
      {
        id: '1',
        user_id: 'user-1',
        name: 'John Smith',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        user_id: 'user-1',
        name: 'Johnny Smithson',
        created_at: new Date().toISOString(),
      },
    ];

    const matches = matchNameToRoster('John Smith', roster);

    expect(matches.length).toBe(2);
    expect(matches[0]?.confidence).toBeGreaterThanOrEqual(matches[1]?.confidence || 0);
  });

  it('should match first name only', () => {
    const roster = createRoster();
    const matches = matchNameToRoster('John', roster);

    const johnMatch = matches.find((m) => m.studentId === '1');
    expect(johnMatch).toBeDefined();
  });

  it('should handle nickname prefix matching', () => {
    const roster: Student[] = [
      {
        id: '1',
        user_id: 'user-1',
        name: 'Michael Johnson',
        created_at: new Date().toISOString(),
      },
    ];

    // 'Mike' is a prefix of 'Michael' with same last name
    // The algorithm should find this with partial match
    const matches = matchNameToRoster('Mich Johnson', roster);

    // Mich matches Michael better as a prefix
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.studentName).toBe('Michael Johnson');
  });
});

describe('Student Grouping Integration', () => {
  it('should export all required functions', async () => {
    const grouping = await import('./student-grouping');

    expect(grouping.normalizeName).toBeDefined();
    expect(grouping.extractNameParts).toBeDefined();
    expect(grouping.stringSimilarity).toBeDefined();
    expect(grouping.matchNameToRoster).toBeDefined();
    expect(grouping.autoGroupSubmission).toBeDefined();
    expect(grouping.manualAssignStudent).toBeDefined();
    expect(grouping.createAndAssignStudent).toBeDefined();
    expect(grouping.saveTeacherCorrection).toBeDefined();
    expect(grouping.getUnassignedSubmissions).toBeDefined();
    expect(grouping.batchAutoGroup).toBeDefined();
  });

  it('should export NameMatch interface through function return types', () => {
    const roster: Student[] = [
      {
        id: '1',
        user_id: 'user-1',
        name: 'Test Student',
        created_at: new Date().toISOString(),
      },
    ];

    const matches = matchNameToRoster('Test Student', roster);

    if (matches.length > 0) {
      expect(matches[0]).toHaveProperty('studentId');
      expect(matches[0]).toHaveProperty('studentName');
      expect(matches[0]).toHaveProperty('confidence');
      expect(matches[0]).toHaveProperty('matchType');
    }
  });
});
