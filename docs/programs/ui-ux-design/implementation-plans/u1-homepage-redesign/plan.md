# U1 detail plan — homepage redesign

Revision: r1, 2026-11-04. Owner approval: 2026-11-04. Charter: [README.md](../../README.md) (initiative U1).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the public homepage `/` presents VocaSpace through its own learning mechanism (card, self-rating, scheduled review) instead of a stock-image carousel, uses Product Language colors, type, geometry and motion, links only to real destinations, and shows no fabricated claims. The shared client header and the public course card follow the same language.

The Owner accepted the rendered mockup [homepage-mockup.html](./sources/homepage-mockup.html) on 2026-11-04, amended by the decisions in §1.4. Where the mockup and §1.4 differ, §1.4 wins.

| ID | Observable result |
| --- | --- |
| AC1 | A guest opening `/` sees one `h1` "Nhớ từ vựng lâu hơn, ôn đúng lúc bạn sắp quên", the accepted lead copy, a primary Action Blue button "Khám phá khóa học" linking to `/courses`, and a Route Blue text link "Đăng ký miễn phí" linking to `/register`. No carousel, no external stock image and no `href="#"` link remain on the page. |
| AC2 | A signed-in user opening `/` sees the same hero, with the text link replaced by "Tiếp tục học" linking to `/learn`. |
| AC3 | Below the hero actions, the line "Nhiều khóa cho học thử không cần đăng nhập" is always shown; "Có khóa học miễn phí" is shown only when the highlighted catalog result contains a course with price 0, and is absent when the catalog is empty or fails. |
| AC4 | In the hero practice panel, a visitor activates "Lật thẻ" and the card reveals the word, meaning and example; four rating buttons Lại / Khó / Ổn / Dễ appear with the same labels and semantic colors as the learning workspace; choosing one advances the progression rail to the matching illustrative mark, announces the next-review text in a `role="status"` region, and shows "Thẻ tiếp theo", which loads the next of three static cards and returns focus to "Lật thẻ". The panel states "Ví dụ minh họa" and never claims a real schedule. It works by keyboard alone. |
| AC5 | The "Ba bước để từ mới thành từ của bạn" section shows three ordered steps (`ol`) with the accepted copy and a progression rail that remains understandable without color or motion. The former "Tại sao chọn VocaSpace?" cards, including the "AI Assistant" claim, are gone. |
| AC6 | "Khóa học nổi bật" keeps its current data, selection, loading skeleton, error and empty states; its eyebrow follows the utility-label rule (at most `0.04em` tracking). |
| AC7 | Testimonials and social links render from one typed homepage content module. With the shipped empty content, neither the testimonial section nor the social row renders, and no placeholder name, avatar, star rating or generic social URL appears. Given non-empty content (in tests), each testimonial shows quote, name, course and optional proof line, and each social link opens in a new tab with `rel="noopener noreferrer"` and an accessible name. |
| AC8 | The teacher section is visible to everyone. A user whose profile role is `teacher` sees a "Mở khu soạn khóa học" button linking to the teacher course list; guests and other roles see no button and the line "Tài khoản giáo viên do VocaSpace cấp." |
| AC9 | The homepage footer uses Deep Space, Vietnamese labels only, and links only to `/courses`, `/learn`, the teacher-section anchor, `/privacy` and `/terms`; the "Pháp lý" column keeps exactly the `/privacy` and `/terms` links. |
| AC10 | On every route that renders the shared `Header` (`(client)` routes and `not-found`), the header is a white surface with the dark logo, desktop links Trang chủ / Khóa học / Học tập with `aria-current="page"` on the active one, Route Blue "Đăng nhập" and Action Blue "Đăng ký ngay" for guests, and the unchanged account dropdown for signed-in users. The non-functional search field is removed. |
| AC11 | Below `lg`, the existing account sheet trigger is restyled for the white header, and the sheet lists "Trang chủ" and "Khóa học" above its unchanged account items. |
| AC12 | `PublicCourseCard` on `/` and `/courses` uses Product Language tokens: free badge in the Growth pair, price in ink, "Xem chi tiết" in Route Blue, muted border, `16px` radius, quiet hover without translate or image scale. Layout, cover image, fallback, link target and accessible name are unchanged. |
| AC13 | Motion: the hero rail fills toward the new mark in one sequence of at most `320ms`; the three-step rail draws once when the section first enters the viewport; a new card fades in. Hover is `120ms`, state changes `220ms`, the flip `240ms`. Under `prefers-reduced-motion: reduce` every final state appears immediately (opacity at most `100ms`) with the same text, focus and actions. No section-wide reveal-on-scroll exists. |
| AC14 | At 375px, 768px and 1440px the page has no horizontal scroll; at 200% zoom content stays usable; text meets 4.5:1, focus indicators and control boundaries meet 3:1; touch-primary actions are at least `44 × 44px`. |

### 1.2 Scope and non-goals

