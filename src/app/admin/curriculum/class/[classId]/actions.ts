"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import {
  assessments,
  blocks,
  classes,
  fileAssets,
  mediaAssets,
  type BlockConfig,
} from "@/db/schema";
import {
  resourceItemSchema,
  resourceListConfigSchema,
  richTextConfigSchema,
  videoConfigSchema,
  videoProviderSchema,
} from "@/lib/validation/blocks";
import { parseVideoUrl, resolveThumbnailUrl } from "@/lib/video";

export type BuildableBlockType = "rich_text" | "video" | "resource_list" | "assessment";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Refuses to touch a block once its version is published — admins only ever edit the draft. */
async function getDraftBlockOrThrow(blockId: string) {
  const block = await db.query.blocks.findFirst({
    where: eq(blocks.id, blockId),
    with: { pageVersion: true },
  });
  if (!block) throw new Error("Block not found");
  if (block.pageVersion.publishedAt) throw new Error("Cannot edit a published version");
  return block;
}

export async function addBlockAction(classId: string, type: BuildableBlockType) {
  await requireRole("admin");

  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId), with: { page: true } });
  const draftVersionId = cls?.page?.draftVersionId;
  if (!draftVersionId) return;

  const siblings = await db.query.blocks.findMany({ where: eq(blocks.pageVersionId, draftVersionId) });
  const position = siblings.length === 0 ? 1 : Math.max(...siblings.map((b) => b.position)) + 1;

  let config: BlockConfig;
  if (type === "rich_text") {
    config = { doc: EMPTY_DOC };
  } else if (type === "video") {
    config = { mediaAssetId: null, caption: "" };
  } else if (type === "resource_list") {
    config = { items: [] };
  } else {
    const [assessment] = await db
      .insert(assessments)
      .values({ title: "Untitled assessment", settings: { attemptsAllowed: 1 } })
      .returning();
    config = { assessmentId: assessment.id };
  }

  await db.insert(blocks).values({ pageVersionId: draftVersionId, type, position, config });
  revalidatePath(`/admin/curriculum/class/${classId}`);
}

export async function removeBlockAction(blockId: string, classId: string) {
  await requireRole("admin");
  await getDraftBlockOrThrow(blockId);
  await db.delete(blocks).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
}

