import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { put } from "@vercel/blob";
import { hashPassword } from "../lib/password";
import { parseVideoUrl, resolveThumbnailUrl } from "../lib/video";
import { computeAptitudeScores, type SignalFact } from "../lib/scoring";
import { db } from "./index";
import {
  answers,
  aptitudeScores,
  aptitudeWeights,
  assessmentQuestions,
  assessments,
  blocks,
  classQuestionReplies,
  classQuestions,
  classes,
  cohorts,
  enrollments,
  fileAssets,
  grades,
  journeySteps,
  mediaAssets,
  modules,
  pageVersions,
  pages,
  questionTags,
  questions,
  roles,
  signals,
  submissions,
  terms,
  userRoles,
  users,
  type BlockConfigMap,
} from "./schema";

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

// Mirrors lib/recompute.ts's ALL_TIME_PERIOD constant — kept as a local
// literal rather than imported (see recomputeAllSeeded's doc comment for why
// lib/recompute.ts itself can't be imported here).
const ALL_TIME_PERIOD = "all-time";

// Not a real secret — these are demo history accounts, not production users.
// Printed at the end of the run so whoever seeded the DB can actually log in
// as one of them to show off a fellow dashboard live.
const SEED_FELLOW_PASSWORD = "Fellow123!";

// Class 1's video block needs a real, working YouTube/Vimeo URL (the demo
// script clicks play on it) — provided by the user rather than guessed.
const CLASS1_VIDEO_URL = "https://www.youtube.com/watch?v=iXepENGrmLY";

const CLASS1_WORKSHEET_TEXT = `Stakeholder Mapping Worksheet

1. List every person or group affected by, or able to affect, this policy.
2. For each, rate their INTEREST in the outcome from 1 (none) to 5 (central to their mandate).
3. For each, rate their INFLUENCE over the outcome from 1 (none) to 5 (decisive).
4. Plot each stakeholder on a 5x5 grid: interest on one axis, influence on the other.
5. High-interest, high-influence stakeholders get direct, early engagement. Low-interest,
   low-influence stakeholders get a standing update, not a meeting.
`;

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

async function ensureModule(title: string, position: number) {
  const existing = await db.query.modules.findFirst({ where: eq(modules.title, title) });
  if (existing) return existing;
  const [mod] = await db.insert(modules).values({ title, position, status: "active" }).returning();
  console.log(`  created module: ${title}`);
  return mod;
}

/** Mirrors createClassAction's class+page+draft-v1 bootstrap (admin/curriculum/actions.ts) — a class always owns one page with an open draft. */
async function createClassShell(moduleId: string, title: string, position: number, adminId: string) {
  return db.transaction(async (tx) => {
    const [cls] = await tx.insert(classes).values({ moduleId, title, position, status: "active" }).returning();
    const [page] = await tx.insert(pages).values({ classId: cls.id }).returning();
    const [version] = await tx
      .insert(pageVersions)
      .values({ pageId: page.id, versionNo: 1, createdBy: adminId, publishedAt: null })
      .returning();
    await tx.update(pages).set({ draftVersionId: version.id }).where(eq(pages.id, page.id));
    return { cls, page, draftVersionId: version.id as string };
  });
}

/**
 * Mirrors publish-actions.ts's publishAction (stamp published, clone blocks
 * into a fresh draft v2) but takes an explicit past publishedAt so seeded
 * classes read as real history instead of "published moments ago."
 */
async function publishDraft(pageId: string, draftVersionId: string, adminId: string, publishedAt: Date) {
  await db.transaction(async (tx) => {
    await tx.update(pageVersions).set({ publishedAt }).where(eq(pageVersions.id, draftVersionId));
    await tx.update(pages).set({ publishedVersionId: draftVersionId }).where(eq(pages.id, pageId));

    const existingBlocks = await tx.query.blocks.findMany({ where: eq(blocks.pageVersionId, draftVersionId) });
    const [newDraft] = await tx
      .insert(pageVersions)
      .values({ pageId, versionNo: 2, createdBy: adminId, publishedAt: null })
      .returning();
    if (existingBlocks.length > 0) {
      await tx.insert(blocks).values(
        existingBlocks.map((b) => ({ pageVersionId: newDraft.id, type: b.type, position: b.position, config: b.config }))
      );
    }
    await tx.update(pages).set({ draftVersionId: newDraft.id }).where(eq(pages.id, pageId));
  });
}

async function ensureJourneyStep(
  cohortId: string,
  classId: string,
  position: number,
  releaseAt: Date | null,
  releasedBy: string | null
) {
  const existing = await db.query.journeySteps.findFirst({
    where: and(eq(journeySteps.cohortId, cohortId), eq(journeySteps.classId, classId)),
  });
  if (existing) return existing;
  const [step] = await db.insert(journeySteps).values({ cohortId, classId, position, releaseAt, releasedBy }).returning();
  return step;
}

type QuestionRow = typeof questions.$inferSelect;

