"use server";

import { and, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { cohorts, enrollments } from "@/db/schema";

export async function reassignFellowAction(userId: string, cohortId: string) {
  await requireRole("admin");

  if (!userId || !cohortId) return;

  // Enrollments are append-only history (data-model.md §6): reassignment
  // inserts a new row rather than mutating the old one, so "current cohort"
  // is always the fellow's most recent enrollment.
  await db.insert(enrollments).values({ userId, cohortId, assignedBy: "admin" });

  revalidatePath("/admin/cohorts");
}

export type CreateCohortState = { error?: string; overlapHint?: string };

export async function createCohortAction(
  _prevState: CreateCohortState,
  formData: FormData
): Promise<CreateCohortState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const enrolOpenAt = String(formData.get("enrolOpenAt") ?? "");
  const enrolCloseAt = String(formData.get("enrolCloseAt") ?? "");

  if (!name || !startDate || !enrolOpenAt || !enrolCloseAt) {
    return { error: "All fields are required." };
  }
  if (enrolCloseAt < enrolOpenAt) {
    return { error: "Enrolment close date can't be before the open date." };
  }

  // Signup auto-assignment (src/app/signup/actions.ts) picks the
  // earliest-starting cohort whose enrolment window contains today — an
  // overlapping window silently redirects new signups there. Not blocked
  // (creating cohorts ahead of time is expected), just surfaced.
  const overlapping = await db.query.cohorts.findFirst({
    where: and(lte(cohorts.enrolOpenAt, enrolCloseAt), gte(cohorts.enrolCloseAt, enrolOpenAt)),
  });

  await db.insert(cohorts).values({ name, startDate, enrolOpenAt, enrolCloseAt });

  revalidatePath("/admin/cohorts");

  return overlapping
    ? { overlapHint: `This window overlaps "${overlapping.name}"'s enrolment window.` }
    : {};
}
