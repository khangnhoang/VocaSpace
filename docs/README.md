# Documentation index

This index records what each top-level item under `docs/` is for today. Document shape, templates and State placement for program docs are owned by `.agents/skills/repo-docs-system/SKILL.md`; lifecycle routing is owned by [agent-loops.md](./agent-loops.md).

## Folders

| Path | Purpose |
| --- | --- |
| `programs/<program>/` | Program home for every program, refactor or feature: `plan.md` (master), `progress.md`, `problems.md`, `implementation-plans/<unit>/plan.md`, optional `future-features.md` and `sources/` |
| `backlog/` | Future features and problems that no open program owns. It is not a program |
| `refactors/` | Redirect files only, for the three paths that published migrations cite. Each points to the moved file under `programs/` |
| `adr/` | Architecture decision records, indexed in [adr/README.md](./adr/README.md) |
| `sop/` | Repeatable operating procedures (local development, release gate, smoke E2E) |
| `case-studies/` | Written-up evaluations and retrospectives |
| `assets/` | Screenshots and images embedded in repository documentation |
| `data_flow/` | Data-flow diagrams (HTML) |
| `ui-design-system-and-review/` | UI design system, accepted designs and UI review program |
| `agent-skills/`, `agent-workflow/`, `native-multi-agent/` | Agent-governance programs (plans, progress, problems) |
| `agent-loops.md` | Common lifecycle, review timing and waiting. The review skill owns the self-review method. |
| `agent-self-review-plan.md` | Plan for the self-review methodology (a program doc at the top level) |

## Programs

One row per program: a folder under `docs/` that contains a `progress.md`. Lifecycle is `active`, `closed` or `legacy`. Current status is read from each program's `progress.md` State, not from this table. Update the row when the lifecycle changes.

| Path | Lifecycle |
| --- | --- |
| `programs/admin-console` | active |
| `programs/agent-rules` | active |
| `programs/auth-onboarding` | active |
| `programs/doc-system-optimization` | closed |
| `programs/student-user-flow-route` | active |
| `programs/teacher-workflow` | closed |
| `agent-skills` | closed |
| `agent-workflow` | closed |
| `native-multi-agent` | closed |
| `ui-design-system-and-review` | closed |

## Decisions

- Program home is `docs/programs/<program>/` for every program (2026-10-05). `docs/refactors/` keeps redirect files for the paths that published migrations cite.
- New and migrated program docs use the templates in `.agents/skills/repo-docs-system/references/templates/`.

## Not moved

Candidates only; each move needs its links fixed and a link check.

- `data_flow/`.
- Top-level `agent-self-review-plan.md`.

Keep `agent-loops.md` at its shared import path. Historical self-review and managed-workflow plans describe retired contracts; active instructions live in AGENTS.md, the lifecycle and current skills.
