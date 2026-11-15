# Progress — Initial dependency modernization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [U1 detail plan r4](./implementation-plans/u1-zod-dotenv/plan.md), approved under [master plan r9](./plan.md). |
| Current unit / checkpoint | U1 CP2 on `docs/dependency-modernization-u1`. Corrective CP1 and CP2 used Node 20.20.2/npm 11.6.2 at plan commit `1903b294`. |
| Status | U1 implementation verified locally. Release evidence is pending. |
| Completed evidence | The corrected Zod-only and combined candidates match baseline on 252 length-boundary observations across 30 groups. The combined trial passed 501 focused tests, 209 schema/profile-form tests, both Vitest configs in local and CI modes, four mocked PayOS route tests, lint, build and TypeScript. CP2 reproduced the CP1 files byte-for-byte, installed cleanly and repeated the 252 comparisons and 501 focused tests. The first CP2 test run picked up nested local checkouts. Restricting the command to the current checkout reproduced CP1's 24 files. |
| Accepted deviations | None. The existing schema limits still use UTF-16 where Zod's new counting changed observed results. |
| Blockers / Owner decisions | Both CP2 audits still report 33 full and 22 omit-dev affected package entries. GHSA-mrhx-c7xc-m3w5 no longer affects root Zod. The nested shadcn Zod 3.25.76 remains with U2. The registry lists Zod 4.6.7 as latest. Dotenv 17.4.2 is the latest 17.x and has no audit entry. Dotenv 18.0.10 is a separate major. |
| Next action | Await delivery authorization. Before release, verify required CI and Preview for the candidate, including actual execution of the admin course approval and chapter rename integration cases. |
| Current authority | Owner approved R4 and authorized local implementation and commits on 2026-11-16. |
| Hosted state | PR 186 deployment verification is historical evidence. Reconcile install mode in U2 and the project setting, build and serving runtime in U3. |

## Milestones

- 2026-11-12 Next.js 16.4.6 shipped and was verified on the production alias before initial dependency modernization opened (PR 186, 9f1233d6).
- 2026-11-16 U1 declared Zod and dotenv directly and verified the schema compatibility fix locally (this commit).
