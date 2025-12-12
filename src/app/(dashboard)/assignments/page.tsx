'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProjects, type ProjectWithStats, type ProjectFilters } from '@/lib/services/projects';

// Assignment state helpers
function getAssignmentState(project: ProjectWithStats): 'needs_review' | 'grading' | 'complete' | 'ready' | 'empty' {
  const hasSubmissions = (project.submission_count || 0) > 0;
  const hasNeedsReview = (project.needs_review_count || 0) > 0;
  const hasProcessing = (project.processing_count || 0) > 0;
  const hasPending = (project.pending_count || 0) > 0;
  const allGraded = hasSubmissions && !hasNeedsReview && !hasProcessing && !hasPending;

  if (hasNeedsReview) return 'needs_review';
  if (hasProcessing) return 'grading';
  if (allGraded) return 'complete';
  if (hasPending) return 'ready';
  return 'empty';
}

// Assignment Card Component
function AssignmentCard({ project, variant = 'default' }: { project: ProjectWithStats; variant?: 'needs_review' | 'grading' | 'complete' | 'default' }) {
  const state = getAssignmentState(project);

  // Card styling based on state
  const cardClasses = {
    needs_review: 'border-l-4 border-l-yellow-500 hover:border-yellow-500/50',
    grading: 'border-l-4 border-l-blue-500',
    complete: 'border-l-4 border-l-green-500 hover:border-green-500/50',
    default: 'hover:bg-muted/50',
  };

  return (
    <Link href={`/assignments/${project.id}`} className="block h-full">
      <Card className={`cursor-pointer transition-colors h-full flex flex-col ${cardClasses[variant] || cardClasses.default}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="line-clamp-1 text-lg">{project.name}</CardTitle>
            {project.is_archived && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs">
                Archived
              </span>
            )}
          </div>
          <CardDescription className="line-clamp-1 min-h-[1.25rem]">
            {project.description || '\u00A0'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {state === 'empty' ? (
                'No student work yet'
              ) : state === 'complete' ? (
                <span className="text-green-600 font-medium">
                  {project.graded_count} papers graded
                </span>
              ) : state === 'grading' ? (
                <span className="text-blue-600">
                  Grading {project.processing_count} of {project.submission_count}...
                </span>
              ) : state === 'needs_review' ? (
                <span className="text-yellow-600 font-medium">
                  {project.needs_review_count} need{project.needs_review_count === 1 ? 's' : ''} your review
                </span>
              ) : (
                `${project.pending_count} ready to grade`
              )}
            </div>

            {/* Action button based on state */}
            <div>
              {state === 'needs_review' && (
                <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-700 hover:bg-yellow-50">
                  Review Now
                </Button>
              )}
              {state === 'complete' && (
                <Button variant="outline" size="sm" className="border-green-500 text-green-700 hover:bg-green-50">
                  View Results
                </Button>
              )}
              {state === 'ready' && (
                <Button variant="outline" size="sm">
                  Start Grading
                </Button>
              )}
              {state === 'grading' && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Grading
                </div>
              )}
            </div>
          </div>

          {/* Date and count */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{project.submission_count || 0} student submissions</span>
            <span>{new Date(project.date).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AssignmentsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [showArchived]);

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const filters: ProjectFilters = {
        archived: showArchived,
      };
      const data = await getProjects(filters);
      setProjects(data);
    } catch (err) {
      setError('Failed to load assignments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase())
  );

  // Categorize assignments
  const needsAttention = filteredProjects.filter(p => (p.needs_review_count || 0) > 0);
  const gradingInProgress = filteredProjects.filter(p => (p.processing_count || 0) > 0 && (p.needs_review_count || 0) === 0);
  const allOthers = filteredProjects.filter(p =>
    (p.needs_review_count || 0) === 0 && (p.processing_count || 0) === 0
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
            <p className="text-muted-foreground">Loading your grading assignments...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with New Assignment CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            {needsAttention.length > 0
              ? `${needsAttention.reduce((sum, p) => sum + (p.needs_review_count || 0), 0)} papers need your review`
              : 'Manage your grading assignments'}
          </p>
        </div>
        <Link href="/assignments/new">
          <Button size="lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="mr-2 h-5 w-5"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Grade New Assignment
          </Button>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder="Search assignments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          onClick={() => setShowArchived(!showArchived)}
          size="sm"
        >
          {showArchived ? 'Show Active' : 'Show Archived'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load assignments</p>
            <Button variant="outline" onClick={loadProjects} className="mt-2">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!error && filteredProjects.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-6 w-6 text-muted-foreground"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No assignments found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'No assignments match your search'
                : showArchived
                ? 'No archived assignments'
                : 'Create your first assignment to get started'}
            </p>
            {!search && !showArchived && (
              <Link href="/assignments/new">
                <Button className="mt-4">Create Assignment</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 1: Needs Your Attention */}
      {needsAttention.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            <h2 className="text-lg font-semibold">Needs Your Attention</h2>
            <span className="text-sm text-muted-foreground">
              ({needsAttention.reduce((sum, p) => sum + (p.needs_review_count || 0), 0)} papers)
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {needsAttention.map((project) => (
              <AssignmentCard key={project.id} project={project} variant="needs_review" />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Grading in Progress */}
      {gradingInProgress.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <h2 className="text-lg font-semibold">Grading in Progress</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gradingInProgress.map((project) => (
              <AssignmentCard key={project.id} project={project} variant="grading" />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: All Assignments */}
      {allOthers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {needsAttention.length > 0 || gradingInProgress.length > 0 ? 'All Assignments' : ''}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allOthers.map((project) => {
              const state = getAssignmentState(project);
              return (
                <AssignmentCard
                  key={project.id}
                  project={project}
                  variant={state === 'complete' ? 'complete' : 'default'}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
