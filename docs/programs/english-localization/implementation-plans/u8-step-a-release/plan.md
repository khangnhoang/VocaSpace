# U8 detail plan — Step A: enable English for public and student screens

Revision: r4, 2026-11-26. Owner approval: 2026-11-26. Master plan: [plan.md](../../plan.md) (section 4 row U8, section 5 steps 4, 5 and 8, decisions 5 to 8).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after the H4 gate passes, the U8 PR merges with the English flag off, and the release runbook in section 5 completes under its grants, production serves English on the public, auth, profile, learning and student payment screens to a visitor whose cookie or browser asks for it, auth emails follow that language, and the teacher and admin areas stay Vietnamese.

| ID | Observable result |
| --- | --- |
| AC0 (H4 gate) | Before CP1, on a Vercel Preview of the U8 branch built with `ENGLISH_UI_ENABLED=1` for that branch's Preview only (State records the commit, deployment URL and variable read-back): two fresh signed-out browser contexts, carrying a locale cookie only where the case needs one, request `/`, `/courses` and one course detail in both orders (Vietnamese then English, English then Vietnamese), and each gets its own `lang`, content and metadata; an `en` cookie beats a Vietnamese-first `Accept-Language`. On the serving flag-off production deployment, an `en` cookie still gets Vietnamese (read-only GET). If any request gets another context's locale, or a cache-critical route regresses, U8 stops before CP1. |
| AC1 | A scan of every source that supplies text to a user on the step A scope reports zero unexplained Vietnamese UI strings. Sources: non-test `.ts`/`.tsx` outside the paths used only by the teacher and admin areas (usage established by import search, not by folder name), every `messages/en/*.json`, the English branches of `supabase/templates/*.html`, and the English subjects in `supabase/config.toml`. Each remaining hit is in an allowlist category: code comment, teacher learning content or sample deck, test or fixture data, user data, `LOCALE_NAMES`, the Vietnamese catalog or template branch, the PayOS order description, or a string used only by the teacher or admin areas. State records the hits by category and every fix. |
| AC2 | On a local production build of the release candidate with `ENGLISH_UI_ENABLED=1` and the `voca_space` stack, a student with the `en` cookie runs in English, with no Vietnamese outside AC1's allowlist: home, catalog, course detail, sign-up, sign-in, forgot password, profile with payment history, the `/learn` dashboard with its pending-payment card, a learning session (rate cards and answer an exercise), and the course-page checkout QR stage reopened from the seeded `b2-qa-payment-2` through `resumePendingCheckout` (no PayOS call). The public preview runs on the isolated `voca_space_e2e` stack against a flag-on build pointed at that stack: a scratchpad script creates the fixture with `createD2PreviewBrowserFixture` (as `e2e/d2/public-course-preview.spec.ts` does), opens the preview while the fixture exists, confirms a known card or question, and calls `cleanup()` in a `finally`. Switching to Vietnamese mid-session shows Vietnamese without an error. |
| AC3 | On the AC2 build, the ENLOC-004 case holds: after rating cards and answering in English, switching language keeps the outcome and shows the other language. |
| AC4 | On the AC2 build with the step B flag off, U9 AC2, AC3, AC4 and AC6 hold again in the locked state: direct loads (with an `en` cookie, and with no cookie and an English-first `Accept-Language`) of `/teacher/courses`, `/admin`, `/teacher/missing`, `/admin/missing`, and `/teacher/missing.png`, `/admin/missing.png` as U9 recorded them; real-link navigation in both directions (student page into each locked area and back, and from a direct load of each locked page to a student page), recording after each step `lang`, a client-provider label, title, description and the cookie; a locale-dependent Server Action from a teacher page and an admin page gives Vietnamese while the same action from a student page gives English; the upload route 401 keeps today's Vietnamese text, status and shape; no response sets `NEXT_LOCALE`. If a temporary probe action is needed, as in U9, State labels which results came from the unmodified candidate and which from the probe build. |
| AC5 | On a local flag-off build of the final commit, an `en` cookie and an English-first `Accept-Language` get Vietnamese, and the `next build` route table equals that of base `a1b0163b`. The existing Vitest and Playwright suites pass with their Vietnamese assertions unchanged. |
| AC6 | On a Preview of the release candidate (the AC0 Preview if CP1 changed no product code, otherwise a new one built after CP2), a read-only smoke passes: public pages in English; an Owner-provided student account on routes cleared by G3 in English; one teacher page and one admin page (Owner-provided accounts) in Vietnamese with the `en` cookie. A missing account, missing data or no cleared route set stops U8; no partial evidence enables the flag. |
| AC7 | After the release runbook: on the serving production deployment, a visitor with the `en` cookie sees the public and student screens in English and the teacher and admin areas in Vietnamese; with no cookie and a Vietnamese-first browser, Vietnamese. U6 runbook steps 3 and 5 confirm the auth emails. |

