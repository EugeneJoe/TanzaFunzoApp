"use server";

import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { answers, assessments, grades, submissions } from "@/db/schema";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { isClassReleasedForCohort } from "@/lib/journey";
import { countSubmissions } from "@/lib/assessment-result";
import { isUniqueViolation } from "@/lib/db-errors";

type McOption = { id: string; text: string };
type McAnswerKey = { correctOptionId: string | null };

/**
 * Submits one attempt: MC answers auto-score and their grade is released
 * immediately (data-model.md §5.1 — auto-scored MC is a final fellow-visible
 * fact at submission time); short answers get a placeholder `grades` row in
 * `status: 'draft'` that Stage 4's grading queue discovers and mutates in
 * place (grades are only mutable while draft — data-model.md §6).
 *
 * Signal projection (writing to the `signals` ledger) is explicitly Stage
 * 4's responsibility, including for these auto-released MC grades — it
 * fires at release time, and MC release happens to be submit time, but the
 * projector itself isn't built yet.
 */
export async function submitAssessmentAction(
  classId: string,
  assessmentId: string,
  idempotencyKey: string,
  answersByQuestionId: Record<string, string>
): Promise<void> {
  const session = await requireUser();
  const enrollment = await getCurrentEnrollment(session.userId);
  if (!enrollment) throw new Error("You need to be enrolled in a cohort to submit.");

  const released = await isClassReleasedForCohort(enrollment.cohortId, classId);
  if (!released) throw new Error("This class isn't available yet.");

  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
    with: { assessmentQuestions: { with: { question: true } } },
  });
  if (!assessment) throw new Error("Assessment not found.");

  const existingCount = await countSubmissions(session.userId, assessmentId);
  if (existingCount >= assessment.settings.attemptsAllowed) {
    return; // attempts exhausted — no-op, the page will show results instead
  }

  if (!idempotencyKey) throw new Error("Missing idempotency key.");

  try {
    await db.transaction(async (tx) => {
      const [submission] = await tx
        .insert(submissions)
        .values({
          userId: session.userId,
          cohortId: enrollment.cohortId,
          subjectType: "assessment",
          subjectId: assessmentId,
          attemptNo: existingCount + 1,
          idempotencyKey,
          status: "submitted",
        })
        .returning();

      for (const link of assessment.assessmentQuestions) {
        const question = link.question;
        const points = Number(link.points);

        if (question.type === "mc") {
          const selectedOptionId = answersByQuestionId[question.id] ?? null;
          const correctOptionId = (question.answerKey as McAnswerKey | null)?.correctOptionId ?? null;
          const isCorrect = selectedOptionId !== null && selectedOptionId === correctOptionId;
          const autoScore = isCorrect ? points : 0;

          const [answer] = await tx
            .insert(answers)
            .values({
              submissionId: submission.id,
              questionId: question.id,
              response: { optionId: selectedOptionId },
              autoScore: String(autoScore),
            })
            .returning();

          await tx.insert(grades).values({
            subjectType: "answer",
            subjectId: answer.id,
            graderId: null,
            source: "auto",
            score: String(autoScore),
            maxScore: String(points),
            status: "released",
          });
        } else {
          const text = answersByQuestionId[question.id] ?? "";

          const [answer] = await tx
            .insert(answers)
            .values({
              submissionId: submission.id,
              questionId: question.id,
              response: { text },
              autoScore: null,
            })
            .returning();

          // Placeholder queue row — score/source are overwritten in place by
          // Stage 4's grading flow, never re-inserted (mutable while draft).
          await tx.insert(grades).values({
            subjectType: "answer",
            subjectId: answer.id,
            graderId: null,
            source: "human",
            score: "0",
            maxScore: String(points),
            status: "draft",
          });
        }
      }
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Same idempotency key already used — treat as an idempotent success.
  }
}
