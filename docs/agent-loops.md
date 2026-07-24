# Agent Lifecycle Loops

This document defines lifecycle routing for agent work in this repository. It sits on top of `AGENTS.md` and the domain skills in `.agents/skills/*/SKILL.md`.

It answers when to plan, checkpoint, review, inspect CI, fix CI, and stop. It does not replace domain-specific skills.

## Precedence and Safety

When this document conflicts with a domain skill, follow the more specific domain skill by default.

When permission is ambiguous, choose the safer and more restrictive rule and report the ambiguity.

Direct user instructions may narrow scope or require read-only/no-code behavior.

Remote, destructive, production-risk, database, auth, RLS, payment, security-boundary, deployment, and merge actions require explicit permission at the correct level.

Confidence labels, review verdicts, CI classifications, and checkpoint summaries are informational only. They never grant permission to stage, commit, push, create or update a PR, merge, deploy, modify a remote database, or perform destructive actions.

Use the canonical confidence labels `High`, `Medium`, `Low`, `Blocked`, and `Not assessed`. In a Vietnamese owner-facing report, present them as Cao (`High`), Trung bình (`Medium`), Thấp (`Low`), Bị chặn (`Blocked`) and Chưa đánh giá (`Not assessed`). If a machine-readable consumer requires a canonical value, use the exact English value. Confidence labels are informational and are not finding severities or verdicts. Numeric scores are optional and informational only; do not use them instead of findings, verification status, risks, manual QA status, or verdicts.

## Skill Ownership

Use this document for lifecycle routing, confidence reporting, and stop rules. Use domain skills for actual procedures:

* Planning / PR breakdown: `implementation-planning-and-pr-breakdown`
* Repo-local skill governance: `maintain-repo-skills`
* Frontend/UI work: `frontend-workflow`, `frontend-design`
* Server Actions, schemas, DTOs, validation boundaries: `nextjs-server-action-zod`
* Supabase, DB, RLS, RPC, triggers, storage, migrations: `supabase-safe-migration`
* Tests and verification: `test-quality-strategy`
* Comments and maintainability: `code-commenting-and-maintainability`
* Review: `code-review-and-quality`
* Checkpoint and commits: `git-checkpoint-workflow`
* GitHub PR / CI: `github-pr-ci-workflow`

PR creation and update are owned by `github-pr-ci-workflow`. This document does not redefine that workflow.

## Universal Lightweight Preflight

Every task begins with this lightweight preflight before choosing discovery depth: identify the owner's current intent, action permissions and exclusions; apply the `AGENTS.md` instructions for the target path; inspect the target and direct repository evidence; activate every skill whose read condition matches; and inspect Git state when file, branch, dependency or ownership state matters.

* For tracked-program implementation, load the authoritative program source, current status/problem sources, exact per-PR implementation contract and recorded owner decision when those artifacts exist. Route detailed reading and reconciliation to `implementation-planning-and-pr-breakdown`; stop on material conflict or missing permission.
* Record preliminary size after routing and final size during discovery before implementation. Size by outcomes, ownership, dependency, permission/risk, verification and rollback signals rather than file count alone; escalation changes depth or stops work but never grants permission.
* Use a micro-flow for small clear work, a concise plan for bounded medium work, and an existing or new durable plan for large/high-risk work. Do not create a plan file or list irrelevant sources merely to complete a taxonomy.

### Review depth routing

Every actual change receives the universal minimum review in Loop 1. Formal main review applies only when the task, checkpoint, lifecycle or discovered risk requires it; a medium size label alone does not create a heavyweight review ceremony. Multi-boundary or high-risk work also requires main-agent integration review across the affected contract. The main agent remains responsible for verifying findings and issuing the final conclusion.

Final `small/low-risk` work normally ends after the universal minimum review without specialist-decision evaluation. If review evidence reveals a concrete hard risk or material uncertainty that invalidates that sizing, reclassify first, complete the newly applicable formal or integration review, and only then evaluate specialist gates.

