import { createClient } from '@/lib/supabase/client';
import type { AnswerKey, AnswerKeyInsert, AnswerKeyAnswer } from '@/types/database';

/**
 * Get answer key for a project
 */
export async function getAnswerKey(projectId: string): Promise<AnswerKey | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('project_answer_keys')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching answer key:', error);
    throw new Error('Failed to fetch answer key');
  }

  return data;
}

/**
 * Create or update answer key with manual answers
 */
export async function saveManualAnswerKey(
  projectId: string,
  answers: AnswerKeyAnswer[]
): Promise<AnswerKey> {
  const supabase = createClient();

  // Check if answer key exists
  const existing = await getAnswerKey(projectId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('project_answer_keys')
      .update({
        type: 'manual',
        answers: answers as unknown as Record<string, unknown>[],
        storage_path: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating answer key:', error);
      throw new Error('Failed to update answer key');
    }

    return data;
  }

  // Create new
  const { data, error } = await supabase
    .from('project_answer_keys')
    .insert({
      project_id: projectId,
      type: 'manual',
      answers: answers as unknown as Record<string, unknown>[],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating answer key:', error);
    throw new Error('Failed to create answer key');
  }

  return data;
}

/**
 * Upload an image answer key
 */
export async function uploadImageAnswerKey(
  projectId: string,
  file: File
): Promise<AnswerKey> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Generate storage path
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${projectId}-answer-key.${fileExt}`;
  const storagePath = `${user.id}/${fileName}`;

  // Upload file
  const { error: uploadError } = await supabase.storage
    .from('answer-keys')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Error uploading answer key:', uploadError);
    throw new Error('Failed to upload answer key');
  }

  // Check if answer key exists
  const existing = await getAnswerKey(projectId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('project_answer_keys')
      .update({
        type: 'image',
        storage_path: storagePath,
        answers: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating answer key:', error);
      throw new Error('Failed to update answer key');
    }

    return data;
  }

  // Create new
  const { data, error } = await supabase
    .from('project_answer_keys')
    .insert({
      project_id: projectId,
      type: 'image',
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating answer key:', error);
    throw new Error('Failed to create answer key');
  }

  return data;
}

/**
 * Upload a PDF answer key
 */
export async function uploadPdfAnswerKey(
  projectId: string,
  file: File
): Promise<AnswerKey> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  // Generate storage path
  const fileName = `${projectId}-answer-key.pdf`;
  const storagePath = `${user.id}/${fileName}`;

  // Upload file
  const { error: uploadError } = await supabase.storage
    .from('answer-keys')
    .upload(storagePath, file, {
      upsert: true,
      contentType: 'application/pdf',
    });

  if (uploadError) {
    console.error('Error uploading answer key:', uploadError);
    throw new Error('Failed to upload answer key');
  }

  // Check if answer key exists
  const existing = await getAnswerKey(projectId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('project_answer_keys')
      .update({
        type: 'pdf',
        storage_path: storagePath,
        answers: null,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating answer key:', error);
      throw new Error('Failed to update answer key');
    }

    return data;
  }

  // Create new
  const { data, error } = await supabase
    .from('project_answer_keys')
    .insert({
      project_id: projectId,
      type: 'pdf',
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating answer key:', error);
    throw new Error('Failed to create answer key');
  }

  return data;
}

/**
 * Get signed URL for answer key file
 */
export async function getAnswerKeyUrl(storagePath: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from('answer-keys')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting answer key URL:', error);
    throw new Error('Failed to get answer key URL');
  }

  return data.signedUrl;
}

/**
 * Delete answer key
 */
export async function deleteAnswerKey(projectId: string): Promise<void> {
  const supabase = createClient();

  const existing = await getAnswerKey(projectId);
  if (!existing) {
    return;
  }

  // Delete file from storage if exists
  if (existing.storage_path) {
    await supabase.storage
      .from('answer-keys')
      .remove([existing.storage_path]);
  }

  // Delete record
  const { error } = await supabase
    .from('project_answer_keys')
    .delete()
    .eq('id', existing.id);

  if (error) {
    console.error('Error deleting answer key:', error);
    throw new Error('Failed to delete answer key');
  }
}
