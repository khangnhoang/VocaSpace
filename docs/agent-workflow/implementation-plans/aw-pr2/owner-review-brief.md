# AW-PR2 — Bản tóm tắt để owner duyệt

File này tóm tắt và ghi nhận quyết định owner đối với planning contract trong [đặc tả triển khai chi tiết AW-PR2](./plan.md). Owner đã duyệt original six-file contract ngày 2026-07-18, amendment tối thiểu ngày 2026-07-21 và CP2 implementation ngày 2026-07-22; brief không thay thế hoặc âm thầm override plan chi tiết. AW-PR1 đã merge qua PR #56 tại `b134e0842ea3eac5a7bacc064c37570e35e45847`; nội dung dưới đây chỉ dành cho AW-PR2, trước AW-PR3A và AW-PR3B.

## Phạm vi quyết định owner đã duyệt

- Master-program scope của AW-PR2 đã được ghi `approved=yes` trong progress; giá trị đó không duyệt exact per-PR plan này.
- Instruction ngày 2026-07-21 chấp nhận hai Required findings, duyệt seven-file amendment, cho phép sửa owning planning/history sources, sửa root route trong `AGENTS.md` và sửa stale progress evidence.
- Local checkpoint commit được dùng chỉ khi repository gate pass. Push, PR, CI watching, merge, force-push, specialist và remote/production permission không được cấp.
- Nếu owner decision làm đổi material behavior, scope, ownership, permission, acceptance, verification, delivery order hoặc rollback, `plan.md` phải được cập nhật và re-review trước implementation.

## Quyết định lịch sử đã được xác nhận ngày 2026-07-18

1. AW-PR2 sẽ bổ sung preflight vòng đời (`lifecycle preflight`), đánh giá quy mô hai lần, độ sâu kế hoạch linh hoạt, bước tự review tối thiểu cho mọi tập thay đổi, tự review durable plan và đối chiếu thống nhất quyền CI của `AW-P001`.
2. Future implementation chỉ sửa đúng sáu file bên dưới trên branch `feat/agent-workflow-aw-pr2`; planning artifacts không được tính vào scope đó.
3. Planning-only PR phải merge trước; sau đó sync `main`, tạo implementation branch từ updated `main` và revalidate exact plan cùng implementation permission.
4. `inspect-only`, `watch-only`, `create PR only` và `update PR only` không cấp push. Exact combined PR create/update + CI watching cũng không cấp initial push; narrow self-fix chỉ bắt đầu sau existing PR/check và `branch-caused-small-safe` classification. Lần thử thứ ba cần owner cho phép rõ ràng.
5. AW-PR2 không kéo vào AW-PR3A/AW-PR3B, structural refactor, reference split, CI taxonomy change hoặc product/runtime/database/CI workflow change.
6. Nếu read-only implementation preflight phát hiện cần file thứ bảy, đổi file `audit-only` hoặc chạm excluded source, agent phải dừng trước mọi implementation mutation và xin owner duyệt revised plan/scope.

## Amendment sau implementation review — 2026-07-21

- CP1/CP1R và independent review tại local/upstream/remote HEAD `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d` chứng minh root conditional route không bảo đảm typo-only task tải `Universal Lightweight Preflight` trước mutation.
- Kết luận audit-only lịch sử cho `AGENTS.md` bị invalidated. Owner duyệt thêm duy nhất `AGENTS.md` làm behavior file thứ bảy và root chỉ được thêm một route ngắn tới lifecycle; không copy procedure/matrix/command.
- Planning/history amendment documents không thuộc seven-file behavior set, nhưng vẫn phải được tính khi báo cumulative branch changed-file set.
- `AW-P002` sở hữu routing defect mới; `AW-P001` tiếp tục chỉ sở hữu CI permission drift. Dependency order không đổi.

## CP1R2 delivery và CP2 decision — 2026-07-22

- CP1R2 commits `3027959ac68ea9203d6af1594668cb22d6e7c3d9` và `868bf5dde523c26a941b7ba73d59ef08e2ed898b` đã được normal-push tới remote HEAD `868bf5dde523c26a941b7ba73d59ef08e2ed898b` bằng one-time push permission đã được tiêu thụ.
- Owner duyệt implementation CP2 theo exact permission contract đã ghi trong detailed plan và cho conditional local checkpoint commit sau verification/formal review còn 0 Critical/Required.
- CP2 không cấp standing push, PR create/update, CI watching, merge, force-push, specialist, production/destructive hoặc CP3 permission.

## File thuộc historical planning-only PR

- Program sources: `docs/agent-workflow/plan.md`, `docs/agent-workflow/progress.md`, `docs/agent-workflow/problems.md` — route, delivery status và `AW-P001` closure criterion; không đổi problem state.
- Planning package: `docs/agent-workflow/implementation-plans/README.md`, `docs/agent-workflow/implementation-plans/aw-pr2/plan.md`, `docs/agent-workflow/implementation-plans/aw-pr2/owner-review-brief.md` — convention, detailed contract và owner decision surface.
- Historical planning branch không có `docs/agent-loops.md`, `AGENTS.md` hoặc `SKILL.md`; branch đó không implement AW-PR2 behavior.

## Chính xác bảy behavior/tracker files sau amendment

1. `AGENTS.md`
2. `docs/agent-loops.md`
3. `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`
4. `.agents/skills/git-checkpoint-workflow/SKILL.md`
5. `.agents/skills/github-pr-ci-workflow/SKILL.md`
6. `docs/agent-workflow/progress.md`
7. `docs/agent-workflow/problems.md`

Chỉ đối chiếu (`audit-only`) trên implementation branch:

