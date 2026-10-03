# Progress — Documentation system and planning-skill optimization

Plan: [implementation-plans/pr1/plan.md](./implementation-plans/pr1/plan.md). Owner spec: [owner-spec.md](./owner-spec.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [implementation-plans/pr1/plan.md](./implementation-plans/pr1/plan.md) r3 (Codex r3 PASS; Owner-approved) |
| Current unit / checkpoint | PR1, CP1–CP4 implemented and self-reviewed locally; no checkpoint active |
| Status | PR1 automated checks passed; awaiting Owner review of the branch. PR2 not planned |
| Completed evidence | Skill validator valid 0/0; `run-skill-evals.mjs validate --all` valid; `validate-skill.test.mjs` 37/37; `check-links.test.mjs` 7/7; `npm run docs:check-links` 0 new broken links (66 baseline entries); every migration-cited doc path resolves; `git diff --check` clean. CP2 fresh-reader evidence: 3 manual fresh-reader cases (Opus 5.5 medium, fresh subagent each, instruction-bounded not isolated): all passed. CP3 G1 meaning check: checklist in the CP3 commit message |
| Accepted deviations | The link baseline has 66 entries, not the 74 in plan §3.3: the throwaway scan counted 2 truncated links in `correction-plan-deepseek-v4.md`, 1 inline-code example in `pr-attachments.md` and 5 duplicates. Plan §1 status lines and "no progress.md yet" are planning-time text; this file is the current State |
| Blockers / Owner decisions | None. The A2 session (in `C:\VocaSpace`) is paused until PR1 merges (Q1) |
| Next action | Owner reviews the branch, then decides push, PR and merge; after merge the A2 session rebases, drops `ade2cd6` and reshapes `a2/plan.md` to the detail-plan template |
| Current authority | Local commits per checkpoint were granted for CP1–CP4. Push, PR, merge and every remote action are not granted. PR2 (remaining `docs/` moves, `student-user-flow-route` migration, link-baseline cleanup, CI step) needs its own plan and Owner approval |

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
- 2026-10-04 Codex review fixes: link check now covers reference-style definitions and nested-parenthesis destinations; Resource routing skip conditions made the exact negation of the read conditions (this commit).
