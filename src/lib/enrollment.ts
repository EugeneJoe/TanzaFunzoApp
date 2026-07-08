import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { enrollments } from "@/db/schema";

/**
 * Enrollments are append-only history (data-model.md §6) — a fellow's
 * *current* cohort is always their most recent enrollment row, never a
 * mutated field. Returns undefined for a user with no enrollment (e.g. an
 * admin account, or a data inconsistency) rather than throwing — callers
 * decide how to handle "not enrolled".
 */
export async function getCurrentEnrollment(userId: string) {
  return db.query.enrollments.findFirst({
    where: eq(enrollments.userId, userId),
    orderBy: desc(enrollments.createdAt),
    with: { cohort: true },
  });
}
