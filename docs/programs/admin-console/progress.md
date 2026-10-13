# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD1 [detail plan](./implementation-plans/ad1/plan.md) r3, Codex plan review PASS (round 2), Owner approval 2026-10-13 |
| Current unit / checkpoint | AD1 implementation complete locally (CP2 and CP3); awaiting Owner review |
| Status | AD1 correction rounds 1 and 2 committed locally (Codex implementation review FAIL twice, findings fixed): fixture and status-check scripts refuse non-isolated targets, cleanup always runs, the revocation case covers both pages, trailing whitespace removed. No push or PR. |
| Completed evidence | Read-only discovery on 2026-10-13 against `b6720ec` (see [problems.md](./problems.md)). AD1 on the isolated runtime (API 45441): `admin-gate.smoke.spec.ts` 7/7 passed after the correction (the CP3 run of 13/13 included `account-menu.smoke.spec.ts`). Mutation check of the revocation cases: removing `requireAdminPage()` from `app/admin/page.tsx` fails the user-management to Dashboard case only; removing it from `app/admin/user-management/page.tsx` fails the Dashboard to Quản lý User case only; restored, both pass (mutations not committed). Production status check (CP3, `next build` + `next start` on 3100): guest 307, student and teacher 404 with the not-found page and no admin shell, admin 200, admin 404 on removed routes (12/12); not rerun in the correction because no app code changed. `__tests__/utils/admin-gate-fixture.test.ts` proves the fixture and status check refuse root 45321, hosted and non-3100 targets before creating a client. CP3 broad run: `npm run test:ci` 102 files and 1368 tests passed (only 2 untracked `test-results/` leftover files fail), `npm run lint` and `npm run build` pass, `npx tsc --noEmit` reports only 2 errors in those leftovers. Hosted and root DB untouched. |
| Accepted deviations | None. |
| Blockers / Owner decisions | None. AD1 decisions of 2026-10-13 are in the detail plan §1.4. |
| Next action | Owner reviews AD1 (diff, optional manual QA on :3000: admin and student opening `/admin`), then decides push and PR. Next unit is AD2 once the Owner asks. |
| Current authority | Owner grant 2026-10-13: commit the AD1 plan, implement AD1 CP2–CP3 with local commits on `fix/admin-route-gate`. No push, PR, merge, hosted or root database authority. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (`a22de1b`).
- 2026-10-13 AD1 CP3: two-link sidebar with exact `/admin` active state, `/admin/courses` removed, admin gate smoke spec and production status check, ADMIN-001 resolved (`e0f8dcf`).
- 2026-10-13 AD1 correction round 1: isolated-target guards and unit test for the admin gate scripts, guaranteed fixture cleanup, revocation case for both pages with a mutation check, whitespace fix (`10f3a6a`).
- 2026-10-13 AD1 correction round 2: fixture cleanup ignores only the GoTrue `user_not_found` code (confirmed on the isolated runtime: 404, `user_not_found`, "User not found"), with regression tests (this commit).
