# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD1 [detail plan](./implementation-plans/ad1/plan.md) r3, Codex plan review PASS (round 2), Owner approval 2026-10-13 |
| Current unit / checkpoint | AD1, CP3 (sidebar, removed routes, browser evidence, docs) next |
| Status | AD1 CP2 (gate) committed locally: `requireAdminPage()` in the layout and both admin pages, signed-out `/admin` redirect in the proxy. Browser and production-build evidence is still pending (CP3). |
| Completed evidence | Read-only discovery on 2026-10-13 against `b6720ec` (root DB and hosted): see [problems.md](./problems.md) ADMIN-001 to ADMIN-004. AD1 CP2: `supabase-middleware`, `admin-access`, `admin-user-management-create`, `proxy`, `admin-dashboard` tests pass (5 files, 64 tests). |
| Accepted deviations | None. |
| Blockers / Owner decisions | None. AD1 decisions of 2026-10-13 are in the detail plan §1.4. |
| Next action | The implementor runs AD1 CP3 on `fix/admin-route-gate`. |
| Current authority | Owner grant 2026-10-13: commit the AD1 plan, implement AD1 CP2–CP3 with local commits on `fix/admin-route-gate`. No push, PR, merge, hosted or root database authority. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (this commit).
