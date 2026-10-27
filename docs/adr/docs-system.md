# ADR: Documentation system for programs

Date: 2026-10-05. Status: Accepted.

## Context

Program documents grew without one owner for status. Master plans and detail plans carried State, progress files carried review and command logs, owner-review briefs duplicated decisions, `docs/adr/` held three plan, progress and problems files of a refactor, programs were split between a refactor folder and ad hoc folders, and nothing checked document shape. Readers could not tell which file was current, and agents repeated the same status in several places.

## Decision

- `progress.md` State is the single owner of a program's current status and authority. Master and detail plans carry no State. State describes the current unit only; a finished unit shrinks to milestone lines that cite the PR or commit holding the detail.
- Program documents, plans and progress files are written in English. Frozen legacy documents are not translated; they get the legacy banner. Replies to the Owner follow the Owner's language.
- Program home is `docs/programs/<program>/` for every program, refactor or feature, with no refactor or feature split. Paths cited by published migrations keep redirect files in `docs/refactors/`.
- A program is found by its `progress.md` in any folder under `docs/`, not by folder name. Closed programs may stay where they are when other files cite their paths.
- Lifecycle (`active`, `closed`, `legacy`) is recorded in the Programs table of `docs/README.md` and is independent of file format. A bannered `progress.md` gives its program the legacy-format exemption from file roles and shape rules.
- There is no owner-review-brief role. Owner decisions live in the master plan or the detail plan; current authority lives in progress State. Existing briefs stay as history under banners.
- `docs/adr/` holds decisions that outlive one program or span programs (architecture, product rules, workflow, docs structure) and is indexed in `docs/adr/README.md`. A decision that only one program needs stays in that program's master plan.
- The shape rules are enforced by `npm run docs:check` (structure check plus link check), which runs in CI.

## Consequences

- A reader opens `progress.md` for status and the master plan for decisions; the same fact is not kept in two files.
- New and active program documents must pass the structure check; closed history is bannered rather than rewritten, so meaning in old files is not changed by format work.
- Moving a program, changing a lifecycle or adding an ADR needs a matching row or index entry, or the check fails.
- Paths that published migrations cite must keep their redirect files, because published migrations cannot be edited.
- The check is line-based and has no markdown parser, so documents must follow the stated grammar (milestone lines, problem fields) literally.

## Amendment — 2026-10-27

The Owner approved the prospective delivery/single-unit/evergreen/backlog/entry-plan model in [AR3](../programs/agent-rules/implementation-plans/ar3/plan.md), decision D9. The current [repo-docs-system skill](../../.agents/skills/repo-docs-system/SKILL.md) owns its document roles/templates. This extends the original single-State-owner decision; it does not migrate or reassign existing documents. Current checker/index lifecycle support remains active/closed/legacy. Charter/evergreen, entry-plan and global feature-ID checks require the separate follow-up before claiming enforcement or delivering an unsupported new shape.
