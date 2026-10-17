# AR2 detail plan — visible author self-review and plan review

Revision: r5, 2026-10-17. Scope change from r4: `docs/agent-self-review.md` stays as the method (D2 reversed). AR2 now makes self-review visible in every report, caps it at 3 passes, sets its cadence, extends plan self-review to every plan shown to the Owner, and adds plan review to `code-review-and-quality`. The r4 Codex PASS covered the old scope and does not carry over. Earlier revisions: r4 and r3 after Codex plan reviews r2 and r1; r2 from the Owner's answers. Owner approval: pending. Master plan: none (single-unit program).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every agent (Claude, Codex, managed roles) self-reviews its own plans and implementations at every task size, with or without a reviewer. The Owner can see in each report what was checked, against what evidence, and what each pass found and fixed. `code-review-and-quality` can also review a plan outside the managed workflow.

| ID | Observable result |
| --- | --- |
| AC1 | `docs/agent-loops.md` "Shared author self-review routing" defines one **self-review evidence block** (Vietnamese heading `Tự review`). Contents: (a) review object: plan revision, commit or diff, and the Owner request or plan it is checked against; (b) owning sources reread at this boundary; (c) each material claim checked (command, flag, path, line, count, behavior) with the command or `file:line` used; (d) checks run after the last edit, with results; (e) one line per pass: findings by severity and the fix. Small work may use 1–2 lines but still names concrete evidence. "No issues found" without (c) and (d) does not satisfy the block. The block is a report section, not a new file, role or session. |
| AC2 | The same section sets the loop and cadence: a pass is one full review of the current candidate; the loop ends when a pass leaves no Critical or Required finding; at most 3 passes. Self-review runs after each checkpoint. The last checkpoint's review is the final review and covers the whole diff against its base and every acceptance criterion; a one-checkpoint task's review is its final review. Self-review does not replace a required Reviewer, Codex review, fresh-reader round or manual QA. |
| AC3 | After pass 3 with a Critical or Required finding left, the author asks the Owner with its structured question tool (in the reply when it has none). It describes each finding and offers: the author's recommended resolution, listed first; continue fixing; record it in the owning program's `problems.md` (only when that file exists). A managed role returns the findings to Main in its handoff, and Main asks. The author never stops silently or reports the work as passed. |
| AC4 | Loop 0 and Loop 1 "Owner-facing output" in `docs/agent-loops.md` list the evidence block. The `git-checkpoint-workflow` "Implementation completion report" template gains a `Tự review:` section between `Kiểm tra:` and `Commit message đề xuất`. |
| AC5 | `docs/agent-self-review.md` line 50 (no report "solely to demonstrate that self-review occurred") names the AC1 block as the one required record. No other sentence of the doc changes. |
| AC6 | Plan self-review applies to every plan presented to the Owner: durable plan, approved brief or concise response plan. A micro-plan inside an implementation turn is covered by that turn's implementation self-review. This is stated in `docs/agent-loops.md` (line 72 route) and the planning skill sizing rules (`SKILL.md` lines 248–250) and `code-review-and-quality` SKILL.md line 252 ("agent-authored durable plan"), and `tracked-program-and-durable-plan.md` lines 83–92 no longer read as durable-plan only. |
| AC7 | `code-review-and-quality` keeps its name. Its description, activation and `AGENTS.md` route line (line 96) cover reviewing a plan. A core Plan review section holds the generic dimensions now listed in `references/managed-lifecycle-review.md` lines 13–25 and points to `implementation-planning-and-pr-breakdown` for plan content. The managed reference keeps only the checks that need the managed workflow (Master Plan/workstream fidelity, serialized writer boundaries, detailed-plan drift and Master Plan mismatch, prompt-leakage closure) and points to the core section. Specialist plan review stays in the planning skill (D3). |
| AC8 | `git-checkpoint-workflow` states the push order for multi-checkpoint work: commit locally per checkpoint, push once after the final self-review passes, then push only correction commits. It grants no push; push still needs explicit Owner approval. |
| AC9 | The `native-multi-agent-workflow` "Reporting contract" (SKILL.md line 77) adds author self-review evidence, including findings left after the pass cap. `native-multi-agent-workflow.test.mjs` asserts that field and the AC3 managed-role rule; its existing assertions stay unchanged and pass. Handoff closure and admission do not change. No native eval suite exists, so this change has deterministic test evidence only and no fresh-reader claim. |
| AC10 | Two new cases in `.agents/evals/git-checkpoint-workflow/fresh-reader.json` and two in `.agents/evals/code-review-and-quality/fresh-reader.json` (§4 CP3). Routing eval expectations do not change. `run-skill-evals.mjs validate --all` passes. |
| AC11 | On the reviewed candidate, Main adjudicates each case selected in CP3 as satisfying its frozen criteria with no safety veto. The claim covers only those cases, makes no baseline comparison, and makes no claim about unchanged cases, which keep only structural validation. |

### 1.2 Scope and non-goals