- `.agents/skills/code-review-and-quality/SKILL.md`
- `docs/agent-workflow/plan.md`

Planning/history-only amendment files ngoài behavior set: `docs/agent-workflow/plan.md`, detailed `plan.md` này và `owner-review-brief.md`. Nếu cần behavior file thứ tám, đổi remaining `audit-only` hoặc chạm excluded source, agent phải dừng trước mutation đó và xin owner duyệt lại phạm vi.

## Thứ tự delivery bắt buộc

```text
docs/agent-workflow-aw-pr2-planning
→ planning-only PR merge
→ sync local main với origin/main
→ create feat/agent-workflow-aw-pr2 từ updated main
→ revalidate plan decision và implementation permission
→ implement original six-file scope
→ CP1/CP1R review discovers root-routing gap
→ owner approves seven-file amendment
→ correct planning/history + `AGENTS.md` before CP2
```

Implementation branch chỉ được tạo sau historical planning merge; điều kiện này đã được đáp ứng. Không có behavior implementation nào diễn ra trên historical planning branch.

## Hành vi trước → sau (Behavior before → after)

| Khu vực | Trước AW-PR2 | Sau AW-PR2 |
| --- | --- | --- |
| Nạp ngữ cảnh | Chưa có preflight nhẹ và tracked-program reconciliation rõ | Có preflight tối thiểu; lifecycle route ngắn, planning skill sở hữu detailed read/reconcile procedure |
| Root reachability | Root chỉ nạp lifecycle cho các phase có điều kiện | Mọi repository task nạp lifecycle preflight trước action/depth choice; conditional list chỉ route detailed loops |
| Đánh giá quy mô | Chưa có quy tắc bắt buộc đánh giá hai lần | Đánh giá sơ bộ sau routing và đánh giá cuối trong discovery |
| Độ sâu kế hoạch | Mới có các chế độ lập kế hoạch khái quát | Chọn rõ `micro`, kế hoạch ngắn hoặc durable plan mà không bắt mọi task tạo plan file |
| Rà soát thay đổi | Chưa có mức tối thiểu áp dụng cho toàn lifecycle | Mọi tập thay đổi thực tế đều được kiểm tra tối thiểu về phạm vi, định dạng, secret, trạng thái, kiểm chứng và quyền |
| PR/CI push permission | GH skill hiện có thể hiểu là cho phép initial push của branch đã commit | Create/update-only không push; combined mode cũng không initial-push; chỉ post-failure bounded self-fix mới có normal same-branch push |
| CI attempts | Lần thử thứ ba có thể dựa vào owner hoặc nhận định của agent | Mặc định tối đa 2 completed attempts; lần thứ ba chỉ khi owner cho phép rõ ràng |

## Quyền không được mở rộng

- `inspect-only` và `watch-only`: chỉ đọc/theo dõi/báo cáo; không sửa, commit hoặc push.
- `create PR only`: chỉ khi remote head đã tồn tại; không edit, commit hoặc push; không chấp nhận interactive CLI prompt tự push/fork.
- `update PR only`: chỉ requested metadata/state; không edit local, commit hoặc push.
- Combined PR action + CI watching: không initial-push; chỉ sau existing PR/check và `branch-caused-small-safe` classification mới được kiểm chứng tập trung, focused commit, normal same-branch push rồi re-watch.
- `fix-only`: chỉ exact actions owner nêu; không tự suy ra commit, push, re-watch hoặc merge.
- Mặc định tối đa 2 completed attempts; attempt 3 cần explicit owner permission.
- Merge là permission mode riêng; không force-push, xóa branch, DB/RLS/RPC/migration/production-risk fix, large/risky/unclear fix hoặc đổi CI taxonomy.

## Ranh giới buộc agent dừng và báo owner

Agent phải dừng nếu implementation cần behavior file thứ tám, lấn AW-PR3A/AW-PR3B, cần reference/structural refactor, đổi taxonomy, chạm runtime/product/DB/CI workflow hoặc thiếu exact action permission. Mọi material owner decision mới phải được ghi lại trong brief, cập nhật vào `plan.md` và re-review.

## Quyết định và quyền còn cần

1. CP1R2 correction đã hoàn tất và normal-push; one-time push permission không còn hiệu lực.
2. CP2 có implementation permission và conditional local checkpoint permission; không có push, PR, CI-watch, merge hoặc CP3 permission.

Khi planning-only PR merge, safe interim guidance trong `problems.md` có hiệu lực ngay trong ownership của problem tracker. Điều đó không tự implement lifecycle/skill behavior. Sau khi authorized implementation bắt đầu, `AW-P001` chuyển thành `confirmed/in progress`; amendment này không resolve nó.

Thứ tự đọc đề xuất trong [plan.md](./plan.md): mục 8, 15, 17, 19 và 23–26. Các mục còn lại chủ yếu là đặc tả cho agent và bằng chứng để audit.

## Bản ghi quyết định của owner

Chỉ cập nhật từ explicit owner evidence. Review comment, mức độ tự tin hoặc check pass không tự cấp action.

- Master-program approval: `recorded`
- Per-PR plan decision: `approved; amended 2026-07-21`
- Historical planning delivery: `merged via PR #57`
- Implementation permission: `granted for CP2 under the revised seven-file AW-PR2 contract; CP3 not granted`
- Commit permission: `granted conditionally through existing local checkpoint workflow after zero Critical/Required findings`
- Push permission: `not granted; one-time CP1R2 normal-push permission consumed on 2026-07-21`
- PR permission: `not granted`
- Merge permission: `not granted`
- Specialist/remote permission: `not granted`
- Evidence: `explicit owner instructions dated 2026-07-18, 2026-07-21, and 2026-07-22`
