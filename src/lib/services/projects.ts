import { createClient } from '@/lib/supabase/client';
import type { Project, ProjectInsert, ProjectUpdate } from '@/types/database';

export interface ProjectWithStats extends Project {
  submission_count?: number;
  graded_count?: number;
  pending_count?: number;
  needs_review_count?: number;
  processing_count?: number;
}

export interface ProjectFilters {
  search?: string;
  archived?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Get all projects for the current user with detailed stats
 */
export async function getProjects(filters?: ProjectFilters): Promise<ProjectWithStats[]> {
  const supabase = createClient();

  let query = supabase
    .from('projects')
    .select(`
      *,
      submissions:submissions(id, status)
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.archived !== undefined) {
    query = query.eq('is_archived', filters.archived);
  } else {
    // Default to non-archived
    query = query.eq('is_archived', false);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  if (filters?.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching projects:', error);
    throw new Error('Failed to fetch projects');
  }

  // Transform the data to include submission counts by status
  return (data || []).map((project: Record<string, unknown>) => {
    const submissions = (project.submissions || []) as Array<{ id: string; status: string }>;
    return {
      ...project,
      submission_count: submissions.length,
      graded_count: submissions.filter(s => s.status === 'completed').length,
      pending_count: submissions.filter(s => s.status === 'pending').length,
      processing_count: submissions.filter(s => s.status === 'processing').length,
      needs_review_count: submissions.filter(s => s.status === 'needs_review').length,
    };
  }) as ProjectWithStats[];
}

/**
 * Get a single project by ID
 */
export async function getProject(id: string): Promise<ProjectWithStats | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      submissions:submissions(
        id,
        status,
        detected_name,
        created_at
      ),
      answer_keys:project_answer_keys(
        id,
        type,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching project:', error);
    throw new Error('Failed to fetch project');
  }

  // Calculate stats
  const submissions = (data.submissions || []) as Array<{ status: string }>;
  const graded_count = submissions.filter(s => s.status === 'completed').length;
  const pending_count = submissions.filter(s => s.status === 'pending').length;
  const processing_count = submissions.filter(s => s.status === 'processing').length;
  const needs_review_count = submissions.filter(s => s.status === 'needs_review').length;

  return {
    ...data,
    submission_count: submissions.length,
    graded_count,
    pending_count,
    processing_count,
    needs_review_count,
  } as ProjectWithStats;
}

/**
 * Create a new project
 */
export async function createProject(project: Omit<ProjectInsert, 'user_id'>): Promise<Project> {
  const supabase = createClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...project,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw new Error('Failed to create project');
  }

  return data;
}

/**
 * Update a project
 */
export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    throw new Error('Failed to update project');
  }

  return data;
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(id: string): Promise<Project> {
  return updateProject(id, { is_archived: true });
}

/**
 * Restore an archived project
 */
export async function restoreProject(id: string): Promise<Project> {
  return updateProject(id, { is_archived: false });
}

/**
 * Delete a project permanently
 */
export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    throw new Error('Failed to delete project');
  }
}

/**
 * Duplicate a project (without submissions)
 */
export async function duplicateProject(id: string): Promise<Project> {
  const supabase = createClient();

  // Get the original project
  const original = await getProject(id);
  if (!original) {
    throw new Error('Project not found');
  }

  // Create a copy
  return createProject({
    name: `${original.name} (Copy)`,
    description: original.description,
    date: new Date().toISOString().split('T')[0],
  });
}
