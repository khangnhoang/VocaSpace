# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U3 plan](./implementation-plans/u3-auth-pages-redesign/plan.md) r2, approved by the Owner 2026-11-10 with decision 13. |
| Current unit / checkpoint | U3 on `feat/auth-pages-redesign` from `ab809e8`; CP1 done after its independent review; CP2 next. |
| Status | CP1 committed (`ca8c691`); independent CP1 review: 0 Critical, 1 Required (this State had been corrupted by a scripted edit), 2 Suggestions; the Required finding and Suggestion 1 are fixed in this correction commit. |
| Completed evidence | Plan: Owner accepted the demo and decisions 1–12 (2026-11-09) and approved r2 with decision 13 (2026-11-10) after independent plan review (round 1 CHANGES REQUIRED, round 2 PASS). CP1: `npm run test:run` on `__tests__/utils/return-path.test.ts`, `__tests__/utils/supabase-middleware.test.ts`, `__tests__/proxy.test.ts`, `__tests__/actions/auth.test.ts`, `__tests__/actions/auth-callback-route.test.ts` and `__tests__/components/auth-onboarding.test.tsx`: 271/271 passed (the reviewer reran them with the same result); `npm run lint` passed; `npx tsc --noEmit` reports only two errors in stale generated `.next/dev/types` for the absent U2 QA page `qa-u2-error-states`, none in source; `npm run docs:check` passed. CP1 correction: a guarded path that fails the allowlist now clears the stored path; middleware and proxy suites 61/61. Browser and production-build checks start at CP2. |
| Accepted deviations | CP1: `lib/auth/sign-in-reason.ts` and `app/auth/confirm/route.ts` keep their G1 comments because they remain true under the amended wording (fixed reason literal; fixed confirm paths). The login page already navigates to the returned `redirectTo` in CP1 (one line, still behind the old toast and 1 s wait until CP2). The callback's Supabase session cookies next to the new cookies are proven only by the Owner's post-merge Google check (unit tests mock `createClient`; Next merges `cookies()` writes into the route response and the names differ). |
| Blockers / Owner decisions | none |
| Next action | Main implements CP2 (shell, panel, tabs, `/login`, `/forgot-password`, G9 and G10). |
| Current authority | Owner granted 2026-11-10: plan r2 approval, implementation of CP1–CP4 by Main in this session, local commits per checkpoint and a local commit of the plan docs. No push, PR, merge, hosted change or deployment is granted. |

## Milestones

- 2026-11-04 Owner approved the U1 homepage redesign plan r1 (`c64f30c`).
- 2026-11-04 U1 homepage body, deck demo, motion and sample mode committed (`6ec68b9`).
- 2026-11-04 U1 public course card restyle committed (`da245f6`).
- 2026-11-04 U1 white header and mobile navigation committed (`876f366`).
- 2026-11-04 U1 local demo covers script committed (`bf177c6`).
- 2026-11-04 U1 plan r2 records the Owner QA decisions 11–16 (`18bdded`).
- 2026-11-04 PR #183 opened for U1 (PR 183, `18bdded`).
- 2026-11-04 U1 plan r3 records the PR #183 review fixes and UIUX-001 (`b66649c6`).
- 2026-11-05 U1 merged after review fixes (PR 183, `dfe79c4`).
- 2026-11-05 U1 trial motion and responsive follow-up merged (PR 184, `736cc56`).
- 2026-11-05 Owner approved the U2 course catalog plan r3 after independent review (`115cc18`).
- 2026-11-05 U2 CP1: catalog listing RPC, schema, action, parity tests and local catalog fixture (`455dde0`).
- 2026-11-05 U2 CP2: catalog page with search, filters, sort, URL state, pagination, cards and states (`e415176`).
- 2026-11-05 U2 CP3: list reflow, sliding price indicator, page fade-in and scroll reveal (`0ba9156`).
- 2026-11-05 U2 CP4: shared course states on Product Language tokens and the discovery smoke contract (`607788e`).
- 2026-11-05 U2 implementation review 1 fixes: touch targets, pending-search and same-page history guards, focus reveal, fixture card backs, enrollment parity (`c86164d`).
- 2026-11-05 U2 final QA: contrast fixes for counts, hint and control boundaries (decision 15) (`048a317`).
- 2026-11-05 U2 Owner QA: the sort control uses the shared Radix Select with icons instead of the native select (`f2238a7`).
- 2026-11-05 U2 Owner QA: mobile back-to-top button after about two courses (decision 16) (`b461e99`).
- 2026-11-06 U2 merged (PR 185, `ab809e8`).
- 2026-11-10 Owner approved the U3 plan r2 after independent plan review (`a42f4b4`).
- 2026-11-10 U3 CP1: server-recorded return path for /teacher, /profile and /admin, last sign-in method cookie and the auth-onboarding G1 amendment (`ca8c691`).
- 2026-11-10 U3 CP1 correction: repaired the progress State and clear the stored path when a guarded path fails the allowlist (this commit).
