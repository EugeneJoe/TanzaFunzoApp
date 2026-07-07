"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { enrollments } from "@/db/schema";

export async function reassignFellowAction(userId: string, cohortId: string) {
  await requireRole("admin");

  if (!userId || !cohortId) return;

  // Enrollments are append-only history (data-model.md §6): reassignment
  // inserts a new row rather than mutating the old one, so "current cohort"
  // is always the fellow's most recent enrollment.
  await db.insert(enrollments).values({ userId, cohortId, assignedBy: "admin" });

  revalidatePath("/admin/cohorts");
}
