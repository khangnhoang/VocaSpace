# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD1 [detail plan](./implementation-plans/ad1/plan.md) r3, Codex plan review PASS (round 2), Owner approval 2026-10-13 |
| Current unit / checkpoint | AD1 implementation complete locally (CP2 and CP3); awaiting Owner review |
| Status | AD1 CP3 committed locally: two-link sidebar with an exact `/admin` active state, `/admin/courses` page removed (404), admin gate smoke spec and production status check. No push or PR. |
| Completed evidence | Read-only discovery on 2026-10-13 against `b6720ec` (see [problems.md](./problems.md)). AD1 on the isolated runtime (API 45441): `admin-gate.smoke.spec.ts` plus `account-menu.smoke.spec.ts` 13/13 passed; production build (`next build` + `next start`, port 3100, `.next-e2e`) checked by `scripts/e2e/admin-gate-status-check.mjs`: guest 307, student and teacher 404 with the not-found page and no admin shell, admin 200 on `/admin` and `/admin/user-management`, admin 404 on `/admin/courses`, `/admin/stats`, `/admin/settings` (12/12). `npm run test:ci`: 102 files and 1368 tests passed; the only 2 failing files are untracked leftovers in the gitignored `test-results/`. `npm run lint` and `npm run build` pass; `npx tsc --noEmit` reports only 2 errors, both in those `test-results/` leftovers. Hosted and root DB untouched. |
| Accepted deviations | None. |
| Blockers / Owner decisions | None. AD1 decisions of 2026-10-13 are in the detail plan §1.4. |
| Next action | Owner reviews AD1 (diff, optional manual QA on :3000: admin and student opening `/admin`), then decides push and PR. Next unit is AD2 once the Owner asks. |
| Current authority | Owner grant 2026-10-13: commit the AD1 plan, implement AD1 CP2–CP3 with local commits on `fix/admin-route-gate`. No push, PR, merge, hosted or root database authority. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (`a22de1b`).
- 2026-10-13 AD1 CP3: two-link sidebar with exact `/admin` active state, `/admin/courses` removed, admin gate smoke spec and production status check, ADMIN-001 resolved (this commit).
