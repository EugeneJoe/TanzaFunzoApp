# Build Plan — Tanza Fellowship Hub Beta (one working day)

| | |
|---|---|
| **Version** | 0.6 |
| **Date** | 9 July 2026 |
| **Companions** | SRS-tanza-fellowship-hub-beta.md · data-model.md · implementation-plan.md (execution detail + acceptance criteria) |

UI note: the five demo-path screens (block builder, assessment editor, fellow class page, fellow dashboard, admin cohort dashboard) were mocked and agreed on 7 Jul; their layouts and states are specified in implementation-plan.md §7 — no in-build design exploration needed.

**Operating principle:** the demo path is sacred. Every hour advances the single end-to-end story below; anything off that path is a stretch goal and gets cut first, without apology. The brief explicitly rewards depth over breadth.

**Update 8 Jul:** cohort 1 connectivity confirmed strong and stable — the beta prioritises **UX quality**. Low-bandwidth patterns (SSR-first, lazy media) stay as free architecture defaults, but payload budgets are non-blocking targets and the PWA drops down the stretch order. Freed time goes to a polish pass (empty states, pending states, transitions) in the hardening box.

**Update 9 Jul:** a hifi brand-restyle design handoff landed (`design_handoff_tanza_restyle/` — Tanza Ventures navy/orange palette, Jost/Mulish type, persistent sidebar shells, seven screens: class view, journey, "Your development", results, admin cohort overview, cohorts, grading queue). It is a **visual reskin, not a feature change** — every data element the designs show already exists in the built app. Executed as **Stage 8** (implementation-plan.md §10), after Stage 5 and ahead of all Tier 2 stretch items; it *is* the UX-priority reinvestment the 8 Jul update called for.

**The demo path (what the Loom will show):**
Admin signs in → creates a class inside a module → composes the page from blocks → **previews it as a fellow → publishes** → releases it to the cohort → fellow signs up (auto-assigned to cohort) → opens the class, watches video, reads notes → **posts a question on the class, admin replies with a Tanza badge** → completes the assessment (MC auto-scored, short answer queued) → **AI drafts the short-answer grade → admin edits and approves → releases** → fellow sees feedback → **both dashboards update** → admin re-weights an aptitude → **scores recompute live**. That final beat is the thesis of the whole platform — configuration-driven, performance-not-activity — in one interaction.

---

## 1. Stack (committed)

Decided here so zero build time goes to deliberation. All choices are boring-on-purpose and match SRS §6:

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | One codebase for fellow/admin/API; SSR keeps payloads small (NFR-1); Vercel deploy in minutes |
| UI | shadcn/ui + Tailwind | Professional look for free; AI tools generate it reliably |
| DB | PostgreSQL on Neon + Drizzle ORM | Managed, PITR-capable, migrations as code |
| Auth | Credentials + session cookies via a maintained auth lib | No password reset day one (deliberate cut) |
| Video | Embed provider (YouTube/Vimeo) behind the provider-agnostic block | Managed streaming (Cloudflare Stream) is post-day-one; the block interface already supports it |
| AI | Anthropic API (grading drafts) | One endpoint, rubric-in-prompt; graceful fallback = manual grading |
| Hosting | Vercel + Neon | Deploy in hour 0, redeploy continuously |
| Recompute | Synchronous function on write | A queue is production posture, not demo posture; the function signature is queue-ready |

Day-one simplifications vs. SRS (each documented in the write-up as a conscious trade-off): embed video instead of managed streaming; synchronous recompute instead of worker queue; no transcripts; no PWA service worker unless time allows.

## 2. Scope tiers

**Tier 0 — foundation (non-negotiable):** repo + CI-less deploy pipeline, full schema migration (all data-model.md tables, even those without UI — migrating now is cheap and shows the architecture), seed script, auth + RBAC middleware, cohort auto-assignment on signup with admin override.

**Tier 1 — must ship (the demo path):**
1. Admin: module/class CRUD, ordering.
2. Block builder: four block types only — rich text, video (embed), resource links, assessment. Add / reorder / remove / edit, draft → **preview-as-fellow** → publish (page_versions doing the work).
   Assessment editor as a **dedicated page** (jump from the assessment block, same card chassis as the builder): inline question authoring only — MC prompt + options + correct answer; short-answer prompt + grading rubric; tags; per-question aptitude weights with a 100% check; assessment-level attempts setting and weights rollup. No question bank, no drag reorder, no per-option feedback. Integrity guard: once an assessment has submissions, editing locks ("duplicate to edit").
3. Release: journey_steps toggle per cohort (locked ↔ released).
4. Fellow: journey view with locked/released states; class page renderer (text-first, lazy media); assessment taking — MC auto-scored, short answer submitted (idempotency key on submissions).
5. Grading: admin queue; AI draft (score + feedback against rubric) → admin edits → approve → release; grades project into signals.
6. Performance: signals → aptitude_scores recompute; weights editor (per question, the polymorphic table + single UI from data-model D1); fellow dashboard (aptitude scores, trend by module, signal counts); admin cohort dashboard (distribution per aptitude, flags with minimum-signal guard).
7. Class Q&A (SRS §3.9): questions + flat replies section under every released class page; cohort-scoped visibility; admin reply badge; admin soft-hide. Plain text, no notifications, no scoring impact. If the day runs long, moderation (hide) drops to Tier 2 — posting/replying stays.

