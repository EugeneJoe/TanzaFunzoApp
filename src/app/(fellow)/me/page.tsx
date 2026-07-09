import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "lucide-react";
import { db } from "@/db";
import { answers, aptitudeScores, enrollments, grades, questionTags, submissions, terms } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney, isReleased } from "@/lib/journey";
import { getSubmissionResult } from "@/lib/assessment-result";
import { getAssessmentClassMap } from "@/lib/assessment-location";
import { computeFellowAptitudeSnapshot, ALL_TIME_PERIOD } from "@/lib/recompute";
import type { AptitudeScoreResult } from "@/lib/scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function computeTrend(snapshot: AptitudeScoreResult[], termId: string, moduleOrder: { id: string; title: string }[]) {
  const byModule = new Map(snapshot.filter((r) => r.termId === termId).map((r) => [r.periodKey, r.score]));
  const scoredInOrder = moduleOrder.filter((m) => byModule.has(m.id));
  if (scoredInOrder.length < 2) return null;
  const latest = scoredInOrder[scoredInOrder.length - 1];
  const previous = scoredInOrder[scoredInOrder.length - 2];
  const delta = Math.round((byModule.get(latest.id)! - byModule.get(previous.id)!) * 10) / 10;
  return { delta, vsModuleTitle: previous.title };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function CohortBand({ score, p25, p75 }: { score: number; p25: number; p75: number }) {
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  return (
    <div className="relative h-2 w-full rounded-full bg-muted">
      <div
        className="absolute top-0 h-full rounded-full bg-muted-foreground/25"
        style={{ left: `${clamp(p25)}%`, width: `${clamp(p75 - p25)}%` }}
      />
      <div
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
        style={{ left: `${clamp(score)}%` }}
      />
    </div>
  );
}

