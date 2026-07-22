---
name: code-review-and-quality
description: Repository-specific code review and quality-gate workflow for completed checkpoints, implementation prompts, branches, and pull requests. Use after implementation, before merge, when reviewing code written by a human or agent, validating a correction commit, or deciding readiness for manual QA, further revision, push, or merge.
---

# Code Review and Quality

## Activation scope

Use this skill when reviewing:

* a completed implementation prompt or local checkpoint
* a correction commit
* several checkpoints, a branch, or a pull request
* code written by a human or agent
* a bug fix, refactor, migration, RLS/RPC change, validation boundary, frontend change, test change, or documentation change
* whether implementation matches an approved plan
* whether manual QA can begin
* whether a change is ready for the next approved Git or merge action

Review is read-only by default. Do not modify code unless the user explicitly asks for fixes or the approved workflow already authorizes them.

## Ownership

This skill owns:

* understanding approved intent and scope
* choosing the review range
* coordinating domain-specific review skills
* evaluating correctness, boundaries, maintainability, and evidence
* classifying findings
* identifying scope creep and missing work
* issuing and updating a readiness verdict

It does not own planning, commit creation, push permission, domain implementation rules, test taxonomy, or comment policy.

## Related skills

Use:

* `implementation-planning-and-pr-breakdown` for goal, scope, dependencies, acceptance criteria, risks, and planned verification
* `git-checkpoint-workflow` for branch state, baseline, checkpoint ranges, commit boundaries, and remote-action limits
* `frontend-workflow` and `frontend-design` for frontend implementation and UI/UX
* `nextjs-server-action-zod` for validation, Server Actions, Route Handlers, payloads, and schema/type SSOT
* `supabase-safe-migration` for migrations, RLS, RPC, triggers, constraints, and concurrency
* `test-quality-strategy` for test layers, behavior coverage, test-plan headers, and verification
* `code-commenting-and-maintainability` for comments, JSDoc/TSDoc, TODO/FIXME, and structured file documentation

Read all relevant skills before issuing findings or a verdict.

## Core principles

* Review against approved behavior, not personal preference.
* Read the task, plan, and repository context before judging the diff.
* Review observable behavior and system guarantees, not only style.
* Verify claims through code, tests, types, migrations, and repository evidence.
* A passing test suite is evidence, not proof of completeness.
* Do not rubber-stamp, invent defects, soften blockers, or turn review into unrelated redesign.
* Separate required changes from suggestions.
* Follow repository conventions when multiple valid approaches exist.
* Surface conflicts instead of averaging them.
* Keep findings surgical, evidenced, and actionable.
* Approval never grants permission to push or merge.

## Approval standard

Approve only when:

* approved behavior and acceptance criteria are satisfied
* explicit exclusions were respected
* no Critical or Required finding remains
* relevant domain rules are satisfied
* verification is current and appropriate
* required manual QA is complete, or the verdict explicitly remains limited
* no known security, authorization, data-integrity, migration, or concurrency blocker remains
* the diff is coherent and free of unrelated scope expansion
* comments, tests, and progress documentation match the implementation

Do not approve merely because the code is cleaner. Do not reject merely because it differs from your preferred implementation.

## Review targets and ranges

### Prompt checkpoint or correction

Typical commands:

```bash
git show --stat --oneline HEAD
git diff HEAD^..HEAD
```

Review the prompt outcome, coherence, verification, and any correction regression.

### Multiple checkpoints or branch

Confirm the actual baseline, then inspect:

```bash
git log --oneline <baseline>..HEAD
git diff <baseline>..HEAD
```

Review both final cumulative behavior and checkpoint history when corrections matter.

### Pull request

Review goal, baseline, commit history, cumulative diff, dependency order, verification evidence, manual QA, and known limitations.

Do not assume `main` is current or the branch started from the latest remote commit.

## Review modes

### Read-only review

Default for review, audit, assessment, verification, or readiness requests.

* do not edit
* do not commit or push
* report findings, verdict, and smallest next action

### Fix and re-review

Use only when fixes are explicitly authorized.

