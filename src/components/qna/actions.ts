"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/db";
import { classQuestionReplies, classQuestions } from "@/db/schema";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { isClassReleasedForCohort } from "@/lib/journey";
import { qnaBodySchema } from "@/lib/validation/qna";

function revalidateClass(classId: string) {
  revalidatePath(`/learn/class/${classId}`);
  revalidatePath(`/admin/curriculum/class/${classId}/preview`);
}

/** Fellow-only: posting requires a resolvable cohort and a released class (locked decision #11 — rejected server-side, never just hidden in the UI). */
export async function postQuestionAction(classId: string, formData: FormData) {
  const session = await requireUser();
  const enrollment = await getCurrentEnrollment(session.userId);
  if (!enrollment) throw new Error("You need to be enrolled in a cohort to post.");

  const released = await isClassReleasedForCohort(enrollment.cohortId, classId);
  if (!released) throw new Error("This class isn't available yet.");

  const parsed = qnaBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) return;

  await db.insert(classQuestions).values({
    classId,
    cohortId: enrollment.cohortId,
    authorId: session.userId,
    body: parsed.data,
    status: "visible",
  });
  revalidateClass(classId);
}

/** Any admin, or any fellow in the question's own cohort, may reply (FR-9.3). */
export async function postReplyAction(classId: string, questionId: string, formData: FormData) {
  const session = await requireUser();

  const question = await db.query.classQuestions.findFirst({ where: eq(classQuestions.id, questionId) });
  if (!question || question.classId !== classId) throw new Error("Question not found.");

  if (!session.roles.includes("admin")) {
    const enrollment = await getCurrentEnrollment(session.userId);
    if (!enrollment || enrollment.cohortId !== question.cohortId) {
      throw new Error("Not authorized to reply here.");
    }
  }

  const parsed = qnaBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) return;

  await db.insert(classQuestionReplies).values({
    questionId,
    authorId: session.userId,
    body: parsed.data,
    status: "visible",
  });
  revalidateClass(classId);
}

export async function setQuestionVisibilityAction(classId: string, questionId: string, hidden: boolean) {
  await requireRole("admin");
  await db
    .update(classQuestions)
    .set({ status: hidden ? "hidden" : "visible" })
    .where(eq(classQuestions.id, questionId));
  revalidateClass(classId);
}

export async function setReplyVisibilityAction(classId: string, replyId: string, hidden: boolean) {
  await requireRole("admin");
  await db
    .update(classQuestionReplies)
    .set({ status: hidden ? "hidden" : "visible" })
    .where(eq(classQuestionReplies.id, replyId));
  revalidateClass(classId);
}

/** Author-only hard delete (FR-9.5) — cascades to the question's replies (schema onDelete: cascade). */
export async function deleteOwnQuestionAction(classId: string, questionId: string) {
  const session = await requireUser();
  const question = await db.query.classQuestions.findFirst({ where: eq(classQuestions.id, questionId) });
  if (!question || question.authorId !== session.userId) throw new Error("Not authorized.");
  await db.delete(classQuestions).where(eq(classQuestions.id, questionId));
  revalidateClass(classId);
}

export async function deleteOwnReplyAction(classId: string, replyId: string) {
  const session = await requireUser();
  const reply = await db.query.classQuestionReplies.findFirst({ where: eq(classQuestionReplies.id, replyId) });
  if (!reply || reply.authorId !== session.userId) throw new Error("Not authorized.");
  await db.delete(classQuestionReplies).where(eq(classQuestionReplies.id, replyId));
  revalidateClass(classId);
}
