# Progress — English localization

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [Master plan](./plan.md) r4 and [U1 plan](./implementation-plans/u1-foundation/plan.md) r3, both approved by the Owner on 2026-11-21. |
| Current unit / checkpoint | U1 implementation on `docs/english-ui-u1-plan` from `ee0cc266`: [U1 plan](./implementation-plans/u1-foundation/plan.md) r3; CP1 and CP2 done, CP3 next. |
| Status | U1 CP1 (foundation and registerSchema end to end) and CP2 (language switcher, cookie action, /privacy sentence, legal date) committed locally; CP3 pending. U1 plan r3 approved. Codex review: round 1 on r1 returned 8 Required and 1 Suggestion, all confirmed and addressed in r2 with Owner decisions 9 and 10; round 2 on r2 returned 5 Required, all confirmed and addressed in r3; round 3 on r3 returned PASS with 1 Nit (CP2 wording), applied in r3. |
| Completed evidence | Repository discovery on `dab3e640`: string counts and baseline facts recorded in the master plan, section 3. Codex round 1 on r1 (`gpt-6.2-astra`, medium, read-only) returned 8 Required and 1 Suggestion. All nine were confirmed against the repository and addressed in r2. Round 2 on r2 returned 4 Required and 1 Nit, all confirmed and addressed in r3. Round 3 on r3 returned 1 Required (circular U6 gate) and 1 Suggestion (checkout verification path). At the 3-pass cap, the Owner chose the recommended small fix without another round, and r4 applies both. No independent review has run on r4. |
| Completed evidence (U1 CP1) | `next-intl` 4.14.9 pinned exactly. Full `npm run test:run` (stale `.claude/worktrees` and `test-results` excluded): 159 files, 2479 tests pass. `npx tsc --noEmit` clean apart from stale `.next-e2e` types (that ignored build output was moved aside so `next build` could type-check). Local `next build` with `ENGLISH_UI_ENABLED=1` and a Playwright script with fresh contexts on `next start`: no cookie plus an English header, and an `en` cookie with a Vietnamese header, give `lang="en"`, the English meta description and English register field messages; a real `signUpUser` request whose FormData phone was rewritten by `page.route` returns the English form-level error; a `vi` cookie and an unknown `fr` cookie give Vietnamese. The same build run without the flag gives Vietnamese in every case. A flag-off build shows every page route dynamic (`/`, `/courses`, `/courses/[course-slug]` included); the AC9 comparison against `dab3e640` is still pending at the final step. |
| Completed evidence (U1 CP2) | Full `npm run test:run` (stale folders excluded): 162 files, 2499 tests pass; `tsc` and `eslint` on changed files clean. Local `next build` with the flag on, Playwright with fresh contexts at 1440 and 375px from an English-first header on `/courses` (`/register` uses the auth shell without the site header): choosing VI sets `NEXT_LOCALE=vi` (HttpOnly, SameSite=Lax, one year), turns `<html lang>` to `vi` with the URL unchanged, gives the Vietnamese root description and register field message, survives reload and beats the header; choosing EN reverses it. The same build without the flag, with an `en` cookie and an English header, shows Vietnamese and no switcher at either width. Mobile switcher buttons measure 44 x 44px under touch emulation. `LEGAL_LAST_UPDATED` is set to 22/11/2026 and must equal the merge date (Final check). |
| Accepted deviations | None. |
| Blockers / Owner decisions | ENLOC-002 wording chosen by the Owner on 2026-11-21 (U1 plan decision 6); it resolves when the U1 PR ships it. The email approach and a local-trial grant under [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) before U6. |
| Next action | U1 CP3: not-found, header, mobile menu, account-menu labels and homepage footer in both languages. |
| Current authority | On 2026-11-21 the Owner approved master plan r4 and granted its commit, push, PR, CI wait and merge on green CI. On 2026-11-21 the Owner asked for the U1 plan on a new branch and a Codex plan review (`gpt-6.2-astra`, medium). The Owner approved U1 plan r3 and granted a local commit of the plan docs only; push, PR and U1 implementation are not granted. On 2026-11-22 the Owner granted U1 implementation on this branch with a local commit after each checkpoint; push, PR and merge are not granted. |

## Milestones

- 2026-11-21 Master plan r4 approved after three Codex plan-review rounds (PR 191, `eca348a7`).
- 2026-11-21 U1 plan r3 approved after three Codex plan-review rounds (`3523ad5f`).
- 2026-11-22 U1 CP1: next-intl foundation and translated register validation (`4d8e93f7`).
- 2026-11-22 U1 CP2: language switcher, locale cookie action, /privacy cookie sentence and shared legal date (this commit).
