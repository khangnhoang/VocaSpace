# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U1 plan](./implementation-plans/u1-homepage-redesign/plan.md) r3 (PR #183 review decisions 17–18; r2 Owner QA decisions 11–16, 2026-11-04); [Charter](./README.md), Owner-approved capability 2026-10-28. |
| Current unit / checkpoint | U1 homepage redesign; PR #183 review fixes (r3). |
| Status | PR #183 open; review fixes committed and pushed, CI pending. |
| Completed evidence | Owner accepted the rendered mockup on 2026-11-04 ([source](./implementation-plans/u1-homepage-redesign/sources/homepage-mockup.html)); Playwright CLI screenshots of the mockup at 1440px and 375px showed no horizontal overflow and no console errors. CP1–CP4 on the working tree: `npm run test:ci` 145 files / 2171 tests passed; `npx tsc --noEmit` and eslint on changed files clean; `npm run test:e2e -- e2e/smoke/account-menu.smoke.spec.ts e2e/smoke/public-course-discovery.smoke.spec.ts` 8 passed; Playwright CLI on the local dev stack at 375, 768 and 1440px: no horizontal overflow on `/`, `/courses`, `/login`, `/register`, `/learn` (redirects to login) and a 404; one `h1`; tab order header → hero → practice; Route Blue 2px focus ring; reduced motion removes the flip; guest, seeded student and seeded teacher show the AC2/AC8 states. After r2: `npm run test:ci` 145 files / 2176 tests passed; tsc and eslint clean; sample mode at 375 and 1440px shows covers, testimonials and social links with no overflow; intro flip, deck tabs, completion with confetti, footer and card hovers and the teacher primary button checked in the browser. The e2e smokes were not rerun: r2 does not change the header or sheet. After r3: affected tests (`homepage`, `public-course-catalog`, `public-heading-hierarchy`, `legal-pages`) 44 passed, tsc and eslint clean; `seed-homepage-demo.mjs` reverted the legacy `public/` covers and applied/reverted/applied data-URI covers on the local DB (13 each); browser-pane QA in sample mode at 375×812, 768×1024, 1366×768 and 1920×1080: no horizontal overflow (also during card swaps), no target under 24px, intro flip only once the card is on screen (mobile after scrolling, tablet at ~734 ms), deck tabs, completion and keyboard order checked. |
| Accepted deviations | None. |
| Blockers / Owner decisions | Whether the header becomes sticky as in the mockup (kept non-sticky, as before, because no AC covers it). Vercel Preview is blocked until the repo owner adds `donguyenxieu-coder` to the Vercel team. |
| Next action | Watch PR #183 CI; then repo-owner review. |
| Current authority | Review fixes, local commits, push to `feat/homepage-redesign` and CI watching granted 2026-11-04; local demo-cover runs done. No merge, hosted database or deployment action is granted. |

## Milestones

- 2026-11-04 Owner approved the U1 homepage redesign plan r1 (`c64f30c`).
- 2026-11-04 U1 homepage body, deck demo, motion and sample mode committed (`6ec68b9`).
- 2026-11-04 U1 public course card restyle committed (`da245f6`).
- 2026-11-04 U1 white header and mobile navigation committed (`876f366`).
- 2026-11-04 U1 local demo covers script committed (`bf177c6`).
- 2026-11-04 U1 plan r2 records the Owner QA decisions 11–16 (`18bdded`).
- 2026-11-04 PR #183 opened for U1 (PR 183, `18bdded`).
- 2026-11-04 U1 plan r3 records the PR #183 review fixes and UIUX-001 (this commit).
