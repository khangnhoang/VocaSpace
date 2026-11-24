# Progress â€” English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r5 (2026-11-24, two-step release: step A public and student screens, step B teacher and admin; decisions 6 and 7, units U9 to U11, U5 narrowed to student payments), drafted on `docs/enloc-student-first-release`; Codex plan gate (`gpt-6.2-astra`, medium, read-only) round 1 CHANGES REQUIRED (8 Required, 1 Suggestion), round 2 CHANGES REQUIRED (4 Required, 1 Nit), round 3 PASS (0 Critical, 0 Required, 2 Nits fixed without a new round); approved by the Owner on 2026-11-24. r4 was approved on 2026-11-21. Delivered detail plans: [U1](./implementation-plans/u1-foundation/plan.md) r3, [U2](./implementation-plans/u2-public-auth-profile/plan.md) r3, [U3](./implementation-plans/u3-learning-flow/plan.md) r3, [U9](./implementation-plans/u9-teacher-admin-lock/plan.md) r3. [ENLOC-004 fix](./implementation-plans/enloc-004-workspace-language-switch/plan.md) r1 approved by the Owner on 2026-11-25. |
| Current unit / checkpoint | ENLOC-004 fix ([problems.md](./problems.md#enloc-004-workspace-remounts-on-a-language-switch-after-rating-cards)): [detail plan](./implementation-plans/enloc-004-workspace-language-switch/plan.md) r1, CP1 and Final code done on `fix/enloc-004-workspace-language-switch` (base `596962d4`), section 5 step 2; the Final browser check is blocked (see Blockers). |
| Status | U1 (PR 193), U2 (PR 196), U3 (PR 197) and U9 (PR 199) are merged; production stays Vietnamese because the English flag and the step B flag are off. The U1 H4 Preview check is still pending and now blocks only U8 (step A). ENLOC-004: automated checks passed on `7f1b48c7`; browser check and Owner QA pending. |
| Completed evidence | In Git: U1 Final in `93954dfd`, U2 State as merged in `dc2fc803`, U3 State as merged (checkpoint, Final, final regression and Owner QA evidence, deviations 1 to 14) in `7caa3a8c`, U9 State before merge (CP1, CP2, Final, Codex rounds 1 to 3, the F1 and R2-1 corrections and QA evidence) in `52edcb82`. Carried forward: E2E-DEV-003 stays open in the [infrastructure problems](../infrastructure/problems.md); `PendingPayments`, `PaymentHistory` and the checkout dialog stay Vietnamese for U5; [ENLOC-004](./problems.md#enloc-004-workspace-remounts-on-a-language-switch-after-rating-cards) is open; its fix must merge before U8 (r5). ENLOC-004 on `7f1b48c7`: `npx tsc --noEmit` and `npm run lint` clean; the new `__tests__/components/learning-workspace-refresh.test.tsx` (9 tests: AC1 exercise wrong and correct, AC2 memory, AC3, AC4, AC5, AC6, G3 locked step, G3 topic and question ids) passes; the existing learning-workspace, memory-check and presentation tests are unchanged and pass (`npm run test:run -- __tests__/components`: 92 files, 1333 tests); `npm run test:ci` on the final bytes: 194 files, 3014 tests passed. Not run: the Final browser check (Docker daemon not running) and AC7 route-table comparison (flag-off output is unchanged by construction: no route, flag or catalog change). |
| Accepted deviations | U1, U2 and U3 deviations were accepted by the Owner and are recorded in `93954dfd`, `dc2fc803` and `7caa3a8c`. U9: the three bounded deviations (matcher entry `/(teacher|admin)/:path*`, `new URL(request.url)` in `proxy()`, opt-in `hideSwitcherInLockedAreas` on `Header`) and the known limitations R2-2 (a malformed-escape URL such as `/%61dmin/%E0%A4%A/x.svg` reaches no proxy entry and can render the English 404) and R3-1 (a `.png.rsc` request skips one session refresh after Next strips `.rsc`) were accepted by the Owner on 2026-11-25; details in `52edcb82`. ENLOC-004 (bounded, for Main to review): (1) `QuestionResponse.tsx` gained two optional props, `resumeAttempt` and `onResumed`, because the exercise question view keeps its result in local state and reads a settled attempt only for an inherited pending one, so the workspace store alone could not show a carried outcome; the prop sets the first phase for the open question only and is consumed once (other questions keep the existing leave-and-return behavior). (2) H1 holder: the store is a read/write object created in `topic-view-state.tsx` and provided by `[topic-slug]/layout.tsx`, written from a `useEffect` in `LearningWorkspace` (a `useRef` holder failed the `react-hooks/refs` lint rule). (3) H2 (layout stays mounted across `router.refresh()`, remounts on a topic change and a reload) is supported by the Next docs (layouts preserve state; `bfcacheId` stays the same on refresh) but not yet observed in a browser; G3 also rejects a snapshot of another topic. |
| Blockers / Owner decisions | The email approach and a local-trial grant under [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) before U6. ENLOC-004 Final browser check blocked: `docker ps` fails (the Docker engine pipe `dockerDesktopLinuxEngine` does not exist), so the `voca_space` dev stack cannot run; resume needs Docker Desktop started by the Owner (no seeded student, topic or fixture was inspected). |
| Next action | Main reviews the ENLOC-004 diff; the Owner starts Docker so the implementor (or Main) can run the Final browser check (AC1, AC2, AC5 and H2), then Owner QA. |
| Current authority | Owner 2026-11-25: ENLOC-004 plan r1 approved (medium size, no Codex review) and handed to a Sonnet implementor session with local commits only on `fix/enloc-004-workspace-language-switch`. No push, PR or merge. No grant for later units. |

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
- 2026-11-23 U2 Owner QA passed, deviations (1)â€“(13) accepted, Codex round 6 recorded; push and PR granted (`dc2fc803`).
- 2026-11-23 U2 merged to main (PR 196, `25655281`).
- 2026-11-23 ENLOC-002 resolved; U3 plan r3 approved after three Codex plan-review rounds, on `i18n/u3-learning-flow` (`474cebdd`).
- 2026-11-23 U3 CP1: learning dashboard, review sheet, multi-field message recording and their actions in Vietnamese and English (`1c5922c5`).
- 2026-11-23 U3 CP2: enrolled course overview, its feedback, retry and loading states and the activity card in Vietnamese and English (`e340cfc8`).
- 2026-11-23 U3 CP3: topic learning workspace outside the question stages (steps, locks, toasts, navigator, completion panel, feedback, loading) and `getLearningWorkspace` messages in Vietnamese and English (`2f92aa02`).
- 2026-11-23 U3 CP4: memory check, exercise questions, choice labels and `submitQuestionAnswer` messages through the multi-field wrapper in Vietnamese and English (`76f885fe`).
- 2026-11-24 U3 Final: local regression and AC1 to AC10 evidence recorded on `76f885fe` with no code change at Final; integration failures compared per file against base `25655281` (`a5e23817`).
- 2026-11-24 U3 Codex round 4 PASS; final regression run once on `c134cae8` (HEAD `7cfb3b88`): `test:ci`, `tsc`, `lint`, AC1, AC2, AC8, AC9 and AC10 pass or are unchanged against base; the integration and E2E failures match base or are load timeouts (`2b9a65d2`).
- 2026-11-24 U3 Owner QA round 1: related finding fixed (English `completedCta` overflowed the 10rem action column of `CourseRow`: the column is 13rem in English and unchanged in Vietnamese, `a838b814`; EN and VI rows measured at 1440, 768 and 375 px with 0 overflow); unrelated findings recorded, not fixed: LEARN-DUE-001 (the `/learn` due count includes cards the learner cannot read, on base) in the student-user-flow-route problems and TEST-FIXTURE-001 (`memory-check-learner-gate` leaves `user_flashcards` rows) in the infrastructure problems (`8e72c957`).
- 2026-11-24 U3 Owner QA passed (round 1 findings, the overflow fix `a838b814` and the flag-on English screens); deviations (1)â€“(14) accepted; push, PR, CI wait and merge granted to Main (`7caa3a8c`).
- 2026-11-24 U3 merged to main (PR 197, `45d5c0ff`).
- 2026-11-24 Master plan r5 (two-step student-first release) approved after three Codex plan-review rounds (`918b8bfc`).
- 2026-11-24 U9 plan r3 approved after three Codex plan-review rounds (round 1 7 Required, round 2 1 Required, round 3 PASS); handed to the Sonnet implementor on `i18n/u9-teacher-admin-lock` (`9e4358be`).
- 2026-11-24 U9 CP1: step B flag, path rule, proxy path header and the Vietnamese lock in `getRequestLocale`; AC1 route tables equal base; the first navigation check shows the root `lang` and provider carry over in both directions, so the H4 layout fix goes to CP2; code in `f81a5c75` (`95fdbcb2`)
- 2026-11-24 U9 CP2: area layouts and root `not-found` own their locale and `lang`, the locked `not-found` hides the switcher, proxy tags image paths under both areas, upload 401 reads the locale; locked and unlocked H7 runs pass; code in `c5debe12` (`cd2a7d79`)
- 2026-11-24 U9 Final: whole-diff self-review, `test:ci`, `tsc`, `lint`, AC1 route tables and flag-off page checks pass on `c5debe12`; the full E2E has failures that also fail on base, reported to Main (`a84e884e`)
- 2026-11-25 U9 Codex implementation review round 1: 4 Required; integration run in the CI partition passed, the Owner chose to fix F1 in U9 (`83f881f4`).
- 2026-11-25 U9 F1 correction: percent-encoded teacher and admin paths lock to Vietnamese and skip the session refresh on their image paths (`059010bc`).
- 2026-11-25 U9 Codex round 2 correction: every raw image path that reaches proxy skips the session refresh; R2-2 accepted as a known limitation (`6894efa9`).
- 2026-11-25 U9 Codex round 3 closed at its cap with R3-1 (`.rsc` normalization) accepted as a known limitation (`55004534`).
- 2026-11-25 U9 QA passed on a local locked production build; push and PR granted (`52edcb82`).
- 2026-11-25 U9 merged to main (PR 199, `596962d4`).
- 2026-11-25 ENLOC-004 fix plan r1 approved (medium, no Codex review); handed to the Sonnet implementor on `fix/enloc-004-workspace-language-switch` (`3bec7abb`).
- 2026-11-25 ENLOC-004 CP1 and Final code: a topic-layout store carries the question-step view state across the workspace remount, with tests for AC1 to AC6; the Final browser check is blocked by a stopped Docker engine (`7f1b48c7`).
- 2026-11-25 ENLOC-004 State recorded after the final regression on `7f1b48c7` (this commit).
