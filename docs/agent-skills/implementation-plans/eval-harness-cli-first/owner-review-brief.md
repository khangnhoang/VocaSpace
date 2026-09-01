# Agent Skill Eval Harness CLI-first — owner review brief

## Quyết định hiện tại

- Workstream: `eval-harness-cli-first`.
- Stage 0: PR #77 merged tại `e195569479ee49dd9592a93573c49ecad85cd9e6`.
- Stage 1 merged qua PR #78 tại `2616b052882d8c39a8a01e4da5167fd7d778f1df`; Stage 2 merged qua PR #79 tại `d4b5f78a09fa997da75e969822bbc678c7f002a4`; Stage 3 merged qua PR #80 tại `69e723556088cf885de1d7b2ebe4db29a44180f6`, chứa exact final head `d5d86b3681464d89d2d675b3e703ed34fe9a7f2a`. Current Stage 4 planning branch `feat/agent-skill-eval-cli-evaluator-report` được tạo từ exact Stage 3 merge đó.
- Plan decision status: Stages 1–3 `completed and merged`; Stage 4 planning đang tiếp tục. Historical pre-delivery snapshot của Stage 3 là `implemented locally / correction-reviewed / 0 Critical / 0 Required / not pushed`. Post-implementation review bổ sung six initial, three subsequent và two latest `Required` findings; frozen Stage 3 semantics, gồm mixed-mode recovery và transitional-inventory rejection, không đổi khi reconcile delivery metadata. Cross-revision reuse vốn đã là master requirement; exact accepted-attempt/producing-descriptor seam thuộc Stage 3. Historical [Stage 2 detailed plan](./stage-2-cli-prepare.md) không bị rewrite.
- Runner implementation: S1-CP1–S1-CP4 committed tại `49b8777`; stdin-envelope correction committed qua `7a3df05` và `1dd7319`; first S1-CP5 transport/schema evidence, corrected unknown outcome và owner recovery success đều giữ truthful historical labels.
- Stage 2 implementation: S2-CP1–S2-CP5 và correction commit `a89ddee97d19b24a2d8751952d80069631d4c8c8` đã merge qua PR #79. Focused Windows suite đạt `40/40`, v1 compatibility đạt `130/130`, actual all-scope prepare `run-568f9556844e432b96807241cc66ffba` đạt `21 reader / 21 evaluator / 42 total` với dispatch `0 / 0 / 0`; required CI passed trước merge.
- Current authority: historical Stage 3 planning, implementation, correction và delivery actions đã hoàn tất; Stage 3 đã merge qua PR #80. Owner prompt ngày `2026-09-02` authorize bounded stale delivery/status reconciliation, review, local documentation correction commit và tiếp tục Stage 4 planning. Không authorize Stage 4 implementation, push, PR, CI-fix, merge hoặc live model/evaluator call.

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

Stage 3 accepted success dùng two-anchor rule. Mutable unit state chỉ reference exact accepted `attempt_id` + immutable coordinator `attempt.json`; record đó bind producing revision, exact worker `result.json` và canonical run-relative output path/hash. State reader validate toàn bộ relationship, load producing revision's serialized reader descriptor rồi derive bounded producer locator/fingerprint. `cli-impact-v1.mjs` so sánh derived producer fingerprint với current descriptor. Pure evaluator compiler nhận normalized binding, không đọc store và không dùng current workspace locator để reject equivalent old producer. Observation không có `unit_id`/`source_role`: attempt/result proves unit, binding proves semantic role/current dependency, observation proves case/artifact/producer locator, fingerprint proves behavior equality. Không rewrite Stage 1 `ExecutionResult`, observation, packager hoặc historical Stage 2 plan.

