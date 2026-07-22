# Adaptive Agent Workflow — Problems

## Ownership và trạng thái

File này sở hữu các vấn đề đã được xác nhận của chương trình adaptive workflow, cách xử lý an toàn tạm thời, PR dự kiến xử lý và bằng chứng đóng vấn đề.

- [plan.md](./plan.md) sở hữu master-program intended scope và dependency; per-PR plan decision thuộc owner review record tương ứng.
- [progress.md](./progress.md) sở hữu current planning, implementation và delivery status.
- Problem record không tự authorize implementation, commit, push, PR, merge hoặc remote action.
- Cách xử lý an toàn tạm thời không thay thế permission source; khi các source còn drift, agent phải dùng rule cụ thể hơn hoặc hạn chế hơn và báo conflict.
- Khi một correction của phần “Cách xử lý an toàn tạm thời” được merge, nó trở thành hướng dẫn authoritative trong ownership của problem tracker ngay lập tức; nó không tự sửa lifecycle/skill procedure, không tự cấp action permission và không tự resolve problem.
- Chỉ đánh dấu `resolved` khi affected sources và verification evidence hiện hành đã khớp; plan-only scheduling không phải resolution.

File này theo dõi hai trục trạng thái riêng:

- **Trạng thái vấn đề:**
  - `confirmed`: repository evidence xác nhận problem còn tồn tại;
  - `resolved`: affected source contracts đã reconcile và verification tương ứng đã pass.
- **Trạng thái xử lý:**
  - `scheduled`: owner đã chọn target PR nhưng implementation chưa bắt đầu;
  - `in progress`: implementation đã bắt đầu với permission hợp lệ;
  - `completed`: correction và verification cần thiết đã hoàn tất;
  - `deferred`: owner đã chủ động hoãn và ghi điều kiện mở lại;
  - `blocked`: thiếu decision, permission hoặc external state cần thiết.

`completed` ở trục xử lý chỉ đi cùng `resolved` ở trục vấn đề khi affected sources và evidence hiện hành thỏa tiêu chí đóng; hoàn thành một phần implementation không đủ để đóng problem.

## AW-P001 — CI observation/watch/self-fix permission drift

| Trường | Giá trị |
| --- | --- |
| Trạng thái vấn đề | `resolved` |
| Trạng thái xử lý | `completed` |
| PR dự kiến xử lý | `AW-PR2` |
| Rủi ro | Permission drift có thể làm agent sửa, commit hoặc push từ instruction hẹp hơn ý owner |
| Nguồn bị ảnh hưởng | [AGENTS.md](../../AGENTS.md), [docs/agent-loops.md](../agent-loops.md), [git-checkpoint-workflow](../../.agents/skills/git-checkpoint-workflow/SKILL.md), [github-pr-ci-workflow](../../.agents/skills/github-pr-ci-workflow/SKILL.md) |
| Ảnh hưởng dependency | Không đổi `AW-PR1 → AW-PR2 → AW-PR3A → AW-PR3B` |

### Bằng chứng xác nhận và lịch sử xử lý

- AW-PR2 implementation đã bắt đầu với owner permission trên branch `feat/agent-workflow-aw-pr2` từ synchronized baseline `b10be2654d1a1c2291f1483e82ade3d0404cc151`; problem giữ `confirmed/in progress` cho tới khi CP3 hoàn tất four-source và cumulative seven-file closure audit.
- CP2 đã reconcile lifecycle, Git checkpoint skill và GitHub PR/CI skill như một logical contract. Behavior commit `95d6fb468a3017077917536708aeecc7385f182a` và delivery-record commit `218a9d8cf5ebd90c44d1ee2af6271d16ca840639` đã được normal-push tới remote HEAD `218a9d8cf5ebd90c44d1ee2af6271d16ca840639`; one-time push permission đã được tiêu thụ.
- Historical CP3 instruction chỉ cấp integration/closure audit và supporting record corrections; CP3 closure `17960fd8f3c36a44c540b78f05a3c22640440fa1` cùng record `901b3f3f27dca7171eef20d52df67fc95305da04` sau đó đã normal-push tới remote HEAD `901b3f3f27dca7171eef20d52df67fc95305da04` bằng exact owner permission.
- Instruction hiện tại cấp final cumulative audit, in-scope correction, local checkpoint, normal push, create/update PR và CI watching với exact bounded self-fix loop; nó vẫn không cấp merge/auto-merge, force-push, branch deletion, specialist, AW-PR3A/AW-PR3B hoặc excluded/production/DB/remote-environment scope.
- Trước CP2, `docs/agent-loops.md` trigger dùng “inspect or handle”, nhưng mode nói default inspection có local fix.
- Trước CP2, lifecycle cho remote correction khi task kích hoạt CI watching hoặc CI fixing.
- `AGENTS.md` và `github-pr-ci-workflow` giới hạn bounded no-commit/no-push exception vào owner request có PR creation/update plus CI watching.
- Trước CP2, `github-pr-ci-workflow` đồng thời nói create/update PR có thể normal-push một already-committed clean branch; wording này rộng hơn root/Git default và có thể biến PR-only request thành push permission.
- Trước CP2, `git-checkpoint-workflow` sở hữu commit và local/remote action boundary nhưng ghi tuyệt đối rằng commit và push đều cần owner yêu cầu hoặc phê duyệt, không tự trỏ tới bounded exception do `github-pr-ci-workflow` sở hữu.
- Trước CP2, lifecycle giới hạn 1–2 completed fix attempts; skill cho attempt thứ ba khi owner cho phép hoặc agent tự đánh giá next fix cực rõ và ít rủi ro.

