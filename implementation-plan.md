# Implementation Working Plan — Tanza Fellowship Hub Beta

| | |
|---|---|
| **Version** | 1.2 |
| **Date** | 8 July 2026 |
| **Audience** | Implementing agent/developer. This document is self-contained; read §1–§3 before writing any code. |
| **Companions** | SRS-tanza-fellowship-hub-beta.md (requirements) · data-model.md (schema — source of truth) · build-plan.md (prioritisation rationale) |

---

## 1. Context (read first)

**Product:** Tanza Fellowship Hub — beta learning platform for Phase 1 (Classroom Learning) of the Tanza Fellowship in Tanzania. First cohort launches September 2026. Two roles: **Fellows** (learners, ~20–50, primarily on laptops, often poor connectivity) and **Admins** (Tanza Leadership, <10).

**The demo path is the product.** Everything must serve this end-to-end story:
admin creates a class in a module → composes the page from blocks → previews it exactly as a fellow → publishes → releases to cohort → fellow self-signs up (auto-assigned to cohort) → opens class → posts a question in the class Q&A, admin replies (badged) → completes assessment (MC auto-scored, short answer queued) → AI drafts the short-answer grade → admin edits/approves/releases → fellow sees feedback → both dashboards update → admin re-weights an aptitude → scores recompute.

**Locked decisions — do not re-litigate or "improve":**
1. Block-based pages with draft → preview → publish via `page_versions` (two pointers on `pages`).
2. Append-only `signals` ledger → derived, rebuildable `aptitude_scores`. Weights resolved at compute time, never snapshotted. See data-model.md §5 — implement it exactly.
3. Polymorphic `aptitude_weights` table (one row per item × aptitude), single reusable weights-editor component.
4. Merged `journey_steps` (per-cohort ordering + `release_at`; null = locked).
5. Block content refs live inside `config` jsonb (typed via discriminated union), not FK columns.
6. Single `terms` vocabulary table with `taxonomy` column.
7. Self-signup, no approval; cohort auto-assignment by sign-up date within enrolment window; admin override.
8. AI output is never fellow-visible without admin approval (grade status machine enforces this).
9. English only, no i18n scaffolding. Desktop-first UI; responsive fallback is enough. Cohort 1 connectivity is strong and stable (confirmed 8 Jul 2026): **prioritise UX quality** — polished empty/pending/error states, no layout shift. Keep low-bandwidth patterns (SSR-first, lazy media, no video preload) as defaults, but payload budgets are tracked targets, not acceptance gates.
10. Video = provider-agnostic block; **embed providers only** in this build (managed streaming is post-beta).
11. Class Q&A attaches to `classes` (never to `page_versions`, never a block type); cohort-scoped visibility; flat single-level replies; admin replies badged; admin soft-hide; **no signals from Q&A activity**.

**Scope discipline:** if a task isn't in a stage below, it's out of scope. The "do not build" list is in §8. When genuinely blocked (missing secret, ambiguous requirement with no default given here), stop and ask rather than inventing.

## 2. Stack and conventions

