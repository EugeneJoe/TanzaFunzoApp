// Pure aggregation math for the signals -> aptitude_scores pipeline
// (data-model.md §5). No DB access here on purpose — this is the one module
// Stage 4 requires unit tests for (implementation-plan.md §2 testing
// policy); lib/recompute.ts does the DB-touching resolution and calls into
// this file with already-resolved facts.

export type SignalFact = {
  /** Groups signals that represent the *same underlying fact* (a retaken
   * attempt's answer to the same question, or a corrected grade) so only
   * the latest one counts — data-model.md §5.3/§5.4. */
  dedupeKey: string;
  rawScore: number;
  maxScore: number;
  occurredAt: Date;
  /** Buckets this signal counts toward, e.g. [moduleId, "all-time"]. */
  periodKeys: string[];
  /** aptitude termId -> weight. A term absent (or weighted 0) here gets no
   * contribution from this signal toward that aptitude. */
  weights: Record<string, number>;
};

export type AptitudeScoreResult = {
  termId: string;
  periodKey: string;
  /** 0-100. */
  score: number;
  /** How many distinct (deduped) signals fed this bucket — dashboards must
   * show this alongside the score (data-model.md §5, "small samples"). */
  signalCount: number;
};

export function normalize(rawScore: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return rawScore / maxScore;
}

function dedupeLatestPerKey(signals: SignalFact[]): SignalFact[] {
  const latest = new Map<string, SignalFact>();
  for (const signal of signals) {
    const existing = latest.get(signal.dedupeKey);
    if (!existing || signal.occurredAt > existing.occurredAt) {
      latest.set(signal.dedupeKey, signal);
    }
  }
  return [...latest.values()];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * score = Σ(normalize(raw,max) × w) / Σ(w), resolved per aptitude term ×
 * period bucket, over the deduped signal set (data-model.md §5.4).
 */
export function computeAptitudeScores(signals: SignalFact[]): AptitudeScoreResult[] {
  const deduped = dedupeLatestPerKey(signals);

  type Bucket = { numerator: number; denominator: number; count: number };
  const buckets = new Map<string, Map<string, Bucket>>(); // termId -> periodKey -> Bucket

  for (const signal of deduped) {
    const n = normalize(signal.rawScore, signal.maxScore);
    for (const [termId, weight] of Object.entries(signal.weights)) {
      let perPeriod = buckets.get(termId);
      if (!perPeriod) {
        perPeriod = new Map();
        buckets.set(termId, perPeriod);
      }
      for (const periodKey of signal.periodKeys) {
        const bucket = perPeriod.get(periodKey) ?? { numerator: 0, denominator: 0, count: 0 };
        bucket.numerator += n * weight;
        bucket.denominator += weight;
        if (weight > 0) bucket.count += 1;
        perPeriod.set(periodKey, bucket);
      }
    }
  }

  const results: AptitudeScoreResult[] = [];
  for (const [termId, perPeriod] of buckets) {
    for (const [periodKey, bucket] of perPeriod) {
      // Division-by-zero guard: a term with only zero/absent weights so far
      // has no defined score yet, not a fake 0 — omit it until a weighted
      // signal arrives (data-model.md §5, "unweighted items").
      if (bucket.denominator <= 0) continue;
      results.push({
        termId,
        periodKey,
        score: round2((bucket.numerator / bucket.denominator) * 100),
        signalCount: bucket.count,
      });
    }
  }
  return results;
}
