import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, assessmentQuestions, assessments, grades, questions, submissions } from "@/db/schema";

export type SubmissionRow = {
  question: typeof questions.$inferSelect;
  points: number;
  answer: typeof answers.$inferSelect | undefined;
  grade: typeof grades.$inferSelect | undefined;
};

export type SubmissionResult = {
  submission: typeof submissions.$inferSelect;
  assessmentTitle: string;
  rows: SubmissionRow[];
  releasedScore: number;
  releasedMax: number;
  pendingCount: number;
  allReleased: boolean;
};

export async function countSubmissions(userId: string, assessmentId: string): Promise<number> {
  const rows = await db.query.submissions.findMany({
    where: and(
      eq(submissions.userId, userId),
      eq(submissions.subjectType, "assessment"),
      eq(submissions.subjectId, assessmentId)
    ),
  });
  return rows.length;
}

export async function getLatestSubmission(userId: string, assessmentId: string) {
  const rows = await db.query.submissions.findMany({
    where: and(
      eq(submissions.userId, userId),
      eq(submissions.subjectType, "assessment"),
      eq(submissions.subjectId, assessmentId)
    ),
    orderBy: desc(submissions.attemptNo),
  });
  return rows[0];
}

/**
 * Resolves one submission into per-question rows plus released-so-far
 * totals — shared by the assessment results view, the launcher's status
 * chip, and /me's coursework list, so "what counts as graded" is defined
 * exactly once (grades.status === 'released'; MC is released at submit
 * time, short answer stays 'draft' until Stage 4 approval).
 */
export async function getSubmissionResult(submissionId: string): Promise<SubmissionResult | null> {
  const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (!submission || submission.subjectType !== "assessment") return null;

  const assessment = await db.query.assessments.findFirst({ where: eq(assessments.id, submission.subjectId) });
  if (!assessment) return null;

  const links = await db.query.assessmentQuestions.findMany({
    where: eq(assessmentQuestions.assessmentId, assessment.id),
    orderBy: asc(assessmentQuestions.position),
    with: { question: true },
  });

  const subAnswers = await db.query.answers.findMany({ where: eq(answers.submissionId, submission.id) });
  const answerByQuestionId = new Map(subAnswers.map((a) => [a.questionId, a]));

  const answerIds = subAnswers.map((a) => a.id);
  const relevantGrades = answerIds.length
    ? await db.query.grades.findMany({
        where: and(eq(grades.subjectType, "answer"), inArray(grades.subjectId, answerIds)),
      })
    : [];
  const gradeByAnswerId = new Map(relevantGrades.map((g) => [g.subjectId, g]));

  let releasedScore = 0;
  let releasedMax = 0;
  let pendingCount = 0;

  const rows: SubmissionRow[] = links.map((link) => {
    const answer = answerByQuestionId.get(link.questionId);
    const grade = answer ? gradeByAnswerId.get(answer.id) : undefined;
    if (grade?.status === "released") {
      releasedScore += Number(grade.score);
      releasedMax += Number(grade.maxScore);
    } else {
      pendingCount += 1;
    }
    return { question: link.question, points: Number(link.points), answer, grade };
  });

  return {
    submission,
    assessmentTitle: assessment.title,
    rows,
    releasedScore,
    releasedMax,
    pendingCount,
    allReleased: pendingCount === 0,
  };
}
