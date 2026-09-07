# Vận hành CLI-first skill evaluation

Tài liệu này hướng dẫn thao tác với `run-skill-eval-cli.mjs`. [Master plan](./implementation-plans/eval-harness-cli-first/plan.md) sở hữu contract tổng; [Stage 4 detail plan](./implementation-plans/eval-harness-cli-first/stage-4-cli-evaluator-report.md) sở hữu contract evaluator/report. Quy tắc đánh giá nằm trong [eval-design resource](../../.agents/skills/maintain-repo-skills/references/eval-design.md); quyền hiện tại và kết quả đã kiểm chứng nằm trong [owner review brief](./implementation-plans/eval-harness-cli-first/owner-review-brief.md) và [progress](./progress.md).

## Chuẩn bị và đọc estimate

Chạy từ repository root. Ví dụ PowerShell sau chỉ chuẩn bị input, không gọi reader/evaluator:

```powershell
node .agents/scripts/run-skill-eval-cli.mjs prepare `
  --skill maintain-repo-skills --isolation synthetic `
  --candidate-current-tree --no-baseline `
  --max-concurrency 2 --max-attempts 2 --target-minutes 10
```

Thay `maintain-repo-skills` bằng skill cần đánh giá. Chọn đúng một nguồn candidate: `--candidate-current-tree` hoặc `--candidate-ref <ref>`; chọn đúng một chế độ baseline: `--baseline-ref <ref>` hoặc `--no-baseline`. Có thể dùng `--concurrency <positive-safe-integer>` khi tạo run để chọn concurrency trong owner/local caps. Các số trong ví dụ không cấp quyền thực thi model.

Đọc JSON trả về: `run_id`, `revision`, `selected_scope`, `counts`, `dependency_waves`, `process_settings` và `estimate`. Không có lệnh `estimate` riêng. Khi không có lịch sử đáng tin cậy, duration estimate vẫn `unknown`; recommendation dùng `min(4, owner cap, local cap)`. `target_minutes` là đầu vào ước lượng, không phải cam kết thời gian hoàn tất.

### Cấu hình reader cho run mới

Khi cần thử reader configuration khác, truyền tùy chọn ngay lúc tạo run mới:

```powershell
node .agents/scripts/run-skill-eval-cli.mjs prepare `
  --skill maintain-repo-skills --isolation synthetic `
  --candidate-current-tree --no-baseline `
  --reader-model gpt-5.6-luna --reader-effort max
```

`--reader-model` và `--reader-effort` mỗi flag chỉ xuất hiện một lần. Model là safe identifier không rỗng gồm ASCII letters/digits và `.`, `_`, `-`; effort chỉ nhận `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. Nếu bỏ qua, plan mới vẫn ghi rõ reader `gpt-5.6-sol / medium`; chỉ đổi model thì effort vẫn là `medium`. Một run freeze cùng reader options cho baseline và candidate. `prepare --run` từ chối hai override này và kế thừa cấu hình đã freeze; muốn đổi cấu hình phải tạo run mới.

Plan configurable là `cli_execution_plan` schema v3 với `reader_cli_behavior_options` ở top-level và trong exact descriptor projection. Evaluator vẫn dùng `cli_behavior_options` cố định `gpt-5.6-sol / medium`; reader/evaluator đều giữ `read-only`, ephemeral, ignore-user-config và ignore-rules. Không có arbitrary `-c`, profile, sandbox/provider/service-tier override hoặc alias/fallback; runtime/model/effort không được hỗ trợ sẽ fail theo result/budget semantics. Low-level `execute-prepared` không có public configuration surface thứ hai và vẫn dùng default Sol/medium.

### Tạo run mới từ reader donor

Khi một run mới cần dùng lại reader evidence đã thành công, truyền đúng một donor run cùng fixed local store:

```powershell
node .agents/scripts/run-skill-eval-cli.mjs prepare `
  --skill maintain-repo-skills --isolation synthetic `
  --candidate-current-tree --no-baseline `
  --reuse-readers-from $donorRunId
```

`--reuse-readers-from` chỉ hợp lệ khi tạo run mới; không dùng cùng `--run`, không nhận path/output/evaluator donor tùy ý. Harness chỉ xét reader có cùng logical key và behavior fingerprint với target, đang là local worker-backed success hiện tại của donor. Failed, unknown, running, integrity-blocked, recovery-only, imported hoặc đã invalidated là non-match; evidence bị corrupt hoặc receipt bị sửa là command error (`3`), không biến thành cache miss hay fallback reader call. Donor được đọc-only và phải còn nguyên trong fixed store.