async function ensureMCQuestion(opts: {
  body: string;
  options: string[];
  correctIndex: number;
  tagTermId: string;
  weights: Record<string, number>;
}): Promise<QuestionRow> {
  const existing = await db.query.questions.findFirst({ where: eq(questions.body, opts.body) });
  if (existing) return existing;

  const optionRows = opts.options.map((text) => ({ id: randomUUID(), text }));
  const correctOptionId = optionRows[opts.correctIndex].id;
  const [q] = await db
    .insert(questions)
    .values({ type: "mc", body: opts.body, options: optionRows, answerKey: { correctOptionId }, status: "active" })
    .returning();
  await db.insert(questionTags).values({ questionId: q.id, termId: opts.tagTermId });
  await db.insert(aptitudeWeights).values(
    Object.entries(opts.weights).map(([termId, weight]) => ({
      subjectType: "question",
      subjectId: q.id,
      termId,
      weight: String(weight),
    }))
  );
  console.log(`  created MC question: ${opts.body.slice(0, 60)}...`);
  return q;
}

async function ensureShortAnswerQuestion(opts: {
  body: string;
  rubricCriteria: string;
  tagTermId: string;
  weights: Record<string, number>;
}): Promise<QuestionRow> {
  const existing = await db.query.questions.findFirst({ where: eq(questions.body, opts.body) });
  if (existing) return existing;

  const [q] = await db
    .insert(questions)
    .values({ type: "short_answer", body: opts.body, rubric: { criteria: opts.rubricCriteria }, status: "active" })
    .returning();
  await db.insert(questionTags).values({ questionId: q.id, termId: opts.tagTermId });
  await db.insert(aptitudeWeights).values(
    Object.entries(opts.weights).map(([termId, weight]) => ({
      subjectType: "question",
      subjectId: q.id,
      termId,
      weight: String(weight),
    }))
  );
  console.log(`  created short-answer question: ${opts.body.slice(0, 60)}...`);
  return q;
}

async function ensureAssessment(title: string, links: Array<{ questionId: string; points: number }>) {
  const existing = await db.query.assessments.findFirst({ where: eq(assessments.title, title) });
  if (existing) return existing;
  const [a] = await db.insert(assessments).values({ title, settings: { attemptsAllowed: 1 } }).returning();
  await db.insert(assessmentQuestions).values(
    links.map((l, i) => ({ assessmentId: a.id, questionId: l.questionId, position: i + 1, points: String(l.points) }))
  );
  console.log(`  created assessment: ${title}`);
  return a;
}

async function ensureFellow(email: string, fullName: string, fellowRoleId: string, cohortId: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return existing;

  const passwordHash = await hashPassword(SEED_FELLOW_PASSWORD);
  const [fellow] = await db.insert(users).values({ email, passwordHash, fullName, status: "active" }).returning();
  await db.insert(userRoles).values({ userId: fellow.id, roleId: fellowRoleId });
  await db.insert(enrollments).values({ userId: fellow.id, cohortId, assignedBy: "system" });
  console.log(`  created fellow: ${fullName} (${email})`);
  return fellow;
}

type McResult = {
  kind: "mc";
  questionId: string;
  points: number;
  correct: boolean;
  correctOptionId: string;
  wrongOptionId: string;
};
type SAResult = { kind: "sa"; questionId: string; points: number; pct: number; responseText: string; feedback: string };
type QuestionResult = McResult | SAResult;

function correctOptionOf(q: QuestionRow): string {
  return (q.answerKey as { correctOptionId: string }).correctOptionId;
}
function wrongOptionOf(q: QuestionRow): string {
  const opts = q.options as Array<{ id: string; text: string }>;
  const correct = correctOptionOf(q);
  return opts.find((o) => o.id !== correct)!.id;
}
function mcResult(q: QuestionRow, points: number, correct: boolean): McResult {
  return { kind: "mc", questionId: q.id, points, correct, correctOptionId: correctOptionOf(q), wrongOptionId: wrongOptionOf(q) };
}
function saResult(q: QuestionRow, points: number, pct: number, responseText: string, feedback: string): SAResult {
  return { kind: "sa", questionId: q.id, points, pct, responseText, feedback };
}

/**
 * Mirrors submitAssessmentAction + the grading/release path, but writing a
 * whole already-graded-and-released attempt in one go (seed data represents
 * completed history, not something that needs to pass through the AI-draft
 * step — that path is already covered by Stage 4's own tests/manual
 * verification). Guarded by the same idempotency-key uniqueness the real
 * submit flow relies on, so re-running the seed script is a no-op per fellow
 * per assessment.
 */
