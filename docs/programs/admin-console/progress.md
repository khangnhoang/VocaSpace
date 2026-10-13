# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD2 [detail plan](./implementation-plans/ad2/plan.md) r3, Codex plan review PASS (round 3, two minor fixes applied); Owner approval 2026-10-14 |
| Current unit / checkpoint | AD2 CP1 done (plan committed); CP2 next |
| Status | AD2 plan r3 approved and committed on `feat/course-listing-approval`; implementation (CP2–CP4) starting. |
| Completed evidence | AD2 read-only discovery on 2026-10-14 against `d11c1b3` (detail plan §2), including one Owner-allowed read-only inventory of hosted course states: 3 draft, 4 published (1 removed), no pending. |
| Accepted deviations | None. |
| Blockers / Owner decisions | None open. AD2 decisions of 2026-10-14 are in the detail plan §1.4. |
| Next action | Implementor runs CP2–CP4 with local commits; then Codex implementation review. |
| Current authority | Owner grant 2026-10-14: commit the AD2 plan and implement CP2–CP4 with local commits on `feat/course-listing-approval`. No push, PR, merge, hosted or root database authority. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (`a22de1b`).
- 2026-10-13 AD1 CP3: two-link sidebar with exact `/admin` active state, `/admin/courses` removed, admin gate smoke spec and production status check, ADMIN-001 resolved (`e0f8dcf`).
- 2026-10-13 AD1 correction round 1: isolated-target guards and unit test for the admin gate scripts, guaranteed fixture cleanup, revocation case for both pages with a mutation check, whitespace fix (`10f3a6a`).
- 2026-10-13 AD1 correction round 2: fixture cleanup ignores only the GoTrue `user_not_found` code (confirmed on the isolated runtime: 404, `user_not_found`, "User not found"), with regression tests (`24cee31`).
- 2026-10-13 AD1 merged with CI green, no hosted step (PR 152, `1ff5588`).
- 2026-10-14 AD2 detail plan r3 approved by the Owner after Codex plan review PASS (round 3) (this commit).
