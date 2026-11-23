# Progress — English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r4, approved by the Owner on 2026-11-21. [U1 plan](./implementation-plans/u1-foundation/plan.md) r3 and [U2 plan](./implementation-plans/u2-public-auth-profile/plan.md) r3, both delivered. [U3 plan](./implementation-plans/u3-learning-flow/plan.md) r3, Codex plan gate PASS, approved by the Owner on 2026-11-23. |
| Current unit / checkpoint | U3 (learning flow) on `i18n/u3-learning-flow` from `25655281` (origin/main after PR 196): plan r3 approved; implementation starts at CP1 in the Sonnet implementor session (plan decision 3). Codex plan review: round 1 on r1 returned CHANGES REQUIRED (7 Required, 1 Suggestion); all were confirmed against the code and addressed in r2. Round 2 on r2 resolved them and returned 1 Required (the U1 switcher's `VI (Tiếng Việt)` accessible name missing from the AC2 categories) and 1 Suggestion (which date labels CP1 and CP2 test); both are addressed in r3. Round 3 on r3 returned PASS (0 Critical, 0 Required, 1 Nit on the outcome sentence, fixed in r3 without a new round). |
| Status | U1 merged in PR 193 and U2 merged in PR 196; production stays Vietnamese because the English flag is off. U3: plan approved, implementation not started. The U1 H4 Preview check is still pending and blocks only U8. |
| Completed evidence | U1 and U2 evidence is in Git: U1 Final in `93954dfd`, U2 checkpoint, Codex round 1–6 and Owner QA evidence in `dc2fc803` (the U2 State as merged). Carried forward from U2: E2E-DEV-003 (learn smoke specs under `next dev`, base not compared) stays open in the [infrastructure problems](../infrastructure/problems.md); `ReviewSheet` reveal text and the rest of the learning screens were left Vietnamese for U3 (U2 deviation 9); payment surfaces stay for U5. |
| Accepted deviations | U3: none. U1 and U2 deviations were accepted by the Owner and are recorded in `93954dfd` and `dc2fc803`. |
| Blockers / Owner decisions | The email approach and a local-trial grant under [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) before U6. |
| Next action | The Sonnet implementor implements CP1 to CP4 and Final of U3 plan r3 and reports each checkpoint to Main. |
| Current authority | On 2026-11-23 the Owner approved U3 plan r3, granted Main one local docs commit (this one), and granted the Sonnet implementor session one local commit per U3 checkpoint plus State commits. The Codex plan review (`gpt-6.2-astra`, medium, read-only, three rounds) has run. The Codex implementation review, push, PR, merge and any hosted or Preview action are not granted. |

## Milestones

- 2026-11-21 Master plan r4 approved after three Codex plan-review rounds (PR 191, `eca348a7`).
- 2026-11-21 U1 plan r3 approved after three Codex plan-review rounds (`3523ad5f`).
- 2026-11-22 U1 CP1: next-intl foundation and translated register validation (`4d8e93f7`).
- 2026-11-22 U1 CP2: language switcher, locale cookie action, /privacy cookie sentence and shared legal date (`ac6a30f7`).
- 2026-11-22 U1 CP3: not-found, header, mobile menu, account-menu labels and homepage footer in Vietnamese and English (`be2c1491`).
- 2026-11-22 U1 Final local checks recorded (`93954dfd`).
- 2026-11-22 U1 Owner QA passed; push, PR and merge granted (`9792d0be`).
- 2026-11-22 U1 merged to main (PR 193, d2172fe8)
- 2026-11-23 U2 plan r3 approved after three Codex plan-review rounds; handed to the Sonnet implementor (`a101ede7`)
- 2026-11-23 U2 CP1: auth screens, actions and schema messages in Vietnamese and English (`af14b754`).
- 2026-11-23 U2 CP2: home page and shared flashcard UI (`9daaaa7a`).
- 2026-11-23 U2 CP3: public course catalog, detail and preview (`346f380b`).
- 2026-11-23 U2 CP4: profile page, forms and actions (`276ec434`).
- 2026-11-23 U2 first-topic message tests added (`72666b90`).
- 2026-11-23 U2 courses namespace scoping and the server-to-client boundary regression test (`9e33fe89`).
- 2026-11-23 U2 Final local checks recorded; Owner QA pending (`a0fbe600`).
- 2026-11-23 U2 preview E2E failure investigated: 30 of 30 on a production build for the candidate and the base, recorded as E2E-DEV-002 (`4ea7955c`).
- 2026-11-23 U2 Codex round 1 corrections: Zod received-type names (`41b796a2`), flashcard and courses delivery (`e0fc98f2`), English count grouping (`6e74e5b5`).
- 2026-11-23 U2 round 1 evidence: final base and candidate pair, AC2 leftover list, the real flag-on recheck and the learn smoke reruns (E2E-DEV-003) recorded (9b4eaec1)
- 2026-11-23 U2 Codex round 2 corrections: learner progress grouping (`70b3bf59`), stale-language messages after a language switch (`3c03c40c`), AC2 `B2 QA` list and E2E status corrections (56ebcbb8)
- 2026-11-23 U2 Codex round 3 corrections: action strings tagged with the server locale, late sign-in focus, toasts that follow the displayed language, and the evidence rerun on the final code `1ebe23e9` (36524d1a)
- 2026-11-23 U2 Codex round 4 corrections: message-key remedy on a locale mismatch, profile toasts emitted by the sidebar and the test setup fix in `d0d96cf0` (eccd7207)
- 2026-11-23 U2 Codex round 5 corrections: message key and params recorded by the action instead of a text lookup, with every check and the AC1/AC2 evidence rerun on `1f625958` (95ce8eda)
- 2026-11-23 U2 AC8 route-table comparison recorded for the final code `1f625958`: base, flag-off candidate and flag-on candidate identical, 35 routes (bcad2a82)
- 2026-11-23 U2 Owner QA passed, deviations (1)–(13) accepted, Codex round 6 recorded; push and PR granted (`dc2fc803`).
- 2026-11-23 U2 merged to main (PR 196, `25655281`).
- 2026-11-23 ENLOC-002 resolved; U3 plan r3 approved after three Codex plan-review rounds, on `i18n/u3-learning-flow` (this commit).
