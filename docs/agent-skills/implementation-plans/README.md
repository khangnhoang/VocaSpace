# Agent Skills Implementation Plans

Thư mục này chứa implementation artifact theo từng agent-skills workstream có current consumer.

## Layout

```text
implementation-plans/
├── README.md
└── <workstream-id>/
    ├── plan.md
    ├── owner-review-brief.md
    └── stage-<n>-<slug>.md       # optional transferable stage contract
```

- `plan.md` là detailed implementation specification cho implementing agent.
- `owner-review-brief.md` là owner-facing decision surface và decision record.
- `stage-<n>-<slug>.md` chỉ dùng khi một approved multi-stage master plan cần exact implementation handoff riêng cho stage hiện hành; file này không thay master scope/order hoặc owner decision surface.
- Implementing agent phải đọc `plan.md`, `owner-review-brief.md` và stage contract hiện hành khi file đó tồn tại; reconcile material decision và dừng nếu chúng conflict.
- Owner brief chỉ tóm tắt plan. Mọi material owner decision làm đổi scope, behavior, ownership, permission, acceptance criteria, checkpoint order, verification, delivery hoặc rollback phải được phản ánh vào `plan.md` và re-review trước implementation.
- Agent-authored brief giữ `pending` cho tới khi có explicit owner evidence. `pending` không cấp implementation permission.
- Plan decision, implementation, stage/commit, push, PR, CI watch/fix, merge, deployment và các remote permission là các gate riêng.

## Current implementation artifacts

| Workstream | Detailed plan | Owner review |
| --- | --- | --- |
| ASM-PR1 | [plan.md](./asm-pr1/plan.md) | [owner-review-brief.md](./asm-pr1/owner-review-brief.md) |
| ASM-PR2A | [plan.md](./asm-pr2a/plan.md) | [owner-review-brief.md](./asm-pr2a/owner-review-brief.md) |
| ASM-PR2B | [plan.md](./asm-pr2b/plan.md) | [owner-review-brief.md](./asm-pr2b/owner-review-brief.md) |
| ASM-PR2C | [plan.md](./asm-pr2c/plan.md) | [owner-review-brief.md](./asm-pr2c/owner-review-brief.md) |
| ASM-PR3 | [plan.md](./asm-pr3/plan.md) | [owner-review-brief.md](./asm-pr3/owner-review-brief.md) |
| ASM-PR4 | [plan.md](./asm-pr4/plan.md) | [owner-review-brief.md](./asm-pr4/owner-review-brief.md) |
| ASM-PR5A | [plan.md](./asm-pr5a/plan.md) | [owner-review-brief.md](./asm-pr5a/owner-review-brief.md) |
| ASM-PR5B | [plan.md](./asm-pr5b/plan.md) | [owner-review-brief.md](./asm-pr5b/owner-review-brief.md) |
| Eval Harness Hardening | [plan.md](./eval-harness-hardening/plan.md) | [owner-review-brief.md](./eval-harness-hardening/owner-review-brief.md) |
| Eval Harness CLI-first | [plan.md](./eval-harness-cli-first/plan.md); [Stage 1](./eval-harness-cli-first/stage-1-cli-runner.md) | [owner-review-brief.md](./eval-harness-cli-first/owner-review-brief.md) |

Không tạo empty hoặc retrospective folder chỉ để hoàn chỉnh taxonomy. Chỉ thêm entry khi workstream plan hoặc owner decision surface có current consumer.

## Source-of-truth routing

- [`../structural-migration-roadmap.md`](../structural-migration-roadmap.md) sở hữu approved ASM program scope, order, candidates, exclusions và high-level completion boundaries.
- [`../progress.md`](../progress.md) sở hữu current planning, implementation và delivery status.
- Mỗi workstream `plan.md` sở hữu detailed implementation specification của đúng workstream đó.
- Mỗi `owner-review-brief.md` tóm tắt material owner decisions và chỉ record decision có explicit owner evidence.

README này chỉ sở hữu layout, reader routing, current artifact index và distinction giữa detailed plan với owner brief. Nó không sở hữu roadmap, current progress, generic planning procedure hoặc implementation authority.