1. Review and list findings.
2. Make surgical corrections.
3. Run relevant verification.
4. Audit the new diff.
5. Create a new local correction checkpoint through `git-checkpoint-workflow`.
6. Re-review the final state.

Do not amend the earlier checkpoint by default.

## Required review workflow

1. **Understand intent:** goal, actor, current/expected behavior, business rules, scope, exclusions, acceptance criteria, dependencies, verification, manual QA, and known risks.
2. **Confirm range:** branch, baseline, commits, staged/unstaged changes, untracked files, and prerequisites.
3. **Read instructions:** applicable `AGENTS.md`, domain skills, tests, docs, and similar repository patterns.
4. **Inspect tests early:** confirm they protect approved behavior and meaningful failure/boundary paths.
5. **Trace integration:** follow input or user action through validation, permission, business rule, side effect, persistence, response, UI feedback, tests, and docs.
6. **Apply relevant review dimensions.**
7. **Audit the change set:** scope, missing files, unrelated work, generated files, comments, dead code, and progress documentation.
8. **Verify evidence:** commands, results, later edits, skipped checks, environment limits, and manual QA.
9. **Classify findings with one severity taxonomy.**
10. **Issue a verdict and exact next action.**

If reliable approved scope is missing, state that the review is limited.

## Review dimensions

Apply only the dimensions relevant to the change.

### Scope and behavior

Check:

* approved goal and acceptance criteria
* explicit exclusions
* missing prerequisites
* silent business-rule changes
* incomplete state transitions
* happy, failure, empty, null, boundary, retry, duplicate, stale, rollback, and partial-failure paths
* consistency between client, server, and persisted state

A polished solution to the wrong problem is a failure.

### Readability and architecture

Check:

* names and control flow
* responsibility and module boundaries
* abstractions that earn their complexity
* duplicated business rules or state
* client/server and database/application responsibility
* schema/type SSOT
* shared versus feature-specific components
* compatibility code and speculative generalization
* adherence to nearby patterns

Do not demand abstraction because two blocks merely look similar.

### Validation and trust boundaries

Use `nextjs-server-action-zod`.

Check:

* server-side validation of untrusted input
* parsed data used instead of raw payload
* intentional `z.input`/`z.output`
* auth separate from validation
* privileged client fields ignored or replaced
* side effects after validation and permission
* safe result/error shapes
* correct schema/type placement
* intentional FormData, upload, and webhook handling

### Database and concurrency

Use `supabase-safe-migration`.

Check:

* migration safety for existing data
* constraints after valid backfill
* RLS boundaries and helper reuse
* justified `SECURITY DEFINER` and safe `search_path`
* permission-sensitive and idempotent RPC transitions
* short, necessary locks
* no external calls inside locks
* soft-delete behavior
* realistic indexes and integration coverage

### Frontend and UX

Use `frontend-workflow` and `frontend-design`.

Check:

* correct screen type and hierarchy
* primary, secondary, and destructive actions
* loading, empty, error, success, pending, and disabled states
* input preservation and double-submit prevention
* stale-response and optimistic rollback behavior
* permission-dependent rendering
* null, long-content, and mobile safety
* accessibility and dialog context
* shared-component safety
* real integration rather than fake success

### Tests

Use `test-quality-strategy`.

Check:

* correct test layer
* behavior-focused assertions
* regression, failure, permission, hostile-input, retry, and concurrency coverage
* deterministic fixtures
* guarantees not mocked away
* required test-plan header and accurate verification metadata
* no duplicated low-value tests

Do not require unavailable E2E infrastructure or expensive coverage when a lower layer proves the same guarantee.

### Security, performance, comments, and Git

Review security through the affected domain. A security finding must identify actor, entry point, missing boundary, impact, and mitigation.

Check realistic performance risks only: N+1 queries, unbounded work, missing pagination, duplicate requests, waterfalls, excessive rendering/subscriptions, large payloads, and lock duration. Do not demand speculative optimization.

Use `code-commenting-and-maintainability` for stale, redundant, missing, or unsupported comments and documentation.

Use `git-checkpoint-workflow` for coherent checkpoints, English Conventional Commits, correction history, branch/baseline correctness, unrelated files, secrets/artifacts, and remote-action boundaries.

