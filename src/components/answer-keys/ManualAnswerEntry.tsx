'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { saveManualAnswerKey } from '@/lib/services/answer-keys';
import type { AnswerKeyAnswer } from '@/types/database';

interface ManualAnswerEntryProps {
  projectId: string;
  existingAnswers?: AnswerKeyAnswer[];
  onSave?: () => void;
  onCancel?: () => void;
}

export function ManualAnswerEntry({
  projectId,
  existingAnswers = [],
  onSave,
  onCancel,
}: ManualAnswerEntryProps) {
  const [answers, setAnswers] = useState<AnswerKeyAnswer[]>(
    existingAnswers.length > 0
      ? existingAnswers
      : [{ question: 1, answer: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addQuestion() {
    const nextQuestion = Math.max(...answers.map(a => a.question), 0) + 1;
    setAnswers([...answers, { question: nextQuestion, answer: '' }]);
  }

  function removeQuestion(index: number) {
    if (answers.length <= 1) return;
    setAnswers(answers.filter((_, i) => i !== index));
  }

  function updateAnswer(index: number, field: 'question' | 'answer', value: string | number) {
    const updated = [...answers];
    const current = updated[index];
    if (current) {
      if (field === 'question') {
        updated[index] = { ...current, question: value as number };
      } else {
        updated[index] = { ...current, answer: value as string };
      }
      setAnswers(updated);
    }
  }

  async function handleSave() {
    // Validate
    const validAnswers = answers.filter(a => a.answer.trim() !== '');
    if (validAnswers.length === 0) {
      setError('Please enter at least one answer');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await saveManualAnswerKey(projectId, validAnswers);
      onSave?.();
    } catch (err) {
      setError('Failed to save answer key');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Answer Entry</CardTitle>
        <CardDescription>
          Enter the correct answer for each question
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {answers.map((answer, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-20">
                <Label htmlFor={`q-${index}`} className="sr-only">
                  Question Number
                </Label>
                <Input
                  id={`q-${index}`}
                  type="number"
                  min="1"
                  value={answer.question}
                  onChange={(e) =>
                    updateAnswer(index, 'question', parseInt(e.target.value) || 1)
                  }
                  placeholder="#"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`a-${index}`} className="sr-only">
                  Answer
                </Label>
                <Input
                  id={`a-${index}`}
                  value={answer.answer}
                  onChange={(e) => updateAnswer(index, 'answer', e.target.value)}
                  placeholder="Enter correct answer"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(index)}
                disabled={answers.length <= 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
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
          Add Question
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Answer Key'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
