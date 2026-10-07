# Progress — Student/user flow and route refactor

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

This file was migrated to the repository template and translated to English on 2026-10-05. The previous Vietnamese tracker, with per-checkpoint commands, results and manual QA logs for every unit, is in Git: `git show eb36618:docs/refactors/student-user-flow-route/progress.md`.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md), migrated to the template on 2026-10-05 with the Owner decisions unchanged. The last merged unit is D4 ([implementation-plans/d4/plan.md](./implementation-plans/d4/plan.md)). The active detail plan is F1 ([implementation-plans/f1/plan.md](./implementation-plans/f1/plan.md)). |
| Current unit / checkpoint | F1 (navigation parity, root not-found, sign-in reason): CP1 to CP4 implemented locally on `fix/student-nav-404-redirect-reason`, not merged. D5 is deferred (Owner Decision 20). D7 moved to the [Auth onboarding](../auth-onboarding/progress.md) program. D6, D8 and D9 stay deferred or open. |
| Status | Waves A to C and units D1, Q7, D2, D3 and D4 are merged to `main`. Q7 is rolled out to production. D2 is merged and its three migrations are in the hosted migration history, but D2 is not recorded as rolled out. |
| Completed evidence | Historical evidence is in the merged PRs and the milestones below: PRs 42, 43, 44, 46, 48, 74, 75, 96, 98, 101, 102, 117 and 118. Not claimed: D1 deploy evidence and the full manual matrix M17 to M28 (v3 target-attached note creation UI stays deferred), the PayOS sandbox cancellation QA (PAYMENT-002), D2 creator and managed-media inventory preflight and post-deploy check. F1 browser QA on the local stack (dev server), all rows of the plan matrix done: signed-out `/teacher?x=1` → `/login?x=1&reason=signin_required`, `/teacher/courses?x=1&reason=evil` → the same (one `reason`), `/profile?next=x` → `/login?reason=signin_required`, `/learn` and `/learn/<valid unknown slug>` → `/login?reason=signin_required`, each with the notice, and no notice for a tampered `reason`; guest, student, teacher and admin menus at 320, 375 and 1280 px: the mobile sheet and the desktop dropdown list the same destinations (admin adds `/admin`), no `Cài đặt`, no horizontal overflow; sheet opened by keyboard, focus stays inside while open (Tab and Shift+Tab cycle), Escape closes it and focus returns to the trigger, a link click closes it, logout from the sheet lands on a bare `/login`; not-found at `/khong-ton-tai` (404), `/courses/<unknown>`, `/learn/<malformed>` and, as the student, `/learn/<valid unknown slug>` (200, streamed) with one header, one `<title>` "Không tìm thấy trang \| VocaSpace" and `noindex`, by direct load and by client navigation; the `topic_unavailable` surface through the learning-workspace smoke spec. Observed, not caused by F1 and left out of scope: a `#fragment` on `/profile` survives the redirect because browsers re-apply it when `Location` has none (the middleware cannot see it); after logout the sheet stays open and shows the guest view; one early client-navigation sample counted two `<header>` elements and later repeats counted one (unexplained). |
| Accepted deviations | None. Temporarily accepted visuals are tracked as `STUDENT-003` and `STUDENT-004` in [problems.md](./problems.md). |
| Blockers / Owner decisions | No blocker. The scope of D5 is undecided (Decision 20). D6, D8 and D9 need detailed acceptance before they start. Open follow-ups are in [problems.md](./problems.md). |
| Next action | F1: Owner review of the local commits, then push and PR on the Owner's request; `NAVIGATION-001`, `STUDENT-005` and `AUTH-003` stay open until the PR merges. Otherwise none in this program until the Owner opens a unit (D5, D6, D8 or D9) or a follow-up from [problems.md](./problems.md). Each needs its own detail plan, acceptance and authority. |
| Current authority | This file grants no implementation, commit, push, PR, merge, deploy or remote database authority. Each unit needs its own grant. |
| Hosted state | Remote migration history matched local through D1 before the Q7 apply. Q7: three migrations applied and production deployment `READY` at merge SHA `65e8481` (2026-09-24). D2: `20260924100000`, `20260924110000` and `20260924120000` listed in the hosted history (read-only check, 2026-10-02), no rollout evidence. D3: migrations `20261002100000`, `20261002110000` and `20261002120000` pushed and verified after merge, deployment `READY` (2026-10-02). D4: migration `20261002130000_d4_topic_completion.sql` pushed and verified after merge, deployment `dpl_BRver4QbSb8STbXmofUtJksvdVxs` `READY` (2026-10-02). |

