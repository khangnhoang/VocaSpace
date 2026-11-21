# INFRA-U1 detail plan — Test runtime hygiene, agent working rules and CI E2E speed

Revision: r3, 2026-11-22. Owner approval: 2026-11-22. Master plan/charter: [`../../README.md`](../../README.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: local test and static commands read only this checkout, the four merged worktrees are gone without losing data, agents follow VocaSpace-specific rules for running tests and for working (adapted from DevSpace, not copied), and the CI E2E job — the critical path of every product PR — finishes measurably faster with exactly the same smoke tests.

| ID | Observable result |
| --- | --- |
| AC1 | While the worktrees still exist, `npx vitest list --filesOnly` and the same command with `--config vitest.integration.config.ts` list no path under `.claude/worktrees/` (baseline: 535 of 702 listed files come from worktrees), and the list of main-checkout files is identical before and after the change for each config. |
| AC2 | While the worktrees still exist, `npx tsc --noEmit --listFilesOnly` lists no file under `.claude/worktrees/` and ESLint reports a chosen worktree file as ignored. If either already holds before any change, the plan records that and changes nothing for it. |
| AC3 | For each of the four approved paths — `.claude/worktrees/payos-order-code-rpc-484928`, `.claude/worktrees/teacher-course-redesign-summary-e1f5e0`, `.claude/worktrees/xenodochial-aryabhata-452a28` and `~/.codex/worktrees/dm-u4-next-trial/VocaSpace` — the pre-removal check in G6 passed, the Owner confirmed it at execution time, it was removed with `git worktree remove <path>` (no `--force`), and afterwards `git worktree list` no longer shows it. Worktrees not on this list are untouched; no repository-wide `git worktree prune`. Local branch deletion is not part of this and needs its own grant. |
| AC4 | `test-quality-strategy` owns a Verification stages section (implementation, checkpoint, final regression, correction after verification, docs-only), an intermittent-failure rule and the reporting rule from §4 CP2, written with VocaSpace commands; `docs/agent-loops.md` links to it instead of restating it. |
| AC5 | Adopted working rules exist at their owners: tool selection with CLI before MCP and blocker-versus-capability-gap, finding triage, and the shared writer rule for program state and the checkout while an implementor exists (`AGENTS.md`); reading skills through the `Skill` tool and references through a full `Read`, running Node/npm/npx commands through the PowerShell tool, Windows MSIX file virtualization, and the Claude session mechanics of the writer rule (`.claude/rules.md`). `node .agents/scripts/validate-skill.mjs` and `npm run docs:check` pass. |
| AC6 | On the final workflow (after CP4), the slowest E2E shard's job duration, as the median of at least two runs on the same revision, is at least 120 s below the baseline median of 683 s. CP3 reports the startup saving on its own; this threshold is applied once, at CP4. |
| AC7 | Coverage is unchanged: on the same commit, the test IDs (file, title path, project) merged from every shard's report contain each ID exactly once, every one passed, and the merged set equals `npx playwright test e2e/smoke --list`. When a spec is split, a one-to-one mapping from the full pre-split ID set to the full post-split ID set is recorded and checked, so no test disappears during the split. `production-gate` keeps its required/skipped semantics, and a local `npm run test:e2e` still resets the database before tests and stops the runtime afterwards. |
| AC8 | CP4 records before/after per-shard durations and E2E runner-minutes per run (sum of shard job durations) in progress, and asks the Owner whether to move to 3 or 4 shards, giving the 3/4-shard time and minute figures as labelled estimates. |

### 1.2 Scope and non-goals

- In scope: Vitest/TypeScript/ESLint exclusion of `.claude/worktrees/**`; removal of the four approved worktrees; the agent rules in AC4–AC5; E2E job startup reduction and shard balancing in `.github/workflows/ci.yml`, `scripts/e2e/run-e2e.mjs` (with a focused test for its new decision) and `playwright.config.ts`; FEAT-026 and FEAT-027 records.
- Non-goals: Playwright `workers > 1` (recorded as [FEAT-026](../../future-features.md#feat-026-parallel-playwright-workers-per-e2e-shard)); a `.node-version` / Node 20 alignment (recorded as [FEAT-027](../../future-features.md#feat-027-pin-the-local-node-version-to-ci)); running `e2e/admin` or `e2e/d2` in CI; changing the `integration` or `learner-integrity` jobs; a Supabase CLI major upgrade; changing any test's assertions or data; DevSpace's self-review without a pass cap (it conflicts with VocaSpace's accepted 3-pass cap); DevSpace-only facts (test lock, `devspace-test` stack, `fnm exec` with `.node-version`).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Local `npm run test:e2e` keeps resetting the database and stopping the runtime by default; any skip is opt-in through an explicit env flag that only the CI workflow sets. | Local runs pass on leftover data or leave Docker memory held. |
| G2. The runner skips `db reset` only with positive evidence that this job created the `voca_space_e2e` stack on an empty volume. G2 evidence is a marker the CI step writes outside `.e2e-runtime` (for example under `$RUNNER_TEMP`) only when the volume probe succeeded, found no data volume of the project before its own `supabase start`, and found that project's data volume after the start succeeded; the probe (CLI, label filter, volume name) is proven once on a CI runner in CP3 before the skip is enabled. A failed probe, missing, unreadable or mismatched evidence means reset. | A reused stack runs tests on stale rows; `prepareSupabaseWorkdir()` deletes `.e2e-runtime`, so a marker there would vanish. |
| G3. Shard changes keep the full smoke set, checked by test identity (AC7), not by count. | A test is silently dropped while another runs twice. |
| G4. A Supabase CLI started outside `npx` is pinned to the version `npx supabase --version` resolves from the lockfile, and the CI start keeps its own excluded-service list (eight services, including `realtime`, which the local runner does not exclude). | `supabase/setup-cli` installs latest (v3.x was already offered) or a different service set starts. |
| G5. A cache is kept only when its hit/miss state and the matching step time are recorded and show a saving; otherwise the report claims only the combined effect. Cache keys include `package-lock.json` (and the Playwright version for browsers). | Stale or slower caches become permanent CI cost on unsupported claims. |
| G6. Before removing a worktree: confirm no session or process uses it (app session list, open terminals); `git status --porcelain=v1 --untracked-files=all`, run in that worktree, is empty; HEAD is reachable from `origin/main`; and every ignored entry from `git ls-files --others --ignored --exclude-standard` (expanded to files, not collapsed directories) is classified by path as reproducible (dependencies, build or test output) or not. Stop for that worktree when any entry is unclear or worth keeping. The Codex worktree is checked with `git -c safe.directory=<path>` because its ownership check fails. | Data outside Git (local env files, notes, test results) is lost, or a worktree in use is pulled away from a running session. |
| G7. Skill edits go to the canonical `.agents/skills/<name>/`; rules state VocaSpace facts only, and each adopted DevSpace rule is reworded for VocaSpace owners and commands. | Two diverging copies, or DevSpace commands that do not exist here. |
| G8. The uncommitted `next dev` block in `AGENTS.md` is never staged with this work. | Generated text lands in an unrelated commit. |

### 1.4 Owner decisions that bind this unit

1. (2026-11-22) One plan, opened as Infrastructure initiative u1, including the agent-rule edits even though agent procedure is normally owned by [Agent workflow](../../../agent-workflow/README.md); the edited `AGENTS.md`, `docs/agent-loops.md`, `.claude/rules.md` and skills remain the canonical sources.
2. (2026-11-22) Keep 2 shards and cut startup cost first; decide 3–4 shards only after measuring (CP4).
3. (2026-11-22) Playwright workers above 1 are deferred to FEAT-026.
4. (2026-11-22) Remove the three `.claude/worktrees` worktrees and the Codex worktree `dm-u4-next-trial`, subject to G6.
5. (2026-11-22) Adopt from DevSpace: test verification stages and intermittent-failure handling (test skill), reading skills through the `Skill` tool, tool selection and blockers, finding triage with the state-record writer rule, MSIX virtualization. Node version alignment goes to FEAT-027.

## 2. Repository facts

Baseline: `d2172fe8` (origin/main), checked 2026-11-22.

- `vitest.config.ts` excludes `node_modules`, `.next`, `dist`, integration and e2e paths but not `.claude/worktrees/**`; `vitest.integration.config.ts` includes `**/__tests__/integration/**/*.test.ts` with no worktree exclusion. `npx vitest list --filesOnly` lists 702 files, 535 of them under `.claude/worktrees/` — justifies AC1.
- `tsconfig.json` includes `**/*.ts`, `**/*.tsx`, `**/*.mts` and excludes only `node_modules` and `test-results`; `eslint.config.mjs` `globalIgnores` has no worktree entry. `.claude/worktrees/` is ignored only through `.git/info/exclude` — justifies AC2 (to be measured, not assumed).
- `git worktree list`: three worktrees under `.claude/worktrees/` (`payos-order-code-rpc-484928` on `claude/laughing-dijkstra-654589`, two detached) and `~/.codex/worktrees/dm-u4-next-trial/VocaSpace` (detached). All four have a clean `git status` and a HEAD reachable from `origin/main`. The Codex review found 6, 3 and 5 ignored entries in the three Claude worktrees (not yet classified), and a `dubious ownership` refusal on the Codex worktree — justifies AC3 and G6.
- In Git Bash, `~/.bashrc` runs `fnm env --use-on-cd`; a `cd` in an agent's non-interactive Bash prints "We can't find the necessary environment variables to replace the Node version". VocaSpace has no `.node-version`; CI uses Node 20 (`.github/actions/setup-deps`) — justifies the PowerShell rule in AC5 and FEAT-027.
- DevSpace sources read for adoption (read-only, not copied): `AGENTS.md` (Tool selection; section 2 program state records, including the active/idle implementor and hand-back rules; section 5 finding triage), `docs/agent-loops.md` (Loop 1 verification timing), `.claude/rules.md` (section 6 Reading skills, section 8 desktop app file virtualization), `.agents/skills/test-quality-strategy/SKILL.md` (Verification stages, Repeatability checks, Running and reporting). VocaSpace has none of these rules; its `.claude/rules.md` Preflight reading allows "read its whole SKILL.md" by any means and forbids Main only from editing product code and tests while an implementor owns a plan — justifies AC4–AC5.
- CI: the workflow runs on every `pull_request` to `main` (each push to a branch with an open PR) and on push to `main`. `production-gate` accepts a skipped `e2e`, `integration` or `learner-integrity` job when the path filter says it is not required. `e2e` runs only `e2e/smoke` (`npm run test:e2e:smoke`); `e2e/admin`, `e2e/d2` run in no CI job (`e2e/specs` holds only a Markdown test plan) — justifies the CP2 reporting rule.
- CI `e2e` job: 2 shards (`fail-fast: false`), each on its own runner: `setup-deps` (Node 20, `npm ci`), `npx playwright install --with-deps chromium`, `npx supabase --workdir .e2e-runtime start` with eight services excluded, `npm run build` into `.next-e2e` (no build cache; the `build` job caches only `.next/cache`), then `npm run test:e2e:smoke -- --shard=N/2`. `scripts/e2e/run-e2e.mjs` calls `prepareSupabaseWorkdir()` (deletes and recreates `.e2e-runtime`), reuses the stack when `supabase status` succeeds, always runs `db reset`, probes Kong, runs Playwright and stops the stack unless `E2E_KEEP_SUPABASE=1`. `playwright.config.ts`: `fullyParallel: false`, `workers: 1`, `webServer` on `next start`. Four smoke files use `test.describe.configure({ mode: "serial" })` — justifies G1, G2, G4 and H1–H6.
- The repository is private, so runner minutes are billed against the account quota — justifies Decision 2 and AC8.

### 2.1 Baseline CI timing

Source: GitHub Actions job and step timings of 12 successful CI runs from 2026-11-05 to 2026-11-21 (run IDs 42055529240 … 44942919235; 24 E2E shard jobs), plus the step log of run 44942919235.

| E2E shard step | Median | Range |
| --- | --- | --- |
| Setup dependencies (`npm ci`) | 60 s | 34–92 s |
| Install Playwright Chromium | 24 s | 17–38 s |
| Start isolated Supabase | 88 s | 72–98 s |
| Build application for E2E | 79 s | 53–94 s |
| Run E2E smoke tests (whole step) | 382 s | 280–443 s |
| Shard job total | 634 s | 498–749 s |
| Slowest shard per run (critical path) | 683 s (≈11.4 min) | 602–749 s |

Inside "Run E2E smoke tests" (run 44942919235): `db reset` ≈ 30–33 s on a stack `supabase start` had just seeded, Kong probe and Playwright start ≈ 4–8 s, `supabase stop` ≈ 11 s. Shard 1 ran 45 tests in 4.6 min; shard 2 ran 41 tests in 6.5 min (one 51 s and two 27 s tests). E2E runner time per run ≈ 2 × 634 s ≈ 21 min. Other jobs finish within 98–346 s, so E2E alone sets PR wall-clock.

## 3. Bounded implementation hypotheses

Savings are planning estimates from §2.1 medians, to be replaced by measured numbers. Today's serial path before tests is ≈ 60 + 24 + 88 + 79 = 251 s.

- H1 — Start Supabase in the background right after checkout with `supabase/setup-cli` pinned per G4 (`prepare-supabase-workdir.mjs` imports only `node:` modules, so it runs before `npm ci`), record the G2 marker, and wait for the start before the build. The 88 s start then runs under `npm ci` + Chromium (≈ 84 s). Estimate: ≈ 80 s. May change if Docker pulls slow `npm ci` enough to cancel the gain.
- H2 — Build without waiting for the stack, only if the API URL (`127.0.0.1:45441`) and keys are deterministic for the committed config (compare `status -o env` from two fresh starts without printing keys). With H1 in place the stack is usually ready by the time `npm ci` and Chromium finish, so H2 hides at most the leftover few seconds. Estimate: 0–10 s; drop it if it adds complexity.
- H3 — `run-e2e.mjs` gains a CI-only opt-in that skips `db reset` under G2, with the decision in a small pure function covered by a focused `node --test` file (fresh evidence → skip; flag without evidence, mismatched project, or reused volume → reset; no flag → reset). CI also sets `E2E_KEEP_SUPABASE=1` because the runner is discarded. Estimate: ≈ 40 s.
- H4 — Cache `.next-e2e/cache` keyed like the existing `build` job cache; kept only under G5 with the Turbopack build. Estimate: 0–30 s.
- H5 — Cache `~/.cache/ms-playwright` keyed by the Playwright version, still running `playwright install-deps chromium` for OS packages; kept only under G5. Estimate: 10–20 s.
- H6 — Balance shards: either enable `fullyParallel: true` (serial-mode files stay grouped; other files must be order-independent, checked file by file) or split the longest files. Target: slowest shard's tests ≈ half the 11.1 min total. Estimate: ≈ 50–60 s on the slowest shard.
- Not chosen: caching Docker images (save/load is usually slower than a pull); a separate shared build job (only worth it if shards grow beyond 2 and H2 holds); `workers > 1` (FEAT-026).

Projected result if H1, H3–H6 hold: slowest shard ≈ 8–8.5 min instead of 11.4 (≈ 3–3.5 min saved). E2E runner time per run: ≈ 21 min today, ≈ 16 min with two optimized shards; three optimized shards are estimated at ≈ 18 min. CP4 measures only the two-shard workflow; it uses those numbers to re-estimate the 3/4-shard options for the Owner (AC8).

Agent-rule wording may change as long as each rule sits at the owner AC5 names, states VocaSpace facts only, and passes the validator and `docs:check`.

## 4. Checkpoints

CP1 and CP2 are independent. CP3 and CP4 need CI runs on a pushed revision (see §5 runbook).

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Local hygiene, in this order: (1) with the worktrees present, record the file lists of both Vitest configs, `tsc --listFilesOnly` filtered for `worktrees`, and ESLint on one worktree file; (2) exclude `.claude/worktrees/**` from both Vitest configs, and from `tsconfig.json` / ESLint only where step 1 showed a leak; (3) rerun the same commands on the same files and diff the main-checkout file lists before and after (AC1, AC2); (4) for each approved worktree, run G6 and show the Owner the classified entries, then remove only the confirmed ones (AC3). | The step 1 and step 3 outputs; `npm run test:ci`, `npx tsc --noEmit`, `npm run lint`; `git worktree list` after each removal. Run Node commands through PowerShell. |
| CP2 | Agent rules (AC4, AC5). Test skill: Verification stages; intermittent failures (preserve the first failure's log/trace, a passing rerun neither erases it nor proves the cause); scope by change type — a code, test, dependency or executable-config change runs the local final regression below, while a docs-only change runs `npm run docs:check` and, when a skill changed, `node .agents/scripts/validate-skill.mjs`; reporting rule — the final report names the revision and, per CI job, whether it ran and passed on that revision; CI E2E proves only `e2e/smoke`; an affected executable Playwright spec outside `e2e/smoke` (today `e2e/admin/*.spec.ts` and `e2e/d2/*.spec.ts`) must be run locally with `npm run test:e2e -- <spec>`; a skipped job, an unpushed revision or missing push/PR authority leaves that evidence pending, never passed. Local final regression for code, test, dependency or executable-config changes: typecheck, lint, `npm run test:ci`, the affected integration and E2E files, and `npm run build` for build-affecting config. `AGENTS.md`: tool selection; finding triage (related finding → correction in this task; unrelated → recorded in the owning `problems.md`, or backlog, with evidence; the classification is reported after each QA round); shared writer rule (while an implementor runs a turn, Main edits nothing in the checkout, state records included, and sends changes to it; while it is idle, Main may edit state records, and any uncommitted Main change is committed under an existing commit grant before Main messages it again, otherwise Main asks the Owner). `.claude/rules.md`: Skill-tool reading, PowerShell for Node commands, MSIX virtualization, and how Main detects an implementor's running/idle state with the session tools. `docs/agent-loops.md`: a link to Verification stages. | `node .agents/scripts/validate-skill.mjs`; `npm run docs:check`; `rg` for every changed pointer; self-review against the DevSpace sources in §2 and the existing VocaSpace rules (no averaging of conflicts). |
| CP3 | CI startup reduction H1, H3, H4, H5 (and H2 only if it pays off), with G1, G2 and G4 in the runner and workflow. Report the startup saving per step against §2.1; no pass/fail threshold here. | `node --test` on the new reset-decision test; `npx tsc --noEmit`, `npm run lint`; one local `npm run test:e2e:smoke` with default flags only after confirming no other session uses the `voca_space_e2e` stack (reset and stop still happen); the one-time G2 probe check on a CI runner (probe succeeds, no data volume before start, the volume seen after start) before the skip is enabled; at least two CI runs on the same revision with per-step times and cache hit/miss states; AC7 identity check. |
| CP4 | Shard balance (H6), AC6 threshold on the final workflow, before/after table and runner-minutes in progress, and the Owner's 2/3/4-shard decision (AC6, AC7, AC8). | At least two CI runs on the final revision; per-shard test IDs and durations from each shard's report; AC7 identity check; `production-gate` green. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Background Supabase start fails silently and tests run against a half-started stack. | The wait step checks the start command's exit status and `supabase status` before the build and tests; failure fails the job loudly. |
| Skipping reset hides a seed or migration problem, or runs on a reused stack. | G2 evidence and the focused decision test; local default unchanged (G1). |
| `fullyParallel` exposes order dependence between tests. | Check files one by one; fall back to splitting files; any new flake is preserved per the test skill and blocks CP4. |
| Pinned CLI or service list drifts from the current job. | G4: one source of the version, eight excluded services, both visible in the job log. |
| Agent-rule wording conflicts with existing VocaSpace rules (for example the 3-pass self-review cap). | Non-goal list; conflicts are named to the Owner, not averaged. |
| CI measurement burns runner minutes on a private repository. | Push only at CP3 and CP4 boundaries; two runs per measured revision. |

- Rollout runbook, in order: (1) CP1 and CP2 start only after the Owner approves the reviewed plan and grants implementation; commits need a commit grant; each worktree is removed only after G6 passes and the Owner confirms that path; (2) CP3 needs the Owner's push and PR-creation grants for this branch — every push to the branch with an open PR to `main` starts the full CI workflow and spends runner minutes before any merge; (3) the second run on the same revision is a re-run of that workflow run (`gh run rerun <id>`), which needs the Owner's grant for re-runs; (4) CP4 repeats (2)–(3) on its final revision; (5) the changes reach `main` only through the Owner's merge. Without the grant for a step, stop there and report the evidence as pending.
- Stop when: a worktree has unclear or valuable untracked data, the merged shard IDs fail AC7 (a duplicate, a missing or failed ID, or a split without a complete one-to-one mapping), AC6 misses its threshold at CP4, a required grant is missing, or a rule conflict needs an Owner decision.
- Rollback: revert the workflow, runner and config commits. Worktree removal cannot be undone from Git; G6 ensures every removed HEAD is reachable from `origin/main` and nothing unclassified outside Git is removed.

## 6. Progress

Current State and milestones: [`../../progress.md`](../../progress.md).
