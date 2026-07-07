import { timestamp, uuid } from "drizzle-orm/pg-core";

/** UUID primary key, DB-generated (matches data-model.md's "UUID primary keys" convention). */
export function uuidPk() {
  return uuid("id").primaryKey().defaultRandom();
}

/** created_at/updated_at pair, present on every table per data-model.md (omitted from its ER diagrams for brevity). */
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}
