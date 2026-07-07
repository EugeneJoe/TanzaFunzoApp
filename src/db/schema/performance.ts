import { jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps, uuidPk } from "./_shared";
import { cohorts, users } from "./identity";
import { classes } from "./curriculum";
import { submissions, terms } from "./assessments";

// --- 4. Feedback, signals & performance (data-model.md §4) ---
//
// Released grades, observations, and peer reviews each project an
// append-only `signals` row; `aptitude_scores` are derived by resolving
// *current* aptitude_weights at aggregation time, so re-weighting triggers
// a recompute (audited) rather than data mutation (§5-6, locked decision #2).

export const observations = pgTable("observations", {
  id: uuidPk(),
  fellowId: uuid("fellow_id").notNull().references(() => users.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  classId: uuid("class_id").references(() => classes.id), // nullable
  notes: text("notes").notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }), // null = hidden
  ...timestamps(),
});

export const observationScores = pgTable("observation_scores", {
  observationId: uuid("observation_id").notNull().references(() => observations.id, { onDelete: "cascade" }),
  termId: uuid("term_id").notNull().references(() => terms.id),
  score: numeric("score", { precision: 8, scale: 2 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.observationId, table.termId] }),
]);

export const peerReviewRequests = pgTable("peer_review_requests", {
  id: uuidPk(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id),
  requesterId: uuid("requester_id").notNull().references(() => users.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | done | declined
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps(),
});

export const peerReviews = pgTable("peer_reviews", {
  id: uuidPk(),
  requestId: uuid("request_id").notNull().references(() => peerReviewRequests.id),
  rubricScores: jsonb("rubric_scores").notNull(),
  comments: text("comments"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("peer_reviews_request_id_key").on(table.requestId),
]);

export const signals = pgTable("signals", {
  id: uuidPk(),
  fellowId: uuid("fellow_id").notNull().references(() => users.id),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.id),
  sourceType: text("source_type").notNull(), // grade | observation | peer_review
  sourceId: uuid("source_id").notNull(),
  rawScore: numeric("raw_score", { precision: 8, scale: 2 }).notNull(),
  maxScore: numeric("max_score", { precision: 8, scale: 2 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // No updatedAt: signals are an append-only ledger (data-model.md §6) —
  // corrections create a new superseding signal, never mutate an old one.
}, (table) => [
  uniqueIndex("signals_source_key").on(table.sourceType, table.sourceId),
]);

export const aptitudeScores = pgTable("aptitude_scores", {
  id: uuidPk(),
  fellowId: uuid("fellow_id").notNull().references(() => users.id),
  termId: uuid("term_id").notNull().references(() => terms.id), // aptitude
  periodKey: text("period_key").notNull(), // e.g. module id, or "all-time"
  score: numeric("score", { precision: 8, scale: 2 }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Derived + rebuildable (data-model.md §5.5): one row per bucket, upserted
  // on recompute rather than accumulated, so TRUNCATE + full rebuild is
  // well-defined and idempotent.
  uniqueIndex("aptitude_scores_fellow_term_period_key").on(table.fellowId, table.termId, table.periodKey),
]);

export const auditLog = pgTable("audit_log", {
  id: uuidPk(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
