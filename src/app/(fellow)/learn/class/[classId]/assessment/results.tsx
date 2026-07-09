import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getSubmissionResult, type SubmissionRow } from "@/lib/assessment-result";

function McRow({ row }: { row: SubmissionRow }) {
  const options = (row.question.options as { id: string; text: string }[] | null) ?? [];
  const selectedOptionId = (row.answer?.response as { optionId: string | null } | undefined)?.optionId ?? null;
  const correctOptionId =
    (row.question.answerKey as { correctOptionId: string | null } | null)?.correctOptionId ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => {
        const isSelected = opt.id === selectedOptionId;
        const isCorrect = opt.id === correctOptionId;
        return (
          <div
            key={opt.id}
            className={cn(
              "flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm",
              isCorrect && "border-success-border bg-success-bg",
              isSelected && !isCorrect && "border-error-border bg-error-bg"
            )}
          >
            {isCorrect ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <Check className="size-3" />
              </span>
            ) : isSelected ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-error text-white">
                <X className="size-3" />
              </span>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span className={cn(isCorrect && "text-success-text", isSelected && !isCorrect && "text-error-text")}>
              {opt.text}
            </span>
            {isSelected && (
              <span className="ml-auto text-xs font-medium tracking-wide text-error-text uppercase">
                Your answer
              </span>
            )}
          </div>
        );
      })}
      <p className="font-heading text-sm font-medium text-muted-foreground">
        {Number(row.grade?.score ?? 0)}/{Number(row.grade?.maxScore ?? row.points)} points
      </p>
    </div>
  );
}

function ShortAnswerRow({ row }: { row: SubmissionRow }) {
  const text = (row.answer?.response as { text: string } | undefined)?.text ?? "";
  const released = row.grade?.status === "released";

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-md bg-background p-3 text-sm whitespace-pre-wrap">{text || "(no answer submitted)"}</p>
      {released ? (
        <div className="text-sm">
          <p className="font-heading font-medium text-muted-foreground">
            {Number(row.grade!.score)}/{Number(row.grade!.maxScore)} points
          </p>
          {row.grade!.feedback && <p className="mt-1 text-muted-foreground">{row.grade!.feedback}</p>}
        </div>
      ) : (
        <Badge variant="warning">Awaiting grading</Badge>
      )}
    </div>
  );
}

export async function AssessmentResults({ submissionId }: { submissionId: string }) {
  const result = await getSubmissionResult(submissionId);
  if (!result) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border border-l-[3px] border-l-orange bg-card p-4">
        <p className="font-heading text-[17px] font-semibold text-navy-900">
          {result.releasedScore}/{result.releasedMax} points so far
          {result.pendingCount > 0 && (
            <span className="font-sans text-sm font-normal text-text-faint">
              {" "}
              · {result.pendingCount} question{result.pendingCount === 1 ? "" : "s"} awaiting grading
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-text-faint">Submitted {result.submission.submittedAt.toLocaleString()}</p>
      </div>

      {result.rows.map((row, i) => (
        <Card key={row.question.id}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-orange">Q{i + 1}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-navy-900">{row.question.body}</p>
            {row.question.type === "mc" ? <McRow row={row} /> : <ShortAnswerRow row={row} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
