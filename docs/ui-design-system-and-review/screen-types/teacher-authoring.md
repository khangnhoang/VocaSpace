# VocaSpace Teacher Authoring Common Design

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — published as the Teacher Authoring screen-type design; not runtime implementation authority |
| Accepted candidate identity | `TA-CANDIDATE-1`; Owner-accepted pre-publication SHA-256 `78D30BCE07ADA7BAB941C1B730AEBB3A5AB4571E684F23DA5E2160514ED77C94` on 2026-09-28 |
| Upstream contract | [Accepted Product Language](../product-language.md) and [UI-2 Detail Plan](../implementation-plans/ui-2/plan.md), Stage 2B |
| Repository evidence | Current Teacher routes and screens, course readiness/count projections, enrollments/payments, learner progress and answer/review records, collaborator/authorship/review contracts, and structure operations inspected on 2026-09-27 |
| Review evidence | The final non-authoritative interactive aid reflects the Owner-reviewed direction but does not replace the durable accepted artifact |
| Scope | Common Teacher Authoring information architecture, insight/action hierarchy, scalable structure management, content-authoring continuity, feedback, responsive behavior, and accessibility |
| Excludes | Runtime implementation, production analytics queries/formulas, route or permission changes, exact shared-component construction, and UI-4 surface specifications |

This artifact specializes the accepted Product Language for Teacher Authoring (TA). It defines what a Teacher workspace should help people understand and do; it does not claim that current runtime routes already conform or that the review fixtures are production data.

## 1. Correction basis and evidence boundary

The superseded candidate reduced Course Overview to readiness triage and made content-schema counts its primary visualization. That failed two Teacher jobs: understanding how a course is being used and choosing the next useful authoring or collaboration action. It also illustrated Structure as an almost fully expanded chapter/topic tree, which does not scale beyond a small course.

The corrected candidate preserves useful parts of the prior work — accepted tab grammar, human-readable context, direct editing, truthful lifecycle and recovery — while changing the information architecture:

- The Teacher course portfolio becomes the private workspace entry before a course is selected.
- Overview becomes an insight-and-action surface with populated and no-data states.
- Structure owns content totals and scalable, progressively disclosed chapter/topic management. The current review pattern uses a chapter navigator plus selected-chapter workbench as evidence, not as mandatory surface geometry.
- Topic builder owns actual content creation, lifecycle, save, validation, and recovery.
- Review aids may use clearly labeled deterministic synthetic values. Production queries, aggregation formulas, privacy rules, and live values remain later runtime/domain work.

Repository evidence establishes four stable destinations:

```text
/teacher/courses                            Teacher course portfolio
/teacher/courses/[id]                       Course overview
/teacher/courses/[id]/structure             Structure workspace
/teacher/courses/[id]/topics/[topicId]      Topic builder
```

The design must not silently consolidate or redirect these routes, widen permissions, or change lifecycle, persistence, readiness, review, deletion, enrollment, payment, or learner-progress behavior.

## 2. Analytics capability classification

The classification below determines what a review aid may illustrate. `Direct` means a current projection already supplies the value. `Derivable` means the repository already stores the necessary facts and a new aggregate query/projection can define the result. `Bounded later data work` means the concept is feasible, but event taxonomy, privacy, permissions, or aggregation semantics must be defined before production. `Undefined` means the metric has no defensible domain meaning and must not appear.

