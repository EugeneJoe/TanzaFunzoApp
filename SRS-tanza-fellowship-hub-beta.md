# System Requirements Specification
## Tanza Fellowship Hub — Beta (Phase 1: Classroom Learning)

| | |
|---|---|
| **Version** | 0.3 (draft) |
| **Date** | 7 July 2026 |
| **Author** | Eugene Muthui |
| **Status** | For review |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for the beta version of the **Tanza Fellowship Hub**, the learning platform supporting Phase 1 (Classroom Learning) of the Tanza Fellowship. It is the reference for design, implementation, and acceptance of the beta, and records the product decisions and assumptions behind it.

### 1.2 Scope
The beta serves the **first Fellowship cohort (launching September)** and covers Phase 1 only. It supports two user roles — **Fellows** and **Administrators (Tanza Leadership)** — and delivers:

- configuration-driven curriculum management (modules → classes → block-based pages),
- the fellow learning experience (video, notes, resources, assessments, case studies, feedback),
- performance tracking across three aptitude dimensions with admin-configurable weightings,
- admin review, grading (AI-assisted), and cohort analytics,
- low-bandwidth-first delivery as a Progressive Web App.

Phases 2 and 3 (Field Shadowing, Supported Field Execution) are **out of scope** for the beta but constrain the design: the data and configuration model must extend to them without schema redesign (see §7).

### 1.3 Guiding design principles
Derived from the Tanza brief and stakeholder decisions:

1. **Configuration over code.** Curriculum, competencies, scoring weights, and learning journeys are data, editable by admins — never hard-coded. This is the first Fellowship ever run; everything will change.
2. **Measure performance, not activity.** Progress bars exist, but the primary lens is: *is this fellow becoming a stronger implementation leader?*
3. **Low bandwidth is a first-class constraint.** Fellows may be on 2G/3G in areas with poor connectivity. Payload budgets are requirements, not aspirations.
4. **Flexibility within a solid foundation.** A small, stable core (identity, content blocks, signals, scoring) with variation expressed as configuration.
5. **Human-in-the-loop AI.** AI accelerates admin work (grading drafts, transcripts) but a human approves anything a fellow sees.

### 1.4 Definitions
| Term | Meaning |
|---|---|
| **Fellow** | A Fellowship participant (learner). |
| **Admin** | Tanza Leadership / staff managing content, grading, and cohort oversight. |
| **Cohort** | A group of fellows progressing through the Fellowship together, with a defined start date. |
| **Module** | A major curriculum unit (five in Phase 1), containing classes. |
| **Class** | A single learning unit within a module, rendered as a block-based page. |
| **Block** | A typed unit of page content (video, rich text, resource list, assessment, case study, etc.). |
| **Aptitude** | A performance dimension: Technical, Strategic, or Leadership (extensible). |
| **Competency / Behaviour** | Admin-defined skills and behaviours, taggable to questions and observations. |
| **Signal** | Any scored or observed input to a fellow's performance picture (assessment result, case-study grade, observation, peer review). |

### 1.5 References
- Tanza take-home brief: *Build the First Version of the Tanza Fellowship Platform*.
- Handwritten scoping notes (product owner), July 2026.
- Government Engagement Fellowship module outline; Franchise pitch deck (confidential background).

---

## 2. Overall Description

### 2.1 Product perspective
A new, standalone web application (PWA). Long-term it becomes one part of an integrated operating system for franchise-based social-impact organisations; the beta must therefore keep clean boundaries (API-first backend, stack-portable data model) so it can later be embedded in, or federated with, a larger system.

### 2.2 User classes
| Class | Description | Technical proficiency |
|---|---|---|
| **Fellow** | ~20–50 per cohort. Accesses learning content, completes assessments and case studies, requests peer reviews, tracks own development. Primarily **laptops** on variable, often poor connectivity; occasional mobile access. | Moderate |
| **Admin (Tanza Leadership)** | Small team (<10). Authors curriculum, releases classes, grades submissions, records observations, configures competencies and scoring, monitors the cohort. Typically desktop on good connectivity. | Moderate–high |

Role model must be extensible (e.g., future roles: Mentor, Guest Reviewer, Franchise Manager) — **RBAC with roles as data**, not two hard-coded user types.

