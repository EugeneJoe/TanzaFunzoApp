import { integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps, uuidPk } from "./_shared";
import { cohorts, users } from "./identity";

// --- 3. Assessments, case studies & grading (data-model.md §3) ---
//
// Questions live in a reusable bank tagged against a unified `terms`
// vocabulary. Two polymorphic patterns: submissions.subject (assessment or
// case study) and grades.subject (a single short answer or a whole
// submission) — subject_type/subject_id pairs have no DB-level FK
// (data-model.md D3: app-layer integrity, traded for schema flexibility).
// grades.source + status enforce human-in-the-loop AI grading: an
// `ai_draft` grade can never reach `released` without an admin approving it.

export const terms = pgTable("terms", {
  id: uuidPk(),
  taxonomy: text("taxonomy").notNull(), // aptitude | competency | behaviour | tag
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps(),
}, (table) => [
  uniqueIndex("terms_taxonomy_name_key").on(table.taxonomy, table.name),
]);

export const questions = pgTable("questions", {
  id: uuidPk(),
  type: text("type").notNull(), // mc | short_answer
  body: text("body").notNull(),
  options: jsonb("options"), // mc: [{ id, text }]
  answerKey: jsonb("answer_key"), // mc: { correctOptionId }
  rubric: jsonb("rubric"), // short_answer: grading rubric text/criteria
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

export const questionTags = pgTable("question_tags", {
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.questionId, table.termId] }),
]);

export const aptitudeWeights = pgTable("aptitude_weights", {
  id: uuidPk(),
  subjectType: text("subject_type").notNull(), // question | case_study | observation
  subjectId: uuid("subject_id").notNull(),
  termId: uuid("term_id").notNull().references(() => terms.id),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull(), // percentage points, 0-100
  ...timestamps(),
}, (table) => [
  uniqueIndex("aptitude_weights_subject_term_key").on(table.subjectType, table.subjectId, table.termId),
]);

export const assessments = pgTable("assessments", {
  id: uuidPk(),
  title: text("title").notNull(),
  settings: jsonb("settings").$type<{ attemptsAllowed: number }>().notNull().default({ attemptsAllowed: 1 }),
  ...timestamps(),
});

export const assessmentQuestions = pgTable("assessment_questions", {
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  position: integer("position").notNull(),
  points: numeric("points", { precision: 8, scale: 2 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.assessmentId, table.questionId] }),
]);

export const caseStudies = pgTable("case_studies", {
  id: uuidPk(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  rubric: jsonb("rubric").notNull(),
  ...timestamps(),
});

export const submissions = pgTable("submissions", {
  id: uuidPk(),
  userId: uuid("user_id").notNull().references(() => users.id),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.id),
  subjectType: text("subject_type").notNull(), // assessment | case_study
  subjectId: uuid("subject_id").notNull(),
  attemptNo: integer("attempt_no").notNull().default(1),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("submissions_idempotency_key_key").on(table.idempotencyKey),
]);

export const answers = pgTable("answers", {
  id: uuidPk(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  response: jsonb("response").notNull(), // mc: { optionId }; short_answer: { text }
  autoScore: numeric("auto_score", { precision: 8, scale: 2 }),
  ...timestamps(),
});

export const grades = pgTable("grades", {
  id: uuidPk(),
  subjectType: text("subject_type").notNull(), // answer | submission
  subjectId: uuid("subject_id").notNull(),
  graderId: uuid("grader_id").references(() => users.id), // null for auto
  source: text("source").notNull(), // auto | ai_draft | human
  score: numeric("score", { precision: 8, scale: 2 }).notNull(),
  maxScore: numeric("max_score", { precision: 8, scale: 2 }).notNull(),
  rubricScores: jsonb("rubric_scores"),
  feedback: text("feedback"),
  status: text("status").notNull().default("draft"), // draft | approved | released
  ...timestamps(),
});
