# Progress — Agent rules

Plan: [AR1 detail plan](./implementation-plans/ar1/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR1 plan](./implementation-plans/ar1/plan.md) r3 |
| Current unit / checkpoint | AR1 CP2 (rules moved into the repository) |
| Status | CP2 implemented and committed locally; Codex implementation review not yet run |
| Completed evidence | Read-only discovery of the 44 Claude memory files and the owning skills on 2026-10-13 against `1ff5588`. CP2 (2026-10-14): `validate-skill.mjs` valid (15 skills, 0 errors, 0 warnings); `validate-skill.test.mjs` 37 pass; `npm run docs:check` 0 structure violations, 1 broken link (baseline, 0 new); `git diff --check` clean. |
| Accepted deviations | none |
| Blockers / Owner decisions | none; AR1 decisions D1–D5 of 2026-10-13 are in the plan §1.4 |
| Next action | Main runs the Codex implementation review; CP3 (fresh-reader round) only after it passes |
| Current authority | Owner approved plan r3 on 2026-10-14. CP2 implementation and local commits on `chore/agent-rules` granted; no push, PR or merge. Memory files stay untouched until after merge (CP4, Main). |

## Milestones

- 2026-10-14 AR1 plan r3 drafted from the Owner's routing decisions (`57c7f08`).
- 2026-10-14 AR1 CP2: moved the privacy rule, skill additions and Claude working rules into the repository (this commit).
