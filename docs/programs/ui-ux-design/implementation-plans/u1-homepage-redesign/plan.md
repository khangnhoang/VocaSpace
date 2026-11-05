# U1 detail plan — homepage redesign

Revision: r7, 2026-11-05 (Owner QA accepted the overall composition and authorized delivery; short-viewport layout and footer identity — decision 24). Owner approval for r1–r3 on 2026-11-04 and for the r4–r7 directions and library installation on 2026-11-05. Charter: [README.md](../../README.md) (initiative U1).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the public homepage `/` presents VocaSpace through its own learning mechanism (card, self-rating, scheduled review) instead of a stock-image carousel, uses Product Language colors, type, geometry and motion, links only to real destinations, and shows no fabricated claims. The shared client header and the public course card follow the same language.

The Owner accepted the rendered mockup [homepage-mockup.html](./sources/homepage-mockup.html) on 2026-11-04, amended by the decisions in §1.4. Where the mockup and §1.4 differ, §1.4 wins.

| ID | Observable result |
| --- | --- |
| AC1 | A guest opening `/` sees one `h1` "Nhớ từ vựng lâu hơn, ôn đúng lúc bạn sắp quên", the accepted lead copy, a primary Action Blue button "Khám phá khóa học" linking to `/courses`, and a Route Blue text link "Đăng ký miễn phí" linking to `/register`. No carousel, no external stock image and no `href="#"` link remain on the page. |
| AC2 | A signed-in user opening `/` sees the same hero, with the text link replaced by "Tiếp tục học" linking to `/learn`. |
| AC3 | Below the hero actions, the line "Nhiều khóa cho học thử không cần đăng nhập" is always shown; "Có khóa học miễn phí" is shown only when the highlighted catalog result contains a course with price 0, and is absent when the catalog is empty or fails. |
| AC4 | In the hero practice panel, a tab list (TOEIC / IELTS / Công sở) switches between three static three-card decks and restarts the chosen deck at its first card. A visitor activates "Lật thẻ" and the card reveals the word, meaning and example; four rating buttons Lại / Khó / Ổn / Dễ appear with the same labels and semantic colors as the learning workspace; choosing one advances the progression rail to the matching illustrative mark, announces the next-review text in a `role="status"` region, and shows "Thẻ tiếp theo", which loads the next card and returns focus to "Lật thẻ". After the last card, a Growth "Hoàn thành bộ thử" panel replaces the next action, focus moves to "Ôn lại bộ này", and one confetti burst plays unless motion is reduced. The panel states "Ví dụ minh họa" and never claims a real schedule. It works by keyboard alone. |
| AC5 | The "Ba bước để từ mới thành từ của bạn" section shows three ordered steps (`ol`) with the accepted copy and a progression rail that remains understandable without color or motion. The former "Tại sao chọn VocaSpace?" cards, including the "AI Assistant" claim, are gone. |
| AC6 | "Khóa học nổi bật" keeps its current data, selection, loading skeleton, error and empty states; its eyebrow follows the utility-label rule (at most `0.04em` tracking). |
| AC7 | Testimonials and social links render from one typed homepage content module. Sample content is returned only when `NODE_ENV` is not `production` and `HOME_SAMPLE_CONTENT=1`. With the shipped empty content, neither the testimonial section nor the social row renders, and no placeholder name, avatar, star rating or generic social URL appears. Given non-empty content (in tests), each testimonial shows quote, name, course and optional proof line, and each social link opens in a new tab with `rel="noopener noreferrer"` and an accessible name. |
| AC8 | The teacher section is visible to everyone. A user whose profile role is `teacher` sees a filled Action Blue "Mở khu soạn khóa học" button linking to the teacher course list; guests and other roles see no button and the line "Tài khoản giáo viên do VocaSpace cấp." |
| AC9 | The homepage footer uses Deep Space, Vietnamese labels only, and links only to `/courses`, `/learn`, the teacher-section anchor, `/privacy` and `/terms`; on hover or focus a link brightens to white with a small arrow sliding in, without underline, and a social icon lifts 2px onto its network color; the "Pháp lý" column keeps exactly the `/privacy` and `/terms` links. |
| AC10 | On every route that renders the shared `Header` (`(client)` routes and `not-found`), the header is a white surface with the dark logo, desktop links Trang chủ / Khóa học / Học tập with `aria-current="page"` on the active one, Route Blue "Đăng nhập" and Action Blue "Đăng ký ngay" for guests, and the unchanged account dropdown for signed-in users. The non-functional search field is removed. |
| AC11 | Below `lg`, the existing account sheet trigger is restyled for the white header, and the sheet lists "Trang chủ" and "Khóa học" above its unchanged account items. |
| AC12 | `PublicCourseCard` on `/` and `/courses` uses Product Language tokens: free badge in the Growth pair, price in ink, "Xem chi tiết" in Route Blue, muted border, `16px` radius, hover lifts the card 2px with Level 2 shadow, scales the cover to 1.03 and nudges the arrow. Layout, cover image, fallback, link target and accessible name are unchanged. |
| AC13 | Motion: on load the hero lines enter in a 60ms stagger and the practice panel slides in, then the first card flips once and turns back (600ms after at least 60% of the card is on screen, hold 1100ms), cancelled by any interaction with the panel; the hero rail fills toward the new mark in one sequence of at most `320ms`; the three-step rail draws once when the section first enters the viewport; the rated card slides out while the next slides in, without delaying the next action. Hover is `120ms`, state changes `220ms`, the flip `240ms`. Under `prefers-reduced-motion: reduce` every final state appears immediately (opacity at most `100ms`) with the same text, focus and actions. No section-wide reveal-on-scroll exists. |
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
6. (2026-11-04) Motion scope is state-driven only, per AC13; no decorative scroll reveal. Amended by decision 12.
7. (2026-11-04) `PublicCourseCard` adopts Product Language tokens on both `/` and `/courses`.
8. (2026-11-04) The teacher section shows a role-dependent button per AC8.
9. (2026-11-04) The guest sign-up label stays "Đăng ký ngay" in the header and the sheet, overriding the mockup's "Đăng ký".
10. (2026-11-04) Work happens on `feat/homepage-redesign` from `origin/main` `97ccaae`.
11. (2026-11-04, Owner QA) The hero practice panel offers three demo decks through tabs.
12. (2026-11-04, Owner QA) Motion adds the hero intro sequence with a one-time card flip, the deck-completion panel with confetti and the card slide; decorative scroll reveal stays out.
13. (2026-11-04, Owner QA) Course-card hover lifts the card, scales the cover and nudges the arrow on `/` and `/courses`.
14. (2026-11-04, Owner QA) Footer link hover brightens with an arrow instead of underline; social icons lift onto their network colors.
15. (2026-11-04, Owner QA) The teacher action is a filled primary button.
16. (2026-11-04, Owner QA) A local-only sample mode (`HOME_SAMPLE_CONTENT=1`, never in production) and `scripts/dev/seed-homepage-demo.mjs` (root-local DB only, `--apply`/`--revert`) show the page with full data. Amended by decision 18.
17. (2026-11-04, PR #183 review) U1 motion is not bound to the Product Language duration limits, which the Owner plans to retire; motion still needs reduced-motion equivalence and must not delay the next action.
18. (2026-11-04, PR #183 review) Demo covers live in `scripts/dev/homepage-demo-covers/` and are written to the local database as data URIs, so no demo asset ships with the build. Out-of-scope review findings go to [problems.md](../../problems.md) (UIUX-001).
19. (2026-11-05) The Owner asks to remove Product Language's animation duration limits. Retire those product-wide limits in the owning artifact and its index; preserve reduced-motion equivalence, truthful state and immediate feedback/actions. Historical acceptance hashes remain historical; screen- and component-specific timing decisions are not automatically revoked.
20. (2026-11-05) The Owner selects the learning trial as the homepage's primary visual signature. For this follow-up, retain the two-column hero and its copy/actions, strengthen display hierarchy with the installed font, and make the trial read as a learning sequence: meet the word → recall → schedule review. Retain the accepted palette and geometry. Use a larger focused card and a distinct review region rather than unrelated decorative assets. On mobile, keep text/actions before the trial. The deliberate visual emphasis belongs to the learning object, with surrounding content quiet. This overrides AC13's timings: use a perceptible flip, card exchange and rail sequence, while keeping all AC4 actions/focus available immediately. No section-wide reveal, perpetual motion or new backend behavior. Critique: the trial must demonstrate a rating changing the illustrative review mark; a generic animated card alone would still be interchangeable with a SaaS landing page.
21. (2026-11-05) The Owner authorizes installing a popular, versatile animation library and updating `frontend-design` / `frontend-workflow` for future reuse. Select Motion for React (`motion`), limit its first use to the homepage trial and use `LazyMotion` / `domAnimation` with the lightweight `m` components. CSS remains valid for simple feedback and the server-rendered hero entry. This overrides the no-new-package non-goal for this library only. `/courses`, `/login` and other older pages are future redesign candidates, not implementation scope for this follow-up. No commit, push, PR or deployment grant is included.
22. (2026-11-05, Owner QA) Homepage motion still feels like an endpoint swap. Slow and reshape its visible movement: hero entry, flip, card exchange, review/steps rails, course hover and footer; local narrative transitions use `cubic-bezier(0.4,0,0.2,1)` so movement remains visible through the middle of the interval rather than settling almost immediately. This is a homepage/shared-course-card exception to Product Language's easing recipes, not a new global easing default. Preserve immediate response text/actions and reduced-motion equivalence. Course hover must transition the actual Tailwind `translate` property; the shared `PublicCourseCard` correction also applies on `/courses`, retaining its existing geometry and content. Add one continuously retargetable underline to the three deck tabs. The Owner's 16.73s recording shows the deck title changing while `substantial` stays painted at about 1.5–7s and `commute` at about 12–16s, with multiple card outlines overlapping. Switching decks must immediately remove all previous-deck snapshots; exit retention is limited to card changes inside the same deck, with a fresh identity for each visit. Test both DOM removal and rendered motion rather than only the accessible text. The video is local QA input and is not published or committed.

23. (2026-11-05, Owner QA) Align the homepage trial with `FlashcardStage` and the learning queue. Reuse the real card, reveal and rating controls with local demo data. Rating advances immediately. Again and Hard move the card to the back of the queue. Good and Easy remove it. Completion and its celebration require an empty queue. Show the last rated word next to its illustrative review schedule. The indicator fits the icon and text of the selected tab. Switch decks with the card box fixed and the text entering from the same side each time. Use `domMax` for the measured shared indicator, a 650ms text entrance, and a homepage-local 800ms flip. Both “Cách học” connectors begin at zero when armed offscreen, and the delayed connector remains at zero until its draw starts. Use forward keyframes with the previous 900ms draw and 700ms second-segment delay. Reduced motion and the server-rendered fallback show settled states. This decision supersedes the affected AC4 and AC13 behavior and the r5 card entrance and exit choices.

24. (2026-11-05, Owner QA) Preserve the card proportions on short desktop viewports by moving the illustrative review schedule beside the card with vertical marks. At widths from 64rem and heights through 52rem, give the trial more horizontal room and retain a 20rem card height. Keep the stacked schedule on taller desktop and mobile layouts. The Owner accepts the overall rendered result and authorizes grouped commits, push, PR creation and merge when CI passes. Use the existing gradient brand logo on the Deep Space footer, consistent with its use on the Admin dark surface.

### 1.5 Follow-up verification (r4–r7)

- Baseline: `dfe79c4e` (PR #183 merged), checked 2026-11-05; `feat/homepage-motion-identity` starts from synchronized `main` / `origin/main` with a clean tree.
- Automated: affected homepage/catalog/heading/legal component checks; TypeScript; eslint on changed frontend files; `npm run docs:check`; `node .agents/scripts/validate-skill.mjs` for the guidance edits. Test meaningful state/focus/reduced-motion/rapid-action behavior, including immediate removal of previous-deck snapshots; do not assert cosmetic class strings or reproduce library internals.
- Browser: local guest trial at 320, 375, 768 and 1440px, pointer/touch and keyboard, default/reduced motion, layout at 200% zoom, intro cancellation, all decks, reveal → rating → next → completion → restart, rapid next/deck changes, live status and no horizontal overflow. Use Edge as in the Owner recording for the rapid-deck regression; sample the course card's actual intermediate hover positions and reverse movement, not only its final shadow. Measure new text/control contrast. Catalog data/auth/teacher behavior stays under unchanged contracts; no fixture writes or stack reset are needed.
- R6 regression cases cover Again → Easy → Easy leaving one card pending, Hard requeueing that final card, and Good completing the queue. Measure the label and underline rectangles and the stationary card box across deck changes. Sample the delayed second connector during actual scroll-triggered playback on both axes.
- Rollback: remove the scoped library integration and restore the changed hero files; revert package/lockfile changes together. Documentation-only retirement does not change other screens at runtime. Final Owner review of the rendered hero remains required before merge.

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
