# Progress — Documentation system and planning-skill optimization

Plans: [PR1](./implementation-plans/pr1/plan.md), [PR2](./implementation-plans/pr2/plan.md). Owner spec: [owner-spec.md](./owner-spec.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [implementation-plans/pr2/plan.md](./implementation-plans/pr2/plan.md) r4 (Owner-approved 2026-10-05). PR1 ran on [pr1/plan.md](./implementation-plans/pr1/plan.md) r3 |
| Current unit / checkpoint | PR2 implementation on `docs/doc-system-pr2` (from `main` at `eb36618`); CP1–CP2 done, CP3 next |
| Status | PR1 merged (PR #120); PR2 plan r4 approved (Codex plan review PASS in round 4); implementation in progress (CP1–CP2 committed locally) |
| Completed evidence | PR1: CI `Test and Build`, `production-gate` and Vercel passed on `e34ce16`; Codex implementation review r2 PASS; skill-test cases C3 and C5 rerun on `9ab3e87` passed. Historical PR1 checks are in Git (`9ab3e87`, `e34ce16`) |
| Accepted deviations | PR1: the link baseline has 66 entries, not the 74 in its plan §3.3 (the throwaway scan overcounted) |
| Blockers / Owner decisions | None |
| Next action | Implementor runs CP3–CP5; then Codex implementation review; then fresh-reader tests |
| Current authority | Owner 2026-10-05: commit the plan; implement CP1–CP5 with one implementor and local commits; Codex implementation review; fresh-reader tests after the review passes. Push, PR and merge are not granted |

## Milestones

One line each, newest last: date, what happened, commit or PR.

- 2026-10-03 Owner spec and PR1 plan r3 written; Codex plan review r3 PASS; Owner answered Q1–Q4 (`d1e3d7a`).
- 2026-10-03 CP1: `repo-docs-system` skill, templates, migration reference, `AGENTS.md` route, `docs/README.md` (`6326806`).
- 2026-10-03 Template links fixed so the skill bundle has no broken link (`bdad185`).
- 2026-10-03 CP2: planning-skill State, update-point, facts and master-plan gaps fixed; routed to `repo-docs-system` (`0d322b2`).
- 2026-10-04 CP3: link check, baseline and test; `auth-onboarding` migrated; compact plan shape no longer implies a State block (`4fa8813`).
- 2026-10-04 CP4: this progress file, plan section 8 pointer, full-PR self-review (`6f99c1c`).
- 2026-10-04 Follow-up: legacy-banner placement after YAML front matter stated in `repo-docs-system`; A1 hosted step 5 dated (`2070efa`).
- 2026-10-04 Skill test round (6 manual fresh-reader cases, all passed); fixed the progress-routing exclusion, the same-commit milestone citation and follow-ups lost when a problem is shrunk (`93b6753`).
- 2026-10-04 Codex review fixes: link check now covers reference-style definitions and nested-parenthesis destinations; Resource routing skip conditions made the exact negation of the read conditions (`9ab3e87`).
- 2026-10-04 PR 120 opened; CI failed because vitest collected the `node:test` file `scripts/docs/check-links.test.mjs`; excluded it in `vitest.config.ts` (`e34ce16`).
- 2026-10-04 PR1 merged (PR 120, `425ad40`).
- 2026-10-05 PR2 plan r4 approved by the Owner after Codex plan review PASS: program home `docs/programs/`, structure checker in CI, Programs and ADR indexes, remaining migration (`3bb6ff0`).
- 2026-10-05 CP1: `check-structure.mjs` and test, `docs:check` scripts, `repo-docs-system` verify and lifecycle text, progress grammar, ADR template, owner-review brief role removed from two skill sources (`672762c`).
- 2026-10-05 CP2: `auth-onboarding`, `doc-system-optimization` and `student-user-flow-route` moved to `docs/programs/` by `git mv` in `6e7a66b`; redirect files for the three migration-cited paths, template and README path updates (this commit).
