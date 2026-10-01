# Correction Plan: cấu hình model/effort cho evaluator trong Codex CLI eval runner

## Trạng thái và authority

| Trường | Giá trị |
| --- | --- |
| Trạng thái plan | `EVAL-CLI-EVALUATOR-CONFIG-PLAN-1`, Owner chấp nhận ngày 2026-10-01 cùng O2 và O3 như đề xuất |
| Branch | `fix/skill-eval-evaluator-config` |
| Base | `main == origin/main == 5a7fa96` ngày 2026-10-01 |
| Consumer | UI-5 CP3 ([UI-5 plan](../../../ui-design-system-and-review/implementation-plans/ui-5/plan.md)) cần reader và evaluator cùng `gpt-6.1-sol / medium` |
| Mode | `NORMAL` |

Owner đã cấp quyền commit plan này và implement CP1 kèm verification focused/static. Không có quyền live model call, push, PR hay merge. Không có `owner-review-brief.md` riêng: quyết định của Owner nằm ngay trong plan này.

## Binding Spec

### Mục tiêu và acceptance

1. `prepare` (run mới) nhận thêm `--evaluator-model <safe-model-id>` và `--evaluator-effort <none|minimal|low|medium|high|xhigh|max>`, đối xứng với `--reader-model` / `--reader-effort`: mỗi flag tối đa một lần, cùng quy tắc validate model (safe identifier, không allowlist) và cùng tập effort.
2. Bỏ qua hai flag thì evaluator giữ đúng default hiện tại `gpt-5.6-sol / medium` (`cliBehaviorOptions`); chỉ đổi model thì effort vẫn `medium`. Các run/plan/artifact đã có vẫn validate như trước.
3. Evaluator options được freeze vào plan (`cli_behavior_options`) và đi vào descriptor `invocation_content.cli_options`, `behavior_projection.cli_behavior_options`, do đó vào `producer_behavior_fingerprint` của evaluator. Mọi lần chạy, resume, retry, `patch-check`, revision kế tiếp (`prepare --run`) và recovery đều dùng đúng options đã freeze; revision kế tiếp có evaluator options khác bị từ chối loud.
4. `prepare --run` từ chối `--evaluator-model` / `--evaluator-effort` giống như reader override.
5. Evaluator được gọi bằng `codex exec` với model và `model_reasoning_effort` đã freeze; sandbox `read-only`, ephemeral, ignore-user-config, ignore-rules không đổi và không thể override.
6. Model bị Codex từ chối thì fail loud theo result/budget semantics hiện có; không fallback về default, không alias.
7. Kết quả `prepare`, `status`/`report` hiện evaluator model/effort ở mọi nơi đang hiện reader options (hypothesis H3 xác định chỗ cụ thể).
8. Help text và `docs/agent-skills/eval-design.md` mô tả hai flag mới; câu "Evaluator vẫn dùng `cli_behavior_options` cố định" và câu "`execute-prepared` … vẫn dùng default Sol/medium" được sửa: `execute-prepared` không có configuration surface riêng và dùng `cli_options` đã freeze trong prepared unit.
9. Test tập trung trong `run-skill-eval-cli.test.mjs` bao phủ các điểm 1–7; toàn bộ test runner hiện có vẫn pass.

### Phạm vi

- `.agents/scripts/run-skill-eval-cli.mjs` (parse, help, truyền options).
- `.agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs`, `cli-execution-plan-v1.mjs`, `cli-run-state-v1.mjs` (validate, freeze, so khớp revision); `cli-evaluator-proposal-v1.mjs` / `cli-evaluation-report-v1.mjs` chỉ khi H3 cần.
- `.agents/scripts/run-skill-eval-cli.test.mjs`.
- `docs/agent-skills/eval-design.md` (đoạn cấu hình reader/evaluator); `docs/agent-skills/progress.md` chỉ nếu nguồn đó đang ghi trạng thái evaluator cố định.

### Ngoài phạm vi

- cp9 / Codex app-server transport (`codex-app-server-stdio-transport-v2.mjs`, `cp9-*`, `run-skill-eval-harness.mjs`).
- Runner cho Claude hoặc provider khác.
- Thiết kế lại retry, attempt, store, reuse hoặc retention.
- Thay đổi methodology eval, suite, rubric, adjudication.
- Đổi default model/effort; thêm cấu hình sandbox/profile/provider/`-c` tùy ý.
- Thêm flag override model/effort cho low-level `execute-prepared`. Lệnh này tiếp tục dùng đúng `cli_options` đã freeze trong prepared unit, kể cả evaluator model/effort khác default; không thay bằng evaluator default lúc chạy.
- Dọn dẹp không liên quan; live model call.

