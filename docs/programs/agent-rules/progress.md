# Progress — Agent rules

Plan: [AR1 detail plan](./implementation-plans/ar1/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR1 plan](./implementation-plans/ar1/plan.md) r3 |
| Current unit / checkpoint | AR1 done (CP1–CP4) |
| Status | completed |
| Completed evidence | Merged PR 153 (`d1b990b`, 2026-10-14) with CI green. CP4 on 2026-10-14: Claude memory reduced from 43 files to the 9 that §1.5 keeps or shrinks, index rebuilt. Read-only discovery of the 44 Claude memory files and the owning skills on 2026-10-13 against `1ff5588`. CP2 (2026-10-14): `validate-skill.mjs` valid (15 skills, 0 errors, 0 warnings); `validate-skill.test.mjs` 37 pass; `npm run docs:check` 0 structure violations, 1 broken link (baseline, 0 new); `git diff --check` clean. Codex implementation review (gpt-6.1-sol high, read-only) PASS on `e85dc84`, and on the Owner addition at `1302948`; Main re-ran `validate-skill.test.mjs` 37/37 pass. CP3 manual fresh-reader, 2026-10-14, two cases on `e85dc84`, executor `opus-medium-reader` told to read only `maintain-repo-skills/references/fresh-reader-testing.md` (instruction-bounded, not filesystem-isolated): case 1 (may cases run before the implementation review passes?) `passed`, answered no and cited the order rule; case 2 (which cases rerun after a fix rewords one rule?) `passed`, answered only the case covering that rule. |
| Accepted deviations | Owner-approved addition on 2026-10-14 outside plan r3: `.claude/rules.md` gains a Memory section (memory holds only state and observations; new durable rules move to their owner on the next PR) and the Discovery rule names synthesis and plan writing as Main's job. |
| Blockers / Owner decisions | none; AR1 decisions D1–D5 of 2026-10-13 are in the plan §1.4 |
| Next action | none; new durable rules ride the next PR per the `.claude/rules.md` Memory rule |
| Current authority | AR1 closed; this follow-up PR granted by the Owner on 2026-10-14 (push, PR, merge) |

## Milestones

- 2026-10-14 AR1 plan r3 drafted from the Owner's routing decisions (`57c7f08`).
- 2026-10-14 AR1 CP2: moved the privacy rule, skill additions and Claude working rules into the repository (`a415f3f`).
- 2026-10-14 AR1 CP2 review fix: restored the C3 and C1 conditions in `.claude/rules.md` and shortened Decision 15 (`e85dc84`).
- 2026-10-14 AR1 CP3: Codex implementation review passed and both fresh-reader cases passed (`d0f2482`).
- 2026-10-14 AR1 Owner addition: Memory section and Discovery wording in `.claude/rules.md` (`1302948`).
- 2026-10-14 AR1 merged and CP4 memory cleanup done (PR 153, `d1b990b`).
- 2026-10-14 Explore rule wording: Haiku reports findings, Main verifies the critical files (`331bc76`).
