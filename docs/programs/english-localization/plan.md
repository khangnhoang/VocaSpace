# Master plan — English localization

Progress: [progress.md](./progress.md). Problems: [problems.md](./problems.md). Add a detail plan under `implementation-plans/u<n>-<slug>/plan.md` when opening each unit.

## 1. Goal and outcome

- Goal: Offer English as a second interface language next to Vietnamese, without changing what current Vietnamese users see.
- Outcome 1: A visitor can switch between Vietnamese and English; the choice persists in a cookie and the URL does not change. A first-time visitor whose browser prefers English sees English.
- Outcome 2: Every fixed interface string a user can see (labels, buttons, toasts, validation and action errors, metadata, empty states, auth emails) has an English version, while teacher-authored learning content stays as written.
- Outcome 3: The Vietnamese interface stays text-identical through the program, and the existing Vitest and Playwright suites keep running in Vietnamese.
- Size and risk: Large. The change touches about 300 source files across every route group. It also changes how the root layout and the request proxy behave and how shared Zod schemas build their messages, and it may change static rendering.

## 2. Owner decisions

1. (2026-11-21) Translate the interface only. Teacher-authored content (courses, chapters, words, meanings, exercises) and database data stay single-language and unchanged.
2. (2026-11-21) Store the locale in a cookie. Keep URLs unchanged; add no `/en` prefix or `[locale]` route segment.
3. (2026-11-21) With no cookie, choose the first-visit locale from the browser's `Accept-Language`. Vietnamese is the fallback.
4. (2026-11-21) An agent drafts the English `/privacy` and `/terms` in a separate unit. The Owner approves the wording before merge, and the Vietnamese text stays authoritative.
5. (2026-11-21) Ship English behind a configuration flag that is off by default. Units merge to production while it is off, and turning it on is the program's single user-visible release step.

## 3. Baseline and shared invariants

Baseline `dab3e640` (origin/main, 2026-11-21). Counts come from grepping for Vietnamese diacritics and are upper bounds.

- No i18n library is installed (`package.json`). [app/layout.tsx](../../../app/layout.tsx) hard-codes `<html lang="en">` and a Vietnamese `description`. [proxy.ts](../../../proxy.ts) only calls `updateSession`.
- 303 non-test source files contain about 4,550 Vietnamese lines; about 1,400 of those are code comments, which this program does not translate. By area: `app/(teacher)` 62 files / 1,292 lines, `app/(client)` 83 / 1,190, `app/actions` 32 / 801, `lib` 64 / 659, `app/admin` 29 / 300, `components`, `hooks`, `types` and `utils` 23 / 228, `app/api` and `app/auth` 7 / 63. 100 of the 184 affected `.tsx` files are client components.
- Server Actions map error codes to Vietnamese strings, for example [admin-course-moderation.ts](../../../app/actions/admin-course-moderation.ts) lines 24–35. Shared Zod schemas in `lib/schemas/` hold about 89 Vietnamese messages and run on both client and server.
- Formatting hard-codes `vi-VN` in about a dozen calls (`Intl.NumberFormat("vi-VN")`, `toLocaleString("vi-VN")`). Only the register page imports `date-fns/locale` `vi`. Nine route files export `metadata`.
- Auth email subjects ([supabase/config.toml](../../../supabase/config.toml) lines 247–253) and both `supabase/templates/*.html` bodies are Vietnamese. Hosted templates are configured separately from the repository.
- [playwright.config.ts](../../../playwright.config.ts) sets no `locale`, so Chromium sends an English `Accept-Language`. Under decision 3 the E2E suite would switch to English unless the locale is pinned. Of the 210 files under `__tests__/`, 201 contain Vietnamese on about 4,900 non-comment lines. Of the 35 under `e2e/`, 34 do, on about 720 lines. These lines mix assertions, fixtures, sample data and test names, so they show where to look, not the conversion cost.
- Schema tests compare `issue.message` to exact Vietnamese text without a React provider, for example `__tests__/schemas/auth.test.ts` line 67.
- Some client code picks the field that shows an error by matching Vietnamese text: `ExerciseNodeEditors.tsx` lines 95 and 287–289 call `res.error.includes("Tên bài tập")`, `"âm thanh"`, `"hình ảnh"` and `"đoạn văn"`.
- The homepage hero (`app/(client)/_components/home/HeroPractice.tsx`) imports `FlashcardStage` from the `learn` tree and `FLASHCARD_RATINGS` from `lib/flashcard-ratings`. The root [not-found.tsx](../../../app/not-found.tsx) holds a Vietnamese title and body.
- The approved `/privacy` text requires updating the page in the same PR that changes cookies in code (comment at lines 9–10). Its section 3 says cookies keep the session and remember interface state.
- Password recovery sends only the email address (`app/actions/auth.ts` line 175, `app/actions/user.ts` line 105). `scripts/e2e/run-e2e.mjs` refuses to run E2E against a non-local Supabase URL.
- `/privacy` is 183 lines and `/terms` is 106 lines of JSX.

