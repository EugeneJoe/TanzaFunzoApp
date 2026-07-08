import { z } from "zod";

// Mirrors BlockConfigMap in src/db/schema/curriculum.ts. Only the types with
// authoring UI in this beta (rich_text, video, resource_list, assessment)
// get a strict schema; the others (link_list, case_study, transcript) have
// no builder support yet.

export const videoConfigSchema = z.object({
  mediaAssetId: z.string().min(1).nullable(),
  caption: z.string().trim().optional(),
});

// TipTap/ProseMirror documents are recursive and provider-defined; validate
// shape loosely (it's produced by our own editor, not untrusted input) while
// still rejecting obviously-wrong payloads.
export const proseMirrorDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const richTextConfigSchema = z.object({
  doc: proseMirrorDocSchema,
});

export const resourceItemSchema = z.union([
  z.object({ fileAssetId: z.string().min(1), label: z.string().trim().min(1) }),
  z.object({ url: z.string().trim().url(), label: z.string().trim().min(1) }),
]);

export const resourceListConfigSchema = z.object({
  items: z.array(resourceItemSchema),
});

export const assessmentBlockConfigSchema = z.object({
  assessmentId: z.string().min(1),
});

export const videoProviderSchema = z.enum(["youtube", "vimeo"]);
