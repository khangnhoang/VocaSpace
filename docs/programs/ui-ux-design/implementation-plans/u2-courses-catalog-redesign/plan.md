# U2 detail plan — public course catalog redesign

Revision: r3, 2026-11-05 (independent review r1 findings, decision 12, r2 review suggestions). Owner approval: r3 on 2026-11-05. Charter: [README.md](../../README.md) (initiative U2).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `/courses` becomes a searchable, filterable, sortable and paginated catalog. It uses Product Language and the accepted U1 header and card language, shows each course's content size, instructor and a direct preview entry, and gives signed-in learners a way back into enrolled courses. Every number and badge comes from real data. The homepage keeps its U1 card and data path; only its loading, empty and error states move to Product Language tokens (UIUX-001).

The Owner accepted the rendered demo [sources/index.html](./sources/index.html) on 2026-11-05, amended by the decisions in §1.4. Where the demo and §1.4 differ, §1.4 wins. The demo's sample data, cover art and demo panel are not part of the design.

| ID | Observable result |
| --- | --- |
| AC1 | A visitor opening `/courses` sees one `h1` "Tìm khóa học hợp với mục tiêu của bạn", the eyebrow "Thư viện khóa học", the accepted lead, and a facts row built only from the loaded catalog: total courses, free courses (omitted when 0) and courses with an eligible preview (omitted when 0). The facts row is absent when the catalog is empty or failed. |
| AC2 | Typing in the search field filters by course title, ignoring case and Vietnamese diacritics (`đ` matches `d`). The matched part of each title is highlighted. A clear button and `Esc` empty the field. `/` focuses the field when focus is not in a text control. A polite status region announces the result count after each change. |
| AC3 | A price group control offers Tất cả / Miễn phí / Trả phí. Each option shows the count of courses matching the current search and preview filters. The active option has `aria-pressed="true"`. A "Có học thử" toggle restricts results to courses with an eligible preview. |
| AC4 | A sort select offers Phổ biến nhất (total enrollments, ties newest first), Thịnh hành 30 ngày (enrollments in the last 30 days, ties by total enrollments), Mới nhất (`created_at`), Tên A–Z (Vietnamese collation), Giá thấp đến cao and Giá cao đến thấp (ties by popularity). Default is Phổ biến nhất. Under Thịnh hành, each card with a positive 30-day count shows "+N trong 30 ngày". |
| AC5 | Search, price group, preview filter, sort and page live in the URL as `q` (trimmed, at most 100 characters), `gia` (`free`/`paid`), `hoc-thu=1`, `sap-xep` (`trending`, `newest`, `az`, `price-asc`, `price-desc`; `popular` is the default) and `trang`; default values are omitted. Opening such a URL renders that state in the server HTML. Unknown or invalid values fall back to their defaults, a page beyond the last clamps to the last page, and the address bar is then rewritten to the canonical URL without a new history entry. Changing search, filters or sort resets to page 1 and replaces the history entry; changing page adds a history entry. Back and Forward re-render the list for the URL they land on, and returning from a course detail page restores the page and filters that were open. |
| AC6 | Results show 12 courses per page. When there are more than 12, a pagination `nav` shows numbered pages with ellipses, Trước/Sau (disabled at the ends), `aria-current="page"` on the current page and the line "Hiển thị a–b trong N khóa học". After a page change the list top is scrolled into view below the sticky toolbar and focus moves to the first course link of the new page. |
| AC7 | Each course card shows: cover image or the existing no-cover fallback; badges "Đang học" (AC8), Miễn phí or Trả phí, and "Mới" when `created_at` is within 30 days; total enrollments; the title as an `h3` link to the detail page, under a visually hidden `h2` "Danh sách khóa học"; the owner's name when public data has one; up to two lines of description when present; "N chủ đề · N thẻ từ vựng" when the course has at least one public topic; the price; and one footer action — "Tiếp tục học" for an enrolled learner, otherwise "Học thử" to the first eligible preview topic, otherwise "Xem chi tiết". The whole card opens the detail page without nesting interactive elements. |
| AC8 | A signed-in user sees "Đang học" and "Tiếp tục học" (to `/learn/<course-slug>`) on exactly the courses they are enrolled in. Guests trigger no enrollment read. If the enrollment read fails, the catalog still renders without any "Đang học" state and the failure is logged server-side. |
| AC9 | States: (a) loading shows a skeleton matching the new toolbar and grid; (b) a failed catalog shows an error panel with the existing retry behavior and keeps the URL state; (c) an empty catalog shows the empty-library panel with "Thử bộ thẻ mẫu" linking to the homepage trial, and no toolbar; (d) a one-course catalog shows a single wide card and no toolbar; (e) when filters exclude everything, a no-results panel restates the active conditions as removable chips, offers "Xem N khóa <nhóm còn lại>" when only the price group excludes matches, offers "Xóa tất cả bộ lọc", and lists the four most-enrolled courses of the whole catalog under its own `h2`. The sort control is hidden when the catalog has fewer than two courses. |
| AC10 | Motion: when search, filters or sort change, remaining cards move to their new positions, removed cards fade out and are inert and hidden from assistive technology immediately, and new cards fade in; the price-group indicator slides between options; a page change cross-fades the list. Cards below the initial viewport reveal once as they scroll into view, in a short stagger. Server-rendered content is visible without JavaScript and no above-the-fold course starts hidden. Under `prefers-reduced-motion: reduce`, every final state appears without movement, with the same text, focus and actions. No action waits for an animation. |
| AC11 | At 320, 375, 768 and 1440px the page has no horizontal scroll; the toolbar sticks below the header only where it fits on one row; content stays usable at 200% zoom; text meets 4.5:1 and focus indicators and control boundaries 3:1; touch-primary controls are at least 44 × 44px. |
| AC12 | A new public RPC returns, for exactly the courses `get_public_course_catalog` lists, the existing catalog fields plus: public topic count, active card count of those topics, the slug of the first eligible preview topic in syllabus order or `null`, the owner's display name under the detail RPC's owner rule or `null`, a description excerpt or `null`, and 30-day enrollment count. Anonymous and authenticated callers get the same rows; no user id, email, enrollment identity or protected content field appears. `get_public_course_catalog` is unchanged. |
| AC13 | The shared `PublicCourseFeedback` and `PublicCourseGridSkeleton` use Product Language tokens with the same text, roles, structure and actions wherever they render: the homepage's course loading, empty and error states and the error panel of `/courses/[course-slug]`. The homepage cards, highlights selection and sitemap keep using the unchanged RPC and render as before. |