Invariants:

- Moving a Vietnamese string into the catalog keeps its exact text, so this program makes no Vietnamese copy edits. The one exception is legal text the Owner approves under ENLOC-002. Without this, the move would hide wording regressions and break existing assertions.
- Code that reacts to an error (which field to mark, which branch to take) uses a stable error code or field path, never the message text. Without this, English messages would land errors on the wrong field.
- The Vietnamese and English catalogs have the same key set, and a unit test fails on a missing or extra key. Without this, a key missing in one language would silently fall back or render as the raw key.
- English stays switched off in production (no switcher, no browser detection) until the enable gate in section 5. Until then the cookie and `Accept-Language` resolve to Vietnamese. This keeps visitors from landing on a half-translated interface while units are still merging.
- Tests run in Vietnamese by default. Vitest renders through a shared provider with Vietnamese messages, and Playwright pins `locale: "vi-VN"`. English gets dedicated tests. This keeps the existing suites from failing for reasons unrelated to the change under test.
- A schema-level test may switch from exact Vietnamese text to the message key and field path when H3 applies, but the Vietnamese wording stays asserted at the display or action layer. The same inputs are accepted and rejected in both locales. This keeps test edits from hiding validation or wording regressions.
- The locale changes only text and formatting, never permissions, validation rules, prices, currency (VND stays VND) or stored data. An unknown cookie value falls back to Vietnamese. This keeps a tampered cookie from changing behavior.
- Code comments, identifiers, logs, database enum values, error codes, teacher content and the PayOS payment description stay as they are. This keeps translation from turning into unrelated churn or breaking external contracts.
- A unit translates its whole area, with no catalog key left unused. Without this, the final audit cannot tell untranslated strings from finished ones.

Hypotheses (U1 verifies them; an implementor may replace one when the outcome and invariants still hold, and records the change in State):

- H1: `next-intl` in its "without i18n routing" mode, with a request config that reads the cookie and then `Accept-Language`, supports Next 16, React 19, the React Compiler and Server Actions. Invalidated if U1's trial build or an action test fails because of the library.
- H2: Catalogs are split into per-namespace files (`messages/<locale>/<namespace>.json`), so parallel units rarely conflict. Client components receive only the namespaces they use.
- H3: Shared Zod schemas emit stable message keys, and the form layer or the action translates them. This keeps one schema for client and server. U1 tests it on a schema that has direct `issue.message` assertions (`registerSchema`). Invalidated if a schema cannot express a message as a key without duplicating rules.
- H4: Reading the cookie turns statically rendered pages dynamic, and no cache layer serves one locale's response to another. U1 records which routes change in the build output. Before the enable gate, an authorized Preview with the flag on must show two independent sessions requesting the same public URL in both orders (Vietnamese then English, English then Vietnamese), each receiving its own `lang`, content and metadata. A cookie must beat the header, and with the flag off an `en` cookie must still get Vietnamese. If a route serves the wrong locale or a cache-critical route (`/`, `/courses`, course detail) regresses, stop and report before enabling.

## 4. Units

Open each unit from refreshed main with an approved detail plan and the applicable action authority.

