# Documentation index

This index records what each top-level item under `docs/` is for today. Document shape, templates and State placement for program docs are owned by `.agents/skills/repo-docs-system/SKILL.md`; lifecycle routing is owned by [agent-loops.md](./agent-loops.md).

## Folders

| Path | Purpose |
| --- | --- |
| `refactors/<program>/` | Program home: `plan.md` (master), `progress.md`, `problems.md`, `implementation-plans/<unit>/plan.md`, optional `future-features.md` and `sources/`. Stays here because published migrations cite paths under it |
| `adr/` | Architecture decision records |
| `sop/` | Repeatable operating procedures (local development, release gate, smoke E2E) |
| `case-studies/` | Written-up evaluations and retrospectives |
| `data_flow/` | Data-flow diagrams (HTML) |
| `ui-design-system-and-review/` | UI design system, accepted designs and UI review program |
| `agent-skills/`, `agent-workflow/`, `native-multi-agent/` | Agent-governance programs (plans, progress, problems) |
| `agent-loops.md`, `agent-self-review.md` | Agent lifecycle routing and shared self-review methodology. Cited by `AGENTS.md`, skills, `.claude/` and `.codex/`; they stay at these paths |
| `agent-self-review-plan.md` | Plan for the self-review methodology (a program doc at the top level) |

## Decision for PR1 (2026-10-03)

- Program home stays `docs/refactors/<program>/`. PR1 moves no file under `docs/`.
- New and migrated program docs use the templates in `.agents/skills/repo-docs-system/references/templates/`.

## Deferred to PR2

Candidates only; each move needs its links fixed and a link check.

- `adr/refactor-teacher-workflow-plan.md`, `adr/refactor-teacher-workflow-problems.md` and `adr/refactor-teacher-workflow-progress.md` are a plan, problems and progress, not ADRs.
- `data_flow/`.
- Agent-program folders `agent-skills/`, `agent-workflow/`, `native-multi-agent/`.
- Top-level `agent-self-review-plan.md`.
- Migration of `refactors/student-user-flow-route/` and other live or legacy programs.

Do not move `agent-loops.md` or `agent-self-review.md`.
