# U1 detail plan — foundation and one working path

Revision: r3, 2026-11-21. Owner approval: r3 on 2026-11-21. Master plan: [plan.md](../../plan.md) (unit U1). Progress: [progress.md](../../progress.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the repository has an English-capable interface foundation behind a flag that is off by default. With the flag off, every page renders the same Vietnamese text as before. Three changes are allowed with the flag off: `<html lang="vi">` instead of the wrong `lang="en"`, the approved `/privacy` cookie sentence, and the shared legal "last updated" date. With the flag on, a visitor gets Vietnamese or English from a cookie, then the browser's `Accept-Language`, then Vietnamese. The visitor can switch language from the header, and one working path renders in the chosen language: root metadata, the root not-found page, the client header with its mobile menu, the homepage footer, and the registration validation messages on both client and server.

| ID | Observable result |
| --- | --- |
| AC1 | With the flag off, any visitor sees Vietnamese output on every route, whatever the `Accept-Language` header or locale cookie says (an `en` cookie included). `<html lang>` is `vi`, and no language switcher is rendered. |
| AC2 | With the flag on and no locale cookie, a visitor whose `Accept-Language` prefers English (for example `en-US,en;q=0.9,vi;q=0.5`) sees the converted path in English. That covers `<html lang="en">`, the default title and description, the header and mobile menu labels and accessible names, the homepage footer, and the not-found page. The not-found check uses the title the built app actually serves, plus the heading, body and links, for both an unknown URL and a course slug that does not exist (whose `generateMetadata` calls `notFound()`). A header that prefers Vietnamese, names neither supported language (for example `fr`), or is missing gives Vietnamese. |
| AC3 | With the flag on, the header (desktop) and the mobile account menu show a VI/EN control. Choosing a language sets the locale cookie, re-renders the current page in that language with the URL unchanged, keeps it after reload, and wins over `Accept-Language`. A cookie value other than `vi` or `en` resolves to Vietnamese. |
| AC4 | `registerSchema` messages follow the active language on both of today's display paths. Client validation on `/register` shows the message under the same field as today. A `FormData` that fails validation, sent straight to `signUpUser`, returns `{ error }` holding the translated message of the first issue, before any database query, upload, account creation or email. The form shows it in the existing form-level notice. The same inputs are accepted and rejected in both languages, with the same issue paths and the same first issue. Missing, wrong-type and wrong-format values are covered for every field, except that a missing `dob` still passes validation as today's epoch date (see non-goals). The Vietnamese wording is exactly today's text for every issue the form can produce. |
| AC5 | The existing Vitest and full Playwright suites (`npm run test:e2e`, not only the smoke folder) pass with their Vietnamese assertions unchanged, apart from the exceptions in G7. Playwright runs with `locale: "vi-VN"`. |
| AC6 | A unit test fails when the Vietnamese and English catalogs differ in key set within any namespace. Every key in the U1 catalogs is used by converted code. |
| AC7 | Locale-aware format helpers format numbers, dates and VND amounts for `vi` as today's `vi-VN` calls do and for `en` in English. They are unit-tested; currency stays VND in both. Existing callers move to them in the units that own those screens. |
| AC8 | `/privacy` section 3 reads, with the flag off and on: "VocaSpace dùng cookie để giữ phiên đăng nhập và để ghi nhớ trạng thái giao diện (ví dụ ngôn ngữ hiển thị, hay thanh bên đang đóng hay mở)." The shared `LEGAL_LAST_UPDATED` date becomes the U1 merge date, so `/privacy` and `/terms` both show it. The rest of both pages is unchanged, and the change lands in the same PR as the cookie. |
| AC9 | With the flag off, a `next build` of the final U1 candidate shows the same rendering mode (static or dynamic) for `/`, `/courses` and `/courses/[course-slug]` as a build of the master baseline `dab3e640`. Any difference stops the PR until the Owner accepts it; a build of the U1 base `ee0cc266` shows the Owner whether U1 or earlier merged work caused it. The routes whose mode changes with the flag on are recorded in State, along with the H1–H3 results and the H4 Preview check (pending if no Preview grant). |

### 1.2 Scope and non-goals

- In scope: the i18n library and its request config; locale resolution; the flag; the locale cookie and the action that sets it; the switcher in the header and mobile menu; catalog layout and the key-parity test; locale-aware format helpers; the Vitest helper and server-component test config; the Playwright locale pin; `<html lang>` and root metadata; `app/not-found.tsx`; `components/ui/header.tsx`, `header-nav.tsx`, `mobile-account-sheet.tsx` and the labels in `lib/account-menu.ts`; `app/(client)/_components/home/HomeFooter.tsx`; the `registerSchema` messages and their display through the register form and `signUpUser`; the ENLOC-002 `/privacy` sentence and the shared legal date.
- Non-goals: other text on `/register` and the rest of the auth area, including `signUpUser`'s other messages such as the signup-closed and username-taken errors (U2); other schemas; changing how `signUpUser` normalizes input (today `new Date(formData.get("dob"))` turns a missing date into a valid epoch date, and U1 keeps that); migrating existing `vi-VN` formatting calls; auth emails (U6); English legal pages (U7); turning the flag on anywhere but local builds and an authorized Preview; storing the locale on the user (master section 7); `proxy.ts` changes, unless H1 shows the library needs them.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. With the flag off, locale resolution returns `vi` without calling `cookies()` or `headers()`. | Reading request data turns static routes dynamic (AC9) and lets a cookie or header change output before the release gate. |
| G2. Vietnamese strings move into the catalog verbatim, and the move is checked against the old text (Vietnamese test assertions or an exact comparison), not retyped. | A silent Vietnamese wording change, against the master invariant. |
| G3. `registerSchema` keeps its rules, field order and issue paths. Every issue it can raise, including wrong-type issues from a missing `FormData` field, carries a catalog key. A wrong-type issue reuses its field's existing message key, so no new Vietnamese text appears. | A raw key or Zod's default English text reaches the user, or different inputs are accepted, rejected or reported first in either language. |
| G4. A cookie or header value only selects text and formatting. Values other than `vi`/`en` are ignored as AC3 says, and the setter action accepts only those two values. | A tampered cookie changing behavior or reaching an unvalidated code path. |
| G5. The client receives only the namespaces converted client components use, not the whole catalog. | Every page ships every future translation as units add namespaces. |
| G6. URLs, routes and `proxy.ts` matching stay unchanged, and the implementation works with Next 16, React 19, the React Compiler and Server Actions. | Locale prefixes against decision 2, or a foundation that later units cannot build on. |
| G7. Existing tests change only in three ways: render setup moves to the shared provider; `__tests__/schemas/auth.test.ts` may assert the message key and issue path instead of the exact gender text, provided the register form render test asserts that exact Vietnamese text; and `__tests__/components/not-found.test.tsx` may read the title from `generateMetadata()` instead of `metadata` while asserting the same value (decision 9). The legal-page tests stay as they are (decision 10). | Test edits hide a wording or behavior regression (master invariant). |
| G8. Server components render Vietnamese in Vitest without per-test mocks of the translation library. | Every existing server-component test (Header, not-found and later units) would need edits that are not render setup. |
| G9. Code and tests outside section 1.2 stay untouched, apart from render setup under G7. | U1 grows into U2–U5 territory and conflicts with their namespace ownership. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1–5.
- 6 (2026-11-21, ENLOC-002). Section 3 of `/privacy` changes its example to "ví dụ ngôn ngữ hiển thị, hay thanh bên đang đóng hay mở" (AC8). It lands with the cookie, and ENLOC-002 resolves with that PR.
- 7 (2026-11-21). The switcher sits in the desktop header and in the mobile account menu, and appears only while the flag is on.
- 8 (2026-11-21). An independent Codex review of this plan (`gpt-6.2-astra`, medium, read-only, at most three rounds) runs before Owner approval.
- 9 (2026-11-21). The not-found test may read the title through `generateMetadata()`, keeping the asserted Vietnamese value. This adds a test-change exception to the master invariant for U1.
- 10 (2026-11-21). Because `/privacy` section 9 promises a new "last updated" date when the policy changes, the shared `LEGAL_LAST_UPDATED` moves to the U1 merge date. `/terms` shows the same new date, and the "same date" test stays as it is.

## 2. Repository facts

Baseline: `ee0cc266` (origin/main), checked 2026-11-21.

- `app/layout.tsx` sets `<html lang="en">` and static `metadata` with the Vietnamese description "Nền tảng học tập thông minh". `proxy.ts` only calls `updateSession`. `next.config.ts` enables `reactCompiler` and has no i18n plugin. No route exports `dynamic` or `revalidate`; the course detail data uses React `cache` per request — justifies AC1, AC9, G1.
- `components/ui/header.tsx` is an async server component that calls the Supabase server client and `auth.getUser()`, and it renders in `app/(client)/layout.tsx` and `app/not-found.tsx`. The `(client)` routes therefore may already be dynamic; the AC9 route tables confirm this — justifies AC9 as a comparison, not an assumption.
- Header strings: `header.tsx` 11 Vietnamese lines, `header-nav.tsx` 4, `mobile-account-sheet.tsx` 15 (it serves guests and signed-in users), `lib/account-menu.ts` lines 3–4. `HomeFooter.tsx` has about 10 UI strings (lines 49–107) and renders only on the homepage — justifies scope and decision 7.
- `app/not-found.tsx` exports static `metadata` with the absolute title "Không tìm thấy trang | VocaSpace", and `__tests__/components/not-found.test.tsx` line 39 asserts `metadata.title`. `app/(client)/courses/[course-slug]/page.tsx` line 25 calls `notFound()` inside `generateMetadata` so that title comes from `app/not-found.tsx` — justifies AC2, decision 9.
- `lib/schemas/auth.ts` lines 6–24 build `registerSchema`. `username`, `full_name` and `phone` start from `z.string()`, so a `null` from `FormData.get()` raises a wrong-type issue with Zod's default text before the custom length or format check. The register form (`app/(client)/(auth)/register/page.tsx` line 96) uses it through `zodResolver` and shows `errors.<field>.message` beside each field (lines 239–356). `signUpUser` (`app/actions/auth.ts` lines 65–87) builds the input from `FormData` and returns `{ error: issues[0].message }` before any query; the form shows that in the form-level `AuthNotice` (lines 188–189, 421–424) — justifies AC4, G3.
- `__tests__/schemas/auth.test.ts` lines 61–68 assert the exact message "Vui lòng chọn giới tính" without a provider. `__tests__/components/auth-onboarding.test.tsx` renders `RegisterPage` — justifies G7.
- `vitest.config.ts` uses the `node` environment and no setup file. `__tests__/components/header.test.tsx` renders `await Header()` — justifies G8.
- `playwright.config.ts` sets no `locale`. `npm run test:e2e:smoke` and CI cover only `e2e/smoke`, while `testDir` also holds `e2e/admin` and `e2e/d2`. `scripts/e2e/run-e2e.mjs` resets the local E2E database — justifies AC5 and the Final checkpoint.
- `/privacy` lines 86–89 hold the cookie sentence, lines 9–10 require a same-PR update when cookies change, and section 9 (line 168) promises a new "last updated" date. `LEGAL_LAST_UPDATED` in `app/(client)/_components/LegalDocument.tsx` line 4 is shared with `/terms`, and `__tests__/components/legal-pages.test.tsx` line 104 requires both pages to show the same date — justifies AC8, decision 10.
- Server-only switches already follow an env-var pattern (`HOME_SAMPLE_CONTENT=1` in `lib/homepage/content.ts` lines 64–65) — informs H5.

## 3. Bounded implementation hypotheses

- H1 (master): `next-intl` in its mode without i18n routing, with `createNextIntlPlugin` in `next.config.ts` and an `i18n/request.ts` request config, meets G6. CP1 tests it on a real string through a client component, a server component and `signUpUser` in a local build. If it fails, stop the dependent work and record the evidence. An equivalent library or setup may replace it if every AC and guardrail still holds; go back to the Owner only if the replacement changes a contract or needs a new grant.
- H2 (master): catalogs live in `messages/<locale>/<namespace>.json`, and the request config merges them. U1 creates `common` (metadata, not-found, header, footer, switcher) and `validation` (the register keys only; U2 extends it). Namespace names may change if G5 and the parity test hold.
- H3 (master): `registerSchema` messages become keys such as `validation.register.genderRequired`, with field-level error options so wrong-type issues get the same key (G3). The form translates `errors.<field>.message`, and `signUpUser` translates the first issue on the server. Keys are typed through the library's type augmentation if that works. Invalidated if a message cannot be expressed as a key without duplicating a rule.
- H4 (master): the final build with the flag on records which routes change rendering mode. The Preview check in both orders runs only with a Preview and a grant to set the flag there; otherwise it stays pending and blocks only U8.
- H5: the flag is a server environment variable `ENGLISH_UI_ENABLED=1`, read in the request config and where the switcher decides to render. Because a static route bakes in the flag value at build time, turning it on or off takes a rebuild (a Vercel env change plus redeploy). The name may change; the "off unless set" default may not.
- H6: the switcher calls a Server Action that validates the value with a Zod enum, sets the cookie (one year, `Path=/`, `SameSite=Lax`, `Secure` in production), and then calls `router.refresh()`. The cookie name may be the library default `NEXT_LOCALE` or a project name.
- H7: `lib/i18n/` holds the supported locales, a local `Accept-Language` parser with q-values, the resolver and the format helpers, each unit-tested. A maintained parser package may replace the local one if it adds no unrelated dependencies.
- H8: Vitest gets a setup or alias that points the library's request config to Vietnamese messages for server components, plus a `renderWithIntl` helper (Vietnamese by default, English on request) for client components. The mechanism may change if G8 holds.
- H9: `app/not-found.tsx` and the root layout move to `generateMetadata`. If Next 16 does not serve a `generateMetadata` title from `not-found.tsx`, an equivalent may replace it only if metadata stays the single source of the title (no `<title>` rendered by the page) and both AC2 build checks pass; otherwise stop.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Foundation and the integration trial. The library is wired with the flag and locale resolution (cookie, `Accept-Language`, `vi`), with `<html lang>` and root metadata as the first real strings. The parity test, format helpers, Vitest helper and server config, and Playwright `vi-VN` pin are in place. `registerSchema` runs end to end in the form and in `signUpUser`, in both languages. | Unit tests for the parser, resolver (flag off ignores cookie and header) and format helpers. Register form render tests in both languages, with the exact Vietnamese texts. Direct `signUpUser` tests in both languages: missing, wrong-type and wrong-format values per field return the translated `{ error }` with no query run, a `dob` that is not a date returns the translated date message, and a missing `dob` passes validation as the epoch date and reaches the next (mocked) step. Existing Header, not-found, homepage, auth-onboarding and schema tests. A local `next build` with the flag on: a fresh browser session with no cookie and an English-first `Accept-Language` gets `<html lang="en">`, the English `meta[name="description"]` and an English register field message; a session with an `en` cookie and a Vietnamese-first header also gets English. One real `signUpUser` request in that build, with its `FormData` altered in flight (for example with Playwright `page.route`) so it fails validation, returns its `{ error }` in English, and in Vietnamese with a `vi` cookie. With the flag off, the same requests give Vietnamese. If this trial cannot run, H1 stays pending and CP2 waits. |
| CP2 | The switcher in the header and mobile menu, the cookie action, the `/privacy` sentence and the shared legal date. | Component tests for the switcher (rendered only with the flag on) and the action's input validation. Legal-page tests for AC8. A local build pass at 375 and 1440px. With the flag on, starting from a fresh session with an English-first header: choosing Vietnamese changes `<html lang>`, `meta[name="description"]` and the register field message, keeps the URL, survives reload, and beats `Accept-Language`; choosing English reverses it (AC3). With the flag off: Vietnamese output and no switcher at either width (AC1). |
| CP3 | The rest of the converted path: not-found, header, mobile menu and account-menu labels, homepage footer, with English catalogs. | Existing tests unchanged apart from G7. English render tests for each converted surface. A local build with the flag on and off, checking the served not-found title and content for an unknown URL and an unknown course slug in both languages, plus the header, mobile menu and footer (AC1, AC2). |
| Final | Cumulative self-review of the whole diff against AC1–AC9, then State updated with H1–H4 results and route changes. | Full `npm run test:run`, `npx eslint` on changed files, `npx tsc --noEmit`, `npm run docs:check`. The AC9 route tables: final candidate with the flag off against `dab3e640` (and `ee0cc266` if they differ), and with the flag on. Full `npm run test:e2e` on a dedicated local stack, run on its own because it resets the E2E database; if only the smoke folder runs, AC5 stays pending. A source search for each U1 catalog key, so that none is unused (AC6). CI on the PR. Just before an authorized merge, confirm `LEGAL_LAST_UPDATED` equals the merge date; if the date has passed, update it in a new commit and rerun the checks on that commit before merging (AC8). |

The PR is one unit PR (master section 4) with the three checkpoints as local commits.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The library or its plugin breaks the build, the React Compiler or Server Actions. | CP1 proves H1 on the real register path before the rest; failure stops dependent work. |
| Wiring the provider or `generateMetadata` makes `/`, `/courses` or course detail dynamic with the flag off. | G1 and the AC9 comparison of the final candidate against `dab3e640`. |
| Moving strings changes Vietnamese wording. | G2, unchanged Vietnamese assertions (AC5), and an exact comparison of moved strings. |
| A raw key or Zod default text reaches the user from a malformed request. | G3 and the per-field missing, wrong-type and wrong-format action tests. |
| A shipped flag-off build still honors a cookie or header. | AC1 tests with an `en` cookie and an English header against the flag-off resolver and the local build. |
| Root layout provider makes every client bundle carry the catalog. | G5: only `common` and `validation` client keys reach the client in U1. |
| E2E switches to English because Chromium sends an English header. | AC5 Playwright pin, plus G1 makes the flag-off server ignore the header anyway. |

- Rollout runbook: none. The flag stays off in production, so the merge changes only `<html lang>`, the `/privacy` sentence and the legal date for visitors. Any Preview with the flag on needs its own grant.
- Stop when: H1 fails with no equivalent, AC9 shows any mode change for a cache-critical route without Owner acceptance, a Vietnamese assertion must change beyond G7, H9 has no working equivalent, or scope would cross into U2–U7 files.
- Rollback: revert the PR. No data or hosted configuration changes; the locale cookie only stops being read.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
