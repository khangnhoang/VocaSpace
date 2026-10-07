# Progress — Student/user flow and route refactor

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

This file was migrated to the repository template and translated to English on 2026-10-05. The previous Vietnamese tracker, with per-checkpoint commands, results and manual QA logs for every unit, is in Git: `git show eb36618:docs/refactors/student-user-flow-route/progress.md`.

## State

| Field | Value |
| --- | --- |
| Spec revision | [implementation-plans/d6/plan.md](./implementation-plans/d6/plan.md) r2 (2026-10-08), independently reviewed and accepted by the Owner for implementation. Master Decision 22 records the Owner-confirmed scope. F1 is merged in PR 139 (`ee46176`). |
| Current unit / checkpoint | D6 plan authoring and independent review completed on `feat/student-review-d6-followups`, from pulled `main` at `5ae962f`; CP1 tracker reconciliation completed; CP2 reproduction and CP3 implementation are next. D5 stays deferred, D7 belongs to Auth onboarding, and D8/D9 stay outside this batch. |
| Status | D6 r2 independent plan review PASS, no Critical/Required findings; Owner accepted the plan and granted implementation and local checkpoint commits. Waves A to C and D1, Q7, D2, D3, D4 and F1 are merged. Q7 is rolled out; the recorded D2 hosted migrations do not replace its missing rollout evidence. |
| Completed evidence | Historical product evidence stays in the milestones and merged PRs, including F1 PR 139 (`ee46176`). Detailed F1 local browser QA and unexplained observations remain in `git show 5ae962f:docs/programs/student-user-flow-route/progress.md` and PR 139. This planning session fetched origin, pulled main with --ff-only (already up to date), and created the branch at `5ae962f` with a clean index/worktree. Independent read-only review by gpt-6.1-sol at reasoning high passed r2 on 2026-10-08; docs:check reports 0 structure violations and 0 new broken links (1 baseline), and diff --check passes. No new product tests, browser QA or production observations are claimed. Existing D1 deploy/full manual-matrix, PayOS cancellation QA and D2 inventory/post-deploy gaps remain unclaimed. |
| Accepted deviations | None. Temporarily accepted visuals are tracked as `STUDENT-003` and `STUDENT-004` in [problems.md](./problems.md). |
| Blockers / Owner decisions | No branch-preparation blocker. D6 implementation is authorized; header blank-menu and issue-link instability causes remain unproved. D5 scope is undecided; D8/D9 need their own acceptance. CP1 closes the merged F1 entries and reconciles Auth FEAT-004 using recorded rollout evidence. |
| Next action | Reproduce CP2 menu/smoke observations, then implement the D6 review surface and focused verification. |
| Current authority | Owner grants (2026-10-08): branch/plan preparation and independent review, followed by plan acceptance, CP1 to CP4 implementation with isolated local/test fixtures and QA, and local commits throughout implementation as needed. Push, PR, merge, deploy and hosted/database mutation remain ungranted. |
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
- 2026-10-07 F1 implemented locally in four checkpoints (sign-in reason on redirects, account menu parity, root not-found page, verification); unit, type, lint, build and docs checks pass, two smoke specs updated to the new not-found heading, `issue-deep-links` smoke is flaky in this environment, NAVIGATION-001, STUDENT-005 and AUTH-003 stay open until merge (`9ccaa93`).
- 2026-10-08 D6 scope opened: retain ReviewSheet, preserve 50-card batches and offer another batch; detail plan authored on a new branch from pulled main for independent review, no product implementation (`7189c2a`).
- 2026-10-08 D6 CP1 tracker closeout: F1 entries resolved against merged PR 139 (`ee46176`); Auth FEAT-004 reconciled to recorded 2026-10-07 rollout evidence, no new hosted observation (this commit).
