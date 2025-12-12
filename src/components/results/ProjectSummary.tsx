'use client';

/**
 * Project Summary Component
 *
 * Displays class-wide statistics, completion progress,
 * and student score list with filtering
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  ArrowUpDown,
  Download,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultBadge } from './StudentResultCard';

export interface StudentScore {
  id: string;
  studentId?: string;
  studentName: string;
  score: number;
  totalPossible: number;
  percentage: number;
  needsReview: boolean;
  status: 'completed' | 'needs_review' | 'pending' | 'failed';
  gradedAt?: string;
}

export interface ProjectStats {
  totalSubmissions: number;
  gradedCount: number;
  pendingCount: number;
  needsReviewCount: number;
  failedCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  scoreDistribution: Record<string, number>;
}

export interface ProjectSummaryProps {
  projectId: string;
  projectName: string;
  projectDate: string;
  stats: ProjectStats;
  studentScores: StudentScore[];
  onExport?: () => void;
  onPrint?: () => void;
  onStudentClick?: (studentId: string) => void;
  className?: string;
}

type SortField = 'name' | 'score' | 'status';
type SortOrder = 'asc' | 'desc';
type FilterStatus = 'all' | 'completed' | 'needs_review' | 'pending' | 'failed';

export function ProjectSummary({
  projectId,
  projectName,
  projectDate,
  stats,
  studentScores,
  onExport,
  onPrint,
  onStudentClick,
  className,
}: ProjectSummaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...studentScores];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.studentName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      result = result.filter((s) => s.status === filterStatus);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case 'score':
          comparison = a.percentage - b.percentage;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [studentScores, searchQuery, filterStatus, sortField, sortOrder]);

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Completion percentage
  const completionPct = stats.totalSubmissions > 0
    ? Math.round((stats.gradedCount / stats.totalSubmissions) * 100)
    : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{projectName}</h2>
          <p className="text-muted-foreground">{projectDate}</p>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {onPrint && (
            <Button variant="outline" onClick={onPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Completion progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion</CardDescription>
            <CardTitle className="text-2xl">{completionPct}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={completionPct} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.gradedCount} of {stats.totalSubmissions} graded
            </p>
          </CardContent>
        </Card>

        {/* Average score */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Class Average</CardDescription>
            <CardTitle className={cn('text-2xl', getScoreColor(stats.averageScore))}>
              {stats.averageScore}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>High: {stats.highestScore}%</span>
              <span>|</span>
              <span>Low: {stats.lowestScore}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Completed
                </span>
                <span>{stats.gradedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Needs Review
                </span>
                <span>{stats.needsReviewCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-500" />
                  Pending
                </span>
                <span>{stats.pendingCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score distribution mini chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Score Distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreDistributionMini distribution={stats.scoreDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Student Results</CardTitle>
              <CardDescription>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as FilterStatus)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('name')}
                    className="-ml-3 h-8"
                  >
                    Student
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('score')}
                    className="-ml-3 h-8"
                  >
                    Score
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort('status')}
                    className="-ml-3 h-8"
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No students match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.studentName}
                    </TableCell>
                    <TableCell>
                      {student.status === 'completed' || student.status === 'needs_review' ? (
                        <ResultBadge
                          percentage={student.percentage}
                          needsReview={student.needsReview}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {onStudentClick && student.studentId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onStudentClick(student.studentId!)}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: StudentScore['status'] }) {
  const config = {
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    needs_review: { label: 'Needs Review', className: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

/**
 * Mini score distribution visualization
 */
function ScoreDistributionMini({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const ranges = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100', '100'];
  const max = Math.max(...Object.values(distribution), 1);

  return (
    <div className="flex items-end gap-0.5 h-12">
      {ranges.map((range) => {
        const count = distribution[range] || 0;
        const height = (count / max) * 100;
        const rangeStart = parseInt(range.split('-')[0] || '0');

        return (
          <div
            key={range}
            className="flex-1 min-w-0"
            title={`${range}: ${count}`}
          >
            <div
              className={cn(
                'w-full rounded-t transition-all',
                rangeStart >= 70 ? 'bg-green-400' :
                rangeStart >= 50 ? 'bg-yellow-400' : 'bg-red-400'
              )}
              style={{ height: `${Math.max(height, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Get score color based on percentage
 */
function getScoreColor(pct: number) {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-green-500';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 60) return 'text-orange-500';
  return 'text-red-500';
}
