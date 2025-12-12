'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getStudentsWithStats,
  getStudentSubmissions,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents,
  mergeStudents,
} from '@/lib/services/students';
import type { Student } from '@/types/database';

interface StudentWithStats extends Student {
  submissionCount: number;
  gradedCount: number;
  averageScore: number | null;
  lastSubmission: string | null;
}

interface StudentSubmission {
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
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected student for profile view
  const [selectedStudent, setSelectedStudent] = useState<StudentWithStats | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Add/Edit state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [mergeSource, setMergeSource] = useState<string>('');
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudentsWithStats();
      setStudents(data);
    } catch (err) {
      setError('Failed to load students');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentSubmissions(student: StudentWithStats) {
    try {
      setLoadingSubmissions(true);
      setSelectedStudent(student);
      const data = await getStudentSubmissions(student.id);
      setStudentSubmissions(data.submissions);
    } catch (err) {
      console.error(err);
      setStudentSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  }

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError('Student name is required');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      if (editingId) {
        await updateStudent(editingId, {
          name: formData.name.trim(),
          notes: formData.notes.trim() || null,
        });
      } else {
        await createStudent({
          name: formData.name.trim(),
          notes: formData.notes.trim() || null,
        });
      }

      await loadStudents();
      setShowAddForm(false);
      setEditingId(null);
      setFormData({ name: '', notes: '' });

      // If we were editing the selected student, refresh the profile
      if (editingId && selectedStudent?.id === editingId) {
        const updatedStudent = students.find(s => s.id === editingId);
        if (updatedStudent) {
          setSelectedStudent({ ...updatedStudent, name: formData.name.trim() });
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save student');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(student: StudentWithStats) {
    setEditingId(student.id);
    setFormData({ name: student.name, notes: student.notes || '' });
    setShowAddForm(true);
    setFormError(null);
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      await deleteStudent(id);
      await loadStudents();
      setShowDeleteConfirm(null);

      // If we deleted the selected student, close the profile
      if (selectedStudent?.id === id) {
        setSelectedStudent(null);
        setStudentSubmissions([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleImport() {
    const names = importText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) {
      return;
    }

    try {
      setImporting(true);
      const result = await importStudents(names);
      await loadStudents();
      setShowImport(false);
      setImportText('');
      alert(`Imported ${result.created} students (${result.skipped} skipped)`);
    } catch (err) {
      console.error(err);
      alert('Failed to import students');
    } finally {
      setImporting(false);
    }
  }

  async function handleMerge() {
    if (!mergeTarget || !mergeSource || mergeTarget === mergeSource) {
      return;
    }

    try {
      setMerging(true);
      const result = await mergeStudents(mergeTarget, mergeSource);
      await loadStudents();
      setShowMerge(false);
      setMergeTarget('');
      setMergeSource('');

      // If we merged the selected student, close the profile
      if (selectedStudent?.id === mergeSource) {
        setSelectedStudent(null);
        setStudentSubmissions([]);
      }

      alert(`Merged successfully! ${result.submissionsMoved} submissions moved.`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to merge students');
    } finally {
      setMerging(false);
    }
  }

  function cancelForm() {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ name: '', notes: '' });
    setFormError(null);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage your student roster</p>
        </div>
        <Card className="animate-pulse">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">
            {students.length} student{students.length !== 1 ? 's' : ''} in your roster
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowMerge(true)}>
            Merge Duplicates
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            Import List
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="mr-2 h-4 w-4"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add Student
          </Button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Student' : 'Add Student'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Student name (e.g., Tyler O, Jessica T)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Supports first name + last initial format common in elementary schools
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={saving}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Import Modal */}
      {showImport && (
        <Card>
          <CardHeader>
            <CardTitle>Import Students</CardTitle>
            <CardDescription>
              Paste a list of student names, one per line
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full min-h-[200px] p-3 border rounded-md resize-y"
              placeholder="Tyler O
Jessica T
Mike S
Sarah J"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              disabled={importing}
            />
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowImport(false);
                  setImportText('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Merge Dialog */}
      <Dialog open={showMerge} onOpenChange={setShowMerge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Duplicate Students</DialogTitle>
            <DialogDescription>
              Select two student profiles to merge. All assignments from the second student
              will be moved to the first, then the second profile will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Keep this student (target)</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">-- Select student to keep --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === mergeSource}>
                    {s.name} ({s.submissionCount} assignments)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Merge from this student (will be deleted)</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
              >
                <option value="">-- Select student to merge --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === mergeTarget}>
                    {s.name} ({s.submissionCount} assignments)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMerge(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeTarget || !mergeSource || mergeTarget === mergeSource}
            >
              {merging ? 'Merging...' : 'Merge Students'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this student? Their assignments will become unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              disabled={deletingId !== null}
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Student List */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
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
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={loadStudents} className="mt-2">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-6">
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
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">
                    {search ? 'No students found' : 'No students yet'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search
                      ? 'Try a different search term'
                      : 'Students are automatically added when their work is graded'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-6 px-6 transition-colors ${
                        selectedStudent?.id === student.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => loadStudentSubmissions(student)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.name}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{student.submissionCount} assignments</span>
                          {student.averageScore !== null && (
                            <span className={`font-medium ${
                              student.averageScore >= 90 ? 'text-green-600' :
                              student.averageScore >= 70 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {student.averageScore}% avg
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(student);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(student.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Student Profile Panel */}
        <div>
          {selectedStudent ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedStudent.name}</CardTitle>
                    <CardDescription>
                      {selectedStudent.notes || 'No notes'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentSubmissions([]);
                    }}
                  >
                    Close
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{selectedStudent.submissionCount}</p>
                    <p className="text-xs text-muted-foreground">Assignments</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{selectedStudent.gradedCount}</p>
                    <p className="text-xs text-muted-foreground">Graded</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className={`text-2xl font-bold ${
                      selectedStudent.averageScore !== null
                        ? selectedStudent.averageScore >= 90 ? 'text-green-600' :
                          selectedStudent.averageScore >= 70 ? 'text-yellow-600' :
                          'text-red-600'
                        : ''
                    }`}>
                      {selectedStudent.averageScore !== null ? `${selectedStudent.averageScore}%` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Average</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <h4 className="font-semibold mb-3">Assignment History</h4>

                {loadingSubmissions ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : studentSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No assignments yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {studentSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{sub.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sub.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          {sub.result ? (
                            <>
                              <p className={`font-bold ${
                                sub.result.percentage >= 90 ? 'text-green-600' :
                                sub.result.percentage >= 70 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {sub.result.percentage}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sub.result.score}/{sub.result.maxScore}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {sub.status === 'pending' ? 'Not graded' : sub.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[300px] flex items-center justify-center">
              <CardContent className="text-center">
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Select a Student</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on a student to view their profile and assignment history
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