### Execution guardrails

| ID | Guardrail | Hậu quả nếu bỏ |
| --- | --- | --- |
| G1 | Artifact cũ (plan schema v1/v2/v3 với evaluator default) vẫn validate; plan v1/v2 vẫn bắt buộc evaluator default | Run/evidence lịch sử không đọc được |
| G2 | Evaluator options bị freeze theo run và được so khớp ở revision kế tiếp, recovery, projection, resume | Một run trộn evidence của hai evaluator config mà không ai biết |
| G3 | Evaluator options nằm trong behavior projection nên fingerprint đổi khi options đổi | Accepted evaluator evidence bị coi là tương đương dù config khác |
| G4 | Validate model/effort dùng chung một quy tắc với reader | Hai đường validate lệch nhau; injection qua model id |
| G5 | Reader reuse (`--reuse-readers-from`) không bị ảnh hưởng bởi evaluator options | Phá reader reuse đang dùng được |
| G6 | Không fallback hay retry ngầm khi Codex từ chối model | Evidence báo sai config thực tế |
| G7 | Mọi đường thực thi, kể cả low-level `execute-prepared`, chạy evaluator bằng `cli_options` đã freeze trong prepared unit; không đường nào thay bằng default lúc chạy | Unit được chạy với config khác config đã ghi trong descriptor và fingerprint |

## Sự thật đã xác nhận (discovery)

| Nguồn | Sự thật |
| --- | --- |
| `codex-cli-runner-v1.mjs:37-53` | `cliBehaviorOptions` (evaluator) và `defaultReaderCliBehaviorOptions` (reader) đều là `gpt-5.6-sol / medium`, read-only, ephemeral, ignore-user-config, ignore-rules |
| `codex-cli-runner-v1.mjs:92-100` | `assertPreparedCliOptions` từ chối evaluator có options khác `cliBehaviorOptions` ("must remain frozen at Sol/medium") |
| `cli-execution-plan-v1.mjs:130, 471` | Plan mọi schema đã có trường `cli_behavior_options` cho evaluator; validator bắt buộc bằng `cliBehaviorOptions` |
| `cli-execution-plan-v1.mjs:731-735` | Validate descriptor từ chối evaluator `cli_options` khác default |
| `run-skill-eval-cli.mjs:681, 723, 1207, 1492`; `cli-run-state-v1.mjs:608, 838` | Mọi nơi dựng evaluator descriptor/invocation đã đọc `plan.cli_behavior_options`, không đọc hằng số |
| `cli-evaluator-proposal-v1.mjs:376-386, 418-428` | Evaluator descriptor ghi options vào `invocation_content` và `behavior_projection`; `assertCliOptions` chỉ kiểm tra shape, không ép default |
| `cli-run-state-v1.mjs:820` | `producer_behavior_fingerprint = sha256Canonical(behavior_projection)` nên đã bao gồm evaluator options |
| `cli-run-state-v1.mjs:350, 368, 427, 454, 462, 706-709` | Kiểm tra tương thích revision/recovery/projection hiện chỉ so `readerCliOptionsForPlan`; evaluator chưa cần so vì luôn là hằng số |
| `run-skill-eval-cli.mjs:253-291, 537-582` | Reader options được parse, freeze vào plan schema v3 (`reader_cli_behavior_options`), và bị từ chối khi `prepare --run` |
| Commit `abfb70a` | Tiền lệ cùng dạng cho reader: 9 file, +525/−41, chủ yếu test và doc |
| `node --test .agents/scripts/run-skill-eval-cli.test.mjs` tại `5a7fa96` | 137/137 pass (fake worker, không gọi model thật) |

Kết luận về độ lớn: dữ liệu và fingerprint cho evaluator options đã có sẵn. Correction chỉ gồm (a) thêm hai flag, (b) nới các chỗ đang ép default thành "options đã freeze trong plan", (c) thêm so khớp evaluator options ở các kiểm tra revision. Việc này **bounded**, cùng cỡ với `abfb70a`; không cần đụng store, retry hay cp9.

## Owner decisions

| ID | Quyết định | Trạng thái |
| --- | --- | --- |
| O1 | Thêm `--evaluator-model` / `--evaluator-effort` vào Codex CLI runner; default giữ `gpt-5.6-sol / medium` | Owner quyết định 2026-10-01 |
| O2 | "Model ID tùy ý" được hiểu là không allowlist, nhưng vẫn dùng đúng quy tắc safe identifier của reader (`[A-Za-z0-9._-]`, không bắt đầu bằng `-`). Model bị Codex từ chối thì fail loud | Owner chấp nhận 2026-10-01 |
| O3 | Không tăng schema plan: evaluator options khác default chỉ hợp lệ trong plan schema v3 (đã có trường `cli_behavior_options`); v1/v2 vẫn ép default | Owner chấp nhận 2026-10-01 |
| O4 | `execute-prepared` không có flag override; dùng `cli_options` đã freeze trong prepared unit, kể cả evaluator khác default | Owner quyết định 2026-10-01 |

