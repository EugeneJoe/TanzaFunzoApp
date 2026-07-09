import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, grades, questions, submissions, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getAssessmentClassMap } from "@/lib/assessment-location";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function GradingQueuePage() {
  await requireRole("admin");

  const pending = await db
    .select({
      gradeId: grades.id,
      maxScore: grades.maxScore,
      submittedAt: submissions.submittedAt,
      fellowId: submissions.userId,
      fellowName: users.fullName,
      questionBody: questions.body,
      subjectType: submissions.subjectType,
      subjectId: submissions.subjectId,
      attemptNo: submissions.attemptNo,
    })
    .from(grades)
    .innerJoin(answers, eq(answers.id, grades.subjectId))
    .innerJoin(submissions, eq(submissions.id, answers.submissionId))
    .innerJoin(users, eq(users.id, submissions.userId))
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(and(eq(grades.subjectType, "answer"), eq(grades.status, "draft")))
    .orderBy(asc(submissions.submittedAt));

  const assessmentMap = pending.length ? await getAssessmentClassMap() : new Map();

  // Attempt number only means "counts toward score" in the context of a
  // fellow's other attempts at the *same* assessment — so pull every
  // submission (graded or not) for the (fellow, assessment) pairs seen here
  // to find each pair's true latest attempt, not just the ones still pending.
  const assessmentFellowIds = [...new Set(pending.filter((p) => p.subjectType === "assessment").map((p) => p.fellowId))];
  const assessmentIds = [...new Set(pending.filter((p) => p.subjectType === "assessment").map((p) => p.subjectId))];
  const relatedSubmissions = assessmentFellowIds.length
    ? await db.query.submissions.findMany({
        where: and(
          eq(submissions.subjectType, "assessment"),
          inArray(submissions.userId, assessmentFellowIds),
          inArray(submissions.subjectId, assessmentIds)
        ),
      })
    : [];
  const attemptInfoByPair = new Map<string, { maxAttempt: number; total: number }>();
  for (const sub of relatedSubmissions) {
    const key = `${sub.userId}:${sub.subjectId}`;
    const existing = attemptInfoByPair.get(key) ?? { maxAttempt: 0, total: 0 };
    existing.maxAttempt = Math.max(existing.maxAttempt, sub.attemptNo);
    existing.total += 1;
    attemptInfoByPair.set(key, existing);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Grading queue</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} response{pending.length === 1 ? "" : "s"} awaiting grading
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing to grade right now.
        </p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[14%]">Fellow</TableHead>
              <TableHead className="w-[14%]">Class</TableHead>
              <TableHead className="w-[38%]">Question</TableHead>
              <TableHead className="w-[13%]">Attempt</TableHead>
              <TableHead className="w-[11%]">Submitted</TableHead>
              <TableHead className="w-[8%] text-right">Points</TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((row) => {
              const location = row.subjectType === "assessment" ? assessmentMap.get(row.subjectId) : undefined;
              const attemptInfo =
                row.subjectType === "assessment" ? attemptInfoByPair.get(`${row.fellowId}:${row.subjectId}`) : undefined;
              const isLatest = attemptInfo ? row.attemptNo === attemptInfo.maxAttempt : true;
              return (
                <TableRow key={row.gradeId}>
                  <TableCell className="whitespace-normal break-words font-medium">{row.fellowName}</TableCell>
                  <TableCell className="whitespace-normal break-words text-muted-foreground">
                    {location?.classTitle ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words">{row.questionBody}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {attemptInfo && (
                        <span className="text-sm text-muted-foreground">
                          Attempt {row.attemptNo} of {attemptInfo.total}
                        </span>
                      )}
                      {isLatest && <Badge variant="secondary">Counts toward score</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatRelativeTime(row.submittedAt)}</TableCell>
                  <TableCell className="text-right">{Number(row.maxScore)} pts</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/grading/${row.gradeId}`}>Grade</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
