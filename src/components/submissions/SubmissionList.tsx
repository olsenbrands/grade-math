'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getSubmissions,
  getSubmissionUrl,
  deleteSubmission,
  assignStudent,
  type SubmissionWithDetails,
  type SubmissionFilters,
} from '@/lib/services/submissions';
import { getStudents } from '@/lib/services/students';
import type { Student, SubmissionStatus } from '@/types/database';

interface SubmissionListProps {
  projectId: string;
  onRefresh?: () => void;
}

const STATUS_LABELS: Record<SubmissionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
};

export function SubmissionList({ projectId, onRefresh }: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: SubmissionFilters = { projectId };
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const [subs, studentList] = await Promise.all([
        getSubmissions(filters),
        getStudents(),
      ]);

      setSubmissions(subs);
      setStudents(studentList);

      // Load image URLs for thumbnails
      const urls: Record<string, string> = {};
      for (const sub of subs.slice(0, 20)) {
        try {
          urls[sub.id] = await getSubmissionUrl(sub.storage_path);
        } catch {
          // Ignore errors for individual URLs
        }
      }
      setImageUrls(urls);
    } catch (err) {
      setError('Failed to load submissions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) {
      return;
    }

    try {
      setDeleting(id);
      await deleteSubmission(id);
      await loadData();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      alert('Failed to delete submission');
    } finally {
      setDeleting(null);
    }
  };

  const handleAssign = async (submissionId: string, studentId: string | null) => {
    try {
      setAssigning(submissionId);
      await assignStudent(submissionId, studentId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to assign student');
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={loadData} className="mt-2">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'processing', 'completed', 'needs_review', 'failed'] as const).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status].label}
            </Button>
          )
        )}
      </div>

      {/* List */}
      {submissions.length === 0 ? (
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
            <h3 className="text-lg font-semibold">No submissions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'all'
                ? 'Upload student homework to get started'
                : `No submissions with status "${STATUS_LABELS[statusFilter].label}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedId === submission.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedId(selectedId === submission.id ? null : submission.id)}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                {imageUrls[submission.id] ? (
                  <img
                    src={imageUrls[submission.id]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
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
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {submission.student_name ||
                      submission.detected_name ||
                      submission.original_filename ||
                      'Unknown'}
                  </p>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      STATUS_LABELS[submission.status].color
                    }`}
                  >
                    {STATUS_LABELS[submission.status].label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {submission.original_filename}
                  {submission.page_number > 1 && ` (Page ${submission.page_number})`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(submission.created_at).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {submission.has_result && (
                  <span className="text-xs text-green-600 font-medium">Graded</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedId && (
        <Card>
          <CardContent className="pt-6">
            {(() => {
              const selected = submissions.find((s) => s.id === selectedId);
              if (!selected) return null;

              return (
                <div className="space-y-4">
                  {/* Image preview */}
                  {imageUrls[selectedId] && (
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <img
                        src={imageUrls[selectedId]}
                        alt="Submission"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Student assignment */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign to Student</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selected.student_id || ''}
                      onChange={(e) =>
                        handleAssign(selectedId, e.target.value || null)
                      }
                      disabled={assigning === selectedId}
                    >
                      <option value="">-- Select Student --</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </select>
                    {selected.detected_name && (
                      <p className="text-xs text-muted-foreground">
                        Detected name: {selected.detected_name}
                        {selected.name_confidence && (
                          <> ({Math.round(selected.name_confidence * 100)}% confident)</>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(selectedId)}
                      disabled={deleting === selectedId}
                    >
                      {deleting === selectedId ? 'Deleting...' : 'Delete'}
                    </Button>
                    {imageUrls[selectedId] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(imageUrls[selectedId], '_blank')}
                      >
                        View Full Size
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
