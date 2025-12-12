'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents,
} from '@/lib/services/students';
import type { Student } from '@/types/database';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setError('Failed to load students');
      console.error(err);
    } finally {
      setLoading(false);
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

  function handleEdit(student: Student) {
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

  function cancelForm() {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ name: '', notes: '' });
    setFormError(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Roster</h1>
          <p className="text-muted-foreground">Manage your class roster</p>
        </div>
        <Card className="animate-pulse">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted rounded" />
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
          <h1 className="text-3xl font-bold tracking-tight">Student Roster</h1>
          <p className="text-muted-foreground">
            {students.length} student{students.length !== 1 ? 's' : ''} in your roster
          </p>
        </div>
        <div className="flex gap-2">
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
                  placeholder="Student name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={saving}
                />
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
              placeholder="John Smith
Jane Doe
Bob Johnson"
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

      {/* Search */}
      <div className="relative max-w-sm">
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

      {/* Student List */}
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
                  : 'Add students to your roster to track their assignments'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{student.name}</p>
                    {student.notes && (
                      <p className="text-sm text-muted-foreground">{student.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(student)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(student.id)}
                      disabled={deletingId === student.id}
                    >
                      {deletingId === student.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
