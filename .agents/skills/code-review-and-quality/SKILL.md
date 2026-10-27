---
name: code-review-and-quality
description: Review plans, briefs, code, checkpoints, branches and PRs; perform author self-review and prepare independent Codex review briefs. Use for correctness, scope, verification and readiness review or before preparing/running/resuming Codex.
---

# Code review and quality

## Use when / do not use when

Use for author self-review, reviewing a plan/brief, checkpoint, correction, diff, branch or PR, deciding readiness, or preparing a Codex review. Do not use to author a plan, create a commit or replace domain procedures: planning, Git and the matching domain skills own those actions.

AGENTS.md owns permissions; docs/agent-loops.md owns review timing, the 3-pass cap, evidence block and waiting. Review is read-only unless corrections were authorized. A verdict grants no implementation, Git, model, remote or production action.

## Self-review

Read this method at the lifecycle's author boundary; small work does not load every formal-review reference.

1. **Anchor.** Return to the exact Owner request/accepted plan, scope, exclusions and authority. Open the actual current candidate, Git state and evidence, not memory, author intent/summary, planned steps or an earlier revision. Resolve cheap candidate/currentness questions first.
2. **Falsify.** Challenge plausible material failures: missing requirement, wrong owner, unsupported assumption, unhandled state, scope leakage, stale evidence and claims stronger than proof. Use deterministic tools when a machine can decide. Check the strongest plausible remaining rejection reason before concluding; no fixed hypothesis count, magic phrase, invented defect or extra artifact.
3. **Verify and reconcile.** After semantic stability, run applicable checks or reuse still-current passing evidence when candidate/inputs/environment hold; explain reuse. A failure cannot be overridden by narrative. Material readiness claims need concrete current evidence; absent/partial/blocked evidence stays visible.
4. **Proportion.** Use depth appropriate to risk and the claim. No extra role/session/report or repeated check just for ceremony. Self-review creates neither independence nor fresh-reader evidence and replaces neither required review nor manual QA.

Apply artifact/domain extensions without copying the method. Report the lifecycle's evidence block and remaining findings. Fixes stay within the current grant.

## Review workflow

1. Understand Owner intent, accepted behavior, scope/exclusions, acceptance, dependencies, known risks and required verification.
2. Establish the actual baseline/range, candidate revision and staged/unstaged/untracked state; never assume main is current. Read untracked plan files explicitly.
3. Read the relevant plan, matching skills, direct contracts/tests and nearby conventions. Judge approved behavior, not preference.
4. Trace the affected input through validation, permission, business rule, side effect, persistence, response, UI and docs; inspect what the tests actually protect.
5. Apply relevant dimensions and check evidence currentness, skipped checks and manual QA.
6. Audit required/supporting/unrelated/unclear changes. Report out-of-scope defects; fix only when granted.
7. Report supported findings, verification limits, verdict and the smallest next action. Do not rubber-stamp, invent defects or turn review into a redesign.

For one committed checkpoint use git show --stat HEAD and git diff HEAD^..HEAD; for a range use git log --oneline <base>..HEAD and git diff <base>..HEAD. For an uncommitted candidate also inspect its files and working-tree diff.

## Plan review

Check fidelity to Owner intent; current repository/ownership; assumptions and dependencies; scope/exclusions; implementability without a material decision being invented downstream; observable acceptance tied to evidence; permission, rollout/rollback and stop routes; and that every required behavior has an owner and reachable verification. A plan verdict does not approve an Owner-controlled choice or grant implementation.

## Findings and verdicts

Critical blocks: exploitable security, data loss/corruption, authorization bypass, broad RLS exposure, broken migration/destructive production behavior, core failure or exposed secrets.
Required blocks: wrong/missing promised behavior, important unhandled path, invalid permission/state, necessary verification gap, wrong owner, out-of-scope work or materially misleading docs.
Suggestion, Nit and FYI are non-blocking. Each blocker needs evidence, consequence and a feasible smallest correction; do not disguise blockers as suggestions.

Verdicts: Approved; Implementation review passed; manual QA pending; Changes required; Blocked; Rejected approach. Use Blocked for missing context/evidence/authority, not a fabricated defect. Approved requires complete relevant behavior, evidence, QA, scope and docs with no Critical/Required. A Codex brief may request PASS/CHANGES REQUIRED; PASS never erases required pending QA.

Verification statuses: Verified, Partially verified, Not verified, Blocked. Distinguish automated, manual, static, fixture-backed, historical and environment-limited evidence. Passing tests are evidence, not proof of completeness.

## Re-review and advice

Check each prior finding against the actual correction, new regressions and affected verification. An uncommitted candidate is fixed in place; a committed reviewed candidate normally gets a correction commit under Git authority. Broaden re-review only when material scope/behavior changed.

An authorized adviser receives a specific question, relevant bounded sources and real access limits. Its output stays advisory; Main verifies and owns the conclusion. Do not infer independence, isolation or model-quality improvement from a new session or a structural validator.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Domain dimensions](references/domain-review-dimensions.md) | Formal review inspects validation, DB/concurrency, frontend, tests, security, performance, comments or Git/change-set evidence. | Small author self-review, or only rendering supplied findings without source inspection. |
| [Special cases](references/special-review-cases.md) | Reviewing an explicitly identified bug fix, refactor, dead-code removal or dependency change. | Ordinary feature review or a correction only checking prior findings. |
| [Report format](references/review-report-templates.md) | Writing a formal report with several findings. | Compact verdict with no actionable findings. |
| [Codex brief](references/codex-brief.md) | Preparing, running or resuming an independent Codex review. | No Codex round. |
