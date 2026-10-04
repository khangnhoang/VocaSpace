# Progress — Documentation system and planning-skill optimization

Plans: [PR1](./implementation-plans/pr1/plan.md), [PR2](./implementation-plans/pr2/plan.md). Owner spec: [owner-spec.md](./sources/owner-spec.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [implementation-plans/pr2/plan.md](./implementation-plans/pr2/plan.md) r4 (Owner-approved 2026-10-05). PR1 ran on [pr1/plan.md](./implementation-plans/pr1/plan.md) r3. |
| Current unit / checkpoint | PR2 on `docs/doc-system-pr2` (from `main` at `eb36618`): CP1–CP5 done and committed locally; Codex implementation review r1 (CHANGES_REQUIRED, fixed in `daebe0c`) and r2 (CHANGES_REQUIRED, 2 Required) corrections applied in the latest commit. |
| Status | Implementation complete locally; awaiting the Codex implementation review round 3. Nothing is pushed. |
| Completed evidence | `npm run docs:check` exits 0 in `C:\VocaSpace` and in a clean temporary worktree; `node --test scripts/docs/*.test.mjs` (27 tests: 19 check-structure, 8 check-links), skill validators and `npx vitest run` pass; a temporary violation made the docs gate fail and was restored. Exact results are in the commit bodies and the checkpoint report. |
| Accepted deviations | Accepted by the coordinator after review r1: (a) the checker ID rule reads multi-segment IDs (CP1 defect found in CP3); (b) `.agents/scripts/native-multi-agent-workflow.test.mjs:158` follows the D6 text change; (c) `problems.md` entries beyond AUTH-002 and AUTH-004 were reshaped to pass the checker, with AUTH-008 restored to an undefined exit; (d) link-target-only edits in the pr1 and pr2 plans for the `owner-spec.md` move; (e) all 21 frozen student-user-flow-route detail plans and non-role files are bannered; (f) the Native multi-agent adoption milestone cites `3bb6ff0` and adds a `## Milestones` section; (g) `ui-design-system-and-review/future-features.md` is not bannered. Review r1 fixes added: the checker rejects wrapped milestones and malformed resolved entries, reads reference-style links, matches `progress.md` exactly and scans git-selected files (`daebe0c`). Review r2 fixes added: Resolved allows only list entries after the template intro line, and a reference definition (one-line or multi-line) counts only when a link uses it. |
| Blockers / Owner decisions | None. Limits: GitHub CI has not run on this branch, and the fresh-reader tests for the changed skill text wait until the implementation review passes. |
| Next action | Codex implementation review round 3; then fresh-reader tests for the changed skill text; then the Owner decides on push and PR. |
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
- 2026-10-04 PR1 verified: CI `Test and Build`, `production-gate` and Vercel passed, Codex implementation review r2 PASS, skill-test cases C3 and C5 rerun passed (`e34ce16`).
- 2026-10-04 PR1 accepted deviation: the link baseline holds 66 entries, not the 74 in its plan §3.3, because the throwaway scan overcounted (`4fa8813`).
- 2026-10-04 PR1 merged (PR 120, `425ad40`).
- 2026-10-05 PR2 plan r4 approved by the Owner after Codex plan review PASS: program home `docs/programs/`, structure checker in CI, Programs and ADR indexes, remaining migration (`3bb6ff0`).
- 2026-10-05 CP1: `check-structure.mjs` and test, `docs:check` scripts, `repo-docs-system` verify and lifecycle text, progress grammar, ADR template, owner-review brief role removed from two skill sources (`672762c`).
- 2026-10-05 CP2: `auth-onboarding`, `doc-system-optimization` and `student-user-flow-route` moved to `docs/programs/` by `git mv` in `6e7a66b`; redirect files for the three migration-cited paths, template and README path updates (`9c4140b`).
- 2026-10-05 CP3: `student-user-flow-route` migrated to the templates in English (plan, progress, problems), `implementation-plans/README.md` removed, frozen detail plans and non-role files bannered, D1 correction-plan links fixed and the link baseline shrunk to one commented entry; the ID rule of `check-structure.mjs` now reads multi-segment IDs such as `FUTURE-PAYMENT-001` (`06578d1`).
- 2026-10-05 CP4: `auth-onboarding` `progress.md` cut to State and Milestones and its `problems.md` normalized; closed programs bannered and the Native multi-agent adoption recorded; `teacher-workflow` ADR files moved to `docs/programs/teacher-workflow/`; `owner-spec.md` moved to `sources/`; Programs table, `docs/adr/README.md` and `docs/adr/docs-system.md` added (`d3228bf`).
- 2026-10-05 CP5: CI job `Test and Build` runs the docs check tests and `npm run docs:check`; the gate was shown to fail on a temporary violation and restored; the clean-worktree check and the full vitest run passed (`4782640`).
- 2026-10-05 Codex implementation review r1 CHANGES_REQUIRED fixed: problem exit conditions restored to the sources, the checker rejects wrapped milestones and malformed resolved entries, reads reference-style links, matches `progress.md` exactly and scans git-selected files, State follows D9, and the eval cases no longer name an owner-review brief as an owner (`daebe0c`).
- 2026-10-05 Codex implementation review r2 CHANGES_REQUIRED fixed: Resolved rejects plain text outside list entries, and a reference definition (including multi-line ones) is a link only when something uses it (this commit).