Specialist review defaults to `0 specialist` and is never activated by task size, file count, domain-skill routing, formal-review depth, confidence, or an owner request alone. After the main agent completes the applicable review depth, consider a bounded specialist action only when an owning domain skill supplies a concrete hard-risk signal or the owner explicitly requests a specialist perspective, material uncertainty remains, existing evidence is insufficient, the uncertainty fits one threatened-invariant risk cluster, expected benefit justifies the initial package, and current explicit permission covers that action. An owner request activates consideration only; it does not bypass any remaining gate.

Group signals that threaten the same invariant or causal chain and can be resolved by one bounded answer into one cluster, even when several domains report them. Multiple specialists are possible only for genuinely independent unresolved material clusters whose evidence gaps, bounded questions, benefit, and permission coverage each pass separately; there is no task-wide specialist entitlement or hard cap. Every specialist handles one cluster. One owner instruction may cover a bounded count or class of actions, and another owner round-trip is required only when the next action exceeds the granted count, domain, access, package, or action boundary.

Quota controls package width, deduplication, low-value calls, and repetition. Token cost alone must not veto bounded evidence that could materially resolve an unresolved correctness or safety risk blocking a trustworthy main-agent verdict. Trigger satisfaction never grants specialist, implementation, Git, remote, database, production, or destructive permission. Route agent-authored durable-plan decisions to the narrower self-review rule in `implementation-planning-and-pr-breakdown` and reusable package/reviewer behavior to `code-review-and-quality`; record `not_run` when required permission or a valid executor/package is unavailable, and use `Blocked` when main evidence cannot establish trustworthy readiness.

## Loop 0: Planning / PR Breakdown

**Trigger:** after the universal preflight, continue into the detailed planning/PR-breakdown procedure for explicit planning requests, unclear scope, non-trivial or multi-step implementation, cross-domain changes, large UI/workflow changes, DB/RLS/auth/permission/route-flow/payment/deployment/security-sensitive work, PR breakdown, dependency ordering, refactor planning, or unclear acceptance criteria.

**Mode:** read, analyze, and propose. This loop must not create a new approval gate by itself; it only identifies whether existing user intent, repo state, and domain skills allow implementation to proceed.

**Skill owner:** `implementation-planning-and-pr-breakdown`

**Owner-facing output:** mục tiêu, phần trong phạm vi, phần ngoài phạm vi, sự thật đã xác nhận, giả định, xung đột/câu hỏi còn mở, thứ tự dependency, phase hoặc PR đề xuất khi hữu ích, acceptance criteria, kế hoạch kiểm tra/xác minh và rủi ro. Dùng ngôn ngữ owner yêu cầu; khi owner dùng tiếng Việt và không yêu cầu khác, tiêu đề cùng phần diễn giải phải là tiếng Việt tự nhiên, còn technical literal và exact evidence được giữ nguyên.

**Mức độ tin cậy trong báo cáo:** độ rõ của phạm vi, độ tin cậy của yêu cầu, mức rủi ro, implementation gate và lý do.

**Stop rule:** stop and ask/report instead of implementing when:

* the user requested planning-only or read-only work;
* guessing would affect business behavior;
* implementation would touch high-risk areas without explicit permission;
* a domain skill or repo state creates a hard stop;
* user request, repo conventions, and domain skills conflict.

If the user clearly requested implementation, scope is sufficiently clear, and no domain skill creates a hard stop, proceed with a concise plan and implement surgically.

## Loop 1: Implementation Checkpoint

**Trigger:** after completing an implementation task and before ending the turn.

**Mode:** self-check and report.

**Skill owner:** `git-checkpoint-workflow`, plus any domain skill touched by the implementation.

**Universal minimum review:** every actual change set must be checked for intended scope only, unrelated formatting, encoding/EOL hygiene, secrets/debug/conflict markers, accurate behavior/status claims, verification proportional to discovered risk, staged/unstaged/untracked content and permission/scope leakage. `git-checkpoint-workflow` owns the exact change-set and Git audit procedure.

**Owner-facing output:** file đã thay đổi và lý do, kiểm tra/xác minh thực tế đã chạy cùng kết quả, rủi ro/khoảng trống/giả định/manual QA còn lại, mức độ tin cậy, English Conventional Commit message đề xuất và trạng thái remote action. Dùng tiêu đề cùng phần diễn giải bằng tiếng Việt tự nhiên khi owner dùng tiếng Việt, trừ khi owner yêu cầu ngôn ngữ khác; giữ nguyên command, path, branch, commit message và exact technical evidence.

