import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks } from "@/db/schema";
import type { BlockConfigMap } from "@/db/schema";

export type AssessmentLocation = { classId: string; classTitle: string; moduleId: string; moduleTitle: string };

/**
 * assessments aren't FK-linked to a class — the link only exists as an
 * assessment block's config.assessmentId (data-model.md D3: polymorphic/
 * config refs, app-layer integrity). This scans that small block set once
 * per /me render to answer "which class is this submission's assessment
 * attached to" for display purposes.
 */
export async function getAssessmentClassMap(): Promise<Map<string, AssessmentLocation>> {
  const assessmentBlocks = await db.query.blocks.findMany({
    where: eq(blocks.type, "assessment"),
    with: { pageVersion: { with: { page: { with: { class: { with: { module: true } } } } } } },
  });

  const map = new Map<string, AssessmentLocation>();
  for (const block of assessmentBlocks) {
    const assessmentId = (block.config as BlockConfigMap["assessment"]).assessmentId;
    const cls = block.pageVersion?.page?.class;
    if (!cls || map.has(assessmentId)) continue;
    map.set(assessmentId, {
      classId: cls.id,
      classTitle: cls.title,
      moduleId: cls.module.id,
      moduleTitle: cls.module.title,
    });
  }
  return map;
}