| Analytic concept | Classification | Repository basis and production dependency | Candidate use |
| --- | --- | --- | --- |
| Chapter, topic, flashcard, exercise, question totals | `Direct` | Course readiness and `getCourseStats` already expose active content totals | Compact Structure summary and local chapter metadata; not the primary Overview chart |
| Total enrollment and enrollments over time | `Derivable` | `enrollments(course_id, user_id, enrolled_at)` and current public enrollment counts exist; Teacher-safe aggregate access needs a bounded projection/RPC | Representative primary insight in the current aid; later surfaces may choose another meaningful course insight |
| Successful purchases/revenue over time | `Derivable`, role-sensitive | `payments` stores amount, status, course, and timestamps; current read policy is narrower than all collaborator roles | Optional owner/co-owner insight only after production permission design; not required in the common aid |
| Learner completion/progress distribution | `Derivable` | Enrollments, active topics, and `user_topic_progress` completion fields support aggregation | Supporting Overview distribution; production read model must aggregate and protect learner privacy |
| Learning activity over time | `Bounded later data work` | Question answers, flashcard review state, and topic progress carry timestamps, but production must define which events count and prevent double counting | May be illustrated when the aid labels the event window and event basis |
| Top active learners in a named period | `Bounded later data work` | Enrolled users can be joined to defined learning events; production needs a privacy-safe aggregate and an explicit activity definition | Supporting populated-state list using synthetic identities and exact event counts |
| Collaborator workload/contribution | `Derivable` for named facts; broader scoring is bounded | Chapter creator, topic original/responsible author, contributors, submissions, and reviewers exist | Show responsible topics, authored chapters, or completed reviews; do not invent an “impact score” |
| Consistency/streak ranking | `Bounded later data work` | Some timestamps exist, but a stable day-level activity taxonomy is not yet owned | Defer from the current aid unless the future formula and privacy contract are defined |
| Course quality score, collaborator impact score, churn probability, unexplained engagement score, synthetic readiness percentage | `Undefined` | No semantic owner, formula, or accepted domain meaning | Prohibited |

Design may propose the first three classes. It must label synthetic fixtures as review-only and distinguish design intent from live availability. A missing helper function is not a design veto; an undefined metric meaning is.

## 3. Design thesis — Insight, action, and authoring continuity

Teacher Authoring expresses one continuous course stewardship workspace:

1. **Insight:** understand course usage, learner movement, collaboration, and meaningful changes.
2. **Action:** identify the next legal authoring, readiness, review, or management action.
3. **Continuity:** move from course-level insight to structure and one topic without losing human-readable context, state, or recovery.

**The Overview is an insight-and-action surface, not a passive metric dashboard. Analytics earn space when they help the teacher understand course usage, learners, collaboration, or authoring priorities and lead to a useful decision.**

The design is not a generic four-quadrant enterprise dashboard, a five-card KPI strip, a documentation mockup, or a single giant bordered rectangle. It uses alignment, type, whitespace, dividers, one or two bounded supporting surfaces, and clear changes in density to make a polished authoring SaaS workspace.

Falsification rule: if generic project-management copy can replace course, learner, enrollment, chapter, topic, authorship, and review language without changing the composition, the candidate is too generic.

## 4. Information ownership across destinations

| Destination | Primary ownership | Supporting context | Must not dominate here |
| --- | --- | --- | --- |
| `/teacher/courses` | Courses where the current user participates, cross-course authoring attention, relevant continuation, and permitted course creation | Search/filter/sort when portfolio size warrants them; pending collaboration invitations when applicable | Public discovery/catalog behavior, arbitrary aggregate KPIs, detailed per-course history feed |
| `Tổng quan` | Course identity/status, usage and learner insights, next action/readiness attention, collaborator context/management, general course metadata | Compact content/structure facts only when they explain an insight or action | Full structure tree, content editing, schema-count chart |
| `Cấu trúc` | Structure totals, scalable chapter/topic management, ordering, direct topic entry, hidden/restorable structure | Readiness target and preview allocation where relevant | Learner analytics, repeated Overview regions, topic content forms |
| Current topic builder | Flashcards, exercises/groups/questions, topic settings, authorship/lifecycle/review, save/error/recovery | Compact course/chapter/topic path and legal return actions | Course analytics, collaborator dashboard, full structure management |

Do not duplicate one large information region across destinations. A small count, status, or link may repeat only when it preserves orientation or supports the local decision.

### 4.1 Teacher course portfolio entry

`/teacher/courses` is a private Teacher workspace entry for courses in which the current user participates as a collaborator. It is not the public catalog with a private filter applied. The surface must combine:

- direct access to the user's courses and a clear continuation into a relevant course or authoring context;
- the create-course action only when the current permission contract allows it;
- a bounded cross-course work queue that names an affected course/content object, states the legally actionable work, and leads to that work;
- truthful collaborator role, lifecycle, rejection, readiness, or assignment context needed to choose the next action; and
- search, filter, sort, and denser scanning only when portfolio size makes them useful.

Cross-course attention may include rejected work requiring revision, a topic awaiting the current user's review, missing required content, or another authoring task assigned to or legally actionable by that collaborator. Do not replace these decisions with a generic “who edited what” activity feed; detailed actor/action history belongs to an individual course context and is outside this entry pattern.

