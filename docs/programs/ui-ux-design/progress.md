# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U1 plan](./implementation-plans/u1-homepage-redesign/plan.md) r2 (Owner QA decisions 11–16, 2026-11-04); [Charter](./README.md), Owner-approved capability 2026-10-28. |
| Current unit / checkpoint | U1 homepage redesign; CP1–CP4 plus r2 QA changes committed locally. |
| Status | Owner reviewed the running r2 screen and approved committing; not pushed. |
| Completed evidence | Owner accepted the rendered mockup on 2026-11-04 ([source](./implementation-plans/u1-homepage-redesign/sources/homepage-mockup.html)); Playwright CLI screenshots of the mockup at 1440px and 375px showed no horizontal overflow and no console errors. CP1–CP4 on the working tree: `npm run test:ci` 145 files / 2171 tests passed; `npx tsc --noEmit` and eslint on changed files clean; `npm run test:e2e -- e2e/smoke/account-menu.smoke.spec.ts e2e/smoke/public-course-discovery.smoke.spec.ts` 8 passed; Playwright CLI on the local dev stack at 375, 768 and 1440px: no horizontal overflow on `/`, `/courses`, `/login`, `/register`, `/learn` (redirects to login) and a 404; one `h1`; tab order header → hero → practice; Route Blue 2px focus ring; reduced motion removes the flip; guest, seeded student and seeded teacher show the AC2/AC8 states. After r2: `npm run test:ci` 145 files / 2176 tests passed; tsc and eslint clean; sample mode at 375 and 1440px shows covers, testimonials and social links with no overflow; intro flip, deck tabs, completion with confetti, footer and card hovers and the teacher primary button checked in the browser. The e2e smokes were not rerun: r2 does not change the header or sheet. |
| Accepted deviations | None. |
| Blockers / Owner decisions | Whether the header becomes sticky as in the mockup (kept non-sticky, as before, because no AC covers it); push and PR grant. |
| Next action | Owner decides on push and PR. |
| Current authority | Implementation and local commits granted 2026-11-04; one local-DB run of `seed-homepage-demo.mjs --apply` granted and done (13 covers). No push, PR, merge, hosted database or deployment action is granted. |

## Milestones

- 2026-11-04 Owner approved the U1 homepage redesign plan r1 (`c64f30c`).
- 2026-11-04 U1 homepage body, deck demo, motion and sample mode committed (`6ec68b9`).
- 2026-11-04 U1 public course card restyle committed (`da245f6`).
- 2026-11-04 U1 white header and mobile navigation committed (`876f366`).
- 2026-11-04 U1 local demo covers script committed (`bf177c6`).
- 2026-11-04 U1 plan r2 records the Owner QA decisions 11–16 (this commit).
