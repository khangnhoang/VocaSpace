# ASM-PR6 — quyết định của owner

## Trạng thái

**Current owner instruction:** “correction -> review -> pass thì commit -> re canary -> report” duyệt hai correction reporting/verification, một local correction commit nếu review đạt, same-run new revision và đúng re-canary với baseline reuse, tối đa `1 candidate reader + 1 evaluator` new calls tới Codex/OpenAI. Giữ B/control plane/runtime/budget; không full remaining wave hoặc standing retry/correction. Plan đã reconcile exact scope trước skill edit.

**Canary đã dừng tại semantic gate:** `3/66` calls đã dùng, `2 reader + 1 evaluator`, tất cả `succeeded`, retry `0`. Candidate `partially_passed`, comparison `inconclusive`, veto `not_triggered`; main review còn `2 Required` về reference-selection evidence và table-wide constraint/invalid-data verification. Remaining `63` chưa chạy vì condition không đạt; không tự correction/rerun. [Adjudication và phương án correction](./plan.md#cp3-canary-adjudication--2026-09-04) là current evidence; các readiness/grant entries dưới đây là lịch sử.

**Live grant:** owner trả lời “có” cho exact disclosed run `run-d2e1b1d1bcee4334ab28374cf6549b1b`, B/C_eval packages gửi Codex/OpenAI `gpt-5.6-sol / medium`, tối đa `44 readers + 22 evaluators = 66`, concurrency `2`, automatic retry `0`. Canary `3` calls trước; remaining `63` chỉ khi main canary adjudication không còn blocker. Không correction/retry grant hoặc Git/DB/remote mutation authority. Kết quả thực tế được cập nhật ở ledger sau khi command settle; các trạng thái “chưa live grant” bên dưới là lịch sử.

**Current:** CP2 committed `C_eval = 3def69126e8f8775ea17a21e3c3667a67e6c8263`; commit grant đã consumed. B/C_eval run `run-d2e1b1d1bcee4334ab28374cf6549b1b` revision `1` đã prepare/audit, `66` units, dispatch `0`; CLI tests `96/96`. Chờ exact live/egress approval theo [CP3 ledger](./plan.md#cp3-prepare-checkpoint--2026-09-04). Những approval/checkpoint entries tiếp theo là lịch sử; chưa semantic acceptance hoặc quyền remote.

Owner tiếp tục trả lời “duyệt” cho local commit CP2 để chốt `C_eval` trước prepare. Grant này cấp đúng một stage/commit CP2; không cấp live/egress/retry hoặc remote action. Exact ref được ghi sau khi commit thành công; các snapshot permission bên dưới giữ lịch sử trước grant này.

Owner trả lời “có” cho đề nghị local commit CP1 rồi tiếp tục CP2. Đã tạo `C_struct = 871dabcb34ab6125ccb75a6d2f2ced523a748c54`; grant CP1 đã consumed. CP2 implemented/verified, chưa commit. Chưa có `C_eval`, comparative evaluation hoặc final acceptance; commit CP2 và live/remote action vẫn cần quyền riêng. Các snapshot bên dưới giữ evidence trước commit CP1; current status và full ledger ở [CP2 checkpoint](./plan.md#cp2-local-checkpoint--2026-09-04).

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
| PR6 skill implementation | CP1/CP2 committed; CP3 static prepare verified, live chưa chạy |
| Candidate stage/commit | Một correction commit được authorize nếu review đạt; CP1/CP2 grants consumed |
| CLI live/egress/retry/correction calls | Same-run re-canary `1 candidate + 1 evaluator` mới được authorize sau correction commit; không full wave/retry/correction tiếp theo |
| Push/PR/CI/merge/database actions | `not authorized` |
| Final PR6 semantic acceptance | `not assessed` |

Chỉ ghi thay đổi decision có explicit owner evidence; plan approval không tự bao gồm implementation hoặc Git/live actions.