The work queue exposes its total remaining count and stays within a bounded vertical viewport so a larger queue scrolls internally instead of extending the landing page indefinitely. When multiple actionable states exist, lightweight mutually exclusive filters use real work categories such as `Chờ duyệt` and `Cần sửa`; filtering must not materially change the surrounding page height. A separate `Xem tất cả` action is redundant when the bounded queue already exposes the complete set. This common design does not prescribe a queue-size threshold or exact viewport height.

For a sparse portfolio of roughly one to four courses, use the remaining desktop space for useful continuation, attention, and create/manage context rather than stretching a card grid, leaving a mostly empty viewport, or inventing aggregate KPIs. The emphasized recent/relevant continuation remains part of the same course portfolio, not a separate course category. For a large portfolio, support denser scanning and introduce search/filter/sort without allowing an oversized infinite card grid or burying attention items. Exact thresholds remain surface-owned.

A representative sparse pattern may pair one recent or relevant course continuation with a compact list of other participating courses and a cross-course needs-attention region. The page-header utility area may summarize the participating-course portfolio with a compact label/count and the permitted create action. The supporting course list then begins directly with course rows and does not repeat that heading or count inside its surface. This is review evidence only: TA does not prescribe featured-course use, exact columns, panel placement, card geometry, or a fixed number of regions.

## 5. Shared course navigation and orientation

### 5.1 Course-level navigation

Real sibling course destinations use the accepted Product Language tab grammar:

- icon plus label where useful;
- quiet, readable inactive state;
- perceptible but secondary hover tint;
- Route Blue text/icon and bottom indicator for the current destination;
- one persistent bottom indicator moves between stable tab positions with the accepted bounded transform transition; switching tabs must not destroy one underline and create another;
- no pill selector, box-in-box, heavy selected fill, or positional movement.

`Tổng quan` and `Cấu trúc` are stable sibling destinations. A contextual `Bài học` item may appear only inside a real topic route and names the current lesson context; it does not invent a generic topic-index route. Review-only scene and motion controls remain visually and semantically separate.

### 5.2 Human-readable context

```text
Giao tiếp tiếng Việt / Chương 2 · Đi lại trong thành phố / Hỏi đường và chỉ dẫn
```

- Use titles, breadcrumbs, selection state, and labels; never expose ordinary route slugs, UUIDs, or database keys.
- Current destination and selected chapter/topic have semantic current/selected state.
- Course, chapter, and topic names wrap without losing the full accessible name.
- Direct entry to Structure or a topic remains first-class; the Teacher need not replay Overview first.

## 6. Course Overview — insight-and-action composition

### 6.1 Normative Overview rules

Course Overview first establishes **what course this is** through recognizable course identity, important general facts, lifecycle/status, and collaboration context before deeper insight/action content. Useful facts may include a cover, concise description, price when relevant, language, and collaborator identities/roles. Collaborator-management access remains readily discoverable for authorized roles at this identity/context level; TA does not prescribe exact hero proportions, image placement, height, or field arrangement.

Every Course Overview governed by this common design must help the Teacher answer both:

1. **How is this course doing or being used?** Use meaningful, truthful course, learner, or collaboration insight rather than decorative metrics.
2. **What useful action comes next?** Keep one authoritative next authoring, readiness, review, or collaboration action immediately discoverable without waiting for analytics.

Analytics and action form a semantic reading path: `what changed → what needs attention → why it matters → what I can do`. No exact region order, chart family, column count, sidebar position, width ratio, or desktop/mobile geometry is owned here; UI-4 or a later surface specification chooses the composition that best preserves this path.

When an authoritative issue blocks or materially delays readiness, the next-action treatment must:

- name the affected course/chapter/topic or content object;
- state the remaining work concretely;
- explain the consequence or reason;
- make the legal corrective CTA immediately discoverable; and
- receive stronger authoring-attention emphasis than ordinary metadata, proportionate to the consequence rather than defaulting to an alarming warning card.

Attention Amber is a selective semantic accent for the marker, rail, icon, or eyebrow of this treatment. Ordinary readiness-blocking attention should remain on a neutral or lightly tinted product surface with Deep Space hierarchy and an Action Blue corrective CTA. A full amber warning surface is reserved for a consequence that genuinely warrants warning-level treatment.

For roles authorized to manage collaborators, collaborator identities/roles and the management entry point remain readily discoverable from course-level context. The control must not be buried after long analytics or content, but TA does not prescribe whether a future surface places it in the mast, a compact collaboration strip, a course utility region, or another justified location.

