# AW-PR3A — Bản tóm tắt quyết định của owner

File này tóm tắt detailed contract trong [plan.md](./plan.md) và ghi current owner instruction ngày 2026-07-22. Nó không mở rộng master scope hoặc cấp remote action.

## Quyết định đã được owner xác nhận

1. Thực hiện end-to-end AW-PR3A theo discovery đã thống nhất.
2. Sync local `main` với live `origin/main`, rồi tạo `feat/agent-workflow-aw-pr3a` từ local main đã sync.
3. Lập và triển khai detailed plan trong cùng task; có thể chia CP0–CP3 trong progress để giữ scope.
4. Được sửa finding trong exact scope, chạy verification, stage và tạo một local commit.
5. Chấp nhận warning `CORE_LENGTH_SIGNAL` thứ tư cho `code-review-and-quality` và test-support snapshot tương ứng.
6. Không push, tạo/cập nhật PR, watch/fix CI, gọi specialist/sub-agent/fresh-reader executor hoặc merge.
7. Chỉ dừng khi có material conflict hoặc cần scope expansion.

## Exact implementation contract

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
- two-tier activation dùng domain hard-risk signal hoặc explicit owner request, đồng thời tách trigger khỏi specialist permission;
- tối đa một specialist/risk cluster, reviewer thứ hai cần explicit owner permission;
- pre-spawn package có 1–3 questions, fixed context, reasons, exclusions, output, stop, read-only, one turn, no delegation;
- reviewer thiếu context trả `Blocked`, không broad-discover hoặc tự implement;
- main agent làm integration review, xác minh claims, không majority vote và giữ final verdict;
- repeat review chỉ khi residual hard risk cùng insufficient main evidence còn tồn tại;
- không claim fresh-reader/independent/isolation ngoài actual setup;
- exact domain signals tiếp tục thuộc AW-PR3B.

## Permission record

- Plan decision: `approved`
- Implementation permission: `granted for exact scope`
- In-scope correction: `granted`
- Branch creation/switch: `granted for feat/agent-workflow-aw-pr3a from synchronized local main`
- Stage/local commit: `granted for one coherent checkpoint`
- Push/PR/CI/merge/force/branch deletion: `not granted`
- Specialist/sub-agent/fresh-reader executor: `not granted`
- Production/DB/deployment/remote mutation: `not granted`

## Verification và evidence boundary

- Run skill validator và full structural-validator `node:test` suite.
- Run source-level orchestration scenarios, Markdown/encoding/link/diff/scope audits và main formal review.
- Fresh-reader: `not_run` under current instruction; self-review không thay thế independent evidence.
- Static contract checks không được gọi là runner-produced model behavior, isolated observation hoặc native trigger proof.

## Stop boundary

Dừng nếu cần file thứ chín, domain signal edit, new reference, validator/CI/eval behavior, specialist execution, remote action hoặc material contract change.

## Owner action state

Không cần approval turn khác để implement exact plan này: current instruction đã duyệt goal, material decisions, implementation và local checkpoint. Mọi action ngoài permission record vẫn cần owner instruction riêng.