## Change-set audit

Classify changed areas as:

```txt
required for approved scope
directly supporting approved scope
unrelated
unclear ownership
```

Unrelated changes should normally be removed. Unclear ownership must be investigated.

Do not use line or file count as a hard gate. Reviewability depends on independent behaviors, domains, semantic risk, migration/permission sensitivity, concurrency, verification complexity, and rollback needs.

Recommend splitting when outcomes, dependency chains, review models, verification, or rollback should be independent.

## Special review cases

### Bug fixes

Confirm root cause, direct correction, regression coverage, adjacent valid behavior, safe failure paths, and correct permission/data boundaries.

### Refactors

Confirm observable behavior and public contracts are preserved, tests protect behavior, error/performance characteristics remain acceptable, and new behavior was not mixed accidentally.

### Dead code

* created by the current change: remove when safety is established
* pre-existing and outside scope: report as follow-up
* unclear ownership: investigate before deletion

### Dependencies

Check necessity, existing alternatives, maintenance, security, license when relevant, bundle/runtime placement, lockfile changes, and installation permission.

## Review depth and specialist orchestration

### Review levels

Use the smallest level that can establish readiness:

| Level | Purpose | Route |
| --- | --- | --- |
| Minimum review | Audit every actual change for intended scope, artifacts, truthful claims and proportional verification | Lifecycle invariant; exact change-set/Git audit belongs to `git-checkpoint-workflow` |
| Formal main review | Apply this skill's full intent, range, domain, finding and verdict workflow | Checkpoint, branch or PR when the task or lifecycle requires it |
| Main integration review | Trace and reconcile a multi-boundary outcome rather than concatenate domain reports | Main agent; required when correctness depends on interactions across owners |
| Specialist review | Answer a bounded uncertainty for one hard-risk cluster | Optional and separately permissioned after main review remains insufficient |

For integration review, trace only affected boundaries, for example data/storage invariant → schema/type → validation/permission/business rule → action/handler/RPC → result contract → UI state → tests/fixtures/manual QA. The main agent verifies every reported issue and owns the final readiness verdict.

### Two-tier activation and permission

An owning domain signal first activates the relevant domain skill for the main agent. It does not automatically call a specialist.

After main self-review, one specialist may be considered only when all of these are true:

* an activated owning domain skill supplies a concrete hard-risk signal, or the owner explicitly requests a specialist perspective;
* the unresolved uncertainty could materially change correctness, safety or readiness;
* repository evidence, main review and current verification remain insufficient;
* the uncertainty fits one risk cluster and 1–3 exact questions;
* expected benefit justifies the initial context/quota cost;
* current permission explicitly allows the specialist action.

Task size, file count, domain activation, a formal-review route, or a confidence label is not a specialist trigger or permission. Before domain-owned signals exist, do not invent one from a subjective “complex task” label. An explicit owner request may activate review outside the default trigger, but the package remains bounded unless the owner also expands it.

If specialist evidence is necessary to establish safety but permission or a valid bounded package is unavailable, report the evidence as `not_run` and use `Blocked` when the main review cannot reach a trustworthy result. Escalation never grants edit, commit, push, PR, merge, production, database or remote permission.

### Quota and deduplication

* Default to `0 specialist`; small tasks do not spawn a reviewer.
* Default maximum is one specialist for one risk cluster per plan or implementation checkpoint.
* A second reviewer for the same plan/checkpoint requires explicit owner permission.
* Group overlapping concerns into one risk cluster; do not call one reviewer per skill, file or symptom.
* Evaluate quota on the initial package before the call. Narrowing questions after context was supplied does not recover that cost or prove compliance.
* Use the smallest available conversation/context inheritance that satisfies the fixed package; do not fork the full authoring context by default.
* Broad whole-plan/whole-branch review is not the default.
* Do not call a specialist again during implementation merely for continuity. Re-entry requires a residual hard risk plus insufficient main review/verification and a fresh valid permission/package gate.

### Bounded-context package

Record this package before calling a specialist:

