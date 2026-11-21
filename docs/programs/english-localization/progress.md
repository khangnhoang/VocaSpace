# Progress — English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r4, approved by the Owner on 2026-11-21. |
| Current unit / checkpoint | None active. Planning on `docs/i18n-english-plan` from `dab3e640`. |
| Status | Not started. |
| Completed evidence | Repository discovery on `dab3e640`: string counts and baseline facts recorded in the master plan, section 3. Codex round 1 on r1 (`gpt-6.2-astra`, medium, read-only) returned 8 Required and 1 Suggestion. All nine were confirmed against the repository and addressed in r2. Round 2 on r2 returned 4 Required and 1 Nit, all confirmed and addressed in r3. Round 3 on r3 returned 1 Required (circular U6 gate) and 1 Suggestion (checkout verification path). At the 3-pass cap, the Owner chose the recommended small fix without another round, and r4 applies both. No independent review has run on r4. |
| Accepted deviations | None. |
| Blockers / Owner decisions | [ENLOC-002](./problems.md#enloc-002-privacy-wording-for-the-locale-cookie) must be settled before the U1 cookie PR, and the email approach and a local-trial grant under [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) before U6. |
| Next action | Owner opens U1 with a detail plan and an implementation grant. |
| Current authority | On 2026-11-21 the Owner approved master plan r4 and granted its commit, push, PR, CI wait and merge on green CI. No implementation or unit is granted. |

## Milestones

- 2026-11-21 Master plan r4 approved after three Codex plan-review rounds (this commit).
