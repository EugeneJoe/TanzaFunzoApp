import { describe, expect, it } from "vitest";
import { computeAptitudeScores, normalize, type SignalFact } from "./scoring";

const TECH = "term-technical";
const STRATEGIC = "term-strategic";
const ALL_TIME = "all-time";

function fact(overrides: Partial<SignalFact>): SignalFact {
  return {
    dedupeKey: crypto.randomUUID(),
    rawScore: 1,
    maxScore: 1,
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    periodKeys: [ALL_TIME],
    weights: {},
    ...overrides,
  };
}

describe("normalize", () => {
  it("divides raw by max", () => {
    expect(normalize(7, 10)).toBe(0.7);
  });

  it("guards against a zero max instead of dividing by zero", () => {
    expect(normalize(5, 0)).toBe(0);
  });
});

describe("computeAptitudeScores", () => {
  it("normalises a single signal (raw/max) into a 0-100 score", () => {
    const results = computeAptitudeScores([fact({ rawScore: 7, maxScore: 10, weights: { [TECH]: 100 } })]);
    expect(results).toEqual([{ termId: TECH, periodKey: ALL_TIME, score: 70, signalCount: 1 }]);
  });

  it("splits one signal's contribution across multiple aptitudes by weight (70/30 case)", () => {
    const results = computeAptitudeScores([
      fact({ dedupeKey: "a1:q1", rawScore: 8, maxScore: 10, weights: { [TECH]: 100 } }),
      fact({ dedupeKey: "a1:q2", rawScore: 6, maxScore: 10, weights: { [TECH]: 70, [STRATEGIC]: 30 } }),
    ]);

    const tech = results.find((r) => r.termId === TECH);
    const strategic = results.find((r) => r.termId === STRATEGIC);

    // tech: (0.8*100 + 0.6*70) / (100+70) = 122/170
    expect(tech).toEqual({ termId: TECH, periodKey: ALL_TIME, score: 71.76, signalCount: 2 });
    // strategic: only q2 carries a strategic weight -> (0.6*30)/30
    expect(strategic).toEqual({ termId: STRATEGIC, periodKey: ALL_TIME, score: 60, signalCount: 1 });
  });

  it("lets a signal with no weights contribute nothing, without affecting others", () => {
    const results = computeAptitudeScores([
      fact({ dedupeKey: "a1:q1", rawScore: 8, maxScore: 10, weights: { [TECH]: 100 } }),
      fact({ dedupeKey: "a1:q2", rawScore: 0, maxScore: 10, weights: {} }),
    ]);
    expect(results).toEqual([{ termId: TECH, periodKey: ALL_TIME, score: 80, signalCount: 1 }]);
  });

  it("uses only the latest signal per dedupe key (retake / corrected grade)", () => {
    const results = computeAptitudeScores([
      fact({
        dedupeKey: "a1:q1",
        rawScore: 5,
        maxScore: 10,
        occurredAt: new Date("2026-01-01T00:00:00Z"),
        weights: { [TECH]: 100 },
      }),
      fact({
        dedupeKey: "a1:q1",
        rawScore: 9,
        maxScore: 10,
        occurredAt: new Date("2026-02-01T00:00:00Z"),
        weights: { [TECH]: 100 },
      }),
    ]);
    expect(results).toEqual([{ termId: TECH, periodKey: ALL_TIME, score: 90, signalCount: 1 }]);
  });

  it("buckets scores per period independently, plus an all-time rollup across periods", () => {
    const results = computeAptitudeScores([
      fact({
        dedupeKey: "a1:q1",
        rawScore: 10,
        maxScore: 10,
        periodKeys: ["module-1", ALL_TIME],
        weights: { [TECH]: 100 },
      }),
      fact({
        dedupeKey: "a2:q1",
        rawScore: 0,
        maxScore: 10,
        periodKeys: ["module-2", ALL_TIME],
        weights: { [TECH]: 100 },
      }),
    ]);

    const byPeriod = Object.fromEntries(results.map((r) => [r.periodKey, r.score]));
    expect(byPeriod["module-1"]).toBe(100);
    expect(byPeriod["module-2"]).toBe(0);
    expect(byPeriod[ALL_TIME]).toBe(50); // combines both signals: (1*100 + 0*100)/(100+100)
  });

  it("omits a term/period bucket entirely when its total weight is zero (no fake score)", () => {
    const results = computeAptitudeScores([fact({ rawScore: 5, maxScore: 10, weights: { [TECH]: 0 } })]);
    expect(results).toEqual([]);
  });

  it("returns nothing for an empty signal set", () => {
    expect(computeAptitudeScores([])).toEqual([]);
  });
});
