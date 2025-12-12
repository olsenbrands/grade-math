import { createClient } from '@/lib/supabase/client';
import type { Submission, SubmissionInsert, SubmissionUpdate, SubmissionStatus } from '@/types/database';

export interface SubmissionWithDetails extends Submission {
  student_name?: string;
  has_result?: boolean;
}

export interface SubmissionFilters {
  projectId: string;
  status?: SubmissionStatus;
  studentId?: string;
}

/**
 * Get all submissions for a project
 */
export async function getSubmissions(filters: SubmissionFilters): Promise<SubmissionWithDetails[]> {
  const supabase = createClient();

  let query = supabase
    .from('submissions')
    .select(`
      *,
      student:student_roster(name),
      graded_results(id)
    `)
    .eq('project_id', filters.projectId)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.studentId) {
    query = query.eq('student_id', filters.studentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching submissions:', error);
    throw new Error('Failed to fetch submissions');
  }

  return (data || []).map((sub: Record<string, unknown>) => ({
    ...sub,
    student_name: (sub.student as { name: string } | null)?.name,
    has_result: Array.isArray(sub.graded_results) && sub.graded_results.length > 0,
  })) as SubmissionWithDetails[];
}

/**
 * Get a single submission
 */
export async function getSubmission(id: string): Promise<SubmissionWithDetails | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('submissions')
    .select(`
      *,
      student:student_roster(name),
      graded_results(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching submission:', error);
    throw new Error('Failed to fetch submission');
  }

  return {
    ...data,
    student_name: (data.student as { name: string } | null)?.name,
    has_result: Array.isArray(data.graded_results) && data.graded_results.length > 0,
  } as SubmissionWithDetails;
}

/**
 * Upload a submission file and create record
 */
export async function uploadSubmission(
  projectId: string,
  file: File,
  options?: {
    pageNumber?: number;
    originalFilename?: string;
  }
): Promise<Submission> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${projectId}-${timestamp}.${fileExt}`;
  const storagePath = `${user.id}/${fileName}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('submissions')
    .upload(storagePath, file, {
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw new Error('Failed to upload file');
  }

  // Create submission record
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      project_id: projectId,
      storage_path: storagePath,
      original_filename: options?.originalFilename || file.name,
      page_number: options?.pageNumber || 1,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    // Try to clean up uploaded file
    await supabase.storage.from('submissions').remove([storagePath]);
    console.error('Error creating submission:', error);
    throw new Error('Failed to create submission');
  }

  return data;
}

/**
 * Upload multiple submissions
 */
export async function uploadMultipleSubmissions(
  projectId: string,
  files: File[]
): Promise<{ successful: Submission[]; failed: { file: File; error: string }[] }> {
  const successful: Submission[] = [];
  const failed: { file: File; error: string }[] = [];

  for (const file of files) {
    try {
      const submission = await uploadSubmission(projectId, file);
      successful.push(submission);
    } catch (err) {
      failed.push({
        file,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { successful, failed };
}

/**
 * Update submission
 */
export async function updateSubmission(
  id: string,
  updates: SubmissionUpdate
): Promise<Submission> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating submission:', error);
    throw new Error('Failed to update submission');
  }

  return data;
}

/**
 * Assign a student to a submission
 */
export async function assignStudent(
  submissionId: string,
  studentId: string | null
): Promise<Submission> {
  return updateSubmission(submissionId, { student_id: studentId });
}

/**
 * Delete a submission
 */
export async function deleteSubmission(id: string): Promise<void> {
  const supabase = createClient();

  // Get submission to find storage path
  const submission = await getSubmission(id);
  if (!submission) {
    return;
  }

  // Delete from storage
  if (submission.storage_path) {
    await supabase.storage.from('submissions').remove([submission.storage_path]);
  }

  // Delete record
  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting submission:', error);
    throw new Error('Failed to delete submission');
  }
}

/**
 * Get signed URL for submission image
 */
export async function getSubmissionUrl(storagePath: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from('submissions')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting submission URL:', error);
    throw new Error('Failed to get submission URL');
  }

  return data.signedUrl;
}

/**
 * Get submission counts by status for a project
 */
export async function getSubmissionStats(projectId: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  needs_review: number;
  failed: number;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('submissions')
    .select('status')
    .eq('project_id', projectId);

  if (error) {
    console.error('Error fetching submission stats:', error);
    throw new Error('Failed to fetch submission stats');
  }

  const stats = {
    total: data?.length || 0,
    pending: 0,
    processing: 0,
    completed: 0,
    needs_review: 0,
    failed: 0,
  };

  for (const sub of data || []) {
    const status = sub.status as keyof typeof stats;
    if (status in stats && status !== 'total') {
      stats[status]++;
    }
  }

  return stats;
}