### 1.2 Scope and non-goals

- In scope: one additive migration with the new catalog RPC; its Zod schema, action and tests; `app/(client)/courses/page.tsx`, its `loading.tsx` and new catalog-local components; the enrollment overlay read; Product Language colors in `PublicCourseStates.tsx` (UIUX-001), which also reach the detail route's error panel; a root-local-only catalog demo fixture script; directly affected unit, component, integration and smoke tests; this plan and the program's progress and problems.
- Non-goals: categories, goals, levels, tags, ratings, reviews or saved courses (would need new tables or columns); a publish date column; server-side search or pagination; a canonical-URL or indexing policy for filtered catalog URLs; changes to `/courses/[course-slug]` other than the shared error panel colors, its preview route, `/learn` or the homepage card; changing `get_public_course_catalog`, `PublicCourseCard` or the highlights selector; header or footer changes; dark theme; new packages or fonts.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Add a new RPC; do not alter, drop or replace `get_public_course_catalog`. | Hosted migrations are pushed before merge while the old app serves traffic; its `.strict()` catalog schema rejects new keys, so `/`, `/courses` and the sitemap fail until the new deploy. |
| G2. The new RPC selects courses with the same predicate as `get_public_course_catalog`, counts topics with the same rule as the detail syllabus, and decides preview availability only through `private.d2_public_preview_is_eligible`, picking the first eligible topic by chapter `order_index`, chapter `id`, topic `order_index`, topic `id`. The owner name uses the detail RPC's owner rule: the earliest `owner` collaborator whose profile has `removed_at is null`. | The catalog lists a hidden course, shows counts that disagree with the detail page, links to a preview that the preview route refuses (suspended quota, removed chapter, unpublished topic), picks a nondeterministic preview, or publishes a soft-deleted user's name. |
| G3. The RPC is `stable`, `security definer`, `set search_path = ''`, revokes `public` and grants execute to `anon`, `authenticated` and `service_role`, like the existing public RPCs. It returns only the AC12 fields. | Anonymous callers lose access, or the public surface exposes enrollment identities or protected content. |
| G4. URL parameters are parsed by one Zod schema in `lib/schemas/public-course.ts`, used by both the server page and the client; invalid values become defaults. | A crafted URL breaks rendering, or server and client disagree and hydration flips the visible list. |
| G5. Facts, badges, counts and the preview link come only from the RPC and the user's own enrollments. | The page shows fabricated popularity, "Mới" or preview claims. |
| G6. The enrollment overlay reads through the user's session client with an explicit `user_id = <signed-in user>` filter, never a service-role client and never RLS alone. | An active admin, whom the admin read policy lets see every enrollment, sees "Đang học" on every course anyone is enrolled in. |
| G7. Scroll reveal is armed only after hydration and only for cards outside the viewport at that moment; without JavaScript or before hydration all cards are visible. | Server-rendered courses stay invisible to users, crawlers or tests when the observer does not fire. |
| G8. The homepage and the detail route change only the shared state colors per AC13. | The accepted U1 homepage or the detail page regresses. |
| G9. Any design change beyond the accepted demo and §1.4 is asked of the Owner first. | The Owner's accepted design is silently changed. |
| G10. The hosted migration push happens before merge and only under its own Owner grant. | Production serves new code against a database without the RPC, and `/courses` fails. |