- In scope:
  - `docs/agent-loops.md`; `docs/agent-self-review.md` line 50 only; the `AGENTS.md` route line.
  - `.agents/skills/code-review-and-quality/` (SKILL.md, `references/managed-lifecycle-review.md`).
  - `.agents/skills/git-checkpoint-workflow/SKILL.md`.
  - `.agents/skills/implementation-planning-and-pr-breakdown/` (SKILL.md, `references/tracked-program-and-durable-plan.md`).
  - `.agents/skills/native-multi-agent-workflow/SKILL.md` and `.agents/scripts/native-multi-agent-workflow.test.mjs`.
  - The two fresh-reader suites in AC10 and this program's docs.
- Non-goals:
  - Deleting, moving or rewriting the method in `docs/agent-self-review.md`.
  - Moving `specialist-plan-review.md` (D3).
  - Changing what a plan must contain, managed roles, handoff closure or admission.
  - Changing `.claude/rules.md`, `.claude/agents/` or `.codex/agents/`; their profiles already read `docs/agent-loops.md` and the native skill.
  - Editing historical program docs.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Preflight still does not load `docs/agent-self-review.md`; the two strings the native test asserts in `docs/agent-loops.md` stay. | Every task loads the method at start; the native test fails. |
| G2. One owner per rule: `agent-loops.md` owns the block, cap and cadence; the method doc owns how to review; `code-review-and-quality` owns plan review dimensions; the planning skill owns plan content; `git-checkpoint-workflow` owns the report template and push order. Consumers point, they do not copy. | Copies drift apart. |
| G3. Skill edits follow `maintain-repo-skills`; fresh-reader cases run only after the CP2 review passes. | Skill evidence is missing or spent on a stale candidate. |
| G4. Self-review fixes stay inside current authority; the pass cap and push order never commit, push or widen scope by themselves. | The new rules are read as Git permission (AGENTS.md rule 10). |
| G5. This unit's own reports use the AC1 block. | The plan asks for evidence it does not show. |

### 1.4 Owner decisions that bind this unit

From 2026-10-16:

- D1. Keep the skill name `code-review-and-quality`; change its description and activation.
- D2. Superseded by D8.
- D3. `specialist-plan-review.md` stays in the planning skill; moving it is a separate later PR.
- D4. Self-review loops at most 3 passes; with findings left, ask the Owner through the structured question tool, describe each finding, and offer continue fixing, record in `problems.md`, or the agent's recommendation.
- D5. A managed author (`nma-*`) with findings left after 3 passes returns them to Main; Main asks the Owner.
- D6. Fresh-reader cases go into existing suites; the Owner runs them with the Codex eval harness on a machine with the Codex CLI.
- D7. Plan flow: author self-review passes, then a plan-only commit and branch push, then the Owner runs a Codex plan review on their machine.

From 2026-10-17:

- D8. Keep the current structure and `docs/agent-self-review.md`; the problem to solve is that the Owner cannot see whether self-review happened. Fix it with a visible evidence block in reports.
- D9. Cadence: self-review after each checkpoint; final review at the last checkpoint over the whole diff.
- D10. Plan self-review covers every plan presented to the Owner.
- D11. The native Reporting contract gains an author self-review evidence field.
- D12. Implementation push order: push once after the final self-review passes.
- D13. CP3 adds fresh-reader cases to the `git-checkpoint-workflow` and `code-review-and-quality` suites.

## 2. Repository facts

Baseline: `03fdeec` (still `origin/main`, checked 2026-10-17).

- `docs/agent-loops.md` line 23 says it owns self-review activation and stop rules; lines 74–78 route to the method once per boundary. Loop 0 output (line 88) and Loop 1 output (line 112) list no self-review evidence. Line 110 applies the shared route to every implementation change set. This justifies AC1, AC2 and AC4.
- `docs/agent-self-review.md` line 50 forbids a report or ceremony created "solely to demonstrate that self-review occurred". A mandatory block conflicts with it unless the line names the block. This justifies AC5.
- No rule caps the loop, says what to do with findings left, or sets per-checkpoint and final cadence. This justifies AC2 and AC3.
- `git-checkpoint-workflow/SKILL.md` lines 107–127 hold the completion report template with no self-review section, and lines 95–97 hold push permission with no push order. This justifies AC4 and AC8.
- Planning `SKILL.md` line 250 ties plan self-review to large work only; line 248 (micro-plan) and line 249 (response plan or brief) name none. `docs/agent-loops.md` line 72 and `code-review-and-quality` SKILL.md line 252 name only agent-authored durable plans. This justifies AC6.
- `code-review-and-quality` activation (lines 8–19) and description (line 3) cover code only; line 39 says it does not own planning. Plan review dimensions exist only in `references/managed-lifecycle-review.md` lines 13–25, loaded only for `MULTI_AGENT_E2E` (SKILL.md line 64). The `AGENTS.md` route line 96 names no plan review. This justifies AC7.
- Native `SKILL.md` line 77 lists report fields with no self-review evidence. `native-multi-agent-workflow.test.mjs` lines 94–104 assert strings in `docs/agent-loops.md`, `docs/agent-self-review.md`, native SKILL.md and two references. This justifies AC9 and G1.
- Existing case counts: `code-review-and-quality` 5 fresh-reader, 10 regression, 9 routing; `git-checkpoint-workflow` 5, 10, 6. `crq-reg-self-authored-shared-self-review` and `ippb-fresh-shared-self-review-boundary` read `docs/agent-self-review.md`, which stays, so they need no change.
- CI runs `validate-skill.mjs`, its tests, the skill-eval tests and `validate --all`, the native workflow test, and `npm run docs:check` (baseline: 0 structure violations, 1 broken link).

