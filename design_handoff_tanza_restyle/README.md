# Handoff: Tanza Fellowship Hub — Visual Restyle

## Overview
Restyle of the Tanza Fellowship Hub learner and admin experiences to match the Tanza
Ventures brand (tanzaventures.com). Covers four learner screens — **Class / lesson
view**, **My journey**, **My coursework ("Your development")**, and **Assessment
results** — plus three new admin screens: **Cohort overview**, **Cohorts**, and
**Grading queue**. The direction adds a persistent navy sidebar with module
navigation + a progress rail (learner) or admin nav (admin), warms the previously
plain UI with the brand's navy + burnt-orange palette, and applies geometric (Jost)
headings with a humanist (Mulish) body.

**Update (7/9/2026):** the "My coursework" learner screen was reworked into a fuller
development dashboard ("Your development" — aptitude scorecards, cohort-relative
bands, strengths/focus tags), and three admin screens were added, each using a new
admin sidebar shell (parallel to the learner sidebar, with Curriculum / Cohorts /
Grading nav). The admin "Cohort overview" screen (`3A`) was then reworked again into
full-width stacked sections so it scales cleanly as data grows. A login screen was
also designed in three layout variants; **the "Split hero" variant (`4B`) is the
selected direction** to build. Screens `2C` (updated), `3A` (updated), `3B`/`3C`
(new), and `4B` (new, selected) are called out inline below.

## About the Design Files
The file in this bundle (`Tanza Fellowship Hub — Combined.dc.html`) is a **design
reference created in HTML** — a prototype showing the intended look, layout, and states.
It is **not production code to copy directly**. Your task is to **recreate these designs
in the existing Next.js + shadcn/radix codebase**, using its established component
patterns, Tailwind config, and file structure. Match the visuals precisely; implement
the structure the idiomatic shadcn way.

> The HTML uses inline styles and repeats markup per screen (it's a streaming design
> prototype). Do **not** mirror that structure — extract shared pieces (sidebar, cards,
> badges) into real components.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and states are final.
Recreate pixel-closely using shadcn primitives + Tailwind tokens below. Video frames are
placeholders — wire them to the real player component.

---

## Design Tokens

Add these to `tailwind.config` (or map to existing CSS variables / shadcn theme tokens).

### Colors
| Token | Hex | Usage |
|---|---|---|
| `navy` (sidebar/base) | `#132239` | Sidebar background |
| `navy-900` (headings) | `#152744` | Headings, primary text, secondary buttons |
| `orange` (primary accent) | `#DE5A1C` | Primary buttons, active nav, accents, links |
| `orange-hover` | `#B8460F` | Link/button hover |
| `orange-tint` | `#FDEEE4` | Icon chips, "In progress" badge bg |
| `page-bg` | `#F4F6F9` | Main content background |
| `card` | `#FFFFFF` | Cards, inputs |
| `card-alt` | `#EEF1F4` | Assessment card background |
| `card-faint` | `#FBFCFD` | Questions block background |
| `border` | `#E4E8EE` | Card + divider borders |
| `border-input` | `#D6DBE3` | Input / outline-button borders |
| `text-body` | `#3A4A66` | Body copy |
| `text-muted` | `#6C7A93` | Meta / secondary |
| `text-faint` | `#8A97AC` | Timestamps, captions |
| `text-input` | `#1E2B45` | Text typed into inputs |
| Sidebar item (active) | `#FFFFFF` on `rgba(222,90,28,0.16)` + 3px `#DE5A1C` left border | Active nav |
| Sidebar item (idle) | `#9FB0C8` | Idle nav |
| Success | text `#1E5A38`, border `#B7DEC4`, bg `#EDF7F0`, mark `#2E7D53` | Correct answer, 20/20 score |
| Error | text `#8A3320`, border `#E7B9B0`, bg `#FBEEEB`, mark `#C44A2E` | Wrong answer, 0/20 score |
| Warning | text `#B26A1B`, bg `#FBEFD8` | "Awaiting grading" badge |

### Typography
- **Display / headings / buttons / labels:** `Jost` (Google Font), weights 500/600.
  Geometric, Futura-like — matches the client wordmark.