Stage 3 compatibility correction giữ exact Stage 2 `cli_run` v1 như merged, validate nó trước rồi create-once/exact-replay zero-attempt unit bootstrap và atomically replace `run.json` last bằng explicit `cli_run` v2. V2 giữ `artifact_type`, `workspace_id`, `status`, `process_settings`; crash trước/sau replace luôn để lại exact v1/v2 marker, không mixed schema. `attempt.json` ghi terminal status và nullable output pair: success `non-null/non-null`, failed/unknown `null/null`. Regression bắt buộc giữ semantic reuse qua valid `variant_mapping` A/B flip, không rewrite accepted observation bytes, và chứng minh mọi forbidden substitution tạo evaluator materialization/state mutation `0` qua before/after snapshots của full state-reader → impact-resolver → compiler path.

Latest transferable-contract correction freezes full `active_attempt` before worker spawn and result-aware restart recovery: valid terminal result keeps its exact status, only missing record+result produces recovery-only `outcome_unknown`, contradictory evidence integrity-blocks without fake relationship/ordinal. Unit fingerprint/dependency-binding nullability, exact lexical binding equality and persisted-integrity versus derived-dependency block ownership are explicit. Public `prepare --run`/`run`/`status`/`resume`/`retry`/`patch-check` now have canonical result/error envelopes, aggregate status derivation and exit `0/1/2/3`. Stage 3-owned `cli_run`/`cli_execution_plan` v2 artifacts are allowed; existing App Server/CP9/v2 modules remain outside scope.

Continuation correction separates valid current-change invalidation from corrupt accepted evidence: only the former becomes pending, while accepted graph integrity failure is no-mutation `command_error`; persisted block stays limited to coordinator-owned in-flight recovery contradictions. `operational_condition` is a persisted preflight latch above ready work with explicit recheck/clear lifecycle. Read-only `status` on canonical v1 derives a zero-attempt snapshot in memory without upgrade. Patch-check mixed mode survives every same-revision command and resets only on next successful `prepare --run`; multi-unit retry/patch-check selection is validated all-or-nothing before mutation/materialization/dispatch.

Final transferability correction freezes `max_attempts` as a lifetime per-logical-unit ceiling across every revision/fingerprint within one run; every allocated worker/recovery ordinal consumes it and every spawn path uses the same gate. A later valid invalidation may publish but exposes derived `blocked / attempt_budget_exhausted`, requires a new run after remaining independent work settles, and cannot be bypassed by `retry` or `patch-check`. Patch-check now has an exact projected-status/dependency/budget eligibility matrix. `operational_condition` remains strictly pre-spawn, so its canonical command error always reports dispatch `0`; a post-spawn failure stays an attempt-local `failed`/`outcome_unknown` rather than creating a new mid-dispatch latch policy.

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
- [x] Draft Stage 2 detailed implementation plan dưới owner-authorized planning scope.
- [x] Owner approve corrected Stage 2 detailed implementation plan.
- [x] Authorize Stage 2 source/test implementation theo Frozen contract + Semantic-lineage substitution.
- [x] Stage 2 delivered and merged qua PR #79.
- [x] Confirm accepted-attempt/producer-anchor findings là `Required` và authorize master/Stage 3 planning correction.
- [x] Draft Stage 3 detailed implementation plan với S3-CP0 provenance rebinding trước state/resume work.
- [x] Correct Stage 3 `run.json` compatibility upgrade, unsuccessful-attempt nullability và observable provenance regression matrix.
- [x] Freeze in-flight attempt recovery, exact unit/dependency schemas, public CLI envelopes/status/exit behavior và Stage 3-owned-v2 scope boundary.
- [x] Separate accepted-evidence integrity from invalidation; freeze operational latch, v1 read-only status, mixed-mode lifecycle and atomic multi-unit selection.
- [x] Authorize Stage 3 source/test implementation theo frozen contract + semantic-lineage substitution; S3-CP0–S3-CP5 đã hoàn tất và Stage 3 merged qua PR #80 tại `69e7235`.

Approval plan không tự cấp live call, push/PR/merge hoặc later-checkpoint permission.
