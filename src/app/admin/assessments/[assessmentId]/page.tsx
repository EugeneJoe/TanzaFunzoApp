import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aptitudeWeights, assessmentQuestions, submissions, terms } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { computeWeightsRollup } from "@/lib/assessment-rollup";
import { QuestionCard } from "./question-card";
import { addQuestionAction, duplicateAndRedirectAction, updateAttemptsAction } from "./actions";
import { AttemptsSelect } from "./attempts-select";

export default async function AssessmentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { assessmentId } = await params;
  const { from } = await searchParams;

  const assessment = await db.query.assessments.findFirst({ where: (a, { eq }) => eq(a.id, assessmentId) });
  if (!assessment) notFound();

  const locked = Boolean(
    await db.query.submissions.findFirst({
      where: and(eq(submissions.subjectType, "assessment"), eq(submissions.subjectId, assessmentId)),
    })
  );

  const links = await db.query.assessmentQuestions.findMany({
    where: eq(assessmentQuestions.assessmentId, assessmentId),
    orderBy: (l, { asc }) => [asc(l.position)],
    with: { question: { with: { questionTags: { with: { term: true } } } } },
  });

  const questionIds = links.map((l) => l.questionId);
  const allWeights =
    questionIds.length === 0
      ? []
      : await db.query.aptitudeWeights.findMany({
          where: and(eq(aptitudeWeights.subjectType, "question"), inArray(aptitudeWeights.subjectId, questionIds)),
        });

  const aptitudeTerms = await db.query.terms.findMany({ where: eq(terms.taxonomy, "aptitude") });
  const tagTerms = await db.query.terms.findMany({
    where: (t, { ne }) => ne(t.taxonomy, "aptitude"),
  });

  const totalPoints = links.reduce((sum, l) => sum + Number(l.points), 0);
  const rollup = computeWeightsRollup(
    links.map((l) => ({
      points: Number(l.points),
      weights: allWeights.filter((w) => w.subjectId === l.questionId).map((w) => ({ termId: w.termId, weight: Number(w.weight) })),
    }))
  );
  const termNameById = new Map(aptitudeTerms.map((t) => [t.id, t.name]));

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Assessment editor</p>
          <h1 className="text-xl font-semibold">{assessment.title}</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href={from ? `/admin/curriculum/class/${from}` : "/admin/curriculum"}>Done — back to class</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6 text-sm">
          <span>
            {links.length} question{links.length === 1 ? "" : "s"}
          </span>
          <span>{totalPoints} pts total</span>
          <div className="flex items-center gap-1.5">
            {Object.keys(rollup).length === 0 ? (
              <span className="text-muted-foreground">No weights set yet</span>
            ) : (
              Object.entries(rollup).map(([termId, pct]) => (
                <Badge key={termId} variant="secondary">
                  {termNameById.get(termId) ?? "?"} {pct}%
                </Badge>
              ))
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">Attempts</span>
            <AttemptsSelect
              assessmentId={assessmentId}
              value={assessment.settings.attemptsAllowed}
              disabled={locked}
              onSave={updateAttemptsAction}
            />
          </div>
        </CardContent>
      </Card>

      {locked && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">
            This assessment already has submissions, so it&apos;s locked to keep those results consistent.
          </p>
          <form action={duplicateAndRedirectAction.bind(null, assessmentId, from ?? null)}>
            <Button type="submit" variant="outline">
              Duplicate to edit
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {links.map((link, index) => {
          const q = link.question;
          const weights = Object.fromEntries(
            allWeights.filter((w) => w.subjectId === q.id).map((w) => [w.termId, Number(w.weight)])
          );
          const currentTags = q.questionTags.map((qt) => qt.term);
          return (
            <QuestionCard
              key={q.id}
              assessmentId={assessmentId}
              questionId={q.id}
              type={q.type as "mc" | "short_answer"}
              index={index}
              count={links.length}
              points={Number(link.points)}
              initialBody={q.body}
              initialOptions={(q.options as { id: string; text: string }[] | null) ?? []}
              initialCorrectOptionId={(q.answerKey as { correctOptionId: string | null } | null)?.correctOptionId ?? null}
              initialRubric={(q.rubric as { criteria: string } | null)?.criteria ?? ""}
              currentTags={currentTags}
              availableTags={tagTerms}
              aptitudes={aptitudeTerms}
              currentWeights={weights}
              locked={locked}
            />
          );
        })}
      </div>

      {!locked && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
          <span className="text-sm text-muted-foreground">Add question:</span>
          <form action={addQuestionAction.bind(null, assessmentId, "mc")}>
            <Button type="submit" size="sm" variant="outline">
              Multiple choice
            </Button>
          </form>
          <form action={addQuestionAction.bind(null, assessmentId, "short_answer")}>
            <Button type="submit" size="sm" variant="outline">
              Short answer
            </Button>
          </form>
          <span className="ml-2 text-xs text-muted-foreground">From bank — post-beta</span>
        </div>
      )}
    </div>
  );
}