- **Body / inputs:** `Mulish` (Google Font), weights 400/600/700.
- Load via `next/font/google`.
- Scale: page H1 32–38px/600; section H2 24px/600; H3 20px/600; body 15–16px/1.7;
  meta 13px; overline labels 11–12px, `letter-spacing: 1.5–2px`, uppercase.

### Radius / spacing / elevation
- Radius: cards `10px`, buttons/inputs `6–8px`, pills/badges `20px`.
- Card padding: `20–28px`. Main content max-width `~780px`, padding `34–40px 48px`.
- Sidebar width `244px`.
- Subtle triangle watermark on navy: repeating SVG of thin `stroke rgba(255,255,255,0.04)`
  triangles (see the `background-image` data-URI in the HTML). Optional but on-brand.
- Progress rail: `130×6px` track `#E1E6EC`, fill `#DE5A1C`.

---

## App Shell (shared across all four screens)

**Sidebar** (`#132239`, 244px, full height, faint triangle watermark):
1. Wordmark — "TANZA / FELLOWSHIP" (FELLOWSHIP in orange), Jost 600, uppercase, tracked.
2. Primary nav: **My journey**, **My coursework**. Active item = white text on
   `rgba(222,90,28,.16)` with a 3px `#DE5A1C` left border + orange bullet.
3. (Class + Results only) Divider, then a **QA Test Module** overline and the class list
   (numbered circle badge + class name; current class highlighted orange).
4. Footer pinned bottom: orange avatar circle (initials "EM"), "Eugene Muthui", "Log out".

**Main:** `#F4F6F9` background, scrollable, content column max-width ~780px.

shadcn mapping: build as an `app/(learner)/layout.tsx` with a `<Sidebar>` component
(compose from plain divs + `lucide-react` icons; shadcn has no sidebar primitive by
default, or use `shadcn/ui sidebar` block if installed). Nav items = styled `<Link>`.

**Admin sidebar** (new, screens `3A`–`3C`): same shell, treatment, and 244px width as
the learner sidebar, but a separate layout/route group:
1. Wordmark, plus an "ADMIN" overline (`Jost`, 11px, tracked, `#7C8DA6`) underneath.
2. Primary nav: **Curriculum**, **Cohorts**, **Grading** — same active/idle styling as
   the learner nav (no module/progress section under it).
3. Footer pinned bottom: just a "Log out" link (no avatar — no admin identity is shown
   in the source screens).

shadcn mapping: `app/(admin)/layout.tsx` with the same `<Sidebar>` component, passed a
different `items` prop (and no user-footer avatar).

---

## Screens

### 1. Class / lesson view (id `2A` in the prototype)
- **Purpose:** Learner reads the class, opens resources, watches the video, takes the
  assessment, and can post questions.
- **Layout:** Shell + main column. Top row: overline "QA Test Module · Class 1 of 1"
  (left) and progress rail "35%" (right). Then H1 "QA Test Class", meta line.
- **Components:**
  - **Rich text:** H2 "Testing Class Builder", paragraphs (`text-body`, 16px/1.7),
    `<ul>` and `<ol>` (padding-left 22px, line-height 1.9), `<em>`/`<strong>` inline.
    → render sanitized rich-text HTML; style with Tailwind `prose`-like rules matching tokens.
  - **Resources** (overline "Resources" in orange): stacked rows, white, `border` +
    **3px `#DE5A1C` left border**, radius 6px. Left: rounded icon chip (link = orange on
    `#FDEEE4`; PDF = navy on `#EEF1F4`) + title (15px/600 navy). Right: faint meta
    ("opens in browser" / "PDF · 3.7 MB"). → `Card` + `lucide-react` Link/FileText icons.
  - **Video:** 16:8 placeholder, circular play button, bottom-left "Tap to stream…"
    caption; italic caption below. → real player.
  - **Assessment card:** bg `card-alt` `#EEF1F4`, `border`, radius 8px. Title "Untitled
    assessment" (Jost 600 19px), meta "2 questions · about 4 minutes". Top-right outline
    pill "Not started". Orange primary button "Start assessment". → `Card` + `Badge`
    (outline) + `Button` (primary orange).
  - **Questions block:** H3 "Questions". Container bg `card-faint` `#FBFCFD`, `border`
    `#EAEEF3`, radius 10px, padding 18px, holding a white `Textarea` (`text-input`
    `#1E2B45`) + right-aligned navy "Post question" button. Below: "No questions yet."
    (`#4A4436`). → `Textarea` + `Button variant="secondary"` (navy).

