# Documentation index

This index records what each top-level item under `docs/` is for today. Document shape, templates and State placement for program docs are owned by `.agents/skills/repo-docs-system/SKILL.md`; lifecycle routing is owned by [agent-loops.md](./agent-loops.md).

## Folders

| Path | Purpose |
| --- | --- |
| `programs/<program>/` | Program home for every program, refactor or feature: `plan.md` (single-unit detail or multi-unit master), or an evergreen `README.md` charter, `progress.md`, `problems.md`, `implementation-plans/<unit>/plan.md`, optional `future-features.md` and `sources/` |
| `backlog/` | Future features and problems that no open program owns. It is not a program |
| `refactors/` | Redirect files only, for the three paths that published migrations cite. Each points to the moved file under `programs/` |
| `adr/` | Architecture decision records, indexed in [adr/README.md](./adr/README.md) |
| `sop/` | Repeatable operating procedures (local development, release gate, smoke E2E) |
| `case-studies/` | Written-up evaluations and retrospectives |
| `assets/` | Screenshots and images embedded in repository documentation |
| `data_flow/` | Data-flow diagrams (HTML) |
| `ui-design-system-and-review/` | Accepted design library and closed delivery history; continuing capability is in `programs/ui-ux-design/` |
| `agent-skills/`, `agent-workflow/`, `native-multi-agent/` | Closed agent-governance delivery histories; continuing capability is in `programs/agent-workflow/` |
| `agent-loops.md` | Common lifecycle, review timing and waiting. The review skill owns the self-review method. |
| `agent-self-review-plan.md` | Plan for the self-review methodology (a program doc at the top level) |

## Programs

One row per program: a folder under `docs/` that contains a `progress.md`. Kind is `delivery` or `evergreen`; Lifecycle is separately `active`, `closed` or `legacy`. An idle evergreen remains active; its current initiative is recorded only in progress. Current status is read from each program's `progress.md` State, not from this table. Update the row when the lifecycle changes.

| Path | Kind | Lifecycle |
| --- | --- | --- |
| `programs/admin-console` | delivery | active |
| `programs/agent-rules` | delivery | active |
| `programs/auth-onboarding` | delivery | active |
| `programs/dependency-modernization` | delivery | active |
| `programs/doc-system-optimization` | delivery | closed |
| `programs/docs-model-migration` | delivery | active |
| `programs/student-user-flow-route` | delivery | active |
| `programs/teacher-workflow` | delivery | closed |
| `agent-skills` | delivery | closed |
| `agent-workflow` | delivery | closed |
| `native-multi-agent` | delivery | closed |
| `ui-design-system-and-review` | delivery | closed |
| `programs/agent-workflow` | evergreen | active |
| `programs/security` | evergreen | active |
| `programs/performance` | evergreen | active |
| `programs/ui-ux-design` | evergreen | active |
| `programs/infrastructure` | evergreen | active |

New evergreen capability navigation: [Agent workflow](./programs/agent-workflow/README.md), [Security](./programs/security/README.md), [Performance](./programs/performance/README.md), [UI/UX design](./programs/ui-ux-design/README.md), [Infrastructure and reliability](./programs/infrastructure/README.md).

## Decisions

- Program home is `docs/programs/<program>/` for every program (2026-10-05). `docs/refactors/` keeps redirect files for the paths that published migrations cite.
- New and migrated program docs use the templates in `.agents/skills/repo-docs-system/references/templates/`.

## Not moved

Candidates only; each move needs its links fixed and a link check.

- `data_flow/`.
- Top-level `agent-self-review-plan.md`.

Keep `agent-loops.md` at its shared import path. Historical self-review and managed-workflow plans describe retired contracts; active instructions live in AGENTS.md, the lifecycle and current skills.
