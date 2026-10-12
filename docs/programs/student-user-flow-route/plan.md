# Master plan — Student/user flow and route refactor

Progress: [progress.md](./progress.md). Problems: [problems.md](./problems.md). Deferred features: [future-features.md](./future-features.md). Decision record: [ADR](../../adr/refactor-student-user-flow-route-adr.md). Each unit has a detail plan at `implementation-plans/<unit>/plan.md`.

This file was migrated to the repository templates and translated to English on 2026-10-05. The previous Vietnamese text is in Git: `git show eb36618:docs/refactors/student-user-flow-route/plan.md`.

## 1. Goal and outcome

- Goal: give every actor a clear route namespace and user flow: teacher authoring under `/teacher/courses`, a public catalog and detail under `/courses`, a student dashboard at `/learn`, an enrolled course overview, a learning workspace driven by the URL, and `/profile` for account management only.
- Outcome 1: teacher authoring lives only under `/teacher/courses`, with no legacy redirect and no duplicate UI (Wave A).
- Outcome 2: `/courses` is the public catalog and `/courses/[course-slug]` the public detail (Wave B).
- Outcome 3: `/learn` is an authenticated student dashboard and `/profile` is account management only (Wave B).
- Outcome 4: `/learn/[course-slug]` is the enrolled course overview and `/learn/[course-slug]/[topic-slug]` opens exactly the topic in the URL (Wave C).
- Outcome 5: topic authoring, review and publication, internal previewer access, public topic preview, memory check and server-derived topic completion are delivered as separate units (Wave D).
- Size and risk: large. This is a route and user-flow refactor, not a rewrite of the learning engine. Large product rules (preview quota of 20 percent, memory check, completion server truth, future question analytics) are recorded here so designs do not drift, but they are not pulled into the early PRs.
- Owner of the program: the VocaSpace maintainers. Planned 2026-07-05; last program, dependency and ownership review 2026-10-02.
- Scope: route namespace for teacher authoring, public course catalog, public course detail, student learning dashboard, enrolled course overview, learning workspace, profile and account separation, pending payment reminder, and the backlog boundaries around preview, topic publish, topic completion, memory check, FSRS review and Google OAuth.

### How to read the sources

- The repository and its commit and merge history are the final evidence of what is implemented. [progress.md](./progress.md) records the current workflow state; check it against repository evidence before planning or implementing from it.
- This plan owns target scope, dependency order and acceptance criteria at wave level. Its planning-time baseline text must not be used to deny newer state in `progress.md`.
- A per-unit detail plan owns that unit's implementation contract. An owner-review brief is only a decision summary and never overrides a detail plan; existing briefs stay as history under the legacy banner.
- [problems.md](./problems.md) owns defects, risks and technical constraints. [future-features.md](./future-features.md) owns deferred product features. The ADR owns durable decisions, not current status.
- If sources conflict, stop and reconcile against repository evidence instead of picking the more convenient document.

### Planning-time baseline (historical)

Teacher authoring used `/courses` (`app/(teacher)/courses`). The homepage listed public courses, public course detail lived temporarily at `/learn/[course-slug]`, `/learn` was a placeholder, and `/profile` carried learning surfaces. Problems at planning time and where each was resolved:

- Teacher authoring held `/courses` and blocked the public catalog: resolved in Wave A.
- `proxy.ts` guarded `/teacher` but teacher authoring was not under `/teacher`: resolved in Wave A.
- Public course cards could point to `/learn/...` instead of the canonical public detail: resolved in B1.
- `/learn` was not a student dashboard: resolved in B2.
- `/learn/[course-slug]` is the enrolled overview and public detail is canonical at `/courses/[course-slug]`: resolved in B3 and C1.
- `/learn/[course-slug]/[topic-slug]` uses the exact course and topic URL as the full source of truth: resolved in C2.
- `/profile` was pulled into the learning dashboard surface: resolved in B2.
- Pending payment had backend state but no dashboard reminder contract: resolved in B2.
- Completion and progress could not represent a memory check and all-exercise completion: addressed by D3 and D4.

## 2. Owner decisions

Decisions are numbered as in the previous master plan. A date is shown only where the Vietnamese source recorded one; the others were recorded without a date.

