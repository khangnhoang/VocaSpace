# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR2 plan](./implementation-plans/ar2/plan.md) r6 |
| Current unit / checkpoint | AR2 CP2 (AC1–AC10 implemented) |
| Status | in progress |
| Completed evidence | AR2: read-only discovery of the review, planning and native workflow skills, `docs/agent-loops.md` and `docs/agent-self-review.md` on 2026-10-16 against `03fdeec`; re-checked for r5 on 2026-10-17 (`03fdeec` still `origin/main`). Codex plan review of r6 passed on 2026-10-17. CP2 deterministic checks passed on 2026-10-17 (milestone below). |
| Accepted deviations | none |
| Blockers / Owner decisions | AR2 decisions D1–D13 are in the plan §1.4 (D2 superseded by D8 on 2026-10-17). Codex implementation review and CP3 fresh-reader cases (AC11) pending |
| Next action | Owner runs the Codex implementation review of CP2 and then the CP3 harness on their machine |
| Current authority | AR2 r6 approved by the Owner on 2026-10-17: implementation, local commits per checkpoint, one push after the final self-review, then correction pushes each after its own self-review (D12); no PR or merge |

## Milestones

- 2026-10-14 AR1 plan r3 drafted from the Owner's routing decisions (`57c7f08`).
- 2026-10-14 AR1 CP2: moved the privacy rule, skill additions and Claude working rules into the repository (`a415f3f`).
- 2026-10-14 AR1 CP2 review fix: restored the C3 and C1 conditions in `.claude/rules.md` and shortened Decision 15 (`e85dc84`).
- 2026-10-14 AR1 CP3: Codex implementation review passed and both fresh-reader cases passed (`d0f2482`).
- 2026-10-14 AR1 Owner addition: Memory section and Discovery wording in `.claude/rules.md` (`1302948`).
- 2026-10-14 AR1 merged and CP4 memory cleanup done (PR 153, `d1b990b`).
- 2026-10-14 Explore rule wording: Haiku reports findings, Main verifies the critical files (`331bc76`).
- 2026-10-16 AR2 plan r2 drafted from the Owner's decisions D1–D7 (`ad32fd9`).
- 2026-10-16 AR2 plan r3: every obligation of the method doc gets an owner; CP3 names harness scope and adjudication (`c7a4143`).
- 2026-10-16 AR2 plan r4: CP3 gains the full `prepare --run` flags and the report exit rule (`d849e0b`).
- 2026-10-17 AR2 plan r5: rescoped to a visible self-review evidence block, pass cap, cadence and plan review; `docs/agent-self-review.md` kept (`a596e41`).
- 2026-10-17 AR2 plan r6: final review before the single push, reused evidence in the block, fresh-reader cases for push order and managed handoff, clean-checkout precondition for CP3 (`1e8339a`).
- 2026-10-17 AR2 CP2: self-review evidence block, pass cap and cadence, plan review in `code-review-and-quality`, push order, native reporting field and five fresh-reader cases (`92f2f27`).
- 2026-10-17 AR2 CP2 review fix: the push-order fresh-reader case now supplies `docs/agent-loops.md`; native test header shows 30 tests (this commit).