### 1.2 Scope and non-goals

- In scope: the H4 gate, the AC1 scan and fixes for real leftovers in the step A scope (with tests in the owning area), the local English run, the Preview smoke, the release runbook, program State and closing ENLOC-001 on the runbook evidence.
- Non-goals: teacher and admin translation (U4, U10) and the step B flag (U11); a permanent flag-on Playwright project or spec (Owner decision 2026-11-26); ENLOC-003 itself; any Vietnamese wording change; hosted data changes other than the Auth subjects, templates and allowlist and the emails the runbook sends to Owner fixtures; Vercel settings other than the U8-branch Preview `ENGLISH_UI_ENABLED` variable (agent) and the Production one (Owner).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. A leftover fix keeps the Vietnamese text exact (moved to the catalog unchanged) and follows the owning unit's pattern (namespace, provider, server-locale tagging); the parity test and the area's English test cover it. | Vietnamese regresses, or a fix bypasses the catalog conventions and the parity check. |
| G2. A hit is allowlisted only by its AC1 category; any other hit is fixed or returned to the Owner. A string shared by a student screen and the teacher or admin areas is in scope. | The audit passes with untranslated student text. |
| G3. Preview and production share one Supabase project, so every hosted check outside the runbook is read-only: GET pages and sign in with Owner-provided accounts; no form submit, enrollment, payment, rating or answer. Before AC6 and AC7, trace each chosen page in source for render-time writes and for the links it prefetches; drop any page that writes, and run the browser context with a request rule that aborts every request to a learning topic route (`/learn/...` topic pages and their RSC prefetches) and records each abort. A page whose automatic requests cannot be shown safe is dropped. | A hosted smoke or a prefetch writes learner progress or payment data (ENLOC-003). |
| G4. Preview variable lifecycle, all through the Vercel CLI: link the checkout with `vercel link` to the project that serves the production domain (local, gitignored `.vercel/`); read back `vercel env ls` (names, environments and branches only, never values) and stop if any `ENGLISH_UI_ENABLED` or `ENGLISH_UI_STEP_B_ENABLED` entry already covers Preview or Production; add `ENGLISH_UI_ENABLED=1` for Preview and the U8 branch only, once, before CP0; keep it through CP3, so every Preview of this branch in between is flag-on by design; remove it with `vercel env remove` after CP3, or at once when U8 stops at any point, and read back that it is gone. Each Preview used as evidence is a deployment created after the variable was added (a push under the push grant), recorded by commit and URL, with its flag state confirmed on the page (switcher present). Whether to delete the flag-on Preview deployments afterwards is the Owner's call. | English leaks into Production or other Previews, the variable outlives U8, or a stale build is mistaken for evidence. |
| G5. Each runbook step runs only under its own Owner grant, in U6 runbook order, and stops at its first failure with that step's rollback. Step 1 saves the current subjects, templates and allowlist before anything changes. Steps 3 and 5 are the only hosted writes through the app, each done by the agent: per confirmation email, one register submit with the Owner's existing unconfirmed fixture email, an unused invented username, invented profile fields and no avatar (`signUpUser`'s `admin.createUser` fails on the existing email, so no user is created, and its `resend` sends exactly one email; Resend is not pressed); per recovery email, one forgot-password submit with the confirmed fixture's email. | A failed hosted change cannot be undone, or the flag goes on before Vietnamese emails are confirmed (decision 8). |
| G6. In a browser the Owner signed into (Supabase Dashboard, Vercel), act only on the named project and settings; never sign out, change credentials or read secrets. On a Preview or production page the agent never types a password: the Owner signs each account in, and types the password of any form that needs one, in the built-in browser pane. | The agent changes an unrelated setting, exposes a secret or handles a real account's password. |

### 1.4 Owner decisions that bind this unit

- Master decisions 5 to 8.
- 2026-11-26: the English E2E evidence (AC2 to AC4) is one local run on a flag-on production build through Playwright CLI, recorded in State; no permanent flag-on suite is added.
- 2026-11-26: the agent sets and removes the Preview-only `ENGLISH_UI_ENABLED=1`, under the grant for that step. Because Vercel MCP cannot delete a variable, the Owner chose the Vercel CLI with a local `vercel link` (G4), which also matches the CLI-first rule in `AGENTS.md`.
- 2026-11-26: the agent performs the hosted Auth step on the Supabase Dashboard in a browser the Owner signed into, under the grant for each runbook step.
- 2026-11-26: the agent makes the confirmation-email triggers of runbook steps 3 and 5 through one register submit each, as G5 defines them.
- 2026-11-26: the Owner sets `ENGLISH_UI_ENABLED=1` for Production in the Vercel UI and redeploys (U6 runbook step 4); the agent confirms AC7 on the serving deployment.

## 2. Repository facts

Baseline: `a1b0163b` (origin/main after PR 203), checked 2026-11-26.

- `lib/i18n/config.ts` reads `ENGLISH_UI_ENABLED` and `ENGLISH_UI_STEP_B_ENABLED`, on only when exactly `"1"`, server-only and baked into static routes at build time — justifies a new deployment for every flag change and G4's evidence rule.
- Preview deployments share the production Supabase project (auth-onboarding [A1 plan](../../../auth-onboarding/implementation-plans/a1/plan.md) line 221, [A4 plan](../../../auth-onboarding/implementation-plans/a4/plan.md) line 60) — justifies G3 on every hosted check.
- `getLearningWorkspace` calls `syncTopicProgress` during render (`app/actions/learning-workspace.ts` line 591), and ENLOC-003 observed prefetch from an overview page completing topics — justifies G3's prefetch rule.
- No `vercel.json`; `docs/sop/production-release-gate.md` gates domain promotion on `production-gate` and rolls back from the Vercel dashboard — justifies confirming the serving deployment before runbook step 4.
- No E2E spec runs with the flag on; `playwright.config.ts` line 50 pins `vi-VN`; `.claude/launch.json` lines 31 and 41 have flag-on and flag-off `next start` configurations on ports 3100 and 3101 — justifies AC2 to AC4 as one local run.
- No committed diacritics audit exists; U2, U3 and U5 ran scratchpad scans over rendered text and recorded the leftovers in State — justifies AC1's recorded hit list.
- The seed already has `b2-qa-payment-2` (`supabase/seed.sql` line 821); U5 H6 reopened its QR stage by backing up the row, setting a fake `qr_code` and `checkout_url` in `gateway_metadata` and restoring it — justifies AC2's fixture.
- The local seed has no public preview topic; U2 H6 used the D2 E2E fixture on the isolated stack — justifies AC2's public preview route.
- U6 AC4 passed locally (flag off, on, off again: emails follow the flag), so one flag change controls interface and emails and no decision 5 exception is needed (`759da097`).

## 3. Bounded implementation hypotheses

- The AC1 scan is a scratchpad script matching `[̀-ͯđĐ]` on NFD text, with comments stripped from code, over the AC1 sources; a teacher- or admin-only exclusion is decided by import search. The script may change if every non-comment Vietnamese literal in those sources is still listed.
- No leftover fix is expected, so U8 may ship no product code; a fix found by AC1 lands in CP1 in the owning area, and then AC6 needs a new Preview.
- The cleared student route set is likely `/courses`, a course detail and `/profile`; `/learn` stays out unless G3's trace shows its topic links are not prefetched or the abort rule covers them.
- The AC2 public preview run may instead reuse the U2 snapshot scripts rebuilt in the scratchpad, if it still uses the D2 fixture on the isolated stack.

### QA fixture readiness

- QA type: local browser run (AC2 to AC5), hosted read-only checks (AC0, AC6, AC7) and runbook emails.
- Canonical fixture source: `supabase/seed.sql` on `voca_space` (student, teacher and admin accounts, enrolled course with cards, `b2-qa-payment-2`); the D2 E2E fixture on `voca_space_e2e` for the public preview.
- Missing states: QR data on `b2-qa-payment-2`; hosted accounts.
- Required fixture additions: the U5 H6 backup, fake `gateway_metadata` and restore around the AC2 run, including after a partial run; State records the before and after rows. No seed change.
- Hosted inputs from the Owner, confirmed before CP3 and before runbook step 1: AC6 student, teacher and admin accounts (also used for AC7); for the runbook, one existing unconfirmed account and one confirmed account whose inboxes the Owner reads.
- Confirmation trigger: the register form has no password field, and `signUpUser` (`app/actions/auth.ts` lines 137–156) calls `admin.createUser` and then `resend` whatever the email's state. CP2 checks on the local stack that one register submit with an existing unconfirmed email and an unused username leaves the `auth.users` and `profiles` counts unchanged and sends exactly one confirmation email. If it does not, U8 stops and the Owner decides another trigger before runbook step 1. Before step 1 the Owner confirms the fixture email exists and is unconfirmed, because on an unknown email the same submit would create a real user.
- Reset/setup command: none on `voca_space`; the isolated stack follows `scripts/e2e/run-e2e.mjs` with `E2E_KEEP_SUPABASE=1` and is stopped afterwards under the local runtime rule.
- Browser QA may begin when: the flag-on build serves and the QR data is in place (AC2), and the D2 fixture exists (public preview).

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | AC0 passes on a Preview of the U8 branch. Needs a push grant for the branch and the Vercel grant (link, add, later remove). | G4 read-back before and after adding; deployment URL and commit in State; two fresh browser contexts. |
| CP1 | AC1 scan classified; any leftover fixed with tests; State records the hits. | Scan output; affected Vitest files and `__tests__/utils/i18n.test.ts`; `npx tsc --noEmit`; `npm run lint`. |
| CP2 | AC2 to AC5 on local builds of the CP1 commit. | Playwright CLI on the flag-on build; fixture restore confirmed; the confirmation-trigger check in QA fixture readiness; flag-off route table compared with base; `npm run test:ci`; E2E specs affected by a CP1 fix, if any. |
| CP3 | AC6 on a Preview of the release candidate; the Preview variable is removed. | G3 route trace and abort log; G4 read-back; deployment URL and commit in State. |
| Final | Whole-diff self-review, Codex implementation review (required for this unit; its own grant), final regression on the final commit. | test-quality-strategy final regression. |

After Final the PR merges under its own grant with the flag off, then section 5's runbook.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A cache serves one locale's page to another visitor. | AC0 before any other work; stop on any mismatch. |
| A hosted check writes learner data. | G3 read-only rules, route trace and topic-route abort. |
| The new hosted templates break emails. | U6 runbook step 3 with the flag off; rollback to the saved templates. |
| A stale flag-on Preview is used as evidence or the variable leaks English. | G4 read-back, a recorded deployment per check, removal after CP3 or on any stop. |
| The flag goes on with a missed leftover. | AC1 and AC2; rollback is flag off and a new deployment. |

- Rollout runbook (after the U8 PR merges and its production deployment serves the production domain through `production-gate`; numbers are the U6 runbook steps; each step under its own Owner grant):
  1. Agent, Supabase Dashboard: confirm the serving deployment is the merged U8 commit and is flag-off (an `en` cookie gets Vietnamese, no switcher); save the current confirmation and recovery subjects, templates and redirect allowlist to a scratchpad file, noting whether `https://vocaspace.com/?lang=en` is already allowed. No change yet.
  2. Agent, Supabase Dashboard, English flag still off: add the marker to the allowlist if absent and install the merged subjects and templates from `supabase/config.toml` and `supabase/templates/`; read every changed field back. If any save fails or a read-back differs, restore step 1's saved values for every field already changed (this step's grant covers that restore), read them back, keep the flag off and stop.
  3. On the serving deployment: the agent makes one register submit for the unconfirmed fixture and one forgot-password submit for the confirmed fixture, as G5 defines them. The Owner confirms both emails are Vietnamese with today's link structure. On failure: restore step 1's saved values (removing the marker only if step 2 added it), confirm one confirmation and one recovery email arrive, keep the flag off and stop.
  4. Before this step the agent confirms the serving deployment is still the merged U8 commit, and reads `vercel env ls` (names, environments and branches only); if a Production `ENGLISH_UI_STEP_B_ENABLED` entry exists, the Owner confirms its value is not `1`; if it is `1` or cannot be confirmed, the English flag stays off and U8 stops for a separate Owner decision. State records both. The Owner sets `ENGLISH_UI_ENABLED=1` for Production in the Vercel UI and redeploys; the step B flag stays off. The agent confirms the new deployment serves the production domain and checks AC7's interface part read-only.
  5. The same triggers as step 3, each once with the `en` cookie and once with the `vi` cookie (set through the switcher); the Owner confirms subject, body and link of all four. On a template, subject or link failure: restore step 1's saved values as in step 3 and record the release as not passed; the interface stays on unless the Owner turns the flag off.
  6. Record the release in State; close ENLOC-001 when steps 3 and 5 passed.
- Stop when: AC0 fails; AC1 has an unclassifiable hit; AC2 to AC6 fail or lack an account, data or cleared route set; a G4 read-back shows an unexpected entry; any runbook step fails.
- Rollback: before release, revert the PR. Interface: the Owner sets the Production variable off (or removes it) and redeploys, confirmed on the serving deployment. Auth: restore step 1's saved values and confirm one confirmation and one recovery email. Emails already sent cannot be recalled.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
