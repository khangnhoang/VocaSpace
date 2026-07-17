# Agent Lifecycle Loops

This document defines lifecycle routing for agent work in this repository. It sits on top of `AGENTS.md` and the domain skills in `.agents/skills/*/SKILL.md`.

It answers when to plan, checkpoint, review, inspect CI, fix CI, and stop. It does not replace domain-specific skills.

## Precedence and Safety

When this document conflicts with a domain skill, follow the more specific domain skill by default.

When permission is ambiguous, choose the safer and more restrictive rule and report the ambiguity.

Direct user instructions may narrow scope or require read-only/no-code behavior.

Remote, destructive, production-risk, database, auth, RLS, payment, security-boundary, deployment, and merge actions require explicit permission at the correct level.

Confidence labels, review verdicts, CI classifications, and checkpoint summaries are informational only. They never grant permission to stage, commit, push, create or update a PR, merge, deploy, modify a remote database, or perform destructive actions.

Use confidence labels by default: High, Medium, Low, Blocked, or Not assessed. Numeric scores are optional and informational only; do not use them instead of findings, verification status, risks, manual QA status, or verdicts.

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

## Loop 0: Planning / PR Breakdown

**Trigger:** explicit planning requests, unclear scope, non-trivial or multi-step implementation, cross-domain changes, large UI/workflow changes, DB/RLS/auth/permission/route-flow/payment/deployment/security-sensitive work, PR breakdown, dependency ordering, refactor planning, or unclear acceptance criteria.

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

**Verdict options:** Được duyệt (`Approved`), Review implementation đạt / còn manual QA (`Implementation review passed / manual QA pending`), Cần thay đổi (`Changes required`), Bị chặn (`Blocked`) hoặc Cách tiếp cận bị từ chối (`Rejected approach`). Mapping chỉ Việt hóa cách trình bày, không thay readiness meaning.

`Approved` is a code-review verdict only. It does not submit a GitHub review approval and does not authorize merge, push, or deployment.

**Stop rule:** do not edit code during PR Review Loop unless the user explicitly asks to fix findings. Do not stage, commit, push, merge, or approve on behalf of the human maintainer.

The human maintainer decides whether to merge, reject, request fixes, or authorize another implementation loop.

## Loop 3: CI Sweeper

**Trigger:** CI fails on a PR and the user asks the agent to inspect or handle it.

**Mode:** limited assisted fix. Default CI inspection is local fix + report only.

Remote correction commits are allowed only when the current task explicitly activates the PR/CI workflow with CI watching or CI fixing, and all `github-pr-ci-workflow` normal push conditions are satisfied.

**Skill owner:** `github-pr-ci-workflow`, plus relevant domain skills for any touched area.

**Before changing code:** run required git/GitHub preflight when applicable, read actual failed CI logs, classify the failure, decide whether it is branch-caused, and decide whether it is safe to fix inside this loop.

**Allowed fixes:** only small, branch-caused lint, typecheck, formatting, missing import, obvious build, or small test expectation fixes when approved behavior is clear.

**Forbidden without separate explicit approval:**

* auth or permission model changes;
* RLS policy changes;
* database migration design changes;
* RPC, trigger, storage, or policy redesign;
* payment, billing, or subscription logic;
* security boundary changes;
* broad business-rule rewrites;
* large refactors;
* flaky or unclear failures;
* infrastructure, environment, secret, deployment, or production configuration failures;
* remote database changes;
* test weakening to make CI pass;
* validation weakening to make typecheck pass.

DB-related CI failures are `db-risk` unless the approved task specifically authorizes DB work and the relevant domain workflow is followed.

Typecheck fixes that touch schemas, server actions, route handlers, DTOs, or validation boundaries must follow `nextjs-server-action-zod`. If behavior changes, stop for approval.

Test fixes must follow `test-quality-strategy`. Never weaken meaningful coverage or mask a real failure just to make CI green.

**Mức độ tin cậy trong báo cáo:** độ tin cậy của failure classification, mức chắc chắn failure do branch gây ra, độ an toàn của fix, độ tin cậy của kiểm tra/xác minh và remote action đã dùng.

**Remote action rules:** when remote correction commits are authorized, push only to the same PR branch, do not force-push unless explicitly approved, do not merge, do not create unrelated commits, do not include unrelated dirty working tree changes, use an English Conventional Commit message, and report exactly what was pushed.

**Attempt limit:** make at most 1-2 CI sweeper fix attempts.

**Stop rule:** stop and report instead of fixing when:

* the failure is unclear;
* the failure is not clearly branch-caused;
* the failure touches forbidden areas;
* the fix would change business behavior;
* the fix would weaken tests or validation;
* the fix requires permission not already granted;
* the attempt limit is reached.
