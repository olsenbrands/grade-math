'use client';

/**
 * Feedback View Component
 *
 * Generates shareable, printable feedback for students
 * Optimized for both screen and print media
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, X, Printer, Share2, Download, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestionResultData } from './StudentResultCard';

export interface FeedbackViewProps {
  studentName: string;
  projectName: string;
  date: string;
  totalScore: number;
  totalPossible: number;
  percentage: number;
  questions: QuestionResultData[];
  overallFeedback?: string;
  teacherName?: string;
  schoolName?: string;
  className?: string;
}

export function FeedbackView({
  studentName,
  projectName,
  date,
  totalScore,
  totalPossible,
  percentage,
  questions,
  overallFeedback,
  teacherName,
  schoolName,
  className,
}: FeedbackViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const incorrectQuestions = questions.filter((q) => !q.isCorrect);
  const correctQuestions = questions.filter((q) => q.isCorrect);

  return (
    <div className={cn('max-w-2xl mx-auto', className)}>
      {/* Print/Share controls - hidden on print */}
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="print:p-0">
        <Card className="print:shadow-none print:border-0">
          {/* Header */}
          <CardHeader className="text-center border-b pb-6">
            {schoolName && (
              <p className="text-sm text-muted-foreground">{schoolName}</p>
            )}
            <h1 className="text-2xl font-bold mt-2">{projectName}</h1>
            <p className="text-lg text-muted-foreground">{date}</p>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Student info and score */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="text-xl font-semibold">{studentName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className={cn('text-3xl font-bold', getScoreColor(percentage))}>
                  {totalScore}/{totalPossible}
                </p>
                <p className={cn('text-xl font-semibold', getScoreColor(percentage))}>
                  {percentage}% ({getGrade(percentage)})
                </p>
              </div>
            </div>

            <Separator />

            {/* Overall feedback */}
            {overallFeedback && (
              <>
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-medium mb-2">Teacher&apos;s Comments</h3>
                  <p className="text-muted-foreground">{overallFeedback}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Questions breakdown */}
            <div className="space-y-4">
              <h3 className="font-medium">Question Breakdown</h3>

              {/* Correct answers summary */}
              {correctQuestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Correct ({correctQuestions.length})
                  </p>
                  <div className="pl-6 space-y-2">
                    {correctQuestions.map((q) => (
                      <FeedbackQuestionRow key={q.questionNumber} question={q} />
                    ))}
                  </div>
                </div>
              )}

              {/* Incorrect answers with feedback */}
              {incorrectQuestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Needs Practice ({incorrectQuestions.length})
                  </p>
                  <div className="pl-6 space-y-3">
                    {incorrectQuestions.map((q) => (
                      <FeedbackQuestionRow
                        key={q.questionNumber}
                        question={q}
                        showFeedback
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Encouragement message */}
            <div className="text-center py-4 bg-muted/50 rounded-lg mt-6">
              {percentage >= 90 ? (
                <p className="text-green-600 font-medium">
                  Excellent work! Keep it up!
                </p>
              ) : percentage >= 70 ? (
                <p className="text-blue-600 font-medium">
                  Good job! Keep practicing to improve even more!
                </p>
              ) : (
                <p className="text-orange-600 font-medium">
                  Don&apos;t give up! Practice makes perfect!
                </p>
              )}
            </div>

            {/* Footer */}
            {teacherName && (
              <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                <p>{teacherName}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #feedback-print-area,
          #feedback-print-area * {
            visibility: visible;
          }
          #feedback-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Individual question row for feedback
 */
function FeedbackQuestionRow({
  question,
  showFeedback = false,
}: {
  question: QuestionResultData;
  showFeedback?: boolean;
}) {
  return (
    <div className={cn(
      'rounded border p-3',
      question.isCorrect ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">Question {question.questionNumber}</p>
          <p className="text-sm mt-1">
            <span className="text-muted-foreground">Your answer: </span>
            <span className={cn(question.isCorrect ? 'text-green-600' : 'text-red-600')}>
              {question.studentAnswer || '(no answer)'}
            </span>
          </p>
          {!question.isCorrect && (
            <p className="text-sm">
              <span className="text-muted-foreground">Correct answer: </span>
              <span className="text-green-600 font-medium">{question.correctAnswer}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <span className={cn(
            'text-lg font-semibold',
            question.isCorrect ? 'text-green-600' : 'text-red-600'
          )}>
            {question.pointsAwarded}/{question.pointsPossible}
          </span>
        </div>
      </div>
      {showFeedback && question.feedback && (
        <div className="mt-2 pt-2 border-t border-dashed">
          <p className="text-sm text-muted-foreground italic">
            {question.feedback}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Shareable feedback link generator
 */
export function ShareableFeedbackLink({
  resultId,
  className,
}: {
  resultId: string;
  className?: string;
}) {
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/feedback/${resultId}`
    : '';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Homework Feedback',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback to copy
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size="sm" onClick={handleShare}>
        <Share2 className="mr-2 h-4 w-4" />
        Share Feedback
      </Button>
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
 * Get score color based on percentage
 */
function getScoreColor(pct: number) {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-green-500';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 60) return 'text-orange-500';
  return 'text-red-500';
}