export default async function MePage() {
  const session = await requireUser();
  const enrollment = await getCurrentEnrollment(session.userId);

  const aptitudeTerms = await db.query.terms.findMany({
    where: eq(terms.taxonomy, "aptitude"),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  const [snapshot, journey, mySubmissions, classMap] = await Promise.all([
    computeFellowAptitudeSnapshot(session.userId),
    enrollment ? getFellowJourney(enrollment.cohortId) : Promise.resolve([]),
    db.query.submissions.findMany({
      where: and(eq(submissions.userId, session.userId), eq(submissions.subjectType, "assessment")),
      orderBy: desc(submissions.submittedAt),
    }),
    getAssessmentClassMap(),
  ]);

  const moduleOrder = [...new Map(journey.map((e) => [e.module.id, e.module])).values()].sort(
    (a, b) => a.position - b.position
  );
  // "Current module" is anchored to the fellow's own most recent submission
  // rather than "whichever module released a class most recently across the
  // whole cohort" — a cohort can contain modules the fellow never touches
  // (sandbox/test content released after their real curriculum), which would
  // otherwise win this by release timestamp alone. Falls back to the old
  // released-journey heuristic only before a fellow's first submission.
  const latestSubmissionLocation = mySubmissions[0] ? classMap.get(mySubmissions[0].subjectId) : undefined;
  const currentModuleTitle =
    latestSubmissionLocation?.moduleTitle ??
    [...journey].reverse().find(isReleased)?.module.title ??
    moduleOrder[0]?.title;

  // aptitude_scores has no cohort_id column (it's per-fellow, not per-enrollment) —
  // scope "the cohort" band by joining through enrollments instead.
  const cohortBands = new Map<string, { p25: number; p75: number }>();
  if (enrollment) {
    const cohortEnrollments = await db.query.enrollments.findMany({
      where: eq(enrollments.cohortId, enrollment.cohortId),
    });
    const cohortFellowIds = cohortEnrollments.map((e) => e.userId);
    const cohortScores = cohortFellowIds.length
      ? await db.query.aptitudeScores.findMany({
          where: and(eq(aptitudeScores.periodKey, ALL_TIME_PERIOD), inArray(aptitudeScores.fellowId, cohortFellowIds)),
        })
      : [];

    const scoresByTerm = new Map<string, number[]>();
    for (const row of cohortScores) {
      const list = scoresByTerm.get(row.termId) ?? [];
      list.push(Number(row.score));
      scoresByTerm.set(row.termId, list);
    }
    for (const [termId, scores] of scoresByTerm) {
      const sorted = [...scores].sort((a, b) => a - b);
      cohortBands.set(termId, { p25: percentile(sorted, 0.25), p75: percentile(sorted, 0.75) });
    }
  }

  const rows = await Promise.all(
    mySubmissions.map(async (sub) => ({
      sub,
      result: await getSubmissionResult(sub.id),
      location: classMap.get(sub.subjectId),
    }))
  );
  const pendingCount = rows.filter((r) => r.result && !r.result.allReleased).length;

  const releasedCount = journey.filter(isReleased).length;
  const totalCount = journey.length;
  const progressPct = totalCount > 0 ? Math.round((releasedCount / totalCount) * 100) : 0;

  const competencyRows = await db
    .select({
      termId: terms.id,
      termName: terms.name,
      score: grades.score,
      maxScore: grades.maxScore,
    })
    .from(grades)
    .innerJoin(answers, eq(answers.id, grades.subjectId))
    .innerJoin(submissions, eq(submissions.id, answers.submissionId))
    .innerJoin(questionTags, eq(questionTags.questionId, answers.questionId))
    .innerJoin(terms, eq(terms.id, questionTags.termId))
    .where(
      and(
        eq(grades.subjectType, "answer"),
        eq(grades.status, "released"),
        eq(terms.taxonomy, "competency"),
        eq(submissions.userId, session.userId)
      )
    );

  const byCompetency = new Map<string, { name: string; sum: number; count: number }>();
  for (const row of competencyRows) {
    const entry = byCompetency.get(row.termId) ?? { name: row.termName, sum: 0, count: 0 };
    entry.sum += Number(row.score) / Number(row.maxScore);
    entry.count += 1;
    byCompetency.set(row.termId, entry);
  }
  const competencyAverages = [...byCompetency.entries()]
    .map(([termId, v]) => ({ termId, name: v.name, avg: v.sum / v.count }))
    .sort((a, b) => b.avg - a.avg);
  const topCount = Math.max(1, Math.min(3, Math.floor(competencyAverages.length / 2)));
  const strengths = competencyAverages.length > 0 ? competencyAverages.slice(0, topCount) : [];
  const focusNext = competencyAverages.length > 1 ? [...competencyAverages].slice(-topCount).reverse() : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Your development</h1>
          <p className="text-sm text-muted-foreground">
            {[enrollment?.cohort.name, currentModuleTitle].filter(Boolean).join(" · ")}
            {" — "}updated {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {aptitudeTerms.map((term) => {
            const allTime = snapshot.find((r) => r.termId === term.id && r.periodKey === ALL_TIME_PERIOD);
            const trend = computeTrend(snapshot, term.id, moduleOrder);
            return (
              <Card key={term.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{term.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {allTime ? (
                    <>
                      <p className="text-3xl font-semibold">{Math.round(allTime.score)}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-sm">
                        {trend && trend.delta !== 0 && (
                          <span
                            className={
                              trend.delta > 0
                                ? "flex items-center gap-0.5 text-green-600"
                                : "flex items-center gap-0.5 text-destructive"
                            }
                          >
                            {trend.delta > 0 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                            {Math.abs(trend.delta)} vs {trend.vsModuleTitle}
                          </span>
                        )}
                        <span className="text-muted-foreground">· {allTime.signalCount} signals</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {enrollment && cohortBands.size > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">You and the cohort</p>
              <p className="text-xs text-muted-foreground">Shaded band = middle half of the cohort · dot = you (all-time)</p>
            </div>
            <div className="flex flex-col gap-3">
              {aptitudeTerms.map((term) => {
                const band = cohortBands.get(term.id);
                const myScore = snapshot.find((r) => r.termId === term.id && r.periodKey === ALL_TIME_PERIOD)?.score;
                if (!band || myScore === undefined) return null;
                return (
                  <div key={term.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-muted-foreground">{term.name}</span>
                    <CohortBand score={myScore} p25={band.p25} p75={band.p75} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Strengths</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {strengths.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough graded work yet.</p>
              ) : (
                strengths.map((s) => (
                  <Badge key={s.termId} variant="default">
                    {s.name}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Focus next</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {focusNext.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough graded work yet.</p>
              ) : (
                focusNext.map((s) => (
                  <Badge key={s.termId} variant="outline">
                    {s.name}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-1.5">
          <Progress value={progressPct} />
          <p className="text-sm text-muted-foreground">
            {releasedCount} of {totalCount} classes
            {pendingCount > 0 && ` · ${pendingCount} assessment${pendingCount === 1 ? "" : "s"} pending`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your coursework</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet — start a class assessment from your journey.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ sub, result, location }) => (
              <Card key={sub.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{result?.assessmentTitle ?? "Assessment"}</p>
                    <p className="text-sm text-muted-foreground">
                      {location ? `${location.moduleTitle} · ${location.classTitle} · ` : null}
                      Submitted {sub.submittedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {result && (
                      <>
                        <Badge variant={result.allReleased ? "default" : "outline"}>
                          {result.allReleased ? "Graded" : "Submitted"}
                        </Badge>
                        {result.releasedMax > 0 && (
                          <span className="text-sm font-medium">
                            {result.releasedScore}/{result.releasedMax} pts
                          </span>
                        )}
                      </>
                    )}
                    {location && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/learn/class/${location.classId}/assessment`}>View</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