Kết quả prepare có `schema_version = 2`, `imported_reader_unit_ids`, `imported_reader_count`, `expected_new_calls_without_retry` và `reader_reuse_manifest`. Run target dùng `cli_run` v3, receipt `reader-reuse.json` immutable và imported reader state có local attempt count `0`; evaluator vẫn phải chạy trong target run khi đủ dependency. `imported_reader_count = 0` là kết quả thành công hợp lệ. Không có evaluator cross-run reuse hoặc donor chain.

Receipt giữ producer run/revision/attempt/plan provenance để `report --run` trả `producer_run_id` đúng cho reader và target run ID cho evaluator. Không xóa donor artifacts khi recipient còn cần report, resume hoặc revision; workstream này không có retention/cleanup service.

Run được lưu dưới `<os.tmpdir()>/vocaspace-agent-skill-evals/cli-v1/<run_id>`; `run.json` là marker authoritative của revision đã publish. Không chỉnh tay marker, state, attempt hoặc accepted output. `prepare` validate toàn bộ selected static scope trước khi dispatch; evaluator input được finalize sau khi có đủ accepted reader evidence và trước evaluator spawn.

## Thực thi, resume và retry

Chỉ chạy các lệnh có thể dispatch dưới quyền thực thi tương ứng. Thay giá trị minh họa bằng ID thật từ output:

```powershell
$runId = 'run-<32 hex characters>'
node .agents/scripts/run-skill-eval-cli.mjs status --run $runId
node .agents/scripts/run-skill-eval-cli.mjs run --run $runId
node .agents/scripts/run-skill-eval-cli.mjs resume --run $runId
node .agents/scripts/run-skill-eval-cli.mjs retry --run $runId --unit 'evaluator-<64 hex characters>'
```

- `run` và `resume` thực thi các unit `pending` đủ dependency và lifetime budget, theo bounded dependency waves. Reader và evaluator cùng dùng cap của run; evaluator chỉ chạy khi toàn bộ reader dependency đã có accepted success phù hợp.
- Success được giữ riêng theo unit. `run`/`resume` không tự retry `failed`; dùng `retry --unit` để chọn failed reader hoặc evaluator. Có thể lặp `--unit`. Evaluator retry cần đủ current successful dependencies; retry reader có thể làm ready evaluator downstream. Unrelated pending evaluator không nằm trong scope retry đó.
- `max_attempts` là trần lifetime cho từng unit trong cùng run, qua mọi revision và fingerprint. `prepare --run`, `resume`, `retry` và `patch-check` không reset trần. Khi hết budget, cần quyết định tạo run mới dưới quyền tương ứng.
- `outcome_unknown` không được tự retry hoặc chọn qua `retry`. Giữ nguyên evidence; không suy ra chắc chắn có hay không có model call từ một process failure. Recovery xác minh terminal evidence khi restart, không tạo một lần gọi thay thế cho outcome chưa biết.
- `status` chỉ đọc và trình bày trạng thái; không preflight Codex, dispatch, reconcile bằng cách ghi state hay repair store.

## Revision mới và patch-check

Sau khi sửa candidate, chuẩn bị revision mới với cùng selected scope và comparison mode:

```powershell
node .agents/scripts/run-skill-eval-cli.mjs prepare --run $runId `
  --skill maintain-repo-skills --isolation synthetic `
  --candidate-current-tree --no-baseline
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run $runId --unit 'reader-<64 hex characters>'
```

`prepare --run` giữ process settings của run và lifetime attempts, validate accepted producing evidence rồi reuse hoặc invalidate theo exact behavior/dependency equality. Evidence cũ vẫn được giữ. Không truyền lại các cờ concurrency/budget/target khi tạo revision mới. Publication thành công đổi marker sang revision mới và reset coverage mode về `exact_current`.

`patch-check` chọn dependency closure của các unit pending hợp lệ sau invalidation. Nó không rerun unchanged success, không thay thế failed retry và không vượt budget. Toàn bộ selection phải pass eligibility trước mutation/dispatch. Lệnh latch `patch_check_mixed_revision` trước thay đổi unit; `status`, `run`, `resume`, `retry` và `report` trong cùng revision giữ latch đó. Kể cả mọi case về sau đều current, report vẫn mang mixed mode cho đến lần `prepare --run` thành công kế tiếp.