| Unit | Scope | Dependency and acceptance |
| --- | --- | --- |
| U1 — Foundation and one working path | Library and request config, locale resolution (cookie, then `Accept-Language`, then `vi`), dynamic `<html lang>`, locale-aware format helpers, catalog layout, key-parity test, Vitest provider helper, Playwright `vi-VN` pin and an English enable flag that defaults to off. Add a switcher shown only while the flag is on. Convert the root layout and metadata, the root `not-found` page, the client header and footer, and `registerSchema` end to end. Settle ENLOC-002 before the PR that adds the cookie. | No dependency. With the flag on in a local build: a visitor with no cookie and an English-first `Accept-Language` sees the converted path in English, switching to Vietnamese sets the cookie and survives reload, and a converted validation error appears in the active language on both client and server. With the flag off, output is Vietnamese whatever `Accept-Language` says. Existing Vitest and Playwright suites pass with their Vietnamese assertions unchanged. Only render setup may switch to the shared provider, and the `registerSchema` tests may use the schema-test exception in section 3: they keep field-path and accept/reject checks, and the exact Vietnamese message moves to the register form's render test. Before merge, compare the `next build` route table with the flag off against baseline `dab3e640` for `/`, `/courses` and course detail. Stop if any of them changes rendering mode, unless the Owner accepts the change. Record H1–H3 results and the routes that became dynamic. Run the H4 Preview check if a Preview and the grant to set the flag there are available; otherwise record H4 as pending, which blocks only U8. |
| U2 — Public, auth and profile | `app/(client)/_components`, `(auth)`, homepage, `courses`, `profile`, `app/auth`, related actions, and the auth, profile, course-preview and catalog schemas and lib helpers. Payment surfaces inside these screens (the `PaymentHistory` section of the profile and the checkout messages of `PublicCourseEnrollmentCard`) belong to U5 and are excluded from U2's acceptance. U2 also owns the shared flashcard presentation used by the homepage hero: `FlashcardStage` labels and `FLASHCARD_RATINGS`. The hero's demo words and meanings are sample learning content and stay as written. | Needs U1. For each converted screen, Vietnamese text is unchanged and English renders with no Vietnamese leftovers outside learning content. This includes accessible names and page metadata. Auth and profile errors appear in both languages. QA accounts and data for the student role are confirmed when the unit opens. |
| U3 — Learning flow | `app/(client)/learn` except the shared flashcard presentation owned by U2, plus card-progress, learning-landing and learning-activity helpers and review-related actions. | Needs U1. Soft-depends on U2 for the shared flashcard strings; if U3 goes first, the detail plan moves that ownership to U3 and U2 drops it. The same acceptance as U2, plus a learning session run in English, with dates and numbers formatted for that locale. |
| U4 — Teacher authoring | `app/(teacher)`, `lib/course-authoring`, the course, chapter, topic, exercise, readiness and portfolio schemas, and their actions. The detail plan may split it into two PRs by screen group. | Needs U1. The same acceptance as U2, covering creation, editing, readiness guidance and publish-impact messages. Replace every error branch that matches message text (such as `ExerciseNodeEditors.tsx` lines 95 and 287–289) with codes or field paths. The same invalid input must mark the same field in both locales. QA accounts and data for the teacher role are confirmed when the unit opens. |
| U5 — Admin, payments and API messages | `app/admin`, `lib/admin`, `PaymentHistory` and payment-history formatting, discounts, the checkout action and the enrollment card's checkout messages, other user-visible messages of the PayOS flow, and `app/api` responses that reach the UI. | Needs U1. The same acceptance as U2. Currency stays VND, and the PayOS order description and webhook contract stay unchanged. QA accounts and data for the admin role are confirmed when the unit opens. English checkout display is verified through a `pending` payment fixture opened by `resumePendingCheckout`, which does not call PayOS. Messages that appear only when a new order is created (`payosService.paymentRequests.create` in `app/actions/payment.ts`) are covered by focused action tests with PayOS mocked. |
| U6 — Auth emails | Confirmation and recovery email subjects and bodies, for the local config and the hosted project. | Needs U1, plus the Owner's choice of email approach on [ENLOC-001](./problems.md#enloc-001-auth-email-language-approach) and a local-trial grant. Apply the chosen approach locally and verify subject, body and the confirm/recovery links with real emails from the local stack. If the approach relies on one flag, also show the flag off, on and off again; if that trial fails, stop and return the decision 5 exception to the Owner before U8. The hosted template change happens at the U8 release step, not at U6 merge, and always needs its own grant. |
| U7 — Legal pages | English `/privacy` and `/terms`. A change to the Vietnamese cookie text belongs to ENLOC-002 and lands with the cookie in U1. | Needs U1. The Owner approves the English wording (decision 4) before merge. The English version states that the Vietnamese text prevails. |
| U8 — Enable and closing audit | Repeat the diacritics grep with an allowlist covering comments, learning content, fixtures and test data. Run the main student, teacher and admin flows in English. Turn the English flag on, together with the hosted email change from U6. | Needs U2–U7 merged and H4 passed. The audit reports zero unexplained Vietnamese UI strings, and the English flows pass in local E2E on the local stack, including profile payment history and the `pending` checkout fixture from U5. Before the hosted email change, either U6 has shown that one flag change controls both the interface and the emails, or the Owner has approved the decision 5 exception in ENLOC-001. The Preview read-only smoke passes on public pages and on the accounts the Owner provides for each role. If a role's account or data is missing, stop and report; do not enable on partial evidence. The flag turns on only with release authority. |

