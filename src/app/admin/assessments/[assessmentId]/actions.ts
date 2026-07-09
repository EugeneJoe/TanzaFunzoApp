"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import {
  aptitudeWeights,
  assessmentQuestions,
  assessments,
  auditLog,
  questionTags,
  questions,
  submissions,
} from "@/db/schema";
import { mcOptionsSchema, weightInputSchema } from "@/lib/validation/questions";
import { aptitudeWeightsSumTo100 } from "@/lib/assessment-rollup";
import { recomputeAll } from "@/lib/recompute";
import { z } from "zod";

async function isLocked(assessmentId: string): Promise<boolean> {
  const existing = await db.query.submissions.findFirst({
    where: and(eq(submissions.subjectType, "assessment"), eq(submissions.subjectId, assessmentId)),
  });
  return Boolean(existing);
}

async function assertNotLocked(assessmentId: string) {
  if (await isLocked(assessmentId)) {
    throw new Error("This assessment has submissions and can't be edited — duplicate it first.");
  }
}

function revalidate(assessmentId: string) {
  revalidatePath(`/admin/assessments/${assessmentId}`);
}

export async function addQuestionAction(assessmentId: string, type: "mc" | "short_answer") {
  await requireRole("admin");
  await assertNotLocked(assessmentId);

  const links = await db.query.assessmentQuestions.findMany({ where: eq(assessmentQuestions.assessmentId, assessmentId) });
  const position = links.length === 0 ? 1 : Math.max(...links.map((l) => l.position)) + 1;

  const [question] = await db
    .insert(questions)
    .values(
      type === "mc"
        ? {
            type,
            body: "",
            options: [
              { id: randomUUID(), text: "" },
              { id: randomUUID(), text: "" },
            ],
            answerKey: { correctOptionId: null },
            status: "active",
          }
        : { type, body: "", rubric: { criteria: "" }, status: "active" }
    )
    .returning();

  await db.insert(assessmentQuestions).values({ assessmentId, questionId: question.id, position, points: "10" });
  revalidate(assessmentId);
}

export async function removeQuestionAction(assessmentId: string, questionId: string) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  // Only unlinks from this assessment — the question stays in the reusable bank.
  await db
    .delete(assessmentQuestions)
    .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, questionId)));
  revalidate(assessmentId);
}

export async function reorderQuestionAction(assessmentId: string, questionId: string, direction: "up" | "down") {
  await requireRole("admin");
  await assertNotLocked(assessmentId);

  const links = (
    await db.query.assessmentQuestions.findMany({ where: eq(assessmentQuestions.assessmentId, assessmentId) })
  ).sort((a, b) => a.position - b.position);
  const index = links.findIndex((l) => l.questionId === questionId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= links.length) return;

  const a = links[index];
  const b = links[swapIndex];
  await db.transaction(async (tx) => {
    await tx
      .update(assessmentQuestions)
      .set({ position: b.position })
      .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, a.questionId)));
    await tx
      .update(assessmentQuestions)
      .set({ position: a.position })
      .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, b.questionId)));
  });
  revalidate(assessmentId);
}

export async function updatePointsAction(assessmentId: string, questionId: string, points: number) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  if (!Number.isFinite(points) || points < 0) return;
  await db
    .update(assessmentQuestions)
    .set({ points: String(points) })
    .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, questionId)));
  revalidate(assessmentId);
}

export async function updateMCQuestionAction(
  assessmentId: string,
  questionId: string,
  body: string,
  options: Array<{ id: string; text: string }>,
  correctOptionId: string | null
) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);

  const parsedOptions = mcOptionsSchema.parse(options);
  await db
    .update(questions)
    .set({ body, options: parsedOptions, answerKey: { correctOptionId } })
    .where(eq(questions.id, questionId));
  revalidate(assessmentId);
}

export async function updateShortAnswerQuestionAction(
  assessmentId: string,
  questionId: string,
  body: string,
  rubricCriteria: string
) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  await db
    .update(questions)
    .set({ body, rubric: { criteria: rubricCriteria } })
    .where(eq(questions.id, questionId));
  revalidate(assessmentId);
}

export async function addTagAction(assessmentId: string, questionId: string, termId: string) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  await db.insert(questionTags).values({ questionId, termId }).onConflictDoNothing();
  revalidate(assessmentId);
}

export async function removeTagAction(assessmentId: string, questionId: string, termId: string) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  await db.delete(questionTags).where(and(eq(questionTags.questionId, questionId), eq(questionTags.termId, termId)));
  revalidate(assessmentId);
}

const weightsInputSchema = z.array(weightInputSchema);

export type SetWeightsResult = { error?: string };

/**
 * Shared by every "counts toward" weights UI (data-model.md D1: one table,
 * one component). Refuses to persist unless the given weights sum to 100 —
 * AC-2 requires this rejection to surface as a field error, not a crash.
 *
 * Deliberately NOT gated by assertNotLocked, unlike every other mutation in
 * this file: re-weighting an already-submitted-to question is exactly what
 * the append-only signals ledger exists to make safe mid-cohort (data-
 * model.md §5 intro; FR-7.2/FR-7.5; demo-path step 10). Structural edits
 * (body, options, points) still lock — only the aptitude split doesn't.
 */
