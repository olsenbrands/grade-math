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
