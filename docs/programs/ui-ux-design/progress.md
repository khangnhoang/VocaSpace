# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U3 plan](./implementation-plans/u3-auth-pages-redesign/plan.md) r2, approved by the Owner 2026-11-10 with decision 13. |
| Current unit / checkpoint | U3 on `feat/auth-pages-redesign` from `ab809e8`; CP1 and CP2 done; CP3 next. |
| Status | CP1 passed independent review after its correction (`08f0db8`). CP2 committed with author self-review; its independent review is part of the Final round per the plan. |
| Completed evidence | Plan: Owner accepted the demo and decisions 1–12 (2026-11-09) and approved r2 with decision 13 (2026-11-10) after independent plan review (round 1 CHANGES REQUIRED, round 2 PASS). CP1: `npm run test:run` on `__tests__/utils/return-path.test.ts`, `__tests__/utils/supabase-middleware.test.ts`, `__tests__/proxy.test.ts`, `__tests__/actions/auth.test.ts`, `__tests__/actions/auth-callback-route.test.ts` and `__tests__/components/auth-onboarding.test.tsx`: 271/271 passed (the reviewer reran them with the same result); `npm run lint` passed; `npx tsc --noEmit` reports only two errors in stale generated `.next/dev/types` for the absent U2 QA page `qa-u2-error-states`, none in source; `npm run docs:check` passed. CP1 correction: a guarded path that fails the allowlist now clears the stored path; middleware and proxy suites 61/61; independent re-review PASS. CP2: `npm run test:run` 149 files, 2349/2349 passed (then the CP2 suites 105/105 after the contrast fix); `npm run lint` passed; `npx tsc --noEmit` clean in source. Production build as CI does it (isolated runtime, `NEXT_DIST_DIR=.next-e2e`, after deleting the stale generated `.next/types` and `.next-e2e/dev` that still referenced the pre-move pages), then `E2E_WEB_SERVER=start npm run test:e2e:smoke`: 84 passed, 1 failed. The new `auth-return-path` cases passed, and every spec signs in through the Vietnamese names. The failure, `topic-builder-sheet-layout` "opening a dialog on the course portfolio does not shift the page", timed out waiting for the "Đưa vào thùng rác" button after the teacher had signed in. It passed alone (2/2) and together with `teacher-course-portfolio`, `topic-builder-tabs` and `topic-create-navigation` (8/8) on the same build, so it depends on state left by an earlier spec; the comparison with `main` is due at Final. Browser on `next dev` (root-local, seed student): wrong password shows the inline alert, keeps the values and selects the password; the email suggestion applies on click; the flashcard turns while the password has focus; signed-out `/profile/orders` → sign-in lands on `/profile/orders` (a route that renders 404); after sign-out `/login` shows "Lần trước" beside Email; `/forgot-password` sent state shows the neutral notice, "Gửi lại link (58s)" and "Mở Gmail", and the curve shows "Quên dần" then "Ôn lại"; 375px has no horizontal scroll, a 44px submit and 48px tabs; panel axis labels raised to slate-600 after measuring slate-500 at about 4.34:1 on slate-100. |
| Accepted deviations | CP1: `lib/auth/sign-in-reason.ts` and `app/auth/confirm/route.ts` keep their G1 comments because they remain true under the amended wording (fixed reason literal; fixed confirm paths). CP2: `/register` stays outside the `(auth)` route group until CP3, so the AC2 panel continuity between the two tabs is not yet true; the tab indicator is static until CP4. The callback's Supabase session cookies next to the new cookies are proven only by the Owner's post-merge Google check (unit tests mock `createClient`; Next merges `cookies()` writes into the route response and the names differ). |
| Blockers / Owner decisions | none |
| Next action | Main implements CP3 (`/register` with check-email, `/auth/set-password`). |
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
- 2026-11-10 U3 CP1 correction: repaired the progress State and clear the stored path when a guarded path fails the allowlist (`08f0db8`).
- 2026-11-10 U3 CP2: auth shell with the memory-curve panel and tabs, redesigned /login and /forgot-password, Vietnamese login names in the smoke suite, POST-only auth forms and the return-path smoke (this commit).
