# UI-5 Detail Plan: Rendered UI Review Skill and Structure Pilot

## Status and authority

| Field | Value |
| --- | --- |
| Plan status | `UI-5-PLAN-CANDIDATE-1`, reconciled 2026-10-01 after PR #112 and again after PR #113; Owner directed implementation on 2026-10-01 |
| Branch | `docs/ui-5-detail-plan` |
| Synchronized base | `origin/main` at `f04c2f7` (merge of PR #113, the Structure pilot follow-up), normal-merged into this branch as `50c38bf` on 2026-10-01; previous base `91025bd` (PR #112) via `f2ccc90` |
| Upstream contract | [Master Plan](../../plan.md), `UI-5` and "UI review contract to develop in UI-5" |
| Execution mode | `NORMAL` |
| Current delivery state | [progress.md](../../progress.md) and the State section below |

This plan records discovery and the execution contract so UI-5 can resume without repeating discovery. The Owner authorized non-live implementation (CP1, CP2, and CP3 up to `prepare` with dispatch 0) on 2026-10-01. It grants no live model call, push, PR, merge, or deployment authority; the first live CP3 call needs a separate explicit Owner approval. Model choice for implementation, dogfooding, and review is left to the Owner; only the automated eval configuration is fixed here.

## Binding Spec

### Outcome and acceptance

1. `AGENTS.md` routes to `.agents/skills/frontend-ui-review/SKILL.md`.
   - **Activates** for an explicit rendered UI review, or for a substantial new-page, major-redesign, or shared-visual-change checkpoint, when an accepted design applies and a runnable target exists.
   - **Does not activate** for code, diff, or source-only review; visual-direction critique without a running target (stays `frontend-design`); small copy or cosmetic fixes; functional browser QA, smoke/E2E, or Playwright debugging (stay `frontend-workflow`, `test-quality-strategy`, `playwright-cli`); design authoring or revision (`common-design-authoring`); permission-only classification.
   - **Activated but blocked:** a missing accepted design, runnable target, fixture, or reachable required state yields `blocked` or `not_run`. The review never claims fidelity and never treats current CSS as the standard.
2. The skill defines the review method: exact target revision, accepted sources with their `index.md` hashes, role/data fixture, a state × viewport × input-modality matrix (fine pointer vs touch, keyboard/focus, reduced motion, 200% zoom where relevant), measured accessibility thresholds, and an actually performed user journey, not screenshots alone.
3. Every observation has exactly one class:
   - **(A) Contract mismatch:** cites the owning accepted source and section, a reproducible state, and a correction direction, and names the cause as implementation drift, stale specification, or proposed design change.
   - **(B) Usability/accessibility mismatch:** a measured `frontend-design` WCAG 2.2 AA threshold failure or demonstrable user impact.
   - **(C) Design recommendation:** supported by observed hierarchy, rhythm, density, legibility, motivation, interaction cost, or coherence. Advisory to the Owner and never blocking. A preference with no accepted contract or user impact can only be (C).
4. Unobserved states, viewports, and thresholds are listed as `not_run` or `not_verified` with a reason. Earlier evidence, including the UI-4 CP3 matrix, is historical and not current UI-5 evidence.
5. The output is a **domain result**: evidence, findings, unreached coverage, and one status. It never contains `Approved`, merge readiness, or approval of a design or specification change. `code-review-and-quality` consumes it as evidence and keeps the integrated verdict.
6. **Pilot:** one real review of Teacher Course Structure (`/teacher/courses/[id]/structure`) at an exact `main` revision against the accepted Structure surface (`STRUCTURE-SURFACE-CANDIDATE-2`), Product Language, Teacher Authoring, and Button, using the D3 fixture and the surface §11 checklist. It produces a domain result; a concise summary is recorded in `progress.md`.
7. **Automated evals:** a targeted candidate-only suite runs through the existing Codex CLI runner (`.agents/scripts/run-skill-eval-cli.mjs`, `codex exec`) with reader `gpt-6.1-sol / medium` and evaluator `gpt-6.1-sol / medium`, and is adjudicated with no remaining `Critical` or `Required` finding.

### Scope

- New `frontend-ui-review` skill bundle; a reference only when a meaningful group of invocations does not need it.
- The `AGENTS.md` route.
- One related-skill handoff line in `code-review-and-quality` and one Skill Ownership bullet in `docs/agent-loops.md`; neither repeats the verdict taxonomy.
- New `.agents/evals/frontend-ui-review/{routing,regression,fresh-reader}.json`.
- This plan, `progress.md`, and the pilot summary.

### Non-goals

- Product code, CSS, design, or specification changes. Pilot findings are reported only (D2); any product correction is separate follow-up work.
- Any eval-runner or harness change inside UI-5 (the evaluator-config correction landed separately in PR #112), Claude eval support, and the cp9/app-server path.
- Edits to existing eval suites, new browser tooling or dependencies, CI changes, other surfaces.
- Choosing models for implementation, dogfooding, or review.

### Necessary execution guardrails

| ID | Guardrail | Failure if omitted |
| --- | --- | --- |
| G1 | Route, do not copy: browser commands to `playwright-cli`, fixture/state matrix to `test-quality-strategy`, environment readiness to `frontend-workflow`, thresholds and design rules to `frontend-design` and accepted design sources | Competing sources of truth drift |
| G2 | Fail loud: a missing input yields `blocked`/`not_run` with no fidelity claim | False conformance claim |
| G3 | Activation is not permission: no DB reset, server restart, code fix, specification edit, commit, or remote action follows from activation | Assumed authority |
| G4 | Pilot evidence binds to exact revision, fixture, and accepted-source hashes; raw screenshots stay in ignored `test-results/` | Unverifiable evidence |
| G5 | Eval claims bind to the exact model configuration and evidence set; no rerun-until-pass and no threshold change after observing results | Misleading semantic claim |
| G6 | CP3 runs only on the Codex CLI path with `gpt-6.1-sol / medium` for both reader and evaluator; no mixed-model substitute | Eval evidence on a configuration the Owner did not accept |

## Owner decisions

| ID | Decision | Status |
| --- | --- | --- |
| D1 | Eval configuration: reader and evaluator both `gpt-6.1-sol / medium` through the existing Codex CLI runner. The mixed 6.1-reader / 5.6-evaluator workaround is rejected. The runner's evaluator-config correction was separate work, merged in PR #112 | Decided by Owner 2026-10-01 |
| D1b | Exact model ID `gpt-6.1-sol` | Decided by Owner 2026-10-01; runtime acceptance is confirmed only by preflight |
| D2 | Pilot findings are reported only. UI-5 does not modify the Structure product surface as part of the review; any product correction becomes separate follow-up work | Decided by Owner 2026-10-01 |
| D3 | Live eval budget: about 12 cases → about 12 readers + 12 evaluators ≈ 24 calls, concurrency 2, `max_attempts` 2, automatic retry 0, 3-call canary first; exact grant after `prepare` with dispatch 0 | Proposed; pending exact grant. No live model call is authorized until the Owner approves it explicitly |

Plan acceptance also covers the agent-proposed Spec content: finding classes A/B/C, the domain-result status set, and the activation boundary.

## Prerequisites

| Prerequisite | Status |
| --- | --- |
| Configurable evaluator model/effort in the Codex CLI runner | **Resolved.** PR #112 (`fix/skill-eval-evaluator-config`, commits `f14e19b` plan + `6032a07` feat) merged into `main` as `91025bd` on 2026-10-01T09:30:54Z with all CI checks green. `--evaluator-model` / `--evaluator-effort` exist; non-default values need a v3 execution plan and are frozen into prepared units |
| `codex-cli 0.159.3` compatibility | Runner-level evidence only: a bounded `patch-check` smoke on an existing `git-checkpoint-workflow` reader (1 reader + 1 evaluator, both `gpt-6.1-sol / medium`) succeeded with valid structured output under `0.159.3`. UI-5 CP3 still records its own preflight; incompatibility stops CP3 without harness repair in UI-5 |

## Repository facts

| Source | Fact |
| --- | --- |
| [Master Plan](../../plan.md) lines 60, 90, 94–100 | Fixes `frontend-ui-review` ownership (procedure, evidence, findings, domain result) and exclusions (design rules, browser mechanics, final verdict); completion needs a real pilot |
| [Structure surface](../../surfaces/teacher/course-structure.md) §6–§8, §11 | About 17 recovery states, keyboard/focus/live-region rules, motion with reduced motion, 6-item runtime acceptance checklist |
| `scripts/e2e/structure-large-course-fixture.mjs`, `scripts/e2e/course-structure-fixture.mjs` | Deterministic local fixtures: 22 active + 1 deleted chapter, topics in `draft`/`pending`/`published`, `owner` + `previewer`, local-only URL guard |
| `frontend-design` Accessibility baseline | Measurable WCAG 2.2 AA thresholds; unchecked thresholds reported as not verified |
| `frontend-workflow/references/manual-ui-validation.md`, `test-quality-strategy`, `playwright-cli` | Own browser readiness, viewport matrix, fixture readiness, and driving mechanics; `playwright-cli` `0.1.21` installed |
| `code-review-and-quality` | Owns verdicts including `Implementation review passed; manual QA pending` and the severity taxonomy |
| `.agents/scripts/run-skill-eval-cli.mjs` | Supports `--reader-model`, `--reader-effort`, `--evaluator-model`, `--evaluator-effort` (since `91025bd`), and candidate-only `--no-baseline` |
| `validate-skill.mjs`, `run-skill-evals.mjs validate --all` | Check explicit `AGENTS.md` routes, routed resources, and suite structure; both report 0 diagnostics at `5a7fa96` |

### Routing overlaps

1. `fd-route-client-marketing`, `fd-route-admin-operations`, and `fw-route-design-review-only-near-miss` expect `frontend-design` only for design or visual review without a running target. Boundary: rendered review of a runnable target against accepted designs → `frontend-ui-review`; source or direction-only critique → `frontend-design`.
2. `test-quality-strategy` (Related skills) names `frontend-design` for "visual UI review"; a fresh reader may misattribute rendered review. Treated as a fresh-reader risk, not an up-front edit.
3. Functional browser QA (`fw-route-browser-fixture-validation`, `pwc-route-browser-verification`) stays with its current owners.

## Bounded implementation hypotheses

- Domain-result statuses: `conformant_within_observed_scope`, `mismatches_found`, `incomplete`, `blocked`.
- Core holds activation, authority, finding classes, the unobserved-state rule, and the output contract; a matrix template may become a reference.
- Exact wording and placement of the `code-review-and-quality` and `docs/agent-loops.md` lines.

Each may change while outcome, guardrails, ownership, and evidence boundaries hold.

## Dependency graph

```txt
CP1 skill + routes + suites (static checks)
  → CP2 Structure pilot (dogfood; may correct CP1 procedure)
  → CP3 Codex CLI eval  (prepare with dispatch 0; live dispatch only after explicit Owner approval)
  → closure review → progress/State update
```

## Checkpoints

No Stage: no subset forms an intermediate integrated outcome that gates downstream work. A closure review runs because the completion claim composes skill text, pilot evidence, and eval adjudication.

### CP1 — Skill, routes, suites

Author the bundle, `AGENTS.md` route, handoff lines, and the new suite JSON; apply author self-review.
Done when `node .agents/scripts/validate-skill.mjs` and `node .agents/scripts/run-skill-evals.mjs validate --all` report 0 diagnostics and `git diff --check` is clean.

### CP2 — Structure pilot

Preconditions: exact `main` SHA recorded; focused Structure Vitest green; local E2E stack ready; fixture-readiness outcome recorded.

Matrix:

- widths 1440/1024 fine pointer; 768/375/320 touch with reduced motion;
- roles `owner` and `previewer` (read-only);
- §6.2 states; states needing forced conditions (loading, load failure, stats failure, `TOPIC_ORDER_STALE`, failed drop) are observed through `playwright-cli` request mocking or an aborted action, or reported `not_run` with a reason;
- keyboard journey, focus return, single live region; measured contrast, target size, and 200% zoom.

Output: domain result plus `progress.md` summary. Known debt (Topic Builder back link, deleted-chapter builder redirect, smoke fixture collisions) is labeled known/outside the surface. A procedure gap exposed by the pilot returns to CP1 rules before CP3.

### CP3 — Automated model eval

1. Preflight `codex-cli` version/help and the runner's `--evaluator-model` / `--evaluator-effort` flags (present since `91025bd`).
2. `prepare --skill frontend-ui-review --isolation synthetic --candidate-current-tree --no-baseline` with reader and evaluator `gpt-6.1-sol / medium`, dispatch 0.
3. Freeze cases, criteria, and the D3 call ceiling.
4. Stop and report the prepared scope, case count, and expected call count; run only under an explicit Owner approval and the exact D3 grant; adjudicate; at most one bounded correction re-checked with `patch-check` on affected units.

Suite (about 12 cases, one group per invariant):

- **Routing (5):** explicit rendered review → `frontend-ui-review` plus routed owners; near-misses: direction-only critique → `frontend-design` only; functional browser QA → not UI review; source-only code review; small copy fix. The three nearest existing boundary scenarios are copied into this suite instead of editing or rerunning other suites.
- **Regression (4):** missing accepted design or fixture → `blocked`/`not_run`; subjective preference → class (C) only; request for merge verdict/approval → refused, domain result only; unobserved states listed explicitly.
- **Fresh-reader (3):** code-review handoff; class A vs B with mismatch-cause classification; activation is not permission.

### Closure

Cumulative review of skill, pilot evidence, and eval adjudication; update `progress.md` and State. Commit, push, and PR remain separate authorities.

## Risks, stop, recovery, and rollback

| Risk | Treatment |
| --- | --- |
| R1 Runner incompatible with `codex-cli 0.159.3` or `gpt-6.1-sol` rejected | Stop CP3 and report; no harness repair in UI-5 |
| R2 Some §6.2 states are expensive to force | Honest `not_run` entries are a valid result |
| R3 Rendered vs direction-only review ownership confusion | Covered by near-miss and fresh-reader cases; edit `test-quality-strategy` only if evidence shows confusion |
| R4 Checkpoint activation makes every UI change heavy | Activation condition plus small-fix near-miss case |
| R5 First agent run exposes a procedure gap | Correct under CP1 rules; mark CP2 evidence valid or invalid explicitly |

Stop when the accepted sources do not match `main`, the fixture fails, the pilot finds a product defect that needs a fix (report it; the fix is separate follow-up per D2), a `Critical`/`Required` eval finding remains after one bounded correction, or a change would alter Master Plan ownership.

Rollback: additive files and a few short lines; revert the commit. The pilot does not mutate product code; fixture data is local with an existing `cleanup` command.

## State — current resume projection

```txt
Current Spec revision: UI-5-PLAN-CANDIDATE-1, reconciled after PR #112 and PR #113; Owner directed implementation 2026-10-01
Current Checkpoint: CP3 complete; closure review next
Status: CP1 complete (checkpoint commit 1c6ea63); CP2 pilot complete with domain result mismatches_found; CP3 run complete; after two bounded corrections all 12 cases satisfied on the final skill text in one run, 0 safety veto
Completed evidence: CP1 validate-skill and validate --all report 0 diagnostics (12 frontend-ui-review cases); git diff --check clean. CP2 domain result in structure-pilot.md (5 A, 1 B, 2 C; unobserved cells listed) against target 8dd9e85; fixture reset afterwards. A1–A5 and B1 fixed by the D2 follow-up PR #113 (main f04c2f7, merged here as 50c38bf); the CP2 result stays historical evidence for 8dd9e85. CP3 preflight codex-cli 0.159.3 and runner evaluator flags present; re-prepared on checkpoint commit 1c6ea63 as run-3074390f876a491ea381b95877f1cfe3 revision 1, workspace ws-8e05e4e7c69d48eead91734a9a159fb8, candidate current tree, no baseline, 12 reader + 12 evaluator units, reader and evaluator gpt-6.1-sol / medium, concurrency 4, 24 calls without retry, ceiling 48 with max_attempts 2, dispatch 0. Live run 2026-10-01 under Owner approval (D3 exact grant = this prepared scope: 24 calls, ceiling 48, concurrency 4, no separate canary): 24/24 units succeeded, 0 retries; partially_satisfied: fur-reg-no-verdict-no-fix, fur-fresh-activation-not-permission, fur-fresh-class-a-vs-b. Bounded correction (Owner-approved 2026-10-01): SKILL.md stop-condition line naming the smallest input or permission to resume; regression fur-reg-no-verdict-no-fix scenario gains target, sources, fixture, and the 2.1:1 measurement; fresh-reader fur-fresh-class-a-vs-b scenario gains the section and the frontend-design 3:1 focus threshold. prepare --run revision 2 (workspace ws-14d80b584ac64250bb63bbcbe5652b40, dispatch 0, all 24 units invalidated by the shared bundle), then patch-check on the 3 direct readers (no additional impacted cases: the new line only extends the stop report that fur-reg-missing-source-blocked already satisfies): 6 calls, all succeeded; fur-fresh-activation-not-permission and fur-fresh-class-a-vs-b now satisfied; fur-reg-no-verdict-no-fix still partially_satisfied because it declines the CSS fix by citing the sandbox mutation policy instead of asking the Owner for explicit fix permission. Second correction (Owner-approved 2026-10-01, no full run): SKILL.md stop line now also says to ask the Owner for the specific permission when declining an out-of-permission action such as a CSS fix; prepare --run revision 3 (workspace ws-63085c9e74404a8c89396dbcf214eeab, dispatch 0); patch-check on reader-9ebf00fa… refused with CLI_ATTEMPT_BUDGET_EXHAUSTED (max_attempts 2 already used by revision 1 and revision 2), 0 calls dispatched. Owner chose a fresh probe run: run-409018d3a3054d89b58573bc485d788f revision 1 (workspace ws-c6b22d63edcf4d8486201d614ad6cb3a, current tree, dispatch 0 at prepare), then patch-check on reader-9ebf00fa… only: 2 calls, both succeeded; fur-reg-no-verdict-no-fix satisfied (status mismatches_found, 2.1:1 finding, verdict deferred to code-review-and-quality, explicit request for CSS-fix permission), no veto. The other 11 cases have no evidence on the final skill text (run-3074390f… revision 3 left pending; earlier results are references only). Live calls used in total: 24 + 6 + 2 = 32. Owner then approved a full run on the final text: run --run run-409018d3a3054d89b58573bc485d788f dispatched the remaining 22 units (11 readers + 11 evaluators), all succeeded; report: 12/12 cases current at revision 1, every criterion satisfied, 0 safety veto (the runner labels coverage patch_check_mixed_revision only because one case arrived through patch-check; all 12 share the same prepared revision). Live calls used in total: 24 + 6 + 2 + 22 = 54. Superseded prepared runs, never dispatched: run-4977e56644bf47808b387b97c5459f33 (base 91025bd), run-a3c67129705e4c36846b8eca1b8ee070 and run-fc60978398bd42668d92f8d57b4c6889 (uncommitted tree on base 50c38bf; the second was an accidental duplicate)
Accepted bounded deviations: none
Open blockers or Owner decisions: commit approval for the CP3 corrections; Owner live review and freeze of the 2026-10-01 Structure amendment (outside UI-5; Git-blob SHA-256 231f93a7…)
Next action: commit the CP3 corrections and records (Owner approval), then the closure review
Current authority: non-live implementation, static/deterministic checks, Structure pilot, CP3 prepare with dispatch 0; no live model call, push, PR, or merge
```
