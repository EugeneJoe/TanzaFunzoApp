"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { submitAssessmentAction } from "./actions";

export type FormQuestion = {
  questionId: string;
  points: string;
  type: "mc" | "short_answer";
  body: string;
  options: { id: string; text: string }[] | null;
};

export function AssessmentForm({
  classId,
  assessmentId,
  questions,
}: {
  classId: string;
  assessmentId: string;
  questions: FormQuestion[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitAssessmentAction(classId, assessmentId, idempotencyKey, answers);
        // Drop ?retake=1 (if present) so the post-submit render re-evaluates
        // showForm from fresh data instead of forcing the form again.
        router.replace(pathname);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <Card key={q.questionId}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-orange">
              Q{i + 1} <span className="font-sans font-normal text-muted-foreground">· {Number(q.points)} pts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-navy-900">{q.body}</p>
            {q.type === "mc" ? (
              <RadioGroup value={answers[q.questionId] ?? ""} onValueChange={(v) => setAnswer(q.questionId, v)}>
                <div className="flex flex-col gap-2">
                  {q.options?.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.id} id={`${q.questionId}-${opt.id}`} />
                      <Label htmlFor={`${q.questionId}-${opt.id}`}>{opt.text}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <Textarea
                value={answers[q.questionId] ?? ""}
                onChange={(e) => setAnswer(q.questionId, e.target.value)}
                placeholder="Your answer"
                rows={4}
              />
            )}
          </CardContent>
        </Card>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleSubmit} disabled={isPending} className="self-start">
        {isPending ? "Submitting…" : "Submit assessment"}
      </Button>
    </div>
  );
}
