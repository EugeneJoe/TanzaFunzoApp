import { type AnyPgColumn, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps, uuidPk } from "./_shared";
import { cohorts, users } from "./identity";

// --- 2. Curriculum & content (data-model.md §2) ---
//
// Each class owns one page; the page holds pointers to a draft and a
// published page_version, making preview-before-publish and rollback
// structural. A version is an ordered list of blocks (type + position +
// config JSON) — new block types are a new `type` string plus a renderer,
// never a schema migration (so `blocks.type` is `text`, not a pg enum).
// journey_steps merges per-cohort ordering and release scheduling (null
// release_at = locked).

export const modules = pgTable("modules", {
  id: uuidPk(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

export const classes = pgTable("classes", {
  id: uuidPk(),
  moduleId: uuid("module_id").notNull().references(() => modules.id),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

// pages <-> page_versions is a circular reference (each points at the
// other); referencing the not-yet-declared table via a lazy `() => ...`
// callback is Drizzle's documented pattern for same-file circular FKs.
export const pages = pgTable("pages", {
  id: uuidPk(),
  classId: uuid("class_id").notNull().references(() => classes.id),
  draftVersionId: uuid("draft_version_id").references((): AnyPgColumn => pageVersions.id),
  publishedVersionId: uuid("published_version_id").references((): AnyPgColumn => pageVersions.id),
  ...timestamps(),
}, (table) => [
  uniqueIndex("pages_class_id_key").on(table.classId),
]);

export const pageVersions = pgTable("page_versions", {
  id: uuidPk(),
  pageId: uuid("page_id").notNull().references(() => pages.id),
  versionNo: integer("version_no").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  publishedAt: timestamp("published_at", { withTimezone: true }), // null = draft
  ...timestamps(),
});

/**
 * Block content refs live inside `config` jsonb (locked decision #5), typed
 * as a discriminated union keyed by the sibling `blocks.type` column — the
 * config payload itself carries no redundant `type` field (matches the
 * data-model.md §2.1 worked example). `link_list`/`case_study`/`transcript`
 * are valid `type` values with no authoring UI in this beta (case_study is
 * Stage 6, transcript is a stretch/future field); their configs are left
 * loose until something builds them.
 */
export type BlockConfigMap = {
  video: { mediaAssetId: string; caption?: string };
  rich_text: { doc: unknown }; // ProseMirror/TipTap document JSON
  resource_list: {
    items: Array<
      | { fileAssetId: string; label: string }
      | { url: string; label: string }
    >;
  };
  assessment: { assessmentId: string };
  link_list: { items: Array<{ url: string; label: string }> };
  case_study: { caseStudyId: string };
  transcript: { mediaAssetId: string };
};
export type BlockType = keyof BlockConfigMap;
export type BlockConfig = BlockConfigMap[BlockType];

export const blocks = pgTable("blocks", {
  id: uuidPk(),
  pageVersionId: uuid("page_version_id").notNull().references(() => pageVersions.id),
  type: text("type").$type<BlockType>().notNull(),
  position: integer("position").notNull(),
  config: jsonb("config").$type<BlockConfig>().notNull(),
  ...timestamps(),
});

export const journeySteps = pgTable("journey_steps", {
  id: uuidPk(),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.id),
  classId: uuid("class_id").notNull().references(() => classes.id),
  position: integer("position").notNull(),
  releaseAt: timestamp("release_at", { withTimezone: true }), // null = locked
  releasedBy: uuid("released_by").references(() => users.id),
  ...timestamps(),
}, (table) => [
  uniqueIndex("journey_steps_cohort_class_key").on(table.cohortId, table.classId),
]);

export const mediaAssets = pgTable("media_assets", {
  id: uuidPk(),
  provider: text("provider").notNull(), // stream | youtube | vimeo
  providerRef: text("provider_ref").notNull(),
  status: text("status").notNull().default("ready"), // uploading | processing | ready
  durationS: integer("duration_s"),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  ...timestamps(),
});

export const fileAssets = pgTable("file_assets", {
  id: uuidPk(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  ...timestamps(),
});
