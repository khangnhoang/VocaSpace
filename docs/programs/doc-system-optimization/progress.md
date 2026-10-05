# Progress — Documentation system and planning-skill optimization

Plans: [PR1](./implementation-plans/pr1/plan.md), [PR2](./implementation-plans/pr2/plan.md). Owner spec: [owner-spec.md](./sources/owner-spec.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [implementation-plans/pr2/plan.md](./implementation-plans/pr2/plan.md) r4 (Owner-approved 2026-10-05). PR1 ran on [pr1/plan.md](./implementation-plans/pr1/plan.md) r3. |
| Current unit / checkpoint | None active. PR1 and PR2, the program's only units, are merged. |
| Status | Completed. The program is closed. |
| Completed evidence | PR1 merged as PR 120 (`425ad40`), PR2 as PR 126 (`d042861`, CI 4/4 including the new docs check steps). Each PR body holds its checks and review result. |
| Accepted deviations | None open. PR2 deviations are listed in the PR 126 body. |
| Blockers / Owner decisions | None. The current-authority wording in `tracked-program-and-durable-plan.md` and `maintain-repo-skills` now matches `repo-docs-system`: progress State is the durable record; a managed run only holds a snapshot. |
| Next action | None. New docs-system work starts a new program or a standalone plan. |
| Current authority | No further work is granted under this program. |

## Milestones

One line each, newest last: date, what happened, commit or PR.

- 2026-10-03 Owner spec and PR1 plan r3 written; passed plan review; Owner answered Q1–Q4 (`d1e3d7a`).
- 2026-10-03 CP1: `repo-docs-system` skill, templates, migration reference, `AGENTS.md` route, `docs/README.md` (`6326806`).
- 2026-10-03 Template links fixed so the skill bundle has no broken link (`bdad185`).
- 2026-10-03 CP2: planning-skill State, update-point, facts and master-plan gaps fixed; routed to `repo-docs-system` (`0d322b2`).
- 2026-10-04 CP3: link check, baseline and test; `auth-onboarding` migrated; compact plan shape no longer implies a State block (`4fa8813`).
- 2026-10-04 CP4: this progress file, plan section 8 pointer, full-PR self-review (`6f99c1c`).
- 2026-10-04 Follow-up: legacy-banner placement after YAML front matter stated in `repo-docs-system`; A1 hosted step 5 dated (`2070efa`).
- 2026-10-04 Fresh-reader skill tests passed; fixed the progress-routing exclusion, the same-commit milestone citation and follow-ups lost when a problem is shrunk (`93b6753`).
- 2026-10-04 Review fixes: link check now covers reference-style definitions and nested-parenthesis destinations; Resource routing skip conditions made the exact negation of the read conditions (`9ab3e87`).
- 2026-10-04 PR 120 opened; CI failed because vitest collected the `node:test` file `scripts/docs/check-links.test.mjs`; excluded it in `vitest.config.ts` (`e34ce16`).
- 2026-10-04 PR1 verified: CI and Vercel passed, implementation review passed, affected skill tests rerun and passed (`e34ce16`).
- 2026-10-04 PR1 accepted deviation: the link baseline holds 66 entries, not the 74 in its plan §3.3, because the throwaway scan overcounted (`4fa8813`).
- 2026-10-04 PR1 merged (PR 120, `425ad40`).
- 2026-10-05 PR2 plan r4 approved by the Owner after it passed plan review: program home `docs/programs/`, structure checker in CI, Programs and ADR indexes, remaining migration (`3bb6ff0`).
- 2026-10-05 CP1: `check-structure.mjs` and test, `docs:check` scripts, `repo-docs-system` verify and lifecycle text, progress grammar, ADR template, owner-review brief role removed from two skill sources (`672762c`).
- 2026-10-05 CP2: `auth-onboarding`, `doc-system-optimization` and `student-user-flow-route` moved to `docs/programs/` by `git mv` in `6e7a66b`; redirect files for the three migration-cited paths, template and README path updates (`9c4140b`).
- 2026-10-05 CP3: `student-user-flow-route` migrated to the templates in English (plan, progress, problems), `implementation-plans/README.md` removed, frozen detail plans and non-role files bannered, D1 correction-plan links fixed and the link baseline shrunk to one commented entry; the ID rule of `check-structure.mjs` now reads multi-segment IDs such as `FUTURE-PAYMENT-001` (`06578d1`).
- 2026-10-05 CP4: `auth-onboarding` `progress.md` cut to State and Milestones and its `problems.md` normalized; closed programs bannered and the Native multi-agent adoption recorded; `teacher-workflow` ADR files moved to `docs/programs/teacher-workflow/`; `owner-spec.md` moved to `sources/`; Programs table, `docs/adr/README.md` and `docs/adr/docs-system.md` added (`d3228bf`).
- 2026-10-05 CP5: CI job `Test and Build` runs the docs check tests and `npm run docs:check`; the gate was shown to fail on a temporary violation (`4782640`).
- 2026-10-05 Review fixes: problem exit conditions restored to the sources, the checker rejects wrapped milestones and malformed resolved entries, reads reference-style links, matches `progress.md` exactly and scans git-selected files, State follows D9, and the eval cases no longer name an owner-review brief as an owner (`daebe0c`).
- 2026-10-05 Review fixes: Resolved rejects plain text outside list entries, and a reference definition (including multi-line ones) is a link only when something uses it (`437222b`).
- 2026-10-05 Review fixes: a definition that already has a title no longer swallows a following quoted line as a second title (`e8c14b7`).
- 2026-10-05 Implementation review and fresh-reader skill tests passed; auth-onboarding milestones trimmed of review rounds and test counts (`8b71a81`).
- 2026-10-05 PR2 merged (PR 126, `d042861`).
- 2026-10-05 Current-authority wording reconciled in the planning reference and `maintain-repo-skills`; program closed (this commit).