### 2. My journey (id `2B`)
- **Purpose:** Overview of modules/classes and progress across the cohort.
- **Layout:** H1 "Your journey", overline "COHORT 1", then stacked module cards.
- **Components:**
  - **Module card:** white, `border`, radius 10px. Header row = module name (Jost 600
    18px) + optional status pill.
  - **Locked class row:** title in `text-muted` (dimmed), subtitle "Not yet scheduled"
    (`#A0AABB`), right outline pill "Locked" on `#F7F8FA`.
  - **In-progress module:** header pill "In progress" (orange on `#FDEEE4`); class row has
    a **3px orange left border**, numbered orange circle + class name, and an orange
    "Continue" `Button` at right.
  - → `Card`, `Badge`, `Button`.

### 3. My coursework — "Your development" (id `2C`, **updated 7/9/2026**)
- **Purpose:** Reworked from a flat submissions list into a full development dashboard:
  aptitude standing, cohort-relative position, qualitative strengths/gaps, module
  progress, then the original coursework list below.
- **Layout:** H1 "Your development", meta line "Cohort 1 · QA Test Module — updated
  7/9/2026". Then, top to bottom: 3-up scorecard row, "You and the cohort" panel,
  2-up Strengths/Focus next row, a module progress bar + caption, then H2 "Your
  coursework" and the submission list (unchanged pattern from before, plus a
  "Graded" badge).
