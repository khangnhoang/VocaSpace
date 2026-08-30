# Agent Skill Eval Harness CLI-first — owner review brief

## Quyết định hiện tại

- Workstream: `eval-harness-cli-first`.
- Stage 0: PR #77 merged tại `e195569479ee49dd9592a93573c49ecad85cd9e6`.
- Current branch: `feat/agent-skill-eval-cli-runner` từ exact merged Stage 0 base; cleanup CI riêng tại `0d30904`.
- Plan status: master plan và [Stage 1 implementation plan](./stage-1-cli-runner.md) `reviewed / implementation_pending`; terminal self-review `0 Critical / 0 Required`.
- Runner implementation: `not_started`; pre-implementation CI cleanup remains separate.
- Current authority: lập/review/commit/normal-push Stage 1 plan only. Không live model/evaluator call, implementation, PR, CI-fix hoặc merge.

## Kiến trúc đã chốt cho master plan

Chốt CLI-only program. Harness phải chạy thật bằng fresh/ephemeral `codex exec` và đạt mục tiêu ban đầu trước:

1. prepare đủ toàn bộ selected static inputs và reader packages trước reader call đầu tiên; finalize/validate evaluator input trước evaluator call tương ứng;
2. lưu success theo unit;
3. failure local không giết run;
4. resume/retry chỉ unit lỗi và downstream dependencies;
5. bounded concurrency thuộc Stage 1 ngay từ đầu; default `4` nhưng luôn chịu explicit operator cap;
6. App Server và native Codex subagent không được build nhưng cũng không bị cấm về sau.

Không tái tạo hardening/attestation mà CLI không hỗ trợ: provider-envelope proof, exact call certainty, credential/network/tool-isolation proof, signed evidence, cleanup authority, shadow-thread lifecycle hoặc multi-host store.

## Phản biện quan trọng

Không thể vừa đưa full `SKILL.md` vào mọi reader, vừa tự động khẳng định một thay đổi trong file đó chỉ ảnh hưởng một reader. Plan tách:

- **exact reuse**: chỉ reuse khi exact model input/dependencies không đổi;
- **patch-check**: owner/operator chọn affected units để kiểm tra nhanh sau 1–2 dòng sửa; kết quả cũ được giữ làm reference nhưng report phải ghi partial/mixed revision, không giả là full current-revision pass.

Đây là state/correctness tối thiểu phục vụ chính mục tiêu tiết kiệm, không phải audit hardening.

## Stage/branch map

| Stage | Planned branch | Outcome | Live calls |
| --- | --- | --- | --- |
| Stage 0 | `feat/agent-skill-eval-cli-first` | Master plan only | `0` |
| Stage 1 | `feat/agent-skill-eval-cli-runner` | Runnable bounded-parallel CLI runner on prepared workspace | `0` in deterministic review; canary separately authorized |
| Stage 2 | `feat/agent-skill-eval-cli-prepare` | Prepare barrier, execution plan, concurrency estimate | `0` |
| Stage 3 | `feat/agent-skill-eval-cli-reuse` | Exact reuse, resume, unit-local/affected rerun | `0` |
| Stage 4 | `feat/agent-skill-eval-cli-evaluator-report` | Evaluator/report/CI/docs and migration pilot gate | `0` until separately authorized |

Mỗi branch tạo từ refreshed `main` sau khi stage trước merge; không stacked mặc định. Mỗi checkpoint phải pass deterministic verification và formal review `0 Critical / 0 Required` trước commit/next checkpoint.

Stage 1 consume v1 workspace bằng existing `synthetic-workspace-v1.mjs` read helpers nhưng không sửa packager. Stage 1 cũng sở hữu focused deterministic CLI-runner CI step; Stage 4 chỉ mở rộng CI cho evaluator/report. Đây là correction cần thiết để Stage 1 có thể resolve workspace và được CI kiểm tra ngay tại owning branch, không phải backend/hardening expansion.

Trong Stage 1, sequential vertical slice và bounded parallel runner bắt buộc ở **cùng branch/PR**:

```text
one-unit sequential check
  → nếu pass, bounded parallel check
  → chỉ parallel pass mới đạt target architecture
```

Sequential chỉ chứng minh CLI invocation chạy được. Nó không đủ để đóng Stage 1. Parallel phải chứng minh worker overlap, concurrency cap, per-unit binding và một unit lỗi không kéo independent units chết. Live gate, nếu được authorize riêng, chạy đúng `1` reader unit sequential rồi `2` reader units khác tại concurrency `2`: ceiling `3 reader / 0 evaluator / 0 automatic retry`.

Không bao giờ chạy full vài chục units tuần tự rồi chạy lại full song song để benchmark. Fake-process tests có thể dùng nhiều units vì call count `0`; duration estimate dùng timing của calls vốn đã được authorize, không tạo full calibration run riêng.

## Concurrency planning

- Stage 1 chạy multiple independent `codex exec --ephemeral` processes; CLI không có batch scheduler riêng.
- Stage 2 tính recommendation từ total estimated work, target wall time, dependency critical path, owner/local caps và observed rate-limit cap.
- Khi chưa có trustworthy history, recommendation là `min(4, owner/local caps)` và duration/rate-limit inputs phải ghi `unknown`.
- Ví dụ `30` independent units tại concurrency `4` tạo `8` scheduling waves. Concurrency giảm wall time, không giảm total calls/quota.

## Ngoài phạm vi program

- App Server backend, native subagent backend, plugin registry hoặc generic multi-backend layer.
- Semantic section-to-case dependency inference/package slicing.
- Security/production-readiness certification.
- Automatic retry loop; default automatic retry là `0`.
- Arbitrary-prompt executor.
- Thay đổi skill/suite semantics hoặc migration verdict.

## Decision record và gate trước Stage 1

- [x] CLI-only program; App Server/native subagent/multi-backend không block CLI path.
- [x] Mục tiêu gốc prepare-before-call và affected/dependency-only rerun là ưu tiên.
- [x] Không dựng unsupported hardening/attestation; giữ functional state tối thiểu cho resume/reuse.
- [x] Dùng master plan và independent stage branches/PRs.
- [x] Bounded parallel runner thuộc Stage 1; không dùng sequential-only architecture.
- [x] Sequential → parallel là hai checkpoints trong cùng Stage 1 branch; sequential pass không đủ để close/merge stage.
- [x] Stage 1 live gate tối đa `1 + 2` distinct reader calls; cấm full sequential-then-parallel duplicate run.
- [x] Material design problem phải được research, báo owner và update/review plan trước khi đổi.
- [x] Stage 0 là plan-only, chưa implement.
- [x] Owner approve master-plan direction và review-pass delivery.
- [x] Stage 1 exact transferable plan đã được lập và self-review.
- [ ] Separately authorize Stage 1 implementation when ready.

Approval plan không tự cấp live call, push/PR/merge hoặc later-checkpoint permission.
