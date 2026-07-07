import { relations } from "drizzle-orm";
import { cohorts, enrollments, roles, userRoles, users } from "./identity";

// Drizzle relational-query helpers (db.query.x.findMany({ with: {...} })).
// Defined per-stage as features need them, not all upfront — these cover
// Stage 1 (auth + cohorts). Curriculum/assessment/performance relations
// land in Stages 2-4 alongside the code that queries them.

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