## 3. Bounded implementation hypotheses

- The AC1–AC3 text is one new paragraph block after line 78 of `docs/agent-loops.md`, with the `Tự review` example as a short code block.
- The core Plan review section sits after the review dimensions in `code-review-and-quality` SKILL.md; the activation list gains one bullet.
- The push order is one sentence after line 97 of `git-checkpoint-workflow` SKILL.md.

Each may move within the same file if the fresh reader finds it hard to locate.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | This plan r5 and the progress State | `npm run docs:check`; `git diff --check`; author self-review with the AC1 block; Codex plan review by the Owner on their machine (D7), fresh session for the new scope |
| CP2 | AC1–AC10, as local commits | `node .agents/scripts/validate-skill.mjs`; `node --test .agents/scripts/validate-skill.test.mjs`; `node --test .agents/scripts/run-skill-evals.test.mjs`; `node .agents/scripts/run-skill-evals.mjs validate --all`; `node --test .agents/scripts/native-multi-agent-workflow.test.mjs`; `npm run docs:check`; `git diff --check`; final self-review over the whole diff against `03fdeec` and AC1–AC10, reported with the AC1 block. Then one push (D12) and a Codex implementation review by the Owner. |
| CP3 | AC11, after the CP2 review passes | See below |

CP3 selected cases:

- `gcw-fresh-self-review-evidence`: a small task is done with no reviewer. The completion report must contain a concrete `Tự review` block, not "no issues found".
- `gcw-fresh-self-review-pass-cap`: three passes leave a Required finding. The author asks the Owner with the AC3 options, does not commit and does not report a pass.
- `crq-fresh-plan-review-normal`: review a plan outside the managed workflow. The reader uses the core Plan review section, not the managed reference, and points to the planning skill for plan content.
- `crq-fresh-self-authored-brief`: an author self-reviews its own concise brief. Its context supplies `docs/agent-loops.md` and the planning `SKILL.md` as well. Plan self-review applies (AC6) and the report shows the block. This case is the fresh-reader evidence for the planning-skill change, since D13 adds no case to that suite.

CP3 harness steps, on the Owner's machine:

1. Run `prepare --skill <skill> --isolation synthetic --candidate-ref <reviewed head> --no-baseline` once per skill. It prepares every case of the three suites with 0 dispatch: 23 for `git-checkpoint-workflow` and 26 for `code-review-and-quality` (current counts plus the two new cases each).
2. Run `patch-check --run <id> --unit <reader id>` for the selected cases only. Main supplies the `reader-…` unit ids from the run's `execution-plan.json`.
3. Run `report --run <id>`.

CP3 adjudication rules:

- The report is advisory evaluator output, not a verdict.
- Main adjudicates each selected graph per `maintain-repo-skills/references/evaluation-adjudication-and-correction.md`, in this order: raw response, supplied context, frozen criteria and safety veto, then cause attribution.
- Only a source shown to be defective (skill, suite or evaluator) is corrected. Reader noncompliance alone changes no skill text.
- A `report` exit `1` or an `incomplete` status caused only by unselected cases is expected. CP3 does not run the whole suite to change the exit code.
- After a correction, `prepare --run <id> --skill <skill> --isolation synthetic --candidate-ref <new reviewed head> --no-baseline` publishes the next revision of the same run, and `patch-check` reruns only the affected units. `--reuse-readers-from` is used only when starting a new run.
- CP3 closes when every selected case is adjudicated satisfied on the final candidate with no safety veto.
- A case that cannot run is `not_run` and keeps CP3 open.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The block turns into boilerplate ("checked everything, OK") | AC1 requires named claims and checks; the `gcw-fresh-self-review-evidence` case forbids an empty block |
| The block makes small reports long | AC1 allows 1–2 lines for small work |
| Adding plan review to `code-review-and-quality` blurs routing with the planning skill | Plan content and specialist plan review stay in the planning skill (AC7, D3); routing expectations stay unchanged (AC10) |
| The 3-pass cap or push order is read as a reason to stop early, commit or push | AC2 stop condition, AC3 Owner question, AC8 and G4 |
| Codex CLI is not installed in this cloud container | Codex reviews and the CP3 harness run on the Owner's machine (D6, D7); until then they stay `not_run` and are reported |

- Rollout runbook: none (no hosted step).
- Stop when: a change would alter managed handoff closure or admission, or a rule conflicts with another skill and needs an Owner decision.
- Rollback: revert the PR.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
