/**
 * Assessment-level weights rollup: what share of the assessment's total
 * points leans toward each aptitude. Per-question weights are a % of that
 * question alone (validated to sum to 100 — see aptitudeWeightsSumTo100);
 * the rollup re-derives the assessment-wide picture as
 * Σ(question.points × questionWeight%) / Σ(question.points), per aptitude.
 *
 * This is a display aggregate only — the real fellow-scoring pipeline
 * (data-model.md §5) resolves weights fresh from aptitude_weights at
 * compute time and is implemented separately in Stage 4's lib/scoring.ts.
 */
export function computeWeightsRollup(
  questions: Array<{ points: number; weights: Array<{ termId: string; weight: number }> }>
): Record<string, number> {
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  if (totalPoints === 0) return {};

  const byAptitude = new Map<string, number>();
  for (const question of questions) {
    for (const { termId, weight } of question.weights) {
      const contribution = question.points * (weight / 100);
      byAptitude.set(termId, (byAptitude.get(termId) ?? 0) + contribution);
    }
  }

  const rollup: Record<string, number> = {};
  for (const [termId, points] of byAptitude) {
    rollup[termId] = Math.round((points / totalPoints) * 100 * 10) / 10;
  }
  return rollup;
}

export function aptitudeWeightsSumTo100(weights: Array<{ weight: number }>, epsilon = 0.01): boolean {
  if (weights.length === 0) return false;
  const sum = weights.reduce((s, w) => s + w.weight, 0);
  return Math.abs(sum - 100) <= epsilon;
}
