import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answers, aptitudeScores, aptitudeWeights, grades, signals, submissions } from "@/db/schema";
import { getAssessmentClassMap } from "./assessment-location";
import { computeAptitudeScores, type AptitudeScoreResult, type SignalFact } from "./scoring";

export const ALL_TIME_PERIOD = "all-time";

/**
 * Joins signals back to the question/assessment they came from (weights and
 * module structure are resolved *now*, never snapshotted — data-model.md
 * §5.4/§6) and groups the resulting facts by fellow. Stage 4 only produces
 * 'grade' signals from assessment answers; case-study/observation sourcing
 * is Stage 6 scope and is filtered out defensively rather than crashing if
 * one ever shows up early.
 */
async function resolveSignalFactsByFellow(fellowId?: string): Promise<Map<string, SignalFact[]>> {
  const rows = await db
    .select({
      fellowId: signals.fellowId,
      rawScore: signals.rawScore,
      maxScore: signals.maxScore,
      occurredAt: signals.occurredAt,
      questionId: answers.questionId,
      assessmentId: submissions.subjectId,
      submissionSubjectType: submissions.subjectType,
    })
    .from(signals)
    .innerJoin(grades, eq(grades.id, signals.sourceId))
    .innerJoin(answers, eq(answers.id, grades.subjectId))
    .innerJoin(submissions, eq(submissions.id, answers.submissionId))
    .where(
      fellowId
        ? and(eq(signals.sourceType, "grade"), eq(signals.fellowId, fellowId))
        : eq(signals.sourceType, "grade")
    );

  const relevant = rows.filter((r) => r.submissionSubjectType === "assessment");

  const questionIds = [...new Set(relevant.map((r) => r.questionId))];
  const weightRows = questionIds.length
    ? await db.query.aptitudeWeights.findMany({
        where: and(eq(aptitudeWeights.subjectType, "question"), inArray(aptitudeWeights.subjectId, questionIds)),
      })
    : [];
  const weightsByQuestion = new Map<string, Record<string, number>>();
  for (const w of weightRows) {
    const forQuestion = weightsByQuestion.get(w.subjectId) ?? {};
    forQuestion[w.termId] = Number(w.weight);
    weightsByQuestion.set(w.subjectId, forQuestion);
  }

  const assessmentMap = await getAssessmentClassMap();

  const byFellow = new Map<string, SignalFact[]>();
  for (const row of relevant) {
    const location = assessmentMap.get(row.assessmentId);
    if (!location) continue; // assessment isn't on any published block — nothing to bucket it by

    const fact: SignalFact = {
      dedupeKey: `${row.assessmentId}:${row.questionId}`,
      rawScore: Number(row.rawScore),
      maxScore: Number(row.maxScore),
      occurredAt: row.occurredAt,
      periodKeys: [location.moduleId, ALL_TIME_PERIOD],
      weights: weightsByQuestion.get(row.questionId) ?? {},
    };
    const forFellow = byFellow.get(row.fellowId) ?? [];
    forFellow.push(fact);
    byFellow.set(row.fellowId, forFellow);
  }
  return byFellow;
}

/** Delete + reinsert one fellow's derived rows — the ledger property (data-
 * model.md §5.5): aptitude_scores is disposable and always rebuildable from
 * signals, so this is well-defined regardless of what was there before. */
async function writeFellowScores(fellowId: string, facts: SignalFact[]): Promise<void> {
  const results = computeAptitudeScores(facts);
  await db.transaction(async (tx) => {
    await tx.delete(aptitudeScores).where(eq(aptitudeScores.fellowId, fellowId));
    if (results.length > 0) {
      await tx.insert(aptitudeScores).values(
        results.map((r) => ({
          fellowId,
          termId: r.termId,
          periodKey: r.periodKey,
          score: String(r.score),
        }))
      );
    }
  });
}

/** Incremental: recompute one fellow's buckets from their own signals.
 * Call after a new signal is projected for them (a grade is released). */
export async function recomputeFellow(fellowId: string): Promise<void> {
  const byFellow = await resolveSignalFactsByFellow(fellowId);
  await writeFellowScores(fellowId, byFellow.get(fellowId) ?? []);
}

/** Full: recompute every fellow who has at least one signal. Call after a
 * weight (or other scoring-affecting configuration) change — cheap enough
 * to rebuild wholesale at beta-cohort scale (data-model.md §5.5). */
export async function recomputeAll(): Promise<void> {
  const byFellow = await resolveSignalFactsByFellow();
  for (const [fellowId, facts] of byFellow) {
    await writeFellowScores(fellowId, facts);
  }
}

/**
 * Read-side counterpart to recomputeFellow, for dashboards: same resolution
 * and math, minus the write. aptitude_scores.score is always identical to
 * this at read time (recompute runs synchronously after every signal-
 * affecting action), but the table has no column for signalCount — dashboards
 * must show the count behind a score (data-model.md §5, "small samples"), so
 * this is computed fresh rather than persisted.
 */
export async function computeFellowAptitudeSnapshot(fellowId: string): Promise<AptitudeScoreResult[]> {
  const byFellow = await resolveSignalFactsByFellow(fellowId);
  return computeAptitudeScores(byFellow.get(fellowId) ?? []);
}

/** Cohort-wide counterpart, for the admin dashboard (flags need each
 * fellow's per-aptitude signal count, not just the score). */
export async function computeAllAptitudeSnapshots(): Promise<Map<string, AptitudeScoreResult[]>> {
  const byFellow = await resolveSignalFactsByFellow();
  const snapshots = new Map<string, AptitudeScoreResult[]>();
  for (const [fellowId, facts] of byFellow) {
    snapshots.set(fellowId, computeAptitudeScores(facts));
  }
  return snapshots;
}
