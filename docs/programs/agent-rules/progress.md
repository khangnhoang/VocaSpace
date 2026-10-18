# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR2 plan](./implementation-plans/ar2/plan.md) r6 (last executed unit) |
| Current unit / checkpoint | None active. AR2 is merged (PR 163, `5dbcbce`). |
| Status | merged |
| Completed evidence | Finished units are in the milestones; AR2 checkpoint evidence is in its commits and the PR 163 body. |
| Accepted deviations | none |
| Blockers / Owner decisions | None. AR2 decisions D1–D14 stay in the plan §1.4. |
| Next action | The Owner picks the next agent-rules unit; candidates are in [future-features.md](./future-features.md). |
| Current authority | None active. A new unit needs its own plan and Owner grant. |

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
- 2026-10-17 AR2 CP2 review fix: the push-order fresh-reader case now supplies `docs/agent-loops.md`; native test header shows 30 tests (`00f7223`).
- 2026-10-17 AR2 CP3 correction: Main asks the Owner about capped findings with the structured question tool and the same options; native test assertion updated (`6fe4aed`).
- 2026-10-17 AR2 CP3 closed: GCW probe passed on `6fe4aed`; Owner decision D14 sets the `crq-fresh-plan-review-normal` acceptance scope; AC11 met (`6d5c750`).
- 2026-10-18 AR2 merged (PR 163, `5dbcbce`).
