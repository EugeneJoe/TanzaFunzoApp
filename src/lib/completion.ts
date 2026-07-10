import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { blocks, classViews, submissions } from "@/db/schema";
import type { BlockConfigMap } from "@/db/schema";
import { isReleased, type JourneyEntry } from "./journey";

/**
 * "Done" means different things per class: a class with an assessment block
 * is done once the fellow has submitted it (any attempt); a class with no
 * assessment is done once the fellow has opened it (see class_views —
 * there's no other engagement signal to hang completion on). Only released
 * entries are considered — a locked class can't be done.
 */
export async function getCompletedClassIds(fellowId: string, journey: JourneyEntry[]): Promise<Set<string>> {
  const releasedIds = journey.filter(isReleased).map((e) => e.class.id);
  if (releasedIds.length === 0) return new Set();

  const assessmentBlocks = await db.query.blocks.findMany({
    where: eq(blocks.type, "assessment"),
    with: { pageVersion: { with: { page: true } } },
  });
  const assessmentIdByClassId = new Map<string, string>();
  for (const block of assessmentBlocks) {
    const classId = block.pageVersion?.page?.classId;
    if (!classId || !releasedIds.includes(classId)) continue;
    assessmentIdByClassId.set(classId, (block.config as BlockConfigMap["assessment"]).assessmentId);
  }

  const assessmentIds = [...assessmentIdByClassId.values()];
  const submittedAssessmentIds = new Set(
    assessmentIds.length
      ? (
          await db.query.submissions.findMany({
            where: and(
              eq(submissions.userId, fellowId),
              eq(submissions.subjectType, "assessment"),
              inArray(submissions.subjectId, assessmentIds)
            ),
          })
        ).map((s) => s.subjectId)
      : []
  );

  const noAssessmentClassIds = releasedIds.filter((id) => !assessmentIdByClassId.has(id));
  const viewedClassIds = new Set(
    noAssessmentClassIds.length
      ? (
          await db.query.classViews.findMany({
            where: and(eq(classViews.userId, fellowId), inArray(classViews.classId, noAssessmentClassIds)),
          })
        ).map((v) => v.classId)
      : []
  );

  const completed = new Set<string>();
  for (const classId of releasedIds) {
    const assessmentId = assessmentIdByClassId.get(classId);
    const done = assessmentId ? submittedAssessmentIds.has(assessmentId) : viewedClassIds.has(classId);
    if (done) completed.add(classId);
  }
  return completed;
}

/** Records that a fellow opened a class — idempotent, first view only (completion is a one-time achievement). */
export async function recordClassView(userId: string, classId: string): Promise<void> {
  await db.insert(classViews).values({ userId, classId }).onConflictDoNothing();
}