- **Framework:** Next.js (App Router) + TypeScript strict. React Server Components by default; client components only where interactivity demands (builder, forms, dashboards' interactive bits).
- **UI:** Tailwind + shadcn/ui. Screen layouts per §7 — implement those, don't redesign.
- **DB:** PostgreSQL (Neon) + Drizzle ORM. Schema transcribed from data-model.md §1–§4 exactly (snake_case tables/columns as written there). Migrations via `drizzle-kit generate`, committed as SQL.
- **Auth:** email + password (argon2/bcrypt via a maintained lib, e.g. better-auth or equivalent), session cookies. No email verification, no password reset in this build.
- **Mutations:** server actions with zod validation. Authorisation enforced server-side in every action/loader (role + cohort scoping) — never trust the client.
- **AI:** Anthropic API (`claude-sonnet-5` for grading drafts). All AI calls in one module (`lib/ai.ts`) with a hard timeout and typed JSON output; every AI feature has a manual fallback path.
- **Hosting:** Vercel + Neon. Deploy from Stage 0 onward; every stage ends deployed.
- **Env vars (`.env.local`, ask the user for values when first needed):** `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- **Testing policy:** unit tests are required ONLY for the aggregation/recompute module (Stage 4 lists the cases) plus `tsc --noEmit` clean at every stage end. No e2e framework — Stage 5's manual checklist covers the demo path.
- **Commits:** small, per feature, imperative mood. Never commit secrets.

**Route map (build to this):**

| Route | Role | Purpose |
|---|---|---|
| `/signup`, `/login` | public | Auth (self-signup → cohort auto-assign) |
| `/learn` | fellow | Journey: modules → classes with locked/released states |
| `/learn/class/[classId]` | fellow | Rendered published page (blocks in order) |
| `/learn/class/[classId]/assessment` | fellow | Take assessment; results/feedback view |
| `/me` | fellow | Dashboard + previous coursework list |
| `/admin` | admin | Cohort dashboard |
| `/admin/curriculum` | admin | Modules/classes tree, create/reorder/release |
| `/admin/curriculum/class/[classId]` | admin | Block builder (+ preview mode) |
| `/admin/assessments/[assessmentId]` | admin | Assessment editor |
| `/admin/grading` | admin | Grading queue → grade detail |
| `/admin/cohorts` | admin | Cohorts, enrolment windows, member override |

## 3. Stage overview

| Stage | Name | Demo-path outcome |
|---|---|---|
| 0 | Scaffold + deploy | Empty app live on a URL |
| 1 | Schema, auth, cohorts | Sign-up lands a fellow in a cohort |
| 2 | Curriculum, builder, assessment editor | Admin can author and publish a class |
| 3 | Fellow experience | Fellow can learn and submit |
| 4 | Grading, signals, dashboards | Scores flow end to end |
| 5 | Seed + production hardening | Demo path passes on production with rich data |
| 6 | Stretch tiers (in order) | Only after Stage 5 passes |
| 7 | Handover artifacts | README + demo checklist |

Stages run strictly in order; a stage is complete only when every acceptance criterion (AC) passes and the work is committed and deployed.

---

## 4. Stages 0–2 (foundation and authoring)

### Stage 0 — Scaffold + deploy
Tasks: create Next.js + TS + Tailwind + shadcn/ui + Drizzle project; health route `/api/health`; Vercel project + Neon database wired; README stub with run instructions.

**AC-0:**
- [ ] `npm run dev` boots locally; `npm run build` and `tsc --noEmit` pass.
- [ ] Production URL serves the app; `/api/health` returns 200 with `{ ok: true }`.
- [ ] Drizzle connects to Neon (a trivial query runs in the health route).

### Stage 1 — Schema, auth, cohorts
Tasks: transcribe the full schema from data-model.md §1–§4 into Drizzle (ALL tables, including those without UI yet: observations, peer reviews, signals, aptitude_scores, audit_log); generate + apply migration; `db/seed.ts` skeleton (admin user from env, "Cohort 1" with start 2026-09-07 and an open enrolment window, `terms` rows: 3 aptitudes + ~6 competencies from the Government Engagement domain); signup/login/logout; cohort auto-assignment on signup (next cohort whose enrolment window covers now); RBAC middleware (fellow vs admin route guards); `/admin/cohorts` with member list + cohort reassignment (records `assigned_by`).

**AC-1:**
- [ ] One migration file creates every table in data-model.md; unique constraints exist on `submissions.idempotency_key` and `signals (source_type, source_id)` (verify in the SQL).
- [ ] Sign-up with a fresh email → logged in as fellow → `enrollments` row in Cohort 1 with `assigned_by = 'system'`.
- [ ] Sign-up when no cohort window matches → clear error state, no orphan user-without-enrollment.
- [ ] Fellow visiting any `/admin/*` route gets 403/redirect (server-side, test via curl with fellow session).
- [ ] Admin (seeded from env) can log in and reassign a fellow to another cohort; `assigned_by = 'admin'`.
- [ ] Passwords stored hashed (inspect row); session cookie is httpOnly + secure.

### Stage 2 — Curriculum, block builder, assessment editor
Tasks: modules/classes CRUD with up/down ordering; auto-create `pages` + draft `page_versions` v1 on class creation; block builder per §7.1 (four block types: `rich_text` — TipTap storing ProseMirror JSON; `video` — provider select [youtube|vimeo] + URL parsed to `media_assets` row; `resource_list` — file upload to Vercel Blob or S3-compatible store → `file_assets`, plus external links; `assessment` — creates/links assessment + jump to editor); autosave to draft; **preview-as-fellow** (renders draft version through the same renderer Stage 3 uses); **publish** as one transaction (stamp `published_at`, swap `pages.published_version_id`, clone blocks to new draft); version list + restore; release toggle per cohort on `journey_steps` (manual release now; `release_at` date optional); assessment editor per §7.2 (MC + short answer, tags from `terms`, per-question `aptitude_weights` rows with sum=100 validation, attempts setting, live weights rollup; **lock editing once submissions exist** with "duplicate to edit").

**AC-2:**
- [ ] Admin creates module + class; adds all four block types; reorders with up/down; deletes one; autosave persists across reload.
- [ ] Preview shows the draft exactly as the fellow renderer will (same component, verified by shared import, not a copy).
- [ ] Publish → fellow-facing query returns v1 while the admin's builder now edits draft v2; a second publish creates v2-published + v3-draft. Restore of v1 makes it the new draft without deleting history (verify `page_versions` rows).
- [ ] Publish is atomic: induced mid-transaction failure (e.g. throw in test) leaves the published pointer unchanged.
- [ ] Rich text is stored as ProseMirror JSON in `blocks.config` (inspect row), never HTML.
- [ ] Assessment editor: saving a question whose weights ≠ 100% is rejected with a field error; rollup bar recomputes from per-question weights × points.
- [ ] With one submission inserted (SQL is fine), the editor renders read-only with a working "duplicate to edit" that clones assessment + questions + weights.
- [ ] A class with no `journey_steps` release row (or future `release_at`) is absent/locked for fellows.

## 5. Stages 3–5 (learning, scoring, hardening)

### Stage 3 — Fellow experience
Tasks: `/learn` journey (modules → classes, locked/released states, "continue" affordance); class page per §7.3 — server-rendered blocks in order, video as poster + click-to-load embed (no iframe until click), resources with size labels, assessment launcher with status; assessment taking: MC + short answer forms, client-generated `idempotency_key`, single-attempt enforcement (respect `settings`); on submit: MC auto-scored → `grades` rows (`source='auto'`, `status='released'`), short answers → `grades` row (`status='draft'`) into the queue; `/me` coursework list (submissions, scores, released feedback); **class Q&A** per §7.3 — `class_questions` + `class_question_replies` (data-model §2.2), post/reply forms (plain text), cohort-scoped listing, admin reply badge, admin soft-hide + author delete-own.

**AC-3:**
- [ ] Direct URL to a locked class returns 404/403 for fellows (server-side; curl test).
- [ ] Class page initial HTML contains no video iframe; the embed loads only after click.
- [ ] `next build` first-load JS for `/learn/class/[classId]` recorded in the stage notes; ≤ 200 KB gzipped is the tracked target (non-blocking — cohort 1 connectivity is strong; keep SSR-first and lazy media regardless).
- [ ] Submitting an assessment twice (double-click / replayed request with same idempotency key) yields exactly one `submissions` row.
- [ ] MC answers auto-grade instantly and correctly (spot-check against `answer_key`); short answer appears in the admin queue as draft.
- [ ] A fellow cannot fetch another fellow's submission or feedback by ID manipulation (authz test with two fellow accounts).
- [ ] After grading (Stage 4), `/me` shows score + feedback only once grade status is `released`.
- [ ] Q&A: fellow A posts a question → visible to fellow B (same cohort) and to the admin; not visible to a fellow enrolled in a different cohort (create one via SQL to test).
- [ ] Q&A: admin reply renders with a Tanza badge; fellow replies don't.
- [ ] Q&A: threads survive a page publish (post → republish the page → thread unchanged).
- [ ] Q&A: admin-hidden question disappears for fellows but shows flagged for admins; author can delete their own post.
- [ ] Q&A: posting to a locked class is rejected server-side; no `signals` rows are ever created by Q&A actions.

### Stage 4 — Grading, signals, performance
Tasks: `/admin/grading` queue (pending short answers + case-study placeholder ignored); grade detail: fellow answer + rubric + score/feedback form; **"Draft with AI"** button → `lib/ai.ts` call (input: question, rubric, max points, fellow answer → strict JSON `{score, feedback}`), result populates the form as editable `ai_draft`; approve → `released` in one transaction with `signals` insert; **projection also fires for auto MC grades** (at release, which is submit time); aggregation module `lib/scoring.ts` as pure functions (normalise, resolve weights, weighted average per fellow × aptitude × period; `period_key` = module id) + recompute entry points (incremental on new signal; full on weight change, writing `audit_log`); weights-editor component (used in assessment editor already) triggers full recompute on save; fellow dashboard per §7.4; admin cohort dashboard per §7.5 (flags need ≥ 5 signals; reasons rendered).

**AC-4:**
- [ ] Unit tests pass for `lib/scoring.ts` covering: normalisation (raw/max), multi-aptitude split (the 70/30 case from data-model §5 worked example), signals with no weights contribute nothing, superseded signal uses latest per source, per-module bucketing, division-by-zero guard when Σw = 0.
- [ ] Releasing a short-answer grade creates exactly one signal; re-running the release action does not create a second (unique constraint + idempotent handler).
- [ ] AI draft: with a valid key, returns a plausible score+feedback into the form; with the API unreachable (unset key), the queue still grades manually with no crash — the button degrades to a disabled/absent state with a notice.
- [ ] An `ai_draft` grade is invisible to the fellow until an admin approves (check `/me` before/after).
- [ ] Changing a question's weights: `audit_log` row written; affected fellow's `aptitude_scores` change accordingly; unaffected fellows' rows untouched.
- [ ] `TRUNCATE aptitude_scores` + full recompute reproduces identical values (ledger property).
- [ ] Fellow dashboard shows per-aptitude score, module trend, signal counts, cohort band (anonymised); admin dashboard shows the four metric cards, flag list with reasons, capability gaps sorted ascending. Flags absent for fellows with < 5 signals.

### Stage 5 — Seed + production hardening
Tasks: full seed — Government Engagement module with 3 classes (class 1 fully authored to mirror §7.1/§7.3 content, incl. the 4-question assessment with rubric and 2–3 seeded Q&A threads; classes 2–3 lighter, class 3 locked with future `release_at`); 4 fellows (Amina Juma, Neema Mushi, Joseph Mrema, Grace Kimaro) with submissions, released grades, and score histories shaped so the admin dashboard shows ≥1 "needs support" and 1 "exceptional" flag; **UX polish pass** — designed empty states for every list surface (no questions, no submissions, empty grading queue, fresh dashboard), pending feedback on every mutation (disabled button + spinner/toast), consistent focus states, no flash of unstyled or shifting content on the demo path; run the full demo-path checklist (§9) against **production**; fix only what the checklist catches.

**AC-5:**
- [ ] `npm run seed` on a fresh database completes idempotently (safe to re-run).
- [ ] Every item in the §9 checklist passes on the production URL, executed in order, including sign-up with a brand-new email.
- [ ] Both dashboards are visibly populated on first admin/fellow login.
- [ ] No console errors on the five §7 screens; basic keyboard navigation works on fellow flows (NFR-19 spirit).
- [ ] Every list surface has a designed empty state; every mutation shows pending feedback; no layout shift or unstyled flash anywhere on the §9 demo path.

## 6. Stages 6–7 (stretch and handover)

### Stage 6 — Stretch (strict order; each item independently shippable)
1. **Observations:** admin form (fellow, class, competency scores from `terms`, notes, release toggle) → observation signals join the pipeline. AC: released observation moves the fellow's Leadership score; unreleased does not; fellow sees released feedback on `/me`.
2. **Import-from-document (FR-2.11):** paste text → one AI call proposes classes + draft blocks (typed JSON) → review screen → "create drafts" persists. AC: nothing persists before confirmation; malformed AI output degrades to an error, never partial writes.
3. **Case studies:** case-study block, submission (file/text), grading reuses Stage 4 queue. AC: graded case study produces signals like assessments.
4. **Drag-and-drop reordering** in builder + assessment editor (keep up/down as fallback). AC: order persists correctly after drag; keyboard reorder still works.
5. **PWA shell** (demoted 8 Jul — cohort 1 connectivity strong): installable, app-shell cached, offline shows a friendly fallback (not white screen). AC: Lighthouse installable check passes; airplane-mode reload of a visited page shows shell + notice.
6. **Question bank:** list/reuse questions across assessments. 7. **Cloudflare Stream** provider. (6–7 only if everything above is done.)

### Stage 7 — Handover
Tasks: README (setup, env table, architecture overview linking SRS/data-model, seed instructions, known limitations); `docs/demo-checklist.md` (the §9 script, for the Loom recording); ensure repo is clean (no secrets, no dead code).

**AC-7:**
- [ ] A fresh clone + README steps + provided env values reaches a working local app with seed data in ≤ 15 minutes.
- [ ] Demo checklist committed and accurate against production.

---

## 7. Screen specifications (agreed mockups — build these, don't redesign)

**7.1 Block builder** (`/admin/curriculum/class/[id]`): header = breadcrumb, class title, autosave timestamp, amber "Draft vN" badge, secondary "Preview as fellow", primary "Publish". Main column = block cards in fellow reading order; each card: type icon + label header with up/down/delete; inline editing bodies (video: provider select + URL + caption + thumbnail placeholder; rich text: mini toolbar + editor; resources: rows with filename/size or external link + "Add resource"; assessment: summary [title, question counts, weight chips] + "Edit assessment" button). Bottom: dashed "Add block" row with four type chips. Right rail (~190px): Page card (status, published version + date, release state per cohort) and Versions list (draft = "editing", published versions with "Restore").

**7.2 Assessment editor** (`/admin/assessments/[id]`): header = breadcrumb, title, saved timestamp, "Done — back to class". Summary bar: question count, total points, live weights rollup, attempts select. Question cards (same chassis as builder): header "Qn · type · pts" + up/down/delete/collapse; MC body = prompt input, option rows (radio marks correct, per-option remove, "Add option"); short-answer body = prompt + rubric textarea + helper line "AI drafts a score and feedback against this rubric — you review and approve before the fellow sees it"; both = tag chips (+ add) and "Counts toward" weight inputs (Technical/Strategic/Leadership %) with green 100% check. Bottom: "Add question" row (Multiple choice / Short answer) + muted "From bank — post-beta". Locked state: read-only cards + "Duplicate to edit" banner.

**7.3 Fellow class page** (`/learn/class/[id]`): centered ~560px column. Breadcrumb "module · class n of m", title, released/updated dates. Video block = 16:9 poster card, centered play circle, "Tap to stream · adapts to your connection", duration chip; caption below. Rich text rendered as clean prose. "Resources" label + download rows (icon, name, `type · size` or "opens in browser"). Assessment launcher card: title, "n questions · about x minutes", status chip (Not started / Submitted / Graded), primary "Start assessment" (the only accent on the page). Below the launcher: **"Questions" section** — plain-text ask box ("Ask about this class"), then threads newest-first: author name + relative time, question body, indented flat replies (admin replies carry a small "Tanza" badge), "Reply" affordance per thread; admins additionally see a hide control, authors a delete-own control. Footer: divider + locked next class with release date.

**7.4 Fellow dashboard** (`/me`): header "Your development" + cohort/module subtitle + updated timestamp. Three aptitude metric cards: label, big score, trend line ("+6 vs module 2" with up icon, green) + "· n signals" muted. "You and the cohort" bands: per aptitude a track with shaded middle-half of cohort and a dot for the fellow (legend in the label; no named peers anywhere). Two cards: "Strengths" and "Focus next" as competency chips (from tag-level aggregates). Bottom row: slim module progress bar + "x of y classes · n assessment pending". Below (same page or tab): previous coursework list.

**7.5 Admin cohort dashboard** (`/admin`): header "Cohort 1" + "24 fellows · module n of m" + module filter select. Four metric cards: Needs support (warning number), Exceptional (success number), Median score, Signals this week. "Attention" list: bordered rows with initials avatar, name, reason line in role colour ("Leadership 41 · declining 3 modules · 8 signals" / success-toned for exceptional), "View" button. "Cohort capability gaps": competency rows with thin bars + score, ascending, lowest highlighted warning.

## 8. Do not build (hard guardrails)

Peer review UI · notifications/email sending (signup works without verification) · password reset · transcripts/AI summaries · offline writes · i18n · question difficulty metadata · timed assessments · drag-and-drop · CSV export · audit-log viewer UI · multi-cohort UX polish · managed video streaming (unless Stage 6 item 6) · any table not in data-model.md · Q&A extras: rich text, nested replies, upvotes/accepted answers, notifications, edit flows, or any Q&A→signals wiring. If something seems missing to make a stage work, prefer the smallest change consistent with data-model.md and note it in the README's limitations section.

## 9. Demo-path acceptance script (run top to bottom on production)

1. Log in as seeded admin → `/admin` dashboard populated (flags visible with reasons).
2. `/admin/curriculum` → open class 1 builder → edit the rich-text block → Preview as fellow shows the edit → Publish.
3. In the builder, open the assessment → confirm locked (seeded submissions exist) → Duplicate to edit works.
4. Sign up as a brand-new fellow (fresh email) → lands enrolled in Cohort 1 → `/learn` shows released classes 1–2, locked class 3 with date.
5. Open class 1 → page readable with no video loaded → click poster → video plays.
6. Post a question in the class Q&A → as admin, reply (Tanza badge visible) → as the fellow, see the reply on the thread.
7. Start assessment → answer 3 MC + 1 short answer → submit → MC portion scored instantly on the results view.
8. As admin: `/admin/grading` → open the new submission → Draft with AI → edit feedback → Approve and release.
9. As the fellow: `/me` shows score + feedback; dashboard shows aptitude scores with signal counts.
10. As admin: open the (duplicated) assessment → change Q1 weights (e.g. Technical 100 → 60/Strategic 40) → save → fellow's Technical/Strategic scores shift on both dashboards; `audit_log` has the change.
11. (Informative, non-blocking) Reload the class page on a throttled "Fast 3G" profile and record the readable-in time in the README limitations section — field-readiness evidence, not a beta gate.
