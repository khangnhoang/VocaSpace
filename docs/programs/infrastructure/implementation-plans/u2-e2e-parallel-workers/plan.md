# INFRA-U2 detail plan — Parallel E2E workers and balanced shards

Revision: r3, 2026-11-22. Owner approval: 2026-11-22. Charter: [README.md](../../README.md). Directions: [FEAT-026](../../future-features.md#feat-026-parallel-playwright-workers-per-e2e-shard) and [FEAT-028](../../future-features.md#feat-028-balance-e2e-shards-and-measure-3-and-4-shards); FEAT-028 continues the dropped INFRA-U1 CP4.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: each CI E2E shard runs the smoke suite with more than one Playwright worker on its single isolated Supabase stack, every smoke spec owns the data it changes, and the shards are balanced by measured duration, so the slowest shard finishes sooner with unchanged coverage and no new flake.

| ID | Observable result |
| --- | --- |
| AC1 | No two smoke spec files that can run at the same time write the same row, Storage object or auth user, or assert over state (a count, a list, a page-wide locator) that another concurrently running file can change; and no file depends on state left by an earlier file on the same `parallelIndex`. A data-ownership table recorded at CP1 lists each of the 26 files as `worker-scoped`, `seed-bound` or `read-only`, with the rows or accounts it writes, the read scope its assertions depend on, its preconditions and its cleanup scope. |
| AC2 | With 2 workers, a local `npm run test:e2e:smoke` on the isolated stack passes 3 consecutive full runs; with `workers: 1` it still passes once. A failure in any of these runs is kept with its trace per the test skill and blocks CP4. |
| AC3 | `e2e/admin` and `e2e/d2` specs that share a changed fixture still pass locally with one worker. |
| AC4 | Coverage is unchanged, checked by test identity. Before CP1 the smoke test list of the base (`npx playwright test e2e/smoke --list`) is saved as `file › title path` IDs without the project name; the final list maps one-to-one onto it, and any rename or split is an explicit recorded exception. For each CI run, the project-qualified IDs merged from that run's two shard logs contain each final smoke ID exactly once, all passed, and equal the final `--list` (`scripts/e2e/shard-ids.mjs`, extended for several projects); setup-project tests, which run in every shard, are checked separately and are not smoke IDs. |
| AC5 | A local `npm run test:e2e` keeps its current defaults: database reset before tests, runtime stopped afterwards, one worker unless the worker count is set explicitly. `production-gate` keeps its required/skipped semantics. |
| AC6 | On the final revision, two CI runs (one push plus one re-run) record per-shard job durations, the E2E step time, the worker count and runner-minutes per run (sum of shard job durations) in progress, against the INFRA-U1 CP3 result (slowest-shard median 557 s on `9b343dcd`). |
| AC7 | Progress gives the Owner the measured 2-shard result and labelled estimates for 1 shard × N workers and 3 shards, with time and runner-minutes, for the shard-count decision. |

### 1.2 Scope and non-goals

- In scope: E2E fixtures under `scripts/e2e/` and `e2e/support/`, the smoke specs that use them, `playwright.config.ts`, `scripts/e2e/run-e2e.mjs`, the CI `e2e` job, the one Node-test step of the CI `checks` job that must also run the shard manifest test, the shard manifest and its tests, and infrastructure docs.
- Non-goals: application code, migrations, `supabase/seed.sql` content, one database per worker, more than one Supabase stack per job, new smoke coverage, the Node version (FEAT-027), and changing the shard count (Owner decision after AC7).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Fixture IDs, emails, usernames, slugs and Storage paths that a worker writes are derived from the Playwright parallel index (`testInfo.parallelIndex`) in a namespace that cannot collide with `supabase/seed.sql` or another worker; seeded rows are never written by worker-scoped files. | Two workers overwrite or delete each other's rows; a collision with a seed UUID corrupts seed-bound files. |
| G2. Files that must use seeded rows (for example the B2 review cards of `student@gmail.com`) run in one Playwright project limited to `workers: 1`, and no other project writes those rows or that account. | A seed-bound file runs next to a writer of the same rows and fails or flakes. |
| G3. Shared accounts that several workers log in with are created or updated once before tests (setup project or global setup), not by each fixture call. | A concurrent `updateUserById` resets a password or session while another worker is logged in. |
| G4. Fixture guards that refuse a non-isolated runtime (loopback, port 45441, `.e2e-runtime`) stay in place on every changed fixture. | A worker-scoped fixture writes to a dev or hosted database. |
| G5. The worker count comes from one setting (an env value read by `playwright.config.ts`, default 1); CI sets it explicitly. | Local runs silently change behavior, or CI and the measured value differ. |
| G6. Every smoke spec is in exactly one shard, checked by a node test that the CI `checks` job runs; a new spec file without a manifest entry, or a file in two shards, fails that test. | A new spec is silently skipped in CI. |
| G7. CI runs only at the final reviewed revision: one triggering event (opening the PR at that SHA, or pushing that SHA to an already open PR) and one full re-run of the same workflow run ID on the same SHA. Nothing else is pushed to the PR branch before the Owner's merge decision. | The GitHub Actions quota is spent on intermediate measurements, or a later commit changes the measured head. |
| G8. No retries are added and no assertion is weakened to pass in parallel; an exact count stays exact over the data the file owns. | Flake is hidden and coverage drops. |

### 1.4 Owner decisions that bind this unit

1. (2026-11-22) Parallel workers by worker-scoped fixture data, not by grouping all shared-data files into serial projects.
2. (2026-11-22) CI budget: two CI runs, both on the final revision (push plus one re-run); everything before is verified locally.
3. (2026-11-22) The shard count stays 2 during this unit; the Owner decides 1/2/3 after AC7.

## 2. Repository facts

Baseline: `1e3ae411` (main after PR 194) plus the two INFRA-U1 closing commits, checked 2026-11-22. A read-only audit of all 26 smoke files backs the facts below; file:line evidence is in that audit's report and is rechecked by the implementor at CP1.

- `playwright.config.ts` sets `fullyParallel: false`, `workers: 1`, one `webServer` on port 3100; Playwright 1.64.1 supports a per-project `workers` limit — justifies G2 and G5.
- `scripts/e2e/run-e2e.mjs` forwards its arguments to Playwright unchanged, resets the database once before the run (or skips it on a verified fresh CI stack) and nothing resets between files — justifies AC1: state carries across files.
- Each CI shard has its own runner and Supabase stack; today no two files ever share the database at the same time — the first concurrency comes from this unit.
- 16 of 26 smoke files are unsafe in parallel, 4 risky, 6 safe. Shared data: the learning matrix course `d8a00000-…` and its Storage paths (6 files), topic `66666666-…` in course `44444444-…-444` whose prepare deletes all cards and exercises (6 files), course `44444444-…-445` with a prefix cleanup (2 files), portfolio course `f8100000-…-001` (2 files), the seeded student's B2 review rows and student-wide due counts (2 review files, read by 2 more), the `local-toeic` enrollment toggled by `public-course-free-enrollment`, and the fixed revocable admin shared with `e2e/admin/admin-user-hardening.spec.ts` — justifies AC1, AC3, G1, G2.
- `scripts/e2e/support/auth-users.mjs` calls `updateUserById` (password, metadata) on every call for an existing user; `course-authoring-base-fixture.mjs` rewrites `admin@gmail.com` and `teacher@gmail.com` on each call from 10 spec files — justifies G3.
- No fixture uses `workerIndex` or `parallelIndex`; uniqueness today is only ISO time plus `randomUUID` in titles — justifies G1.
- `topic-builder-sheet-layout.smoke.spec.ts:69` uses an unscoped `getByRole('button', { name: 'Đưa vào thùng rác', exact: true })` while other fixtures give the same teacher several courses; this is a likely cause of [E2E-LOCAL-001](../../problems.md#e2e-local-001-topic-builder-sheet-layout58-times-out-in-local-multi-spec-smoke-runs) — the fix is related work in CP1 and must be shown, not assumed.
- INFRA-U1 left a duration-balanced shard manifest (`scripts/e2e/smoke-shards.{json,mjs}` and test, commit `fe61e436`, removed again in the next commit) and `scripts/e2e/shard-ids.mjs` — reusable for G6 and AC4.
- The repository is private; `ubuntu-latest` runners bill account minutes and their core count limits useful workers — justifies G7 and H5.

## 3. Bounded implementation hypotheses

- H1 — A small helper (for example `scripts/e2e/support/worker-scope.mjs`) turns a parallel index into deterministic IDs, emails and Storage prefixes per fixture; each fixture takes the index as an argument. May change shape if G1 and G4 hold.
- H2 — Teacher-side files (topic 6666 group, course 445, portfolio, course-leave, topic-create) get a worker-scoped teacher plus worker-scoped course, chapter and topic copies; exact card and chapter counts then cover only that worker's topic.
- H3 — Student-side matrix files and `public-course-free-enrollment` get a worker-scoped student and a worker-scoped matrix course and Storage prefix.
- H4 — Files bound to seed rows (`review-session`, `review-session-recovery`, `enrolled-course-overview`, `learning-workspace`, `admin-gate`, and any file the CP1 recheck adds) go into a `seed` project with `workers: 1`; read-only files may stay in the parallel project. A seed-bound file may move to worker scope instead if its seed rows can be copied without changing `seed.sql`.
- H5 — The measured CI configuration is 2 shards × 2 workers (2-core runner: Chromium, `next start` and Postgres share the cores); no other worker count is measured in this unit. AC6 compares the median over the two runs of max(shard 1, shard 2) job duration with 557 s. Estimate: E2E step 299–411 s → ≈ 200–280 s; slowest shard ≈ 430–480 s, an estimate until AC6. The AC7 estimates for 1 and 3 shards use the measured per-job startup time (setup to tests start), the per-file test times and the serial time of the `seed` project.
- H6 — Shard lists are rebalanced from measured per-file durations under the new worker count (restore the `fe61e436` manifest approach, sized from local 2-worker timings and the last CI per-file timings); the `seed` project's serial time is the floor of whichever shard holds it, so its files may be split across shards.

## 4. Checkpoints

CP1–CP3 are local only; CP4 is the only CI step (G7). Every local E2E run first confirms that no other session uses the `voca_space_e2e` stack.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Base smoke ID list saved (AC4); ownership audit rechecked and recorded (AC1 table). First a pilot: the worker-scope helper (H1) and the part of G3 these two files need (the shared admin account set up once, a worker-scoped teacher per worker, and fixtures that only reference the admin when they create data) applied to one pair that shares topic 6666, `exercise-authoring` and `flashcard-delete`. Only after the pilot passes: the rest of the shared-account setup (G3), the remaining teacher-side fixtures moved to worker scope (H2), and the E2E-LOCAL-001 locator fixed if the recheck confirms the cause. | Pilot, on one stack with 2 workers: the two files report different `parallelIndex` values and different fixture IDs, their test time ranges overlap (from the reporter's start and end times), and after one file's prepare and cleanup the other file's rows are still present. Portfolio group (`teacher-course-portfolio`, `topic-builder-sheet-layout`): run concurrently on 2 workers and in sequence on 1 worker, with the layout test's real-scrollbar precondition kept. `node --test` for new helper tests; `npx tsc --noEmit` and `npm run lint` on the changed fixtures and specs; changed specs with 2 workers; full smoke with 1 worker once. |
| CP2 | Student-side fixtures moved to worker scope (H3); `seed` project with `workers: 1` (H4); worker count read from one env setting (G5). | `npx tsc --noEmit` and `npm run lint`; full smoke with 2 workers 3 times in a row (AC2); full smoke with 1 worker once; affected `e2e/admin` and `e2e/d2` specs with 1 worker (AC3); `npm run test:e2e` defaults checked (AC5). |
| CP3 | Shard manifest restored and rebalanced for the worker count (H6) with the coverage test (G6) run by the `checks` job; CI sets the worker count. Then the whole-diff self-review and final local regression; Main's independent implementation review (Codex) passes on the final SHA before any CP4 grant is asked. | `node --test scripts/e2e/*.test.mjs`, including a missing-file case and a duplicate-file case that the manifest test rejects; local run of each shard's file list with 2 workers, and `scripts/e2e/shard-ids.mjs` on those two local logs against the final `--list` (AC4 trial); final regression per test-quality-strategy Verification stages: `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, `npm run docs:check`, plus any earlier check the later changes invalidated. |
| CP4 | CI measurement on the final reviewed SHA (AC4, AC6, AC7), reported to the Owner with SHA, run ID and attempt numbers. | Run 1 and its re-run as in the runbook (G7); `production-gate` green on both; `scripts/e2e/shard-ids.mjs` on each run's pair of shard logs; durations, worker count and runner-minutes in the report. Writing them into progress is a later docs commit (runbook step 4). |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A hidden shared write is missed and flakes only under CI timing. | AC1 table per file; 3 consecutive local 2-worker runs; any CI failure is classified before a fix and blocks the merge. |
| The 2-core runner gains little or slows tests down from CPU contention. | H5 is measured at CP4; if the slowest shard is not faster than 557 s, the Owner decides whether to keep the fixture work with `workers: 1` or revert the worker setting. |
| Worker-scoped copies make fixtures slower (more rows per worker). | Create per-worker data once per worker where tests allow; record setup time in the CP2 local timings. |
| Seed-bound serial files become the slowest shard's floor. | H6 splits them across shards; H4 allows moving a file to worker scope. |
| CI quota. | G7; no intermediate pushes; a failed CP4 run is diagnosed locally before any further run, which needs a new Owner grant. |

- Rollout runbook: (1) CP1–CP3 start after the Owner approves this reviewed plan and grants implementation; commits need a commit grant. (2) CP4 needs the Owner's push, PR-creation and one re-run grant. The workflow runs on pull requests to `main` and on pushes to `main`, not on a push to a branch without a PR: push the reviewed SHA and open the PR, which starts run 1 (or, if a PR is already open, the push starts it). (3) Re-run the whole workflow run on the same SHA (`gh run rerun <id>`) for the second sample. (4) Main reports the CP4 numbers to the Owner; recording them in progress is a docs commit made after the measurement, and pushing it starts another full CI run, so it is pushed only under a new grant (for example together with the Owner's merge decision) or kept local for the next docs PR. (5) The change reaches `main` only through the Owner's merge, which starts the workflow on `main` once more; that run counts against the quota and is the Owner's call.
- Stop when: the CP1 pilot does not show overlapping runs with intact data on both sides; a file cannot be moved to worker scope or the `seed` project without changing `seed.sql` or application code; any of the AC2 runs fails and the cause is not established; AC4 fails; a CI run fails (no second push without a grant); a rule conflict needs an Owner decision.
- Rollback: set the worker count back to 1 and revert the shard manifest; worker-scoped fixtures stay correct with one worker. Nothing touches hosted data.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
