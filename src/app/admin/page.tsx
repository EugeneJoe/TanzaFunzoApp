import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, enrollments, grades, questionTags, signals, submissions, terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ALL_TIME_PERIOD, computeAllAptitudeSnapshots } from "@/lib/recompute";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Thresholds are a deliberate, documented default (not specified in the
// docs) — tune here if Tanza wants different bands. A fellow needs at least
// MIN_SIGNALS_FOR_FLAG signals on an aptitude before it can flag them at all
// (data-model.md §5, "small samples").
const NEEDS_SUPPORT_MAX = 50;
const EXCEPTIONAL_MIN = 85;
const MIN_SIGNALS_FOR_FLAG = 5;

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

type Flag = {
  fellowId: string;
  fellowName: string;
  kind: "support" | "exceptional";
  termName: string;
  score: number;
  signalCount: number;
};

// Multi-cohort UX polish is explicitly out of scope (build-plan.md §"do not
// build") — this shows the single earliest-starting cohort, no switcher.
export default async function AdminDashboardPage() {
  await requireRole("admin");

  const cohort = await db.query.cohorts.findFirst({ orderBy: (c, { asc }) => [asc(c.startDate)] });
  if (!cohort) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No cohorts yet — create one under Cohorts.
      </div>
    );
  }

  const cohortEnrollments = await db.query.enrollments.findMany({
    where: eq(enrollments.cohortId, cohort.id),
    with: { user: true },
  });
  const fellows = cohortEnrollments.map((e) => e.user);
  const fellowIds = fellows.map((f) => f.id);

  const aptitudeTerms = await db.query.terms.findMany({
    where: eq(terms.taxonomy, "aptitude"),
    orderBy: (t, { asc }) => [asc(t.name)],
  });
  const termNameById = new Map(aptitudeTerms.map((t) => [t.id, t.name]));

  const snapshots = await computeAllAptitudeSnapshots();

  const flags: Flag[] = [];
  // Per-fellow average, then median across fellows — equal weight per fellow
  // rather than a pooled median across every (fellow, aptitude) score. Safe
  // to assume even coverage here: this cohort takes assessments in lockstep,
  // so every fellow has data across the same aptitudes at the same time.
  const fellowAverages: number[] = [];
  for (const fellow of fellows) {
    const allTimeRows = (snapshots.get(fellow.id) ?? []).filter((r) => r.periodKey === ALL_TIME_PERIOD);
    if (allTimeRows.length > 0) {
      fellowAverages.push(allTimeRows.reduce((sum, r) => sum + r.score, 0) / allTimeRows.length);
    }

    const eligible = allTimeRows.filter((r) => r.signalCount >= MIN_SIGNALS_FOR_FLAG);
    if (eligible.length === 0) continue;
    const worst = eligible.reduce((a, b) => (a.score <= b.score ? a : b));
    const best = eligible.reduce((a, b) => (a.score >= b.score ? a : b));
    if (worst.score < NEEDS_SUPPORT_MAX) {
      flags.push({
        fellowId: fellow.id,
        fellowName: fellow.fullName,
        kind: "support",
        termName: termNameById.get(worst.termId) ?? "Aptitude",
        score: worst.score,
        signalCount: worst.signalCount,
      });
    } else if (best.score >= EXCEPTIONAL_MIN) {
      flags.push({
        fellowId: fellow.id,
        fellowName: fellow.fullName,
        kind: "exceptional",
        termName: termNameById.get(best.termId) ?? "Aptitude",
        score: best.score,
        signalCount: best.signalCount,
      });
    }
  }
  flags.sort((a, b) => (a.kind === b.kind ? a.score - b.score : a.kind === "support" ? -1 : 1));

  const needsSupportCount = flags.filter((f) => f.kind === "support").length;
  const exceptionalCount = flags.filter((f) => f.kind === "exceptional").length;
  const medianScore = fellowAverages.length
    ? Math.round(median([...fellowAverages].sort((a, b) => a - b)))
    : null;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const signalsThisWeek = fellowIds.length
    ? await db.query.signals.findMany({
        where: and(inArray(signals.fellowId, fellowIds), gte(signals.occurredAt, oneWeekAgo)),
      })
    : [];

  const competencyRows = fellowIds.length
    ? await db
        .select({ termId: terms.id, termName: terms.name, score: grades.score, maxScore: grades.maxScore })
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
            inArray(submissions.userId, fellowIds)
          )
        )
    : [];

  const byCompetency = new Map<string, { name: string; sum: number; count: number }>();
  for (const row of competencyRows) {
    const entry = byCompetency.get(row.termId) ?? { name: row.termName, sum: 0, count: 0 };
    entry.sum += Number(row.score) / Number(row.maxScore);
    entry.count += 1;
    byCompetency.set(row.termId, entry);
  }
  const capabilityGaps = [...byCompetency.entries()]
    .map(([termId, v]) => ({ termId, name: v.name, avgPct: Math.round((v.sum / v.count) * 100) }))
    .sort((a, b) => a.avgPct - b.avgPct);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{cohort.name}</h1>
        <p className="text-sm text-muted-foreground">
          {fellows.length} fellow{fellows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-destructive">{needsSupportCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exceptional</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-green-600">{exceptionalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Median score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{medianScore ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signals this week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{signalsThisWeek.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Attention</h2>
          {flags.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No fellows flagged yet — needs at least {MIN_SIGNALS_FOR_FLAG} signals on an aptitude to qualify.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {flags.map((f) => (
                <div key={`${f.fellowId}-${f.kind}`} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar>
                    <AvatarFallback>{initials(f.fellowName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{f.fellowName}</p>
                    <p className={f.kind === "support" ? "text-sm text-destructive" : "text-sm text-green-600"}>
                      {f.termName} {Math.round(f.score)} · {f.signalCount} signals
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Cohort capability gaps</h2>
          {capabilityGaps.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No tagged, graded work yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {capabilityGaps.map((gap, i) => (
                <div key={gap.termId} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-muted-foreground">{gap.name}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className={i === 0 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
                      style={{ width: `${gap.avgPct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium">{gap.avgPct}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
