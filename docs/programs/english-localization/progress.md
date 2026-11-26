# Progress â€” English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r6 (2026-11-26: decision 8 and section 5 steps 5 and 8, auth emails follow the interface language and the hosted templates precede the flag; Owner decision, no Codex round). r5 (2026-11-24, two-step release: step A public and student screens, step B teacher and admin; decisions 6 and 7, units U9 to U11, U5 narrowed to student payments), drafted on `docs/enloc-student-first-release`; Codex plan gate (`gpt-6.2-astra`, medium, read-only) round 1 CHANGES REQUIRED (8 Required, 1 Suggestion), round 2 CHANGES REQUIRED (4 Required, 1 Nit), round 3 PASS (0 Critical, 0 Required, 2 Nits fixed without a new round); approved by the Owner on 2026-11-24. r4 was approved on 2026-11-21. Delivered detail plans: [U1](./implementation-plans/u1-foundation/plan.md) r3, [U2](./implementation-plans/u2-public-auth-profile/plan.md) r3, [U3](./implementation-plans/u3-learning-flow/plan.md) r3, [U9](./implementation-plans/u9-teacher-admin-lock/plan.md) r3, [ENLOC-004 fix](./implementation-plans/enloc-004-workspace-language-switch/plan.md) r1. [U7](./implementation-plans/u7-legal-pages/plan.md) r1 (approved 2026-11-25, with its English wording), [U5](./implementation-plans/u5-student-payments/plan.md) r3 (approved 2026-11-25 after three Codex plan-review rounds). |
| Current unit / checkpoint | None open. Step A is live: U8 merged (PR 204, `ea26c35d`) and its release runbook (section 5 of the [U8 detail plan](./implementation-plans/u8-step-a-release/plan.md) r4) finished on 2026-11-26. Step B units U4 and U10 may open next, each with its own plan. |
| Status | U1 (PR 193), U2 (PR 196), U3 (PR 197), U9 (PR 199), the ENLOC-004 fix (PR 200), U7 (PR 201), U5 (PR 202), U6 (PR 203) and U8 (PR 204) are merged. Production serves English on the public, auth, profile, learning and student payment screens for visitors who choose it (`ENGLISH_UI_ENABLED=1`, deployment `vocaspace-65863tgbn`, commit `ea26c35d`); the teacher and admin areas stay Vietnamese (no `ENGLISH_UI_STEP_B_ENABLED`); the hosted Auth emails follow the interface language. Step B (U4, U10, U11) remains. |
| Completed evidence | U1 to U8 pre-merge evidence is in the milestone commits below (U8: `e3c3840b`, `5f6adc32`, `2a5f6b41`, `9e46224b`, `dc04784a`). U8 release, 2026-11-26: main CI run 45804859944 passed every job on `ea26c35d`, and production served that commit with the flag off. Runbook step 1: the hosted confirmation subject was the Supabase default "Confirm Your Signup" with a Vietnamese body, the recovery subject and body were Vietnamese, Site URL `https://vocaspace.com`, redirect allowlist `https://vocaspace.com/**` only (marker not listed); saved to a scratchpad file. Step 2 (flag off): marker `https://vocaspace.com/?lang=en` added to the allowlist, both subjects and templates replaced with those of `supabase/config.toml` and `supabase/templates/` at `ea26c35d`; after a reload every changed field read back equal to the repository. Step 3 (flag off): a register submit for an existing unconfirmed Owner fixture and a forgot-password submit for a confirmed Owner account sent "Xác minh email VocaSpace" and "Đặt lại mật khẩu VocaSpace" with Vietnamese bodies and today's link structure, read by the Owner. Step 4: `vercel env ls` showed no `ENGLISH_UI_*` entry before; the Owner added `ENGLISH_UI_ENABLED=1` and redeployed; `vocaspace-65863tgbn` (`ea26c35d`, source redeploy) serves `vocaspace.com`; no step B entry. AC7 read-only on `vocaspace.com`: signed out, fresh requests with the `en` cookie gave `lang="en"`, English text and the switcher on `/`, `/courses`, `/login`, `/register` and `/forgot-password`; with no cookie and a Vietnamese-first `Accept-Language`, `lang="vi"` and Vietnamese text on `/`, `/courses` and `/login`; `vi` and `en` requests alternated in both orders with no mismatch. Signed in by the Owner in the built-in browser with the `en` cookie: student `/`, `/courses`, `/learn` and `/profile` English, no topic link in their HTML and no topic request; teacher `/teacher/courses` and the `/teacher` 404, admin `/admin`, `/admin/courses`, `/admin/user-management` and an `/admin` 404 gave `lang="vi"`, Vietnamese text and no switcher (the known ENLOC-005 label aside). Step 5 (flag on): in fresh Playwright contexts with topic routes aborted (none requested), a register submit for the unconfirmed fixture and a forgot-password submit for the confirmed account per locale sent "Verify your VocaSpace email" and "Reset your VocaSpace password" in English with `en`, and "Xác minh email VocaSpace" and "Đặt lại mật khẩu VocaSpace" in Vietnamese with `vi`; the Owner read all four. No link in these emails was opened. |
| Accepted deviations | U1, U2 and U3 deviations were accepted by the Owner and are recorded in `93954dfd`, `dc2fc803` and `7caa3a8c`. U9: three bounded deviations and the known limitations R2-2 and R3-1 were accepted by the Owner on 2026-11-25; details in `52edcb82`. ENLOC-004: three bounded deviations (the optional `resumeAttempt` and `onResumed` props on `QuestionResponse`, the layout-provided store object written from an effect, H2 confirmed in the browser) were reviewed by Main and shipped in PR 200; details in `6e4cfc7d`. U5: the AC1 exception for the Next route-announcer `alert` line on the QR state, accepted by the Owner on 2026-11-25; details in `b9cbaf8e`. U8 AC0: the Preview needs Vercel login, so the two contexts were one built-in browser tab signed in by the Owner, sending `fetch` requests with `cache: no-store` and a different `NEXT_LOCALE` cookie and `Accept-Language` per request, in both orders; it checks that no response was served with another request's locale but not separate browser caches (AC7 repeats H4 with fresh contexts, see below), and `vercel curl` was not used because it may create a project bypass secret. Accepted by the Owner on 2026-11-26 after the U8 Codex implementation review round 1: U8 AC0 used one Owner-signed-in tab instead of two fresh contexts (Vercel login), with every response `x-vercel-cache: MISS`; AC7 repeats H4 on production with two fresh signed-out contexts in both orders right after the flag goes on, and any mismatch turns the Production flag off at once. U8 AC6 ran without a request-abort rule (the built-in browser cannot block requests): pages were read by HTML fetch, only `/profile` was opened, its links were `/courses` and `/learn`, the student had no enrollment and the resource log shows no topic or resume request; `/learn/<course>` was not reachable; AC7 runs any page with topic links in a Playwright window with the G3 abort rule, signed in by the Owner. U8 AC1 adds the allowlist category "never rendered" for the 20 hits listed in the CP1 evidence, which the master invariant already keeps unchanged. U8 release: runbook step 3 was submitted by the Owner, not the agent, and its unconfirmed fixture is an Owner plus-address account created for the release, which stays unconfirmed on production as a future fixture. `ENGLISH_UI_ENABLED` was added for Production and Preview together instead of Production only, so later Preview builds also show English; the Owner may remove the Preview target in the Vercel UI. |
| Blockers / Owner decisions | None blocking. Open Owner choices: keep or reset the local `voca_space` progress left by U8 QA; delete or keep the flag-on U8 Preview deployments; remove the Preview target of `ENGLISH_UI_ENABLED`; keep or delete the production plus-address fixture. |
| Next action | Plan the first step B unit (U4 or U10) when the Owner opens it. |
| Current authority | Owner 2026-11-26: record the U8 release in State and close ENLOC-001 on a new docs branch, with commit, push and PR. Not granted: merge, any further Vercel or Supabase change. |

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
- 2026-11-25 ENLOC-004 CP1 and Final code: a topic-layout store carries the question-step view state across the workspace remount, with tests for AC1 to AC6; the Final browser check was blocked at that point by a stopped Docker engine (`7f1b48c7`).
- 2026-11-25 ENLOC-004 State recorded after the final regression on `7f1b48c7` (`9f2b7615`).
- 2026-11-25 ENLOC-004 Final browser check on a flag-on production build (AC1 incorrect, AC5, H2) and the AC7 route table equal to base recorded; AC2 browser check is a fixture gap (`516b47cd`).
- 2026-11-25 ENLOC-004 QA by Main passed: local flag-on production build of `516b47cd` (code `7f1b48c7`), seeded student on `b2-qa-progress-topic-2` reset to a fresh state from a backup of its 7 progress rows (topic progress, card review and 5 answers) and restored afterwards; rating the card changed the page key, a wrong memory-check answer then an EN to VI switch kept the memory step, question, chosen option, outcome and explanation in Vietnamese (AC2), and a reload landed fresh with no outcome (AC5); no finding (`6e4cfc7d`).
- 2026-11-25 ENLOC-004 fix merged to main (PR 200, `fffaaded`).
- 2026-11-25 U7 opened before U5 on `feat/english-localization-u7-legal-pages`; plan r1 with its English wording approved by the Owner; Main implements (`13725710`).
- 2026-11-25 U7 CP1 and Final by Main: Vietnamese bodies moved unchanged, English pages from the approved Appendix, `test:ci` 3019 passed, flag-off route table equal to base, flag-on browser check (AC1, AC2, AC4); Owner QA passed and delivery granted (`8565f25d`).
- 2026-11-25 U7 merged to main (PR 201, `70c12e11`).
- 2026-11-25 U5 opened on `feat/english-localization-u5-student-payments`; plan r3 approved after three Codex plan-review rounds (round 3 fix accepted in place); Main implements (`5363819a`).
- 2026-11-25 U5 CP1: pending-payment card, payment history and `getPaymentHistory` in Vietnamese and English; flag-off snapshot pair equal to base (`cdf66707`).
- 2026-11-25 U5 CP2: checkout, discount and QR stages and their actions in Vietnamese and English; flag-off snapshot pair equal to base (`d67baf04`).
- 2026-11-25 U5 Final local checks on `d67baf04`: `test:ci`, payment integration files, full production-build E2E, AC1, AC2, AC8, AC9 and AC10 recorded; Owner QA next (`a0d2a006`).
- 2026-11-25 U5 Owner QA passed with no finding; Codex implementation review next (`00f5895f`).
- 2026-11-25 U5 Codex implementation review round 1 CHANGES REQUIRED (5 Required), corrected in `1f4668f0`; AC1 announcer exception accepted by the Owner; round 2 next (`c1f93ef3`).
- 2026-11-25 U5 Codex implementation review round 2 PASS; final regression on `1f4668f0`, full E2E 97 of 97 (`b9cbaf8e`).
- 2026-11-25 U5 merged to main (PR 202, `1c379999`).
- 2026-11-26 U6 opened on `feat/english-localization-u6-auth-emails`; State caught up with the U5 merge; the U6 detail plan waits for the ENLOC-001 decision (`2a5de279`).
- 2026-11-26 ENLOC-001 approach (c) chosen by the Owner and probed on the local stack; U6 plan r1 drafted for Codex plan review (`3d537069`).
- 2026-11-26 U6 plan r3 after Codex plan-review rounds 1 and 2 (`714506e1`).
- 2026-11-26 Master plan r6 (decision 8) and U6 plan r4 after Codex round 3 at its cap, its findings fixed in place (`380981f9`).
- 2026-11-26 U6 plan r4 approved; U6 CP1: auth emails follow the interface language through the fixed marker, with unit tests and the local Auth trial (AC2, AC3, AC5, AC6) (`ec53cf2f`).
- 2026-11-26 U6 Final: AC1, AC4 and AC7 on local production builds, the three auth integration files pass; A2 G1 conflict accepted by the Owner (`759da097`).
- 2026-11-26 Main's local-commit rule added to `.claude/rules.md` (`7ed19eeb`).
- 2026-11-26 U6 Owner QA passed on screenshots of the four local Auth emails (English and Vietnamese confirmation and recovery); push, PR, CI wait and merge granted (`d0856b57`).
- 2026-11-26 U6 merged to main (PR 203, `a1b0163b`).
- 2026-11-26 U8 plan r4 approved after three Codex plan-review rounds, round 3 findings fixed in place (`093dfd06`).
- 2026-11-26 U8 CP0: H4 Preview check (AC0) passed on the U8 branch Preview (`bee6044e`).
- 2026-11-26 U8 CP1: AC1 scan found no untranslated student string; no product change (`f31d20f4`).
- 2026-11-26 U8 CP2: local English run, lock recheck and flag-off checks passed (`e3c3840b`).
- 2026-11-26 U8 CP3: Preview read-only smoke passed for student, teacher and admin; Preview variable removed (`5f6adc32`).
- 2026-11-26 U8 Final: Codex implementation review round 1 findings corrected; three deviations accepted by the Owner (`2a5f6b41`).
- 2026-11-26 U8 Final: Codex implementation review round 2 findings corrected (`9e46224b`).
- 2026-11-26 U8 Final: Codex implementation review round 3 PASS (`dc04784a`).
- 2026-11-26 U8 merged to main (PR 204, `ea26c35d`).
- 2026-11-26 Step A live: hosted Auth templates installed, `ENGLISH_UI_ENABLED` on for Production, AC7 and the auth emails confirmed; ENLOC-001 resolved (this commit).