async function seedFellowAttempt(opts: {
  fellowId: string;
  cohortId: string;
  assessmentId: string;
  adminId: string;
  submittedAt: Date;
  results: QuestionResult[];
}) {
  const idempotencyKey = `seed:${opts.fellowId}:${opts.assessmentId}`;
  const existing = await db.query.submissions.findFirst({ where: eq(submissions.idempotencyKey, idempotencyKey) });
  if (existing) return;

  await db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(submissions)
      .values({
        userId: opts.fellowId,
        cohortId: opts.cohortId,
        subjectType: "assessment",
        subjectId: opts.assessmentId,
        attemptNo: 1,
        idempotencyKey,
        status: "submitted",
        submittedAt: opts.submittedAt,
      })
      .returning();

    for (const r of opts.results) {
      if (r.kind === "mc") {
        const selected = r.correct ? r.correctOptionId : r.wrongOptionId;
        const score = r.correct ? r.points : 0;
        const [answer] = await tx
          .insert(answers)
          .values({
            submissionId: submission.id,
            questionId: r.questionId,
            response: { optionId: selected },
            autoScore: String(score),
          })
          .returning();
        const [grade] = await tx
          .insert(grades)
          .values({
            subjectType: "answer",
            subjectId: answer.id,
            graderId: null,
            source: "auto",
            score: String(score),
            maxScore: String(r.points),
            status: "released",
          })
          .returning();
        await tx.insert(signals).values({
          fellowId: opts.fellowId,
          cohortId: opts.cohortId,
          sourceType: "grade",
          sourceId: grade.id,
          rawScore: String(score),
          maxScore: String(r.points),
          occurredAt: submission.submittedAt,
        });
      } else {
        const score = Math.round(r.points * r.pct * 100) / 100;
        const [answer] = await tx
          .insert(answers)
          .values({ submissionId: submission.id, questionId: r.questionId, response: { text: r.responseText }, autoScore: null })
          .returning();
        const [grade] = await tx
          .insert(grades)
          .values({
            subjectType: "answer",
            subjectId: answer.id,
            graderId: opts.adminId,
            source: "human",
            score: String(score),
            maxScore: String(r.points),
            feedback: r.feedback,
            status: "released",
          })
          .returning();
        await tx.insert(signals).values({
          fellowId: opts.fellowId,
          cohortId: opts.cohortId,
          sourceType: "grade",
          sourceId: grade.id,
          rawScore: String(score),
          maxScore: String(r.points),
          occurredAt: submission.submittedAt,
        });
      }
    }
  });
}

/**
 * lib/recompute.ts starts with `import "server-only"`, which throws when
 * evaluated under a plain `tsx` run (same reason lib/password.ts documents
 * avoiding that guard for this same file) — so this reimplements its
 * resolve-then-write pipeline locally instead of importing it.
 * computeAptitudeScores (lib/scoring.ts) carries no such guard and is
 * imported directly; only the DB-orchestration half (which also transitively
 * needs lib/assessment-location.ts, itself server-only-guarded) is
 * duplicated here — using assessmentModuleId, built locally while seeding
 * the curriculum above, in place of that module's DB scan.
 */
