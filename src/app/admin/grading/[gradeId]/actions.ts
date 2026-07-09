"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { answers, grades, questions, signals, submissions } from "@/db/schema";
import { draftGrade } from "@/lib/ai";
import { recomputeFellow } from "@/lib/recompute";
import { isUniqueViolation } from "@/lib/db-errors";

async function loadGradeContext(gradeId: string) {
  const grade = await db.query.grades.findFirst({ where: eq(grades.id, gradeId) });
  if (!grade || grade.subjectType !== "answer") return null;

  const answer = await db.query.answers.findFirst({ where: eq(answers.id, grade.subjectId) });
  if (!answer) return null;

  const [question, submission] = await Promise.all([
    db.query.questions.findFirst({ where: eq(questions.id, answer.questionId) }),
    db.query.submissions.findFirst({ where: eq(submissions.id, answer.submissionId) }),
  ]);
  if (!question || !submission) return null;

  return { grade, answer, question, submission };
}

export type DraftWithAiResult = { score: number; feedback: string } | { error: string };

export async function draftWithAiAction(gradeId: string): Promise<DraftWithAiResult> {
  await requireRole("admin");

  const ctx = await loadGradeContext(gradeId);
  if (!ctx || ctx.grade.status !== "draft") return { error: "This response can no longer be drafted." };

  const rubric = (ctx.question.rubric as { criteria: string } | null)?.criteria ?? "";
  const fellowAnswer = (ctx.answer.response as { text: string } | null)?.text ?? "";

  try {
    return await draftGrade({
      questionBody: ctx.question.body,
      rubric,
      maxPoints: Number(ctx.grade.maxScore),
      fellowAnswer,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI draft failed." };
  }
}

export type ApproveResult = { error?: string };

export async function approveAndReleaseGradeAction(
  gradeId: string,
  score: number,
  feedback: string,
  usedAi: boolean
): Promise<ApproveResult> {
  const session = await requireRole("admin");

  const ctx = await loadGradeContext(gradeId);
  if (!ctx) return { error: "Grade not found." };
  if (ctx.grade.status !== "draft") return {}; // already released — idempotent no-op

  const maxScore = Number(ctx.grade.maxScore);
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    return { error: `Score must be between 0 and ${maxScore}.` };
  }
  const trimmedFeedback = feedback.trim();
  if (!trimmedFeedback) return { error: "Feedback is required." };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(grades)
        .set({
          graderId: session.userId,
          source: usedAi ? "ai_draft" : "human",
          score: String(score),
          feedback: trimmedFeedback,
          status: "released",
        })
        .where(eq(grades.id, gradeId));

      await tx.insert(signals).values({
        fellowId: ctx.submission.userId,
        cohortId: ctx.submission.cohortId,
        sourceType: "grade",
        sourceId: gradeId,
        rawScore: String(score),
        maxScore: String(maxScore),
        occurredAt: ctx.submission.submittedAt,
      });
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return {}; // signal already projected for this grade — already released
  }

  await recomputeFellow(ctx.submission.userId);
  revalidatePath("/admin/grading");
  return {};
}
