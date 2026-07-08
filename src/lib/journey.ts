import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, journeySteps, modules } from "@/db/schema";

export type JourneyEntry = {
  module: { id: string; title: string; position: number };
  class: { id: string; title: string; position: number };
  releaseAt: Date | null;
};

/**
 * A fellow's whole journey, module by module, class by class, in authoring
 * order — including classes with no journey_steps row at all (absence means
 * locked, per AC-2: "A class with no journey_steps release row is
 * absent/locked for fellows"), so this is the single source of truth for
 * both /learn's list and a class page's "next class" footer.
 */
export async function getFellowJourney(cohortId: string): Promise<JourneyEntry[]> {
  const [modulesList, steps] = await Promise.all([
    db.query.modules.findMany({
      where: eq(modules.status, "active"),
      orderBy: (m, { asc }) => [asc(m.position)],
      with: { classes: { orderBy: (c, { asc }) => [asc(c.position)] } },
    }),
    db.query.journeySteps.findMany({ where: eq(journeySteps.cohortId, cohortId) }),
  ]);

  const releaseByClassId = new Map(steps.map((s) => [s.classId, s.releaseAt]));

  const entries: JourneyEntry[] = [];
  for (const mod of modulesList) {
    for (const cls of mod.classes.filter((c) => c.status === "active")) {
      entries.push({ module: mod, class: cls, releaseAt: releaseByClassId.get(cls.id) ?? null });
    }
  }
  return entries;
}

export function isReleased(entry: { releaseAt: Date | null }): boolean {
  return entry.releaseAt !== null && entry.releaseAt.getTime() <= Date.now();
}

/** Targeted single-class check for server actions (defense in depth — never trust the client). */
export async function isClassReleasedForCohort(cohortId: string, classId: string): Promise<boolean> {
  const step = await db.query.journeySteps.findFirst({
    where: and(eq(journeySteps.cohortId, cohortId), eq(journeySteps.classId, classId)),
  });
  return Boolean(step?.releaseAt && step.releaseAt.getTime() <= Date.now());
}
