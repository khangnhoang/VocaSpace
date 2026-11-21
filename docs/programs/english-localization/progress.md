# Progress — English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r4 and [U1 plan](./implementation-plans/u1-foundation/plan.md) r3, both approved by the Owner on 2026-11-21. |
| Current unit / checkpoint | U1 planning on `docs/english-ui-u1-plan` from `ee0cc266`: [U1 plan](./implementation-plans/u1-foundation/plan.md) r3. |
| Status | U1 plan r3 approved; implementation not started. Codex review: round 1 on r1 returned 8 Required and 1 Suggestion, all confirmed and addressed in r2 with Owner decisions 9 and 10; round 2 on r2 returned 5 Required, all confirmed and addressed in r3; round 3 on r3 returned PASS with 1 Nit (CP2 wording), applied in r3. |
| Completed evidence | Repository discovery on `dab3e640`: string counts and baseline facts recorded in the master plan, section 3. Codex round 1 on r1 (`gpt-6.2-astra`, medium, read-only) returned 8 Required and 1 Suggestion. All nine were confirmed against the repository and addressed in r2. Round 2 on r2 returned 4 Required and 1 Nit, all confirmed and addressed in r3. Round 3 on r3 returned 1 Required (circular U6 gate) and 1 Suggestion (checkout verification path). At the 3-pass cap, the Owner chose the recommended small fix without another round, and r4 applies both. No independent review has run on r4. |
| Accepted deviations | None. |
| Blockers / Owner decisions | ENLOC-002 wording chosen by the Owner on 2026-11-21 (U1 plan decision 6); it resolves when the U1 PR ships it. The email approach and a local-trial grant under [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) before U6. |
| Next action | Owner decides delivery of the U1 plan commit (push, PR) and grants U1 implementation. |
| Current authority | On 2026-11-21 the Owner approved master plan r4 and granted its commit, push, PR, CI wait and merge on green CI. On 2026-11-21 the Owner asked for the U1 plan on a new branch and a Codex plan review (`gpt-6.2-astra`, medium). The Owner approved U1 plan r3 and granted a local commit of the plan docs only; push, PR and U1 implementation are not granted. |

## Milestones

- 2026-11-21 Master plan r4 approved after three Codex plan-review rounds (PR 191, `eca348a7`).
- 2026-11-21 U1 plan r3 approved after three Codex plan-review rounds (this commit).
