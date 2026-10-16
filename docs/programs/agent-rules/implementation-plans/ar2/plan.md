# AR2 detail plan — one review owner for author self-review and plan review

Revision: r4, 2026-10-16 (Codex plan review r2 PASS on r3; r4 adds its two suggestions to CP3: the full `prepare --run` flags and the report exit code. r3, Codex plan review r1: AC5 and G3 keep the whole contract of the deleted doc; CP3 names the harness scope, adjudication and rerun path; no comparison claim; milestone ref. r2, Owner answers: a managed author returns leftover findings to Main; CP3 uses the repository's Codex eval harness with new cases in the existing suite). Owner approval: pending. Master plan: none (single-unit program).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every agent (Claude, Codex, managed roles) reviews its own plan and its own implementation, at every task size and with or without a separate reviewer, using one owner: `code-review-and-quality`. That skill also gains plan review, which today exists only as managed Plan Reviewer dimensions. `docs/agent-self-review.md` is deleted.

| ID | Observable result |
| --- | --- |
| AC1 | `code-review-and-quality` keeps its name. Its description and activation cover reviewing a plan, and an author reviewing its own plan or implementation. |
| AC2 | The skill has a core Plan review section. Its dimensions come from the managed Plan Reviewer dimensions plus the planning extensions in `tracked-program-and-durable-plan.md`. It points to `implementation-planning-and-pr-breakdown` for what a plan must contain instead of restating it. `references/managed-lifecycle-review.md` keeps only the managed-specific parts and points to the core section for the shared ones. |
| AC3 | The skill has a Self-review mode: anchor to the Owner request, the plan and the actual candidate (`git diff` or the plan file); apply only the dimensions that fit; run the repository checks for the changed area; fix in-authority defects directly, with no commit; review again. One pass is one full review of the current candidate. The loop stops when a pass finds no Critical or Required finding. Small work uses the core dimensions only and needs no report template. |
| AC4 | After the third pass with Critical or Required findings left, the author does not stop silently. It asks the Owner with its structured question tool (in the reply when no such tool exists), describes each remaining finding, and offers: continue fixing; record it in the owning program's `problems.md` (only when that file exists); or the author's own recommended resolution, listed first. A managed role, which cannot ask the Owner, returns the remaining findings to Main, and Main asks. |
| AC5 | Every obligation of `docs/agent-self-review.md` at `03fdeec` has an owner after the change, in the Self-review mode unless an existing owner already holds it: (a) self-review does not create independence or fresh-reader evidence, does not replace a required Reviewer, Codex review, Specialist, fresh-reader round or manual QA, and grants no implementation, Git, remote, production, destructive or lifecycle authority; (b) read the method once per boundary, an unchanged complete read in current context counts, plan and implementation are separate boundaries, and a correction reapplies the affected part to the new state; (c) anchor to the current Owner request, accepted plan, scope and authority and the actual current candidate and evidence, never to memory, a summary or an earlier snapshot, and resolve uncertain candidate identity first; (d) bounded falsification: plausible material hypotheses proportional to the task, no fixed count, registry or ritual, deterministic evidence for machine-decidable questions; (e) before closing, check the most plausible remaining material reason an independent reviewer could reject the candidate, without inventing a defect; (f) a deterministic failure cannot be overridden by narrative judgment; reuse passing evidence only while its candidate, inputs, contract and environment are unchanged, and rerun only what a change invalidates; ground material claims in current evidence and keep failed, partial or unverified status visible; (g) proportionality: no extra role, session, artifact, report or ceremony only to show self-review happened. |
| AC6 | `docs/agent-loops.md` activates self-review for every plan and every implementation at any size and routes it to the Self-review mode. It still says not to load the review skill for this during the Universal Lightweight Preflight. The `AGENTS.md` route line for `code-review-and-quality` names plan review and self-review. |
| AC7 | `docs/agent-self-review.md` is deleted. No live reference remains in `AGENTS.md`, `docs/agent-loops.md`, `docs/README.md`, `.agents/**`, `.claude/**` or `.codex/**`. Historical program docs that mention it as text are left as they are. |
| AC8 | `native-multi-agent-workflow` (SKILL.md, `review-artifact-and-reconciliation.md`, `verification-scenarios.md`) and `native-multi-agent-workflow.test.mjs` point to the Self-review mode. Native handoff closure and admission rules do not change, and the test passes. |
| AC9 | The eval cases `ippb-fresh-shared-self-review-boundary` and `crq-reg-self-authored-shared-self-review` point to the new owner. `.agents/evals/code-review-and-quality/fresh-reader.json` gains the four CP3 cases. Routing eval expectations do not change. `run-skill-evals.mjs validate --all` passes. |
| AC10 | On the reviewed candidate, each case selected in §4 CP3 is adjudicated by Main as satisfying its frozen criteria with no safety veto. The claim covers only those cases; it makes no baseline comparison and no claim about unchanged cases, which keep only structural validation (`validate --all`). |

### 1.2 Scope and non-goals

- In scope:
  - `.agents/skills/code-review-and-quality/` (SKILL.md, `references/managed-lifecycle-review.md`).
  - `docs/agent-loops.md`, the `AGENTS.md` route line, `docs/README.md`, and deleting `docs/agent-self-review.md`.
  - References to the deleted doc in `implementation-planning-and-pr-breakdown` (SKILL.md, `references/tracked-program-and-durable-plan.md`) and `native-multi-agent-workflow` (SKILL.md and two references).
  - `.agents/scripts/native-multi-agent-workflow.test.mjs`.
  - The two eval files named in AC9 and the `code-review-and-quality` fresh-reader suite.
  - This program's docs.
- Non-goals:
  - Moving `specialist-plan-review.md` (a later PR, D3).
  - Changing what a plan must contain, which stays in the planning skill.
  - Changing the managed workflow's roles, handoff closure or admission.
  - Changing `.claude/rules.md`; the Codex review rule there is unchanged.
  - Editing historical program docs.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The review skill is loaded at the self-review boundary, not during the Universal Lightweight Preflight. | Task-start routing changes and every task loads a 370-line skill for nothing. |
| G2. One owner per rule: the review skill owns how to review; the planning skill owns plan content; `agent-loops.md` owns only activation. | Two owners for the same rule drift apart. |
| G3. Before the doc is deleted, each of its sentences is mapped to the line that now owns it (AC5 a–g or an existing owner); the mapping goes into the CP2 report. | An obligation of the deleted doc quietly disappears with the file. |
| G4. Skill edits follow `maintain-repo-skills`; fresh-reader cases run only after the implementation review passes. | Required skill evidence is missing or is spent on a stale candidate. |
| G5. Self-review fixes stay inside the author's current authority; they never commit, push or widen scope. | The new loop is read as permission for Git actions or scope growth (AGENTS.md rule 10). |

### 1.4 Owner decisions that bind this unit (2026-10-16)

- D1. Keep the skill name `code-review-and-quality`; change its description and activation.
- D2. Delete `docs/agent-self-review.md` entirely.
- D3. `specialist-plan-review.md` stays in the planning skill; moving it is a separate later PR.
- D4. Self-review loops at most 3 passes. With findings left, the author asks the Owner through its structured question tool (Claude and Codex both have one), describes each finding, and offers options such as continue fixing, record it in `problems.md` to fix later, or the running agent's own recommendation.
- D5. A managed author (`nma-*`) that still has findings after 3 passes returns them to Main in its handoff; Main asks the Owner.
- D6. CP3 adds its cases to the existing `code-review-and-quality` fresh-reader suite. The Owner runs them with the Codex eval harness on a machine that has the Codex CLI.
- D7. Plan flow for this unit: author self-review until it passes, then a plan-only commit and branch push, then the Owner pastes a Codex plan-review prompt into Codex on their machine.

## 2. Repository facts

Baseline: `03fdeec`, checked 2026-10-16.

- `code-review-and-quality` SKILL.md says `docs/agent-loops.md` owns self-review activation and routes the generic methodology to `docs/agent-self-review.md`, and that the skill does not restate it. Its activation covers code only. Its "Fix and re-review" mode creates a correction commit, so it does not fit an author fixing its own uncommitted work. This justifies AC1 and AC3.
- Plan review exists only in `references/managed-lifecycle-review.md` ("Plan Reviewer dimensions"), so it is reachable only inside the managed workflow. This justifies AC2.
- `docs/agent-loops.md` "Shared author self-review routing" reads the doc once per boundary and forbids loading it during preflight. This justifies G1.
- `docs/agent-self-review.md` holds the invariants listed in AC5 (its line 7 and the deterministic-failure rule). This justifies G3.
- Live links to the doc: `docs/agent-loops.md`; text references in `docs/README.md`, `code-review-and-quality` SKILL.md, the planning skill and its durable-plan reference, `native-multi-agent-workflow` SKILL.md and two references, the native test (which reads the file and asserts its wording), and two eval cases. `.claude/` and `.codex/` have none.
- No current rule caps the self-review loop or says what to do when findings remain. This justifies AC4.
- CI runs `validate-skill.mjs`, its tests, the skill-eval tests and `validate --all`, the native workflow test, and `npm run docs:check` (baseline: 0 structure violations, 1 broken link).

## 3. Bounded implementation hypotheses

- Self-review becomes a third entry under "Review modes", next to read-only review and fix and re-review.
- Plan review becomes a core section after the review dimensions; the managed reference keeps the managed-only checks and a pointer.
- The AC5 invariants sit at the top of the Self-review mode, as one short list.
- The AC4 question is written in a tool-neutral way ("your structured question tool") so it applies to both Claude and Codex.

Each may move within the same skill if the fresh reader finds it hard to locate.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | This plan and the progress State | `npm run docs:check`; `git diff --check`; author self-review of the plan; Codex plan review by the Owner on their machine (D7) |
| CP2 | AC1–AC9 | `node .agents/scripts/validate-skill.mjs`; `node --test .agents/scripts/validate-skill.test.mjs`; `node --test .agents/scripts/run-skill-evals.test.mjs`; `node .agents/scripts/run-skill-evals.mjs validate --all`; `node --test .agents/scripts/native-multi-agent-workflow.test.mjs`; `npm run docs:check`; `git diff --check`; `grep -rn "agent-self-review.md"` limited to the AC7 paths returns nothing; G3 sentence-to-owner mapping in the CP2 report; author self-review; Codex implementation review |
| CP3 | AC10, after the CP2 review passes. Selected cases: the four new `crq-fresh-*` cases ((1) small task with no reviewer — must the author self-review, and how far; (2) three passes leave a Required finding — what happens next; (3) plan review outside the managed workflow — which section applies; (4) a managed author has findings left — who asks the Owner), the changed `crq-reg-self-authored-shared-self-review`, and the changed `ippb-fresh-shared-self-review-boundary`. On the Owner's machine: `prepare --skill <skill> --isolation synthetic --candidate-ref <reviewed head> --no-baseline` once per skill (it prepares every case of all three suites with 0 dispatch: 28 for `code-review-and-quality`), then `patch-check --run <id> --unit <reader id>` for the selected cases only (Main supplies the reader unit ids from the run's execution plan), then `report --run <id>`. | The report is advisory evaluator output, not a verdict. Main adjudicates each selected graph per `maintain-repo-skills/references/evaluation-adjudication-and-correction.md`: raw response, supplied context, frozen criteria and safety veto, then cause attribution. Only a source shown to be defective (skill, suite, evaluator) is corrected; reader noncompliance alone changes no skill text. A `report` exit `1` or `incomplete` status caused only by unselected cases is expected; CP3 judges the selected cases only and does not run the whole suite to change the exit code. After a correction: `prepare --run <id> --skill <skill> --isolation synthetic --candidate-ref <new reviewed head> --no-baseline` publishes the next revision of the same run and `patch-check` reruns only the affected units; `--reuse-readers-from` is used only when starting a new run. CP3 closes when every selected case is adjudicated satisfied on the final candidate with no safety veto. A case that cannot run is `not_run` and keeps CP3 open. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| An invariant of the deleted doc is lost | G3 check and AC5; Codex implementation review compares against the file at `03fdeec` |
| Task-start routing changes | G1; routing eval expectations stay unchanged (AC9) |
| The core skill grows too long | Self-review and plan review point to existing dimensions instead of copying them; the managed reference loses its duplicated part |
| The 3-pass rule is read as a reason to stop early or to commit | AC3 stop condition and G5 |
| Codex CLI is not installed in this cloud container | Codex reviews and the CP3 harness run happen on the Owner's machine (D6, D7); until then they stay `not_run` and are reported |

- Rollout runbook: none (no hosted step).
- Stop when: a change would alter managed handoff closure or admission, or a rule conflicts with another skill and needs an Owner decision.
- Rollback: revert the PR; the deleted doc comes back with it.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