### 1.4 Owner decisions that bind this unit

1. (2026-11-05) Scope level B: frontend catalog features plus one migration that extends the catalog read model; no new tables or columns.
2. (2026-11-05) Numbered pagination, 12 courses per page, page in the URL.
3. (2026-11-05) Signed-in learners see "Đang học" and "Tiếp tục học" on enrolled courses.
4. (2026-11-05) Design approval follows U1: the accepted demo is the design, recorded in this plan on Product Language; no Client/Marketing screen-type document.
5. (2026-11-05) Each empty, no-results and error case gets its own panel, not only a sentence; the layout must hold for one, few or many courses.
6. (2026-11-05) Motion uses Motion for React for list reflow, the sliding indicator and page transitions, and adds scroll reveal for course cards on `/courses` (unlike U1, which excluded section reveal).
7. (2026-11-05) The Owner accepted the demo direction and asked for this plan.
8. (2026-11-05) The new card applies only to `/courses`; the homepage keeps the U1 card and the existing RPC.
9. (2026-11-05) The content line reads "N thẻ từ vựng", counting active cards in public topics, because a card may hold a phrase.
10. (2026-11-05) "Mới" and Mới nhất use `created_at`; no publish date is added.
11. (2026-11-05) U2 also moves the homepage course states to Product Language colors to close UIUX-001, without changing their text or layout.
12. (2026-11-05) Changing page adds a browser history entry, so Back returns to the previous catalog page; search, filter and sort changes replace the entry. This overrides the demo, which replaced the entry on page changes.

## 2. Repository facts

Baseline: `736cc56`, checked 2026-11-05.

