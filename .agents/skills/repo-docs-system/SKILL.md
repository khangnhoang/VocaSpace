---
name: repo-docs-system
description: Repository-specific contract for the shape of program documentation, covering master plans, detail plans, progress State, problems, future-features and sources, the docs taxonomy, document lifecycle and legacy marking, and migrating a live program to the current shape. Use when creating, updating, reshaping, or migrating program docs under docs/.
---

# Repo Docs System

## Activation and ownership

Use this skill when a task creates, updates, reshapes, closes, marks as legacy, or migrates program documentation: a master plan, a per-unit detail plan, `progress.md`, `problems.md`, `future-features.md`, `sources/`, or the `docs/` folder taxonomy.

Do not use it for product code, skill governance, or the planning method itself. Do not use it merely to read a plan.

This skill owns document shape only: file roles, State placement, update points, taxonomy, lifecycle, the legacy banner, and the migration procedure. It does not own, restate, or weaken:

- planning method, Spec/State/hypothesis classification, approval and implementation permission: `implementation-planning-and-pr-breakdown`;
- governance of repo-local skills and their routing: `maintain-repo-skills`;
- lifecycle routing, review depth, and stop rules: `docs/agent-loops.md`;
- commits, staging, and remote actions: `git-checkpoint-workflow`.

When a rule here and a rule in those sources disagree, follow the more restrictive one and report the conflict. A document edit never grants implementation, commit, push, PR, merge, deploy, database, or production permission.

## Use the templates, never old program docs

Build a new program document from the templates listed in Resource routing, not by copying the structure of an existing program's files. Existing program docs may be long, hold State in several places, or follow an older shape. A closed or legacy program is a source of content, not of structure.

## File roles

| File | Holds | Must not hold |
| --- | --- | --- |
| Master `plan.md` | Goal and outcome; numbered, dated Owner decisions, one line each; shared invariants; unit/PR table with dependencies and gates; rollout order; program risks; out of scope | State, history, review journal |
| Detail `implementation-plans/<unit>/plan.md` | Binding Spec (outcome, acceptance, scope and non-goals, guardrails, Owner decisions that bind the unit); repository facts only where they justify a Spec item or expose a conflict, with a baseline commit; short bounded hypotheses; checkpoint table (ID, outcome, verification); risk, rollout and rollback runbook; one line pointing to progress | State, review journal, detailed code map |
| `progress.md` | One State block at the top, edited in place; then a milestone list, one line each | Review rounds, command logs, a copy of the Spec |
| `problems.md` | Open entries with ID, status, problem, evidence, direction, exit condition; resolved entries as one line | Planning decisions, State |
| `future-features.md` | Owner direction outside the current scope. Optional, no template | Work that is in scope |
| `sources/` | Frozen reviewed inputs, kept in the language they were reviewed in. Optional, no template | Live decisions, State |

## State has one owner

- `progress.md` is the only State owner. The master plan has no State. A detail plan has one line pointing to progress and no State section.
- A standalone durable plan with no program progress may keep an inline State block shaped like the progress template.
- State fields and the milestone format are defined once, in the progress template. Do not redefine them elsewhere.
- Spec identity (plan revision, approval date) lives in the detail plan; State only names the revision being executed.

### Default update rule

- Update State in the same commit as the checkpoint code or document change it describes.
- Use a standalone docs commit only for a blocker, a merge or rollout event, or a session handoff.
- A milestone is one line: date, what happened, commit or PR. A milestone added in the commit it describes cites `(this commit)`; earlier work cites its hash or PR number. Do not record review rounds or command logs in progress; Git keeps them.
- Record an implementation discovery as an accepted deviation in State. Do not edit the frozen Spec or facts to match it; route material changes through `implementation-planning-and-pr-breakdown`.

## Repository facts rule

A detail plan keeps only repository facts that justify a Spec item or expose a conflict, each tied to a baseline commit. Facts are frozen once the plan is approved. A code map or call-path inventory is a bounded hypothesis, not a fact.

## Problems

Each open entry has: ID, status, problem, evidence, direction, exit condition. When resolved, first move any still-live follow-up into an open entry, then shrink it to one line (ID, status, one-line outcome). Keep the original ID, and keep an entry open until its exit condition is met.

## Lifecycle and legacy marking

| Lifecycle | Meaning | Rule |
| --- | --- | --- |
| active | The program has unfinished units or open rollout steps | Follows the templates. A live program in an older shape is migrated, not bannered (see `references/migration.md`) |
| closed | All units merged and rolled out; no open rollout step | Stays in place; content is not rewritten |
| legacy | A closed or frozen document in an older shape that is not migrated | Starts with the legacy banner below |

Exact legacy banner, placed as the first line of a legacy file, or as the first line after its YAML front matter when it has one:

```text
> Legacy format — do not use as a template. Use the templates in .agents/skills/repo-docs-system/.
```

A frozen reviewed detail plan inside a migrated program keeps its content and path; its State section is replaced by the progress pointer and it gets the banner.

## Language

Repository docs are written in English. A frozen `sources/` input keeps the language it was reviewed in. Reports and replies to the Owner follow the Owner-facing language rule in `AGENTS.md`.

## Size guidance

Rough targets, soft guidance and never a hard limit: master plan about 150-250 lines; detail plan about 150-300; progress State block about 25 lines plus one line per milestone; problems entry about 8 lines open, 1 line resolved. Exceeding a target is a prompt to remove duplication, not to drop a Spec item, invariant, gate, or rollout step.

## Taxonomy

Program home is `docs/refactors/<program>/` (published migrations cite paths under it). The other top-level folders under `docs/` and the deferred moves are listed in `docs/README.md`, which owns the taxonomy index. Update it when a folder's purpose changes.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [references/templates/master-plan.md](references/templates/master-plan.md) | Read before creating or reshaping a program master `plan.md` | The task does not create or reshape a master plan |
| [references/templates/detail-plan.md](references/templates/detail-plan.md) | Read before creating or reshaping a per-unit detail plan `implementation-plans/<unit>/plan.md` | The task does not create or reshape a detail plan |
| [references/templates/progress.md](references/templates/progress.md) | Read before creating or reshaping a `progress.md` or an inline State block in a standalone plan, or when the State field list or milestone format is needed | The task does not create or reshape a `progress.md` or an inline State block, and does not need the State field list or milestone format |
| [references/templates/problems.md](references/templates/problems.md) | Read before creating or reshaping a `problems.md`, or before shrinking a resolved entry | The task does not create or reshape a `problems.md` and does not shrink a resolved entry |
| [references/migration.md](references/migration.md) | Read before migrating an existing live program to this shape, or before replacing its State, master plan, progress, or problems files | The task does not migrate an existing live program and does not replace its State, master plan, progress, or problems files |

Do not read a resource merely because it exists.

## Stop conditions

Stop and report instead of continuing when:

- a migrated Owner decision, invariant, gate, rollout step, or open problem cannot keep its meaning in the new shape;
- a published migration (`supabase/migrations/*.sql`) cites a path you would move or rename; never edit a published migration;
- the files you would change are owned by a parallel session or branch you cannot coordinate with;
- the work would also change planning-method, permission, or skill-governance rules owned elsewhere;
- a required Owner decision about taxonomy, ownership, or scope is missing.

## Output contract

Report which documents changed and the role each now plays, that State has exactly one owner, the link check and any meaning check actually run, and anything skipped. A migration report also names the Git revision of the old files used for comparison.
