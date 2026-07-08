"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { blocks, classes, pages, pageVersions } from "@/db/schema";

/**
 * Publish is one transaction (data-model.md §2.1 point 5): stamp the current
 * draft published, point pages.published_version_id at it, then clone its
 * blocks into a fresh draft version. A throw anywhere in here rolls the
 * whole thing back — the published pointer never moves halfway.
 */
export async function publishAction(classId: string) {
  const session = await requireRole("admin");

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: { page: { with: { draftVersion: { with: { blocks: true } } } } },
  });
  const page = cls?.page;
  const draft = page?.draftVersion;
  if (!page || !draft) throw new Error("Class has no draft to publish");

  await db.transaction(async (tx) => {
    await tx.update(pageVersions).set({ publishedAt: new Date() }).where(eq(pageVersions.id, draft.id));
    await tx.update(pages).set({ publishedVersionId: draft.id }).where(eq(pages.id, page.id));

    const [newDraft] = await tx
      .insert(pageVersions)
      .values({ pageId: page.id, versionNo: draft.versionNo + 1, createdBy: session.userId, publishedAt: null })
      .returning();

    if (draft.blocks.length > 0) {
      await tx.insert(blocks).values(
        draft.blocks.map((b) => ({
          pageVersionId: newDraft.id,
          type: b.type,
          position: b.position,
          config: b.config,
        }))
      );
    }

    await tx.update(pages).set({ draftVersionId: newDraft.id }).where(eq(pages.id, page.id));
  });

  revalidatePath(`/admin/curriculum/class/${classId}`);
  redirect(`/admin/curriculum/class/${classId}`);
}

/**
 * Restores a previously-published version's content into the *current*
 * draft slot (blocks swapped, draft row itself unchanged) — the restored
 * version's own row and blocks are never touched, so history isn't lost.
 */
export async function restoreVersionAction(classId: string, sourceVersionId: string) {
  await requireRole("admin");

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: { page: true },
  });
  const page = cls?.page;
  if (!page?.draftVersionId) throw new Error("Class has no draft");

  const source = await db.query.pageVersions.findFirst({
    where: eq(pageVersions.id, sourceVersionId),
    with: { blocks: true },
  });
  if (!source || !source.publishedAt) throw new Error("Can only restore a published version");
  if (source.pageId !== page.id) throw new Error("Version does not belong to this class");

  await db.transaction(async (tx) => {
    await tx.delete(blocks).where(eq(blocks.pageVersionId, page.draftVersionId!));
    if (source.blocks.length > 0) {
      await tx.insert(blocks).values(
        source.blocks.map((b) => ({
          pageVersionId: page.draftVersionId!,
          type: b.type,
          position: b.position,
          config: b.config,
        }))
      );
    }
  });

  revalidatePath(`/admin/curriculum/class/${classId}`);
}
