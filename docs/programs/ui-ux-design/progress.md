# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U2 plan](./implementation-plans/u2-courses-catalog-redesign/plan.md) r5: r3 approved by the Owner 2026-11-05; r4–r5 record Owner decisions 13–15. |
| Current unit / checkpoint | U2 on `feat/courses-catalog-redesign` from `736cc56`; CP1–CP4 and final QA done. |
| Status | Implementation and final QA committed locally; independent re-review passed `c86164d`; Owner review of the running screen pending. |
| Completed evidence | CP1 on root-local 45321: `migration up --local` applied; read-model integration suite 17/17 (parity with the D2 helper and detail RPC on every listed course, preview edge states, 30-day count, admin own-row overlay, ACLs); a mutated quota formula made the parity query report a mismatch and the restored function reported none; action tests 24/24; `tsc`, targeted eslint and `docs:check` passed. Isolated runtime 45441 rebuilt from scratch with `db reset --local`, function present, stack stopped. `db diff --schema public` on root: no changes. `EXPLAIN (ANALYZE, BUFFERS)` in rolled-back transactions: about 8/22/35 ms at 243/543/1,043 courses, all shared hits. `seed-catalog-demo.mjs` applied, reverted and re-applied (30 courses, 158 topics, 1,524 cards, 797 enrollments); a repeat apply is a no-op. CP2: catalog-query unit 11/11, explorer interaction 7/7, catalog page/heading 11/11, related public/action suites 132/132; `tsc` and eslint passed. Browser (Next dev on root-local, fixture applied): diacritic-free search with highlight, price counts, page 2 → Back → Forward, filters + page → detail → Back restored, invalid parameters redirected to the canonical URL, no-results panel with the other-price button, signed-in student saw "Đang học" only on enrolled courses, 375px without horizontal scroll. CP3: explorer tests 9/9 incl. inert/aria-hidden leaving cards and reveal armed only below the viewport; related suites passed; `tsc`/eslint passed. Browser motion (reflow, indicator slide, reveal, reduced motion) not yet observed: the Browser pane was hidden, so layout was not computed at hydration and no card was armed (the safe G7 path). CP4: shared course states on Product Language tokens; state-related component suites 73/73; `npm run test:e2e -- e2e/smoke/public-course-discovery.smoke.spec.ts` 1 passed on a fresh isolated runtime (stopped afterwards); search terms are trimmed before they enter the URL. Implementation review 1 (independent session): 0 Critical, 1 Required (price buttons, chips and "Xóa tất cả" below 44px on touch), 6 Optional; fixed R1 with `pointer-coarse:min-h-11` and Optional 1, 2, 4, 5, 6; Optional 3 (page change fades in without a fade-out) is left for the motion QA. After the fix: integration 17/17, related suites 81/81 plus explorer 9/9, `tsc` and eslint passed; fixture re-applied with `translation` card backs. Independent re-review of `c86164d`: PASS (0 Critical, 0 Required). Final QA with the pane visible (Edge pane, root-local, fixture): reveal armed only for the 8 cards below the fold, rows revealed in 0/70/140/210 ms stagger mid-transition (opacity about 0.2, 17px), focus on a pending card revealed it at once; a moving card animated from (139, 972) to (1021, 448) through intermediate transforms in about 520 ms; the price indicator slid 596→613→676→687 px; a page change faded the grid in 0→1 over about 350 ms, scrolled below the toolbar and focused the first course. 375px touch: no overflow, price buttons and chips 44px. 720px (200% zoom equivalent): no overflow, toolbar not sticky. Measured contrast: text pairs 4.72–16.03:1 after raising inactive counts and the `/` hint to slate-600 (were 4.35:1); control boundaries 4.55–4.76:1 after decision 15 (were 1.48:1). Not verified in a browser: reduced motion (no emulation in the pane; covered by component logic). |
| Accepted deviations | AC5 canonical rewrite runs as a server redirect, because a client `history.replaceState`/`router.replace` during hydration was overwritten by the App Router. `node_modules` lacked `motion` from `main`; `npm install` restored it and its unrelated lockfile rewrite was reverted. The integration suite runs with env from `supabase status -o env` because `.env.local` points at an older port. |
| Blockers / Owner decisions | The hosted migration needs its own grant before merge. U1 leftovers are tracked in [UIUX-002](./problems.md#uiux-002). |
| Next action | Owner reviews the running `/courses`, the shared states on `/` and the detail route, and decides Optional 3 (page change fade-in only). |
| Current authority | Owner granted 2026-11-05: plan r3 approval, implementation of CP1–CP4 by Main in this session, and local commits per checkpoint. Local DB work follows the plan (root `migration up`, isolated-runtime reset, root-local fixture script). No push, PR, merge, hosted migration or deployment is granted. |

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
- 2026-11-05 U2 Owner QA: the sort control uses the shared Radix Select with icons instead of the native select (this commit).
