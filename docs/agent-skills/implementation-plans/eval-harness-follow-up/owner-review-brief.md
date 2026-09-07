# Harness follow-up — bản duyệt cho owner

## Quyết định và quyền hiện tại

- Ngày `2026-09-06`; [detailed plan](./plan.md) là `frozen implementation contract / owner-approved` theo instruction hiện tại.
- Owner đã approve detailed design cho explicit reader donor reuse và configurable reader model/effort; default reader/evaluator đều giữ Sol Medium.
- Owner đã thu canary Luna Max xuống 3–4 cases sau implementation; không chạy 6-case calibration ngay. Canary đạt chỉ cho phép đề xuất mở rộng, không tự fanout hoặc đổi default.
- Đã fetch và tạo branch mới `codex/harness-follow-up-plan` từ clean `main == origin/main == 2be02df11e279b5c88f37d2fd609069a54c235ed`, `0/0`. Worktree discovery cũ được giữ nguyên.
- Quyền hiện tại gồm source implementation và local checkpoint commits theo checkpoint gate. Không authorize model/live/egress, push, PR hoặc merge; current instruction không cấp các quyền đó.

## Frozen implementation contract

| Phần | Quyết định đã freeze |
| --- | --- |
| Donor selection | Một explicit donor run qua `prepare --reuse-readers-from`; new run only, reader-only, cùng fixed local store |
| Evidence | Chỉ current local worker-backed success của donor; immutable receipt pin run/unit/attempt/producing plan; full revalidation, không fake local attempt/run ID hoặc rewrite observation |
| Accounting/restart | Imported current success có local attempt count 0; receipt bất biến, marker-last, invalidation/retry/unknown/lifetime budget giữ semantics |
| Report | Producer-qualified run/revision attribution; exact donor có thể current, historical mixed chỉ reference; không ghép theo attempt ID đơn lẻ |
| Config | `--reader-model`/`--reader-effort` khi tạo run; freeze chung baseline/candidate; worker dùng prepared options, evaluator Sol/medium riêng |
| Compatibility | Historical fixed Sol plans giữ exact validation/bytes; version mới cho new contract, không global default drift hoặc automatic store migration |
| Scope | Không evaluator/global cache, multi-donor/chains, runtime/backend/attestation project, per-case model router hoặc skill/suite/app/DB changes |

Chi tiết wire versions, receipt fields, publication/restart/status/mixed graph và required negative tests do plan sở hữu. Không suy chỉ cần bỏ `run_id` check hoặc đổi global model constant.

## Checkpoints và verification

1. **CP0 planning:** plan/brief/index/progress và link routing từ CLI master; docs-only validation.
2. **CP1 donor reuse:** source + trực tiếp related tests + operator docs thành một coherent checkpoint; full CLI suite, marker/restart/provenance/accounting/report tests, main integration review không còn Critical/Required.
3. **CP2 reader configuration:** source + fake-child argv/parity/history/donor-mismatch tests + docs; cumulative CLI/v1/validator verification và main integration review. Default vẫn Sol Medium.
4. **CP3 sau implementation:** finalize exact canary packages/rubrics/runtime/run IDs/commands/destination, rồi xin authority live riêng. Không model probe để chuẩn bị plan.

Mỗi actual checkpoint phải pass deterministic verification và self-review trước local commit. CP0 message: `docs(skill-evals): plan reader reuse and model configuration`. Push/PR/merge riêng và hiện chưa authorize.

## Canary Luna Max giới hạn nhỏ

Đề xuất 4 cases: `ssm-route-nondb-zod-near-miss`, `ssm-fresh-remote-push-core-stop`, `ssm-reg-additive-constraint-existing-data`, `ssm-reg-seed-safety`. Nếu owner chọn 3, chốt membership trước grant.