### 6.2 Representative Overview pattern — review evidence, not required layout

The current review aid demonstrates one useful asymmetric pattern:

- a deliberate course-identity hero with meaningful cover artwork, strong title hierarchy, restrained general facts, lifecycle/status, and an attached collaboration strip before deeper analysis;
- a substantial enrollment-trend canvas;
- a visually stronger readiness-blocking next-action region;
- bounded learner-progress and active-learner support;
- compact course facts; and
- collaborator context with authorized management access available near course context.

This pattern is evidence that course identity, insight, action, collaboration, and metadata can coexist without a KPI-card grid or giant undifferentiated container. The collaboration strip uses a heading, summary, avatar stack, compact role/count context, and one authorized detail/management action rather than reducing collaboration to an inline metadata link. Its semantic path is `course identity → analytics/insight + next authoring action → supporting insight`; it does not require later Overview surfaces to preserve exact hero proportions, artwork construction, strip placement, chart choice, column proportions, action-lane placement, or collaboration-band geometry.

### 6.3 Populated analytics state

Review-only synthetic fixtures may show realistic values such as monthly enrollments, completion bands, named learners, and activity counts. Every fixture is labeled deterministic and non-production. The design must expose:

- metric name and unit;
- period/window;
- exact values through labels, table, or accessible summary;
- what the comparison means;
- no unexplained score, predictive claim, or fake precision.

Example semantic set for review, not a production contract:

```text
Enrollments · last 6 months
April 118 · May 146 · June 203 · July 227 · August 254 · September 286

Learner progress · current enrolled cohort
Not started 18% · In progress 57% · Completed 25%

Most active learners · last 30 days
Mai Anh 42 learning actions · Minh Khoa 37 · Thu Hà 31
```

### 6.4 New or low-activity state

No-data is a designed state, not a blank chart or a row of zeros:

- explain that meaningful usage data does not exist yet;
- preserve course status, next authoring action, preview, collaborator context, and structure entry;
- show the earliest truthful signal available, such as publication/enrollment state, without implying failure;
- do not fabricate trend lines, rankings, percentages, or placeholder learner identities.

### 6.5 Role and privacy boundary

- Owner/co-owner may receive management and financially sensitive insights when a future production contract grants them.
- Editor receives authoring and appropriate course/learner operational insight, but not assumed payment visibility.
- Previewer gets truthful read-only navigation and explanation; illegal authoring/management actions are absent rather than disguised.
- Production analytics must aggregate under explicit authorization and avoid exposing unnecessary learner detail. This design does not grant new table/RLS access.

## 7. Structure — scalable progressive disclosure

### 7.1 Normative Structure rules

The Structure destination must remain comfortable for both a two-chapter course and a course with roughly 10–50 chapters and many topics. It must:

- expose useful content totals and structure state without making those counts an analytics dashboard;
- avoid rendering every chapter and every topic as one permanently expanded hierarchy;
- let the Teacher find or jump to a chapter efficiently as the course grows;
- reveal enough local topic detail for management, ordering, recovery, and direct entry into authoring;
- preserve selected/current context, legal actions, focus, and confirmed order across refreshes; and
- keep hidden/restorable structure behind a clearly named recovery path.

Search, collapse/expand, master/detail, bounded scrolling, progressive disclosure, pagination, or virtualization are implementation options. Later surface work chooses the smallest mechanism justified by real scale and performance; this common design does not mandate one geometry or width.

### 7.2 Representative navigator/workbench pattern — review evidence, not required layout

The current review aid demonstrates a compact searchable chapter navigator paired with one selected-chapter workbench. The navigator shows order, title, local counts, and truthful attention state; only the selected chapter mounts detailed topic rows. The workbench shows position, title, local totals, responsible author where useful, lifecycle, ordering controls, and direct `Mở bài học` entry.

This pattern proves that a 24-chapter fixture can remain bounded without an infinite tree. It does not freeze a permanent two-column layout, navigator width, workbench dimensions, row construction, or the rule that every future surface must use master/detail.

### 7.3 Common content and action constraints