```text
Risk cluster:
1–3 exact questions:
Fixed maximum context — files/documents/excerpts:
Reason each source is necessary:
Why main-only review is insufficient:
Expected benefit versus quota:
Approved scope and exclusions:
Required concise output:
Expansion rule: no expansion by default
Stop condition:
Authority: read-only, one turn, no delegation
Actual filesystem/tool/network/credential/mutation access:
```

Do not call a specialist when the expected benefit versus quota cannot be explained. Instruction-bounded context is not filesystem isolation; record actual access rather than implying enforcement the environment does not provide.

When `implementation-planning-and-pr-breakdown` routes a specialist plan review, that skill owns the plan-specific decision, risk cluster and feedback reconciliation; this section owns the reusable package and reviewer behavior.

### Reviewer behavior and output

The reviewer must:

* remain read-only and answer the supplied questions in one turn;
* use only the fixed package and not broad-discover, request an expanding follow-up, call another agent, implement, commit, push or open remote scope;
* return `Blocked` with the missing source and reason when supplied context is insufficient;
* prioritize Critical/Required issues and report non-blocking suggestions only when requested or clearly valuable;
* locate every finding, state evidence and impact, and provide the smallest valid correction;
* state unanswered questions, missing context and claim limitations;
* stop when the questions are answered or an owner/material decision is required.

Use the existing severity taxonomy and finding format for supported issues. A specialist report is advisory evidence: it does not issue the main agent's final verdict and never grants an action permission.

### Main reconciliation and claim labels

The main agent reproduces or verifies specialist evidence against current owner decisions, repository facts, source ownership, approved plans and applicable domain skills. Unsupported, stale or conflicting assertions stay out of the final finding set. Do not resolve disagreement by reviewer count or majority vote.

Use labels precisely:

* `main self-review`: the authoring agent reviews its own artifact;
* `specialist review`: a reviewer focuses on one domain/risk cluster;
* `bounded-context review`: the prompt fixes a package, without implying filesystem isolation;
* `fresh-reader`: only when expected answers, author conclusions, suspected defects and contaminating author context were withheld under the owning fresh-reader contract;
* `independent review`: only when independence was actually established and described, not merely because another turn or same-model instance was used.

Self-review or specialist review does not substitute for required fresh-reader evidence. Record actual context/access and use `not_run` instead of upgrading an unsupported evidence claim.

## Finding severity

Keep the exact severity taxonomy and semantics below. In a Vietnamese owner-facing report, present each label with the unambiguous mapping `Nghiêm trọng (Critical)`, `Bắt buộc (Required)`, `Đề xuất (Suggestion)`, `Tiểu tiết (Nit)`, or `Thông tin (FYI)`. If a machine-readable consumer requires the canonical value, use the exact English value.

### Nghiêm trọng (`Critical`)

Blocks approval. Use for exploitable security issues, data loss/corruption, authorization bypass, broad RLS exposure, broken migration paths, destructive production behavior, core workflow failure, irrecoverable consistency violations, or exposed secrets.

### Bắt buộc (`Required`)

Blocks approval. Use for missing/incorrect approved behavior, important unhandled paths, invalid permission or state transition, necessary regression/verification gaps, wrong contract ownership, scope that must be removed, or misleading documentation that affects correctness.

### Đề xuất (`Suggestion`)

Non-blocking maintainability, clarity, low-risk test, future refactor, documentation, or UX improvement.

### Tiểu tiết (`Nit`)

Minor non-blocking wording, formatting, or local consistency issue.

### Thông tin (`FYI`)

Information only; no change required.

Do not disguise blockers as suggestions or nits.

## Finding format

```txt
[Mức độ (canonical severity)] <tiêu đề ngắn>

Vị trí:
- <file và symbol hoặc line>

Vấn đề:
- <nội dung chưa đúng>

Tác động:
- <hệ quả quan sát được hoặc ảnh hưởng bảo trì>

Bằng chứng:
- <code, test, type, migration hoặc repository fact>

Thay đổi bắt buộc:
- <correction hợp lệ nhỏ nhất>
```

Với `Đề xuất (Suggestion)`, dùng `Cải thiện đề xuất` thay cho `Thay đổi bắt buộc`.

