import { createClient } from '@/lib/supabase/client';
import type { Student, StudentInsert, StudentUpdate } from '@/types/database';

/**
 * Get all students for the current user
 */
export async function getStudents(): Promise<Student[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('student_roster')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching students:', error);
    throw new Error('Failed to fetch students');
  }

  return data || [];
}

/**
 * Get a single student by ID
 */
export async function getStudent(id: string): Promise<Student | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('student_roster')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching student:', error);
    throw new Error('Failed to fetch student');
  }

  return data;
}

/**
 * Search students by name
 */
export async function searchStudents(query: string): Promise<Student[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('student_roster')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Error searching students:', error);
    throw new Error('Failed to search students');
  }

  return data || [];
}

/**
 * Create a new student
 */
export async function createStudent(student: Omit<StudentInsert, 'user_id'>): Promise<Student> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('student_roster')
    .insert({
      ...student,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A student with this name already exists');
    }
    console.error('Error creating student:', error);
    throw new Error('Failed to create student');
  }

  return data;
}

/**
 * Update a student
 */
export async function updateStudent(id: string, updates: StudentUpdate): Promise<Student> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('student_roster')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A student with this name already exists');
    }
    console.error('Error updating student:', error);
    throw new Error('Failed to update student');
  }

  return data;
}

/**
 * Delete a student
 */
export async function deleteStudent(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('student_roster')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting student:', error);
    throw new Error('Failed to delete student');
  }
}

/**
 * Get or create a student by name
 * Useful for auto-assignment when AI detects a name
 */
export async function getOrCreateStudent(name: string): Promise<Student> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Try to find existing student
  const { data: existing } = await supabase
    .from('student_roster')
    .select('*')
    .eq('user_id', user.id)
    .ilike('name', name)
    .single();

  if (existing) {
    return existing;
  }

  // Create new student
  return createStudent({ name });
}

/**
 * Get students with their submissions for a specific project
 */
