# Agent Skill Eval Harness CLI-first — owner review brief

## Quyết định hiện tại

- Workstream: `eval-harness-cli-first`.
- Stage 0: PR #77 merged tại `e195569479ee49dd9592a93573c49ecad85cd9e6`.
- Stage 1 merged qua PR #78 tại `2616b052882d8c39a8a01e4da5167fd7d778f1df`; current branch `feat/agent-skill-eval-cli-prepare` được tạo từ exact merged base đó.
- Plan status: master plan và [Stage 1 implementation plan](./stage-1-cli-runner.md) `reviewed / Stage 1 completed and merged`; owner-approved Stage 2 correction đã thêm bounded `evaluator-proposal-v1`, evaluator stdin/projection, pure descriptor compiler và create-once/exact-replay materializer mà không enable evaluator execution sớm.
- Runner implementation: S1-CP1–S1-CP4 committed tại `49b8777`; stdin-envelope correction committed qua `7a3df05` và `1dd7319`; first S1-CP5 transport/schema evidence, corrected unknown outcome và owner recovery success đều giữ truthful historical labels.
- Current authority: local commit cho master-plan/decision-surface correction và draft/review Stage 2 detailed implementation plan; không có Stage 2 source implementation, live call mới, push, PR, CI-fix hoặc merge authority.

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
| Stage 2 | `feat/agent-skill-eval-cli-prepare` | Prepare barrier, exact reader/evaluator request contracts, execution plan, concurrency estimate | `0` |
| Stage 3 | `feat/agent-skill-eval-cli-reuse` | Exact reuse, resume, unit-local/affected rerun | `0` |
| Stage 4 | `feat/agent-skill-eval-cli-evaluator-report` | Evaluator/report/CI/docs and migration pilot gate | `0` until separately authorized |

Mỗi branch tạo từ refreshed `main` sau khi stage trước merge; không stacked mặc định. Mỗi checkpoint phải pass deterministic verification và formal review `0 Critical / 0 Required` trước commit/next checkpoint.

Stage 1 consume v1 workspace bằng existing `synthetic-workspace-v1.mjs` read helpers nhưng không sửa packager. Stage 1 cũng sở hữu focused deterministic CLI-runner CI step; Stage 4 chỉ mở rộng CI cho evaluator/report. Đây là correction cần thiết để Stage 1 có thể resolve workspace và được CI kiểm tra ngay tại owning branch, không phải backend/hardening expansion.

Stage 2 định nghĩa exact model-authored `evaluator-proposal-v1` gồm advisory criterion findings, safety-veto findings, comparison differences và summary; output không có human `case_status`/`comparison_status`, winner hoặc action. Pure compiler tạo invocation-path-free descriptor từ exact bytes; create-once materializer ghi `stdin.txt`/`output-schema.json` trong same-filesystem staging rồi publish bằng portable directory rename dưới one-coordinator/one-writer contract. Nếu target đã có hoặc rename fail sau khi target xuất hiện, exact replay re-read inventory/bytes và chỉ trả cùng `PreparedUnit` khi descriptor hashes/projection/`cli_options` đều khớp; partial/mismatch không bị overwrite hoặc repair. Contract không claim atomic no-replace, TOCTOU protection hoặc external/multi-writer safety; native `RENAME_NOREPLACE` và publication-lock subsystem nằm ngoài scope. Stage 3 mới compute/persist fingerprint, dependency bindings và reuse state; Stage 4 mới thêm evaluator result adapter, enable scheduling và bridge sang human/report. Stage 2/3 không dispatch evaluator.

Raw v1 bundle/context manifests chỉ dùng để validate source integrity/provenance và nằm trong `source_locator`; chúng không được copy vào model-visible attempt input vì chứa random `workspace_id`/opaque `variant_id`. Exact requested execution policy phải canonical-match selected suite case và được đặt trực tiếp trong deterministic stdin. Blind reader framing/path/metadata không reveal semantic role hoặc opaque mapping; exact copied reader payload không bị substring-scan/rewrite. Evaluator được nhận semantic `candidate`/`baseline` roles để comparison nhưng không nhận opaque `A/B`, `variant_mapping` hoặc provenance locator. Đây là smallest Option 1 contract, không thêm `execution-policy.json`, schema, module hoặc backend abstraction.