- **Components:**
  - **Aptitude scorecard** (×3 — Leadership, Strategic, Technical): white `Card`,
    `border`, radius 10px. Faint label (13px `text-faint`), big number (Jost 600
    36px navy), then a delta row: `↓`/error-red or `↑`/success-green comparison text
    ("80 vs Government Engagement") + faint "· N signals" right-aligned. Technical has
    no comparison yet, so it shows only the signals count.
  - **"You and the cohort" panel:** white `Card`. Title + faint subtitle legend
    ("Shaded band = middle half of the cohort · dot = you (all-time)"). Three labeled
    rows (Leadership/Strategic/Technical), each an 8px rounded track (`#ECEFF3`) with
    an optional darker shaded band (`#D3D9E1`, the cohort's middle-half range) and a
    16px navy dot (the learner's position), dot ring `0 0 0 3px #fff` so it reads over
    the band. → build as a small reusable `<CohortBar value band? />`, values in %.
  - **Strengths / Focus next:** 2-up `Card` row. "Strengths" tags are solid navy pills,
    white text (`Public Communication`, `Policy Analysis`). "Focus next" tags are
    outline pills, `border-input`, white bg, navy text (`Stakeholder Mapping`,
    `Community Consultation`). → `Badge` variants (`solid-navy` / `outline`).
  - **Module progress:** full-width 8px orange (`#DE5A1C`) rounded bar (reflects e.g.
    2 of 2 classes = 100%), caption below "2 of 2 classes · 1 assessment pending"
    (`text-muted`).
  - **Submission row (updated):** same white `Card` pattern as before, but the status
    badge is now a solid navy "Graded" pill (not an outline "Submitted" one), and the
    points value ("28/30 pts", Jost 600 15px) reads in plain navy rather than
    error/success color — grading outcome is no longer binary pass/fail. "View" button
    unchanged → routes to Results.

### 4. Assessment results (id `2D`)
- **Purpose:** Review a submitted attempt question-by-question.
- **Layout:** overline "QA Test Module · QA Test Class"; header row = H1 "Untitled
  assessment" + outline "← Back to class" button. Then summary strip and question cards.
- **Components:**
  - **Summary strip:** white, `border` + 3px orange left border, radius 8px. "0/20 points
    so far" (Jost 600 17px) + faint "· 1 question awaiting grading"; timestamp line
    "Submitted 08/07/2026, 18:22:53".
  - **Question card (short answer, Q1):** white `Card`. Orange "Q1" label, prompt
    paragraph, the learner's answer in a `#F4F6F9` boxed field, warning pill
    "Awaiting grading".
  - **Question card (multiple choice, Q2):** orange "Q2" label, bold prompt, option rows:
    - neutral option: `border`, white.
    - **correct option:** success colors + green circular check mark.
    - **selected-wrong option:** error colors + red circular ✕, right-aligned
      "YOUR ANSWER" label in red.
    - footer "0/20 points" (Jost 600, `text-muted`).
  - → `Card`, `Badge` (warning/success/error variants), option rows as styled divs.

### 5. Admin — Cohort overview (id `3A`, **updated 7/9/2026**)
- **Purpose:** At-a-glance health snapshot for one cohort.
- **Layout:** Admin sidebar (Cohorts active) + main, reworked into full-width stacked
  sections (not a 2-column split) so Attention and Capability gaps each scale
  independently as more fellows/skills are added — no truncated labels, no lopsided
  whitespace. H1 "Cohort 1", meta "7 fellows". 4-up stat card row, then full-width
  "Attention" section, then full-width "Cohort capability gaps" section.
- **Components:**
  - **Stat card** (×4 — Needs support, Exceptional, Median score, Signals this week):
    same white `Card` pattern as the learner scorecards. Needs support number in error
    red, Exceptional in success green, the other two in navy.
  - **Attention:** full-width responsive grid (`auto-fill, minmax(300px, 1fr)`) of
    flagged-fellow cards — avatar-initial circle (error tint if flagged low, success
    tint if flagged for excelling), name (Jost 600 15px navy), reason line ("Technical
    24 · 7 signals", colored to match the flag), and an outline "View" button. Grid
    wraps as more fellows are flagged, rather than a fixed side column.
  - **Cohort capability gaps:** white `Card` spanning the full content width,
    containing labeled rows — each a fixed-width label (14px navy, 220px column so
    long skill names never truncate) + thin 6px track (`#ECEFF3`) + fill (orange
    `#DE5A1C` normally, error red `#C44A2E` when the score is low/at-risk, e.g. below
    ~50) + right-aligned value.

### 6. Admin — Cohorts (id `3B`, **new**)
- **Purpose:** Roster management across cohorts; reassign fellows between cohorts.
- **Layout:** Admin sidebar (Cohorts active) + main, wider content (no max-width cap,
  frame widened to 1280px to fit the table). H1 "Cohorts", then one card per cohort.
- **Components:**
  - **Cohort card:** white `Card`. Header: cohort name (Jost 600 19px) + neutral
    "active" pill (`#EEF1F4` bg, `text-muted`). Meta line below: start date,
    enrolment window, fellow count (`text-faint`).
  - **Roster table:** header row (Name / Email / Assigned by / Move to, Jost 600 11px
    tracked uppercase `text-faint`), then rows on a 4-column grid: name (Jost 600
    14.5px navy), email (`text-muted`), "Assigned by" as an outline pill ("system"),
    and a "Move to" cluster — a disabled-look outline select ("Choose cohort" +
    chevron) plus a disabled outline "Reassign" button (enables once a cohort is
    chosen). → `Table`/`Select`/`Button` (disabled state — faint border/text, `#F7F8FA`
    bg).

### 7. Admin — Grading queue (id `3C`, **new**)
- **Purpose:** Work queue of ungraded assessment responses across the cohort.
- **Layout:** Admin sidebar (Grading active) + main, 1280px frame. H1 "Grading
  queue", subtitle "N responses awaiting grading", then one table `Card`.
- **Components:**
  - **Queue table:** header row (Fellow / Class / Question / Attempt / Submitted /
    Points, same tracked-uppercase style as the Cohorts table). Row grid: fellow name
    (navy, 600), class (muted), full question text (`text-body`, wraps — give it the
    most flex space), attempt ("Attempt 2 of 2" + an optional outline pill "Counts
    toward score" stacked underneath when this attempt counts), relative timestamp
    ("20 hours ago", faint), points ("10 pts", Jost 600 navy), and a primary orange
    "Grade" button. → `Table` + `Badge` (outline) + `Button` (primary).

---

### 8. Log in (id `4B`, "Split hero", **selected direction**)
- **Purpose:** Authenticate before entering the learner/admin app.
- **Layout:** No sidebar (pre-auth). Full-height two-pane split: a navy brand panel
  on the left (46% width) doubles as the "banner" seen on other login layouts explored;
  a plain white pane on the right holds the borderless login form, vertically and
  horizontally centered.
- **Components:**
  - **Brand panel:** `#132239` navy, same triangle watermark as the app sidebar,
    centered content — "TANZA" wordmark (Jost 600, 6px tracked, 40px, white),
    "FELLOWSHIP HUB" sub-line (Jost 600, 4px tracked, 15px, orange), a thin 40px
    divider rule (`rgba(255,255,255,0.18)`), then a one-line tagline ("Leadership
    development for Tanzania's changemakers.", 14px, `#9FB0C8`).
  - **Form pane:** white background, 360px form column. H1 "Log in" (Jost 600 26px
    navy). `Email` and `Password` fields — Jost 600 13px navy label, white input,
    `border-input` `#D6DBE3`, radius 8px, 12px/15px padding. Full-width primary
    orange `Button` "Log in". Footer line "Need an account? Sign up" (Sign up = orange
    link).
  - → `Card`-less layout (just a flex split); `Input`, `Button` (primary), `Label`.
- **Note:** two other login layouts (`4A` top banner, `4C` banner card) were explored
  in the same combined file for reference, but **4B is the one to build** — the others
  can be treated as rejected options.

## Interactions & Behavior
- **Nav:** sidebar items route between the four screens; active state per current route.
- **Continue** (My journey) → Class view. **Start assessment** (Class) → assessment
  flow. **View** (Coursework) → Results. **Back to class** (Results) → Class view.
- **Post question:** appends to the questions list; empty state "No questions yet."
- **Progress rail:** reflects real class/module completion %.
- **Hover:** buttons darken (orange → `#B8460F`; navy → slightly lighter); outline buttons
  fill faint navy tint; links → `#B8460F`. Cards may lift subtly (optional).
- **Locked** classes are non-interactive/disabled.
- **Admin nav:** sidebar items route between Cohort overview, Cohorts, and Grading
  (Curriculum has no screen yet — nav item only). **Reassign** (Cohorts) is disabled
  until a target cohort is chosen in the "Move to" select. **Grade** (Grading queue)
  opens the grading view for that attempt (not designed yet).

## State Management
- Current route → active nav + which sidebar module section shows.
- Class: assessment status (`not_started | in_progress | submitted`), questions array,
  progress %.
- Coursework: submissions list (title, module, class, submittedAt, score, maxScore, id).
- Results: attempt detail — per-question type, prompt, learner answer, correct answer,
  grading status, points. Fetch by attempt id.
- All data currently mocked in the prototype; wire to the real API/data layer.

## Assets
- **Fonts:** Jost + Mulish (Google Fonts) via `next/font`.
- **Icons:** use `lucide-react` (Link, FileText, Check, X, Lock, Play, etc.) in place of
  the emoji/unicode glyphs in the prototype.
- **Logo/wordmark:** rebuilt in type; if a brand SVG exists, use it. Brand palette taken
  from tanzaventures.com.
- **Video/images:** placeholders only — connect to real media.

## Files
- `Tanza Fellowship Hub — Combined.dc.html` — the hifi design reference (all screens,
  tagged `2A`/`2B`/`2C`/`2D` for learner, `3A`/`3B`/`3C` for admin, and `4A`/`4B`/`4C`
  for the login exploration — build `4B` only). Open in a browser to inspect exact
  styles/measurements.
- `screenshots/` — rendered previews of each screen:
  - `2A-class-view.png`
  - `2B-my-journey.png`
  - `2C-your-development.png` (updated 7/9/2026 — was `2C-my-coursework.png`)
  - `2D-results.png`
  - `3A-admin-cohort-overview.png` (updated 7/9/2026 — full-width stacked layout)
  - `3B-admin-cohorts.png`
  - `3C-admin-grading-queue.png`
  - `4B-login-split-hero.png` (new — selected login direction)