export async function getStudentsWithSubmissions(projectId: string): Promise<StudentWithSubmissions[]> {
  const supabase = createClient();

  // Get all submissions for the project with student info
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select(`
      id,
      student_id,
      status,
      detected_name,
      name_confidence,
      created_at,
      graded_results(
        id,
        score,
        max_score,
        percentage
      )
    `)
    .eq('project_id', projectId);

  if (subError) {
    console.error('Error fetching submissions:', subError);
    throw new Error('Failed to fetch submissions');
  }

  // Get user's student roster
  const students = await getStudents();

  // Build map of student submissions
  const studentMap = new Map<string, StudentWithSubmissions>();

  // Initialize with all students (even those without submissions)
  for (const student of students) {
    studentMap.set(student.id, {
      ...student,
      submissions: [],
      submissionCount: 0,
      gradedCount: 0,
      averageScore: null,
    });
  }

  // Add unassigned category
  const unassigned: StudentWithSubmissions = {
    id: 'unassigned',
    user_id: '',
    name: 'Unassigned',
    notes: null,
    created_at: '',
    updated_at: '',
    submissions: [],
    submissionCount: 0,
    gradedCount: 0,
    averageScore: null,
  };

  // Process submissions
  for (const sub of submissions || []) {
    const studentData = sub.student_id ? studentMap.get(sub.student_id) : null;
    const target = studentData || unassigned;

    const subEntry: StudentSubmissionEntry = {
      id: sub.id,
      status: sub.status,
      detected_name: sub.detected_name,
      name_confidence: sub.name_confidence,
      created_at: sub.created_at,
      result: Array.isArray(sub.graded_results) && sub.graded_results.length > 0
        ? sub.graded_results[0] as { id: string; score: number; max_score: number; percentage: number }
        : null,
    };

    target.submissions.push(subEntry);
    target.submissionCount++;

    if (subEntry.result) {
      target.gradedCount++;
    }
  }

  // Calculate averages
  for (const student of studentMap.values()) {
    if (student.gradedCount > 0) {
      const totalPercentage = student.submissions
        .filter(s => s.result)
        .reduce((sum, s) => sum + (s.result?.percentage || 0), 0);
      student.averageScore = Math.round(totalPercentage / student.gradedCount);
    }
  }

  // Same for unassigned
  if (unassigned.gradedCount > 0) {
    const totalPercentage = unassigned.submissions
      .filter(s => s.result)
      .reduce((sum, s) => sum + (s.result?.percentage || 0), 0);
    unassigned.averageScore = Math.round(totalPercentage / unassigned.gradedCount);
  }

  // Combine results: students with submissions first, then unassigned
  const result = Array.from(studentMap.values())
    .filter(s => s.submissionCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (unassigned.submissionCount > 0) {
    result.push(unassigned);
  }

  return result;
}

export interface StudentSubmissionEntry {
  id: string;
  status: string;
  detected_name: string | null;
  name_confidence: number | null;
  created_at: string;
  result: {
    id: string;
    score: number;
    max_score: number;
    percentage: number;
  } | null;
}

export interface StudentWithSubmissions extends Student {
  submissions: StudentSubmissionEntry[];
  submissionCount: number;
  gradedCount: number;
  averageScore: number | null;
}

/**
 * Get all submissions for a specific student across all projects
 */
export async function getStudentSubmissions(studentId: string): Promise<{
  student: Student;
  submissions: Array<{
    id: string;
    projectId: string;
    projectName: string;
    status: string;
    createdAt: string;
    result: {
      score: number;
      maxScore: number;
      percentage: number;
    } | null;
  }>;
}> {
  const supabase = createClient();

  // Get student
  const student = await getStudent(studentId);
  if (!student) {
    throw new Error('Student not found');
  }

  // Get all submissions for this student
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select(`
      id,
      project_id,
      status,
      created_at,
      project:projects(name),
      graded_results(score, max_score, percentage)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching student submissions:', error);
    throw new Error('Failed to fetch student submissions');
  }

  return {
    student,
    submissions: (submissions || []).map((sub: Record<string, unknown>) => ({
      id: sub.id as string,
      projectId: sub.project_id as string,
      projectName: (sub.project as { name: string } | null)?.name || 'Unknown',
      status: sub.status as string,
      createdAt: sub.created_at as string,
      result: Array.isArray(sub.graded_results) && sub.graded_results.length > 0
        ? {
            score: (sub.graded_results[0] as { score: number }).score,
            maxScore: (sub.graded_results[0] as { max_score: number }).max_score,
            percentage: (sub.graded_results[0] as { percentage: number }).percentage,
          }
        : null,
    })),
  };
}

/**
 * Merge two students - moves all submissions from source to target, then deletes source
 */
export async function mergeStudents(
  targetId: string,
  sourceId: string
): Promise<{ submissionsMoved: number }> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Verify both students exist and belong to user
  const { data: target, error: targetError } = await supabase
    .from('student_roster')
    .select('*')
    .eq('id', targetId)
    .eq('user_id', user.id)
    .single();

  if (targetError || !target) {
    throw new Error('Target student not found');
  }

  const { data: source, error: sourceError } = await supabase
    .from('student_roster')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', user.id)
    .single();

  if (sourceError || !source) {
    throw new Error('Source student not found');
  }

  // Move all submissions from source to target
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .update({ student_id: targetId })
    .eq('student_id', sourceId)
    .select('id');

  if (subError) {
    console.error('Error moving submissions:', subError);
    throw new Error('Failed to move submissions');
  }

  const submissionsMoved = submissions?.length || 0;

  // Also update graded_results
  await supabase
    .from('graded_results')
    .update({ student_id: targetId })
    .eq('student_id', sourceId);

  // Delete source student
  const { error: deleteError } = await supabase
    .from('student_roster')
    .delete()
    .eq('id', sourceId);

  if (deleteError) {
    console.error('Error deleting source student:', deleteError);
    throw new Error('Failed to delete source student after merge');
  }

  return { submissionsMoved };
}

/**
 * Get all students with their submission counts (for the roster overview)
 */
export async function getStudentsWithStats(): Promise<Array<Student & {
  submissionCount: number;
  gradedCount: number;
  averageScore: number | null;
  lastSubmission: string | null;
}>> {
  const supabase = createClient();

  // Get all students
  const students = await getStudents();

  // Get submission stats for each student
  const result = await Promise.all(
    students.map(async (student) => {
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          created_at,
          graded_results(percentage)
        `)
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      const submissionCount = submissions?.length || 0;
      const gradedSubmissions = submissions?.filter(s =>
        Array.isArray(s.graded_results) && s.graded_results.length > 0
      ) || [];
      const gradedCount = gradedSubmissions.length;

      let averageScore: number | null = null;
      if (gradedCount > 0) {
        const totalPercentage = gradedSubmissions.reduce((sum, s) => {
          const results = s.graded_results as Array<{ percentage: number }> | null;
          const result = results && results.length > 0 ? results[0] : null;
          return sum + (result?.percentage || 0);
        }, 0);
        averageScore = Math.round(totalPercentage / gradedCount);
      }

      const lastSubmission = submissions?.[0]?.created_at || null;

      return {
        ...student,
        submissionCount,
        gradedCount,
        averageScore,
        lastSubmission,
      };
    })
  );

  return result;
}

/**
 * Import students from a list of names
 */
export async function importStudents(names: string[]): Promise<{ created: number; skipped: number }> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Get existing students
  const { data: existing } = await supabase
    .from('student_roster')
    .select('name')
    .eq('user_id', user.id);

  const existingNames = new Set((existing || []).map(s => s.name.toLowerCase()));

  // Filter out duplicates
  const uniqueNames = names
    .map(n => n.trim())
    .filter(n => n.length > 0)
    .filter(n => !existingNames.has(n.toLowerCase()));

  if (uniqueNames.length === 0) {
    return { created: 0, skipped: names.length };
  }

  // Insert new students
  const { error } = await supabase
    .from('student_roster')
    .insert(uniqueNames.map(name => ({ name, user_id: user.id })));

  if (error) {
    console.error('Error importing students:', error);
    throw new Error('Failed to import students');
  }

  return {
    created: uniqueNames.length,
    skipped: names.length - uniqueNames.length,
  };
}
