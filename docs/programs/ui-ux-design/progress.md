# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U4 plan](./implementation-plans/u4-motion-consistency/plan.md) r1, approved by the Owner on 2026-11-21. |
| Current unit / checkpoint | U4 PR1 (course detail) on `feat/course-detail-motion` from `eca348a7`. U3 merged in PR 187 (`fba8c133`); its detailed evidence is in `git show 3f19ac3f:docs/programs/ui-ux-design/progress.md`. |
| Status | PR1 committed locally; awaiting Owner QA of the running screen. |
| Completed evidence | U4 discovery on `eca348a7`, recorded in the U4 plan section 2. PR1: course-detail and enrollment-dialog component tests, the full Vitest suite, eslint on changed files, `tsc`, and a local browser pass (free and paid dialogs portaled to `body`, avatar under the backdrop, focus/Esc/focus return, no horizontal scroll at 320/768/1440px, scroll reveal limited to below-the-fold items). |
| Accepted deviations | None. |
| Blockers / Owner decisions | None for PR1. U3 follow-ups: the Owner's production Google sign-in check and closing [AUTH-012](./problems.md#auth-012-auth-screens-have-no-accepted-design-yet) remain open. |
| Next action | Owner QA of PR1 on the running course detail page; then push and PR only on an explicit grant. |
| Current authority | Owner approved U4 plan r1 on 2026-11-21 and granted PR1 implementation by Main with local commits on `feat/course-detail-motion`. Push, PR and merge are not granted; PR2 and PR3 need plan r2 and r3 approval. |

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
- 2026-11-10 U3 CP2: auth shell with the memory-curve panel and tabs, redesigned /login and /forgot-password, Vietnamese login names in the smoke suite, POST-only auth forms and the return-path smoke (`cb0934c`).
- 2026-11-10 U3 CP3: five-stage registration with the check-email stage and the two-stage set-password page on the shared shell (`d693a62`).
- 2026-11-10 U3 CP4: curve draw, sliding tab indicator, step and view entry, form height, failure shake and success check, with reduced-motion equivalence (`238d7aa`).
- 2026-11-10 U3 Final QA: keyboard focus outline on auth inputs (`8d90f55`).
- 2026-11-11 U3 final independent review round 1 fixes: date-button focus, focus on the check-email stage, AUTH-012 status, reduced-motion success check, avatar reset, regional email domains, clip room and State (`6214b9f`).
- 2026-11-11 U3 final independent review round 2 fix: Route Blue focus ring on the invalid date button (`23ac37a`).
- 2026-11-11 U3 final independent review round 3: PASS on `23ac37a` (`75cbdc1`).
- 2026-11-11 U3 Owner decision on review Suggestion 3: a separate connection message when sign-in fails in transit (`28f022c`).
- 2026-11-11 U3 review round 4 PASS on `28f022c`; plan r3 records decision 15 and the review notes are applied (`6ef505a`).
- 2026-11-11 U3 Owner decision 16: compact curve strip and centred card on tablets and phones (`a729214`).
- 2026-11-12 U3 Owner decision 17: word-card deck replaces the curve below 960px (`c4da97b`).
- 2026-11-12 U3 review round 5 PASS; deck drop-in no longer replays on Quay lại, mid-review page changes keep the card visible, set-password centring and plan AC pointers (`5dbccce`).
- 2026-11-12 U3 Owner QA of the running screens passed against the checklist (desktop, curve, word deck below 960px, sign-in, registration, recovery, keyboard and reduced motion); real devices and Safari as tested by the Owner (`13f2c4ae`).
- 2026-11-12 U3 merged (PR 187, `fba8c133`).
- 2026-11-21 Owner approved the U4 motion consistency plan r1 (this commit).
