# Progress — Initial dependency modernization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [U2 detail plan r1](./implementation-plans/u2-shadcn/plan.md), approved under [master plan r9](./plan.md). |
| Current unit / checkpoint | U2 CP2 on `docs/dependency-modernization-u2`, based on `9cedf97e`. CP1 and CP2 ran in a disposable worktree in the `node:20-bookworm` container with Node 20.20.2 and npm 11.6.2. |
| Status | U2 pre-merge gates passed on PR 190. Merge authorization is pending. |
| Completed evidence | `npm install --package-lock-only --save-prod shadcn@4.23.0` changed only the shadcn request to `^4.23.0`. The lockfile added 10, removed 83 and changed 15 package versions. No path to `proxy-addr`, `express` or `@modelcontextprotocol/sdk` remains. shadcn's Zod dedupes onto root 4.6.7, dotenv stays 17.4.2, and `undici` rises from 7.28.0 to 7.30.2 for both jsdom and shadcn. The clean `npm ci` printed no warnings. Full audit went from 32 entries to 19 and omit-dev from 21 to 8, with critical going from 1 to 0. GHSA-jqcg-44mw-7w3h and the nested-Zod GHSA-mrhx-c7xc-m3w5 path are gone. No affected path was added. `shadcn --version` returned 4.23.0. `shadcn info` read `components.json` as style `radix-nova` with 25 installed components, and the worktree status and diff hashes stayed unchanged. The build passed. Six of seven CSS files are byte-identical. The main stylesheet only adds `--scroll-fade-*` and `--shimmer-*` defaults, eight `@property` rules and a reduced-motion `.shimmer` rule from the shadcn stylesheet. Lint and `tsc --noEmit` passed. `npm run test:run` had one 5-second timeout in a source-reading catalog test. That file passed alone, and `npm run test:ci` passed 2412 of 2412. The branch files are byte-identical to the trial on the same base, so CP1 evidence holds for CP2. PR 190 at `8bc10e7c` passed all 11 required checks, including `production-gate`. Unit tests passed on the second attempt after the first failed on an npm registry `ECONNRESET` while installing npm 11.6.2. Before merge, both audits on `8bc10e7c` matched CP1: 19 full and 8 omit-dev entries, no critical, no added path. Preview `vocaspace-l2o3f9fdj` rendered `/`, `/login`, `/register` and `/courses` the same as production `9b113f30`, and the shadcn sort Select on `/courses` opened and closed normally. |
| Accepted deviations | None. |
| Blockers / Owner decisions | Remaining shadcn-path advisories are tracked in [DMOD-001](./problems.md#dmod-001-shadcn-4230-still-carries-advisories-outside-its-own-fix). shadcn placement stays deferred by the 2026-11-17 Owner decision. |
| Next action | Await merge authorization. A docs-only commit carrying this evidence needs the same checks on its revision before merge. After merge, confirm `production-gate`, the production domain on the merge revision and a bounded read-only smoke. |
| Current authority | Owner approved U2 r1 and authorized the CP1 trial, implementation, local commits, push, PR 190, a CI rerun and the pre-merge Preview and audit checks on 2026-11-17. Merge is not granted. |
| Hosted state | U1 is serving on production at `9b113f30`. Reconcile build and serving runtime in U3. |

## Milestones

- 2026-11-12 Next.js 16.4.6 shipped and was verified on the production alias before initial dependency modernization opened (PR 186, 9f1233d6).
- 2026-11-16 U1 declared Zod and dotenv directly and verified the schema compatibility fix locally (`f4b4c7b4`).
- 2026-11-16 U1 shipped to production through required CI, production-gate and domain assignment (PR 189, `9b113f30`).
- 2026-11-17 U2 detail plan r1 approved and U1 release evidence reconciled (`9cedf97e`).
- 2026-11-17 U2 upgraded shadcn to 4.23.0 and verified the removed advisory paths, CSS and CLI locally (`8bc10e7c`).
- 2026-11-17 U2 passed CI, Preview and pre-merge audits on PR 190 (this commit).
