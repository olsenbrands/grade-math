'use client';

/**
 * Student Assignment Component
 *
 * Dropdown to assign a student to a submission
 * with support for suggested matches and adding new students
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User,
  UserPlus,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student } from '@/types/database';
import type { NameMatch } from '@/lib/services/student-grouping';

interface StudentAssignmentProps {
  submissionId: string;
  currentStudentId?: string | null;
  currentStudentName?: string | null;
  detectedName?: string | null;
  nameConfidence?: number | null;
  suggestedMatches?: NameMatch[];
  students: Student[];
  onAssign: (studentId: string) => Promise<void>;
  onCreateAndAssign: (name: string) => Promise<{ studentId: string } | null>;
  disabled?: boolean;
}

export function StudentAssignment({
  submissionId,
  currentStudentId,
  currentStudentName,
  detectedName,
  nameConfidence,
  suggestedMatches = [],
  students,
  onAssign,
  onCreateAndAssign,
  disabled = false,
}: StudentAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(currentStudentId || null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showNewStudentDialog, setShowNewStudentDialog] = useState(false);
  const [newStudentName, setNewStudentName] = useState(detectedName || '');

  // Update selected when prop changes
  useEffect(() => {
    setSelectedId(currentStudentId || null);
  }, [currentStudentId]);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchValue) return students;
    const search = searchValue.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(search));
  }, [students, searchValue]);

  // Get current selection display
  const selectedStudent = useMemo(() => {
    if (!selectedId) return null;
    return students.find((s) => s.id === selectedId);
  }, [selectedId, students]);

  // Handle selection
  const handleSelect = async (studentId: string) => {
    if (studentId === selectedId) {
      setOpen(false);
      return;
    }

    setIsAssigning(true);
    try {
      await onAssign(studentId);
      setSelectedId(studentId);
      setOpen(false);
    } catch (error) {
      console.error('Failed to assign student:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle create new student
  const handleCreateNew = async () => {
    if (!newStudentName.trim()) return;

    setIsAssigning(true);
    try {
      const result = await onCreateAndAssign(newStudentName.trim());
      if (result) {
        setSelectedId(result.studentId);
        setShowNewStudentDialog(false);
        setOpen(false);
      }
    } catch (error) {
      console.error('Failed to create student:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isAssigning}
            className={cn(
              'w-full justify-between',
              !selectedStudent && 'text-muted-foreground'
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0" />
              {selectedStudent?.name || currentStudentName || 'Select student...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search students..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">No students found.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setNewStudentName(searchValue || detectedName || '');
                      setShowNewStudentDialog(true);
                    }}
                    className="mt-2"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add new student
                  </Button>
                </div>
              </CommandEmpty>

              {/* Suggested matches from AI detection */}
              {suggestedMatches.length > 0 && (
                <>
                  <CommandGroup heading="Suggested Matches">
                    {suggestedMatches.map((match) => (
                      <CommandItem
                        key={match.studentId}
                        value={match.studentId}
                        onSelect={() => handleSelect(match.studentId)}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          {match.studentName}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={cn('text-xs', getConfidenceBadge(match.confidence))}
                          >
                            {Math.round(match.confidence * 100)}%
                          </Badge>
                          {selectedId === match.studentId && (
                            <Check className="h-4 w-4" />
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* All students */}
              <CommandGroup heading="All Students">
                {filteredStudents.map((student) => {
                  // Skip if already in suggested matches
                  const isSuggested = suggestedMatches.some(
                    (m) => m.studentId === student.id
                  );
                  if (isSuggested && !searchValue) return null;

                  return (
                    <CommandItem
                      key={student.id}
                      value={student.id}
                      onSelect={() => handleSelect(student.id)}
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {student.name}
                      </span>
                      {selectedId === student.id && <Check className="h-4 w-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />

              {/* Add new student option */}
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setNewStudentName(searchValue || detectedName || '');
                    setShowNewStudentDialog(true);
                  }}
                  className="text-primary"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add new student...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Detected name hint */}
      {detectedName && !selectedId && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>
            Detected: &quot;{detectedName}&quot;
            {nameConfidence && (
              <Badge
                variant="outline"
                className={cn('ml-2 text-xs', getConfidenceBadge(nameConfidence))}
              >
                {Math.round(nameConfidence * 100)}%
              </Badge>
            )}
          </span>
        </div>
      )}

      {/* New Student Dialog */}
      <Dialog open={showNewStudentDialog} onOpenChange={setShowNewStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Create a new student and assign them to this submission.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-student-name">Student Name</Label>
            <Input
              id="new-student-name"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Enter student name"
              className="mt-2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewStudentDialog(false)}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNew}
              disabled={!newStudentName.trim() || isAssigning}
            >
              {isAssigning ? 'Adding...' : 'Add & Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Bulk assignment component for project submissions
 */
interface BulkStudentAssignmentProps {
  projectId: string;
  submissions: Array<{
    id: string;
    detectedName: string | null;
    nameConfidence: number | null;
    studentId: string | null;
    studentName: string | null;
  }>;
  students: Student[];
  onAssign: (submissionId: string, studentId: string) => Promise<void>;
  onAutoGroup: () => Promise<{
    assigned: number;
    needsReview: number;
  }>;
}

export function BulkStudentAssignment({
  projectId,
  submissions,
  students,
  onAssign,
  onAutoGroup,
}: BulkStudentAssignmentProps) {
  const [isAutoGrouping, setIsAutoGrouping] = useState(false);
  const [autoGroupResult, setAutoGroupResult] = useState<{
    assigned: number;
    needsReview: number;
  } | null>(null);

  const unassignedCount = submissions.filter((s) => !s.studentId).length;
  const withDetectedName = submissions.filter(
    (s) => !s.studentId && s.detectedName
  ).length;

  const handleAutoGroup = async () => {
    setIsAutoGrouping(true);
    setAutoGroupResult(null);
    try {
      const result = await onAutoGroup();
      setAutoGroupResult(result);
    } catch (error) {
      console.error('Auto-group failed:', error);
    } finally {
      setIsAutoGrouping(false);
    }
  };

  if (unassignedCount === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          <span className="font-medium">All submissions assigned to students</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Student Assignment</h3>
          <p className="text-sm text-muted-foreground">
            {unassignedCount} unassigned submission{unassignedCount !== 1 ? 's' : ''}
            {withDetectedName > 0 && ` (${withDetectedName} with detected names)`}
          </p>
        </div>
        {withDetectedName > 0 && (
          <Button
            onClick={handleAutoGroup}
            disabled={isAutoGrouping}
            variant="outline"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isAutoGrouping ? 'Processing...' : 'Auto-Assign'}
          </Button>
        )}
      </div>

      {autoGroupResult && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>
            <strong>{autoGroupResult.assigned}</strong> submission
            {autoGroupResult.assigned !== 1 ? 's' : ''} auto-assigned
          </p>
          {autoGroupResult.needsReview > 0 && (
            <p className="text-yellow-600">
              <strong>{autoGroupResult.needsReview}</strong> need
              {autoGroupResult.needsReview !== 1 ? '' : 's'} manual review
            </p>
          )}
        </div>
      )}

      {/* List unassigned submissions */}
      <div className="space-y-3">
        {submissions
          .filter((s) => !s.studentId)
          .slice(0, 10)
          .map((submission) => (
            <div
              key={submission.id}
              className="flex items-center gap-4 rounded border p-3"
            >
              <div className="flex-1 min-w-0">
                {submission.detectedName ? (
                  <div className="flex items-center gap-2">
                    <span className="truncate">{submission.detectedName}</span>
                    {submission.nameConfidence && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {Math.round(submission.nameConfidence * 100)}%
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">No name detected</span>
                )}
              </div>
              <div className="w-[200px]">
                <StudentAssignment
                  submissionId={submission.id}
                  currentStudentId={submission.studentId}
                  currentStudentName={submission.studentName}
                  detectedName={submission.detectedName}
                  nameConfidence={submission.nameConfidence}
                  students={students}
                  onAssign={(studentId) => onAssign(submission.id, studentId)}
                  onCreateAndAssign={async (name) => {
                    // This would need implementation
                    return null;
                  }}
                />
              </div>
            </div>
          ))}
        {submissions.filter((s) => !s.studentId).length > 10 && (
          <p className="text-sm text-muted-foreground text-center">
            +{submissions.filter((s) => !s.studentId).length - 10} more...
          </p>
        )}
      </div>
    </div>
  );
}
