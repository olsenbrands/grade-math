/**
 * Student Grouping Service
 *
 * Handles automatic and manual assignment of submissions to students
 * by matching detected names from homework images to the roster.
 */

import { createClient } from '@/lib/supabase/client';
import type { Student, Submission } from '@/types/database';

/**
 * Match result from comparing detected name to roster
 */
export interface NameMatch {
  studentId: string;
  studentName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'first_name' | 'last_name';
}

/**
 * Result of auto-grouping operation
 */
export interface AutoGroupResult {
  submissionId: string;
  detectedName: string | null;
  nameConfidence: number;
  matches: NameMatch[];
  assigned: boolean;
  assignedTo?: {
    studentId: string;
    studentName: string;
  };
  needsReview: boolean;
  reviewReason?: string;
}

/**
 * Thresholds for auto-assignment
 */
const CONFIDENCE_THRESHOLDS = {
  // Minimum confidence in detected name to attempt matching
  MIN_DETECTION_CONFIDENCE: 0.6,
  // Minimum match confidence to auto-assign without review
  HIGH_CONFIDENCE_AUTO_ASSIGN: 0.9,
  // Minimum match confidence to suggest (but flag for review)
  LOW_CONFIDENCE_SUGGEST: 0.5,
  // Exact match bonus
  EXACT_MATCH_BONUS: 0.15,
};

/**
 * Normalize a name for comparison
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes/prefixes
    .replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '')
    // Remove punctuation
    .replace(/[.,\-_'"]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract name parts (first, middle, last)
 */
export function extractNameParts(name: string): {
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullNormalized: string;
} {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ').filter((p) => p.length > 0);

  if (parts.length === 0) {
    return { firstName: '', middleName: null, lastName: '', fullNormalized: normalized };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0] || '',
      middleName: null,
      lastName: '',
      fullNormalized: normalized,
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0] || '',
      middleName: null,
      lastName: parts[1] || '',
      fullNormalized: normalized,
    };
  }

  // 3+ parts: first, middle(s), last
  return {
    firstName: parts[0] || '',
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1] || '',
    fullNormalized: normalized,
  };
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row) row[j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const matrixRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!matrixRow || !prevRow) continue;

      const aChar = a.charAt(j - 1);
      const bChar = b.charAt(i - 1);

      if (bChar === aChar) {
        matrixRow[j] = prevRow[j - 1] ?? 0;
      } else {
        const substitution = prevRow[j - 1] ?? 0;
        const insertion = matrixRow[j - 1] ?? 0;
        const deletion = prevRow[j] ?? 0;
        matrixRow[j] = Math.min(substitution, insertion, deletion) + 1;
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow ? (lastRow[a.length] ?? 0) : 0;
}

/**
 * Calculate similarity between two strings (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return 1 - distance / maxLength;
}

/**
 * Match a detected name against a student roster
 */