First live gate cho thấy policy không sai nhưng acquisition contract sai: reader được bảo tự đọc files bằng tool/process trong khi policy cấm tool. Correction dùng delivery mode `stdin_embedded_executor_input_v1`: stdin là `canonicalJson` envelope chứa identity blind, exact policy object, lexically sorted lossless UTF-8 bundle/context payloads và exact prompt, mỗi payload có relative path + source SHA-256. Invalid UTF-8/round-trip mismatch fail trước spawn với dispatch `0`; không base64, chunk hoặc repair. Attempt-local copies có thể giữ làm transient diagnostics nhưng không phải reader acquisition path. Existing `model_visible_files` trở thành logical inventory của payload embedded in stdin; `stdin_sha256` hash exact transmitted envelope.

Trong Stage 1, sequential vertical slice và bounded parallel runner bắt buộc ở **cùng branch/PR**:

```text
one-unit sequential check
  → nếu pass, bounded parallel check
  → chỉ parallel pass mới đạt target architecture
```

Sequential chỉ chứng minh CLI invocation chạy được. Nó không đủ để đóng Stage 1. First live gate đã chứng minh sequential transport/schema và parallel overlap/cap nhưng không semantic consumption. Original corrected live recheck chạy đúng một command gồm `2` distinct reader units tại concurrency `2`, nhưng kết thúc `2/2 outcome_unknown` do host network refusal. Post-gate owner decision ngày `2026-08-30` explicitly authorized one recovery exception: exact old-process audit/targeted kill nếu cần, `1` sequential semantic canary, rồi chỉ khi canary đạt mới chạy one `2`-reader concurrency-`2` command. Recovery đạt process/schema và bounded human/main-agent semantic inspection cho cả ba responses; earlier unknown evidence vẫn được giữ. Exception đã consumed, không tạo standing retry/live authority và không thay đổi runtime architecture.

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

## Decision record và gate hiện tại

- [x] CLI-only program; App Server/native subagent/multi-backend không block CLI path.
- [x] Mục tiêu gốc prepare-before-call và affected/dependency-only rerun là ưu tiên.
- [x] Không dựng unsupported hardening/attestation; giữ functional state tối thiểu cho resume/reuse.
- [x] Dùng master plan và independent stage branches/PRs.
- [x] Bounded parallel runner thuộc Stage 1; không dùng sequential-only architecture.
- [x] Sequential → parallel là hai checkpoints trong cùng Stage 1 branch; sequential pass không đủ để close/merge stage.
- [x] First Stage 1 live gate consumed exact `1 + 2`; retained only as transport/schema + overlap evidence, not semantic success.
- [x] Corrected affected-only live gate, nếu authorize riêng, là one command `2` distinct readers / concurrency `2`; không rerun sequential/full batch.
- [x] Material design problem phải được research, báo owner và update/review plan trước khi đổi.
- [x] Stage 0 là plan-only, chưa implement.
- [x] Owner approve master-plan direction và review-pass delivery.
- [x] Stage 1 exact transferable plan đã được lập và self-review.
- [x] Owner chọn full stdin-envelope correction; raw manifests validate-only, suite policies unchanged và blind identity flow đã được reconcile.
- [x] Stage 1 input-correction implementation, bounded recovery, delivery và PR #78 merge đã hoàn tất; mọi Stage 1 authority đã consumed.
- [ ] Draft/review Stage 2 detailed implementation plan dưới một owner instruction riêng.
- [ ] Separately authorize Stage 2 implementation sau khi detailed plan được review.

Approval plan không tự cấp live call, push/PR/merge hoặc later-checkpoint permission.