- Hai arms Sol/medium và Luna/max; mỗi arm chạy baseline + candidate cùng exact package/rubric set, evaluator Sol/medium.
- 4 cases: **16 readers + 8 evaluators = 24 dispatch maximum**. 3 cases: **12 + 6 = 18**.
- Fresh samples ở cả hai arms, không reuse trong experiment; `max_attempts=1`, retry `0`, concurrency tối đa `2` toàn experiment. Không whole-run fanout, replacement calls hoặc automatic calibration expansion.
- Execute từng case closure, inspect settled result trước command tiếp; stop/report incomplete khi operational/unknown/integrity hoặc confirmed safety issue. Chỉ đánh giá selected graphs; whole-run report incomplete do unselected cases không cho phép fanout thêm. Không xem both-model failure là quality parity.
- Chỉ đề xuất mở rộng nếu không Luna material/safety/permission/verification-truth regression, graph đủ evidence, cost/latency có lợi và main rubric adjudication đạt. Canary không chứng minh global default quality.

Exact live manifest chưa materialize vì CP3 chưa bắt đầu. Ceiling là subprocess dispatch, không giả hard token/dollar cap hoặc provider-internal call count. Owner chỉ duyệt live sau khi CP3 có package hashes và exact commands reviewable.

## Giới hạn và decision record

Donor phải còn trong local temp store; thiếu/corrupt đã-enroll evidence fail closed. CLI exactness chỉ phủ harness-controlled bytes/options, không provider hidden-envelope proof. Forecast 17 baseline reuse tiết kiệm `51 → 34` calls là conditional, chưa verify PR6 store trên host này.

Main plan self-review hoàn tất; initial CP1 source implementation và deterministic verification đã pass, nhưng integrity-matrix review sau đó xác nhận một `Required` evidence gap trên composed cross-run donor path. Finding này đã được phản ánh vào plan và correction đã pass; không có plan/contract conflict. `0 specialist`; không live/model/evaluator call. Decision vẫn `frozen / owner-approved`; CP2 đã pass deterministic verification, CP3 chưa bắt đầu, live/remote authority chưa được cấp. Correction được giữ ở một local commit riêng và không amend `da72752`. Mọi correction về behavior/schema/scope phải được phản ánh vào plan trước implementation; không dùng brief để âm thầm thay contract.

## CP1 correction checkpoint — 2026-09-07

- Bổ sung composed tests từ hai donor graph hợp lệ độc lập cho toàn bộ relationship matrix run/unit/role/attempt/record/result/producing-plan/output; symlink, late-result, marker/next-revision recovery, invalidation ceiling, retry/unknown/patch-check eligibility, same-attempt-ID separation và byte-stable `status`/`report`.
- Bổ sung hai integrity guards nhỏ trong state/manifest loader: manifest `run_id` phải bind vào producing plan; unit filename phải bind vào unique expected unit set.
- Verification: targeted CP1 `35/35`; full CLI `131/131`; changed `.mjs` `node --check`; targeted ESLint `0 errors`; `git diff --check` pass. Chỉ dùng fake child/local temp fixtures; live/model/provider/evaluator calls `0`. Push/PR/merge không thực hiện.

## CP2 actual checkpoint — 2026-09-07

- Review disposition: diff tiếp quản tại `a28eae6` là `sound/continuable`; không có plan/contract conflict và không discard thay đổi trước đó.
- Source giữ đúng frozen boundary: `prepare` new-run flags `--reader-model`/`--reader-effort`, explicit plan v3 reader freeze, descriptor cross-validation, worker argv từ prepared options, evaluator Sol/medium, historical v1/v2 compatibility, donor mismatch/restart guard và no silent fallback. Safe model syntax fail-loud; `ultra`, duplicate/unknown/malformed và same-run override bị từ chối trước materialization.
- Test evidence: options → descriptor → argv với fake child cho cả baseline/candidate readers; default/historical replay; donor config mismatch/match; durable restart/revision; low-level revision freeze; parser failure cases. Local temp/fake child only, live/model/provider/evaluator calls `0`.
- Verification: targeted CP2 `6/6`; full CLI `137/137`; cumulative v1 `130/130`; structural validator `37/37`; validator script `valid`; `validate --all` `valid`; changed `.mjs` syntax và targeted ESLint `0 errors / 0 warnings`; `git diff --check` pass. CP3/live/model/push/PR/merge chưa thực hiện. Local commit dùng message `feat(skill-evals): configure reader model independently of evaluator`.
