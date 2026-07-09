import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, classes } from "@/db/schema";
import type { BlockConfigMap } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { isClassReleasedForCohort } from "@/lib/journey";
import { countSubmissions, getLatestSubmission } from "@/lib/assessment-result";
import { Button } from "@/components/ui/button";
import { Overline } from "@/components/ui/overline";
import { AssessmentForm, type FormQuestion } from "./assessment-form";
import { AssessmentResults } from "./results";

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ retake?: string }>;
}) {
  const { classId } = await params;
  const { retake } = await searchParams;
  const session = await requireUser();

  const enrollment = await getCurrentEnrollment(session.userId);
  if (!enrollment) notFound();

  const released = await isClassReleasedForCohort(enrollment.cohortId, classId);
  if (!released) notFound();

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: { module: true, page: { with: { publishedVersion: { with: { blocks: true } } } } },
  });
  if (!cls?.page?.publishedVersion) notFound();

  const assessmentBlock = cls.page.publishedVersion.blocks.find((b) => b.type === "assessment");
  if (!assessmentBlock) notFound();
  const assessmentId = (assessmentBlock.config as BlockConfigMap["assessment"]).assessmentId;

  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
    with: { assessmentQuestions: { orderBy: (l, { asc }) => [asc(l.position)], with: { question: true } } },
  });
  if (!assessment) notFound();

  const existingCount = await countSubmissions(session.userId, assessmentId);
  const attemptsRemaining = existingCount < assessment.settings.attemptsAllowed;
  const latest = await getLatestSubmission(session.userId, assessmentId);

  // Results are the default view once an attempt exists — a fellow should
  // see how they did right after submitting, not the blank form again.
  // Retaking is an explicit choice (?retake=1), never the fallback, and is
  // still gated by attemptsRemaining even if that param is stale/forged.
  const showForm = !latest || (attemptsRemaining && retake === "1");

  // Never pass the full question row to the client form — answerKey/rubric
  // must not leak into the RSC payload before grading (results view is
  // safe to show them since it's server-rendered to final markup instead).
  const formQuestions: FormQuestion[] = assessment.assessmentQuestions.map((link) => ({
    questionId: link.questionId,
    points: link.points,
    type: link.question.type as "mc" | "short_answer",
    body: link.question.body,
    options: link.question.type === "mc" ? (link.question.options as { id: string; text: string }[]) : null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-8 py-10 sm:px-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Overline>
            {cls.module.title} · {cls.title}
          </Overline>
          <h1 className="mt-1 font-heading text-[28px] font-semibold text-navy-900">{assessment.title}</h1>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/learn/class/${classId}`}>← Back to class</Link>
        </Button>
      </div>

      {showForm ? (
        <AssessmentForm classId={classId} assessmentId={assessmentId} questions={formQuestions} />
      ) : latest ? (
        <>
          <AssessmentResults submissionId={latest.id} />
          {attemptsRemaining && (
            <Button asChild variant="outline" className="self-start">
              <Link href={`/learn/class/${classId}/assessment?retake=1`}>Start new attempt</Link>
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}
