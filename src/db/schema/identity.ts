import { date, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps, uuidPk } from "./_shared";

// --- 1. Identity & cohorts (data-model.md §1) ---
//
// Self-signup creates a `users` row; cohort membership is a separate
// `enrollments` row so auto-assignment by sign-up date, admin override
// (assigned_by), and future multi-cohort membership all work without
// migrations. Roles are data (RBAC), not an enum on `users`.
//
// Status/vocabulary columns (users.status, enrollments.assigned_by, ...) are
// plain `text`, not pg enums: the SRS's flexibility goals (new source types,
// new aptitudes, etc. as data not migrations) apply throughout this schema,
// so every such field is validated at the application layer (zod) instead of
// via a DB enum that would need a migration to extend.

export const users = pgTable("users", {
  id: uuidPk(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  status: text("status").notNull().default("active"), // active | deactivated
  ...timestamps(),
}, (table) => [
  uniqueIndex("users_email_key").on(table.email),
]);

export const roles = pgTable("roles", {
  id: uuidPk(),
  name: text("name").notNull(), // fellow | admin
  ...timestamps(),
}, (table) => [
  uniqueIndex("roles_name_key").on(table.name),
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  ...timestamps(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);

export const cohorts = pgTable("cohorts", {
  id: uuidPk(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  enrolOpenAt: date("enrol_open_at").notNull(),
  enrolCloseAt: date("enrol_close_at").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

export const enrollments = pgTable("enrollments", {
  id: uuidPk(),
  userId: uuid("user_id").notNull().references(() => users.id),
  cohortId: uuid("cohort_id").notNull().references(() => cohorts.id),
  assignedBy: text("assigned_by").notNull(), // system | admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // No updatedAt: enrollments are append-only history (see data-model.md §6
  // immutability boundary — reassignment inserts a new row rather than
  // mutating one, so "current cohort" = latest enrollment by createdAt).
});