- Direct content totals such as chapters, topics, flashcards, exercises, and questions may form a compact scan aid; they are not a readiness score or a five-card KPI strip.
- Repeated chapters/topics prefer dense list or table rhythm, alignment, and dividers over elevated card-per-row treatment. When represented as columns, header and rows share one column model; order/reorder owns a fixed-width column with centered controls so topic, content, status, and action cells cannot drift.
- Add, rename, hide/restore, move, search/jump, and direct-edit controls stay identifiable with the affected object.
- Ordering remains explicit and keyboard/mobile accessible; confirmed movement announces the new position and restores meaningful focus.
- A deep-linked readiness target reveals the relevant chapter/topic without expanding unrelated hierarchy.
- Pagination or virtualization is added only when measured size/performance warrants its complexity.

### 7.4 Small, large, and narrow behavior

- Small structures must not stretch sparse navigation into large empty regions.
- Large structures must bound simultaneous detail and preserve efficient search/jump; the review pattern mounts only the selected topic set, but another pattern may satisfy the same invariant.
- Narrow screens use sequential disclosure with an explicit way back to chapter navigation; do not squeeze desktop columns, require drag gestures, or fall back to an all-expanded page.

## 8. Topic builder — focused content authoring

The topic builder is a continuous content workbench:

- show course/chapter/topic path, topic lifecycle, responsible author, and read-only reason before content;
- use the accepted icon-plus-label tab grammar for `Từ vựng`, `Bài tập`, and `Cài đặt`;
- place one clear local add action in the active tab;
- preserve exercise → group → question hierarchy through indentation, labels, and dividers rather than nested elevated cards;
- edit one content object without losing topic or parent context;
- keep save distinct from lifecycle actions such as submit, withdraw, approve, or reject;
- keep the newest rejection reason and legal revision path visible;
- preserve input through invalid, pending, failed, stale, and permission changes.

## 9. Action, status, and feedback language

| Tier | Uses | Presentation intent |
| --- | --- | --- |
| Primary | Advance the current insight/action decision, create required structure, save focused content, or submit when legally ready | One Action Blue filled action per local decision area |
| Secondary | View structure, preview, compare period, return, cancel | Route Blue text by default; outlined when stronger affordance is justified |
| Local | Select chapter, add topic, direct edit, move, restore, open detail | Compact labeled control near its object; icon-only only with complete accessible name |
| Destructive | Hide course/chapter/topic/content, reject review | Quiet red entry and explicit confirmation with identity, consequence, reversibility, cancel, and confirm |

Use repository-owned states (`Bản nháp`, `Chờ duyệt`, `Đã xuất bản`), real collaborator roles, explicit pending verbs, and named readiness issues. Never treat analytics motion or loading as authorization to hide the next action.

### Recovery contract

| State | Required behavior |
| --- | --- |
| Loading analytics | Preserve course context, navigation, and the next legal action; label the loading insight region without shifting focus |
| Analytics unavailable | Explain that insight data could not load; keep authoring and structure actions usable |
| No analytics data | Show the designed low-activity state; do not draw fake charts |
| Invalid edit | Link field, corrective message, and summary; preserve values |
| Pending mutation | Prevent duplicate mutation, keep context, identify the affected object |
| Confirmed mutation | Announce the exact change, refresh authoritative data, restore meaningful focus |
| Failed mutation | Never show success; preserve input and prior confirmed order/state; expose retry |
| Stale target | Retain nearest valid course/chapter/topic context and route safely |
| Read-only | Keep content and permitted insights legible; remove illegal actions and state why |

Toast may reinforce a result but cannot be the sole material status or recovery message.

## 10. Density and visual composition

- Keep body copy at least `14/22` and compact labels at least `12/16`.
- Use `24–32px` between major regions and `12–16px` within related groups on wide screens; reduce outer margins before compressing controls or text.
- Use major borders only to bound a real functional or supporting region. Avoid both card grids and one undifferentiated giant bordered rectangle.
- Prefer list/table rhythm for repeated learners, chapters, topics, content, and collaborators.
- Use whitespace to separate insight, action, and management roles; do not leave large unused desktop voids.
- Color supports meaning and comparison but does not replace labels, exact values, selected state, or status text.
- Runtime implementation may use SVG/canvas/library components later; this artifact owns hierarchy and semantics, not the charting dependency.

## 11. Responsive behavior and complexity limits

### Wide screens

- The chosen primary insight receives clear prominence; supporting insight, action, collaboration, and metadata remain proportionate to their jobs.
- Large Structure navigation and simultaneous detail remain bounded while the active management task receives usable space; exact columns and widths belong to the surface specification.
- Sticky regions are allowed only when they do not cover chart labels, errors, dialogs, or the last content row.