**Mức độ tin cậy trong báo cáo:** mức khớp phạm vi, độ tin cậy của kiểm tra/xác minh, mức rủi ro, nhu cầu manual QA và mức sẵn sàng để commit.

**Stop rule:** do not stage, commit, push, create PRs, merge, deploy, modify remote services, or perform destructive actions unless the user explicitly approves that action.

Checkpoint confidence does not authorize commit, push, PR creation, merge, or deployment.

## Loop 2: PR Review

**Trigger:** user asks to review a PR, branch, diff, commit range, checkpoint, or merge readiness.

**Mode:** read-only by default.

**Skill owner:** `code-review-and-quality`; use `github-pr-ci-workflow` when reading PR or CI state through GitHub tooling.

**Owner-facing output:** phạm vi review, context liên quan đã đọc, finding theo mức độ, mục blocking và non-blocking, đánh giá test cùng kết quả kiểm tra/xác minh, checklist manual QA khi cần, mức độ tin cậy và kết luận.

**Finding severities:** trình bày bằng nhãn Việt hóa có mapping không mơ hồ với taxonomy hiện tại: Nghiêm trọng (`Critical`), Bắt buộc (`Required`), Đề xuất (`Suggestion`), Tiểu tiết (`Nit`) và Thông tin (`FYI`). `Critical` và `Required` vẫn blocking; ba mức còn lại vẫn non-blocking.

**Mức độ tin cậy trong báo cáo:** mức khớp yêu cầu, rủi ro code, độ tin cậy của test, nhu cầu manual QA và độ tin cậy về merge readiness.

**Verdict options:** Được duyệt (`Approved`), Review implementation đạt; còn manual QA (`Implementation review passed; manual QA pending`), Cần thay đổi (`Changes required`), Bị chặn (`Blocked`) hoặc Cách tiếp cận bị từ chối (`Rejected approach`). Mapping chỉ Việt hóa cách trình bày, không thay readiness meaning.

`Approved` is a code-review verdict only. It does not submit a GitHub review approval and does not authorize merge, push, or deployment.

**Stop rule:** do not edit code during PR Review Loop unless the user explicitly asks to fix findings. Do not stage, commit, push, merge, or approve on behalf of the human maintainer.

The human maintainer decides whether to merge, reject, request fixes, or authorize another implementation loop.

## Loop 3: PR / CI Permission Routing

**Trigger:** after the universal preflight, use this loop when the owner asks to inspect PR/CI state, watch checks, create or update a PR, fix CI, or handle a failed check.

**Mode:** select the narrowest permission mode stated by the owner:

* `inspect-only`: read state or logs and report; do not edit, validate a fix, commit, push, or merge.
* `watch-only`: watch and report until a terminal or blocked state; do not edit, commit, push, or merge.
* `create PR only` / `update PR only`: perform only the requested PR action. Creation requires an existing remote head; neither mode grants local edits, commits, pushes, CI fixing, or acceptance of an interactive push/fork path.
* `create/update PR plus CI watching`: create or update the PR and watch checks, but do not initial-push. Only after a PR/check exists, failed logs have been read, and the failure is `branch-caused-small-safe` may the bounded self-fix exception owned by `github-pr-ci-workflow` apply.
* `explicit CI-fix only`: perform only the exact edit, validation, commit, push, or re-watch actions the owner states; do not infer the others.

**Skill owner:** `github-pr-ci-workflow` owns commands, exact failure classification, the bounded self-fix cycle, attempt definition, normal-push conditions, and reporting. `git-checkpoint-workflow` continues to own generic branch, staging, commit, and push safety.

**Stop rule:** stop before any ungranted action, initial push, interactive push/fork, unclear or non-small-safe fix, scope expansion, risky/domain-sensitive change, force-push, branch deletion, or merge. The default maximum is two completed self-fix attempts; a third completed attempt requires explicit owner permission. Merge remains a separate permission mode.
