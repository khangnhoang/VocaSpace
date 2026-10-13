# AR1 detail plan — move durable agent rules out of Claude memory

Revision: r3, 2026-10-14 (Codex plan review r2: CP3 reruns every affected case on the reviewed candidate; D1 residual points to FUTURE-PUBLISH-001; C6 cites AGENTS.md rule 5. Codex plan review r1: the live E2E single-run rule, Jev limits, Codex machine observations, the AUTH bundling rule and the CP9 note get their own disposition; shrink residuals named; CP3 pass condition). Owner approval: pending. Master plan: none (single-unit program).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: durable working rules that today live only in Claude's machine-local memory (`C:\Users\khang\.claude\projects\C--VocaSpace\memory\`) are in the repository, each in exactly one owner. After merge, the memory folder keeps only program state and machine facts.

| ID | Observable result |
| --- | --- |
| AC1 | Every memory file listed in §1.5 has exactly the disposition given there. Each moved rule appears in its destination with the same meaning; nothing is moved twice. |
| AC2 | `.claude/rules.md` exists and `CLAUDE.md` imports it (`@.claude/rules.md`), so a Claude session started in this repository loads it. Codex does not load it as an instruction file (it may still read it as a review target). |
| AC3 | No moved rule duplicates or contradicts text already in `AGENTS.md`, `docs/agent-loops.md` or a skill. A rule a skill already covers is not added again (the memory is only deleted). |
| AC4 | The skill additions (§1.5 S1–S4) sit in the owning skill, keep its structure, and pass `node .agents/scripts/validate-skill.mjs`. |
| AC5 | `.claude/rules.md` states the three Owner exceptions explicitly, so they no longer read as conflicts: Haiku Explore without asking, foreground CI watching, and the standing Codex review scope (§1.4 D4). |
| AC6 | After the PR is merged, the memory folder no longer holds the moved rules or the closed units' state, each shrunk file holds exactly the residual named in §1.5 and nothing else; `MEMORY.md` lists exactly the remaining files (§1.5 "Stays" and "Shrinks"). |
| AC7 | The S3 fresh-reader round passes: a reader given only the changed `fresh-reader-testing.md` answers that a reader round waits until the implementation review has passed, and that a later skill-text fix reruns only the cases covering the changed rule. |

### 1.2 Scope and non-goals

- In scope: `AGENTS.md` (one rule), new `.claude/rules.md`, `CLAUDE.md` import line, four skill files, one dated decision in `docs/programs/auth-onboarding/plan.md`, this program's docs and the Programs row in `docs/README.md`; Claude's memory folder (outside Git, done by Main after merge).
- Non-goals: rewriting existing rules in `AGENTS.md` or skills; changing `.codex/` or `.claude/agents/`; translating existing docs; moving program state into the repository (`progress.md` files already own it).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `.claude/rules.md` stays short: neutral rules (not "the Owner prefers"), aim for one or two lines each, longer only when shortening would drop a limit or condition. | The file loads in every session; a long or chatty file wastes context on every turn, and over-shortening loses meaning. |
| G2. Memory files are deleted or shrunk only after the PR is merged. | If the PR is dropped or changed, the rules would exist nowhere. |
| G3. Skill edits follow `maintain-repo-skills`; the fresh-reader round runs only after the implementation review passes. | Skill text changed without the required evidence, or reader evidence spent on a stale candidate. |
| G4. Wording that already exists in a skill or `AGENTS.md` is not restated in `.claude/rules.md`; rules.md may point to the owner instead. | Two owners for one rule drift apart. |

### 1.4 Owner decisions that bind this unit (2026-10-13)

- D1. Routing: a short rule for both Claude and Codex goes to `AGENTS.md`; a Claude-only rule goes to `.claude/rules.md`; a rule inside an existing skill's domain goes to that skill only when the skill does not already cover it, with no conflict and no duplicate.
- D2. The "stop the Owner's `next dev` when it blocks E2E" rule is stale (E2E now runs on port 3100 with `.next-e2e`) and is deleted, not moved. The "no `node_modules` junction worktree" rule goes into a skill.
- D3. The fresh-reader ordering rule goes into `maintain-repo-skills` (with the fresh-reader round that this change itself requires).
- D4. Codex scope: Claude runs a Codex review on its own for every plan and for the main implementation, looping fix and resume until PASS. Small fixes during Owner QA get no Codex round. Any other Codex call happens only when the Owner asks.
- D5. Jev (TypeSafe) usage goes into `.claude/rules.md` as optional: use it when the key and the `typesafe-ai` skill are available; otherwise skip it. No hard-coded machine path.

### 1.5 Disposition of every memory file