- In scope: `app/(client)/page.tsx` and new homepage-local components and content module; the `PublicCourseHighlights` heading block; `PublicCourseCard` palette; `components/ui/header.tsx`; `components/ui/mobile-account-sheet.tsx` navigation links and trigger style; directly affected tests.
- Non-goals: any database, RPC, migration, Server Action or schema change; a review-collection feature; real testimonials or social URLs (the Owner supplies them later); a Client/Marketing screen-type design document; `/login` and `/register` forms and the AUTH-012 input-contrast defect; footer on routes other than `/`; dark theme; new packages, fonts or shadcn components; section-wide scroll reveal; hero facts derived from any data other than the existing highlights result.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No fabricated content ships: testimonial and social content stays empty until the Owner supplies real, consented entries; the practice panel keeps "Ví dụ minh họa". | Visitors see invented reviews, dead social links or a fake schedule; trust and advertising-law risk. |
| G2. When testimonial content is filled later, the same PR updates `/privacy` (and `/terms` if relevant) with Owner-approved wording, per `AGENTS.md` user-data disclosure. | Personal data of learners is published without disclosure. |
| G3. Rating labels and colors come from `FLASHCARD_RATINGS` in `lib/flashcard-ratings.ts`; do not copy them. | The homepage demo drifts from the real learning workspace. |
| G4. The "Có khóa học miễn phí" fact reads the same highlights result without a second catalog request and never blocks the hero render; if that needs a data-layer change, stop and ask. | Duplicate network work, or a hero that waits on the catalog. |
| G5. The teacher button depends on `profiles.role === "teacher"`, read the same way `Header` reads it. | Students and guests are led to a course form whose submit is refused. |
| G6. Header behavior beyond appearance stays: account dropdown items, `getAccountMenuState` labels, sign-out form, `MobileAccountSheet` account items and their accessible names. | Account navigation regresses on every client route; `account-menu` smoke breaks. |
| G7. Any change to the accepted mockup or §1.4 beyond these ACs is asked of the Owner before it is made. | The Owner's explicit instruction is violated. |

### 1.4 Owner decisions that bind this unit

1. (2026-11-04) The rendered mockup is accepted as the homepage design. It is recorded in this plan built on Product Language; no Client/Marketing screen-type design is written now.
2. (2026-11-04) Hero primary action is "Khám phá khóa học" → `/courses`; the text link is "Đăng ký miễn phí" → `/register` for guests and "Tiếp tục học" → `/learn` when signed in.
3. (2026-11-04) Hero facts become "Nhiều khóa cho học thử không cần đăng nhập" (always) and "Có khóa học miễn phí" (only when the highlights contain a free course).
4. (2026-11-04) Testimonials and social links are built now from a content module and hidden while empty; the Owner supplies real consented reviews and official URLs later.
5. (2026-11-04) The white header is in this plan as its own checkpoint, verified on other client routes; mobile navigation adds "Trang chủ" and "Khóa học" to the existing account sheet.
6. (2026-11-04) Motion scope is state-driven only, per AC13; no decorative scroll reveal.
7. (2026-11-04) `PublicCourseCard` adopts Product Language tokens on both `/` and `/courses`.
8. (2026-11-04) The teacher section shows a role-dependent button per AC8.
9. (2026-11-04) The guest sign-up label stays "Đăng ký ngay" in the header and the sheet, overriding the mockup's "Đăng ký".
10. (2026-11-04) Work happens on `feat/homepage-redesign` from `origin/main` `97ccaae`.

## 2. Repository facts

Baseline: `97ccaae`, checked 2026-11-04.

- `app/(client)/page.tsx` holds the carousel with two hotlinked stock images (`images.microcms-assets.io`, `edusa.vn`), two `Button`s without `href`, white text on `#5FE8EF` (about 1.3:1), an "AI Assistant 24/7" card with no matching feature in the codebase, a hard-coded "Cao Thế Vinh" review using the shadcn sample avatar, and a footer with `href="#"` links and generic social URLs — justifies AC1, AC5, AC7, AC9 and G1.
- `components/ui/header.tsx` is rendered by `app/(client)/layout.tsx` and `app/not-found.tsx`; it reads `profiles.role` server-side, uses `bg-blue-400`, and its search `Input` has no form, handler or route — justifies AC10, G5 and G6.
- `components/ui/mobile-account-sheet.tsx` is the only navigation below `lg` and has no `/courses` link — justifies AC11.
- `createCourse` in `app/actions/course.ts` refuses any profile whose role is not `teacher` — justifies AC8 and G5.
- `lib/flashcard-ratings.ts` is the single source of the four rating labels and semantic classes — justifies G3.
- The public preview route renders without sign-in; previewable topics are per-course (`is_preview`), not exposed on catalog items — justifies decision 2 and AC3's first fact.
- `app/globals.css` already defines `action`, `route`, `recall`, `growth`, `attention` and `correction` token families; `components/ui/button.tsx` default variant is Action Blue, `link` is Route Blue, `lg` is `44px` — justifies reuse without token changes.
- `PublicCourseCard` is used only through `PublicCourseGrid` on `/` and `/courses`, and uses `text-[#2db2b9]` and `text-blue-500` literals — justifies AC12.
- `__tests__/components/header.test.tsx`, `__tests__/components/mobile-account-sheet.test.tsx`, `__tests__/components/not-found.test.tsx` and `e2e/smoke/account-menu.smoke.spec.ts` assert the guest links "Đăng nhập" and "Đăng ký ngay" — justifies decision 9 and G6.
- `__tests__/components/legal-pages.test.tsx` renders `Home` synchronously; once `Home` reads the session it becomes async, so the footer assertions move to the footer component.
- `__tests__/components/public-heading-hierarchy.test.tsx` asserts the old carousel `h2` class string; `__tests__/components/legal-pages.test.tsx` asserts a `Contact Us` `#` footer link; `e2e/smoke/public-course-discovery.smoke.spec.ts` asserts one `h1` and highlighted links on `/`; `e2e/smoke/account-menu.smoke.spec.ts` covers the header menus — these contracts change by Owner decision and are updated with the change, not weakened.
- No table, schema or file holds testimonials or official social URLs.
- `tw-animate-css` is installed; no motion library is — justifies CSS-only motion in AC13.