export async function reorderBlockAction(
  blockId: string,
  pageVersionId: string,
  classId: string,
  direction: "up" | "down"
) {
  await requireRole("admin");
  await getDraftBlockOrThrow(blockId);

  const siblings = (await db.query.blocks.findMany({ where: eq(blocks.pageVersionId, pageVersionId) })).sort(
    (a, b) => a.position - b.position
  );
  const index = siblings.findIndex((b) => b.id === blockId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const a = siblings[index];
  const b = siblings[swapIndex];
  await db.transaction(async (tx) => {
    await tx.update(blocks).set({ position: b.position }).where(eq(blocks.id, a.id));
    await tx.update(blocks).set({ position: a.position }).where(eq(blocks.id, b.id));
  });
  revalidatePath(`/admin/curriculum/class/${classId}`);
}

export async function updateRichTextAction(blockId: string, classId: string, doc: unknown) {
  await requireRole("admin");
  const block = await getDraftBlockOrThrow(blockId);
  if (block.type !== "rich_text") throw new Error("Not a rich_text block");

  const config = richTextConfigSchema.parse({ doc });
  await db.update(blocks).set({ config }).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
  return { savedAt: new Date().toISOString() };
}

export async function updateVideoAction(
  blockId: string,
  classId: string,
  provider: string,
  url: string,
  caption: string
) {
  await requireRole("admin");
  const block = await getDraftBlockOrThrow(blockId);
  if (block.type !== "video") throw new Error("Not a video block");

  const parsedProvider = videoProviderSchema.parse(provider);
  const parsed = parseVideoUrl(url);
  if (!parsed || parsed.provider !== parsedProvider) {
    throw new Error(`That doesn't look like a valid ${parsedProvider} URL.`);
  }

  const existingConfig = videoConfigSchema.parse(block.config);
  let mediaAssetId = existingConfig.mediaAssetId;
  if (mediaAssetId) {
    const existingAsset = await db.query.mediaAssets.findFirst({ where: eq(mediaAssets.id, mediaAssetId) });
    // Autosave fires on every keystroke (including caption-only edits), so
    // only re-resolve the thumbnail — Vimeo's is a real network call — when
    // the video itself actually changed, or there's no thumbnail yet.
    const videoChanged =
      existingAsset?.provider !== parsed.provider || existingAsset?.providerRef !== parsed.providerRef;
    const thumbnailUrl =
      videoChanged || !existingAsset?.thumbnailUrl
        ? await resolveThumbnailUrl(parsed.provider, parsed.providerRef)
        : existingAsset.thumbnailUrl;
    await db
      .update(mediaAssets)
      .set({ provider: parsed.provider, providerRef: parsed.providerRef, status: "ready", thumbnailUrl })
      .where(eq(mediaAssets.id, mediaAssetId));
  } else {
    const thumbnailUrl = await resolveThumbnailUrl(parsed.provider, parsed.providerRef);
    const [asset] = await db
      .insert(mediaAssets)
      .values({ provider: parsed.provider, providerRef: parsed.providerRef, status: "ready", thumbnailUrl })
      .returning();
    mediaAssetId = asset.id;
  }

  const config = videoConfigSchema.parse({ mediaAssetId, caption });
  await db.update(blocks).set({ config }).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
  return { savedAt: new Date().toISOString() };
}

export async function addResourceLinkAction(blockId: string, classId: string, url: string, label: string) {
  await requireRole("admin");
  const block = await getDraftBlockOrThrow(blockId);
  if (block.type !== "resource_list") throw new Error("Not a resource_list block");

  const item = resourceItemSchema.parse({ url, label });
  const current = (block.config as { items: unknown[] }).items ?? [];
  const config: BlockConfig = resourceListConfigSchema.parse({ items: [...current, item] });
  await db.update(blocks).set({ config }).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
}

/**
 * The file itself is already in Blob storage by the time this runs — the
 * browser uploaded it directly there (via /api/blob-upload's token), which
 * is what lets us support files past Vercel's ~4.5MB server-upload request
 * body cap. This just records the resulting metadata and links it into the
 * block's resource list, the same shape uploadResourceFileAction used to
 * write after doing the upload itself.
 *
 * storageKey holds the blob's *pathname*, not its full URL — the store is
 * private, so reading a file back means signing a fresh short-lived URL
 * (see lib/blob-download-url.ts) from that pathname on every render, not
 * linking to the raw URL directly.
 */
export async function recordUploadedFileAction(
  blockId: string,
  classId: string,
  file: { pathname: string; filename: string; mimeType: string; sizeBytes: number; label: string }
) {
  await requireRole("admin");
  const block = await getDraftBlockOrThrow(blockId);
  if (block.type !== "resource_list") throw new Error("Not a resource_list block");

  const [asset] = await db
    .insert(fileAssets)
    .values({ storageKey: file.pathname, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes })
    .returning();

  const item = resourceItemSchema.parse({ fileAssetId: asset.id, label: file.label });
  const current = (block.config as { items: unknown[] }).items ?? [];
  const config: BlockConfig = resourceListConfigSchema.parse({ items: [...current, item] });
  await db.update(blocks).set({ config }).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
}

export async function removeResourceItemAction(blockId: string, classId: string, index: number) {
  await requireRole("admin");
  const block = await getDraftBlockOrThrow(blockId);
  if (block.type !== "resource_list") throw new Error("Not a resource_list block");

  const current = (block.config as { items: unknown[] }).items ?? [];
  const items = current.filter((_, i) => i !== index);
  const config: BlockConfig = resourceListConfigSchema.parse({ items });
  await db.update(blocks).set({ config }).where(eq(blocks.id, blockId));
  revalidatePath(`/admin/curriculum/class/${classId}`);
}
