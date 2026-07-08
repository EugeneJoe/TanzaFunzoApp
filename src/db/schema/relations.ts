import { relations } from "drizzle-orm";
import { cohorts, enrollments, roles, userRoles, users } from "./identity";
import { blocks, classes, modules, pages, pageVersions } from "./curriculum";
import { assessmentQuestions, assessments, questionTags, questions, terms } from "./assessments";

// Drizzle relational-query helpers (db.query.x.findMany({ with: {...} })).
// Defined per-stage as features need them, not all upfront — these cover
// Stage 1 (auth + cohorts) plus modules/classes for Stage 2's curriculum
// tree. pages/page_versions/blocks relations land alongside the block
// builder later in Stage 2.

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  enrollments: many(enrollments),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  cohort: one(cohorts, { fields: [enrollments.cohortId], references: [cohorts.id] }),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one }) => ({
  module: one(modules, { fields: [classes.moduleId], references: [modules.id] }),
  page: one(pages, { fields: [classes.id], references: [pages.classId] }),
}));

// pages <-> pageVersions has three distinct relations (all versions of a
// page; the current draft; the current published one) — relationName
// disambiguates the many/one pair that share a join condition.
export const pagesRelations = relations(pages, ({ one, many }) => ({
  class: one(classes, { fields: [pages.classId], references: [classes.id] }),
  versions: many(pageVersions, { relationName: "pageVersions" }),
  draftVersion: one(pageVersions, {
    fields: [pages.draftVersionId],
    references: [pageVersions.id],
    relationName: "draftVersion",
  }),
  publishedVersion: one(pageVersions, {
    fields: [pages.publishedVersionId],
    references: [pageVersions.id],
    relationName: "publishedVersion",
  }),
}));

export const pageVersionsRelations = relations(pageVersions, ({ one, many }) => ({
  page: one(pages, { fields: [pageVersions.pageId], references: [pages.id], relationName: "pageVersions" }),
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  pageVersion: one(pageVersions, { fields: [blocks.pageVersionId], references: [pageVersions.id] }),
}));

export const assessmentsRelations = relations(assessments, ({ many }) => ({
  assessmentQuestions: many(assessmentQuestions),
}));

export const assessmentQuestionsRelations = relations(assessmentQuestions, ({ one }) => ({
  assessment: one(assessments, { fields: [assessmentQuestions.assessmentId], references: [assessments.id] }),
  question: one(questions, { fields: [assessmentQuestions.questionId], references: [questions.id] }),
}));

export const questionsRelations = relations(questions, ({ many }) => ({
  assessmentQuestions: many(assessmentQuestions),
  questionTags: many(questionTags),
}));

export const questionTagsRelations = relations(questionTags, ({ one }) => ({
  question: one(questions, { fields: [questionTags.questionId], references: [questions.id] }),
  term: one(terms, { fields: [questionTags.termId], references: [terms.id] }),
}));

export const termsRelations = relations(terms, ({ many }) => ({
  questionTags: many(questionTags),
}));
