'use client';

/**
 * Student Result Card Component
 *
 * Displays grading results for a single student submission
 * with score breakdown, confidence indicators, and review flags
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
  Share2,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionResultData {
  questionNumber: number;
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  confidence: number;
  feedback?: string;
  partialCredit?: boolean;
}

export interface StudentResultCardProps {
  id: string;
  studentName?: string;
  detectedName?: string;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  questions: QuestionResultData[];
  needsReview: boolean;
  reviewReason?: string;
  provider: string;
  processingTimeMs: number;
  createdAt: string;
  onEdit?: () => void;
  onViewSubmission?: () => void;
  onShare?: () => void;
  onPrint?: () => void;
  className?: string;
}

export function StudentResultCard({
  id,
  studentName,
  detectedName,
  totalScore,
  totalPossible,
  percentage,
  questions,
  needsReview,
  reviewReason,
  provider,
  processingTimeMs,
  createdAt,
  onEdit,
  onViewSubmission,
  onShare,
  onPrint,
  className,
}: StudentResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Score color based on percentage
  const getScoreColor = (pct: number) => {
    if (pct >= 90) return 'text-green-600';
    if (pct >= 80) return 'text-green-500';
    if (pct >= 70) return 'text-yellow-600';
    if (pct >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (pct: number) => {
    if (pct >= 90) return 'bg-green-50 border-green-200';
    if (pct >= 80) return 'bg-green-50 border-green-100';
    if (pct >= 70) return 'bg-yellow-50 border-yellow-200';
    if (pct >= 60) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  // Confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-green-600 bg-green-100';
    if (conf >= 0.7) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  // Count questions needing review (low confidence)
  const lowConfidenceCount = questions.filter((q) => q.confidence < 0.7).length;
  const incorrectCount = questions.filter((q) => !q.isCorrect).length;

  return (
    <Card className={cn('overflow-hidden', needsReview && 'border-yellow-300', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {studentName || detectedName || 'Unknown Student'}
            </CardTitle>
            {detectedName && studentName !== detectedName && (
              <CardDescription>
                Detected: &quot;{detectedName}&quot;
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {needsReview && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Review
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{reviewReason || 'Manual review recommended'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score display */}
        <div className={cn('rounded-lg border p-4', getScoreBg(percentage))}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Score</p>
              <p className={cn('text-3xl font-bold', getScoreColor(percentage))}>
                {totalScore}/{totalPossible}
              </p>
            </div>
            <div className="text-right">
              <p className={cn('text-4xl font-bold', getScoreColor(percentage))}>
                {percentage}%
              </p>
              <p className="text-sm text-muted-foreground">
                {getGrade(percentage)}
              </p>
            </div>
          </div>
          <Progress
            value={percentage}
            className="mt-3 h-2"
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs text-muted-foreground">Correct</p>
            <p className="text-lg font-semibold text-green-600">
              {questions.length - incorrectCount}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs text-muted-foreground">Incorrect</p>
            <p className="text-lg font-semibold text-red-600">{incorrectCount}</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-xs text-muted-foreground">Low Conf.</p>
            <p className={cn('text-lg font-semibold', lowConfidenceCount > 0 ? 'text-yellow-600' : 'text-muted-foreground')}>
              {lowConfidenceCount}
            </p>
          </div>
        </div>

        {/* Expandable question breakdown */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>Question Breakdown</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {questions.map((q) => (
              <QuestionResultRow key={q.questionNumber} question={q} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t bg-muted/50 px-4 py-3">
        <div className="text-xs text-muted-foreground">
          Graded by {provider} in {(processingTimeMs / 1000).toFixed(1)}s
        </div>
        <div className="flex gap-1">
          {onViewSubmission && (
            <Button variant="ghost" size="icon" onClick={onViewSubmission}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onShare && (
            <Button variant="ghost" size="icon" onClick={onShare}>
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          {onPrint && (
            <Button variant="ghost" size="icon" onClick={onPrint}>
              <Printer className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Individual question result row
 */
function QuestionResultRow({ question }: { question: QuestionResultData }) {
  const isLowConfidence = question.confidence < 0.7;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        question.isCorrect ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50',
        isLowConfidence && 'ring-1 ring-yellow-300'
      )}
    >
      {/* Status icon */}
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          question.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        )}
      >
        {question.isCorrect ? (
          <Check className="h-4 w-4" />
        ) : (
          <X className="h-4 w-4" />
        )}
      </div>

      {/* Question details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">Q{question.questionNumber}</span>
          {question.partialCredit && (
            <Badge variant="outline" className="text-xs">
              Partial
            </Badge>
          )}
          {isLowConfidence && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700 text-xs">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {Math.round(question.confidence * 100)}%
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Low confidence - may need review</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="mt-1 text-sm">
          <p>
            <span className="text-muted-foreground">Student: </span>
            <span className={cn(!question.isCorrect && 'text-red-600')}>
              {question.studentAnswer || '(blank)'}
            </span>
          </p>
          {!question.isCorrect && (
            <p>
              <span className="text-muted-foreground">Correct: </span>
              <span className="text-green-600">{question.correctAnswer}</span>
            </p>
          )}
        </div>
        {question.feedback && (
          <p className="mt-2 text-sm text-muted-foreground italic">
            {question.feedback}
          </p>
        )}
      </div>

      {/* Points */}
      <div className="text-right text-sm">
        <span className={cn('font-medium', question.isCorrect ? 'text-green-600' : 'text-red-600')}>
          {question.pointsAwarded}
        </span>
        <span className="text-muted-foreground">/{question.pointsPossible}</span>
      </div>
    </div>
  );
}

/**
 * Get letter grade from percentage
 */
function getGrade(percentage: number): string {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 63) return 'D';
  if (percentage >= 60) return 'D-';
  return 'F';
}

/**
 * Compact result badge for lists
 */
export function ResultBadge({
  percentage,
  needsReview,
  className,
}: {
  percentage: number;
  needsReview?: boolean;
  className?: string;
}) {
  const getColor = (pct: number) => {
    if (pct >= 90) return 'bg-green-100 text-green-700 border-green-200';
    if (pct >= 80) return 'bg-green-50 text-green-600 border-green-100';
    if (pct >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (pct >= 60) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold',
        getColor(percentage),
        needsReview && 'ring-1 ring-yellow-400',
        className
      )}
    >
      {percentage}%
      {needsReview && <AlertTriangle className="ml-1 h-3 w-3" />}
    </Badge>
  );
}
