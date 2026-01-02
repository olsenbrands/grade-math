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

/** Problem interpretation option for teacher selection */
export interface ProblemInterpretationOption {
  problemText: string;
  source: 'mathpix' | 'gpt4o' | 'teacher';
  confidence: number;
  calculatedAnswer?: string;
  latex?: string;
}

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
  // Multi-AI transparency fields
  problemText?: string;
  mathpixReading?: string;
  gpt4oReading?: string;
  hasReadingConflict?: boolean;
  interpretationOptions?: ProblemInterpretationOption[];
  selectedInterpretation?: number | null;
  ocrConfidence?: number;
  // Verification fields
  verificationMethod?: 'wolfram' | 'chain_of_thought' | 'none';
  wolframVerified?: boolean;
  wolframAnswer?: string;
  verificationConflict?: boolean;
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
  /** Callback when teacher selects a problem interpretation */
  onSelectInterpretation?: (questionNumber: number, interpretationIndex: number) => void;
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
  onSelectInterpretation,
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
              <QuestionResultRow
                key={q.questionNumber}
                question={q}
                onSelectInterpretation={onSelectInterpretation}
              />
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
 * Calculate combined confidence from multiple AI signals
 */
function calculateCombinedConfidence(question: QuestionResultData): {
  score: number;
  dots: number; // 1-3 filled dots
  breakdown: { label: string; value: number }[];
} {
  const breakdown: { label: string; value: number }[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  // OCR confidence (reading the problem)
  const ocrConf = question.ocrConfidence ?? question.confidence;
  breakdown.push({ label: 'Reading', value: ocrConf });
  weightedSum += ocrConf * 0.3;
  totalWeight += 0.3;

  // Solving confidence
  const solveConf = question.confidence;
  breakdown.push({ label: 'Solving', value: solveConf });
  weightedSum += solveConf * 0.4;
  totalWeight += 0.4;

  // Verification confidence
  let verifyConf = 0.7; // default if no verification
  if (question.verificationMethod === 'wolfram') {
    verifyConf = question.wolframVerified ? 0.98 : 0.5;
  } else if (question.verificationMethod === 'chain_of_thought') {
    verifyConf = question.verificationConflict ? 0.6 : 0.85;
  }
  breakdown.push({ label: 'Verified', value: verifyConf });
  weightedSum += verifyConf * 0.3;
  totalWeight += 0.3;

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Calculate dots (1-3) based on agreement/confidence
  let dots = 3;
  if (question.hasReadingConflict) dots = 1;
  else if (question.verificationConflict) dots = 2;
  else if (score < 0.7) dots = 2;
  else if (score < 0.5) dots = 1;

  return { score, dots, breakdown };
}

/**
 * Confidence indicator with dots and hover tooltip
 */
function ConfidenceIndicator({ question }: { question: QuestionResultData }) {
  const { score, dots, breakdown } = calculateCombinedConfidence(question);
  const percentage = Math.round(score * 100);

  // Color based on confidence
  const getColor = (pct: number) => {
    if (pct >= 90) return 'text-green-600';
    if (pct >= 70) return 'text-yellow-600';
    return 'text-orange-500';
  };

  const getDotColor = (filled: boolean, pct: number) => {
    if (!filled) return 'text-gray-300';
    if (pct >= 90) return 'text-green-500';
    if (pct >= 70) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            {/* Three dots */}
            <div className="flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'text-sm',
                    getDotColor(i <= dots, percentage)
                  )}
                >
                  {i <= dots ? '●' : '○'}
                </span>
              ))}
            </div>
            {/* Percentage */}
            <span className={cn('text-xs font-medium', getColor(percentage))}>
              {percentage}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="w-48">
          <div className="space-y-2">
            <p className="font-medium text-xs">Confidence Breakdown</p>
            {breakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        item.value >= 0.9 ? 'bg-green-500' :
                        item.value >= 0.7 ? 'bg-yellow-500' : 'bg-orange-500'
                      )}
                      style={{ width: `${item.value * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right">{Math.round(item.value * 100)}%</span>
                </div>
              </div>
            ))}
            {question.hasReadingConflict && (
              <p className="text-xs text-orange-600 pt-1 border-t">
                ⚠ Multiple interpretations detected
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Individual question result row - clean design with confidence indicator
 */
function QuestionResultRow({
  question,
  onSelectInterpretation,
}: {
  question: QuestionResultData;
  onSelectInterpretation?: (questionNumber: number, interpretationIndex: number) => void;
}) {
  const hasConflict = question.hasReadingConflict;
  const hasOptions = question.interpretationOptions && question.interpretationOptions.length > 1;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        question.isCorrect ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50',
        hasConflict && 'border-orange-200 bg-orange-50/30'
      )}
    >
      {/* Main row - always visible */}
      <div className="flex items-center gap-3">
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

        {/* Problem and answer */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">Q{question.questionNumber}:</span>
            {question.problemText && (
              <span className="text-sm text-muted-foreground truncate">
                {question.problemText}
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5">
            <span className="text-muted-foreground">Answer: </span>
            <span className={cn(
              'font-medium',
              question.isCorrect ? 'text-green-700' : 'text-red-600'
            )}>
              {question.studentAnswer || '(blank)'}
            </span>
            {question.isCorrect && <Check className="inline h-3.5 w-3.5 ml-1 text-green-600" />}
          </p>
        </div>

        {/* Points and confidence */}
        <div className="flex items-center gap-3 shrink-0">
          <ConfidenceIndicator question={question} />
          <div className="text-right">
            <span className={cn(
              'text-lg font-semibold',
              question.isCorrect ? 'text-green-600' : 'text-red-600'
            )}>
              {question.pointsAwarded}/{question.pointsPossible}
            </span>
          </div>
        </div>
      </div>

      {/* Incorrect answer detail */}
      {!question.isCorrect && (
        <div className="mt-2 ml-9 text-sm">
          <span className="text-muted-foreground">Correct answer: </span>
          <span className="text-green-600 font-medium">{question.correctAnswer}</span>
        </div>
      )}

      {/* Conflict resolution - only show when there are multiple interpretations */}
      {hasOptions && (
        <div className="mt-3 ml-9 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <p className="text-xs font-medium text-orange-800 mb-2">
            Multiple readings detected - select the correct one:
          </p>
          <div className="space-y-1.5">
            {question.interpretationOptions!.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onSelectInterpretation?.(question.questionNumber, idx)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                  question.selectedInterpretation === idx
                    ? 'bg-blue-100 border-blue-300 border'
                    : 'bg-white border border-gray-200 hover:border-blue-300'
                )}
              >
                <span className="font-mono">{option.problemText}</span>
                {option.calculatedAnswer && (
                  <span className="text-muted-foreground ml-2">
                    = {option.calculatedAnswer}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      {question.feedback && (
        <p className="mt-2 ml-9 text-sm text-muted-foreground italic">
          {question.feedback}
        </p>
      )}
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
