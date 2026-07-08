import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentQuestions, aptitudeWeights, terms } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeWeightsRollup } from "@/lib/assessment-rollup";

export async function AssessmentSummary({ assessmentId, classId }: { assessmentId: string; classId: string }) {
  const assessment = await db.query.assessments.findFirst({ where: (a, { eq }) => eq(a.id, assessmentId) });
  if (!assessment) {
    return <p className="text-sm text-destructive">Linked assessment is missing.</p>;
  }

  const questionLinks = await db.query.assessmentQuestions.findMany({
    where: eq(assessmentQuestions.assessmentId, assessmentId),
  });

  const weightsRows =
    questionLinks.length === 0
      ? []
      : await db.query.aptitudeWeights.findMany({
          where: (w, { and, eq, inArray }) =>
            and(eq(w.subjectType, "question"), inArray(w.subjectId, questionLinks.map((q) => q.questionId))),
        });

  const aptitudeTerms = await db.query.terms.findMany({ where: eq(terms.taxonomy, "aptitude") });
  const termNameById = new Map(aptitudeTerms.map((t) => [t.id, t.name]));

  const questionsForRollup = questionLinks.map((q) => ({
    points: Number(q.points),
    weights: weightsRows
      .filter((w) => w.subjectId === q.questionId)
      .map((w) => ({ termId: w.termId, weight: Number(w.weight) })),
  }));
  const rollup = computeWeightsRollup(questionsForRollup);
  const totalPoints = questionsForRollup.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{assessment.title}</p>
          <p className="text-sm text-muted-foreground">
            {questionLinks.length} question{questionLinks.length === 1 ? "" : "s"} · {totalPoints} pts
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/assessments/${assessmentId}?from=${classId}`}>Edit assessment</Link>
        </Button>
      </div>
      {Object.keys(rollup).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(rollup).map(([termId, pct]) => (
            <Badge key={termId} variant="secondary">
              {termNameById.get(termId) ?? "Unknown"} {pct}%
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
