# Tiến độ chương trình quản trị agent skill của VocaSpace

## Chương trình

Lập durable plan và rollout theo từng giai đoạn cho repo-local agent-skill governance, progressive disclosure, deterministic structural validation, synthetic evaluation và evidence-gated pilot.

Master plan: [plan.md](./plan.md).

## Trạng thái hiện tại

**Draft planning documents đã được chuẩn bị; đang chờ owner review và phê duyệt rõ ràng.**

File này là current-status source của chương trình. Master plan sở hữu intended scope, dependency và proposed decision. Repository và Git evidence luôn authoritative hơn tracker này.

## Trạng thái phê duyệt

- Plan: chưa được owner duyệt.
- Implementation PR 1: chưa được cho phép.
- Commit checkpoint tài liệu hiện tại: owner đã cho phép nếu self-audit pass.
- Push branch tài liệu hiện tại: owner đã cho phép sau khi commit thành công.
- Pull request: chưa được cho phép.
- Merge hoặc deployment: chưa được cho phép.

## Nhánh hiện tại

```text
docs/agent-skill-governance-plan
```

Owner đã yêu cầu tạo local documentation branch này cho planning task. Permission đó không tự mở rộng sang later Git hoặc implementation action.

## Evidence về base và HEAD

| Evidence | Giá trị |
| --- | --- |
| Ngày discovery | 2026-07-14 |
| Working branch trước đó | `docs/b3-route-plan-reconciliation` tại `dc66539f7d61c4202e9819eabd84f7d129fb2fa5` |
| Dependency state đã xác nhận | Previous branch HEAD đã nằm trong `origin/main` qua merge PR #50 |
| Local `main` trước khi sync | `5709eb0f71a1160667005a5d3bb2e028c6074487` |
| `main` sau authorized fetch/pull | `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| `origin/main` sau authorized fetch | `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| Planning branch base và current HEAD | `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| Branch relationship | Independent docs branch từ synchronized `main`, không stack trên unmerged feature branch |

Snapshot này không ngụ ý remote state sau thời điểm đã ghi.

## Đã hoàn tất trên nhánh này

- Tạo local branch `docs/agent-skill-governance-plan` từ synchronized `main`.
- Tạo draft master plan tại [plan.md](./plan.md).
- Tạo progress tracker này.
- Phân biệt proposed plan authority với actual progress và Git permission.
- Ghi proposed foundation, PR sequence, owner decision bundle, eval sandbox boundary, risk, stop condition và completion criterion.
- Reuse convention hiện có về plan/progress link, explicit status vocabulary, evidence timestamp và actual-versus-proposed state.
- Cải thiện format bằng cách giữ một current-status source ngắn thay vì copy per-PR history vào cả plan và progress.
- Chuyển nội dung sang tiếng Việt dễ đọc, giữ technical term khi cần và không hard-wrap prose theo độ rộng cột.
- Làm rõ manual fresh-reader và manual verification trước PR 3 không phụ thuộc runner, đồng thời không được hồi tố thành formal runner evidence.
- Làm rõ `maintain-repo-skills` sở hữu permission invariant và lifecycle boundary của skill change, còn Git procedure thuộc `git-checkpoint-workflow` và `github-pr-ci-workflow`.

## Chưa bắt đầu

- Chưa có owner decision bundle nào được duyệt.
- Chưa tạo `maintain-repo-skills`.
- Chưa sửa hoặc migrate existing skill.
- Chưa implement structural validator.
- Chưa tạo eval schema.
- Chưa implement eval runner.
- Chưa execute synthetic hoặc mutation-capable evaluation.
- Chưa sửa CI workflow.
- Chưa sửa product code, test, database, migration, RLS, RPC, production hoặc deployment behavior.
- Chưa tạo pull request.

## Xác minh đã chạy

Documentation verification hoàn tất ngày 2026-07-14:

| Check | Kết quả |
| --- | --- |
| Strict UTF-8 decoding | Pass cho cả hai file |
| Final newline | Có trong cả hai file |
| Heading hierarchy và duplicate heading | Không có duplicate hoặc level jump |
| Fenced code block | Cân bằng trong cả hai file |
| Relative Markdown link | Tất cả local target tồn tại |
| Trailing whitespace | Không có |
| Hard-wrapped prose | Không phát hiện adjacent prose line bị wrap theo cột |
| `git diff --check` | Pass, không có output |
| Scope inspection | Chỉ có `docs/agent-skills/plan.md` và `docs/agent-skills/progress.md` là file mới |
| Branch | `docs/agent-skill-governance-plan` |
| HEAD | `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| Delivery permission | Owner đã cho phép commit và push checkpoint tài liệu này nếu self-audit pass |
| Pull request | Chưa được cho phép và chưa tạo |