Moved to `AGENTS.md`:
- A1 `privacy-policy-keep-in-sync` — a change that adds user data, a new read path of user data for other people, or a third party updates `/privacy` (and `/terms` when relevant) in the same PR; legal wording changes need Owner approval.

Moved to the owning program document:
- P1 `auth-followups-bundle` → a new dated Owner decision in `docs/programs/auth-onboarding/plan.md` §3 (Owner, 2026-10-05): remaining deferred AUTH follow-ups default to one combined PR rather than one PR each. Scope stays the auth-onboarding program; it is not a repository-wide PR rule.

Moved to a skill (not covered today):
- S1 `merge-commit-default` → `github-pr-ci-workflow` `references/merge-and-auto-merge.md`: a granted merge uses `gh pr merge <n> --merge`; never squash or rebase unless the Owner asks.
- S2 `worktree-node-modules-junction` → `git-checkpoint-workflow` (branch and working-tree safety rules): never create a temporary worktree whose `node_modules` is a junction or symlink to another checkout; removing it on Windows can delete the target's `node_modules`.
- S3 `skill-test-after-review` → `maintain-repo-skills` `references/fresh-reader-testing.md`: run fresh-reader cases only on a candidate that passed the implementation review; when a review fix changes skill text, rerun only the cases that cover the changed rule.
- S4 the live rule in `e2e-separate-distdir-followup` → `test-quality-strategy` `references/smoke-e2e-and-browser.md`: run one E2E run at a time, because each run resets the shared isolated database (`scripts/e2e/run-e2e.mjs`); Playwright `workers: 1` only limits one process.

Moved to `.claude/rules.md`:
- C1 Codex review: `plan-review-loop`, `codex-review-defaults`, `skip-review-small-qa-fixes`, and the durable part of `codex-mcp-delegation` (use `codex exec`, not an MCP server; a new review target gets a fresh session; repeat `-m`/effort/sandbox on every resume and check the log header; give the Owner the round prompt when a Codex app thread holds the writer). Scope per D4.
- C2 `ask-decisions-before-plan`: open Owner decisions go through AskUserQuestion (recommended option first) before the plan is written or reviewed.
- C3 Implementation: `sonnet-implement-default`, `orchestrator-single-implementor`, `main-does-not-implement` (one `sonnet-high-implementor` session for an approved, fully decided plan; corrections via SendMessage to the same session; Main does not edit product code or tests; the handoff grants local commits only).
- C4 `explore-subagent-haiku`: several narrow parallel `Explore` subagents with `model: "haiku"` for multi-dimension discovery, without asking; Main verifies and decides; a `Workflow` script still needs an explicit opt-in.
- C5 `ci-watch-actively`: when told to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground; do not wait for app events.
- C6 `jev-usage-for-agent-work`: per D5, keeping its limits: only for bulk, narrow judgments (roughly 20 or more items with the same question); not for review verdicts, plan decisions or single-item calls; output is advisory per `AGENTS.md` rule 5 (cite it, do not restate it); never send secrets, `.env*` contents, real user data or hosted DB rows; do not install third-party Jev plugins unless the Owner asks. Drop only the machine path and the "ask the Owner for the key" step (D5 replaces it with skip).

Deleted without moving (already covered or stale):
- `docs-english-reports-vietnamese` — covered by `repo-docs-system` (Language) and `AGENTS.md` Owner-facing language.
- `targeted-tests-per-cp` — covered by `test-quality-strategy` (targeted verification is the default).
- `stop-dev-server-for-e2e` — stale (D2).
- Closed units' state, already recorded in repository progress or problems files: `d3-memory-check-state`, `d4-plan-state`, `d7-plan-state` (its open items AUTH-022, AUTH-023 and Google brand verification are in `docs/programs/auth-onboarding/progress.md` State), `f1-student-flow-state`, `flashcard-completion-rule-followup`, `lf2-plan-state`, `lf3-plan-state`, `lf4-plan-state`, `lf5-topic-completion-followup`, `lf6-plan-state`, `lf7-plan-state`, `ui-4-plan-state`, `topic-reorder-lock-order-followup`, `learning-ux-followups`, and `e2e-separate-distdir-followup` after S4 moves its live rule.
- `claude-rules-extraction-plan` — this plan replaces it.