### Cách xử lý an toàn tạm thời — historical

Các rule dưới đây là safe interim contract trong thời gian sources còn drift. Sau CP3, final behavior owners đã reconcile cùng semantics này; phần này được giữ làm lịch sử và không phải một procedure owner song song.

- Inspect-only là read-only: đọc state/log và report, không sửa file.
- Watch-only không tự cấp permission sửa, commit hoặc push.
- Create PR only và update PR only không tự cấp push. Create chỉ tiếp tục khi remote head đã tồn tại; update chỉ thực hiện requested metadata/state. Nếu cần push branch/commit hoặc interactive CLI đề nghị push/fork, dừng và xin explicit push permission.
- PR creation/update plus CI watching không tự cấp initial push. Nếu remote head chưa tồn tại, dừng và xin explicit push permission; khi remote head đã có, agent có thể thực hiện exact PR action và watch được yêu cầu, nhưng bounded normal-push exception chỉ bắt đầu sau khi PR/check tồn tại, failed logs đã được đọc và failure được phân loại `branch-caused-small-safe`.
- Explicit CI-fix instruction ngoài mode trên chỉ cấp đúng action owner nói; không tự suy ra commit hoặc push.
- Dùng tối đa 2 completed fix attempts cho tới khi contracts được reconcile.
- Không merge, force-push, delete branch, sửa DB/RLS/migration/production state hoặc tự xử lý large/risky/unclear failure.

### Tiêu chí đóng vấn đề trong AW-PR2

Scope và acceptance criteria trong [plan.md](./plan.md) là implementation contract authoritative. Các điểm dưới đây chỉ là problem-specific closure criteria:

- `docs/agent-loops.md` sở hữu lifecycle trigger, permission mode và stop rule ở mức khái quát.
- `git-checkpoint-workflow` giữ default owner-approved commit/push contract và thừa nhận rõ narrow exception thuộc `github-pr-ci-workflow`, không duplicate PR/CI procedure.
- `github-pr-ci-workflow` sở hữu command procedure, failure classification, exact self-fix cycle và normal push conditions.
- `AGENTS.md` chỉ giữ routing/invariant ngắn, không duplicate procedure.
- Inspect-only, watch-only, create PR only, update PR only, create/update plus watch và explicit fix-only phải có behavior không mơ hồ.
- Combined create/update plus watch không cấp initial push; self-fix push chỉ hợp lệ sau khi PR/check tồn tại và failure được phân loại `branch-caused-small-safe`.
- Default maximum là 2 completed fix attempts; attempt thứ ba chỉ khi owner cho phép rõ ràng.
- Không thay CI classification, GitHub Actions workflow, auto-merge, force-push hoặc domain-risk stop boundary.
- Sau CP2 local verification, CP3 phải revalidate cumulative seven-file integration, current tracker evidence và không có competing final rule trước khi chuyển problem sang `resolved/completed`.

### Kiểm tra trước khi đánh dấu resolved

