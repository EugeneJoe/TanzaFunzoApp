"use server";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cohorts, enrollments, roles, userRoles, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { signupSchema } from "@/lib/validation/auth";
import { isUniqueViolation } from "@/lib/db-errors";

export type SignupState = { error?: string };

export async function signupAction(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { fullName, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const cohort = await db.query.cohorts.findFirst({
    where: and(lte(cohorts.enrolOpenAt, today), gte(cohorts.enrolCloseAt, today)),
    orderBy: asc(cohorts.startDate),
  });
  if (!cohort) {
    return { error: "No cohort is currently open for signups. Please check back soon." };
  }

  const fellowRole = await db.query.roles.findFirst({ where: eq(roles.name, "fellow") });
  if (!fellowRole) {
    // Seed data missing, not a user-facing input problem.
    throw new Error("'fellow' role is not seeded");
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, passwordHash, fullName }).returning();
      await tx.insert(userRoles).values({ userId: user.id, roleId: fellowRole.id });
      await tx.insert(enrollments).values({ userId: user.id, cohortId: cohort.id, assignedBy: "system" });
      return user.id;
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { error: "An account with that email already exists." };
    }
    throw err;
  }

  const session = await getSession();
  session.userId = userId;
  session.email = email;
  session.fullName = fullName;
  session.roles = ["fellow"];
  await session.save();

  redirect("/dashboard");
}
