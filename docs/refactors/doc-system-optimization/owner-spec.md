# Owner spec — documentation system and planning-skill optimization

Status: Draft owner spec captured 2026-10-03 from the Owner conversation (session `a55a19ee`). Not a plan yet. The detail plan for this work is written from this file on branch `docs/doc-system-optimization` (worktree `C:\VocaSpace-docsys`, from `main` at `3094600`). Its final location may move once the new docs structure is decided.

## Why

- The planning skill direction is right (Master Plan = intent, detail plan = binding Spec + checkpoint/stage state machine, progress = single current State), but it has gaps that made agents duplicate State in three places and create many standalone "reconcile docs" commits. Evidence: the auth-onboarding program (A1) kept State in master §10, A1 plan §11 and an append-only `progress.md`; about half of the A1 branch commits were docs/reconcile commits; `student-user-flow-route/progress.md` is 852 lines.
- Reviews were valuable and correct (they caught real rollout, replay and UI bugs). Extra review rounds came from incomplete author fixes and from long documents with internal contradictions, not from review itself. Keep review for high-risk work; shrink documents instead.
- The `docs/` tree is messy: ADR files that are really plans/progress (`docs/adr/refactor-teacher-workflow-*.md`), `data_flow/` HTML, `case-studies/`, `sop/`, several program folders, top-level agent docs.

## Owner decisions (2026-10-03)

1. Templates live **inside a skill**. There is no dedicated documentation skill today; the plan must propose the skill structure (new skill vs. extending `implementation-planning-and-pr-breakdown`) and ask the Owner.
2. Resolved entries in `problems.md` shrink to **one line** (ID, status, one-line outcome); details stay in Git.
3. **Live** programs (for example `student-user-flow-route`, which still has deferred D5, and `auth-onboarding`) are **migrated** to the new format, not just marked: write the new English version from the old one, review it, and only then replace the old one — or keep the old file as `<name>_old.md` marked legacy. Never break a live program.
4. Size targets are **soft guidance**, not hard limits.
5. Completed/frozen programs get a short legacy banner ("legacy format — do not use as a template; see <templates>"). The skill must tell agents to **use the templates, not copy structure from existing program docs**.
6. All repository docs are in English; reports to the Owner stay in Vietnamese.
7. The `docs/` structure itself probably needs reorganizing as part of this work (ADR, flows, SOP, programs, agent docs).
8. Order (2026-10-03): docs first, split into **two PRs**. **PR1 = Phase 1**: new documentation skill + templates + planning-skill fixes + `docs/` restructure decision applied to what PR1 needs + migration of the live `auth-onboarding` program; merge PR1. Then the Owner runs A2 (in another session) on the new format. Then **PR2 = Phase 2**: remaining `docs/` restructure and migration of `student-user-flow-route` and other live/legacy programs.
9. Skill: a **new dedicated documentation skill** (working name `repo-docs-system`) owns the `docs/` taxonomy, templates (master plan, detail plan, progress, problems, future-features, sources, ADR, SOP as needed), program lifecycle (active / closed / legacy), the legacy banner, and the migration procedure. `implementation-planning-and-pr-breakdown` keeps planning method and points to this skill for document shape and State ownership. Add an `AGENTS.md` route for it.
10. `docs/` restructure: **move files and fix every link**, with an automated link check. Exact split between PR1 and PR2 is decided in the plan.
11. Review: author self-review + **one Codex round** on the plan (Codex only when the Owner asks; the Owner pre-approved this one round).

## Proposed target model (from the conversation; needs plan + Owner acceptance)

| File | Holds | Must not hold |
| --- | --- | --- |
| Master `plan.md` | Goal; numbered, dated Owner decisions (one line each); invariants; unit/PR table with dependencies and gates; rollout order; out of scope | **No State**, no history |
| Detail `implementation-plans/<unit>/plan.md` | Binding Spec (outcome, acceptance, scope/non-goals, guardrails, decisions); repo facts only where they justify the Spec (frozen after approval); short bounded hypotheses; checkpoint table (ID, outcome, verification); risk/rollout/rollback runbook; one line pointing to progress | State, review journal, detailed code map |
| `progress.md` | One State block at the top, **edited in place** (active unit/checkpoint, status, blockers, next action, current authority, hosted state) + milestone list, one line each (date, what, commit/PR) | Review rounds, command logs (Git keeps them) |
| `problems.md` | Entries: ID, status, problem, evidence, direction, exit condition; resolved → one line | — |
| `future-features.md` | Owner direction outside current scope | Optional |
| `sources/` | Frozen reviewed inputs | Optional |

Update rule: update State **in the same commit as the checkpoint code**; a standalone docs commit only for a blocker, a merge, or a session handoff.

Skill gaps to fix (found in `implementation-planning-and-pr-breakdown`):
1. The detail-plan template has `## State — current resume projection` (`references/spec-state-and-hierarchy.md` ~L116) while `references/tracked-program-and-durable-plan.md` ~L52 says progress owns State → when progress exists, the plan keeps one pointer line only.
2. No default "update points" → default as in the update rule above.
3. No progress template ("concise" is vague) → State block (~8 fields) + one-line milestones.
4. "Repository facts" has no bound or retention rule → only facts that justify the Spec/conflicts; frozen snapshot after approval.
5. Master Plan is not told explicitly "no State section".

## Remaining open questions (resolve in the plan or ask)

- Exact new `docs/` taxonomy and which moves land in PR1 vs PR2.
- Whether `maintain-repo-skills` evals/validators are required for the new skill and the planning-skill change (check that skill).
- Handling of the parallel A2 work: another session appears to have started an A2 plan in `C:\VocaSpace` (untracked `docs/refactors/auth-onboarding/implementation-plans/a2/`, modified `progress.md` on `feat/auth-a2-password-recovery`, which also holds unpushed reconcile commit `ade2cd6`). PR1 migrates `auth-onboarding` docs, so coordinate to avoid conflicts (A2 starts after PR1 merges, per decision 8).