Shrinks (keep only the named residual, each labelled with its date):
- `d1-rescue-contract-drift` → the reconcile-layer debt that is not in the repository: F2 (the frozen plan's §5.6 `returns public.topics%rowtype` is invalid SQL; the migration uses `returns public.topics`), F7 (the §3.13 claim that `previewer` plus an active contributor row is unreachable is false; a downgrade leaves the row), and M24 falsifying plan assumption A1. The 2026-10-09 local-QA confirmation stays only as a pointer to `FUTURE-PUBLISH-001` in `docs/programs/student-user-flow-route/problems.md`, which holds that evidence.
- `codex-mcp-delegation` → machine observations only, dated: Codex CLI uses the Owner's ChatGPT Plus login; `codex mcp-server` was removed in 0.154.0 and no Codex MCP entry exists; Supabase CLI failed inside a Codex sandbox with EPERM on `~/.supabase/telemetry.json` (observed 2026-10-04, not re-verified). The rules move to C1.
- `doc-system-optimization-state` → one dated note: `.agents/scripts/run-skill-eval-harness-cp9.test.mjs` failed on main and is not in CI (observed 2026-10-05); a rerun on 2026-10-14 ended at the 120 s test timeout, so its current cause is unconfirmed.

Stays: `jev-repo-evaluation`, `admin-console-plan-state`, `brand-logo-header-followup`, `auto-compact-window-setting`, `claude-code-effort-level-resolution`, `claude-code-subagent-model-resolution`.

## 2. Repository facts

Baseline: `1ff5588`, checked 2026-10-13.

- `CLAUDE.md` imports only `@AGENTS.md`; `.claude/` has no rules file — justifies AC2.
- `github-pr-ci-workflow/references/merge-and-auto-merge.md` names no merge method; `git-checkpoint-workflow` has no worktree or junction rule; `maintain-repo-skills/references/fresh-reader-testing.md` does not order the round against the implementation review — justify S1–S3.
- `repo-docs-system` SKILL.md "Language" and `test-quality-strategy` SKILL.md ("Targeted verification is the default") already hold two memory rules — justify the deletions.
- `playwright.config.ts` runs E2E on port 3100 with `NEXT_DIST_DIR=.next-e2e` — justifies D2.
- `ci-watch-and-triage.md` already prefers `gh pr checks --watch` — C5 keeps only the Claude-specific part (foreground, no app events).
- CI runs `node .agents/scripts/validate-skill.mjs` and its tests (`.github/workflows/ci.yml`) — verification for AC4.
- `scripts/e2e/run-e2e.mjs` resets the isolated database on every run, and `smoke-e2e-and-browser.md` has no single-run rule — justifies S4.
- `docs/programs/auth-onboarding/plan.md` Decision 14 records only the A5 batch, not a default for later AUTH follow-ups — justifies P1.
- `docs/programs/auth-onboarding/progress.md` State already lists AUTH-022, AUTH-023 and Google brand verification — justifies deleting `d7-plan-state`.

## 3. Bounded implementation hypotheses

- `AGENTS.md`: A1 as one bullet in a short new section after "Owner-facing language" — the section name may change if A1 still reads as a repository-wide rule.
- `.claude/rules.md`: headings per group (Codex, planning, implementation, discovery, CI, Jev) — may be flattened if G1 holds.
- S2 placement inside `git-checkpoint-workflow` core safety bullets — may go into `references/branch-start-and-sync.md` instead if its read condition covers creating a worktree.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | This plan and the program docs (progress, Programs row) | `npm run docs:check` |
| CP2 | A1, P1, S1–S4, `.claude/rules.md`, `CLAUDE.md` import | `node .agents/scripts/validate-skill.mjs`; `node --test .agents/scripts/validate-skill.test.mjs`; `npm run docs:check`; `git diff --check`; manual check of AC1/AC3 against §1.5 |
| CP3 | AC7: fresh-reader round for S3, run only after the Codex implementation review passes; 1–2 cases by an independent read-only reader (`opus-medium-reader`, given only the case and the changed file) | Each case recorded per `fresh-reader-testing.md`. CP3 closes only when every case is `passed`. A `failed` or `partially_passed` case sends the wording back to the implementor: fix, self-review, Codex implementation re-review passes on the new candidate, then every case the changed wording affects reruns (unaffected cases keep their evidence). CP3 closes only when all evidence is valid for the final candidate and every case is `passed`; `not_run` keeps CP3 open and is reported. |
| CP4 | After merge, by Main: memory cleanup per §1.5 | Each shrunk file compared before and after against its §1.5 residual; `MEMORY.md` lines match the files left; the next session's loaded context shows `.claude/rules.md` |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A rule changes meaning when it is shortened | Codex review compares each destination line with the memory file (it can read the memory folder by absolute path) |
| `.claude/rules.md` grows into a second AGENTS.md | G1 and G4; review checks length and duplicates |

- Rollout runbook: none (no hosted step).
- Stop when: a moved rule conflicts with a skill or `AGENTS.md` rule and needs an Owner decision.
- Rollback: revert the PR; the memory files are deleted only after merge, so a revert before CP4 loses nothing. After CP4, the moved rules remain in Git history.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