export function matchNameToRoster(
  detectedName: string,
  roster: Student[]
): NameMatch[] {
  if (!detectedName || roster.length === 0) return [];

  const detected = extractNameParts(detectedName);
  const matches: NameMatch[] = [];

  for (const student of roster) {
    const studentParts = extractNameParts(student.name);
    let confidence = 0;
    let matchType: NameMatch['matchType'] = 'fuzzy';

    // Check for exact match
    if (detected.fullNormalized === studentParts.fullNormalized) {
      confidence = 1.0;
      matchType = 'exact';
    }
    // Check for fuzzy full name match
    else {
      const fullSimilarity = stringSimilarity(
        detected.fullNormalized,
        studentParts.fullNormalized
      );

      if (fullSimilarity > 0.8) {
        confidence = fullSimilarity;
        matchType = 'fuzzy';
      }
    }

    // Check first name match
    if (confidence < 0.7 && detected.firstName && studentParts.firstName) {
      const firstSimilarity = stringSimilarity(detected.firstName, studentParts.firstName);
      if (firstSimilarity > 0.85) {
        // First name matches well
        if (detected.lastName && studentParts.lastName) {
          const lastSimilarity = stringSimilarity(detected.lastName, studentParts.lastName);
          confidence = Math.max(confidence, (firstSimilarity + lastSimilarity) / 2);
          matchType = 'partial';
        } else {
          // Only first name available
          confidence = Math.max(confidence, firstSimilarity * 0.7);
          matchType = 'first_name';
        }
      }
    }

    // Check last name only match
    if (confidence < 0.6 && detected.lastName && studentParts.lastName) {
      const lastSimilarity = stringSimilarity(detected.lastName, studentParts.lastName);
      if (lastSimilarity > 0.9 && !detected.firstName) {
        confidence = Math.max(confidence, lastSimilarity * 0.75);
        matchType = 'last_name';
      }
    }

    // Check if detected name is a nickname or abbreviated
    if (confidence < 0.6 && detected.firstName && studentParts.firstName) {
      // Check if one is prefix of the other (e.g., "Mike" vs "Michael")
      const shorter =
        detected.firstName.length < studentParts.firstName.length
          ? detected.firstName
          : studentParts.firstName;
      const longer =
        detected.firstName.length >= studentParts.firstName.length
          ? detected.firstName
          : studentParts.firstName;

      if (longer.startsWith(shorter) && shorter.length >= 3) {
        const prefixConfidence = shorter.length / longer.length;
        if (prefixConfidence > 0.5) {
          // Bonus for last name match
          let bonus = 0;
          if (detected.lastName && studentParts.lastName) {
            const lastSim = stringSimilarity(detected.lastName, studentParts.lastName);
            bonus = lastSim * 0.4;
          }
          confidence = Math.max(confidence, prefixConfidence * 0.6 + bonus);
          matchType = 'partial';
        }
      }
    }

    if (confidence >= CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE_SUGGEST) {
      matches.push({
        studentId: student.id,
        studentName: student.name,
        confidence,
        matchType,
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Auto-group a submission based on detected name
 */
export async function autoGroupSubmission(
  submissionId: string,
  detectedName: string | null,
  nameConfidence: number
): Promise<AutoGroupResult> {
  const supabase = createClient();

  // Get current user's roster
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches: [],
      assigned: false,
      needsReview: true,
      reviewReason: 'Not authenticated',
    };
  }

  // If no name detected or low confidence, flag for manual review
  if (!detectedName || nameConfidence < CONFIDENCE_THRESHOLDS.MIN_DETECTION_CONFIDENCE) {
    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches: [],
      assigned: false,
      needsReview: true,
      reviewReason: detectedName
        ? `Low confidence in detected name (${Math.round(nameConfidence * 100)}%)`
        : 'No name detected on submission',
    };
  }

  // Get roster
  const { data: roster, error: rosterError } = await supabase
    .from('student_roster')
    .select('*')
    .eq('user_id', user.id);

  if (rosterError || !roster || roster.length === 0) {
    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches: [],
      assigned: false,
      needsReview: true,
      reviewReason: 'No students in roster',
    };
  }

  // Match name to roster
  const matches = matchNameToRoster(detectedName, roster);

  // No matches found
  if (matches.length === 0) {
    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches: [],
      assigned: false,
      needsReview: true,
      reviewReason: 'No matching students found in roster',
    };
  }

  const bestMatch = matches[0];
  if (!bestMatch) {
    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches: [],
      assigned: false,
      needsReview: true,
      reviewReason: 'No matching students found',
    };
  }

  // Check if we have a high-confidence match
  const effectiveConfidence = bestMatch.confidence * nameConfidence;

  if (
    effectiveConfidence >= CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE_AUTO_ASSIGN ||
    (bestMatch.matchType === 'exact' && nameConfidence >= 0.8)
  ) {
    // Auto-assign with high confidence
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        student_id: bestMatch.studentId,
        detected_name: detectedName,
        name_confidence: nameConfidence,
      })
      .eq('id', submissionId);

    if (updateError) {
      return {
        submissionId,
        detectedName,
        nameConfidence,
        matches,
        assigned: false,
        needsReview: true,
        reviewReason: 'Failed to update submission',
      };
    }

    return {
      submissionId,
      detectedName,
      nameConfidence,
      matches,
      assigned: true,
      assignedTo: {
        studentId: bestMatch.studentId,
        studentName: bestMatch.studentName,
      },
      needsReview: false,
    };
  }

  // Multiple good matches or ambiguous - flag for review
  const secondMatch = matches[1];
  const hasAmbiguousMatches =
    matches.length > 1 &&
    secondMatch &&
    secondMatch.confidence > CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE_SUGGEST &&
    bestMatch.confidence - secondMatch.confidence < 0.2;

  // Update submission with detected name but don't assign
  await supabase
    .from('submissions')
    .update({
      detected_name: detectedName,
      name_confidence: nameConfidence,
    })
    .eq('id', submissionId);

  return {
    submissionId,
    detectedName,
    nameConfidence,
    matches,
    assigned: false,
    needsReview: true,
    reviewReason: hasAmbiguousMatches
      ? `Multiple possible matches: ${matches.slice(0, 3).map((m) => m.studentName).join(', ')}`
      : `Match confidence too low (${Math.round(bestMatch.confidence * 100)}%)`,
  };
}