### 2.3 Operating environment
- **Client:** evergreen desktop browsers as the primary target; installable PWA. Must remain usable over 2G/3G connections and degrade gracefully on mobile browsers (secondary).
- **Server:** cloud-hosted, managed services preferred (see §6). Single region for beta, chosen for proximity/latency to Tanzania.

### 2.4 Assumptions and dependencies
- Fellowship content and the platform UI are English-only; fellows are working-proficient in English.
- Fellows primarily access the platform on laptops; connectivity, not device capability, is the binding constraint.
- Fellows are adults; no child-safeguarding requirements apply to platform users.
- A managed video streaming provider (e.g., Cloudflare Stream or Bunny Stream) and an LLM/ASR API (e.g., Anthropic + a speech-to-text service) are available and budgeted (est. combined **$25–60/month** at beta scale).
- Email delivery service available for sign-up verification and notifications.

---

## 3. Functional Requirements

Priorities use MoSCoW: **M**ust, **S**hould, **C**ould, **W**on't (this release).

### 3.1 Identity, accounts, and cohorts

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Fellows self-register with email + password (verified email). No admin approval step. | M |
| FR-1.2 | Admins define cohorts with a name and **pre-defined start date**. | M |
| FR-1.3 | On sign-up, a fellow is **automatically assigned to a cohort based on the sign-up date** (the next cohort whose enrolment window covers that date). | M |
| FR-1.4 | Admins can **override** a fellow's cohort assignment at any time. | M |
| FR-1.5 | Role-based access control; roles (Fellow, Admin) stored as data and assignable by an Admin. First admin bootstrapped at deployment. | M |
| FR-1.6 | Password reset via email; session management with secure, expiring tokens. | M |
| FR-1.7 | Admins can deactivate an account (fellow retains data, loses access). | S |

### 3.2 Curriculum & content management (Admin)

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Admins create, edit, reorder, and archive **modules**, and **classes** within modules, without code changes. | M |
| FR-2.2 | Each class page is composed of an **ordered list of typed content blocks**. Beta block types: rich text, video, resource/file list, external link list, assessment, case study, transcript. Block types are extensible without schema redesign. | M |
| FR-2.3 | Admins add, remove, reorder, and configure blocks through an intuitive visual editor. | M |
| FR-2.4 | **Draft / preview / publish workflow:** every class page has a draft state; admins can **preview the page exactly as a fellow will see it** before publishing. Publishing replaces the live version atomically; editing continues in a new draft. | M |
| FR-2.5 | Content versioning: the system retains prior published versions of a page and who published them; admins can view and restore a previous version. | S |
| FR-2.6 | File/resource upload (toolkits, templates, slide decks) to object storage, with per-file size limits and allowed-type validation; resources are downloadable by fellows. | M |
| FR-2.7 | **Class availability:** classes are locked by default and released per cohort, either manually or on a scheduled date/time. Locked classes are visible in the journey as "upcoming" but their content is inaccessible. | M |
| FR-2.8 | Admins can define **learning journeys** (the ordered path of modules/classes a cohort follows) as configuration, including adding future modules and pathways, without application-code changes. | M |
| FR-2.9 | Video upload/link via a **provider-agnostic video block**: a block stores `{provider, video_reference}`. Beta providers: (a) **managed streaming** (primary — direct upload from the admin UI, adaptive-bitrate playback, signed playback URLs) and (b) YouTube/Vimeo embed (fallback, e.g. public guest-speaker content). | M |
| FR-2.10 | On upload to the managed provider, the system requests **automatic transcription**; the draft transcript and an AI-generated key-points summary are attached to the class as a transcript block for admin review/edit before publishing. | S |
| FR-2.11 | **Import from document (AI-assisted):** an admin can paste or upload a source document (e.g. a module outline); the system proposes a scaffold — classes and draft blocks with content mapped into the appropriate block types — which the admin reviews and edits in the builder. Nothing is persisted as a draft without explicit admin confirmation; the assist never publishes. | C |

