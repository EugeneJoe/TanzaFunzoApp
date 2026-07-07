import { and, eq } from "drizzle-orm";
import { hashPassword } from "../lib/password";
import { db } from "./index";
import { cohorts, roles, terms, userRoles, users } from "./schema";

// Idempotent: safe to re-run against a database that already has some or
// all of this seed data (AC-5 requires this eventually; cheaper to build it
// in now than retrofit later).

const APTITUDES = ["Technical", "Strategic", "Leadership"];

// No attached Government Engagement module outline exists in this repo —
// SRS §Appendix A anticipates this ("Assumption: seed from the Government
// Engagement module outline; admins refine in-app"), so these are
// plausible placeholders grounded in the domain (district/local government
// engagement), not a literal transcription of source material.
const COMPETENCIES = [
  "Stakeholder Mapping",
  "Policy Analysis",
  "Public Communication",
  "Coalition Building",
  "Regulatory Navigation",
  "Community Consultation",
];

async function ensureRole(name: string) {
  const existing = await db.query.roles.findFirst({ where: eq(roles.name, name) });
  if (existing) return existing;
  const [role] = await db.insert(roles).values({ name }).returning();
  console.log(`  created role: ${name}`);
  return role;
}

async function ensureTerm(taxonomy: string, name: string) {
  const existing = await db.query.terms.findFirst({
    where: and(eq(terms.taxonomy, taxonomy), eq(terms.name, name)),
  });
  if (existing) return existing;
  const [term] = await db.insert(terms).values({ taxonomy, name }).returning();
  console.log(`  created term: [${taxonomy}] ${name}`);
  return term;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env.local");
  }

  console.log("Roles...");
  const fellowRole = await ensureRole("fellow");
  const adminRole = await ensureRole("admin");
  void fellowRole; // not assigned to anyone by the seed itself; signup does that

  console.log("Admin user...");
  let admin = await db.query.users.findFirst({ where: eq(users.email, adminEmail) });
  if (!admin) {
    const passwordHash = await hashPassword(adminPassword);
    [admin] = await db
      .insert(users)
      .values({ email: adminEmail, passwordHash, fullName: "Tanza Admin", status: "active" })
      .returning();
    console.log(`  created admin user: ${adminEmail}`);
  }
  const hasAdminRole = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, admin.id), eq(userRoles.roleId, adminRole.id)),
  });
  if (!hasAdminRole) {
    await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id });
    console.log("  granted admin role");
  }

  console.log("Cohort 1...");
  let cohort = await db.query.cohorts.findFirst({ where: eq(cohorts.name, "Cohort 1") });
  if (!cohort) {
    [cohort] = await db
      .insert(cohorts)
      .values({
        name: "Cohort 1",
        startDate: "2026-09-07",
        enrolOpenAt: "2026-01-01",
        enrolCloseAt: "2026-09-07",
        status: "active",
      })
      .returning();
    console.log(`  created Cohort 1 (starts ${cohort.startDate})`);
  }

  console.log("Terms (aptitudes + competencies)...");
  for (const name of APTITUDES) {
    await ensureTerm("aptitude", name);
  }
  for (const name of COMPETENCIES) {
    await ensureTerm("competency", name);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
