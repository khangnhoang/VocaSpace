# Adaptive Workflow Implementation Plans

This directory contains per-PR implementation artifacts for the adaptive agent workflow.

## Layout

```text
implementation-plans/
├── README.md
└── <aw-pr-id>/
    ├── plan.md
    └── owner-review-brief.md
```

- `plan.md` is the detailed implementation specification for the implementing agent.
- `owner-review-brief.md` is the owner-facing decision surface and decision record.
- An implementation agent must read both files when they exist, reconcile their material decisions, and stop if they conflict.
- The owner brief summarizes decisions; it must not silently redefine the detailed specification. A material owner decision that changes scope, behavior, ownership, permission, acceptance criteria, verification, delivery order, or rollback must be reflected in `plan.md` and re-reviewed before implementation.
- An agent-authored brief remains `pending` until explicit owner evidence is recorded. `pending` grants no implementation permission.
- Implementation, commit, push, PR, merge, specialist, and remote permissions remain separate.

## Current PR artifacts

| PR | Detailed plan | Owner review |
| --- | --- | --- |
| AW-PR1 | No retroactive per-PR artifact | No retroactive brief; use the program master plan, progress tracker, Git history, and PR evidence |
| AW-PR2 | [plan.md](./aw-pr2/plan.md) | [owner-review-brief.md](./aw-pr2/owner-review-brief.md) |
| AW-PR3A | [plan.md](./aw-pr3a/plan.md) | [owner-review-brief.md](./aw-pr3a/owner-review-brief.md) |
| AW-PR3B | [plan.md](./aw-pr3b/plan.md) | [owner-review-brief.md](./aw-pr3b/owner-review-brief.md) |

Do not create an empty or retrospective PR folder merely to make the directory taxonomy look complete. Add a folder when a real per-PR plan or owner decision surface has a current consumer.

Program ownership remains unchanged:

- [`../plan.md`](../plan.md) owns intended program scope and dependency.
- [`../progress.md`](../progress.md) owns current planning, implementation, and delivery status.
- [`../problems.md`](../problems.md) owns confirmed problem records and resolution evidence.
- Each per-PR `plan.md` owns detailed execution scope for that PR.
- Each `owner-review-brief.md` exposes the decisions the owner needs to confirm and records only decisions backed by explicit owner evidence.

This README owns only the artifact layout and reader-routing convention. It does not own program scope, current delivery status, problem state, detailed planning procedure, or implementation permission. The planning skill owns the generic procedure for detecting a tracked program, loading and reconciling its program/per-PR sources, and stopping on material conflict; lifecycle documentation should only route to that procedure.