## Milestones

- 2026-07-05 Program planned: master plan, progress tracker, problems log and ADR created; the teacher hard cut, public catalog, student dashboard and account-only profile directions accepted; no application change (`f8704e1`).
- 2026-07-08 A1 merged: teacher route helpers centralized around `lib/course-authoring/routes.ts`, implementation `cce28c9` (PR 42, `d800d648`).
- 2026-07-08 A2 merged: teacher authoring moved to `/teacher/courses` with no legacy redirect, implementation `701054b` (PR 43, `59680afb`).
- 2026-07-09 A3 merged: segment-aware `/teacher` guard, negative boundary tests and manual route QA, implementation `fe032ba`, evidence `f14eaf8`; Wave A done (PR 44, `6a639d5e`).
- 2026-07-12 B1 merged: public `/courses` and `/courses/[course-slug]`, highlighted-courses homepage and canonical payment cancel URL (PR 46, `079ad46`).
- 2026-07-13 B2 merged: authenticated `/learn` dashboard and account-only `/profile` (PR 48, `00bdadab`).
- 2026-08-18 B3 merged: temporary exact redirect of the old public detail, not-found for invalid slugs, nested workspace route preserved, CP1 `1bfd875`, CP2 `f0cc59b` (PR 74, `59d0810`).
- 2026-08-19 C1 merged: `/learn/[course-slug]` is the enrolled course overview with safe unenrolled and error states, branch head `44ee6b9` (PR 75, `3cb7a9f`).
- 2026-09-14 C2 merged: the URL topic is the workspace source of truth with parent-before-child access and trusted write guards; CI green, PR head `66e7f318`, no production deployment claimed (PR 96, `3a95c310`).
- 2026-09-15 Owner steered Wave D decisions, the D1 contract and the working order D1, Q7, D2, D3, D4, D5, D6, D7, D8, D9 recorded in the master plan (`9a5e8c4`).
- 2026-09-18 D1 amended: escalation, rescue and review budget removed in favour of `review_notes` with a full rejection history (`71c5ad2`).
- 2026-09-22 D1 merged: topic authoring, review and publication with authorship amendment and v2 and v4 corrections; v3 stays deferred and no deploy or full manual matrix is claimed (PR 98, `861e7c7`).
- 2026-09-23 Q7 merged: topic-scoped read for previewers, private managed media and enrollment-gated learner writes, correction review `PASS` at `da59c69`, PR head `00477f8` (PR 101, `65e8481`).
- 2026-09-24 Q7 rolled out to production: inventory found no managed media, three migrations applied, deployment `READY` at `65e8481` (`10b4a2c`).
- 2026-09-25 D2 merged: public readonly topic Preview with quota and lifecycle, final independent review `PASS` at `39feb3a`, PR head `fdf9b0d` (PR 102, `2074279`).
- 2026-10-02 D2 hosted migrations observed in the hosted history; D2 is not recorded as rolled out (`3cd831e`).
- 2026-10-02 D3 merged: optional memory-check stage with `exercises.activity_stage`; hosted migrations applied (PR 117, `fb8030f`).
- 2026-10-02 D4 merged: server-derived topic completion through `public.d4_sync_topic_progress`; hosted migration applied (PR 118, `ab92e21`).
- 2026-10-02 D5 deferred by the Owner because its scope is undecided; it is not dropped (`0c255f9`).
- 2026-10-02 D7 moved by the Owner into the Auth onboarding program of four PRs (`9bfd0c6`).
- 2026-10-05 Program documents migrated to the repository templates in English under `docs/programs/student-user-flow-route/`; frozen detail plans and non-role files bannered (`06578d1`).
- 2026-10-07 E2E-001 fixtures and teacher-route/public-syllabus expectations corrected; the four affected specs passed in two full local smoke runs, AUTH-010 stays open, no remote delivery performed (`592c577`).
- 2026-10-07 F1 implemented locally in four checkpoints (sign-in reason on redirects, account menu parity, root not-found page, verification); unit, type, lint, build and docs checks pass, two smoke specs updated to the new not-found heading, `issue-deep-links` smoke is flaky in this environment, NAVIGATION-001, STUDENT-005 and AUTH-003 stay open until merge (this commit).