export async function setWeightsAction(
  assessmentId: string,
  subjectType: string,
  subjectId: string,
  weights: Array<{ termId: string; weight: number }>
): Promise<SetWeightsResult> {
  const session = await requireRole("admin");

  const parsed = weightsInputSchema.parse(weights);
  const nonZero = parsed.filter((w) => w.weight > 0);
  if (!aptitudeWeightsSumTo100(nonZero)) {
    return { error: "Weights must add up to 100%." };
  }

  const before = await db.query.aptitudeWeights.findMany({
    where: and(eq(aptitudeWeights.subjectType, subjectType), eq(aptitudeWeights.subjectId, subjectId)),
  });

  await db.transaction(async (tx) => {
    await tx
      .delete(aptitudeWeights)
      .where(and(eq(aptitudeWeights.subjectType, subjectType), eq(aptitudeWeights.subjectId, subjectId)));
    if (nonZero.length > 0) {
      await tx
        .insert(aptitudeWeights)
        .values(nonZero.map((w) => ({ subjectType, subjectId, termId: w.termId, weight: String(w.weight) })));
    }
    await tx.insert(auditLog).values({
      actorId: session.userId,
      action: "update_weights",
      entityType: subjectType,
      entityId: subjectId,
      before: before.map((w) => ({ termId: w.termId, weight: Number(w.weight) })),
      after: nonZero,
    });
  });

  // Full, not incremental: a weight change can affect every fellow who has
  // ever answered this question, not just one (data-model.md §5.5).
  await recomputeAll();
  revalidate(assessmentId);
  return {};
}

export async function updateAttemptsAction(assessmentId: string, attemptsAllowed: number) {
  await requireRole("admin");
  await assertNotLocked(assessmentId);
  if (!Number.isFinite(attemptsAllowed) || attemptsAllowed < 1) return;
  await db.update(assessments).set({ settings: { attemptsAllowed } }).where(eq(assessments.id, assessmentId));
  revalidate(assessmentId);
}

/**
 * Deep-clones assessment + questions + tags + weights into brand new rows.
 * A shallow clone (relinking the same question rows) would let editing the
 * copy retroactively change the locked original's questions, since
 * questions are a reusable bank — the whole point of "duplicate to edit" is
 * to escape that sharing.
 */
export async function duplicateAssessmentAction(assessmentId: string) {
  await requireRole("admin");

  const original = await db.query.assessments.findFirst({ where: eq(assessments.id, assessmentId) });
  if (!original) throw new Error("Assessment not found");

  const links = await db.query.assessmentQuestions.findMany({
    where: eq(assessmentQuestions.assessmentId, assessmentId),
    orderBy: (l, { asc }) => [asc(l.position)],
  });

  const newAssessmentId = await db.transaction(async (tx) => {
    const [newAssessment] = await tx
      .insert(assessments)
      .values({ title: `${original.title} (copy)`, settings: original.settings })
      .returning();

    for (const link of links) {
      const question = await tx.query.questions.findFirst({ where: eq(questions.id, link.questionId) });
      if (!question) continue;

      const [newQuestion] = await tx
        .insert(questions)
        .values({
          type: question.type,
          body: question.body,
          options: question.options,
          answerKey: question.answerKey,
          rubric: question.rubric,
          status: question.status,
        })
        .returning();

      await tx.insert(assessmentQuestions).values({
        assessmentId: newAssessment.id,
        questionId: newQuestion.id,
        position: link.position,
        points: link.points,
      });

      const tags = await tx.query.questionTags.findMany({ where: eq(questionTags.questionId, question.id) });
      if (tags.length > 0) {
        await tx.insert(questionTags).values(tags.map((t) => ({ questionId: newQuestion.id, termId: t.termId })));
      }

      const weights = await tx.query.aptitudeWeights.findMany({
        where: and(eq(aptitudeWeights.subjectType, "question"), eq(aptitudeWeights.subjectId, question.id)),
      });
      if (weights.length > 0) {
        await tx.insert(aptitudeWeights).values(
          weights.map((w) => ({ subjectType: "question", subjectId: newQuestion.id, termId: w.termId, weight: w.weight }))
        );
      }
    }

    return newAssessment.id;
  });

  revalidate(newAssessmentId);
  return newAssessmentId;
}

export async function getAssessmentLockInfo(assessmentId: string) {
  return { locked: await isLocked(assessmentId) };
}

export async function duplicateAndRedirectAction(assessmentId: string, fromClassId: string | null) {
  const newId = await duplicateAssessmentAction(assessmentId);
  redirect(fromClassId ? `/admin/assessments/${newId}?from=${fromClassId}` : `/admin/assessments/${newId}`);
}
