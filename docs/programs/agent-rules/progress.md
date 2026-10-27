# Progress — Agent rules

Plans: [AR1 detail plan](./implementation-plans/ar1/plan.md), [AR2 detail plan](./implementation-plans/ar2/plan.md), [AR3 detail plan](./implementation-plans/ar3/plan.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AR3 plan](./implementation-plans/ar3/plan.md) r3, Owner-approved 2026-10-27 |
| Current unit / checkpoint | AR3 CP1–CP4 committed locally as `f49d5099`; Owner-requested audit corrections restore runtime cleanup, reconcile CI waiting and centralize the CI attempt limit. Correction re-review pending. AR2 remains merged (PR 163, `5dbcbce`). |
| Status | automated checks passed |
| Completed evidence | Plan commit `c0964167`; implementation author review passed. Validator/eval-tool tests 167/167 and docs-checker tests 27/27 passed after Git-fixture permission failures were resolved by rerunning outside sandbox. Final docs:check: 0 structure violations / 0 broken links. Skill validator: 14 valid skills, 1 non-blocking Playwright length warning. Suite validation: 33 files / 232 cases valid. Static checks: 14 symlinks expose 78 files, 3 imports resolve, 12 ask patterns match positive/negative command examples. These are historical implementation checks. A separate app audit of `747dfbdf` returned static PASS, but subsequent author audit found the three issues corrected here; that PASS does not cover this correction. Correction checks: 14 skills valid (the existing Playwright length warning remains), 33 suites / 232 cases structurally valid, docs:check passed and git diff --check passed. No live Claude approval-prompt/browser evidence exists. |
| Accepted deviations | None to the Spec. CP1–CP4 form one coherent implementation commit because shared-source retirement, consumer routing and compatibility must land together. Existing docs/checker migration remains deferred. |
| Blockers / Owner decisions | The three Owner-approved audit findings are corrected locally; correction re-review and live Claude approval-prompt evidence remain pending. Structural checks do not substitute for them. |
| Next action | Obtain separately authorized independent re-review of the corrected candidate before claiming review readiness. No push/PR authority is active. |
| Current authority | Owner authorized correction of the three audit findings and a local correction commit. No push, PR, merge, extra model execution, browser or database action. |

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
- 2026-10-27 AR3 r3 approved after independent plan review PASS; local plan/implementation commits authorized (`c0964167`).
- 2026-10-27 AR3 CP1–CP4 implemented and deterministic checks passed; independent implementation/runtime review pending (`f49d5099`).
- 2026-10-27 Corrected runtime cleanup and CI waiting; CI attempt limit now has one lifecycle owner (this commit).
