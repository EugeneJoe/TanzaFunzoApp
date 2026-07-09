import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { answers, grades, questions, submissions, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getAssessmentClassMap } from "@/lib/assessment-location";
import { formatRelativeTime } from "@/lib/format";
import { isAiAvailable } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradeForm } from "./grade-form";

export default async function GradeDetailPage({ params }: { params: Promise<{ gradeId: string }> }) {
  const { gradeId } = await params;
  await requireRole("admin");

  const grade = await db.query.grades.findFirst({ where: eq(grades.id, gradeId) });
  if (!grade || grade.subjectType !== "answer") notFound();

  const answer = await db.query.answers.findFirst({ where: eq(answers.id, grade.subjectId) });
  if (!answer) notFound();

  const [question, submission] = await Promise.all([
    db.query.questions.findFirst({ where: eq(questions.id, answer.questionId) }),
    db.query.submissions.findFirst({ where: eq(submissions.id, answer.submissionId) }),
  ]);
  if (!question || !submission) notFound();

  const fellow = await db.query.users.findFirst({ where: eq(users.id, submission.userId) });
  const location =
    submission.subjectType === "assessment" ? (await getAssessmentClassMap()).get(submission.subjectId) : undefined;

  const rubric = (question.rubric as { criteria: string } | null)?.criteria ?? "";
  const answerText = (answer.response as { text: string } | null)?.text ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 p-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-3">
          <Link href="/admin/grading">Back to queue</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          {fellow?.fullName ?? "Unknown fellow"} · {location?.classTitle ?? "Unknown class"} · submitted{" "}
          {formatRelativeTime(submission.submittedAt)}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Grade response</h1>
          {grade.status !== "draft" && <Badge variant="outline">Already released</Badge>}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Question</p>
        <p className="mt-1 text-sm">{question.body}</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Rubric</p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{rubric || "No rubric provided."}</p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Fellow&apos;s answer</p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{answerText || "(no answer submitted)"}</p>
      </div>

      {grade.status === "draft" ? (
        <GradeForm gradeId={gradeId} maxScore={Number(grade.maxScore)} aiAvailable={isAiAvailable()} />
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          This response was already graded: {Number(grade.score)}/{Number(grade.maxScore)} points.
        </div>
      )}
    </div>
  );
}
