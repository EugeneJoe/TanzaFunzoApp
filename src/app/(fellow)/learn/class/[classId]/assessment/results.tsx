import { CheckCircle2, XCircle } from "lucide-react";
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
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              isCorrect && "border-green-600/50 bg-green-50 dark:bg-green-950/30",
              isSelected && !isCorrect && "border-destructive/50 bg-destructive/5"
            )}
          >
            {isCorrect ? (
              <CheckCircle2 className="size-4 shrink-0 text-green-600" />
            ) : isSelected ? (
              <XCircle className="size-4 shrink-0 text-destructive" />
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span>{opt.text}</span>
            {isSelected && <span className="ml-auto text-xs text-muted-foreground">Your answer</span>}
          </div>
        );
      })}
      <p className="text-sm font-medium">
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
      <p className="rounded-md bg-muted p-2 text-sm whitespace-pre-wrap">{text || "(no answer submitted)"}</p>
      {released ? (
        <div className="text-sm">
          <p className="font-medium">
            {Number(row.grade!.score)}/{Number(row.grade!.maxScore)} points
          </p>
          {row.grade!.feedback && <p className="mt-1 text-muted-foreground">{row.grade!.feedback}</p>}
        </div>
      ) : (
        <Badge variant="outline">Awaiting grading</Badge>
      )}
    </div>
  );
}

export async function AssessmentResults({ submissionId }: { submissionId: string }) {
  const result = await getSubmissionResult(submissionId);
  if (!result) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border p-4">
        <p className="font-medium">
          {result.releasedScore}/{result.releasedMax} points so far
          {result.pendingCount > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {result.pendingCount} question{result.pendingCount === 1 ? "" : "s"} awaiting grading
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">Submitted {result.submission.submittedAt.toLocaleString()}</p>
      </div>

      {result.rows.map((row, i) => (
        <Card key={row.question.id}>
          <CardHeader>
            <CardTitle className="text-base">Q{i + 1}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">{row.question.body}</p>
            {row.question.type === "mc" ? <McRow row={row} /> : <ShortAnswerRow row={row} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
