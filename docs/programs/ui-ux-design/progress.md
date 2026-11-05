# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U2 plan](./implementation-plans/u2-courses-catalog-redesign/plan.md) r4: r3 approved by the Owner 2026-11-05; r4 records Owner decisions 13–14 from the CP1 benchmark. |
| Current unit / checkpoint | U2 on `feat/courses-catalog-redesign` from `736cc56`; CP2 done, CP3 next. |
| Status | CP1–CP2 committed locally; CP3 (motion) next. |
| Completed evidence | CP1 on root-local 45321: `migration up --local` applied; read-model integration suite 17/17 (parity with the D2 helper and detail RPC on every listed course, preview edge states, 30-day count, admin own-row overlay, ACLs); a mutated quota formula made the parity query report a mismatch and the restored function reported none; action tests 24/24; `tsc`, targeted eslint and `docs:check` passed. Isolated runtime 45441 rebuilt from scratch with `db reset --local`, function present, stack stopped. `db diff --schema public` on root: no changes. `EXPLAIN (ANALYZE, BUFFERS)` in rolled-back transactions: about 8/22/35 ms at 243/543/1,043 courses, all shared hits. `seed-catalog-demo.mjs` applied, reverted and re-applied (30 courses, 158 topics, 1,524 cards, 797 enrollments); a repeat apply is a no-op. CP2: catalog-query unit 11/11, explorer interaction 7/7, catalog page/heading 11/11, related public/action suites 132/132; `tsc` and eslint passed. Browser (Next dev on root-local, fixture applied): diacritic-free search with highlight, price counts, page 2 → Back → Forward, filters + page → detail → Back restored, invalid parameters redirected to the canonical URL, no-results panel with the other-price button, signed-in student saw "Đang học" only on enrolled courses, 375px without horizontal scroll. |
| Accepted deviations | AC5 canonical rewrite runs as a server redirect, because a client `history.replaceState`/`router.replace` during hydration was overwritten by the App Router. `node_modules` lacked `motion` from `main`; `npm install` restored it and its unrelated lockfile rewrite was reverted. The integration suite runs with env from `supabase status -o env` because `.env.local` points at an older port. |
| Blockers / Owner decisions | The hosted migration needs its own grant before merge. U1 leftovers are tracked in [UIUX-002](./problems.md#uiux-002). |
| Next action | Implement CP3 (Main). |
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
- 2026-11-05 U2 CP2: catalog page with search, filters, sort, URL state, pagination, cards and states (this commit).
