# Native Multi-Agent Implementation Plans

Thư mục này chứa implementation artifact theo từng phase có current consumer của chương trình native multi-agent.

## Layout

```text
implementation-plans/
├── README.md
└── phase-<n>/
    ├── plan.md
    └── owner-review-brief.md
```

- `plan.md` là detailed implementation specification cho implementing agent của đúng phase.
- `owner-review-brief.md` là owner-facing decision surface và chỉ record quyết định có explicit Owner evidence.
- Implementing agent phải đọc cả hai file, master plan và progress owner hiện hành; nếu material decision conflict thì dừng để reconcile.
- Material Owner decision làm đổi scope, behavior, ownership, permission, acceptance, verification hoặc delivery phải được phản ánh vào `plan.md` và re-review trước phần implementation phụ thuộc.

## Current implementation artifacts

| Phase | Detailed plan | Owner review |
| --- | --- | --- |
| Phase 2 — Operable native orchestration foundation | [plan.md](./phase-2/plan.md) | [owner-review-brief.md](./phase-2/owner-review-brief.md) |

Không tạo empty hoặc retrospective phase folder chỉ để hoàn chỉnh taxonomy. Chỉ thêm entry khi phase có current implementation consumer.

## Source-of-truth routing

- [`docs/native-multi-agent/plan.md`](../plan.md) sở hữu approved GOAL, semantic architecture, workstream decomposition, dependency order và phase gates.
- [`docs/native-multi-agent/progress.md`](../progress.md) sở hữu current planning, implementation, verification và delivery evidence của native multi-agent feature.
- Mỗi phase `plan.md` sở hữu detailed execution contract của đúng phase.
- Mỗi `owner-review-brief.md` tóm tắt material decisions và chỉ record decision có explicit Owner evidence.

README này chỉ sở hữu layout, reader routing và current artifact index. Nó không sở hữu master scope, current progress, detailed implementation behavior hoặc action permission.