### 3.3 Learning experience (Fellow)

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Fellows see their learning journey: modules and classes in order, with released/locked status, and continue where they left off. | M |
| FR-3.2 | Fellows view published class pages: watch video (adaptive bitrate, degrades to low resolution on poor connections), read notes and transcript, download resources, follow external links. | M |
| FR-3.3 | Video playback position is remembered per fellow. | C |
| FR-3.4 | Fellows can rewatch class recordings and guest-speaker recordings at any time after release. | M |
| FR-3.5 | Text-first rendering: a class page is fully readable (notes, transcript, resources) without loading video; media loads lazily and only on interaction. | M |
| FR-3.6 | Fellows access **previous coursework** — their past submissions, grades, and feedback — for review at any time. | M |

### 3.4 Assessments

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Admins author questions of two types: **multiple-choice** (auto-scored) and **short-answer** (rubric-scored). | M |
| FR-4.2 | Questions live in a **reusable question bank** and are taggable against modules, classes, competencies, behaviours, and aptitude areas. Tags are admin-managed vocabularies (configuration, not code). | M |
| FR-4.3 | Admins compose assessments from bank questions and attach them to classes via an assessment block. | M |
| FR-4.4 | Fellows complete assessments in the app; MC questions are scored instantly; short answers enter a grading queue. Submissions are idempotent (safe against connection drops/retries). | M |
| FR-4.5 | **AI-assisted grading:** for each short answer, the system drafts a suggested score and written feedback against the question's rubric. An admin reviews, edits, and approves before anything is released to the fellow. AI output is never fellow-visible without approval. | S |
| FR-4.6 | Each question (or assessment) carries **configurable weightings across aptitude areas**, so one activity can contribute differently to Technical, Strategic, and Leadership scores. | M |
| FR-4.7 | Admins can allow retakes per assessment (attempt limit and which attempt counts are configurable). | C |

### 3.5 Case studies & peer review

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Admins attach case studies to classes (brief + resources + submission instructions) via a case-study block. | M |
| FR-5.2 | Fellows submit responses (file upload and/or rich text). Submissions are timestamped and immutable once submitted; admins may permit resubmission. | M |
| FR-5.3 | Admins review, grade (against a rubric with aptitude weightings), and return **written feedback**. | M |
| FR-5.4 | **Fellow-initiated peer review:** a fellow may request a review of their case-study submission from one or more chosen peers in their cohort. The peer completes a structured rubric review plus qualitative comments. | S |
| FR-5.5 | Completed peer reviews are visible to the submitting fellow and to admins, and contribute (with admin-configurable weight, which may be zero) to the fellow's aptitude signals — primarily Leadership for the *reviewer* and per-rubric for the *reviewee*. | S |

### 3.6 Observations & feedback (Tanza Leadership)

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | After each classroom session, admins record **structured observations** (scored against admin-defined competencies/behaviours) and **qualitative notes** per fellow. | M |
| FR-6.2 | Observations carry configurable aptitude weightings, like other signals. | M |
| FR-6.3 | Fellows view feedback on their classroom contributions once the admin marks it released. | M |

### 3.7 Performance & progress

| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | The system computes each fellow's performance across **Technical, Strategic, and Leadership aptitudes** by aggregating all weighted signals (assessments, case studies, observations, peer reviews). Aptitude dimensions themselves are configuration (named, addable) — not hard-coded. | M |
| FR-7.2 | **Raw signals are immutable; aggregate scores are derived.** When an admin changes weights or scoring configuration, aggregates are recomputed from raw signals, and the change is recorded in an audit log. | M |
| FR-7.3 | Fellow dashboard shows: aptitude scores and trend over time, strengths and improvement areas (by competency tag), completion ratio, and **cohort comparison** (own score vs. anonymised cohort distribution — no ranked league table of named peers). | M |
| FR-7.4 | Admin cohort dashboard surfaces: fellows needing additional support, exceptional performers, emerging leadership strengths, and common capability gaps across the cohort (by competency/behaviour tags). | M |
| FR-7.5 | Admins can adjust aptitude/competency weightings and scoring rules through the admin UI, without code changes (per user notes: "set & adjust weights for different aptitudes for assessing fellow performance"). | M |
| FR-7.6 | Grading and score-affecting actions are audit-logged (who, what, when, before/after). | S |

