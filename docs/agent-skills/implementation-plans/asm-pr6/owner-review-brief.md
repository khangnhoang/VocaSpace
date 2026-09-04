# ASM-PR6 — quyết định của owner

## Trạng thái

Owner trả lời “có” cho đề nghị local commit CP1 rồi tiếp tục CP2. Grant này chỉ cấp một local stage/commit `C_struct`; không cấp commit CP2 hoặc live/remote action. Snapshot bên dưới mô tả checkpoint trước khi nhận grant; kết quả commit sẽ được record sau khi Git trả về exact ref.

`approved for local implementation`, ngày `2026-09-04`, theo exact owner instruction “thực hiện detail plan asm pr6”. [Detailed plan](./plan.md) là exact implementation contract; brief này không thay plan. CP0 hoàn tất, CP1 structural implementation verified/chưa commit; CP2 chờ immutable `C_struct`. Comparative evaluation và final acceptance chưa thực hiện.

Lượt planning trước chỉ cho phép fetch remote, sync `main`, tạo nhánh ASM-PR6 và lập plan/reconcile handoff; instruction hiện tại đã supersede planning-only boundary bằng local implementation. Nhánh `refactor/agent-skills-asm-pr6-supabase`, base `2be02df11e279b5c88f37d2fd609069a54c235ed` (PR #81). Chưa có stage/commit/push/PR/CI/merge hoặc live/model/database authority.

## Gói quyết định đã duyệt

1. Giữ roadmap scope/order/invariants và ba references; baseline B trên main mới, dùng suite/ADR corrected tại `35cc5a1`, không dùng pilot làm accepted baseline. B pin provenance: đối chiếu suite/context với Git blobs sau chuẩn hóa duy nhất CRLF/LF; CP0 riêng freeze SHA-256/byte count của raw working-tree bytes cho đủ 23 files. Mọi prepare phải khớp exact snapshot CP0 và generated manifests; normalized-EOL equality không thay exact-byte equality giữa revisions.
2. CP1 structural move nguyên văn → CP2 semantic requirement tổng quát riêng cho ordered soft-delete backfill/restore → CP3 final B/C_eval comparison → CP4 main review/owner acceptance/final program reconciliation. Không chạy một full model pass riêng trên intermediate structural-only candidate.
3. Freeze toàn bộ 22 cases; CLI comparison `44 readers + 22 evaluators = 66`, canary `3` nằm trong số đó. Model `gpt-5.6-sol / medium`, concurrency/cap `2`, lifetime `max_attempts=2`, retry tự động `0`. Proposed counts không cấp live grant; exact package egress/run/commands cần approval riêng sau prepare.
4. Same-run exact reuse, correction qua new revision; bundle edit có thể cần thêm `22 candidate readers + 22 evaluators = 44`. Không có standing correction/retry grant, không nâng budget hay rerun để lấy pass. Full-current final report và manual adjudication của mọi protected criterion/veto là bắt buộc.
5. CLI report advisory-only; owner acceptance bind final candidate/report/evidence scope riêng. Không thêm human writer, selective resource loader, App Server/CP9 hoặc context-reduction requirement.

Các assumption đã stale và exact command templates nằm trong plan. Semantic addition là planned scope từ handoff, không chứng minh root cause của mọi pilot omission. Nếu owner đổi checkpoint order, baseline, scope, runtime, budget, correction hoặc acceptance thì cập nhật plan và re-review trước implementation.

## Evidence hiện có và khoảng trống

- Stage 4 merged; corrected tooling pilot/reuse/affected rerun đã có evidence trên main. Latest proposal còn `partially_satisfied / triggered`; raw hashes kiểm tra lại khớp handoff.
- Fresh planning validation: target `22` cases, catalog `187`, structural `11/0/0`; B/B prepare rehearsal `66` units, dispatch `0`.
- Pinning review xác nhận `1 Required`: `core.autocrlf=true`, `23/23` raw files khác B nhưng toàn bộ chỉ khác CRLF/LF. Read-only inspection của rehearsal xác nhận `23/23` control-plane hashes và `144` context copies/manifest entries khớp actual bytes; packaging success không chứng minh raw equality với Git blob. Đã sửa contract hai lớp và claim verification theo exact user instruction “verify trước, đúng thì correction”; bounded re-review còn `0 Critical / 0 Required`.
- CP0 raw-byte snapshot đã freeze đủ `23` files, SHA-256 `3b5caa7fe5b40beb3fb728759357052f4a0280e003e9b269d387aeae804294a1`; location và continuation contract ở [CP0–CP1 ledger](./plan.md#cp0cp1-local-checkpoint--2026-09-04). CP1 core + ba references đã verified, bảo toàn `234` content lines ngoài heading/fence; main review `0 Critical / 0 Required`. Chưa có immutable candidate commit, comparative observation, fresh-reader run mới hoặc migration acceptance. Snapshot/evidence là transient; mất hoặc drift thì phải dừng.

## Decision record

| Quyết định/quyền | Trạng thái |
| --- | --- |
| Program structure/order/invariants | Owner-approved roadmap; giữ nguyên |
| PR6 detailed plan/material procedure | `approved` theo instruction triển khai ngày `2026-09-04` |
| PR6 skill implementation | `authorized` theo exact plan; CP1 verified, CP2 chờ `C_struct` |
| Candidate stage/commit | CP1 `authorized`, một local commit; CP2 chưa được cấp |
| CLI live/egress/retry/correction calls | `not authorized` |
| Push/PR/CI/merge/database actions | `not authorized` |
| Final PR6 semantic acceptance | `not assessed` |

Chỉ ghi thay đổi decision có explicit owner evidence; plan approval không tự bao gồm implementation hoặc Git/live actions.