## 5. Order and rollout gates

1. U1 merges first, with the flag off, so production stays Vietnamese.
2. U2–U5 and U7 can proceed in any order or in parallel after U1. Coordinate shared namespace files, and refresh each branch's base before review. Each merge follows the [production release gate](../../sop/production-release-gate.md), and production stays Vietnamese because the flag is off.
3. U6 opens once the Owner has chosen the email approach in ENLOC-001 and granted a local trial. ENLOC-001 stays open until U6's evidence or an approved exception closes it. The hosted template change waits for the U8 release step and needs its own grant.
4. U8 runs once U2–U7 are merged and H4 has passed. Turning the flag on in production is the program's single user-visible release step, and it needs explicit authority. To roll back, turn the flag off, which brings back Vietnamese-only output without reverting code.
5. Hosted auth emails follow that step only if U6 proves one flag change controls them. Otherwise they are a second, independent hosted change, allowed only under an Owner-approved exception to decision 5 recorded in ENLOC-001. The exception sets the order (interface flag first, then hosted templates), a check between the two, and a separate rollback for each: flag off for the interface, previous templates for the emails. A failure in the second change rolls back only that change.

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| Reading the cookie disables static rendering and slows pages or raises cost. | U1 records the routes that changed (H4) and stops before rollout if a cache-critical route regresses. |
| The volume of strings causes missed or mistyped keys. | Key-parity test, typed message keys where the library supports them, the U8 grep audit. |
| Translating shared schemas changes validation behavior. | H3 keeps rules unchanged, and each unit runs its existing schema and action tests in both languages. |
| Large catalog files cause merge conflicts between parallel units. | Per-namespace files (H2), with one unit owning each namespace. |
| Machine-quality English reads poorly. | Each unit's English text gets a human read during Owner QA; the legal pages need explicit approval. |
| Auth emails reach users in the wrong language, or drift from the interface state. | ENLOC-001 defines the behavior with the flag off, on and off again. The hosted change waits for U8 and, unless one flag controls it, needs the decision 5 exception with its own order, check and rollback. |
| U1 makes cache-critical routes dynamic while the flag is off. | The U1 pre-merge route-table comparison against baseline. |
| A cache serves one locale's page to another visitor. | The H4 Preview check in both orders before the enable gate. |
| Error highlighting breaks when messages change language. | The error-code invariant and the U4 both-locale field check. |

## 7. Out of scope

- Multilingual learning content or schema changes for it (decision 1).
- Locale URL prefixes, `hreflang` or locale-specific SEO (decision 2).
- Languages other than Vietnamese and English.
- Translating code comments, logs, documentation or test names.
- Storing the locale in the user profile or database.
- Vietnamese copy edits, except Owner-approved legal wording under ENLOC-002.
