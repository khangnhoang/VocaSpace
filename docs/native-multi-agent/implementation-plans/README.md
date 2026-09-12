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

- `plan.md` là stable detailed implementation specification cho implementing agent của đúng phase; không sở hữu live lifecycle status.
- `owner-review-brief.md` là owner-facing decision surface, giữ material Owner decisions cùng approval/candidate identity tối thiểu, và không sở hữu live lifecycle status.
- Implementing agent phải đọc cả hai file, master plan và progress owner hiện hành; nếu material decision conflict thì dừng để reconcile.
- Material Owner decision làm đổi scope, behavior, ownership, permission, acceptance, verification hoặc delivery phải được phản ánh vào `plan.md` và re-review trước phần implementation phụ thuộc.

## Current implementation artifacts

| Phase | Detailed plan | Owner review |
| --- | --- | --- |
| Phase 2 — Operable native orchestration foundation | [plan.md](./phase-2/plan.md) | [owner-review-brief.md](./phase-2/owner-review-brief.md) |
| Phase 3 — Master Plan Only lifecycle | [plan.md](./phase-3/plan.md) | [owner-review-brief.md](./phase-3/owner-review-brief.md) |
| Phase 4 — Multi-Agent E2E lifecycle | [plan.md](./phase-4/plan.md) | [owner-review-brief.md](./phase-4/owner-review-brief.md) |

Không tạo empty hoặc retrospective phase folder chỉ để hoàn chỉnh taxonomy. Chỉ thêm entry khi phase có current implementation consumer.

## Source-of-truth routing

- [`docs/native-multi-agent/plan.md`](../plan.md) sở hữu approved GOAL, semantic architecture, workstream decomposition, dependency order và phase gates.
- [`docs/native-multi-agent/progress.md`](../progress.md) sở hữu concise current truth cùng stable implementation, verification và delivery evidence của native multi-agent feature; không phải dispatch/review journal.
- Mỗi phase `plan.md` sở hữu stable detailed execution contract của đúng phase, không sở hữu current role/session/review state.
- Mỗi `owner-review-brief.md` giữ material Owner decisions, approval identity và candidate/source identity cần để diễn giải approval; không giữ live lifecycle state.

README này chỉ sở hữu layout, reader routing và current artifact index. Nó không sở hữu master scope, current progress, detailed implementation behavior hoặc action permission.
