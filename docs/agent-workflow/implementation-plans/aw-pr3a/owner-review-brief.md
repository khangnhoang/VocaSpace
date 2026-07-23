# AW-PR3A — Bản tóm tắt quyết định của owner

File này tóm tắt detailed contract trong [plan.md](./plan.md), original implementation decision và current correction decision ngày 2026-07-22. Nó không mở rộng master scope.

## Quyết định implementation ban đầu

1. Thực hiện end-to-end AW-PR3A theo discovery đã thống nhất.
2. Sync local `main` với live `origin/main`, rồi tạo `feat/agent-workflow-aw-pr3a` từ local main đã sync.
3. Lập và triển khai detailed plan trong cùng task; có thể chia CP0–CP3 trong progress để giữ scope.
4. Được sửa finding trong exact scope, chạy verification, stage và tạo một local commit.
5. Chấp nhận warning `CORE_LENGTH_SIGNAL` thứ tư cho `code-review-and-quality` và test-support snapshot tương ứng.
6. Không push, tạo/cập nhật PR, watch/fix CI, gọi specialist/sub-agent/fresh-reader executor hoặc merge.
7. Chỉ dừng khi có material conflict hoặc cần scope expansion.

## Correction applicable-review-depth đã được duyệt

1. Reusable lifecycle/review gate đổi từ authorship-specific `after main self-review` sang `after the main agent completes the applicable review depth`.
2. Final `small/low-risk` work bình thường kết thúc sau universal minimum review và skip specialist-decision evaluation.
3. Nếu review evidence invalidates sizing, reclassify trước, hoàn tất newly applicable formal/integration review, rồi mới evaluate specialist gates.
4. Explicit owner request chỉ kích hoạt consideration; không bypass review depth, material uncertainty, evidence gap, bounded context, quota benefit hoặc explicit specialist permission.
5. Agent-authored durable plan giữ narrower planning-owned `main-agent self-review comes first` rule.
6. Medium label riêng lẻ không tự tạo heavyweight formal-review ceremony; formal review chỉ chạy khi task, checkpoint, lifecycle hoặc discovered risk yêu cầu.
7. Exact correction scope gồm `docs/agent-loops.md`, `.agents/skills/code-review-and-quality/SKILL.md`, detailed `plan.md`, file này và `docs/agent-workflow/progress.md`.
8. Owner cấp edit, in-scope correction, verification, stage, một local Conventional Commit và normal push sau final audit; không cấp PR, CI watch/fix, merge, force-push, branch deletion, specialist/sub-agent/fresh-reader executor hoặc remote mutation khác.

## Contract implementation ban đầu

Behavior owners:

- `docs/agent-loops.md`
- `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`
- `.agents/skills/code-review-and-quality/SKILL.md`

Supporting owners:

- `.agents/scripts/validate-skill.test.mjs`
- `docs/agent-workflow/progress.md`
- `docs/agent-workflow/implementation-plans/README.md`
- `docs/agent-workflow/implementation-plans/aw-pr3a/plan.md`
- file này

Không sửa `AGENTS.md`, master plan, problems, domain skills, bundled references, validator implementation/threshold, eval/CI/product/runtime/DB/remote sources.

## Behavior được duyệt

- default `0 specialist`; task nhỏ không spawn;
- reusable gate chỉ chạy sau applicable main review depth; final small/low-risk là fast path bình thường skip evaluation;
- late hard risk/material uncertainty phải reclassify và hoàn tất deeper main review trước specialist gates;
- two-tier activation dùng domain hard-risk signal hoặc explicit owner request, đồng thời tách trigger khỏi specialist permission;
- explicit owner request không bypass remaining gates;
- external human/agent branch hoặc PR không bị gọi sai là `main self-review`;
- planning giữ narrower agent-authored durable-plan self-review rule;
- tối đa một specialist/risk cluster, reviewer thứ hai cần explicit owner permission;
- pre-spawn package có 1–3 questions, fixed context, reasons, exclusions, output, stop, read-only, one turn, no delegation;
- reviewer thiếu context trả `Blocked`, không broad-discover hoặc tự implement;
- main agent làm integration review, xác minh claims, không majority vote và giữ final verdict;
- repeat review chỉ khi residual hard risk cùng insufficient main evidence còn tồn tại;
- không claim fresh-reader/independent/isolation ngoài actual setup;
- exact domain signals tiếp tục thuộc AW-PR3B.

## Permission record

- Plan decision: `approved`, including current applicable-review-depth correction
- Historical implementation permission: `consumed` in commit `48258ee033da666b9df541fc7e7d64261f92cfb2`
- Current correction implementation: `granted for and consumed by exact five-file checkpoint`
- In-scope correction: `granted for and consumed by current checkpoint`
- Stage/local commit: `granted for and consumed by one coherent correction checkpoint`
- Normal push: `granted for and consumed by post-audit delivery of this checkpoint`
- PR/CI/merge/force/branch deletion: `not granted`
- Specialist/sub-agent/fresh-reader executor: `not granted`
- Production/DB/deployment/remote mutation: `not granted`

## Verification và evidence boundary

- Run skill validator và full structural-validator `node:test` suite.
- Run source-level orchestration scenarios, Markdown/encoding/link/diff/scope audits và main formal review.
- Fresh-reader: `not_run` under current instruction; self-review không thay thế independent evidence.
- Static contract checks không được gọi là runner-produced model behavior, isolated observation hoặc native trigger proof.

## Stop boundary

Dừng nếu cần file thứ sáu của correction, planning/master/domain signal edit, new reference, validator/snapshot/CI/eval behavior, specialist execution, non-normal push, PR/merge hoặc material contract change ngoài approved decision.

## Owner action state

Exact correction, local checkpoint và post-audit normal push đã dùng one-time permission của current instruction. Permission này không còn là standing authority; mọi retry hoặc action khác ngoài completed checkpoint cần owner instruction riêng.