**Tier 2 — stretch (in pick-up order, only if Tier 1 is demoable):**
1. Observation entry form (leadership scores a fellow on competencies) — cheapest way to show a *second* signal source flowing into the same pipeline.
2. Import-from-document assist (FR-2.11) — paste the Government Engagement outline, one AI call proposes classes + draft blocks, admin reviews in the builder before anything is saved. Strong AI-leverage beat for the Loom.
3. Case-study block + submission + grading (reuses the short-answer grading UI).
4. Drag-and-drop reordering in the builder and assessment editor (up/down buttons remain as fallback) + builder micro-interactions.
5. PWA app shell (next-pwa) — NFR-6, demoted 8 Jul with the connectivity update.
6. Question bank UI with tags (day one: questions created inline on the assessment).
7. Cloudflare Stream upload + signed playback.

**Deliberately not building (say so in the Loom, confidently):** peer review UI, notifications/emails (signup works without verification day one), password reset, transcripts/summaries, offline reading, content version restore UI, CSV export, audit-log viewer. All are modelled in the schema; none are on the demo path.

## 3. Timeboxes (9-hour day)

Rule: when a box expires, ship what works and move on. The cut line moves up, never the deadline.

| Time | Box | Output | Cut-if-late |
|---|---|---|---|
| 0:00–0:45 | Scaffold | Next.js + shadcn + Drizzle + Neon wired; **deployed to Vercel**; auth lib installed | — |
| 0:45–2:00 | Foundation | Full schema migrated; seed script skeleton; signup/login; cohort auto-assign; RBAC middleware; admin bootstrap | Admin override UI (seed it instead) |
| 2:00–4:00 | Curriculum + builder | Module/class CRUD; block builder with 4 types; draft/preview/publish; release toggle | Reorder-by-drag (use up/down buttons); video block (rich text carries the demo) |
| 4:00–5:30 | Fellow experience | Journey view; class renderer; assessment take + submit; MC auto-score; class Q&A (post + reply + admin badge) | Attempt policy (single attempt hardcoded via settings default); Q&A moderation |
| 5:30–7:00 | Grading + performance | Grading queue; AI draft + approve/release; signal projection; recompute; weights editor; both dashboards | AI draft (fall back to manual grading — the queue still demos); trend chart (show current scores only) |
| 7:00–7:45 | Seed + harden | Government Engagement module seeded with realistic content; 3–4 seeded fellows with history so dashboards look alive; **UX polish pass** (empty states, pending states on mutations, no layout shift); full demo-path walkthrough on **production**; fix only demo-path bugs | Second seeded module |
| 7:45–9:00 | Deliverables | Loom (≤5 min, non-technical, follows the demo path); write-up (prioritization, architecture + 3 flexibility examples — lift from data-model.md §5–7, limitations); clarifying questions (lift SRS Appendix A); README | — |

Deployment happens in the *first* box and continuously after — a hosting surprise at hour 8 is the one unrecoverable failure mode.

## 4. Seed data is a feature

Dashboards full of zeros demo nothing. The seed script creates: one cohort; the Government Engagement module (from Tanza's attached outline — shows you read their materials) with 3 classes, 2 published + 1 locked; one assessment per published class with tagged, weighted questions; 4 fellows with completed submissions, released grades, and one observation each — enough history that both dashboards render distributions, trends, and one "needs support" flag the moment the interviewer logs in.

## 5. Risk register (for the day)

| Risk | Mitigation |
|---|---|
| Auth eats the morning | Maintained library, credentials only, no reset/verification flows |
| Block builder scope creep | 4 block types, hard cap; up/down buttons over drag-and-drop |
| AI grading flaky under demo | Fallback path: queue works fully manual; AI is an enhancement button |
| Deploy surprises late | Deploy at 0:45; every box ends with a production smoke test |
| Dashboard math bugs | The recompute is a pure function — unit-test it in the grading box (only tests written day one; highest-risk logic per NFR-24) |
| Time vanishes into polish | Demo-path checklist pinned; polish only what the Loom camera will see |

## 6. Rubric map (why this plan wins each row)

| Tanza assesses | Where this plan answers it |
|---|---|
| Product thinking | Demo path = the two hard problems (flexible authoring, performance measurement), not CRUD breadth |
| AI leverage | AI-assisted grading in-product; AI-first build workflow narrated in Loom/write-up |
| Architecture | Full schema shipped; signals pipeline live; SRS + data-model docs in repo |
| Engineering | Idempotent submissions, immutable ledger, tested recompute, migrations as code |
| User experience | Builder preview-as-fellow; text-first fellow pages; seeded, alive dashboards |
| Judgement | Explicit tiers, cut lines, and documented day-one simplifications |
| Communication | Loom follows one narrative; write-up sections map 1:1 to their asks |

## 7. Definition of done

Tier 1 is done when a stranger can, on the production URL: sign up as a fellow and land in the cohort; complete the seeded assessment; and, as the seeded admin, publish a new block to a class, grade the new submission (AI-assisted or manual), release it, and watch both dashboards and a re-weighted aptitude update. If all of that works, stop building and start recording.