- Targeted text audit không còn permission hoặc attempt-limit conflict giữa bốn affected sources.
- Scenario review bao phủ inspect-only, watch-only, create/update plus watch, explicit fix-only, attempt 2/3 và remote action.
- Skill validation, Markdown/link/encoding checks và relevant fresh-reader/evidence procedure chạy theo repository contract.
- Resolution evidence được ghi vào `progress.md` khi file đó có concrete implementation consumer; CP2 local evidence là prerequisite, không thay thế CP3 cumulative closure gate.

### Bằng chứng CP2 cục bộ — 2026-07-22

- Lifecycle hiện chỉ sở hữu high-level permission modes, routing và stop behavior; Git checkpoint skill giữ default explicit commit/push contract cùng cross-reference hẹp; GitHub PR/CI skill sở hữu exact mode procedure, seven-value taxonomy, bounded cycle, attempt definition và normal-push conditions.
- Inspect/watch/create/update/combined/fix-only/commit-only/push-only, initial-push, interactive push/fork, attempts 1/2/3 và non-small-safe stop scenarios đều pass qua static contract audit.
- Repository skill validator `valid` với 0 errors; Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, exact worktree/cumulative scope và Git-state audits pass.
- Formal re-review còn 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`). Fresh-reader là `not_run` vì task cấm specialist/sub-agent; self-review không được trình bày như fresh-reader evidence.
- `AW-P001` vẫn `confirmed/in progress` vì CP3 cumulative seven-file integration/closure evidence chưa được phép và chưa thực hiện. CP2 local verification không tự đóng toàn bộ AW-PR2 hoặc cấp Git/remote permission.

### Bằng chứng đóng CP3 — 2026-07-22

- Preflight xác nhận local HEAD, upstream và read-only remote HEAD cùng là `218a9d8cf5ebd90c44d1ee2af6271d16ca840639`; working tree sạch, ahead/behind `0/0`; merge-base vẫn là synchronized implementation baseline `b10be2654d1a1c2291f1483e82ade3d0404cc151`.
- Cumulative Git accounting có đúng bảy behavior/tracker files và ba planning/history amendment files; không có behavior file thứ tám, reference split, rename/move, product/runtime/test/DB/GitHub Actions hoặc AW-PR3A/AW-PR3B scope.
- Root/lifecycle/planning/Git/GitHub contracts pass toàn bộ lifecycle, tracked-program, sizing, adaptive-depth, universal-review, permission-mode, attempt-limit, initial-push, interactive push/fork và non-small-safe stop scenarios. Exact seven-value taxonomy không đổi từ implementation baseline.
- Repository skill validator `valid` với 0 errors; Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, source-ownership/non-duplication và Git-state audits pass.
- Formal cumulative review còn 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`). Fresh-reader là `not_run` vì current instruction cấm specialist/sub-agent; self-review không được dùng thay independent evidence.
- Closure evidence đáp ứng các tiêu chí phía trên, vì vậy `AW-P001` chuyển `confirmed/in progress` → `resolved/completed`. Việc đóng problem không cấp push, PR, CI-watch, merge hoặc remote permission.
- CP3 delivery evidence sau closure: commits `17960fd8f3c36a44c540b78f05a3c22640440fa1` và `901b3f3f27dca7171eef20d52df67fc95305da04` đã normal-push; việc delivery không thay closure state hoặc tự cấp merge.

## AW-P002 — Universal preflight root-routing gap

| Trường | Giá trị |
| --- | --- |
| Trạng thái vấn đề | `resolved` |
| Trạng thái xử lý | `completed` |
| PR dự kiến xử lý | `AW-PR2 CP1R2` |
| Rủi ro | Task nhỏ có thể tuân thủ root instructions nhưng không tải universal lifecycle preflight trước mutation hoặc discovery-depth choice |
| Nguồn bị ảnh hưởng | [AGENTS.md](../../AGENTS.md), [docs/agent-loops.md](../agent-loops.md) |
| Source ownership | `AGENTS.md` sở hữu explicit root route; lifecycle sở hữu preflight invariant/procedure và detailed-loop triggers |
| Ảnh hưởng dependency | Không đổi `AW-PR1 → AW-PR2 → AW-PR3A → AW-PR3B` |

### Lịch sử phát hiện và quyết định