## Report và exit code

```powershell
node .agents/scripts/run-skill-eval-cli.mjs report --run $runId
```

`report --run` xuất một canonical JSON document ra stdout, dispatch `0 reader / 0 evaluator / 0 total`. Lệnh không tạo report file, không thay đổi run tree và không sửa v1 report/human evaluation. Nếu cần lưu stdout, operator tự chọn đích lưu theo quyền đã cấp.

`authority = advisory_evaluator_proposals_only`: proposal là nhận định của model để người review tham khảo. Report không tạo human verdict, winner, action hoặc migration acceptance.

| Trường hợp report | Cách đọc |
| --- | --- |
| `coverage_status = current` | Coherent graph được xác minh với revision hiện tại; producer có thể ở revision cũ nếu exact reuse hợp lệ. |
| `coverage_status = retained_reference` | Chỉ có trong `patch_check_mixed_revision`; coherent historical graph làm tài liệu tham khảo. |
| `coverage_status = incomplete` | Thiếu coherent graph hoặc có failed/unknown/running/integrity/budget condition. Có thể vẫn kèm retained evidence; điều này không làm case hoàn tất. |
| Không có coherent graph | Attribution, attempt/revision/hash và evaluator proposal đều unavailable/null; không ghép các output rời rạc thành một graph. |

Mixed history được chọn từ successful evaluator attempt rồi đối chiếu semantic reader projections của producing input. Reader attempt ghi trong report chứng minh semantic match, không khẳng định đó chính là reader attempt đã tạo evaluator input. `exact_current` không đọc retained history của success đã invalidate bình thường. Persisted succeeded/accepted evidence mâu thuẫn current coverage gây `CLI_REPORT_COVERAGE_INVALID`.

| Exit | Ý nghĩa |
| --- | --- |
| `0` | `prepare` đã publish hoặc `status` đã đọc thành công; `status` vẫn trả `0` khi run chưa hoàn tất. Với execution, command result là `succeeded`, không đồng nghĩa run completed: retry có thể thành công trong khi unit ngoài scope vẫn pending và `run_status = prepared`. Với report, không còn case incomplete trong coverage mode khai báo. Mixed report exit `0` không chứng minh toàn bộ current revision hay human acceptance. Zero-case report có counts `0`, status `succeeded`. |
| `1` | Với report: bất kỳ case incomplete nào cũng cho `status = incomplete`, kể cả có retained graph. Với execution: trustworthy settled result vẫn có failed/unknown/budget-exhausted work; pending ngoài scope tự nó không làm command incomplete. Success của unit độc lập vẫn được giữ. |
| `2` | Usage/argument không hợp lệ. |
| `3` | `command_error`, gồm integrity-blocked execution, artifact corruption, input/state mismatch hoặc coverage-invalid. Report lỗi không phát report, không mutate và không dispatch. |

Persisted `integrity_failure` quarantine được report thành incomplete/exit `1` mà không mở evidence đã quarantine; corruption mới phát hiện hoặc late-result contradiction là command error/exit `3`. Không coi corrupt evidence là pending để rerun. Kiểm tra cả `status`, `coverage_mode`, counts và từng case; exit `0` của một command chỉ có scope của command đó.

## Deterministic verification và live pilot

Các lệnh sau dùng fixture/fake process và local artifacts, không cần model call:

```powershell
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
```

[CI workflow](../../.github/workflows/ci.yml) đã cấu hình chạy CLI test file trên Ubuntu, gồm Stage 4 evaluator/report coverage; không cần thêm bước trùng lặp. Kết quả local không chứng minh remote CI đã chạy.

S4-CP4 hiện `not_run / unauthorized`. Trước live pilot, owner phải cấp riêng exact run/skill/scope và refs, tổng reader/evaluator call ceilings, automatic retry `0`, concurrency không vượt recommendation/owner/local caps, stop conditions cho operational/unknown/budget, allowed commands và evidence/report destination. Phải pass preflight và deterministic current-head checks trước call đầu tiên. Ghi lại command, run/revision/refs, ceilings, số dispatch thực tế từng loại, trạng thái từng unit, report coverage, exit code và vị trí evidence; phân biệt dispatch quan sát được với model/provider call certainty. Pilot không cấp quyền commit/push/PR/merge hay các lần live sau đó.
