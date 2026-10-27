# Agent lifecycle loops

This file owns when to plan, review, wait, checkpoint and stop. AGENTS.md owns shared principles and permissions; task skills own procedures. A more specific skill controls its domain but cannot widen Owner authority. Direct Owner instructions may narrow work or make it read-only.

## Universal lightweight preflight

Identify intent, authority and exclusions; read applicable instructions, direct repository evidence and matching skills completely; inspect Git when ownership/base/files matter. Read program plan/progress/problems and Owner decisions only when they affect this task. Do not read unrelated sources for ceremony.

Size after routing and again after discovery. Outcomes, risk, ownership, dependencies, verification and rollback decide size, not file count:
- Small: one clear bounded outcome, no material decision, obvious verification/rollback. Main implements directly with a micro-plan, checks and self-review.
- Medium: one bounded contract with stable ownership. Use a concise plan/brief, or the owning program's detail plan.
- Large/high-risk: several owners/dependencies, governance/permission/security/DB/auth/payment/concurrency/CI/deployment risk or material uncertainty. Use a durable plan and independent Codex review of plan and implementation.
Escalation changes process depth, never permission. Routine work needs no managed roles, ledger, review-artifact protocol or orchestration runtime.

## Planning

Read implementation-planning-and-pr-breakdown for non-trivial planning, unclear scope, dependency/PR split, handoff or plan correction. Repository facts come from discovery; ask only material decisions the Owner owns. Planning alone grants no implementation.

An approved plan/current instruction may authorize implementation when scope and acceptance are clear and prerequisites hold. Stop for a material contract conflict, missing decision, unclear writer ownership or ungranted action.

## Review and self-review

Every author self-reviews each plan presented to the Owner and each implementation checkpoint, including small work. Read the Self-review section of code-review-and-quality at that boundary, once while its complete unchanged text remains available. Reapply it to a corrected candidate; reread only when context or the contract changed. A micro-plan inside implementation is covered by that implementation's self-review.

A pass reviews the whole current candidate. End when a pass leaves no Critical or Required finding, at most 3 passes. After pass 3 with blocking findings, stop and ask the Owner: describe the findings and offer the recommended resolution first, continue fixing, or recording in the owning problems.md when it exists. Never claim PASS with unresolved blockers.

Review after each checkpoint; the final author review covers the whole diff and acceptance before external review or delivery. A one-checkpoint review is also the final review. Fix pre-commit findings before committing; a later correction has its own self-review.

Codex review is required for large/high-risk plans and their implementation, or when the Owner asks. Small/medium work keeps proportional self-review; small copy/layout/styling fixes during Owner QA need no Codex round unless requested. Read code-review-and-quality and its Codex brief reference before dispatch. Review does not authorize extra model calls: use the actual standing/current Owner grant and stop if it does not cover the action. A reviewer does not recursively dispatch another review because it loaded this lifecycle.

Optional advisers/Specialists require authority, a specific question and relevant bounded evidence. Advice does not approve a decision, grant an action or replace verification. No separate Specialist admission workflow or automatic call is required. Existing domain references to global specialist gates mean this short optional-advice rule; their risk signals never activate the retired workflow.

### Waiting for an independent review

Keep the turn active until the review result, an actual blocker or an Owner interruption. Independent already-authorized work is allowed only if it cannot change the reviewed candidate/dependencies/evidence or bias the reviewer. Do not invent work to avoid waiting.

With no such work, use native completion/event waiting. A wait-tool timeout is not reviewer completion: continue waiting. Do not repeatedly tail logs, inspect reviewer reasoning/tool activity or narrate unchanged status instead of waiting. Updates follow material progress, blockers and applicable communication requirements.

Inspect a log to diagnose a concrete failure, unexpected exit, lost completion signal or an Owner request; normal slowness alone is not a failure. Waiting never grants candidate edits, retries, replacement reviewers or parallel rounds. Reconcile the completed report against the repository and confirm the candidate stayed unchanged before reporting its verdict.

### Self-review evidence block

Every plan/implementation report includes one Tự review block:
- Object and requirement/accepted plan checked.
- Owning sources read, or reused unchanged.
- Material claims and their command or file:line evidence.
- Checks/results for the final bytes; explain why reused evidence remains valid.
- Findings/fixes per pass, ending with remaining Critical/Required counts.

Small work may use two lines with concrete evidence. This is a report section, not another artifact or a reason to reread/rerun unchanged work. Self-review is not independent/fresh-reader/runtime evidence.

## Checkpoint and delivery

Before completing implementation, use git-checkpoint-workflow: inspect staged/unstaged/untracked content, intended scope, encoding/EOL, conflicts, secrets/debug artifacts, evidence and pending QA. Report changed files and why, actual checks, skipped/failed checks, limitations, self-review and exact Git/remote state. Without a commit grant, propose an English Conventional Commit; with a grant, report the resulting hash/message.

Local commits, push, PR, merge, deployment, database mutation and branch deletion remain separate. A checkpoint is not automatic Git authority.

## PR review

Review is read-only unless fixes were authorized. code-review-and-quality owns findings and verdict. PASS/Approved means review readiness only, not GitHub approval, Owner approval, push, merge or deployment.

## PR and CI

Use github-pr-ci-workflow and the narrowest granted mode: inspect-only, watch-only, PR-create-only, PR-update-only, combined PR plus watching, or exact CI-fix actions. A missing initial remote head never grants push. Only the existing bounded branch-caused-small-safe exception may commit/push a focused CI correction; maximum 2 completed self-fix rounds, then ask.

When asked to wait for CI, keep the turn active with the foreground/native wait until terminal or blocked. Do not schedule polling or end the turn to wait for an app event. Report skipped, cancelled, failed and pending honestly; local checks are not CI evidence.