- Original per-PR decision ngày 2026-07-18 giới hạn behavior/tracker scope vào sáu file và phân loại `AGENTS.md` là `audit-only`.
- CP1/CP1R thêm `Universal Lightweight Preflight` vào lifecycle và sửa planning gate. Hai checkpoint được committed/pushed; review baseline local/upstream/remote là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.
- Independent review sau CP1/CP1R xác nhận root chỉ yêu cầu đọc lifecycle cho planning không tầm thường, checkpoint, review hoặc CI. Một typo-only task không được bảo đảm tải lifecycle trước mutation; việc có thể đọc lifecycle ở checkpoint cuối không thỏa preflight-before-action contract.
- Finding làm invalid assumption audit-only cho `AGENTS.md`. Review dừng trước mutation và ghi problem ở trạng thái `confirmed/blocked` trong checkpoint report.
- Ngày 2026-07-21, owner chấp nhận finding và duyệt amendment tối thiểu: thêm duy nhất `AGENTS.md` làm behavior file thứ bảy, cho phép planning/history reconciliation và root-routing correction. Handling state chuyển sang `in progress`.
- Amendment không đổi `AW-P001`, không mở CP2, AW-PR3A/AW-PR3B, structural/reference scope hoặc Git/remote permission.

### Cách xử lý an toàn tạm thời

- Cho tới khi root correction tồn tại trên baseline đang dùng, agent phải chủ động tải `docs/agent-loops.md` và áp dụng `Universal Lightweight Preflight` trước mọi repository task, kể cả typo-only change.
- Safe interim này chỉ thu hẹp behavior để bảo toàn approved lifecycle invariant; nó không tự cấp implementation, commit, push, PR, CI-watch, merge, specialist hoặc remote permission.
- Không copy preflight procedure vào root để vá reachability. Root chỉ route; lifecycle và planning skill giữ ownership hiện có.

### Tiêu chí đóng vấn đề trong AW-PR2

- `AGENTS.md` yêu cầu mọi repository task tải `docs/agent-loops.md` và áp dụng `Universal Lightweight Preflight` trước action hoặc discovery-depth choice.
- Existing conditional list chỉ route việc tiếp tục vào detailed planning, checkpoint, review hoặc CI loops sau preflight.
- Root wording ngắn và không duplicate preflight steps, planning matrix, CI mode/cycle hoặc command-level procedure.
- Typo-only scenario đi từ root tới lifecycle trước mutation, sau đó có thể chọn micro-flow và bỏ qua unrelated master/progress/domain context.
- Historical six-file decision, current seven-file behavior set, amendment/history files và actual cumulative Git changed-file set được phân biệt rõ.

### Kiểm tra trước khi đánh dấu resolved

- Repository skill validator pass; Markdown heading/fence/link/table và UTF-8/EOL/final-newline/trailing-whitespace checks pass.
- Targeted root-to-lifecycle typo scenario, universal-preflight route, same-instruction implementation/permission separation và ownership non-duplication review pass.
- `git diff --check`, conflict/zero-width/secret/scope audits và staged/unstaged/untracked/branch/upstream evidence pass.
- `progress.md` ghi actual remote/local history, correction status, verification và delivery permission đúng evidence.
- Formal self-review còn 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`). Fresh-reader được chạy đúng contract hoặc ghi `not_run` với giới hạn evidence thực tế.

### Bằng chứng đóng local checkpoint

- Root-to-lifecycle typo-only scenario, universal-preflight ordering, conditional detailed-loop route và same-instruction permission separation đều pass.
- Repository skill validator trả `valid` cho 11 skills với 0 errors; ba `CORE_LENGTH_SIGNAL` warnings là non-blocking và không cho phép structural refactor trong AW-PR2.
- Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, exact scope và Git-state audits đều pass.
- Formal self-review/re-review còn 0 Nghiêm trọng (`Critical`), 0 Bắt buộc (`Required`) và 0 Đề xuất (`Suggestion`).
- Fresh-reader: `not_run` vì task cấm specialist/sub-agent và reviewer hiện tại đã nhận suspected finding/expected behavior; self-review không được trình bày như fresh-reader evidence.
- Trạng thái `resolved/completed` ở đây ban đầu mô tả local corrected/verified source state. Sau đó owner cấp một lần normal-push riêng cho CP1R2; commits `3027959ac68ea9203d6af1594668cb22d6e7c3d9` và `868bf5dde523c26a941b7ba73d59ef08e2ed898b` đã được đẩy tới remote HEAD `868bf5dde523c26a941b7ba73d59ef08e2ed898b`. Permission đó đã được tiêu thụ và không tạo standing remote permission.
