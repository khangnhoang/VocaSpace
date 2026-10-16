# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR2 plan](./implementation-plans/ar2/plan.md) r3 |
| Current unit / checkpoint | AR2 CP1 (plan drafted) |
| Status | in progress |
| Completed evidence | AR1 done: merged PR 153 (`d1b990b`, 2026-10-14), evidence in the [AR1 plan](./implementation-plans/ar1/plan.md) and Git history. AR2: read-only discovery of the review, planning and native workflow skills, `docs/agent-loops.md` and `docs/agent-self-review.md` on 2026-10-16 against `03fdeec`. |
| Accepted deviations | none |
| Blockers / Owner decisions | AR2 decisions D1–D7 of 2026-10-16 are in the plan §1.4; Codex plan review r1 (Owner's machine) NEEDS_CHANGES with 5 Required, fixed in r3 |
| Next action | Owner runs Codex plan review r2 on r3 |
| Current authority | AR2 plan commit and branch push granted by the Owner on 2026-10-16; no implementation, PR or merge |

## Milestones

- 2026-10-14 AR1 plan r3 drafted from the Owner's routing decisions (`57c7f08`).
- 2026-10-14 AR1 CP2: moved the privacy rule, skill additions and Claude working rules into the repository (`a415f3f`).
- 2026-10-14 AR1 CP2 review fix: restored the C3 and C1 conditions in `.claude/rules.md` and shortened Decision 15 (`e85dc84`).
- 2026-10-14 AR1 CP3: Codex implementation review passed and both fresh-reader cases passed (`d0f2482`).
- 2026-10-14 AR1 Owner addition: Memory section and Discovery wording in `.claude/rules.md` (`1302948`).
- 2026-10-14 AR1 merged and CP4 memory cleanup done (PR 153, `d1b990b`).
- 2026-10-14 Explore rule wording: Haiku reports findings, Main verifies the critical files (`331bc76`).
- 2026-10-16 AR2 plan r2 drafted from the Owner's decisions D1–D7 (`ad32fd9`).
- 2026-10-16 AR2 plan r3 after Codex plan review r1 (5 Required) (this commit).