async function recomputeAllSeeded(assessmentModuleId: Map<string, string>) {
  const rows = await db
    .select({
      fellowId: signals.fellowId,
      rawScore: signals.rawScore,
      maxScore: signals.maxScore,
      occurredAt: signals.occurredAt,
      questionId: answers.questionId,
      assessmentId: submissions.subjectId,
      submissionSubjectType: submissions.subjectType,
    })
    .from(signals)
    .innerJoin(grades, eq(grades.id, signals.sourceId))
    .innerJoin(answers, eq(answers.id, grades.subjectId))
    .innerJoin(submissions, eq(submissions.id, answers.submissionId))
    .where(eq(signals.sourceType, "grade"));

  const relevant = rows.filter((r) => r.submissionSubjectType === "assessment");

  const questionIds = [...new Set(relevant.map((r) => r.questionId))];
  const weightRows = questionIds.length
    ? await db.query.aptitudeWeights.findMany({
        where: and(eq(aptitudeWeights.subjectType, "question"), inArray(aptitudeWeights.subjectId, questionIds)),
      })
    : [];
  const weightsByQuestion = new Map<string, Record<string, number>>();
  for (const w of weightRows) {
    const forQuestion = weightsByQuestion.get(w.subjectId) ?? {};
    forQuestion[w.termId] = Number(w.weight);
    weightsByQuestion.set(w.subjectId, forQuestion);
  }

  const byFellow = new Map<string, SignalFact[]>();
  for (const row of relevant) {
    const moduleId = assessmentModuleId.get(row.assessmentId);
    if (!moduleId) continue;
    const fact: SignalFact = {
      dedupeKey: `${row.assessmentId}:${row.questionId}`,
      rawScore: Number(row.rawScore),
      maxScore: Number(row.maxScore),
      occurredAt: row.occurredAt,
      periodKeys: [moduleId, ALL_TIME_PERIOD],
      weights: weightsByQuestion.get(row.questionId) ?? {},
    };
    const forFellow = byFellow.get(row.fellowId) ?? [];
    forFellow.push(fact);
    byFellow.set(row.fellowId, forFellow);
  }

  for (const [fellowId, facts] of byFellow) {
    const results = computeAptitudeScores(facts);
    await db.transaction(async (tx) => {
      await tx.delete(aptitudeScores).where(eq(aptitudeScores.fellowId, fellowId));
      if (results.length > 0) {
        await tx
          .insert(aptitudeScores)
          .values(results.map((r) => ({ fellowId, termId: r.termId, periodKey: r.periodKey, score: String(r.score) })));
      }
    });
  }
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
  const aptitudeTermByName = new Map<string, string>();
  for (const name of APTITUDES) {
    const term = await ensureTerm("aptitude", name);
    aptitudeTermByName.set(name, term.id);
  }
  const competencyTermByName = new Map<string, string>();
  for (const name of COMPETENCIES) {
    const term = await ensureTerm("competency", name);
    competencyTermByName.set(name, term.id);
  }
  function weightsFor(technical: number, strategic: number, leadership: number): Record<string, number> {
    return {
      [aptitudeTermByName.get("Technical")!]: technical,
      [aptitudeTermByName.get("Strategic")!]: strategic,
      [aptitudeTermByName.get("Leadership")!]: leadership,
    };
  }

  // --- Government Engagement module ---

  console.log("Government Engagement module...");
  const govModule = await ensureModule("Government Engagement", 1);
  const assessmentModuleId = new Map<string, string>();

  console.log("Class 1 questions + assessment...");
  const stakeholderMapping = competencyTermByName.get("Stakeholder Mapping")!;
  const coalitionBuilding = competencyTermByName.get("Coalition Building")!;
  const communityConsultation = competencyTermByName.get("Community Consultation")!;

  const q1 = await ensureMCQuestion({
    body: "A newly proposed water-rights regulation affects three groups: the Ministry of Water, a coalition of 200 smallholder farmers, and a private irrigation company that supplies half the district. You have time to meet with only one group before the first public hearing. Which factor should weigh most heavily in deciding who to meet first?",
    options: [
      "Whichever group is easiest to schedule a meeting with",
      "Whichever group has the highest combined interest and influence over the regulation's outcome",
      "Whichever group has publicly supported similar regulations before",
      "Whichever group is mentioned first in the regulation's draft text",
    ],
    correctIndex: 1,
    tagTermId: stakeholderMapping,
    weights: weightsFor(40, 35, 25),
  });
  const q2 = await ensureMCQuestion({
    body: "You've mapped a stakeholder as high-interest but low-influence on an upcoming policy decision. What is the most appropriate engagement approach?",
    options: [
      "Ignore them — low influence means they can't affect the outcome",
      "Give them a seat on the decision-making committee",
      "Keep them informed and give them a channel to raise concerns, without over-investing meeting time",
      "Delay the policy until their influence increases",
    ],
    correctIndex: 2,
    tagTermId: stakeholderMapping,
    weights: weightsFor(55, 30, 15),
  });
  const q3 = await ensureShortAnswerQuestion({
    body: "Three stakeholder groups — a farmers' cooperative, a private water utility, and a district environmental office — have competing interests in a new irrigation policy. Describe, in 3-5 sentences, how you would build a coalition among them that lets the policy move forward.",
    rubricCriteria:
      "Look for: (1) identifies each group's underlying interest, not just stated position; (2) proposes a concrete shared-interest framing or trade-off, not just 'get everyone in a room'; (3) sequences engagement sensibly rather than treating all three identically.",
    tagTermId: coalitionBuilding,
    weights: weightsFor(10, 50, 40),
  });
  const q4 = await ensureShortAnswerQuestion({
    body: "A community consultation meeting has turned contentious — several attendees are angry about a proposed zoning change and are talking over the facilitator. What would you do in the room, and what would you follow up with afterward?",
    rubricCriteria:
      "Look for: (1) a concrete in-the-room de-escalation step, not just 'stay calm'; (2) acknowledgment of the underlying grievance rather than dismissing it; (3) a specific, credible follow-up action (not just 'send a summary email').",
    tagTermId: communityConsultation,
    weights: weightsFor(15, 30, 55),
  });
  const assessment1 = await ensureAssessment("Stakeholder Landscape Assessment", [
    { questionId: q1.id, points: 25 },
    { questionId: q2.id, points: 25 },
    { questionId: q3.id, points: 25 },
    { questionId: q4.id, points: 25 },
  ]);
  assessmentModuleId.set(assessment1.id, govModule.id);

  console.log("Class 2 questions + assessment...");
  const publicCommunication = competencyTermByName.get("Public Communication")!;
  const regulatoryNavigation = competencyTermByName.get("Regulatory Navigation")!;

  const q5 = await ensureMCQuestion({
    body: "You need to announce a change to a business permitting fee to local shop owners, most of whom have no legal background. Which opening line is most effective?",
    options: [
      "Pursuant to Regulation 14(b), permit fee schedules are hereby amended effective the next fiscal quarter.",
      "Starting next quarter, your shop permit will cost 5,000 shillings less — here's what changes and when.",
      "The district council has approved amendments to the fee structure as outlined in the attached 12-page document.",
      "Please note that administrative changes affecting your permit status will take effect at a future date.",
    ],
    correctIndex: 1,
    tagTermId: publicCommunication,
    weights: weightsFor(30, 30, 40),
  });
  const q6 = await ensureMCQuestion({
    body: "A new regulation conflicts with an older bylaw that's technically still on the books but no longer enforced. What's the right first step?",
    options: [
      "Ignore the old bylaw since it isn't enforced",
      "Formally confirm which rule takes precedence (or repeal the old one) before communicating the change publicly",
      "Let affected businesses decide which rule to follow",
      "Delay the new regulation indefinitely until someone complains",
    ],
    correctIndex: 1,
    tagTermId: regulatoryNavigation,
    weights: weightsFor(60, 25, 15),
  });
  const q7 = await ensureShortAnswerQuestion({
    body: "In under 150 words, summarize this regulatory change for a non-technical audience: 'Effective Q3, all micro-enterprises with fewer than 5 employees are reclassified from Category B to Category C licensing, reducing annual compliance filings from quarterly to annually.' Write the summary you'd actually publish.",
    rubricCriteria:
      "Look for: (1) leads with the concrete benefit/impact (fewer filings), not the classification jargon; (2) states who it applies to in plain terms; (3) stays under or near the word limit; (4) no unexplained jargon (Category B/C should be translated or dropped).",
    tagTermId: publicCommunication,
    weights: weightsFor(20, 30, 50),
  });
  const assessment2 = await ensureAssessment("Policy Communication Basics", [
    { questionId: q5.id, points: 40 },
    { questionId: q6.id, points: 30 },
    { questionId: q7.id, points: 30 },
  ]);
  assessmentModuleId.set(assessment2.id, govModule.id);

  console.log("Class 1: Stakeholder Mapping Fundamentals...");
  let class1 = await db.query.classes.findFirst({
    where: and(eq(classes.moduleId, govModule.id), eq(classes.title, "Stakeholder Mapping Fundamentals")),
  });
  let class1Id: string;
  if (!class1) {
    if (!CLASS1_VIDEO_URL) {
      throw new Error("Set CLASS1_VIDEO_URL in src/db/seed.ts before running the seed script.");
    }
    const { cls, page, draftVersionId } = await createClassShell(
      govModule.id,
      "Stakeholder Mapping Fundamentals",
      1,
      admin.id
    );
    class1Id = cls.id;

    await db.insert(blocks).values({
      pageVersionId: draftVersionId,
      type: "rich_text",
      position: 1,
      config: {
        doc: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why stakeholder mapping comes first" }] },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Every policy conversation involves people who can help or block progress before a single meeting is scheduled. This class introduces a simple framework for identifying who those people are, what they care about, and how much influence they actually hold.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "By the end of this class you should be able to place any stakeholder on a two-axis map — interest versus influence — and use that placement to decide how much time and what kind of engagement they're worth.",
                },
              ],
            },
          ],
        },
      } satisfies BlockConfigMap["rich_text"],
    });

    const parsedVideo = parseVideoUrl(CLASS1_VIDEO_URL);
    if (!parsedVideo) throw new Error(`CLASS1_VIDEO_URL isn't a parseable YouTube/Vimeo URL: ${CLASS1_VIDEO_URL}`);
    const thumbnailUrl = await resolveThumbnailUrl(parsedVideo.provider, parsedVideo.providerRef);
    const [mediaAsset] = await db
      .insert(mediaAssets)
      .values({ provider: parsedVideo.provider, providerRef: parsedVideo.providerRef, status: "ready", thumbnailUrl })
      .returning();
    await db.insert(blocks).values({
      pageVersionId: draftVersionId,
      type: "video",
      position: 2,
      config: { mediaAssetId: mediaAsset.id, caption: "Stakeholder mapping in five minutes" } satisfies BlockConfigMap["video"],
    });

    try {
      const uploaded = await put("seed/stakeholder-mapping-worksheet.txt", CLASS1_WORKSHEET_TEXT, {
        access: "private",
        contentType: "text/plain",
      });
      const [fileAsset] = await db
        .insert(fileAssets)
        .values({
          storageKey: uploaded.pathname,
          filename: "Stakeholder Mapping Worksheet.txt",
          mimeType: "text/plain",
          sizeBytes: Buffer.byteLength(CLASS1_WORKSHEET_TEXT),
        })
        .returning();
      await db.insert(blocks).values({
        pageVersionId: draftVersionId,
        type: "resource_list",
        position: 3,
        config: {
          items: [{ fileAssetId: fileAsset.id, label: "Stakeholder Mapping Worksheet" }],
        } satisfies BlockConfigMap["resource_list"],
      });
    } catch (err) {
      console.warn("  couldn't upload the class 1 worksheet to Blob storage — skipping the resource_list block.", err);
    }

    await db.insert(blocks).values({
      pageVersionId: draftVersionId,
      type: "assessment",
      position: 4,
      config: { assessmentId: assessment1.id } satisfies BlockConfigMap["assessment"],
    });

    await publishDraft(page.id, draftVersionId, admin.id, new Date("2026-06-10T09:00:00Z"));
  } else {
    class1Id = class1.id;
  }

  console.log("Class 2: Communicating Policy Change...");
  let class2 = await db.query.classes.findFirst({
    where: and(eq(classes.moduleId, govModule.id), eq(classes.title, "Communicating Policy Change")),
  });
  let class2Id: string;
  if (!class2) {
    const { cls, page, draftVersionId } = await createClassShell(govModule.id, "Communicating Policy Change", 2, admin.id);
    class2Id = cls.id;
    await db.insert(blocks).values([
      {
        pageVersionId: draftVersionId,
        type: "rich_text",
        position: 1,
        config: {
          doc: {
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Translate before you publish" }] },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Even a well-designed policy fails if the people affected by it can't understand what's changing and why. This class covers how to translate technical or legal language into something a general audience will actually read.",
                  },
                ],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "It also covers a narrower, related skill: what to do when a new regulation conflicts with something already on the books, and how to resolve that before you communicate anything publicly.",
                  },
                ],
              },
            ],
          },
        } satisfies BlockConfigMap["rich_text"],
      },
      {
        pageVersionId: draftVersionId,
        type: "assessment",
        position: 2,
        config: { assessmentId: assessment2.id } satisfies BlockConfigMap["assessment"],
      },
    ]);
    await publishDraft(page.id, draftVersionId, admin.id, new Date("2026-06-20T09:00:00Z"));
  } else {
    class2Id = class2.id;
  }

  console.log("Class 3: Regulatory Navigation in Practice (locked)...");
  let class3 = await db.query.classes.findFirst({
    where: and(eq(classes.moduleId, govModule.id), eq(classes.title, "Regulatory Navigation in Practice")),
  });
  let class3Id: string;
  if (!class3) {
    const { cls, page, draftVersionId } = await createClassShell(
      govModule.id,
      "Regulatory Navigation in Practice",
      3,
      admin.id
    );
    class3Id = cls.id;
    await db.insert(blocks).values({
      pageVersionId: draftVersionId,
      type: "rich_text",
      position: 1,
      config: {
        doc: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Coming up" }] },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This class builds on Communicating Policy Change with real district-level case examples. It unlocks once Communicating Policy Change is complete for the cohort.",
                },
              ],
            },
          ],
        },
      } satisfies BlockConfigMap["rich_text"],
    });
    await publishDraft(page.id, draftVersionId, admin.id, new Date("2026-07-01T09:00:00Z"));
  } else {
    class3Id = class3.id;
  }

  console.log("Journey steps...");
  await ensureJourneyStep(cohort.id, class1Id, govModule.position * 1000 + 1, new Date("2026-06-12T09:00:00Z"), admin.id);
  await ensureJourneyStep(cohort.id, class2Id, govModule.position * 1000 + 2, new Date("2026-06-22T09:00:00Z"), admin.id);
  // Future release_at — locked for fellows, matching implementation-plan.md's Stage 5 spec.
  await ensureJourneyStep(cohort.id, class3Id, govModule.position * 1000 + 3, new Date("2026-08-15T09:00:00Z"), admin.id);

  console.log("Fellows...");
  const fellowDefs = [
    { email: "amina.juma@example.com", fullName: "Amina Juma" },
    { email: "neema.mushi@example.com", fullName: "Neema Mushi" },
    { email: "joseph.mrema@example.com", fullName: "Joseph Mrema" },
    { email: "grace.kimaro@example.com", fullName: "Grace Kimaro" },
  ];
  const fellowIdByName = new Map<string, string>();
  for (const def of fellowDefs) {
    const fellow = await ensureFellow(def.email, def.fullName, fellowRole.id, cohort.id);
    fellowIdByName.set(def.fullName, fellow.id);
  }
  console.log(`  seeded fellows can log in with password: ${SEED_FELLOW_PASSWORD}`);

  console.log("Class Q&A threads...");
  const existingThread = await db.query.classQuestions.findFirst({ where: eq(classQuestions.classId, class1Id) });
  if (!existingThread) {
    const aminaId = fellowIdByName.get("Amina Juma")!;
    const josephId = fellowIdByName.get("Joseph Mrema")!;
    const neemaId = fellowIdByName.get("Neema Mushi")!;

    const [thread1] = await db
      .insert(classQuestions)
      .values({
        classId: class1Id,
        cohortId: cohort.id,
        authorId: aminaId,
        body: "For the interest/influence grid in question 1 — if a stakeholder's influence is hard to estimate because they're a new coalition, how do we rate them?",
        status: "visible",
        createdAt: new Date("2026-06-13T10:00:00Z"),
      })
      .returning();
    await db.insert(classQuestionReplies).values({
      questionId: thread1.id,
      authorId: admin.id,
      body: "Good catch — for a new or unproven group, rate influence based on what they could mobilize (membership size, media reach, relationships to decision-makers) rather than track record. Treat the rating as provisional and revisit it after your first engagement.",
      status: "visible",
      createdAt: new Date("2026-06-13T15:30:00Z"),
    });

    const [thread2] = await db
      .insert(classQuestions)
      .values({
        classId: class1Id,
        cohortId: cohort.id,
        authorId: josephId,
        body: "Is the worksheet meant to be redone for every new policy, or does one stakeholder map carry across a whole module?",
        status: "visible",
        createdAt: new Date("2026-06-14T09:15:00Z"),
      })
      .returning();
    await db.insert(classQuestionReplies).values({
      questionId: thread2.id,
      authorId: admin.id,
      body: "Redo it per policy — the same person can be high-influence on water rights and low-influence on education spending, so a single static map won't hold up.",
      status: "visible",
      createdAt: new Date("2026-06-14T11:00:00Z"),
    });

    await db.insert(classQuestions).values({
      classId: class1Id,
      cohortId: cohort.id,
      authorId: neemaId,
      body: "Does 'influence' include informal influence, like a respected elder who holds no official position?",
      status: "visible",
      createdAt: new Date("2026-06-16T08:45:00Z"),
    });
    console.log("  created 3 Q&A threads on class 1");
  }

  console.log("Submission history...");
  const aminaId = fellowIdByName.get("Amina Juma")!;
  const graceId = fellowIdByName.get("Grace Kimaro")!;
  const neemaId = fellowIdByName.get("Neema Mushi")!;
  const josephId = fellowIdByName.get("Joseph Mrema")!;

  // Every question is weighted across all three aptitudes (not concentrated
  // on one), so every fellow's per-aptitude signal count clears
  // MIN_SIGNALS_FOR_FLAG (5, in admin/page.tsx) from these 7 questions alone.
  // Each fellow's raw scores are drawn from a tight, deliberately-chosen band
  // so the resulting weighted aptitude average — a convex combination of
  // those same values — is guaranteed to land in the intended range
  // regardless of the exact per-question weight split above:
  //   Amina:  worst eligible aptitude < 50  -> "needs support" flag
  //   Grace:  best eligible aptitude >= 85   -> "exceptional" flag
  //   Neema/Joseph: safely inside (50, 85) on every aptitude -> unflagged,
  //   distinguishable mid-range profiles.

  await seedFellowAttempt({
    fellowId: aminaId,
    cohortId: cohort.id,
    assessmentId: assessment1.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-15T09:10:00Z"),
    results: [
      mcResult(q1, 25, true),
      mcResult(q2, 25, false),
      saResult(
        q3,
        25,
        0.32,
        "I would get the farmers, the water utility, and the environmental office together in a meeting and explain the policy to all of them so they understand it. Then I would ask if they have any concerns and try to address them so everyone is happy with the outcome.",
        "Doesn't yet separate each group's underlying interest from their stated position, and 'get everyone in a room' isn't a coalition strategy on its own — revisit the rubric's first two criteria."
      ),
      saResult(
        q4,
        25,
        0.3,
        "I would ask everyone to calm down and wait for their turn to speak. After the meeting I would send a summary of what was discussed to everyone who attended.",
        "The follow-up here is exactly the generic email the rubric flags — try naming the specific grievance in the room and committing to a concrete next step."
      ),
    ],
  });
  await seedFellowAttempt({
    fellowId: aminaId,
    cohortId: cohort.id,
    assessmentId: assessment2.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-25T09:40:00Z"),
    results: [
      mcResult(q5, 40, false),
      mcResult(q6, 30, false),
      saResult(
        q7,
        30,
        0.35,
        "There is a change to licensing for small businesses. Micro-enterprises with under 5 employees are now Category C instead of Category B. This means the filing requirement changes from quarterly to annual, which happens starting Q3.",
        "Still opens with the classification jargon (Category B/C) instead of the actual benefit to the reader — lead with what changes for them, not the internal label."
      ),
    ],
  });

  await seedFellowAttempt({
    fellowId: graceId,
    cohortId: cohort.id,
    assessmentId: assessment1.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-15T14:20:00Z"),
    results: [
      mcResult(q1, 25, true),
      mcResult(q2, 25, true),
      saResult(
        q3,
        25,
        0.92,
        "The cooperative's real interest is predictable water access during planting, not water volume in the abstract; the utility's is protecting the revenue certainty in its supply contracts; the environmental office's is a defensible, measurable conservation outcome for its own reporting. I'd frame the policy as a seasonal allocation band that gives the cooperative a guaranteed minimum, lets the utility price its contracts against that same band, and gives the environmental office a monitoring clause tied to river-level thresholds — a trade-off all three can point to as a win on their own terms. I'd sequence this by meeting the cooperative and utility jointly first, since they have the most direct conflict, and bring the environmental office in once a draft allocation exists for them to react to rather than build from scratch.",
        "Precise on each group's underlying interest and a genuinely concrete shared mechanism, well sequenced — strong answer."
      ),
      saResult(
        q4,
        25,
        0.95,
        "In the room, I'd pause the agenda immediately, name what's happening — 'I can see this zoning change feels like it threatens people's homes, and that's a legitimate thing to be upset about' — and open the floor to two or three specific concerns before restoring the agenda, rather than asking people to simply quiet down. Afterward, I'd follow up individually with anyone who raised a concrete issue within 48 hours, not with a general summary email, and give them a specific date by which the district will respond to their concern in writing.",
        "Names the grievance directly, de-escalates concretely, and commits to a specific timeline — exactly what the rubric is looking for."
      ),
    ],
  });
  await seedFellowAttempt({
    fellowId: graceId,
    cohortId: cohort.id,
    assessmentId: assessment2.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-25T14:05:00Z"),
    results: [
      mcResult(q5, 40, true),
      mcResult(q6, 30, true),
      saResult(
        q7,
        30,
        0.9,
        "Good news if you run a small business: starting in Q3, businesses with fewer than 5 employees will only need to file license paperwork once a year instead of four times. You're being moved into a simpler license category — nothing about what your license covers is changing, just how often you file.",
        "Leads with the benefit, fully plain-language, and stays tight — publish-ready."
      ),
    ],
  });

  await seedFellowAttempt({
    fellowId: neemaId,
    cohortId: cohort.id,
    assessmentId: assessment1.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-16T10:05:00Z"),
    results: [
      mcResult(q1, 25, true),
      mcResult(q2, 25, true),
      saResult(
        q3,
        25,
        0.68,
        "The cooperative mainly wants predictable water access for planting season, the utility wants to protect its supply contracts, and the environmental office wants measurable conservation outcomes it can report on. I'd frame the policy around a shared seasonal allocation schedule that gives the cooperative predictability, lets the utility model its contracts around fixed bands, and gives the environmental office a monitoring role — then bring the utility and cooperative together first since they have the most at stake, and loop in the environmental office once the allocation shape is agreed.",
        "Good identification of each group's real interest and a workable shared framing — could be tightened, but hits the rubric cleanly."
      ),
      saResult(
        q4,
        25,
        0.72,
        "I'd pause the agenda, acknowledge directly that the zoning change affects people's homes and that the frustration is legitimate, and offer two or three attendees a chance to state their specific concern before continuing. Afterward I'd follow up individually with whoever raised a concrete issue, not just a group email, and commit to a date by which they'll hear back.",
        "Solid de-escalation and a real follow-up commitment — nice work."
      ),
    ],
  });
  await seedFellowAttempt({
    fellowId: neemaId,
    cohortId: cohort.id,
    assessmentId: assessment2.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-26T10:15:00Z"),
    results: [
      mcResult(q5, 40, true),
      mcResult(q6, 30, false),
      saResult(
        q7,
        30,
        0.65,
        "Good news for small businesses: starting in Q3, if you have fewer than 5 employees, you'll only need to file your license paperwork once a year instead of every quarter. You're being moved to a simpler licensing category — less paperwork, same license.",
        "Leads with the benefit and stays plain-language — 'simpler licensing category' could be a touch more concrete about what changed."
      ),
    ],
  });

  await seedFellowAttempt({
    fellowId: josephId,
    cohortId: cohort.id,
    assessmentId: assessment1.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-17T11:30:00Z"),
    results: [
      mcResult(q1, 25, true),
      mcResult(q2, 25, true),
      saResult(
        q3,
        25,
        0.62,
        "Each group has different interests — the cooperative needs reliable water for their crops, the utility needs to keep its contracts viable, and the environmental office needs to show conservation results. I'd propose a compromise allocation that gives each group something measurable, and meet with the two groups most affected — the cooperative and the utility — before bringing in the environmental office.",
        "Correctly separates each group's interest and proposes a sensible compromise; the shared-interest framing could be more concrete about the trade-off itself."
      ),
      saResult(
        q4,
        25,
        0.65,
        "I'd stop and acknowledge that people are upset about a real issue — their homes and property — before trying to restore order. Once the room settles, I'd invite a couple of specific concerns to be voiced. Afterward I'd follow up with those individuals directly rather than a general notice.",
        "Good acknowledgment of the grievance and a real individual follow-up — solid response."
      ),
    ],
  });
  await seedFellowAttempt({
    fellowId: josephId,
    cohortId: cohort.id,
    assessmentId: assessment2.id,
    adminId: admin.id,
    submittedAt: new Date("2026-06-27T11:50:00Z"),
    results: [
      mcResult(q5, 40, false),
      mcResult(q6, 30, false),
      saResult(
        q7,
        30,
        0.62,
        "Starting in Q3, small businesses with fewer than 5 employees move to a new licensing category that only requires filing once a year instead of four times. That means less paperwork for you, with no change to what your license covers.",
        "Clear and benefit-led — reads well for a non-technical audience."
      ),
    ],
  });

  console.log("Recomputing aptitude scores...");
  await recomputeAllSeeded(assessmentModuleId);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