### 3.8 Administration & operations

| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | Unified admin review queue: pending short-answer gradings, case-study submissions, and unreleased observation feedback in one place. | S |
| FR-8.2 | Admins manage vocabularies: competencies, behaviours, aptitude areas, tags. | M |
| FR-8.3 | Basic notification emails: sign-up verification, class released, feedback returned, peer-review requested. Fellows can opt out of non-essential emails. | S |
| FR-8.4 | Data export (CSV) of cohort performance data for external analysis. | C |

---

## 4. Data & Configuration Model (conceptual)

The schema is relational and deliberately small; flexibility lives in a few well-chosen patterns rather than schemaless sprawl.

**Core entities:**

- `User` — identity + profile. `Role` and `UserRole` — RBAC as data.
- `Cohort` — name, start date, enrolment window. `Enrollment` — user ↔ cohort (supports admin override and future multi-cohort).
- `Module`, `Class` — ordered curriculum containers. `JourneyStep` — per-cohort ordering/availability of classes (journey = configuration).
- `Page` and `PageVersion` — a class's content; a version is an ordered list of `Block` records (`type`, `position`, `config JSON`). Draft/published pointers live on `Page`. **New block types = new `type` value + renderer, no migration.**
- `Release` — class × cohort availability (manual or scheduled).
- `Question` (type, body, options, rubric, tags, aptitude weights), `Assessment`, `AssessmentQuestion` — bank + composition.
- `Submission` (assessment attempt or case-study submission; idempotency key; immutable), `Answer`, `Grade` (raw score, grader = human/AI-draft, status).
- `Observation` — structured scores + notes by an admin on a fellow.
- `PeerReviewRequest` and `PeerReview` — fellow-initiated, rubric-based.
- `Signal` — the normalisation layer: every scored event (grade, observation, peer review) is projected into signals `{fellow, source, competency tags, aptitude weights, raw score, occurred_at}`.
- `AptitudeScore` — derived, recomputable aggregates per fellow × aptitude × period.
- `Vocabulary` records — aptitudes, competencies, behaviours, tags (admin-managed).
- `AuditLog` — score/config-affecting changes.
- `MediaAsset` — provider-agnostic reference `{provider, ref, status, duration, transcript_ref}`.

**Three changes this model absorbs without code changes** (flexibility test, per the brief):
1. Tanza restructures Module 3 into two modules and reorders classes mid-cohort → edit modules/classes and `JourneyStep` config; published pages untouched.
2. Tanza adds a fourth aptitude ("Operational Aptitude") and re-weights all case studies → add vocabulary entry, adjust weights; aggregates recompute from immutable signals.
3. Phase 2 begins and field-visit reports must count toward performance → new signal source feeding the same `Signal` → `AptitudeScore` pipeline.

---

## 5. Non-Functional Requirements

### 5.1 Performance & low-bandwidth budgets
| ID | Requirement |
|---|---|
| NFR-1 | Initial critical-path payload ≤ **300 KB** compressed JS/CSS; first contentful paint ≤ 3 s and interactive ≤ 5 s on a simulated Fast-3G connection (laptop-class device). |
| NFR-2 | Subsequent navigations fetch data-only payloads (≤ 100 KB typical); no full-page reloads. |
| NFR-3 | Images served responsive and compressed (WebP/AVIF); all media lazy-loaded; video never auto-plays or preloads beyond metadata. |
| NFR-4 | Video streams adaptively (HLS) down to ≤ 240p; class pages remain fully usable with video unavailable (FR-3.5). |
| NFR-5 | Server-side API latency p95 ≤ 300 ms at beta load. |

### 5.2 PWA & resilience on poor connections
| ID | Requirement |
|---|---|
| NFR-6 | **(Must)** Installable PWA with service-worker caching of the app shell (JS/CSS/fonts/icons); repeat visits render from cache; transient connection loss shows a graceful offline state, never a blank page. |
| NFR-7 | **(Should)** Previously visited class notes, transcripts, and downloaded resources are readable offline; cached content is invalidated when a new page version is published. |
| NFR-8 | Offline *writes* (assessments, submissions) are **out of scope for beta**, but submission APIs are idempotent with client-generated submission IDs so offline-first sync can be added without API redesign. |

