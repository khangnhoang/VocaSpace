# Progress — Initial dependency modernization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [U2 detail plan r1](./implementation-plans/u2-shadcn/plan.md), approved under [master plan r9](./plan.md). |
| Current unit / checkpoint | U2 CP1 on `docs/dependency-modernization-u2`, branched from `9b113f30`. |
| Status | U1 shipped to production. U2 plan r1 passed Codex review after one correction round and is approved. CP1 trial is starting. |
| Completed evidence | U1: PR 189 merged as `9b113f30`. All required CI jobs passed on the PR and the merge revision, including `production-gate`. The integration job ran 534 tests with none skipped, including 11 `approve_course_review` cases and 16 `rename_chapter` cases. On 2026-11-17, Vercel deployment `dpl_7e9vnQdKxmnLBLbWEHQ3jpz27re7` for `9b113f30` was READY on target production with `vocaspace.com` and `www.vocaspace.com` assigned. Read-only GETs of `/`, `/login`, `/register` and `/courses` returned 200. |
| Accepted deviations | None. |
| Blockers / Owner decisions | On 2026-11-17 the Owner kept shadcn in `dependencies` for U2 and required a Codex review of the U2 plan. The lockfile audit at `9b113f30` on 2026-11-17 reports 32 full and 21 omit-dev affected package entries. Nested shadcn Zod 3.25.76 remains with U2. |
| Next action | Main runs the U2 CP1 trial in a disposable worktree on Node 20 and npm 11.6.2. |
| Current authority | Owner approved U2 r1 and authorized the CP1 trial, implementation and local commits on 2026-11-17. Push, PR, merge and hosted actions are not granted. |
| Hosted state | U1 is serving on production at `9b113f30`. Reconcile build and serving runtime in U3. |

## Milestones

- 2026-11-12 Next.js 16.4.6 shipped and was verified on the production alias before initial dependency modernization opened (PR 186, 9f1233d6).
- 2026-11-16 U1 declared Zod and dotenv directly and verified the schema compatibility fix locally (`f4b4c7b4`).
- 2026-11-16 U1 shipped to production through required CI, production-gate and domain assignment (PR 189, `9b113f30`).
- 2026-11-17 U2 detail plan r1 approved and U1 release evidence reconciled (this commit).
