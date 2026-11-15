# Progress — Initial dependency modernization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [U1 detail plan r4](./implementation-plans/u1-zod-dotenv/plan.md), approved under [master plan r9](./plan.md). |
| Current unit / checkpoint | U1 CP1 trial on 2026-11-15. Detached base `7617f6c6` contains refreshed `origin/main` `dbc638c8`. |
| Status | CP1 blocked by a candidate-caused Zod string-length regression. R4 corrective plan passed independent static review (0 Critical, 0 Required) on a checkout snapshot. Owner approved R4 on 2026-11-16. Corrective CP1 is pending. |
| Completed evidence | On Windows with Node 20.20.2/npm 11.6.2, baseline, Zod-only and combined clean installs passed. Signup checks passed 187/187 on all three. The combined Zod 4.6.7 and dotenv 17.4.2 candidate passed both Vitest config probes in local and CI modes and four PayOS route cases with mocked provider and RPC. Both audits stayed at 33 full and 22 omit-dev and removed the root Zod advisory path, leaving shadcn Zod 3.25.76. Broader schema/form suite had 205 passes and one failure in the admin course UTF-16 boundary test. Lint, type check and build were stopped after that failure. |
| Accepted deviations | None. |
| Blockers / Owner decisions | Zod 4.6.6 and 4.6.7 count Unicode code points for string-length bounds. The course rejection RPC and existing product tests require UTF-16 units. Direct comparison against 4.3.6 confirmed both patched candidates change the accepted limits. U1 CP2 remains pending. |
| Next action | Run corrective CP1, then reproduce the passing candidate in CP2. |
| Current authority | Owner authorized the initial CP1 trial and plan correction and independent review. On 2026-11-16, Owner approved R4 and authorized corrective CP1, CP2 and local commits. |
| Hosted state | PR 186 deployment verification is historical evidence. Reconcile install mode in U2 and the project setting, build and serving runtime in U3. |

## Milestones

- 2026-11-12 Next.js 16.4.6 shipped and was verified on the production alias before initial dependency modernization opened (PR 186, 9f1233d6).