### Narrow screens

- Preserve semantic priority: course context/navigation, authoritative next action, meaningful insight or no-data explanation, and collaborator access remain readily discoverable without requiring a fixed region order.
- Charts use horizontal scrolling only inside a clearly labeled plot when labels cannot remain legible; the page itself must not overflow.
- Provide a textual/table summary for chart values and do not depend on hover.
- Stack CTA pairs and retain at least `44 × 44px` touch targets.
- Structure uses bounded sequential/progressive disclosure rather than an all-expanded tree; the review pattern uses chapter-list → selected-chapter detail but that geometry is not mandatory.
- Tabs remain a normal non-scrolling row when they fit. At narrow widths they may scroll horizontally only when needed, with scrollbar chrome hidden, no vertical overflow, and icon, label, selection, indicator, touch, and keyboard semantics preserved.
- Long Vietnamese names, feedback, and analytics labels wrap without clipping.

## 12. Keyboard, focus, and accessibility

- One route-level `h1` names the current surface; insight, action, Structure navigation/detail, and builder regions use ordered headings and landmarks appropriate to the chosen composition.
- Product and builder tabs implement the established keyboard tab pattern with one roving tab stop.
- Charts have a concise accessible summary and exact values available without color, hover, pointer precision, or animation.
- Period/filter controls expose selected state and do not masquerade as primary actions.
- Structure selection, search/jump, reorder, direct edit, restore, and management controls identify their object.
- Structure navigation moves or announces context without stealing focus unexpectedly; sequential narrow patterns return focus to the item that opened detail.
- Dialog/sheet focus enters the relevant title/field, stays within the modal, and returns to its invoker.
- Validation links labels, fields, and error text; live regions announce material async results without narrating ordinary typing.
- Reduced motion preserves identical data, state, order, focus destination, and actions.

## 13. Motion

TA motion remains restrained and purposeful:

- `120ms` immediate response for hover/focus emphasis;
- `220ms` state transition for tab/filter selection, save/result feedback, or an insight state changing;
- up to `240ms` spatial reveal for a disclosure, dialog, sheet, or master-detail continuity cue.

Data charts may reveal once with opacity or bounded stroke/bar progression only when it helps comparison; exact values and actions are available immediately. Reorder confirmation must not obscure the settled order or focus. No decorative ambient motion, perpetual pulse, confetti, or learner-style celebration.

Under reduced motion, remove translation/scale/stagger and show the settled state immediately or with opacity up to `100ms`.

## 14. Representative state plates

These are type-level applications with deterministic review fixtures, not route specifications or production values.

### Plate A — Populated Overview

```text
Giao tiếp tiếng Việt                         Đã xuất bản · Biên tập viên
[Tổng quan]  Cấu trúc  Bài học hiện tại

Enrollments · 6 months                 Next authoring action
118  146  203  227  254  286          Review 2 lessons awaiting revision
[accessible monthly values]            [Open review queue]

Learner progress                        Most active · last 30 days
18% not started                         Mai Anh · 42 actions
57% in progress                         Minh Khoa · 37 actions
25% completed                           Thu Hà · 31 actions

Collaborators · roles · grounded workload facts · Manage team (authorized roles)
```

### Plate A0 — Sparse Teacher course portfolio

```text
Khóa học của tôi                    Courses you collaborate on
                                     3 courses
                                     [+ Create course] when permitted

Continue: Giao tiếp tiếng Việt
Chapter 3 needs two correct answers                    [Continue authoring]

Phát âm nền tảng · Editor · Draft                      [Open]
Business English · Co-owner · Needs correction         [Open]

Needs your attention · 7        [All] [Awaiting review] [Needs correction]
┌ bounded scroll viewport ──────────────────────────────────────────────┐
│ Business English · rejected work requires revision          [Revise] │
│ Tiếng Việt nền tảng · one topic awaits your review     [Review topic]│
│ … remaining actionable work scrolls within this region …             │
└───────────────────────────────────────────────────────────────────────┘
```

This plate demonstrates useful sparse-portfolio composition, not mandatory featured-course geometry or region ordering. Every attention item is deterministic review evidence and must map to a truthful production permission/status contract before runtime use.

### Plate B — Low-activity Overview

```text
No usage trend yet
This course has not accumulated enough enrollment or learning activity for a meaningful trend.

Status: Draft · 0 enrollments
Next action: Complete Chapter 1 structure
[Open Structure]   Preview

Collaborators and course facts remain available.
```

