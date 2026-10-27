# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md), [AR3 detail plan](./implementation-plans/ar3/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR3 plan](./implementation-plans/ar3/plan.md) r3, Owner-approved 2026-10-27 |
| Current unit / checkpoint | AR3 CP1 next; implementation not started. AR2 remains merged (PR 163, `5dbcbce`). |
| Status | approved for implementation |
| Completed evidence | Independent gpt-6.1-sol high read-only review passed r3 on 2026-10-27 in the original reviewer session; no findings, candidate hash unchanged. Docs/diff checks passed. Baseline `33550348`: 15 skills and 33 suite files / 232 cases structurally valid. Review covers the plan, not implementation or runtime enforcement. |
| Accepted deviations | None. AR3 proposes replacing prior method-location/managed-workflow decisions prospectively; AR2 history is unchanged. |
| Blockers / Owner decisions | None for CP1; AR3 decisions D1–D12 are recorded in §1.4. |
| Next action | Commit the approved plan, then implement CP1–CP4 and verify each checkpoint. |
| Current authority | Implement approved AR3 r3 and create local plan/implementation commits throughout. No push, PR, merge, extra model execution, browser or database action. |

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
- 2026-10-27 AR3 r3 approved after independent plan review PASS; local plan/implementation commits authorized (this commit).