### 5.3 Availability, scalability, and operations
| ID | Requirement |
|---|---|
| NFR-9 | Availability target ≥ **99.5 %** monthly (beta). No single point of failure in the app tier: stateless application processes behind a load balancer, ≥ 2 instances or an equivalently redundant serverless/managed platform. |
| NFR-10 | Managed database with automated daily backups and point-in-time recovery. **RPO ≤ 1 h, RTO ≤ 4 h.** |
| NFR-11 | Designed headroom: 10× beta load (≈ 500 concurrent users) via horizontal scaling only — no stateful app servers, files in object storage + CDN, DB read-replica-ready. Load test at 3× expected launch concurrency before September. |
| NFR-12 | Structured logging, error tracking, uptime monitoring, and basic metrics dashboards from day one. |

### 5.4 Security & privacy
| ID | Requirement |
|---|---|
| NFR-13 | TLS everywhere; passwords hashed with a modern KDF (argon2/bcrypt); OWASP Top-10 protections (CSRF, XSS, injection, rate limiting on auth endpoints). |
| NFR-14 | Authorisation enforced server-side per role and per cohort (a fellow can never access another fellow's submissions, grades, or feedback; peers see only what a review request grants). |
| NFR-15 | Video playback via **signed, expiring URLs** — course content is confidential and must not be publicly reachable. |
| NFR-16 | Personal data handled per **Tanzania Personal Data Protection Act (2022)** and GDPR-informed practice: minimal collection, documented purpose, deletion on request, data stored with reputable cloud providers. |
| NFR-17 | AI processing (grading drafts, transcription) sends the minimum necessary content to external APIs; no fellow personal identifiers beyond what the task requires; providers with no-training-on-API-data terms. |

### 5.5 Usability & accessibility
| ID | Requirement |
|---|---|
| NFR-18 | Desktop-first UI for both fellows and admins (laptops are the primary access mode). Layouts remain responsive and functional on tablet/mobile, but mobile optimisation is not a beta acceptance criterion. |
| NFR-19 | WCAG 2.1 AA for core fellow flows (contrast, keyboard navigation, captions/transcripts for video — the transcript requirement doubles as the accessibility provision). |
| NFR-20 | English-only platform. Internationalisation is out of scope for the beta (no i18n scaffolding required); localisation would be a post-beta initiative if ever needed. |
| NFR-21 | Admin authoring flow (create class → add blocks → preview → publish) must be learnable without training — target: a new admin publishes a complete class page unaided in < 15 minutes. |

### 5.6 Maintainability & portability
| ID | Requirement |
|---|---|
| NFR-22 | API-first: all client functionality via a documented HTTP API — enables future mobile clients, integrations, and the long-term "operating system" vision. |
| NFR-23 | Stack-portable core: business logic and schema must not depend on proprietary features of any single vendor beyond commodity services (relational DB, object storage, CDN), so the architecture can migrate stacks later (an explicit Tanza assessment criterion). |
| NFR-24 | Automated test coverage for scoring/aggregation logic (highest-risk domain logic) and CI running tests on every change. |

---

## 6. Reference Architecture (informative)

Stack-agnostic logical architecture; a concrete stack suggestion follows.

```
[ PWA client (app shell + cached content) ]
        │ HTTPS / JSON API
[ CDN ] ─ static assets, images, downloadable resources
        │
[ Stateless app tier ×N ]  ── [ Async workers ] ── AI APIs (grading drafts,
        │                        (transcription,        transcription)
        │                         recompute, email)
[ Managed relational DB ]   [ Object storage ]   [ Managed video streaming ]
  (+ PITR backups)            (resources/files)    (upload, HLS, signed URLs)
```

Key decisions embodied above:
- **Stateless app tier + managed DB** = HA and horizontal scaling with minimal ops.
- **Async worker queue** isolates slow work (transcription, AI drafts, score recomputation, email) from request latency.
- **Signals → derived scores** pipeline makes scoring config safely re-runnable.
- **Provider-agnostic media layer** so video vendors can be swapped per block.

*Suggested beta stack (one sensible instantiation):* TypeScript full-stack (e.g., Next.js or Remix) on a managed platform (Fly.io/Render/Vercel + worker), PostgreSQL (managed, e.g., Neon/Supabase/RDS), S3-compatible object storage + CDN, Cloudflare Stream or Bunny Stream for video, Anthropic API for grading drafts/summaries, Whisper-class ASR for transcripts. Estimated infrastructure cost at beta scale: **$30–80/month**.

---

## 7. Out of Scope (Beta) & Future Provisions

**Explicitly deferred:**
- Phases 2 & 3 features (field tools, mentor workflows) — but the signal/scoring pipeline and RBAC already accommodate them.
- Offline writes / full offline-first sync (NFR-8 keeps the door open).
- Localisation / Swahili UI (fully out of scope — no i18n scaffolding in the beta).
- Mobile-optimised fellow experience (responsive fallback only; laptops are the primary access mode).
- In-app messaging/chat, discussion forums.
- Recruitment, operations, finance modules from the long-term vision.
- Automated class-recording generation from slides + voice-over (brief's "ultimately" feature); beta accepts uploaded/linked recordings.
- Native mobile apps (PWA covers install-to-homescreen).

---

## 8. Risks & Top Assumptions

1. **Self-signup without approval** assumes the sign-up link is distributed only to accepted fellows. *Risk:* strangers joining a cohort. *Mitigation:* unguessable cohort enrolment link and/or a shared enrolment code; admin can deactivate accounts (FR-1.7).
2. **AI grading quality** assumes rubric-guided drafts are accurate enough to save admin time. *Mitigation:* human approval is mandatory; measure edit-distance between draft and approved feedback during the first module and drop the feature if it costs more than it saves.
3. **Access profile** assumes fellows use laptops with at least intermittent 2G/3G connectivity. If a significant share turn out to be mobile-only, the responsive fallback needs promotion to a first-class mobile experience; if fellows are offline for days at a time, tier-2 offline reading gets promoted to Must.
4. **Scoring model simplicity** assumes weighted aggregation of signals is a credible v1 of "measuring performance." Normalisation across graders/activities (e.g., z-scoring) is likely needed once real data arrives — the immutable-signals design allows re-deriving under a new formula.
5. **Single cohort at a time** during beta; multi-cohort concurrency is modelled (enrollments, releases per cohort) but not UX-optimised.

---

## Appendix A — Clarifying Questions for Tanza (ranked)

*Per the delivery instructions: each question with why it matters and the working assumption if unanswered.*

1. **Who grades, and how many admins will actively use the platform in September?**
   *Why:* sizes the admin UX investment and the value of the AI grading queue. *Assumption:* 2–4 active admins sharing grading.
2. **Is there an existing competency/behaviour framework document for the three aptitudes?**
   *Why:* the tagging vocabulary and rubrics should mirror it; retrofitting taxonomies is painful. *Assumption:* seed from the Government Engagement module outline; admins refine in-app.
3. **Should fellows see cohort-relative standing (distribution comparison) or is that culturally/psychologically undesirable for this program?**
   *Why:* the brief asks for comparison "with the wider cohort," but ranked visibility can distort behaviour. *Assumption:* anonymised distribution, no named leaderboard.
4. **What is the realistic connectivity profile of the first cohort (devices, data plans, home vs. training-centre access)?**
   *Why:* determines whether offline reading (tier 2) must be hardened before launch, and validates the laptop-primary assumption. *Assumption:* laptops on intermittent 3G/4G.
5. **Are class recordings produced per cohort or reused across cohorts?**
   *Why:* affects whether media attaches to the class (shared) or to the class-cohort release. *Assumption:* shared per class, overridable per cohort later.
6. **Does classroom-discussion feedback need to be released to fellows immediately, or batched/curated per module?**
   *Why:* changes the observation workflow and notification design. *Assumption:* admin releases explicitly, whenever ready (FR-6.3).
7. **Data residency: any requirement to host in-country or in-region?**
   *Why:* constrains cloud region/provider choice. *Assumption:* nearest reliable region (e.g., South Africa/Europe) is acceptable under PDPA with standard safeguards.