## Bounded implementation hypotheses

- **H1.** Không có trường mới; nới validator v3 cho `cli_behavior_options` thành "normalized options", giữ ép default cho v1/v2. Có thể đổi sang schema v4 nếu test chứng minh v3 không phân biệt được artifact cũ với mới mà có hại (ví dụ code cũ đọc nhầm). Ranh giới: G1–G3 phải giữ.
- **H2.** Tái dùng `normalizeReaderCliOptions` (hoặc đổi tên/thêm alias trung tính) cho evaluator; `assertPreparedCliOptions` nhận options kỳ vọng từ plan thay vì so với hằng số.
- **H3.** Hiển thị trong output: kết quả `prepare` và `status`/`report` thêm evaluator options ở cùng chỗ reader options đang xuất hiện; nếu reader options không xuất hiện ở `report`, không thêm mới ở đó.
- **H4.** Thêm hàm `evaluatorCliOptionsForPlan(plan)` cạnh `readerCliOptionsForPlan` và dùng ở cùng các điểm so khớp.

## Thứ tự và Checkpoints

Một Checkpoint, không Stage: chỉ có một kết quả cần review.

**CP1 — Implement và verify**

1. Test trước (đỏ): parse flag; default giữ nguyên; freeze vào plan và descriptor; fingerprint đổi khi options đổi; `prepare --run` từ chối override; revision với evaluator options khác bị từ chối; v1/v2 với evaluator khác default bị từ chối; giá trị invalid (model không an toàn, effort lạ, flag lặp) bị từ chối; invocation dùng đúng model/effort; reader reuse không đổi.
2. Sửa code theo H1–H4.
3. Cập nhật help text và `docs/agent-skills/eval-design.md`.

Hoàn thành khi:

- `node --test .agents/scripts/run-skill-eval-cli.test.mjs` pass (137 test cũ + test mới);
- `node --test .agents/scripts/run-skill-evals.test.mjs`, `node --test .agents/scripts/run-skill-eval-harness.test.mjs`, `node .agents/scripts/run-skill-evals.mjs validate --all` pass (chứng minh không ảnh hưởng ngoài phạm vi);
- `git diff --check` sạch; diff không chạm file cp9/app-server.

**Smoke thật (tùy chọn, cần grant riêng):** sau CP1, Owner có thể cấp một lần `prepare` (dispatch 0) và tối đa vài call thật với `--evaluator-model gpt-6.1-sol --evaluator-effort medium` để xác nhận Codex chấp nhận model. Đây cũng là bước preflight của UI-5 CP3; không nằm trong acceptance của correction.

## Rủi ro, điểm dừng, rollback

| Rủi ro | Xử lý |
| --- | --- |
| R1 Một chỗ dựng evaluator invocation còn đọc hằng số mà discovery bỏ sót | Test "invocation dùng đúng model/effort" phủ cả run, resume, retry, `patch-check`, recovery |
| R2 Nới v3 làm validator chấp nhận artifact bị sửa tay | Fingerprint/descriptor hash vẫn bind options; test tamper hiện có phải tiếp tục pass |
| R3 `codex-cli 0.159.3` khác bản đã preflight (`0.149.1`) | Ngoài acceptance của correction (test dùng fake worker); kiểm ở smoke thật / UI-5 CP3 |

Dừng và báo cáo nếu: cần đổi store/retry/reuse; cần đụng cp9/app-server; cần schema mới mà H1 không đủ và Owner chưa xác nhận O3; test hiện có phải sửa kỳ vọng vì lý do khác ngoài "evaluator không còn bị ép default".

Rollback: revert một commit; artifact tạo bởi code cũ không bị ảnh hưởng (G1).

## State — điểm resume

```txt
Spec revision: EVAL-CLI-EVALUATOR-CONFIG-PLAN-1 (Owner chấp nhận 2026-10-01, O2/O3/O4)
Checkpoint: CP1 đang làm
Evidence: run-skill-eval-cli.test.mjs 137/137 pass tại 5a7fa96
Deviation đã chấp nhận: không
Blocker / quyết định mở: không
Bước tiếp: implement CP1 và chạy verification focused/static
Authority hiện tại: commit plan, implement CP1, verification focused/static; không live call, push, PR, merge
```