/**
 * Manually assign a student to a submission
 */
export async function manualAssignStudent(
  submissionId: string,
  studentId: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('submissions')
    .update({ student_id: studentId })
    .eq('id', submissionId);

  return !error;
}

/**
 * Create a new student and assign to submission
 */
export async function createAndAssignStudent(
  submissionId: string,
  studentName: string
): Promise<{ success: boolean; studentId?: string }> {
  const supabase = createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false };
  }

  // Create student
  const { data: student, error: createError } = await supabase
    .from('student_roster')
    .insert({
      user_id: user.id,
      name: studentName,
    })
    .select()
    .single();

  if (createError || !student) {
    return { success: false };
  }

  // Assign to submission
  const { error: assignError } = await supabase
    .from('submissions')
    .update({ student_id: student.id })
    .eq('id', submissionId);

  if (assignError) {
    return { success: false };
  }

  return { success: true, studentId: student.id };
}

/**
 * Save a teacher's correction to improve future matching
 */
export async function saveTeacherCorrection(
  detectedName: string,
  correctStudentId: string
): Promise<void> {
  // Store the correction for future reference
  // This could be used to build a nickname/alias mapping
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get the student to build the mapping
  const { data: student } = await supabase
    .from('student_roster')
    .select('name')
    .eq('id', correctStudentId)
    .single();

  if (!student) return;

  // Update student notes with alias if different
  const normalizedDetected = normalizeName(detectedName);
  const normalizedStudent = normalizeName(student.name);

  if (normalizedDetected !== normalizedStudent) {
    // Add as alias in notes (simple approach)
    const { data: existingStudent } = await supabase
      .from('student_roster')
      .select('notes')
      .eq('id', correctStudentId)
      .single();

    const existingNotes = existingStudent?.notes || '';
    const aliases = existingNotes.match(/Aliases: (.+)/)?.[1]?.split(', ') || [];

    if (!aliases.includes(detectedName)) {
      aliases.push(detectedName);
      const newNotes = existingNotes.replace(/Aliases: .+\n?/, '') +
        `Aliases: ${aliases.join(', ')}`;

      await supabase
        .from('student_roster')
        .update({ notes: newNotes.trim() })
        .eq('id', correctStudentId);
    }
  }
}

/**
 * Get submissions needing student assignment for a project
 */
export async function getUnassignedSubmissions(projectId: string): Promise<
  Array<{
    id: string;
    detectedName: string | null;
    nameConfidence: number | null;
    storagePath: string;
    createdAt: string;
  }>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('submissions')
    .select('id, detected_name, name_confidence, storage_path, created_at')
    .eq('project_id', projectId)
    .is('student_id', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    detectedName: s.detected_name,
    nameConfidence: s.name_confidence,
    storagePath: s.storage_path,
    createdAt: s.created_at,
  }));
}

/**
 * Batch auto-group submissions for a project
 */
export async function batchAutoGroup(projectId: string): Promise<{
  processed: number;
  assigned: number;
  needsReview: number;
  results: AutoGroupResult[];
}> {
  const supabase = createClient();

  // Get submissions with detected names but no student assigned
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, detected_name, name_confidence')
    .eq('project_id', projectId)
    .is('student_id', null)
    .not('detected_name', 'is', null);

  if (error || !submissions) {
    return { processed: 0, assigned: 0, needsReview: 0, results: [] };
  }

  const results: AutoGroupResult[] = [];
  let assigned = 0;
  let needsReview = 0;

  for (const sub of submissions) {
    const result = await autoGroupSubmission(
      sub.id,
      sub.detected_name,
      sub.name_confidence || 0
    );
    results.push(result);

    if (result.assigned) {
      assigned++;
    }
    if (result.needsReview) {
      needsReview++;
    }
  }

  return {
    processed: submissions.length,
    assigned,
    needsReview,
    results,
  };
}