- `get_public_course_catalog()` (`supabase/migrations/20260710182617_public_course_read_model.sql`) returns only `id, title, slug, thumbnail_url, price, created_at, enrollment_count` for courses with `status = 'published'` and `removed_at is null`, ordered `created_at desc, id asc`; no later migration redefines it — justifies AC12 and G2.
- `publicCourseCatalogItemSchema` in `lib/schemas/public-course.ts` is `.strict()`; the catalog is consumed by `/courses`, `home-data.ts` (homepage highlights) and `app/sitemap.ts` — justifies G1, G8 and AC13.
- Hosted migrations are pushed by `db push` under a separate Owner grant before merge (admin-console and auth-onboarding progress records), and Vercel deploys on merge — justifies G1 and G10.
- `topics.is_preview` is not readable by `anon`/`authenticated` (`20260924110000_d2_preview_quota_lifecycle.sql`), `private.d2_public_preview_is_eligible` is revoked from every role, and enrollments are row-restricted, so the public RPC must run as `security definer` like the existing public read RPCs — justifies G3.
- `get_public_course_detail` lists topics with `status = 'published'`, `removed_at is null` inside chapters with `removed_at is null`, and reports `is_preview` only while `marked_topic_count <= quota_cap`; `private.d2_public_preview_is_eligible(topic_id)` encodes the full preview rule used by the preview RPCs — justifies G2.
- `courses` has no category, level, tag or publish-date column; `reviewed_at` is review metadata, not a publish date; `enrollments` has `enrolled_at`; `cards` has `removed_at` — justifies decisions 1, 9 and 10 and the 30-day count.
- The detail RPC exposes the owner's `full_name` publicly, taking the earliest `owner` collaborator whose profile has `removed_at is null`; `profiles.full_name` is nullable — justifies AC7's optional instructor line, G2's owner rule and that no new personal-data class is published (no `/privacy` change).
- Indexes exist on `enrollments(course_id)`, `topics(course_id) where removed_at is null`, `topics(chapter_id)` and `cards(topic_id)` — justifies the RPC cost mitigation in §5.
- `enrollments` has the own-row policy "Users can view their own enrollments" and, since `20261007100000_a5_admin_learning_reads.sql`, "Enrollments - Active Admin Select", which lets an active admin read every row; `getPublicCourseDetail` therefore filters by `user_id` explicitly — justifies G6 and AC8.
- `public-course-read-model.test.ts` refuses to run unless `ALLOW_DB_INTEGRATION_TESTS=true` and the Supabase URL is the root-local `127.0.0.1:45321`; CI sets the flag and starts a fresh stack — justifies CP1's commands.
- `/learn/<course-slug>` is the enrolled overview that the detail page opens when no next topic is known — justifies AC8's link.
- `__tests__/integration/public-course-read-model.test.ts` pins the catalog's key set, order, ACLs and security metadata; `__tests__/components/public-course-catalog.test.tsx` and `__tests__/actions/public-course.test.ts` cover the catalog view and action; `e2e/smoke/public-course-discovery.smoke.spec.ts` asserts the old `/courses` `h1` text and a link to a homepage highlight on `/courses` — these contracts change by Owner decision and are updated, not weakened.
- Next.js 16.3.8: `useSearchParams` in a prerendered tree needs a `Suspense` boundary; a page may pass its `searchParams` prop down instead (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`). `/courses` is already dynamic because it reads the Supabase session — justifies AC5's server-rendered state.
- Motion for React is installed; the homepage uses `LazyMotion` with `domMax` for a measured shared indicator (`HeroPractice.tsx`) — justifies AC10 without a new dependency.
- UIUX-001 is open: `PublicCourseStates.tsx` still uses `gray-*`/`blue-*` literals on `/`, `/courses` and the `/courses/[course-slug]` error panel — justifies AC13 and decision 11.
- The homepage trial heading has the stable id `hero-practice-title` — justifies AC9(c)'s target without a homepage change.
- The local seed has fewer than 13 published courses, so pagination cannot be seen in the browser without extra local data — justifies the fixture addition in §4.

## 3. Bounded implementation hypotheses

- Migration `supabase/migrations/<timestamp>_u2_public_course_catalog_listing.sql` creates `public.get_public_course_catalog_listing()` returning a table; topic and card counts and the preview slug come from lateral subqueries; the excerpt is the trimmed description cut to about 240 characters. The name, excerpt length and SQL shape may change if AC12, G1–G3 hold.
- `publicCourseCatalogListingItemSchema` (extending the catalog item schema), `publicCourseCatalogQuerySchema` and their inferred types live in `lib/schemas/public-course.ts`; `getPublicCourseCatalogListing()` in `app/actions/public-course.ts` returns the existing success/error result shape plus the enrolled course ids. May change if G4–G6 hold.
- The page awaits `searchParams`, parses it and passes the parsed state, listing and enrolled ids to one client explorer component under `app/(client)/courses/_components/`; the explorer filters, sorts and paginates in memory and syncs the URL through `window.history.replaceState`/`pushState`, which Next keeps in sync with its router. May change if AC5 and G4 hold.
- Time-dependent flags ("Mới") and the initial result order are computed once on the server and passed down; the client re-sorts only after a user change, and every sort ends with an `id` tie-break, so ICU collation differences between Node and the browser cannot cause a hydration mismatch. May change if hydration stays stable and AC4/AC7 hold.
- The explorer derives its state from the current URL (`useSearchParams` inside a `Suspense` boundary, or a `popstate` listener), not from a one-time copy of the server props, so Back and Forward re-render the list. May change if AC5 holds.
- A catalog-local card component implements AC7 with a stretched title link and a separate footer link; `PublicCourseCard` stays for the homepage. May change if AC7 and decision 8 hold.
- Motion uses `LazyMotion` with `domMax`, `layout` and `AnimatePresence` for reflow, `layoutId` for the indicator, and `MotionConfig reducedMotion="user"` plus `useReducedMotion` for reveal and cross-fade; reveal uses `IntersectionObserver` armed after mount. May change if AC10 and G7 hold.
- The fixture script `scripts/dev/seed-catalog-demo.mjs` follows `seed-homepage-demo.mjs`: root-local API 45321 only, `--apply`/`--revert`, idempotent, adding about 30 published demo courses with chapters, topics, cards, a few preview topics within quota, free and paid prices, one course whose owner has no name or is soft-deleted, and enrollments by existing seed students spread across the last 60 days. `--revert` removes only rows it created plus learner rows (progress, flashcards, activity) on its demo courses; it refuses and reports when a demo course has a payment, rather than deleting payment history. May change if it stays local-only and reversible.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | New RPC, schema and action per AC12, G1–G3 and G6, with the overlay read, plus the local fixture script and the RPC cost measurement. | Root-local 45321 (never reset): `npx supabase migration up --local`, then `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/public-course-read-model.test.ts` with new cases: same course set as the old RPC, topic/card counts matching the detail syllabus, preview slug in syllabus order and `null` for a suspended quota, removed chapter or unpublished topic, owner name `null` for a missing or soft-deleted owner (existing soft-deleted-owner fixture), 30-day count excluding older enrollments, anon/authenticated parity, an active admin's own-enrollment read returning only their own course ids under real RLS, forbidden keys absent, ACL and security metadata, old RPC key set unchanged. Fresh rebuild on the isolated runtime (45441): prepare the workdir with `prepareSupabaseWorkdir` (`scripts/e2e/prepare-supabase-workdir.mjs`), `npx supabase --workdir .e2e-runtime start`, confirm the workdir, project id and ports are not root's, then `npx supabase --workdir .e2e-runtime db reset --local`, confirm the new function exists after all migrations and the seed, and stop that stack afterwards unless another run needs it. Drift: `npx supabase db diff --schema public` on root shows none. Actions: `npm run test:run -- __tests__/actions/public-course.test.ts` for success, empty, RPC error, contract drift, guest without overlay read, overlay filtered by the user's id (an admin gets only their own courses), overlay failure without "Đang học". Cost: with the fixture applied, `explain analyze` of the new RPC must stay under 100 ms and within 3× the old catalog RPC on the same data; otherwise stop. `npx tsc --noEmit`; `npm run lint`. |
| CP2 | Catalog page per AC1–AC9 and AC11 with CSS-only hover. | `npm run test:run` on new and updated component tests (search normalization and highlight, facet counts, each sort and tie-break, URL parse/fallback/clamp/canonical rewrite and history mode, pagination window and focus, card variants including null owner/description/zero topics, every AC9 state) and on `public-course-catalog.test.tsx`/`public-heading-hierarchy.test.tsx`; type and lint checks; browser check with the fixture applied, including page 1 → 2 → Back → Forward, and filters plus page → course detail → Back restoring the same list. |
| CP3 | Motion per AC10 with reduced-motion equivalence and G7. | Component tests that results, focus and actions are present immediately after each change, removed cards are inert and `aria-hidden`, and initially rendered cards are not hidden; browser check in default and reduced motion, rapid typing and rapid filter/page changes, Edge included. |
| CP4 | UIUX-001 colors per AC13; smoke contract updated. | `npm run test:run -- __tests__/components/public-course-catalog.test.tsx __tests__/components/homepage.test.tsx` plus the detail-route error state in `__tests__/components/public-course-learning-activity.test.tsx`; browser check of the homepage states and the `/courses/[course-slug]` error panel; `npm run test:e2e -- e2e/smoke/public-course-discovery.smoke.spec.ts` with the new `h1` and a highlight link reachable on `/courses` (by search or on page 1 for the E2E fixture). |
| Final | Whole diff against AC1–AC13. | Playwright CLI (or the built-in browser where the CLI cannot reach) at 320/375/768/1440px: overflow, keyboard order, focus visibility, measured contrast of new color pairs, 200% zoom, reduced motion, guest/student/teacher/admin; `npm run docs:check`; author self-review; independent review; Owner review of the running screen, including acceptance of the course states on `/`, `/courses` and the detail route (UIUX-001 exit condition). |

### QA fixture readiness

- QA type: browser manual QA of `/courses` as guest, enrolled student, teacher and admin.
- Canonical fixture source: `supabase/seed.sql` (published courses, seed student, teacher and admin accounts, enrollments) plus `scripts/dev/seed-homepage-demo.mjs` covers.
- Existing covered states: free and paid courses, an enrolled student, guests, teachers.
- Missing states: more than 12 courses (pagination), courses with preview topics and card counts across several pages, 30-day enrollment differences, a course without owner name or description.
- Required fixture additions: `scripts/dev/seed-catalog-demo.mjs` per §3; empty, one-course and error states are covered by component tests and are not reproduced in the shared local DB.
- Reset/setup command: `node scripts/dev/seed-catalog-demo.mjs --apply` (and `--revert`) against the running root-local stack.
- Fixture checkpoint: CP1 (needed there for the cost measurement).
- Browser QA may begin when: CP1 is applied to the root-local stack and the fixture script has applied and reverted cleanly once, then been applied again.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Client-side filtering loads the whole catalog; payload and render cost grow with course count. | Excerpts are capped and covers stay lazy except the first; acceptable for the current catalog. Stop and plan server-side search and pagination when the catalog nears about 200 courses. |
| Per-course lateral counts make the RPC slower than the old one. | The §2 indexes cover each lookup; CP1 measures it on the fixture against the stated threshold and stops if it is exceeded. |
| PR preview deployments read the hosted database, so `/courses` fails there until the hosted migration is pushed. | Expected before the push; judge the PR on local and CI evidence, and recheck the preview after the push. |
| Scroll reveal can hide content if the observer never fires (hidden tab, test runner, old browser). | G7; a component test asserts initially rendered cards are visible. |
| The smoke test's homepage highlight may land on page 2 of `/courses`. | CP4 makes the assertion reach it through search or confirms the E2E fixture fits on one page. |
| A hosted push before merge exposes an unused RPC to anonymous callers. | It returns only public catalog data under the same rules as the existing public RPCs (G2, G3). |

- Rollout runbook (Owner or hosted steps, in order): CI green on the PR → Owner grants the hosted migration → `db push --dry-run` lists only the U2 migration → push → read-only check that anonymous `get_public_course_catalog_listing` returns the published courses and `get_public_course_catalog` is unchanged → merge → confirm `/courses` on production.
- Stop when: a change would alter `get_public_course_catalog`, RLS, a table or a column; preview eligibility cannot reuse the existing helper; the RPC exceeds the CP1 cost threshold; a design change outside §1.4 is needed (G9); the homepage would change beyond AC13.
- Rollback: revert the PR; the additive RPC can stay unused or be dropped by a follow-up migration. Nothing is irreversible.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