## 3. Bounded implementation hypotheses

- Homepage sections become server components in `app/(client)/_components/home/`, with one client component for the practice panel and one small client hook for the one-time rail draw (`IntersectionObserver`); may change if AC4, AC5 and AC13 hold.
- Testimonials and social links live in `lib/homepage/content.ts` as typed, empty `readonly` arrays; components take content as props so tests pass filled data; may change if AC7 and G1 hold.
- Signed-in state and role for AC2 and AC8 come from the same server Supabase `getUser` plus `profiles.role` read the header uses, extracted to a shared helper only if both callers need it; may change if G5 and G6 hold.
- The free-course fact is rendered inside the existing `Suspense` boundary from the highlights result (for example a small sibling rendered by `PublicCourseHighlights`, or `React.cache` around the catalog read); may change if G4 holds.
- Header links use `usePathname` in a small client child for `aria-current`, keeping the header itself a server component; may change if AC10 holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Homepage body: hero with role-aware link and facts, practice panel, three steps, highlights heading, hidden-while-empty testimonials and social, role-aware teacher section, new footer; carousel and fabricated content removed. Base transitions (hover, flip, state) only. | `npm run test:run -- __tests__/components/public-heading-hierarchy.test.tsx __tests__/components/legal-pages.test.tsx` plus new component tests for AC2–AC4, AC7, AC8; `npm run lint`; `npx tsc --noEmit`. |
| CP2 | Motion per AC13 with reduced-motion equivalence. | Component test that the rating outcome text, focus and next action exist without waiting for animation; browser check in default and reduced motion. |
| CP3 | `PublicCourseCard` palette per AC12. | `npm run test:run -- __tests__/components/public-course-catalog.test.tsx`; browser check of `/` and `/courses`. |
| CP4 | White header and mobile sheet navigation per AC10–AC11. | `npm run test:run -- __tests__/components/header.test.tsx __tests__/components/mobile-account-sheet.test.tsx __tests__/components/not-found.test.tsx` with new cases for the nav links and `aria-current`; `npm run test:e2e -- e2e/smoke/account-menu.smoke.spec.ts e2e/smoke/public-course-discovery.smoke.spec.ts`; browser check of `/`, `/courses`, `/learn`, `/login`, `/register`, `/profile` and a 404. |
| Final | Whole diff against all ACs. | Playwright CLI at 375, 768 and 1440px for AC14: horizontal overflow, keyboard order, focus visibility, measured contrast of the new color pairs, 200% zoom, reduced motion; author self-review; Owner review of the running screen. |

Manual QA needs a guest, a student and a teacher account from the local seed, and a catalog containing at least one free and one paid public course; confirm these exist in the local dev stack before the final check. Each checkpoint is one local commit when commits are granted. Default delivery is one PR containing CP1–CP4; the Owner may ask to split CP4 into its own PR.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Header change shifts every client route, including `/login` and `/register` (AUTH-012). | CP4 is last and separately revertible; check the listed routes. AUTH-012 stays open: its input contrast and login form are out of scope. |
| "Nhiều khóa cho học thử…" becomes untrue if few courses enable preview. | The Owner accepted the copy; content owners keep previews enabled. Revisit if the catalog changes. |
| Empty content hides testimonials indefinitely. | Intended by decision 4; filling content is a later Owner-supplied change with G2. |
| Role read adds a profile query to `/` for signed-in users. | Reuse the header's read pattern; no extra query for guests. |
| Card restyle changes `/courses` unexpectedly. | AC12 limits it to tokens; CP3 checks both routes. |

- Rollout runbook: none beyond the normal merge; no data or hosted step.
- Stop when: a needed change touches the database, Server Actions or schemas; G4 needs a data-layer change; any design change outside §1.4 is needed (G7); account menu behavior would change.
- Rollback: revert the PR, or the CP4 commit alone for the header. Nothing is irreversible.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