### Plate C — Large Structure

```text
Structure summary: 24 chapters · 132 topics · 640 flashcards · 58 exercises

Chapter navigator                  Selected chapter: 08 · Travel situations
[Search chapters]                  6 topics · 42 flashcards · 4 exercises
01 Foundations        5 topics     1 Asking for directions     Published  [Open]
02 Introductions      4 topics     2 At the station            Draft      [Open]
...                                3 Airport check-in           Pending    [Open]
08 Travel situations  6 topics     ...
...                                [+ Add topic]
24 Final review       3 topics
```

In this representative pattern, only the selected chapter exposes topics. Search and bounded scrolling demonstrate one way to avoid an infinite tree; later surface work may choose another pattern that preserves the same scale invariant.

### Plate D — Topic builder and recovery

```text
Giao tiếp tiếng Việt / Travel situations / Asking for directions
Draft · Responsible author: An Nguyen
[Vocabulary] [Exercises] [Settings]

Save failed: Changes were not saved. Your input is still here.
[Retry]  Discard unconfirmed changes
```

## 15. Review and falsification checklist

1. Does `/teacher/courses` work as a private Teacher portfolio for both sparse and large collaborator-owned course sets without becoming a public catalog, empty card grid, KPI filler, or activity feed?
2. Does Overview answer both “how is the course being used?” and “what should I do next?”
3. Is every insight direct, derivable, or feasible with bounded later data work, with no undefined score or predictive magic?
4. Can populated and no-data states both lead to a useful legal action?
5. Are portfolio, Overview, Structure, and topic-builder information roles distinct without losing continuity?
6. Can Structure handle two chapters and 10–50 chapters without an infinite expanded tree or duplicated hierarchy?
7. Does the chosen scalable Structure pattern support direct topic entry, ordering, recovery, and focus continuity?
8. Are role differences and privacy boundaries truthful without granting new access?
9. Do pending, failure, stale, rejection, read-only, and analytics-unavailable states preserve useful work?
10. At narrow widths, are portfolio items, charts, tabs, Structure disclosure, long Vietnamese text, and critical actions usable without page overflow?
11. Can keyboard and assistive-technology users obtain the same insight values and perform every critical action?
12. Does the composition use desktop space intentionally without card-grid fragmentation, giant empty surfaces, or a generic four-quadrant dashboard?
13. Does motion clarify state/disclosure without delaying action or becoming decorative?

## 16. Explicit non-goals and downstream ownership

This TA common design does not:

- implement or authorize analytics queries, RPCs, schemas, events, tracking, RLS, chart libraries, or production formulas;
- decide financially sensitive insight visibility beyond requiring an explicit later permission contract;
- guarantee that every feasible analytic is shipped;
- consolidate, add, remove, or redirect Teacher routes;
- change Course → Chapter → Topic relationships, permissions, readiness order, review lifecycle, preview quota, soft-delete, enrollment, payment, or learner-progress behavior;
- define autosave, live co-editing, an arbitrary score, a prediction model, or a general workflow engine;
- require pagination/virtualization before measured scale or performance warrants it;
- select exact shared Button, tab, chart, input, sheet, dialog, toast, tree, or table construction;
- migrate current runtime components or approve a UI-4 Teacher pilot surface; or
- make synthetic review fixtures or the interactive aid a source of truth.

Product Language owns shared identity. TA owns the presentation role, hierarchy, and semantic constraints of Teacher insights and authoring work. Later domain/runtime work owns production data definitions, safe aggregation, privacy, permissions, queries, tracking, real values, and performance. UI-3 owns exact shared primitives; UI-4/later surface work owns route-specific implementation and browser acceptance.

## 17. Acceptance boundary

The Owner accepted exact `TA-CANDIDATE-1`, pre-publication SHA-256 `78D30BCE07ADA7BAB941C1B730AEBB3A5AB4571E684F23DA5E2160514ED77C94`, through `TA-ACCEPT` on 2026-09-28. The acceptance covers Overview insight/action hierarchy, analytics semantics and limits, scalable Structure composition, topic-authoring continuity, density, action/status language, responsive behavior, and accessibility. It authorizes this publication checkpoint only; runtime implementation, analytics data work, shared-component decisions, route-specific UI-4 composition, and remote actions remain separately owned.