1. (2026-07-05) Teacher authoring hard-cuts from `/courses` to `/teacher/courses`.
2. (2026-07-05) The old teacher `/courses/*` is not kept by redirect.
3. (2026-07-05) Teacher UI is not duplicated under both `/courses` and `/teacher/courses`.
4. (2026-07-05) `/courses` becomes the public course catalog after the teacher namespace has moved.
5. `/courses/[course-slug]` becomes the public course detail.
6. Homepage `/` stays the public landing and shows only featured or highlighted courses.
7. The old public detail at `/learn/[course-slug]` is kept temporarily, then redirects to `/courses/[course-slug]` once the `/learn` dashboard is done.
8. (2026-07-05) `/learn` is the authenticated student dashboard, not a course gallery.
9. `/learn/[course-slug]` is the enrolled course overview and does not auto-redirect to a topic.
10. `/learn/[course-slug]/[topic-slug]` is the actual learning workspace and must open the exact topic from the URL.
11. (2026-07-05) `/profile` is account and profile management. A small shortcut to learning or review is allowed but is not the main learning UX.
12. (2026-09-15) Preview topic (D2): owner, co_owner and editor manage the marker per the [D2 detail plan](./implementation-plans/d2/plan.md). The quota is `ceil(active_topic_count * 20%)`. An active topic needs both the topic and its parent chapter not removed. Drafts count in the denominator but are not public. Public Preview opens only for a published and public course and a topic that is published, active and carries the marker.
13. (2026-09-15) A new topic follows the persisted lifecycle `draft -> pending -> published`. `authoring` is a Builder or workflow phase on `draft`. Review can be requested only with at least one active flashcard and at least one active exercise. `pending` is a frozen review state. Only a valid reviewer may approve it to `published`.
14. A topic is complete only when flashcards, the memory check (when the topic has one), all exercises and all required questions are done correctly.
15. (amended 2026-10-02; it was "mandatory" before) The memory check is authored by the teacher and is optional per topic. When a topic has one, the learner must answer everything correctly (a wrong answer is retried), the stage sits between flashcards and exercises, exercises are locked and the server checks this. A topic without one skips the stage and the D1 request-review gate is unchanged. Reuse `exercises/questions/question_options` where suitable; the contract is in the [D3 detail plan](./implementation-plans/d3/plan.md).
16. One `type` field must not carry question category, answer format and usage stage at once.
17. The pending payment reminder at `/learn` leads to the course detail and does not open a modal directly.
18. Pending payment dismissal uses `sessionStorage` keyed by `paymentId`.
19. (2026-10-02) Google OAuth, or hiding the fake Google buttons, is later work. Owner decided: build real Google OAuth, turn on email verification for password sign-up, and do not require extra profile completion after Google login. The same day the Owner split D7 into its own four-PR program, [Auth onboarding](../auth-onboarding/plan.md). This program no longer owns D7.
20. (2026-10-02) D5 (question-category analytics) is deferred because its scope is not decided; D7 goes first. D5 is not dropped.
21. (2026-10-07) Add unit F1: one PR for `NAVIGATION-001`, `STUDENT-005` and `AUTH-003` (mobile/desktop account menu parity, a root not-found page, a sign-in notice on `/login` redirects); the Owner approved these defaults on 2026-10-07: remove the dead `Cài đặt` item, one generic sign-in notice, no return-to after sign-in, the not-found page uses the client header. Contract: the [F1 plan](./implementation-plans/f1/plan.md).
22. (2026-10-08) Open D6 review UX together with the selected F1/domain tracker closeout, header regressions and `issue-deep-links` follow-up: retain ReviewSheet, no dedicated `/learn/review` route, preserve the 50-card batch limit and offer another batch after completion. Author the [D6 detail plan](./implementation-plans/d6/plan.md) on a new branch from pulled `main` and obtain an independent `gpt-6.1-sol` / `high` review; product implementation and Git publication are not granted by this decision.
23. (2026-10-08) Open [L1 learner integrity and closeout](./implementation-plans/integrity-closeout/plan.md), grouping database integrity, objective D6 QA/docs and read-only D1/D2 rollout verification. Learner answer/card writes now require the whole content chain to be active with published course/topic; preserve historical reads. This supersedes Q7's deliberate enrolled draft-write allowance. The Owner authorizes independent plan-review corrections until PASS, then a local plan commit and implementation; subjective UI/UX/motion acceptance stays with the Owner, and hosted mutation/deployment and new Git publication are separate grants.
24. (2026-10-09) Open [D8-LUI](./implementation-plans/d8-learning-ui/plan.md) as one eventual PR: documentation reconciliation (including the Owner's local D1 UI QA confirmation), bounded learner color polish (`/learn`, course overview, `/profile`) and the learning-workspace and public Preview redesign. The Owner authorized implementing the plan and its visual design as a candidate; and the explicit `Câu tiếp theo` interaction (AC7) and the design were accepted or rejected only after the Owner saw them on the running UI. Update 2026-10-09: the Owner accepted the running UI at `4bf1baa` on local; the [surface brief](../../ui-design-system-and-review/surfaces/learner/learning-workspace.md) is committed and indexed, and AC7 stands as amended in the detail plan. Two follow-ups (the D4 `flashcards_done` rule and `explanation` on correct answers) go into one later PR as `LEARNING-FOLLOWUP-001`. Push, PR, merge and deployment remain separate grants.
25. (2026-10-10) Refines the flashcard part of Decision 14 in [LF1](./implementation-plans/learning-followup/plan.md) (closes `LEARNING-FOLLOWUP-001`). The flashcard stage counts as done only when the latest saved rating of every active card is `Ổn` or `Dễ`; a later `Lại` or `Khó` clears the stage flag while topic completion stays sticky; every existing `user_flashcards` row is backfilled as Good so no learner regresses. A correct exercise answer shows the authored explanation; the memory-check UI is unchanged. Learner Data API writes stay as they are, and the memory-check-gate bypass through direct writes is a separate open problem. The hosted migration push needs its own grant, ordered after the merge deploy is READY.
26. (2026-10-10) Open [LF2](./implementation-plans/lf2/plan.md) as one PR from pulled `main`: learning-action latency (measure, then reduce server work), the `MEMORY-002` database gate on exercise answers, hosted `LEARNING-INTEGRITY-001` verification, `PREVIEW-001` evidence and D4 production QA on the free TOEIC course. The Owner accepted the detail plan's defaults the same day: no optimistic UI for now, the hosted rolled-back write smoke only with a grant at rollout time, a standing production Preview topic is the Owner's own product choice, and the latency target is set after the baseline. Implementation, push, PR, merge, migration push and hosted steps are separate grants.
27. (2026-10-11) Open [LF3](./implementation-plans/lf3/plan.md) as one PR from pulled `main`: `PERF-RLS-001` (per-parent content read checks, read boundaries unchanged), a server-enforced cards-before-memory gate (the memory check opens once every active card has been rated at least once; a later `Lại` does not close it, a newly added unrated card does; LF1 "flashcards done" stays for completion), free enrollment stays on the course page with `Bắt đầu học`, the stage thread shows a finished current stage as done, and the LF2 closeout docs with `MEMORY-002`, `PREVIEW-001` and `LEARNING-INTEGRITY-001`. This reverses the D3/D4 exclusion of a flashcards-before-memory-check gate.
28. (2026-10-12) Open [LF4](./implementation-plans/lf4/plan.md) as one PR from `main`: a topic load continues with the learner's unseen cards (with a `còn N thẻ chưa học` toast) or opens the finished flashcard screen, which offers the due cards (FSRS-due or latest rating not `Ổn`/`Dễ`) and a full review; passing the memory check shows a success toast, and a result that also completes the topic shows only the topic toast; `runLocalPsql` follows the targeted local runtime; LF3 closeout docs with `PERF-RLS-001` closed on the current evidence (action reads local only) and `LEARNING-INTEGRITY-001` closed by the hosted smoke. No database change.

### Wave D decisions steered by the Owner, 2026-09-15

These are program-level contracts. They do not grant implementation, commit, push, PR, merge or database authority. Each unit still needs a detailed brief and Owner acceptance before code.

- W1. Collaborator role boundary: the hierarchy is `owner > co_owner > editor > previewer`. `owner` acts on every lower role but not on its own row. `co_owner` acts only on `editor`, `previewer` and users without a role, never on `owner` or another co_owner. `editor` and `previewer` manage no collaborators. Only `owner` grants or revokes `co_owner`. Ownership transfer is out of scope.
- W2. Global and course authority are separate: global roles are `student|teacher|admin`, course roles are `owner|co_owner|editor|previewer`. Local authoring and review derive from valid membership and are not suppressed by a global role. A global role keeps only its own boundaries: normal course creation for `teacher`, moderation for `admin`.
- W3. Normal course creation: only a global `teacher` creates a course through the normal teacher flow; the new course is `draft` and the creator is `owner`. Admin and student do not use this flow. Admin create-on-behalf is not part of D1.
- W4. Cross-role collaborators: a global `student` or `admin` may be `co_owner`, `editor` or `previewer` and receives exactly that local authority. An admin without membership has no teacher authoring or review but keeps moderation.
- W5. Collaborator caps: active members and pending invites both count toward the cap `owner=1`, `co_owner=2`, `editor=5`, `previewer=10`. This is an adjustable policy source, not a reason to pull the whole invite implementation into D2.
- W6. Q7 internal previewer: an active course may be `draft`, `pending` or `published`. A previewer-only user reads only active `published` topics including media, and independent topic-scoped D1 authoring and review capability is kept. Persistent progress, answer and review writes, through both Server Action and Data API, require a real enrollment in the target's course; a collaborator role never grants that. Q7 does not take the other database-wide relation and correctness invariants of `LEARNING-INTEGRITY-001`.
- W7. D2 public preview: the course is active and `published`/public; the topic and its parent chapter are active, the topic is `published` and carries the preview marker. A guest, an unenrolled learner or an enrolled learner who chooses Preview sees the whole topic content including media and gets transient correct or incorrect feedback, but no progress, answer, review or learning state is saved from Preview.
- W8. D2 quota lifecycle: an active topic needs the topic and its parent chapter not removed; drafts count in the denominator but a marker on a draft is not yet public. The hard cap holds after ordinary mutations, with the moderation exception (audited) and recovery path fixed in the [D2 detail plan](./implementation-plans/d2/plan.md). Owner, co_owner and editor manage markers. Deleting a topic or chapter removes the marker inside the target. If a smaller denominator causes an over-cap after the target's markers are removed, the authorized actor must pick enough markers outside the target in the same confirmation flow; markers outside the target are never removed automatically.
- W9. D1 topic authoring, review and publication: normal course creation stays teacher-only; topic authoring derives from collaborator membership across global roles; a new topic is always `draft` and create goes straight to the Builder; request review needs both kinds of active learning content; `pending` freezes; only a valid reviewer's approve publishes; reject needs a reason and returns to `draft`; self-review is forbidden; collaborator and content mutations must keep the effective-reviewer and lifecycle invariants. Admin moderation is orthogonal to review and authoring.
- W10. D1 topic authorship amendment (2026-09-16, implemented): course authoring eligibility does not make a user a topic author. Each topic has an immutable original creator, exactly one responsible author and at most two explicit contributors. The original creator or current responsible author requests, resubmits and withdraws; contributors only edit; collaborators outside the group are read-only. Until the first successful approval, the original creator, current responsible, initial contributors and pre-approval responsible users are excluded from reviewing. Responsibility transfer is its own topic operation; a role downgrade keeps authorship; remove or self-leave with affected responsibility must transfer atomically to a valid recipient or fail closed. Transfer feedback carries topic and course context. Create navigation always uses the authoritative newly created topic id, whatever the number of existing drafts.
- W11. Published revision direction (future architecture only): later, editing a published topic uses a separate candidate revision; learners keep seeing the last published revision; candidate submit goes to pending and frozen, reject returns to editable, approve publishes the candidate and retires, archives or soft-deletes the old revision. The exact data model, migration and rollout are undecided; this is not assigned to any phase, workstream, schedule or merge order, and D1 does not implement it. Interim rule: editing published content needs a warning and explicit confirmation and demotes the topic to `draft` atomically.

## 3. Shared invariants

### Route contract

| Route | Role | Access | Main UI | Main CTA | Wave |
| --- | --- | --- | --- | --- | --- |
| `/` | Public homepage and landing | Public | Featured or highlighted courses | Go to `/courses` or a course detail | B |
| `/teacher/courses` | Course authoring list | Authenticated active collaborator; global teacher also gets the normal-create affordance | Courses the user collaborates on | Create course (global teacher only) | A |
| `/teacher/courses/new` | Normal teacher course creation | Authenticated global `teacher` | Course form | Create a `draft` course plus owner membership | A |
| `/teacher/courses/[id]` | Course overview and dashboard | Authenticated active collaborator; course-local capability by membership | Readiness and next-action dashboard | Manage structure or fix issues by capability | A, D1 |
| `/teacher/courses/[id]/structure` | Course structure workspace | Authenticated active collaborator; `owner|co_owner|editor` manage structure, topic content and delete by separate capabilities | Chapters and topics | Add, edit, soft-delete, reorder by capability | A, D1 |
| `/teacher/courses/[id]/topics/[topicId]` | Topic builder | Authenticated active collaborator; content edit by topic authoring group, including a previewer in the group | Flashcards, exercises, settings | Save topic content by topic capability; read-only outside the group | A, D1 |
| `/courses` | Public course catalog | Public | All published courses | View detail | B |
| `/courses/[course-slug]` | Public course detail | Public, auth optional | Detail, syllabus, enroll and payment | Enroll or continue payment | B |
| `/learn` | Student dashboard | Authenticated student | Enrolled courses, continue learning, progress, due flashcards, pending payment summary | Continue learning | B |
| `/learn/[course-slug]` | Enrolled course overview | Authenticated enrolled | Progress, completed and incomplete topics, next topic | Continue learning | C |
| `/learn/[course-slug]/[topic-slug]` | Learning workspace | Authenticated enrolled | Flashcards, memory check, exercises | Complete topic or next topic | C |
| `/profile` | Account and profile | Authenticated user | Profile and account settings | Edit profile, optional shortcut | B, D |

### Target student flow

```text
Guest
-> /
-> /courses
-> /courses/[course-slug]
-> login/register when enrollment requires auth
-> free enroll or paid checkout
-> pending payment resumes from course detail
-> /learn
-> /learn/[course-slug]
-> /learn/[course-slug]/[topic-slug]
-> flashcards
-> memory check
-> all exercises/questions
-> topic complete
-> next topic or course overview
```

### Invariants

- Teacher authoring is a hard cut with no legacy redirect and no duplicate UI — prevents two live namespaces and a rollback that must keep both. Rolling back means reverting the route move as one coherent PR.
- Server Actions and RLS remain the data protection layer; `proxy.ts` with `utils/supabase/middleware.ts` is the route-level guard for exactly `/teacher` and `/teacher/...` — prevents relying on a route guard for data safety.
- The topic in the URL is the source of truth for the workspace, and an invalid, locked or unavailable topic never silently falls back to the first topic — prevents opening the wrong lesson or writing progress to the wrong topic.
- The temporary B3 redirect is page-level and exact, never permanent or broad — prevents a leftover redirect rule blocking the C1 overview route.
- The dashboard reminder leads to the course detail and never opens the payment modal; dismissal is session-local and is not persisted until product needs cross-session dismissal — prevents duplicated payment state.
- Course detail owns the exact pending payment state; the dashboard shows only a summary — prevents mismatched payment state across surfaces.
- Application-path guards must not be claimed as database-wide integrity; that is the job of `LEARNING-INTEGRITY-001` — prevents false security claims.
- Memory check and completion truth are not squeezed into route migration PRs; each needs its own schema, action and progress audit — prevents hidden coupling.
- Preview never persists progress, answers, reviews or learning state — prevents a public flow writing learner data.
- A Wave D candidate needs an implementation brief and Owner acceptance before code, and a decision here is not implementation authority — prevents scope and authority creep.
- Finalized decisions are not rewritten without an approved amendment. The program does not keep an open-questions section; it uses implementation audit items in `problems.md` entries.

## 4. Units

Detail plans live in `implementation-plans/<unit>/plan.md`, except where a unit predates that layout. Delivery state (merged PRs, rollout) lives only in [progress.md](./progress.md).

| Unit | Outcome | Dependencies | Detail plan |
| --- | --- | --- | --- |
| A1 Prepare route helpers and docs | Route helpers centralized, contract documented | None | none |
| A2 Move canonical teacher route | Teacher routes under `/teacher/courses` | A1 | none |
| A3 Teacher route tests and proxy hardening | Tests and proxy match the new namespace | A2 | none |
| B1 Public catalog and course detail | `/courses` and `/courses/[course-slug]` public | A3 | [pr-b1-public-catalog-detail-plan.md](./pr-b1-public-catalog-detail-plan.md) |
| B2 Student `/learn` dashboard | Authenticated dashboard | B1 | [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md) |
| B3 Redirect old public detail | `/learn/[course-slug]` redirects to canonical detail | B2 | [b3](./implementation-plans/b3/plan.md) |
| C1 Enrolled course overview | `/learn/[course-slug]` is the overview | B3 | [c1](./implementation-plans/c1/plan.md) |
| C2 Workspace route hardening | Topic URL is the source of truth | C1 | [c2](./implementation-plans/c2/plan.md) |
| D1 Topic authoring, review, publication | Lifecycle, authorship and review contract | C2 | [d1](./implementation-plans/d1/plan.md) |
| Q7 Internal previewer access correction | Previewer read boundary and enrollment-gated learner writes | D1 | [q7](./implementation-plans/q7/plan.md) |
| D2 Public topic preview | Public readonly Preview | D1, Q7 | [d2](./implementation-plans/d2/plan.md), [design](./implementation-plans/d2/design.md) |
| D3 Memory check | Optional memory-check stage | D2 (working order) | [d3](./implementation-plans/d3/plan.md) |
| D4 Topic completion server truth | Server-derived completion | D3 | [d4](./implementation-plans/d4/plan.md) |
| D5 Question-category analytics | Deferred, no model or query yet | D4 (working order), own SSOT | none |
| D6 Review UX and scoped follow-ups | Existing review dialog, truthful batch progress, next batch and selected closeout/regressions | B2/D4 and merged F1 baseline; Decision 22 | [d6](./implementation-plans/d6/plan.md) |
| D7 Google OAuth or hide fake CTA | Moved to the [Auth onboarding](../auth-onboarding/plan.md) program (Decision 19) | Not this program | not here |
| D8 Learner color polish and learning/Preview UI (D8-LUI) | Semantic learner colors, redesigned learning workspace and public Preview, documentation reconciliation | Merged D4/D6/L1; Decision 24 | [d8-learning-ui](./implementation-plans/d8-learning-ui/plan.md) |
| D9 Deeper payment history and dashboard | Deferred or open | Product need and data boundary | none |
| F1 Learner navigation, not-found and sign-in reason | Menu parity, 404 page, sign-in notice | None (Decision 21) | [f1](./implementation-plans/f1/plan.md) |
| L1 Learner integrity and closeout | Database relation/correctness and active/published writes; D6 objective QA and D1/D2 rollout evidence | Merged D1/Q7/D2/D4/D6; Decision 23 | [integrity-closeout](./implementation-plans/integrity-closeout/plan.md) |
| LF1 Learning follow-ups | Flashcard completion by latest rating and explanation on correct answers | Merged D8-LUI; Decision 25 | [learning-followup](./implementation-plans/learning-followup/plan.md) |
| LF2 Learning latency and closeout | Faster learner write actions, memory gate in the database, hosted L1/D2/D4 evidence | Merged LF1; Decision 26 | [lf2](./implementation-plans/lf2/plan.md) |
| LF3 Content read cost and learner follow-ups | Per-parent content read checks, cards-before-memory gate, enrollment entry and stage-thread fixes, LF2 closeout | Merged LF2; Decision 27 | [lf3](./implementation-plans/lf3/plan.md) |
| LF4 Resumable flashcards and LF3 closeout | Unseen-first queue with a due-card offer, memory-check toast, isolated psql helper, LF3 closeout | Merged LF3; Decision 28 | [lf4](./implementation-plans/lf4/plan.md) |

### Wave A: teacher route hard cut

Outcome: teacher authoring moves from `/courses` to `/teacher/courses`, with no legacy redirect and no duplicate UI, leaving `/courses` free for the public catalog.

- A1. Scope: centralize teacher route links around `lib/course-authoring/routes.ts`, record the new route contract in docs, keep behavior. Out: moving route files, the public catalog, old-route redirects. Acceptance: the helper has a base path that is easy to switch to `/teacher/courses`; docs state the hard cut and no legacy redirect; teacher behavior unchanged. Verify: targeted route and helper tests, `git diff --check`.
- A2. Scope: move or rename the route namespace; update the helper base path, header, navigation, breadcrumbs, back links, revalidation paths and affected imports. Out: public catalog, legacy redirects, business logic refactor. Acceptance: teacher entry points work under `/teacher/courses`; no canonical teacher UI remains under `/courses`; teacher and admin navigation no longer points to old `/courses`; revalidation targets the new namespace. Verify: TypeScript, targeted route, component and action tests, `git diff --check`, manual QA of course list, create course, overview, structure, topic builder, refresh and back.
- A3. Scope: tests assert `/teacher/courses`; verify unauthenticated `/teacher/*` redirects through `proxy.ts`; clean stale teacher `/courses` references. Out: opening public `/courses`, RLS changes beyond a proven bugfix. Acceptance: tests no longer describe teacher authoring at `/courses`; `proxy.ts` and `utils/supabase/middleware.ts` clearly guard `/teacher`; Server Actions and RLS remain the data protection layer. Verify: focused route and proxy tests, TypeScript and lint if files change.

### Wave B: public catalog and detail, student dashboard

Outcome: `/courses` is the public catalog, `/courses/[course-slug]` the public detail, and `/learn` the student dashboard.

- B1. Scope: public `/courses` and `/courses/[course-slug]`; homepage shows at most four highlighted courses by valid enrollment count, paid and free quota and a deterministic tie-break, with no `is_featured`; guests read public syllabus metadata through a narrow contract and no protected content; the first-topic preview stays as temporary compatibility metadata (final preview management with the 20 percent quota stays deferred to D2); the payment cancel transition uses a server-resolved slug and the canonical public detail; public cards point to `/courses/[course-slug]`. Out: enrolled overview, redirecting old `/learn/[course-slug]`, enrollment-status rules or broad cache and payment refactor, memory check and completion hardening. Acceptance: a guest sees the public catalog and public detail; the homepage is no longer the full catalog. Verify: component and action tests for public queries when changed; manual QA of public navigation.
- B2. Scope: enrolled courses, continue learning, next topic, course progress, due flashcards summary, pending payment reminder summary; move learning-dashboard responsibility away from `/profile`. Out: opening a payment modal from the dashboard, a dedicated `/learn/review` route, memory check. Acceptance: an authenticated student gets a useful dashboard; the pending payment reminder leads to the course detail; `/profile` is no longer the main learning dashboard. Verify: action, schema and component tests for dashboard data states; manual QA of empty, enrolled and pending-payment states.
- B3. Scope: redirect the old public detail from `/learn/[course-slug]` to `/courses/[course-slug]` once the dashboard is ready; keep `/learn/[course-slug]/[topic-slug]` as the workspace route. Out: waiting for memory check or completion hardening. Acceptance: the canonical public detail is `/courses/[course-slug]`; `/learn` is no longer read as a public gallery. Verify: route tests and manual QA for the redirect and the workspace route.

### Wave C: enrolled learning routes and workspace hardening

- C1. Outcome: `/learn/[course-slug]` becomes the course learning overview for an enrolled student. Scope: course progress, completed and incomplete topics, next topic, a `Continue learning` CTA, no automatic redirect to a topic; an authenticated unenrolled learner stays on the same route, sees no protected syllabus or progress and gets a primary CTA to `/courses/[slug]`. Out: showing the public detail, full server-side completion truth. Acceptance: an enrolled student understands the position in the course; the CTA to the next topic works; unenrolled and invalid states are clear. Verify: data and action tests if a contract is added; manual QA for enrolled, unenrolled and empty course.
- C2. Outcome: `/learn/[course-slug]/[topic-slug]` uses the topic in the URL as the source of truth. Scope: open the exact topic slug; sidebar in sync with the URL; clear invalid, locked and unenrolled states; parent-before-child access precedence that never inspects a protected topic for an unenrolled user; progress, question and review writes use bounded trusted relation reads (the application-path guarantee is not a database-wide invariant); no obvious query waterfall, with request evidence recorded at checkpoint gates; a seam for memory check and server-side completion later. Out: memory check without a contract, final completion truth before schema and actions are ready. Acceptance: a direct URL to a topic opens the right content; switching topics updates route and state consistently; a locked or invalid topic never silently falls back to the first topic. Verify: action, schema and component tests for exact access, read, write and route-local state; isolated seeded browser QA for direct URL, sidebar, previous and next, refresh, back and forward and the inaccessible matrix; full Vitest, TypeScript, targeted lint and production build.

### Wave D: later backlog (audit 2026-09-14, Owner reconciliation 2026-09-15)

The table below is an agent proposal except where a business rule is recorded as an Owner decision in section 2. Current delivery state belongs only to `progress.md`.

| Unit | Repository reality and contract | Dependency and boundary | Classification |
| --- | --- | --- | --- |
| D1 Topic authoring, review, publication | Foundation, authorship amendment, v2 and v4 corrections and follow-up are delivered. The [canonical D1 detail plan](./implementation-plans/d1/plan.md) holds the invariants. Delivery and evidence are in `progress.md`; deploy, remote database and the full manual-QA matrix are never inferred from a merge. | D1 owns creator, responsible and contributor, group-scoped content edit, separate structure, delete and review capabilities, rejection history and `review_notes`, delete and restore lifecycle, and role-only downgrade versus remove or leave transfer. The v3 target-attached note creation UI, email or push delivery and candidate revisions stay deferred. | No P0-A to P4-A implementation follow-up remains. Q7 and D2 are separate boundaries and are not folded into D1. |
| Q7 Internal previewer access correction | Delivered and rolled out; evidence and limits are in `progress.md`. | An active course may be draft, pending or published, but a previewer-only user reads only active published topics including media; D1 capability is kept independent. Persistent progress, answer and review writes through Action and Data API need enrollment in the target's course. The other relation and correctness invariants stay in `LEARNING-INTEGRITY-001`. A prerequisite authorization for D2, not a full invite or ownership rollout. | Bounded collaborator and access correction after D1 and before D2; the [Q7 detail plan](./implementation-plans/q7/plan.md) owns lookup, policy, media and verification gates. |
| D2 Preview topic contract | Delivered. Owner Decision 12 (and W7, W8), `PREVIEW-001` and the [D2 detail plan](./implementation-plans/d2/plan.md) hold the contract. | D1 publish-readiness and Q7 access correction were the prerequisites. Contract: active published course, topic and parent chapter active, topic published with marker, full topic content including media, transient answer correctness, no persistent learning state. Quota is `ceil(active_topic_count * 20%)` with drafts in the denominator; over-cap is handled by lifecycle, the moderation exception and inline resolution in the detail plan. A public preview read boundary and a stateless answer-evaluation boundary are separate; the collaborator read helper is not widened. | Separate workstream after D1 and Q7; collaborator invite and ownership are not merged in. |
| D3 Memory check | Delivered. Owner Decisions 15 and 16 and `MEMORY-001`: `exercises.activity_stage` (`exercise` or `memory_check`) is separate from `exercises.part_type` (the TOEIC part), with the gate in the action and the workspace. The [D3 detail plan](./implementation-plans/d3/plan.md) holds the contract. | Stage and activity contract and schema and type SSOT come first; `type` and `part_type` are not reused for the new meaning. Needs action, workspace UI, failure and retry states and tests. | Standalone learning-stage PR after D2 in working order; prerequisite of D4 and soft prerequisite of D5. |
| D4 Topic completion server truth | Delivered. Owner Decision 14 and `PROGRESS-001`: RPC `public.d4_sync_topic_progress` derives completion on the server and is the only learner write path into `user_topic_progress`; `submitCardReview`, `submitQuestionAnswer` and `getLearningWorkspace` call it. The [D4 detail plan](./implementation-plans/d4/plan.md) holds the contract. | Depends on D3 memory semantics and the exercise-attempt and required-question semantics. Separate from `LEARNING-INTEGRITY-001`, which owns database-wide learner-write relation integrity. | Standalone progress and completion PR with schema, RPC and migration and database-backed verification. |
| D5 Question-category analytics | Not implemented; no model or query. Deferred by Owner Decision 20 because scope is undecided. `MEMORY-001` keeps only the semantic boundary; no category or skill field exists and `part_type` is not enough to be the category. | Needs a category, stage and answer-format SSOT and metric ownership first. Analytics is not pulled into memory implementation just because both use the question model. | Standalone analytics contract and data PR after D4 in working order. When reopened it still needs a stable category, stage and answer-format SSOT. |
| D6 Review UX and scoped follow-ups | Decision 22 chooses the existing ReviewSheet, recall/reveal/rating feedback, truthful progress for at most 50 returned cards and another-batch action. The [D6 detail plan](./implementation-plans/d6/plan.md) bounds the selected F1/domain tracking, header regressions and issue-link smoke follow-up. | Preserve FSRS, existing action/DTO and permission contracts, workspace presentation and shared primitives. D5 is not a hard prerequisite. The dedicated route in `FUTURE-REVIEW-001`/`FEAT-005` and whole-dashboard/profile polish remain outside this unit. | Review-dialog UX workstream with bounded supporting corrections; current State, candidate acceptance and execution authority live in progress/detail plan. |
| D7 Google OAuth or hide fake CTA | Moved to the [Auth onboarding](../auth-onboarding/plan.md) program (Owner 2026-10-02, Decision 19); `AUTH-002` moved with it. | Owned by Auth onboarding. | No longer in this program. |
| D8 Learner color polish and learning/Preview UI | Ownership migration done. Decision 24 opens D8-LUI: `PROFILE-001` surface and `/learn` dashboard keep their layout and get coherent semantic colors; the enrolled learning workspace and public Preview are redesigned. The [D8-LUI detail plan](./implementation-plans/d8-learning-ui/plan.md) holds the contract. | Colors only on the dashboard and profile; hierarchy, density and card-height follow-ups such as `STUDENT-003` stay separate, as do `STUDENT-004` remnants, D9 payment history and last-access state. Grading, eligibility, progression and persistence contracts are unchanged. | Opened by Decision 24; current State and candidate acceptance live in progress.md. |
| D9 Deeper payment history and dashboard | Partial: only the pending-payment reminder exists. `FUTURE-PAYMENT-001` and the dashboard payment summary; payment history has no contract or query. | Needs payment data ownership, a state and query contract and an idempotency boundary. | Standalone payment PR once the product need is clear; not merged with learning progress or auth. Deferred or open on detailed acceptance. |

Records related to but not pulled into these units: the part of `LEARNING-INTEGRITY-001` outside the Q7 enrollment gate, the remaining ownership transfer of `FUTURE-OWNERSHIP-001`, `AUTH-003`, `QUALITY-001`, `FEAT-001`, `FEAT-002`, `FEAT-003`, and the UI follow-ups `STUDENT-005` and `NAVIGATION-001`. They keep their owner and status in their own sources.

No Wave D item is dropped.

## 5. Order and rollout gates

### Merge order

1. A1, 2. A2, 3. A3, 4. B1, 5. B2, 6. B3 (after B2), 7. C1 (after B3), 8. C2 (after C1), 9. D1 (after C2), 10. Q7 (after D1), 11. D2 (after D1 and Q7), 12. D3 (after D2 in working order), 13. D4 (after D3 and after exercise-attempt and required-question semantics are fixed), 14. D5 deferred (Decision 20), 15. D7 moved out (Decision 19). Decision 22 opens D6 independently of deferred D5, on the B2/D4/F1 baseline; its candidate acceptance and implementation authority remain separate gates. D8 is opened as D8-LUI by Decision 24; D9 stays deferred or open until detailed acceptance exists.

### Working execution order

Recorded 2026-09-15: `D1 -> Q7 -> D2 -> D3 -> D4 -> D5 -> D6 -> D7 -> D8 -> D9`. It is a sequential order for readability and coordination, not a claim that every arrow is a hard technical dependency, and it is not implementation approval for any unit; each unit still needs a brief, acceptance, verification and its own authority. D4 waits for D3; D5 waits for its own SSOT and is deferred; Decision 22 selects review-dialog polish for D6 and allows it to proceed through planning without reopening D5 or adding the dedicated route; D7 moved out; Decision 24 opens D8-LUI, so D8 now proceeds under its own detail plan; D9 stays deferred or open. D4 stays separate from `LEARNING-INTEGRITY-001`.

### Wave D gates at program level

- D1 passes only when all of the following hold:
  - normal course creation is teacher-only and creates exactly one owner membership; the database allows no second active owner; invitation and normal role mutation use only `co_owner` for the additional privileged membership;
  - a valid admin or student collaborator authors by local membership and topic capability; a previewer outside the authoring group cannot edit content, a previewer in the group can edit content but not reorder structure; an admin or student without membership does not normal-author;
  - a new topic accepts no user-selected `pending` or `published`; create goes straight to the Builder at `draft` using the authoritative id whatever the number of earlier drafts (0, 1 or many);
  - each topic has an immutable creator, exactly one responsible author and at most two explicit contributors; creator or responsible request, resubmit and withdraw; a contributor only edits; an outside-group collaborator is read-only; reject keeps responsibility; initial-review exclusion holds before the first approval; a role downgrade keeps authorship while remove or self-leave with affected responsibility transfers atomically to a valid recipient or fails closed; transfer feedback has context;
  - request review is rejected in all three missing-content states (empty, cards only, exercises only) and allowed with both kinds of active content without publishing; the pending freeze holds across every normal content and status write surface;
  - reviewer approve and reject obey effective permission, no self-review and a reject reason; a role or boolean-capability mutation never removes the last valid reviewer; fixed collaborator caps apply to invitation and role occupancy with pending reservation;
  - a global `admin` role alone does not review or publish but keeps a separate moderation, takedown and maintenance boundary with mandatory audit; user self-delete of a profile is blocked while the trusted admin maintenance path stays protected; a published edit has confirm and atomic demotion to draft;
  - acceptance has action, schema and component, database, RPC, RLS and direct-write, moderation-separation and concurrency evidence.
- The implemented D1 review and lifecycle correction has no rejection budget, escalation, rescue or takeover: reject returns to `draft` with a reason and the creator or responsible resubmits per current authority. `review_notes` has topic, card and exercise targets with its own read and write boundary; rejection history shows by lifecycle visibility, and a `0` or `[]` response when published is not lost persisted history. Pending delete cancels the submission then soft-deletes atomically; published delete needs confirmation and restore always returns to `draft`. RPC, DTO, UI surface and evidence details belong to the canonical D1 detail plan and are not duplicated here.
- Q7 passes only when an internal previewer reads an active course in draft, pending or published but a previewer-only user reads only published and active topics including media; independent D1 authoring and review rights are kept; persistent progress, answer and review writes through both Server Action and Data API need a real enrollment in the target's course (an enrolled previewer or collaborator may write; a role alone does not). Acceptance covers direct calls, INSERT and UPDATE RLS and known media URLs; Q7 does not prove the remaining relation and correctness invariants of `LEARNING-INTEGRITY-001`.
- D2 opens only after D1 and Q7. Acceptance covers course and topic public gates, the persisted marker, quota `ceil(active_topic_count * 20%)` with drafts in the denominator, full readonly topic content and media, transient answer correctness, no persistent learning state, teacher configuration and inline over-cap resolution in the same mutation flow.
- D3 passes only after the stage and activity semantics and the schema and type SSOT are fixed, with server enforcement, loading, empty, error and retry states, action, schema and component tests and manual QA of the learner flow.
- D4 passes only when completion is derived from server-owned truth covering memory, flashcards, exercises and required questions per the approved semantics, with coverage for multiple exercises, incorrect and retry answers and the persisted result. `LEARNING-INTEGRITY-001` is not substitute evidence.
- D5 opens only when category or skill, answer format, activity stage and metric ownership are separate, with fixture-backed query and metric verification and no inference from `part_type`.
- Each of D6 to D9 needs its own acceptance for user goal, permission, state and error behavior and rollback; user-visible UI tracks need manual responsive and keyboard QA; auth needs redirect and provider safety; payment needs a data and query boundary and idempotency if there is a mutation.

### Testing strategy

- Route helper and navigation changes: focused component and route tests, TypeScript, lint.
- Revalidation path changes: action tests asserting `revalidatePath` targets.
- Proxy and session changes: focused tests or manual route checks for unauthenticated `/teacher/*`.
- Public catalog and detail: action, schema and component tests for published, removed, error and empty states.
- Student dashboard: action and data tests for enrolled courses, due flashcards, progress and pending payment states.
- Workspace hardening: tests for URL topic selection, invalid topic, locked topic, direct refresh and sidebar sync.
- Database and RLS-affecting backlog: use the Supabase and RLS integration strategy only when those PRs actually change database, RLS or RPC.
- Manual QA stays required for route migration and student navigation because route semantics are user-visible.

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| A stale teacher route remains under `/courses` and collides with the public catalog | Centralize the helper and clean stale references (A1 to A3) |
| Route tests still assert the old path | Update tests to the new contract (A3) |
| Proxy and session UX incomplete, showing an unauthenticated teacher route shell or a confusing redirect | Move routes under `/teacher` and verify `proxy.ts` (A2, A3) |
| Dashboard overfetch makes `/learn` slow or its DTO hard to maintain | Define a narrow dashboard DTO (B2) |
| Pending payment state is duplicated | Course detail owns the exact state; the dashboard shows only a summary (B2) |
| The old public-detail redirect catches the workspace by mistake | Route matching tests and manual QA (B3); the redirect is exact and temporary |
| The workspace ignores the topic in the URL | The URL topic is the source of truth (C2) |
| Completion is written too early | Server-side completion truth (D4) |
| Preview RLS too broad, so a public user reads locked content | Audit schema and RLS before preview (D2) |
| Memory check overloads the `type` field and blocks analytics | Separate category, format and stage (D3, D5) |
| Pending payment dismissal state persists beyond the session | Keep it session-local until product needs more |

## 7. Out of scope

- Candidate or published revision implementation, collaborator tab, last-access state and learning history (`FEAT-007`, `FEAT-001` to `FEAT-003` in [future-features.md](./future-features.md)).
- Ownership transfer, admin create-on-behalf, email or push delivery of review notes, broad collaborator or invite redesign.
- The database-wide learner-write integrity beyond the Q7 enrollment gate (`LEARNING-INTEGRITY-001`) and the repository-wide lint baseline (`QUALITY-001`).
- Historical boundary of the first planning branch (2026-07-05, no longer describes the implementation): it changed documents only, with no application behavior change, route move, migration, RLS or RPC change, business-logic refactor, public catalog, Google OAuth, memory check or analytics implementation, and no push unless the Owner asked for it.
