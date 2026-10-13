# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD2 [detail plan](./implementation-plans/ad2/plan.md) r3, Codex plan review PASS (round 3, two minor fixes applied); Owner approval 2026-10-14 |
| Current unit / checkpoint | AD2 merged; AD3 not started |
| Status | AD2 delivered: PR 155 merged with CI green after the hosted migration was pushed and verified. The root runtime (45321) has the AD2 migration. AD3 has no detail plan yet. |
| Completed evidence | AD2 verification on the isolated runtime (API 45441) and the Codex reviews are in the AD2 milestones and the PR 155 description: `ad2-course-listing-approval.test.ts` 66/66, upgrade rehearsal from `20261013090000`, `npm run test:ci`, lint, build and docs checks; Codex plan review PASS round 3, implementation review PASS round 2. Hosted, after `supabase db push` of `20261014120000` on 2026-10-14 with an Owner grant, read-only: courses 3 draft, 4 published (1 removed), no pending; the four review RPCs are executable by `authenticated` only (not `anon` or `service_role`); `ad2_course_has_published_topic` is executable by no API role; `anon` and `authenticated` have no table-level `UPDATE` on `courses`, and `authenticated` has column `UPDATE` only on `title`, `slug`, `description`, `price`, `thumbnail_url`, `removed_at`. Root runtime (45321): `supabase migration up --local` applied `20261014120000` on 2026-10-14 at the Owner's request; no pending course, `submit_course_review` executable by `authenticated`. |
| Accepted deviations | None. |
| Blockers / Owner decisions | None open. AD2 decisions of 2026-10-14 are in the detail plan §1.4. |
| Next action | AD3 (`/admin/courses`) detail plan when the Owner asks |
| Current authority | None open. AD2 grants were consumed by the merge of PR 155. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (`a22de1b`).
- 2026-10-13 AD1 CP3: two-link sidebar with exact `/admin` active state, `/admin/courses` removed, admin gate smoke spec and production status check, ADMIN-001 resolved (`e0f8dcf`).
- 2026-10-13 AD1 correction round 1: isolated-target guards and unit test for the admin gate scripts, guaranteed fixture cleanup, revocation case for both pages with a mutation check, whitespace fix (`10f3a6a`).
- 2026-10-13 AD1 correction round 2: fixture cleanup ignores only the GoTrue `user_not_found` code (confirmed on the isolated runtime: 404, `user_not_found`, "User not found"), with regression tests (`24cee31`).
- 2026-10-13 AD1 merged with CI green, no hosted step (PR 152, `1ff5588`).
- 2026-10-14 AD2 detail plan r3 approved by the Owner after Codex plan review PASS (round 3) (`c257a9b`).
- 2026-10-14 AD2 CP2: course listing approval migration (four RPCs, column lock-down of `courses`), seed pending row to draft, integration suite on the isolated runtime (`b244be6`).
- 2026-10-14 AD2 CP3: `submitCourseReview`/`withdrawCourseReview` and admin `approveCourseReview`/`rejectCourseReview` Server Actions, review fields and `publishedTopicCount` in the course readiness data, "Gửi duyệt" / "Rút yêu cầu duyệt" controls and rejection reason on both overview branches (`f1763ea`).
- 2026-10-14 AD2 CP4: ADMIN-002 resolved in the repository, final verification run (`a0e22d8`).
- 2026-10-14 AD2 correction round 1: `reject_course_review` counts the reason in UTF-16 units like `rejectCourseSchema` (astral boundaries tested in SQL, schema and action), review controls use the default `Button` styling with a busy label (`b94eab9`).
- 2026-10-14 AD2 Codex implementation review: round 1 FAIL on `a0e22d8`, round 2 PASS on `b94eab9`; progress records the review and the TypeScript result (`c6cae6a`).
- 2026-10-14 AD2 merged with CI green after the hosted migration push and read-only verification (PR 155, `8c537b6`); root runtime migrated (this commit).
