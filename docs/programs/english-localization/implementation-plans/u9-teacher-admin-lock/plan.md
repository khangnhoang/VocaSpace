# U9 detail plan — teacher and admin language lock

Revision: r3, 2026-11-24. Owner approval: r3 on 2026-11-24. Master plan: [plan.md](../../plan.md) (unit U9, hypotheses H5 and H6). Progress: [progress.md](../../progress.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: while the English flag is on and the new step B flag is off, every response of the teacher area (`/teacher` and below) and the admin area (`/admin` and below) resolves to Vietnamese, whatever the locale cookie or `Accept-Language` says. This covers the page and its metadata, `<html lang>`, client provider messages after a client-side navigation into or out of the area, Server Actions called from those pages, the root `not-found` under those prefixes and `POST /api/question-group-media/upload`. Turning the step B flag on lifts the lock. With the English flag off nothing changes from today.

"Locked state" below means a local production build with `ENGLISH_UI_ENABLED=1` and the step B flag off; "unlocked state" means both flags on. "Locale-dependent output" means what the active locale decides today or through U9: `<html lang>`, the title and `meta[name="description"]`, text rendered from the catalog on the server or from the client provider, the root `not-found` and the switcher, and translated action or route messages. Text hard-coded in teacher and admin code (for example `Dashboard` in `components/ui/admin-sidebar.tsx`) is U4 or U10 territory and stays as it is in every state.

| ID | Observable result |
| --- | --- |
| AC1 | **Flag off: no change.** With the English flag off, for both values of the step B flag, every page renders Vietnamese whatever the cookie or `Accept-Language` says, `getRequestLocale` reads no request data, and the `next build` route table of each of the two builds equals the table of base `60da8312`. |
| AC2 | **Direct loads in the locked state.** With an `en` cookie, and separately with no cookie and an English-first `Accept-Language`: a teacher page (`/teacher/courses`) and an admin page (`/admin`) render all locale-dependent output in Vietnamese (`lang="vi"`, Vietnamese title and description). The root `not-found` under each prefix (`/teacher/missing`, `/admin/missing`) renders Vietnamese with Vietnamese metadata, and the language switcher is absent there on desktop and in the mobile account sheet. A missing URL under each prefix whose extension the `proxy.ts` matcher skips (`/teacher/missing.png`, `/admin/missing.png`) behaves the same if the app serves a page there (H5). A student page, `/teachers` and `/administrator` still follow the cookie (English, with the switcher on the not-found page). |
| AC3 | **Client-side navigation in the locked state.** With an `en` cookie, follow the real header account-menu links from an English student page into `/teacher/courses` and into `/admin`, and return to a student page through a real link (browser back where the area has none). Repeat starting from a direct load of each locked page and following a link to a student page. After every navigation step, and before any probe action runs, record `document.documentElement.lang`, a label rendered from the client provider, the page title, `meta[name="description"]` and the locale cookie. A locked page shows `vi` and Vietnamese locale-dependent output, a student page shows `en` and English, and the cookie value never changes. |
| AC4 | **Server Actions and the upload route.** In the locked state, a Server Action called from a teacher page and from an admin page resolves Vietnamese, and the same action called from a student page resolves English. `POST /api/question-group-media/upload` without a session returns status 401 and `{ "error": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }`, the exact text and JSON shape of today. In the unlocked state the same 401 returns the English text with the same status and shape. The route's other messages are unchanged (U4 owns them). |
| AC5 | **Unlocked state.** With both flags on and an `en` cookie, every AC2–AC4 request to a teacher or admin path resolves its locale-dependent output as a student page does: English, `lang="en"`, English metadata, the switcher shown on the not-found page. With the step B flag on and no cookie, `Accept-Language` decides, as on student pages. |
| AC6 | **The lock never touches the cookie.** No response used as AC2–AC5 evidence (page loads, client navigations, the probe action and the upload 401) carries a `Set-Cookie` for `NEXT_LOCALE`, and in the `Accept-Language`-only runs the browser holds no `NEXT_LOCALE` cookie at the end. Session cookies may refresh independently. `setLocale` behaves as today. |
| AC7 | **The path signal cannot be forged.** On every request proxy handles, a path header sent by the client is replaced by the path proxy sees, including on the response rebuilt when the Supabase session cookie refreshes. A forged header therefore cannot unlock a locked path or lock a student path that proxy handles. On a path the matcher skips, a forged header can at most force Vietnamese for the forging request itself (master H5), never English on a locked path; the H7 script records a skipped public path (for example `/courses/missing.png`) with an `en` cookie and a forged locked path. |
| AC8 | **Path rule.** Unit tests show the lock applies to `/teacher`, `/teacher/...`, `/admin`, `/admin/...` and the listed API route only, and not to look-alikes such as `/teachers`, `/teacher-guide`, `/administrator` and `/api/question-group-media/abc/image`. |
| AC9 | **Existing tests unchanged.** The Vitest unit suite, `npm run test:integration` and the full `npm run test:e2e` pass with their assertions unchanged, `__tests__/proxy.test.ts` and `__tests__/utils/supabase-middleware.test.ts` included, except under G6. |

### 1.2 Scope and non-goals

In scope:

- **Locale resolution.** `lib/i18n/config.ts` (step B flag), `lib/i18n/request-locale.ts` (lock), a new path-rule module under `lib/i18n/`, and `i18n/request.ts` only if the lock needs it.
- **Proxy.** `proxy.ts` and `utils/supabase/middleware.ts`, only to carry the request path to the server and, if H5 requires it, the matcher.
- **Navigation carry-over.** The layouts and the root `not-found` that own `<html lang>` and the client provider (`app/layout.tsx`, `app/(client)/layout.tsx`, `app/(teacher)/layout.tsx`, `app/admin/layout.tsx`, `app/not-found.tsx`) and a small client helper, only as far as H4 needs.
- **Switcher.** Hiding it on the locked `not-found` (`components/ui/header.tsx` and the `showLanguageSwitcher` prop it passes to `mobile-account-sheet.tsx`).
- **Upload route.** The 401 branch of `app/api/question-group-media/upload/route.ts` and its catalog key in both locales.
- **Tests.** New unit tests for the path rule, flags, lock, proxy header, locked not-found and the 401; the evidence script and probe of H7 outside the app code.

Non-goals:

- Translating teacher or admin text (U4, U10), other upload messages (U4), the ENLOC-004 fix (its own plan), payments (U5) and legal pages (U7).
- Any change to authentication, redirects, the return-path cookie or admin access checks in `updateSession` and the admin layout.
- Storing the locale anywhere new, or writing the locale cookie from the lock.
- A permanent flag-on E2E suite (decision 3).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. With the English flag off, `getRequestLocale` returns `vi` before reading cookies, headers or the step B flag, as today. | Routes turn dynamic or the step B flag changes output before step A (AC1). |
| G2. The lock can only force `vi`. It never writes or clears the locale cookie, and `setLocale` is unchanged. | A teacher's language choice is lost, or the lock changes student pages (master invariant). |
| G3. The path rule matches whole path segments, and the API part is an explicit list holding only `/api/question-group-media/upload`. | Look-alike student paths lock, or a shared API route (the media `GET` routes students use) changes language. |
| G4. Proxy sets the path header on every response it lets through, overwriting any client value, including the response `updateSession` rebuilds in `setAll`; that rebuilt response still forwards the refreshed session cookies upstream and returns them to the client. Its redirects, auth checks and cookie handling stay exactly as they are, including for every path the matcher skips today. | The lock sees a stale or forged path, the server renders with a stale session, or authentication behavior regresses. |
| G5. No Vietnamese text changes, and only the upload 401 message moves into the catalog (verbatim). | A silent wording change (master invariant), or U9 starts translating U4 or U10 territory. |
| G6. Existing tests change only by render setup moving to the shared provider or an import path changing. Any other changed assertion stops the work and goes to the Owner with the replacement evidence. | Test edits hide a regression in proxy, auth or locale behavior. |
| G7. The H7 probe never enters a commit; committed code holds no debug route, action or label. | Debug surface ships to production. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1–7.
- 1 (2026-11-24). An independent Codex review of this plan (`gpt-6.2-astra`, medium, read-only, at most three rounds) runs before Owner approval.
- 2 (2026-11-24). After approval, a Sonnet implementor session (`claude-sonnet-5-5`, effort high, this checkout, branch `i18n/u9-teacher-admin-lock`) implements the checkpoints with local commits only. The handoff grants no push, PR or merge.
- 3 (2026-11-24). Lock evidence comes from unit tests plus a scripted check of local production builds (H7), recorded in State. No permanent flag-on E2E suite is added.

## 2. Repository facts

Baseline: `60da8312` (origin/main after PR 198), checked 2026-11-24.

- **Resolution.** `getRequestLocale` (`lib/i18n/request-locale.ts`) returns `vi` while `isEnglishUiEnabled()` is false and otherwise reads only the `NEXT_LOCALE` cookie and `Accept-Language` through `resolveLocale`. `i18n/request.ts` calls it for every `getLocale`/`getTranslations`. The flag is `ENGLISH_UI_ENABLED === "1"` in `lib/i18n/config.ts`; no step B flag exists. *Justifies G1, H1 and H3.*
- **Proxy.** `proxy.ts` only calls `updateSession`; its matcher skips `sitemap.xml`, `robots.txt`, `_next/static`, `_next/image`, `favicon.ico` and any path ending in `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif` or `.webp`. `updateSession` builds `NextResponse.next({ request })` and builds it again inside `setAll` when Supabase refreshes the session cookie; it redirects signed-out users away from `/teacher`, `/profile` and `/admin` with its own path helpers. The Next docs (`proxy.md`) pass upstream headers with `NextResponse.next({ request: { headers } })` and state that Server Functions are POSTs to the route where they are used, so a matcher exclusion also skips them. `public/` holds only `brand/`, so no asset lives under `/teacher` or `/admin`. *Justifies G4, AC7 and H5.*
- **Layouts.** `app/layout.tsx` sets `<html lang={locale}>` and the only `NextIntlClientProvider` with `pickClientMessages(locale)`; its `generateMetadata` gives the title and description from `common.metadata`. No teacher or admin route exports metadata, so they inherit that title and description today. `app/(teacher)/layout.tsx` is a bare fragment; `app/admin/layout.tsx` checks admin access and renders `AdminSidebar` and `AdminHeader`. In the App Router, a shared layout is kept across client-side navigation, so the root `lang` and provider set on the first load may survive a `Link` into another area. *Justifies AC3 and H4.*
- **Teacher and admin text.** Nothing under `app/(teacher)`, `app/admin`, `lib/admin`, `lib/course-authoring` or `components/ui/admin-*` uses next-intl; their text is hard-coded Vietnamese. So today the visible locale leaks there are `<html lang>`, the inherited metadata and the root `not-found`; U4 and U10 will add provider-based text that the lock must cover. *Justifies AC2, AC3 and the probe in H7.*
- **Switcher and links.** `components/ui/header.tsx` shows `LanguageSwitcher` when `isEnglishUiEnabled()` and passes `showLanguageSwitcher` to `mobile-account-sheet.tsx`. The header and the mobile sheet hold real links to `getTeacherCourseListPath()` (`/teacher/courses`) and `/admin`; the root `not-found` renders `Header`. *Justifies AC2, AC3 and the switcher scope.*
- **API routes.** `POST /api/question-group-media/upload` is called only by `QuestionGroupMediaField.tsx` in the teacher area and returns `{ error }` with Vietnamese text (401 at line 59). The media `GET` route `/api/question-group-media/[groupId]/[type]` is also used by the learning workspace and returns media only. *Justifies G3 and AC4.*
- **Tests.** `__tests__/utils/i18n.test.ts` covers `resolveLocale` and the flag; `__tests__/proxy.test.ts` and `__tests__/utils/supabase-middleware.test.ts` cover proxy and auth redirects; `not-found.test.tsx`, `not-found-english.test.tsx`, `language-switcher.test.tsx` and `locale.test.ts` cover the U1 pieces. Vitest replaces `i18n/request.ts` with `__tests__/support/i18n-request.ts`. E2E specs `admin-gate.smoke`, `admin-course-review`, `admin-user-hardening` and `teacher-course-portfolio.smoke` give seeded teacher and admin accounts on the local stack. *Justifies AC9, H7 and the checkpoint checks.*

## 3. Bounded implementation hypotheses

- **H1, path signal.** Proxy copies the request headers, sets an internal header (for example `x-vocaspace-pathname`) to `request.nextUrl.pathname`, and passes it upstream with `NextResponse.next({ request: { headers } })` at both places `updateSession` builds that response. `getRequestLocale`, only after the English flag check, reads the header and returns `vi` when the lock is active and the path is locked. The name and the exact helper split may change while G1, G3, G4 and AC7 hold.
- **H2, path rule.** A pure function in a new `lib/i18n/locked-areas.ts` decides whether a path is locked (whole segments for `/teacher` and `/admin`, plus the explicit API list). The existing path helpers in `utils/supabase/middleware.ts` stay as they are. A missing path header means not locked; CP1 records which requests, if any, arrive without it.
- **H3, step B flag.** `lib/i18n/config.ts` gains a second flag read as `=== "1"` (for example `ENGLISH_UI_STEP_B_ENABLED`), off when missing. The lock is active when the English flag is on and this flag is off. Like the English flag it is read at build time for static routes, so changing it needs a rebuild and redeploy (master H6).
- **H4, navigation carry-over.** CP1 first runs AC3 with only H1–H3 in place. If the root `lang` or provider messages carry over, the preferred fix is that each area layout (`(client)`, `(teacher)`, `admin`) and the root `not-found` resolve their own locale on the server, wrap their subtree in a `NextIntlClientProvider` with that locale's messages, and render a small client helper that sets `document.documentElement.lang` to it. Each area layout renders afresh when a navigation enters the area, so the area's locale replaces the carried one. The alternative is separate root layouts per area, which makes navigation between areas a full page load. Either must meet AC2–AC5 without changing student page output; the implementor records the choice and its evidence in State. If neither meets them, stop and return to the Owner (master H5).
- **H5, matcher gap.** CP2 checks `/teacher/missing.png` and `/admin/missing.png` on the locked build. If the app serves the English `not-found` there, proxy starts handling image-extension paths under `/teacher` and `/admin` for the locale signal only: it sets the path header and returns without calling `updateSession`, so these paths keep today's auth behavior (no redirect to `/login`, no return-path cookie, no session refresh). Another resolution point may replace this if it keeps that auth behavior. The check covers a guest and a signed-in teacher, comparing status, `Location` and cookies with the base build. If the app serves no page there, nothing changes and State records it.
- **H6, upload 401.** The 401 branch calls `getTranslations` for one new server-only key (for example namespace `teacherMedia`, which U4 later extends) with the Vietnamese text verbatim and its English counterpart; the response stays `NextResponse.json({ error }, { status: 401 })`. No client delivery is needed.
- **H7, evidence.** A probe patch kept in the session scratchpad, never committed (G7), adds to the teacher and admin layouts and to one student layout a client label rendered from the provider (a `common` key with a test id) and a button calling a probe Server Action that returns `getLocale()`. A Playwright script (playwright-cli) runs against four flag combinations: English off with step B off and on (AC1), the locked state and the unlocked state. Everything observed on the two English-off builds (route tables, `lang` and description) comes from builds of the candidate without the probe; the locked and unlocked observations come from builds with the probe patch on top of the candidate. The script signs in with the seeded teacher and admin accounts on the local stack, follows the AC3 link sequence and records `lang`, the probe label, the title, the description and the cookie after each navigation, then the probe action result; it inspects every evidence response's `Set-Cookie` headers in memory and records only whether `NEXT_LOCALE` appears (AC6), never session cookie values, calls the upload route without a session for the 401, and runs the AC7 forged-header and H5 cases. State records, for each result, the candidate commit, the probe patch (its description and hash), the flag combination, the commands and the observations.

## 4. Checkpoints

Test runs follow [test-quality-strategy, Verification stages](../../../../../.agents/skills/test-quality-strategy/SKILL.md#verification-stages): affected test files and the static checks at each checkpoint, the full regression once at Final.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | **Lock core and first navigation check.** Step B flag (H3), path rule (H2), path header in proxy (H1) and the lock in `getRequestLocale`. Then the master plan's first check: AC3 on the locked build with the H7 probe, before any carry-over fix. | Unit tests for the path rule with look-alikes (AC8), the flag states, `getRequestLocale` across English flag × step B flag × path × cookie/header (AC1, AC2, AC5 at unit level) and the proxy header on both `updateSession` response paths with a forged client value (AC7); the `setAll` case also asserts that the upstream request carries the refreshed session cookies and the response returns them (G4). Existing proxy, middleware and i18n tests unchanged. The route tables of both English-off builds compared with base (AC1). State records the AC3 observations and the H4 decision they lead to. |
| CP2 | **Carry-over, not-found, matcher and upload.** The H4 fix if CP1 needs it, the locked `not-found` without the switcher, the H5 result and the upload 401 (H6). | Render tests for the locked and unlocked `not-found` (Vietnamese and no switcher when locked) with the existing not-found tests unchanged; a route test for the 401 in both locales with the same status and shape; tests for any new provider or `lang` helper. The H7 script on the locked and unlocked builds covers AC2–AC7, including the extension paths with the H5 auth comparison. |
| Final | **Cumulative check.** Whole-diff self-review against AC1–AC9 and the master H5 and H6 invalidation cases. | The final regression of the test skill, including the full `npm run test:e2e` on the isolated stack. The AC1 route tables of both English-off builds of the final commit, and on those same builds (no probe) a teacher page, an admin page and a public page requested with an `en` cookie and with an English-first `Accept-Language` show `lang="vi"` and the Vietnamese description; then the H7 script on the final commit plus the probe patch for the locked and unlocked builds. Owner QA on a local locked build with the seeded teacher and admin accounts. |

Steps that need their own authority, not granted by this plan or its approval: the Codex implementation review, push, PR, CI fixing beyond the standing exception, and merge. Before review the branch is refreshed onto the current main, and the merge follows the [production release gate](../../../../sop/production-release-gate.md).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A client-side navigation keeps the other area's `lang` or provider messages. | CP1 observes it on a real build before any fix; H4 names the fix, the alternative and the stop. |
| The path header is lost when Supabase refreshes the session cookie, or a client forges it. | G4 and AC7, with unit tests on both response paths. |
| Proxy changes break authentication or redirects. | G4; `proxy.test.ts` and `supabase-middleware.test.ts` stay unchanged; the full E2E suite at Final. |
| The lock changes a student page or the flag-off build. | G1, G3, AC1 route table and the student steps in AC3. |
| A request type in a locked area (an image-extension path, an API route) bypasses proxy. | H5 and the explicit API list; the H7 script covers them. |
| Probe code reaches a commit. | G7; the final self-review searches the diff for the probe test ids and action. |

- Rollout runbook: none. Both flags stay off in production, so merging changes nothing visible.
- Stop when: an existing proxy, auth or locale assertion must change beyond G6; the flag-off route table changes; no H4 option meets AC2–AC5; the work would translate U4 or U10 text beyond the upload 401.
- Rollback: revert the PR. No data or hosted configuration changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
