---
name: repo-docs-system
description: Own program document shape, delivery/evergreen models, backlog, State, problems, templates, ADRs and migration. Use when creating/changing/closing/migrating program docs or docs taxonomy.
---

# Repository docs system

## Use when / do not use when

Use for program plans/charters, detail plans, progress, problems/future features, ADRs, backlog, docs index and migrations. Do not use merely to read a plan, author product code or decide planning method. AGENTS.md owns permissions; lifecycle owns timing; planning owns Spec/hypotheses/approval. Build from templates, not historical document structure.

## Model and compatibility

The Owner accepted two kinds: delivery programs finish an observable goal; evergreen programs maintain a capability through initiatives. Small work no open program owns belongs in docs/backlog/, not a fabricated program.

This skill specifies the new model. Existing programs keep their current paths, shape, lifecycle and decisions until a separately authorized migration. This unit does not reassign documents or create missing evergreen homes. Current scripts/docs/check-structure.mjs still checks active/closed/legacy and the existing shape rules; it does not enforce charter/evergreen, entry-plan IDs or global FEAT IDs. Do not claim otherwise. Before delivering a new shape the current checker cannot accept, obtain the follow-up checker/migration work; do not bypass the check or silently use a false lifecycle value.

## File roles

| Source | Holds | Must not hold |
| --- | --- | --- |
| Delivery master plan.md | Observable goal, dated numbered decisions, shared invariants, units/dependencies/gates, rollout, risks, exclusions. | Current State, review journal. |
| Evergreen charter README.md | Capability/boundary, decisions/invariants, initiative table and opening gates. | State or a competing root plan.md. |
| Detail plan.md | Binding Spec, acceptance, necessary guardrails, baseline facts that justify them, bounded hypotheses, checkpoints/verification, risks/rollout/rollback, progress link. | Duplicate State, command/review history or a large code map. |
| progress.md | Exactly State and Milestones; current unit/authority/evidence/blocker/next action and concise milestones. | Spec copy or append-only command/review log. |
| problems.md | Open ID/status/problem/evidence/direction/exit condition; resolved entries one line. | Decisions or duplicated State. |
| future-features.md | Owner direction outside scope, ID/status/direction/target program. | Work already accepted into the current plan. |
| sources/ | Optional frozen reviewed inputs in their reviewed language. | Live State or competing decisions. |

A single-unit delivery program starts with a root detail plan, not an empty master plus folder. A multi-unit program has a root master and implementation-plans/u<n>-<slug>/plan.md. An evergreen uses a charter and initiative detail plans under that folder.

Delivery follow-up work recorded in its own problems/future-features may have implementation-plans/<id>-<slug>/plan.md, linked to that entry without inventing another Units row. Evergreen work uses initiative rows instead. These conventions apply prospectively after the compatibility gate above, not by renumbering existing accepted plans.

## State and closure

progress.md alone owns program State; plans have a one-line progress link. A standalone durable plan without program progress may retain the existing inline-State exception. Exact fields and milestone grammar live only in the progress template.

Keep current unit/authority in State; finished evidence shrinks to milestones citing a commit/PR. Update State with the checkpoint it describes; separate docs commits are for blockers, merge/rollout events or handoff. A final milestone may cite (this commit), replaced with its hash the next time the file changes.

Keep facts frozen after plan approval; record a bounded discovery in State and route material Spec changes to planning. Never alter approved history to match current code.

Resolve problems only after their exit condition holds and move still-live follow-ups before shrinking the entry. Keep IDs. Future-feature IDs are unique across program/backlog future-features under the new model; current checker does not enforce that uniqueness.

## Backlog and program lifecycle

docs/backlog/ holds problems.md/future-features.md with no plan, progress or Programs row. Close entries as one-line Done (with delivered evidence), Moved to (link) or Dropped (reason); keep an undelivered fix open as Fixed locally, awaiting delivery.

A delivery program closes when its units/rollout are done and open problems are resolved/moved. An evergreen capability remains open while its initiatives close independently; at most one open initiative plan at a time. Existing Lifecycle rows remain active/closed/legacy until the new checker/index contract is implemented in the follow-up work.

Do not duplicate current status into docs/README.md. Update its program/folder index when the owning facts actually change. A legacy-format exemption is not permission to label an active unfinished program closed or legacy.

Use an ADR in docs/adr/ for a decision spanning/outliving programs and index it in docs/adr/README.md. A program-only decision stays in the plan/charter. No dependency-update check is introduced by this skill.

Existing closed/frozen old-format documents may carry this exact first-line banner (after YAML frontmatter when present):

> Legacy format — do not use as a template. Use the templates in .agents/skills/repo-docs-system/.

This preserves the current checker's legacy exemption; it does not mark an unfinished active program as historical.

## Verify

After docs/index/ADR edits run npm run docs:check. It checks its existing mechanical rules/links only; manually inspect meaning, current State, entry closure and expanded-model rules. Do not claim a future checker or docs:check:test script exists. If checker code actually changes, run the affected node --test scripts/docs/<checker>.test.mjs.

Soft size targets are prompts to remove duplication, never reasons to drop a decision, invariant or rollout step. Docs/skills use English; frozen inputs keep their reviewed language and Owner reports follow AGENTS.md.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Master plan](references/templates/master-plan.md) | Creating/reshaping a delivery master. | No master change. |
| [Charter](references/templates/charter.md) | Designing an evergreen charter under the compatibility gate. | No charter. |
| [Detail plan](references/templates/detail-plan.md) | Creating/reshaping a unit, initiative, entry or single-unit plan. | No detail plan change. |
| [Progress](references/templates/progress.md) | Creating/changing State shape or using its field/milestone grammar. | No State-shape/grammar decision. |
| [Problems](references/templates/problems.md) | Creating/reshaping problems or shrinking a resolved entry. | No such change. |
| [Future features](references/templates/future-features.md) | Creating a future-features file/entry. | No future-feature change. |
| [ADR](references/templates/adr.md) | Writing/reshaping a cross-program decision record. | No ADR. |
| [Handoff](references/templates/handoff.md) | An explicitly requested handoff. | No handoff request. |
| [Migration](references/migration.md) | Moving/reshaping a live program or designing its delivery-to-evergreen conversion. | Ordinary bounded docs edit. |

## Stop and report

Stop for a missing Owner boundary/authority, conflicting decisions, another writer, unsupported checker requirement or a published migration citation that would break. No automatic document reassignment.

Report changed sources/roles, State ownership, actual checker vs manual results, limitations and Git/remote state. A migration also names its old baseline and proves each decision/invariant/gate/open problem kept its meaning.
