# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR2 plan](./implementation-plans/ar2/plan.md) r6 |
| Current unit / checkpoint | AR2 CP3 (AC11 open) |
| Status | in progress |
| Completed evidence | AR2: read-only discovery of the review, planning and native workflow skills, `docs/agent-loops.md` and `docs/agent-self-review.md` on 2026-10-16 against `03fdeec`; re-checked for r5 on 2026-10-17 (`03fdeec` still `origin/main`). Codex plan review of r6 passed on 2026-10-17. CP2 deterministic checks passed on 2026-10-17 (milestone below). Codex implementation review passed on `00f7223`. CP3 on `00f7223` (Owner's machine): 3 cases passed; `gcw-fresh-managed-pass-cap` and `crq-fresh-plan-review-normal` partially passed, then partially passed again in one Owner-authorized extra sample each. |
| Accepted deviations | none |
| Blockers / Owner decisions | AR2 decisions D1–D13 are in the plan §1.4 (D2 superseded by D8 on 2026-10-17). AC11 not met. `gcw-fresh-managed-pass-cap` repeated the same miss (Main's structured question); the managed sentence in `docs/agent-loops.md` is clarified (milestone below), pending review of the new head and one GCW probe. `crq-fresh-plan-review-normal` missed a different item in each sample; no skill change and no more samples; Owner decides whether its acceptance reads plan §4 (routing and ownership) or every core Plan review item. |
| Next action | Owner reviews the GCW correction head, then runs one GCW probe; Owner decides the CRQ acceptance reading |
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
- 2026-10-17 AR2 CP2 review fix: the push-order fresh-reader case now supplies `docs/agent-loops.md`; native test header shows 30 tests (`00f7223`).
- 2026-10-17 AR2 CP3 correction: Main asks the Owner about capped findings with the structured question tool and the same options; native test assertion updated (this commit).