Không cần application test, build, browser, Supabase hoặc model-based check cho Markdown-only task này.

## Self-audit checkpoint

Kết quả self-audit ngày 2026-07-14: **Pass cho documentation checkpoint; không còn finding mức Critical hoặc Required trong phạm vi ba suggestion vừa reconcile.**

| Hạng mục | Kết quả |
| --- | --- |
| PR 1 và fresh-reader trước PR 3 | Pass: manual check có bounded prompt, explicit context, recorded observation và status vocabulary; PR 3 không còn là prerequisite cho earlier comprehension check |
| Ownership của `maintain-repo-skills` và Git workflow | Pass: governance skill chỉ sở hữu permission invariant/lifecycle boundary của skill change; Git procedure route sang hai Git skill hiện có |
| Evidence trước và sau PR 3 | Pass: manual evidence và formal runner artifact được phân biệt; cấm retroactive upgrade claim |
| Approval semantics | Pass: plan và PR 1 vẫn chưa được duyệt; commit/push permission chỉ áp dụng cho checkpoint tài liệu hiện tại |
| Fresh-reader độc lập cho chính draft này | `not_run`: không có independent fresh-reader executor trong checkpoint này; self-audit không được trình bày như fresh-reader evidence |

Fresh-reader độc lập còn là một verification gap cần ghi rõ, nhưng không chặn việc checkpoint một draft plan khi owner đã cho phép commit/push và tài liệu không claim đã được owner duyệt hoặc formal-eval pass.

## Quyết định còn chờ owner

### Trước PR 1

- Duyệt, sửa hoặc reject governance skill name và ownership.
- Duyệt durable documentation và handoff semantics.
- Duyệt hoặc sửa Node/MJS và frontmatter v1.
- Duyệt hoặc sửa proposed PR sequence.

### Trước PR 3

- Duyệt eval schema và status vocabulary.
- Duyệt synthetic-only runner scope.
- Duyệt observation/comparison separation và evidence retention.
- Duyệt isolation/enforcement vocabulary.

### Trước pilot

- Duyệt pilot skill và protected invariant set.
- Duyệt khi nào cần blind A/B.
- Duyệt continue/revise/stop criteria.

Technical safety invariant trong draft không phải yêu cầu owner phê duyệt unsafe alternative.

## Hành động tiếp theo được phép

**Owner review và reconcile planning documents.**

Không bắt đầu PR 1 nếu chưa có owner instruction sau này vừa duyệt relevant decision vừa cho phép implementation.

## Git status

Checkpoint scope và permission sau documentation verification:

```text
Branch: docs/agent-skill-governance-plan
Owned scope: docs/agent-skills/plan.md và docs/agent-skills/progress.md
Commit: owner-authorized after self-audit passes
Push: owner-authorized after commit succeeds
Pull request: not authorized
```

Exact commit hash, staging state và remote branch state phải được kiểm tra từ Git và final checkpoint report; tracker này không tự ghi một claim về commit chứa chính nó.

## Quy tắc cập nhật

1. Chỉ cập nhật current-status summary và checkpoint bị ảnh hưởng.
2. Ghi exact command và actual verification outcome.
3. Phân biệt `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`.
4. Giữ intended scope và dependency trong master plan.
5. Label historical evidence và không trình bày như current state.
6. Không đánh dấu decision approved nếu không có explicit owner evidence.
7. Không tạo problem, deferred-work hoặc ADR file nếu chưa có concrete item cần ownership riêng.
8. Dùng date dạng `YYYY-MM-DD`.
9. Không dùng tracker này thay Git history hoặc pull request state.
