"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { classes, journeySteps, modules, pages, pageVersions } from "@/db/schema";

/** Lower than every existing position, so it sorts first under ORDER BY position ASC. */
function topPosition(rows: { position: number }[]): number {
  return rows.length === 0 ? 1 : Math.min(...rows.map((r) => r.position)) - 1;
}

export async function createModuleAction(formData: FormData) {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  // Newest module goes to the top of the list — it's the one you're most
  // likely working on right after creating it.
  const existing = await db.query.modules.findMany({ where: eq(modules.status, "active") });
  await db.insert(modules).values({ title, position: topPosition(existing), status: "active" });

  revalidatePath("/admin/curriculum");
}

export async function createClassAction(formData: FormData) {
  const session = await requireRole("admin");
  const moduleId = String(formData.get("moduleId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!moduleId || !title) return;

  // Newest class goes to the top of its module, same as modules themselves.
  const siblings = await db.query.classes.findMany({
    where: and(eq(classes.moduleId, moduleId), eq(classes.status, "active")),
  });

  await db.transaction(async (tx) => {
    const [cls] = await tx
      .insert(classes)
      .values({ moduleId, title, position: topPosition(siblings), status: "active" })
      .returning();

    // A class always owns exactly one page, which always has a draft
    // version — admins never edit "live" content directly (data-model.md
    // §2.1). draft_version_id is set in a second step since the page row
    // needs to exist before a page_version can reference it.
    const [page] = await tx.insert(pages).values({ classId: cls.id }).returning();
    const [version] = await tx
      .insert(pageVersions)
      .values({ pageId: page.id, versionNo: 1, createdBy: session.userId, publishedAt: null })
      .returning();
    await tx.update(pages).set({ draftVersionId: version.id }).where(eq(pages.id, page.id));
  });

  revalidatePath("/admin/curriculum");
}

async function swapPositions<T extends { id: string; position: number }>(
  table: typeof modules | typeof classes,
  siblings: T[],
  targetId: string,
  direction: "up" | "down"
) {
  const sorted = [...siblings].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((s) => s.id === targetId);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return;

  const a = sorted[index];
  const b = sorted[swapIndex];
  await db.transaction(async (tx) => {
    await tx.update(table).set({ position: b.position }).where(eq(table.id, a.id));
    await tx.update(table).set({ position: a.position }).where(eq(table.id, b.id));
  });
}

export async function reorderModuleAction(moduleId: string, direction: "up" | "down") {
  await requireRole("admin");
  const siblings = await db.query.modules.findMany({ where: eq(modules.status, "active") });
  await swapPositions(modules, siblings, moduleId, direction);
  revalidatePath("/admin/curriculum");
}

export async function reorderClassAction(classId: string, moduleId: string, direction: "up" | "down") {
  await requireRole("admin");
  const siblings = await db.query.classes.findMany({
    where: and(eq(classes.moduleId, moduleId), eq(classes.status, "active")),
  });
  await swapPositions(classes, siblings, classId, direction);
  revalidatePath("/admin/curriculum");
}

export async function archiveModuleAction(moduleId: string) {
  await requireRole("admin");
  await db.update(modules).set({ status: "archived" }).where(eq(modules.id, moduleId));
  revalidatePath("/admin/curriculum");
}

export async function archiveClassAction(classId: string) {
  await requireRole("admin");
  await db.update(classes).set({ status: "archived" }).where(eq(classes.id, classId));
  revalidatePath("/admin/curriculum");
}

/**
 * Release/lock a class for a cohort. `position` encodes (module, class)
 * authoring order as a single sortable number — there's no separate
 * fellow-journey reordering UI in this beta, so the journey always mirrors
 * how classes are authored.
 */
export async function setReleaseAction(cohortId: string, classId: string, released: boolean, releaseAt?: string) {
  const session = await requireRole("admin");

  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!cls) return;
  const mod = await db.query.modules.findFirst({ where: eq(modules.id, cls.moduleId) });
  if (!mod) return;
  const position = mod.position * 1000 + cls.position;

  const existing = await db.query.journeySteps.findFirst({
    where: and(eq(journeySteps.cohortId, cohortId), eq(journeySteps.classId, classId)),
  });

  const releaseAtDate = released ? new Date(releaseAt || Date.now()) : null;

  if (existing) {
    await db
      .update(journeySteps)
      .set({ position, releaseAt: releaseAtDate, releasedBy: released ? session.userId : null })
      .where(eq(journeySteps.id, existing.id));
  } else {
    await db.insert(journeySteps).values({
      cohortId,
      classId,
      position,
      releaseAt: releaseAtDate,
      releasedBy: released ? session.userId : null,
    });
  }

  revalidatePath("/admin/curriculum");
}
