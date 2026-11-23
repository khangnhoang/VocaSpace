# U2 detail plan — public, auth and profile

Revision: r3, 2026-11-23. Owner approval: r3 on 2026-11-23. Master plan: [plan.md](../../plan.md) (unit U2). Progress: [progress.md](../../progress.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: these screens have English text behind the U1 flag:

- the homepage;
- the auth screens (`/login`, `/register`, `/forgot-password`, `/auth/set-password`);
- the public course catalog, course detail and public topic preview;
- the profile.

With the flag off, they render exactly the Vietnamese they render today. With the flag on and English active, they show no Vietnamese outside learning or user content and outside the payment regions that U5 owns. Their errors, validation messages, toasts, accessible names, page metadata and number formatting follow the active language on both the client and the server.

| ID | Observable result |
| --- | --- |
| AC1 | **Flag off: text is unchanged.** Every page in the page set renders the same visible text, accessible names, `<title>`, `meta[name="description"]` and `<html lang>` as the base build, whatever `Accept-Language` or the locale cookie says. Rendered at 1440 and 375px, the snapshots of the base build and the final candidate are identical. <br>The page set is: `/`, `/login`, `/register` at its first stage, `/forgot-password`, `/courses`, course detail as a guest and as an enrolled student, a public topic preview that is actually open, and `/profile` with its edit and password forms. The data that opens each page is recorded at CP1 (H6). |
| AC2 | **Flag on, English: no Vietnamese leftovers.** The page set is in English, covering visible text, accessible names, title and description. The register stages, the check-email panel and `/auth/set-password` are checked through render tests. <br>The scan excludes the U5 payment surfaces listed under the Payments non-goal: `PaymentHistory` on `/profile`, the checkout dialog with its payment stages, and the checkout toasts, including those raised outside the dialog such as the resume-payment notice. AC1 still compares whole pages. <br>The only Vietnamese left falls into these allowed categories: <ul><li>teacher-authored course content: titles, descriptions, topic and chapter names, instructor names, words, meanings and examples;</li><li>the user's own data;</li><li>the sample learning content of the homepage hero and the auth word deck, meaning the word, phonetic, part-of-speech label and meaning (decision 1);</li><li>the local-only sample testimonials;</li><li>messages returned by `createCheckoutSession`, including its free-enrollment message, which U5 converts.</li></ul> A diacritics scan of the rendered text and accessible names, followed by a manual check of every hit, shows this. Every remaining Vietnamese string is listed in State with its category. The same scan also looks for raw catalog keys (`namespace.key` patterns), which must not appear. |
| AC3 | **Validation and action messages in both languages.** <ul><li>The auth and profile schemas accept and reject the same inputs in both languages, with the same issue path, the same first issue and the same field marked. Client validation shows the message under the same field as today.</li><li>Each action listed below returns its translated message on every path that returns a message today. Where an action returns before a side effect today, it still does.</li><li>Every response keeps its shape and the kind of message it carries. An action that answers with one generic message keeps answering with that one message, whether the input was invalid or the attempt failed. Only actions that return a schema issue today translate that issue (H3).</li></ul> Actions: `signInUser`, `signUpUser` (its remaining messages), `resendSignupConfirmation`, `requestPasswordRecovery`, `setPasswordAfterConfirmation`, `getUserProfile`, `updateUserProfile`, `uploadAvatar`, `updateUserPassword`, `getFirstTopicSlugByCourseSlug`, and those messages of `getPublicCourseCatalog`, `getPublicCourseCatalogListing`, `getPublicCourseDetail`, `getPublicCoursePreview` and `answerPublicCoursePreviewQuestion` that U2 screens show. The Vietnamese text is exactly today's text, including the text a missing or wrong-type field produces today (CP1 records it before any change). |
| AC4 | **Toasts and screen-reader text.** <ul><li>Toasts, status text, `aria-label`, `aria-valuetext` and screen-reader-only text in U2 screens follow the active language. The U5 checkout surfaces in the Payments non-goal are the only exception. The toasts for opening the first topic stay in U2.</li><li>The same holds for the shared learning presentation as U2 screens render it: <ul><li>`FlashcardStage` labels and the `FLASHCARD_RATINGS` labels Lại, Khó, Ổn, Dễ (master: owned by U2);</li><li>in the public preview, the texts of `QuestionNavigator`, `ExerciseContext` and `ChoiceGroup`, including an answered question's feedback and the navigator's accessible name;</li><li>on the enrolled course detail, the learner activity card from `CourseLearningActivity` and `formatRelativeDay`.</li></ul></li><li>The learning screens of U3 reuse the flashcard labels, so `LearningWorkspace` and `ReviewSheet` also show the four rating labels and the `FlashcardStage` labels in the active language. Their other text stays as it is until U3.</li></ul> |
| AC5 | **Formatting.** In U2 screens, numbers, prices and dates go through the U1 helpers in `lib/i18n/format.ts`. The `vi` output equals today's `vi-VN` output, and prices stay VND. The `/register` date picker uses the `date-fns` locale of the active language. |
| AC6 | **Existing tests unchanged.** The existing Vitest unit suite, the integration suite (`npm run test:integration`) and the full Playwright suite (`npm run test:e2e`) pass with their Vietnamese assertions unchanged, except under G6. |
| AC7 | **Catalog parity.** The key-parity test covers every new namespace, and every key added in U2 is used by converted code. |
| AC8 | **Route modes.** With the flag off, a `next build` of the final candidate gives the same route table (static or dynamic) as a build of the U2 base. |

### 1.2 Scope and non-goals

In scope:

- **Auth.**
  - `app/(client)/(auth)/**`: all text on `/register` that U1 left (stages, gender option labels and the other `signUpUser` messages), plus `/login`, `/forgot-password` and `CheckEmailPanel`.
  - `app/auth/set-password/**`, `components/auth/**` and the user-visible text in `lib/auth/**`.
  - `app/actions/auth.ts`, and the login, recovery, resend and set-password schemas in `lib/schemas/auth.ts`.
- **Home.**
  - `app/(client)/page.tsx` and `app/(client)/_components/home/**` (`HomeFooter` is already done).
  - `app/(client)/_components/PublicCourseHighlights.tsx`.
  - The UI labels in `HeroPractice` and `lib/auth/word-deck.ts` (decision 1).
  - The shared flashcard presentation: `lib/flashcard-ratings.ts`, `FlashcardStage.tsx`, and the line in `app/(client)/learn/_components/ReviewSheet.tsx` that renders a rating `label`. That edit is narrow and changes nothing else in `ReviewSheet`.
- **Courses.**
  - `app/(client)/courses/**`, including the `metadata` and `generateMetadata` text outside course content, the loading states and the public topic preview.
  - `app/actions/public-course.ts`, `app/actions/public-course-preview.ts`, `lib/public-courses/**`, and `lib/schemas/public-course.ts` and `public-course-preview.ts`.
  - The messages of `getFirstTopicSlugByCourseSlug` in `app/actions/course-navigation.ts`. Its only callers are U2 screens, and the navigation contract stays unchanged.
  - The parts of `PublicCourseEnrollmentCard` that are not checkout: the price label, the CTA labels, the learner progress card, and the client fallback texts for free enrollment and opening the first topic.
  - The texts that U2 screens render through `QuestionNavigator`, `ExerciseContext`, `ChoiceGroup`, `CourseLearningActivity` and `lib/learning-activity-format.ts` (H7).
- **Profile.**
  - `app/(client)/profile/**` except `payment-history.tsx`.
  - `getUserProfile`, `updateUserProfile`, `uploadAvatar` and `updateUserPassword` in `app/actions/profile.ts`, and `lib/schemas/profile.ts`.
- **Catalog wiring.**
  - `messages/{vi,en}/*.json` for the U2 namespaces, and their registration and per-subtree pick in `lib/i18n/messages.ts`.
  - The nested provider at each layout or page that H2 names, including the `learn` subtrees that render `FlashcardStage` or `ReviewSheet`. This adds provider wiring only.
- **Tests.** The new and directly affected tests named in the checkpoints.
- **Test support.**
  - The U1 `next-intl` test aliases in `vitest.integration.config.ts`, so integration tests can run actions that translate.
  - The snapshot and scan scripts used as evidence (H6). They stay outside the app code.

Non-goals:

- **Payments (U5).** `PublicCoursePaymentModal`, `PublicCoursePaymentStageDiscount`, `PublicCoursePaymentStageQr`, the checkout messages of `PublicCourseEnrollmentCard` (session creation and connection failures, payment success, resume-payment notices) and `payment-history.tsx`. Also the payment actions and schemas, including the messages that `createCheckoutSession` returns for free enrollment.
- **Learning flow (U3).** The learning screens and their texts other than the shared pieces named above. `getDeckReviewCards` and the rest of `course-navigation.ts` stay with U3.
- **Teacher and admin.** The teacher course preview (`app/actions/course-preview.ts`, `lib/schemas/course-preview.ts`) and `components/ui/confirm-dialog.tsx` belong to U4. `app/actions/user.ts` and the admin parts of `lib/auth/admin-access.ts` belong to U5.
- **Other units.** Legal pages (U7) and auth emails (U6).
- **Content.** Teacher-authored content, user data, the sample words and meanings (decision 1), and the Owner-provided and local-only sample homepage content in `lib/homepage/content.ts`. Also code comments, logs and error codes.
- **Behavior.** No change to validation rules, redirects, permissions, response shapes or data.
- **Data.** No new seed or fixture data in `supabase/seed.sql`.
- **Done in U1.** Header, footer, not-found and the `registerSchema` messages.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Vietnamese strings move into the catalog verbatim. Each move is checked against the old text, through the unchanged Vietnamese assertions or an exact comparison script over the moved strings, never by retyping. | A silent Vietnamese wording change, against the master invariant. |
| G2. Every schema keeps its rules, field order and issue paths. Each issue that reaches a form field or a user-facing response carries a catalog key, as in U1 G3. That includes wrong-type issues from missing `FormData` fields, and object-level issues for actions that take `unknown`. Where such an issue shows Zod's default text today, that text is recorded before the change and kept as the Vietnamese value. Issues that only drive an internal branch (for example a slug parse that leads to `not_found` or a generic message) get no key. | A raw key or Zod's default English text reaches the user, the languages accept different inputs, or Vietnamese output changes. |
| G3. Code that reacts to an error branches on a code or a field path, never on message text. U2 adds no new text-matching branch. | English messages mark the wrong field or take the wrong branch (master invariant). |
| G4. Each client subtree receives an explicit list of namespaces: `common`, `validation` and the namespaces its components use. A namespace reaches the browser only on the routes that render it. | Every page ships the whole catalog, or a nested provider drops `validation` and a raw key reaches the user. |
| G5. The locale only selects text and formatting. Redirect targets, return paths, query parameters such as `?thanh-toan=tiep-tuc`, cookie names and stored values stay unchanged. | A tampered or English locale changes navigation or behavior. |
| G6. Existing tests change only in three ways: <ul><li>render setup moves to the shared provider (U1 helper);</li><li>a schema test may assert the message key and issue path instead of the exact text, provided a render or action test of the same field asserts that exact Vietnamese text (master schema-test exception);</li><li>an import path changes when a string moves.</li></ul> Any other changed assertion, including a source-reading test switched to catalog keys, stops the work. The test, the assertion and the replacement evidence then go to the Owner for approval. | Test edits hide a wording or behavior regression. |
| G7. Code outside section 1.2 stays untouched, apart from render setup under G6. Shared learning components change only as H7 allows. | U2 grows into U3–U5 territory and conflicts with their namespaces. |
| G8. With the flag off, the U1 resolver still returns `vi` without reading cookies or headers. U2 adds no other read of request data for the locale. | Static routes turn dynamic, or the locale leaks before the release gate. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1–5.
- 1 (2026-11-23). On the homepage hero cards and the auth word-deck cards, the word, phonetic, part-of-speech label and meaning are sample learning content and stay as written. Deck names, tags, rail marks, steps, prompts and instructions are interface text and get English.
- 2 (2026-11-23). U2 ships as one PR with four checkpoint commits (auth, home and shared flashcard, courses, profile) and a final check, as master section 4 sets. This decision does not itself grant commits, push, PR or merge.
- 3 (2026-11-23). Owner QA for the student role uses the local seed data (seed accounts and courses) on a local build with the flag on. No Preview or hosted account is needed. Automated evidence for the public preview and the enrolled course detail uses the E2E fixtures (H6). The seed has no open preview topic, so the preview part of Owner QA stays pending until the Owner decides how to provide one.
- 4 (2026-11-23). An independent Codex review of this plan (`gpt-6.2-astra`, medium, read-only, at most three rounds) runs before Owner approval.

## 2. Repository facts

Baseline: `20fadd25` (origin/main), checked 2026-11-23. U1 merged in PR 193.

- **U1 foundation.**
  - The foundation files are `i18n/request.ts`, `lib/i18n/{config,format,messages,request-locale,resolve-locale}.ts` and the catalogs `messages/{vi,en}/{common,validation}.json`.
  - `pickClientMessages` sends `CLIENT_NAMESPACES = ["common", "validation"]` through the root `NextIntlClientProvider` in `app/layout.tsx`.
  - Already converted: `HomeFooter.tsx`, part of `register/page.tsx`, and the `registerSchema` path in `app/actions/auth.ts` lines 88–90.

  *Justifies G4, G8 and the scope boundary.*
- **Nested providers.** In the installed `use-intl` (`dist/esm/development/react.js` lines 38–49), a nested provider inherits `messages` only when its own `messages` prop is `undefined`. Passing a subset replaces the parent's messages. The U1 Vitest helper `__tests__/support/intl.tsx` passes the whole `MESSAGES[locale]`, so a render test cannot detect a namespace the real tree lacks. *Justifies G4, H2 and the CP1 real-build check.*
- **Size.** Counted as non-comment lines that hold Vietnamese, payment components excluded:
  - `app/(client)` in U2 scope (without `learn`, `privacy` and `terms`): about 390 lines in 40 files. The largest are `HeroPractice.tsx` (41), `register/page.tsx` (40), `PublicCoursePreviewExperience.tsx` (36), `PublicCourseEnrollmentCard.tsx` (21), `CatalogExplorer.tsx` (20), `edit-profile-form.tsx` (18) and `login/page.tsx` (14).
  - `components/auth` about 47, `lib/auth` 37, `app/auth/set-password` 12.
  - Actions: `auth.ts` 11, `profile.ts` 19, `public-course.ts` 2, `public-course-preview.ts` 2.
  - Schemas: `auth.ts` 15, `profile.ts` 8.

  *Justifies the four-checkpoint split.*
- **Shared learning presentation.**
  - `FlashcardStage.tsx` holds screen-reader labels, "Giải thích chi tiết", "Mẹo", "Hiện đáp án" and a progress `aria-valuetext`.
  - `lib/flashcard-ratings.ts` holds the four rating labels. `HeroPractice.tsx`, `HomeHowItWorks.tsx`, `FlashcardStage.tsx` and `ReviewSheet.tsx` import it, and `ReviewSheet.tsx` renders `{label}` itself (line 293).
  - `FlashcardStage` is rendered by `HeroPractice`, `PublicCoursePreviewExperience` and `LearningWorkspace`.
  - The preview also imports `ChoiceGroup`, `ExerciseContext`, `QuestionNavigator`, `StickyColumn` and `exercise-arrangement` from the `learn` tree (`PublicCoursePreviewExperience.tsx` lines 26–33).
  - The enrolled course card uses `CourseLearningActivity` (`components/learning-activity`) and `formatRelativeDay`.

  *Justifies AC4, H7 and G7.*
- **Sample content.**
  - `HeroPractice.tsx` mixes sample cards (word, phonetic with a Vietnamese part of speech, meaning) with UI text: the deck tab and title, "Còn {n}/{m} thẻ", step labels, rail marks and outcome text.
  - `lib/auth/word-deck.ts` mixes sample cards with UI tags ("Đến hạn", "Đã xong"), titles and texts.
  - `lib/homepage/content.ts` holds empty real lists and a local-only `SAMPLE_CONTENT`.

  *Justifies decision 1 and the AC2 categories.*
- **Action message shapes.**
  - `signInUser` returns one `SIGN_IN_FAILED_MESSAGE` both for invalid input and for a failed sign-in (`app/actions/auth.ts` lines 193–198).
  - `resendSignupConfirmation` and `requestPasswordRecovery` return one generic success message (lines 161–184).
  - `setPasswordAfterConfirmation` returns `issues[0].message` (line 216) and maps update errors by code (lines 226–230).
  - `getUserProfile` returns two fixed errors (`app/actions/profile.ts` lines 34 and 48), and the profile sidebar shows them as toasts.
  - `updateUserProfile` returns `issues[0].message` (line 76), and it returns code-mapped errors for other failures.
  - `getFirstTopicSlugByCourseSlug` returns fixed Vietnamese errors (`course-navigation.ts` lines 8–48). It is called only from `PublicCourseEnrollmentCard.tsx` line 69 and `PublicCoursePreviewExperience.tsx` line 316, and both show `result.error`.

  *Justifies AC3 and H3–H4.*
- **Formatting.**
  - `new Intl.NumberFormat("vi-VN")` appears in `CatalogCourseCard.tsx` line 12, `CatalogHero.tsx` line 8 and `PublicCourseCard.tsx` line 15.
  - `toLocaleString("vi-VN")` appears in `PublicCourseEnrollmentCard.tsx` line 147 and `PublicCourseStats.tsx` line 39.
  - `register/page.tsx` line 8 imports the `date-fns` `vi` locale.

  *Justifies AC5.*
- **Branching on errors.** The only message-matching branch near U2 is `app/actions/user.ts` line 225. It matches database error codes, not Vietnamese text, and it is an admin action in U5. *Justifies G3 as a guard, not a refactor.*
- **Metadata.**
  - Route metadata exists in `app/(client)/courses/page.tsx` and `app/(client)/courses/[course-slug]/page.tsx`.
  - `__tests__/components/public-course-detail.test.tsx` (around line 314) covers the detail metadata. No test covers the `/courses` metadata. `__tests__/utils/seo-metadata.test.ts` covers sitemap, robots and the proxy matcher only.

  *Justifies the CP3 metadata tests.*
- **Unit tests.** About 40 test files import U2 code and hold Vietnamese. The main ones are `auth-onboarding.test.tsx`, `public-course-preview.test.tsx`, `public-course-detail.test.tsx`, `homepage.test.tsx`, `public-course-catalog-explorer.test.tsx`, `profile.test.ts` and `auth.test.ts`. The U1 tests `register-validation-i18n.test.tsx`, `sign-up-validation-i18n.test.ts` and `english-shell.test.tsx` are the pattern for the new English tests. *Justifies G6 and the checkpoint checks.*
- **Integration tests.**
  - `npm run test:run` and `npm run test:ci` exclude `__tests__/integration`, which runs through `npm run test:integration` on a local Supabase stack.
  - `vitest.integration.config.ts` lacks the U1 `next-intl/server` and `next-intl/config` aliases that `vitest.config.ts` has. Without them, `getTranslations` is `notSupported` there.
  - `profile-username-once.test.ts` calls `updateUserProfile` and asserts exact Vietnamese (line 217).
  - `auth-email-signup-flow`, `auth-password-recovery-flow`, `auth-password-setup-markers` and `a5-profile-gender-values` call U2 actions.

  *Justifies AC6, the CP1 integration trial and the Final checks.*
- **E2E.**
  - Smoke specs drive `/login` through `e2e/support/auth.ts`, along with `auth-return-path`, `account-menu`, `profile-username-once`, `public-course-discovery`, `public-course-detail-progress` and `public-course-free-enrollment`.
  - `e2e/d2/public-course-preview.spec.ts` uses a fixture that opens a public preview topic. Playwright pins `vi-VN` (U1).

  *Justifies AC6 and H6.*
- **Seed data.** The local seed (`supabase/config.toml` line 71 loads `supabase/seed.sql`) has the student account `student@gmail.com` and seeded courses, but no topic with `is_preview`. The public preview RPC requires `t.is_preview` (`supabase/migrations/20260924120000_d2_guarded_public_preview_service.sql` line 139). *Justifies decision 3 and H6.*
- **Route modes.** U1 recorded every page route as dynamic, because the header reads the Supabase session. *Makes AC8 a cheap confirmation.*

## 3. Bounded implementation hypotheses

- **H1, namespaces.** The new namespaces are `auth`, `home`, `courses`, `profile` and `flashcard`, and `validation` gets the new schema keys. The names may change while G4 and the parity test hold.
- **H2, client delivery.** Each subtree that needs more than the root's namespaces gets a nested `NextIntlClientProvider`. That provider receives an explicit pick of `common`, `validation` and its own namespaces from one helper next to `pickClientMessages`:
  - `(auth)` and `app/auth/set-password`: `auth`;
  - `/`: `home` and `flashcard`;
  - `courses`: `courses`, plus `flashcard` only in the public preview subtree;
  - `profile`: `profile`;
  - `learn`: `flashcard`, only in the subtrees that render `FlashcardStage` or `ReviewSheet`.

  A server component that passes translated strings as props may replace a provider where that is simpler. CP1 proves the provider tree on a real build: `/register` in English shows an `auth` label and a `validation` error together, and the AC2 scan finds no raw key.
- **H3, schema messages.** The schemas whose issues reach the user (`setPasswordAfterConfirmation`, `updateUserProfile`, `updateUserPassword`, the profile forms and the auth forms' client validation) use message keys with field-level error options, as U1 did for `registerSchema`. The form translates `errors.<field>.message`, and the action translates the first issue on the server. Actions that answer with a generic message (`signInUser`, `resendSignupConfirmation`, `requestPasswordRecovery`) keep that message on every path and only translate it.
- **H4, constant messages.** Action-level message constants such as `SIGN_IN_FAILED_MESSAGE`, `RECOVERY_MESSAGE` and `SAME_PASSWORD_MESSAGE` become keys that are translated with `getTranslations` when the action returns. The returned shape `{ error }` or `{ success, message }` stays the same. CP1 first proves one translated failure path through the integration config, after adding the U1 aliases. Constants shared by `auth.ts` and `profile.ts` (`SAME_PASSWORD_MESSAGE` and `WEAK_PASSWORD_MESSAGE` from `lib/auth/password-update-messages.ts`) change in one checkpoint for both callers: CP1 converts both return sites, and runs the `same_password` and `weak_password` cases of `setPasswordAfterConfirmation` and `updateUserPassword` there. No caller returns a raw key in between.
- **H5, word deck.** `lib/auth/word-deck.ts` and `HeroPractice` keep the sample card data in place and move only the UI fields to keys (decision 1). A deck scene's `title` and `text` become keys that the component translates.
- **H6, evidence tooling and data.**
  - **Snapshot tool.** The AC1 snapshot tool is a Playwright script like U1 CP3's. It reads visible text, accessible names, title, description and `lang` from a flag-off `next start` build.
  - **Stable captures.** Both captures run with reduced motion, and each page waits for a marker that its data has loaded (the profile form values, the learner card, the preview's first card or question). This keeps the `/login` word deck and async content stable between captures.
  - **Data.** The data comes from the E2E fixtures on the isolated stack, because the local seed has no preview topic. The D2 fixture adds a random suffix to titles and slugs and is cleaned up after its spec. So each base/candidate pair is captured on the same fixture instance, before cleanup and before any reset: the base build (`20fadd25`) is started again next to the candidate for every comparison, at each checkpoint and at Final. The capture records the slugs and the marker that proves each page opened as intended: for the preview, a known card or question rather than the unavailable state.
  - **Scan.** The AC2 scan uses the same script with the flag on and an English locale.

  The JSON outputs from the base and the candidate are compared exactly.
- **H7, shared learning components.** `QuestionNavigator`, `ExerciseContext`, `ChoiceGroup` and `CourseLearningActivity` take their fixed texts as optional props or a label object whose defaults are today's Vietnamese. U2 screens pass translated values, while U3 callers keep the defaults and render unchanged until U3. `formatRelativeDay` takes the locale and label source the same way. If a component cannot take labels without changing its behavior or its U3 rendering, stop and ask the Owner whether U2 or U3 should own that component.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | **Auth.** The `(auth)` pages, set-password, `components/auth`, the UI text of `lib/auth`, the `auth.ts` actions and the remaining auth schemas are converted (decision 1 for the deck). First, the integration config gets the U1 aliases and one translated action path is proven through it (H4). The snapshot tool and its data (H6) are set up, the base snapshots are captured from `20fadd25`, and the base output is recorded for the missing or wrong-type inputs of each AC3 action that returns a schema issue, all before any app change. That covers the auth actions and `updateUserProfile` and `updateUserPassword`, at both object and field level. The nested provider helper (H2) is proven on a real build. | Existing auth unit and integration tests unchanged apart from G6. English render tests for login, every register stage, the check-email panel, forgot-password, set-password and the word deck. Direct action tests in both languages for every message path of the AC3 auth actions, with no side effect where the action returns before one today, and generic responses kept generic. Schema accept/reject parity in both languages. The `same_password` and `weak_password` cases of `updateUserPassword` pass in both languages (H4). A local flag-on build in which `/register` shows an `auth` label and a `validation` error in English together. Flag-off snapshot comparison for `/login`, `/register` and `/forgot-password`, with base and candidate captured as a pair (H6). |
| CP2 | **Home and shared flashcard.** The homepage sections, `PublicCourseHighlights`, the `HeroPractice` UI labels, the `FlashcardStage` labels and `FLASHCARD_RATINGS`, the rating label line in `ReviewSheet`, and the `flashcard` namespace delivered to `/`, the public preview and the `learn` routes. | `homepage.test.tsx` and the learning and review tests that render `FlashcardStage` or `ReviewSheet` stay unchanged apart from G6. English render tests for the hero, a how-it-works section and `FlashcardStage` with its `aria-valuetext`. `ReviewSheet` render tests show the four rating buttons' accessible names in both languages. A local flag-on build with the student account shows the four rating labels in English on a learning page with no raw keys. Flag-off snapshot of `/`. |
| CP3 | **Courses.** The catalog, course detail, public preview with its shared components (H7), the non-checkout parts of the enrollment card, the learner activity card, the public course and navigation actions, metadata and format helpers. | The catalog, detail, preview, enrollment-dialog and learning-activity tests stay unchanged apart from G6. English render tests for: <ul><li>the catalog: empty state, filters and pagination;</li><li>course detail as a guest and as enrolled, including the activity card;</li><li>the preview, including an answered question's feedback and the navigator's accessible name.</li></ul> The U3 callers of the shared components render unchanged in Vietnamese. English metadata tests for `/courses` (new) and course detail. Action tests in both languages for the AC3 public-course and navigation messages. Format helper output for `vi` equals today's strings. Flag-off snapshots of `/courses`, detail as a guest and as enrolled, and the open preview. |
| CP4 | **Profile.** The profile page, sidebar, edit and password forms, with their actions and schema, except payment history. | The profile and edit-form unit tests, and the profile integration tests (including `profile-username-once`), stay unchanged apart from G6. English render tests for the sidebar, the edit form and the password form. Action tests in both languages for each AC3 profile message path, including both `getUserProfile` errors. Flag-off snapshot of `/profile`. |
| Final | **Cumulative check.** Whole-diff self-review against AC1–AC8. State then records the AC2 leftover list and the hypothesis results. | <ul><li>`npm run test:ci`, `npm run test:integration` on a local stack, `npx tsc --noEmit`, `npm run lint` and `npm run docs:check`.</li><li>Full AC1 snapshot comparison: base against candidate, flag off, both widths, with an English header and an `en` cookie.</li><li>AC2 scan of a flag-on build, with every hit classified and no raw keys.</li><li>AC7 key-usage search and AC8 route tables.</li><li>Full `npm run test:e2e` on the isolated stack.</li><li>Owner QA on a local flag-on build (decision 3), including an English read of the copy.</li></ul> |

Steps that need their own authority, and are not granted by this plan or its approval:

- **Commits.** Each checkpoint commit needs a commit grant.
- **Implementation review.** The independent Codex review of the implementation needs the Owner's grant for those model calls.
- **Delivery.** Push, PR, CI and merge need their own grants. Before review, the branch is refreshed onto the current main, and each merge follows the [production release gate](../../../../sop/production-release-gate.md) (master section 5).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A Vietnamese string changes while moving. | G1, G2's recorded base output, unchanged Vietnamese assertions (AC6), and the AC1 snapshot comparison against the base. |
| A nested provider drops a namespace and a raw key reaches the user. | G4, the explicit pick helper (H2), the CP1 real-build check and the AC2 raw-key scan. Render tests alone cannot catch this, because the Vitest helper passes every namespace. |
| U3 learning screens change before U3. | Only the four rating labels and the `FlashcardStage` labels change there (master ownership); with the flag off nothing changes. H7 keeps the other shared components on their Vietnamese defaults for U3 callers, and CP2 and CP3 test those callers. |
| A translated generic auth message starts revealing whether the input or the credentials were wrong. | AC3 and H3 keep generic responses generic on every path. |
| The snapshot comparison is flaky or compares an unavailable state. | H6: reduced motion, load markers and recorded fixture data with a proof marker. |
| The client bundles grow with every namespace. | G4 and H2 scope namespaces to route subtrees. |
| Sample card text gets translated by mistake, or UI text inside the cards stays Vietnamese. | Decision 1, H5, and the AC2 leftover list reviewed in Owner QA. |
| Converting the enrollment card touches checkout code owned by U5. | The non-goal boundary. U5 later converts the checkout messages in the same file, and the conflicts stay small because the strings differ. |

- **Rollout.** The flag stays off in production, so merging changes nothing visible.
- **Stop when:**
  - a Vietnamese assertion must change beyond G6;
  - the AC1 snapshots differ;
  - H2 has no working form that keeps G4;
  - H7 cannot keep the U3 callers unchanged;
  - the route table changes with the flag off;
  - the scope would cross into U3–U5 files beyond section 1.2.
- **Rollback.** Revert the PR. No data or hosted configuration changes.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