Mọi finding blocking (`Critical` hoặc `Required`) phải có bằng chứng và correction có thể thực hiện. `Suggestion`, `Nit` và `FYI` là non-blocking; cách Việt hóa nhãn không được làm thay đổi phân loại này.

## Verification status

Keep the exact verification-status taxonomy and semantics below. In a Vietnamese owner-facing report, use the mapped labels below. If a machine-readable consumer requires a canonical value, use the exact English value. Verification statuses are not finding severities or review verdicts.

* **Đã xác minh (`Verified`):** evidence directly covers affected behavior
* **Xác minh một phần (`Partially verified`):** relevant evidence exists but important behavior remains unchecked
* **Chưa xác minh (`Not verified`):** no meaningful or still-valid evidence exists
* **Bị chặn (`Blocked`):** environment, dependency, conflict, or missing decision prevents verification

Check what changed, which risks were tested, commands and results, skipped checks, manual QA, and whether later edits invalidated evidence.

Manual QA pending may allow:

```txt
Implementation review passed; manual QA pending.
```

It does not allow `Approved` when that QA is required.

## Re-review

After corrections:

1. Review the correction diff.
2. Confirm every Critical and Required finding is resolved.
3. Check for new regressions.
4. Rerun affected verification.
5. Confirm comments and docs were updated.
6. Confirm a new local correction checkpoint exists.
7. Update the verdict.

Do not rely only on the author’s claim that findings were fixed.

## Kết luận review

### Được duyệt (`Approved`)

All required behavior, evidence, manual QA, scope, and documentation are complete. No Critical or Required finding remains.

Approval does not authorize push or merge.

### Review implementation đạt; còn manual QA (`Implementation review passed; manual QA pending`)

No code-review blocker remains and automated verification is appropriate, but required manual QA is outstanding.

### Cần thay đổi (`Changes required`)

One or more blocking findings, incorrect scope/behavior, or insufficient verification remains.

### Bị chặn (`Blocked`)

Missing context, unclear baseline/ownership, repository conflict, environment limitation, or unresolved decision prevents a trustworthy review.

### Cách tiếp cận bị từ chối (`Rejected approach`)

The implementation strategy fundamentally violates approved architecture, safety, or business constraints and cannot be repaired incrementally.

## Báo cáo review

Use the language explicitly requested by the owner. When the owner communicates in Vietnamese and does not request otherwise, use natural Vietnamese headings and prose while preserving code identifiers, commands, paths, exact errors, machine-readable values, and canonical severity/verdict mappings.

```txt
## Phạm vi review
- Mục tiêu:
- Baseline và phạm vi diff:
- Skill liên quan:
- Bằng chứng kiểm tra đã rà soát:

## Tóm tắt
- Nội dung thay đổi:
- Đánh giá tổng thể:

## Phát hiện
### Nghiêm trọng (`Critical`)
### Bắt buộc (`Required`)
### Đề xuất (`Suggestion`)
### Tiểu tiết (`Nit`)
### Thông tin (`FYI`)

## Trạng thái kiểm tra
- Tự động:
- Manual QA:
- Chưa kiểm tra hoặc bị chặn:

## Rà soát phạm vi
- Dự kiến:
- Không liên quan:
- Còn thiếu:

## Thứ tự review đề xuất
1. ...

## Kết luận
- ...

## Hành động tiếp theo
- ...
```

Omit empty verbose sections for small reviews, but always state the verdict and next action.

## Final checklist

* [ ] Goal, scope, exclusions, and acceptance criteria are understood
* [ ] Baseline and review range are correct
* [ ] Relevant skills, tests, and docs were read
* [ ] Implementation was traced through affected layers
* [ ] Scope creep, missing files, and dead code were checked
* [ ] Relevant validation, permission, database, frontend, test, security, and performance risks were reviewed
* [ ] Comments, progress docs, and Git checkpoints match behavior
* [ ] Verification evidence is current
* [ ] Manual QA status is explicit
* [ ] Findings use the defined severity taxonomy
* [ ] Verdict matches remaining risk
* [ ] Next action is clear
* [ ] No remote action is implied
