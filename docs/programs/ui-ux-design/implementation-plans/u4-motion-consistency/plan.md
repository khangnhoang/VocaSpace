# U4 detail plan — motion consistency for course detail and learning routes

Revision: r1, 2026-11-21. Owner approval: r1 on 2026-11-21. Charter: [README.md](../../README.md) (initiative U4). Progress: [progress.md](../../progress.md).

## 1. Binding Spec

### 1.1 Outcome

The pages built before Motion for React (`/courses/[course-slug]`, `/learn`, `/learn/[course-slug]`, the learning workspace `/learn/[course-slug]/[topic-slug]` and the public preview `/courses/[course-slug]/preview/[topic-slug]`) use the same motion language as the U1–U3 pages (`/`, `/courses`, `/login`): the same easing, entrance rules, list and height transitions, and reduced-motion behavior. Layout and content stay as they are, except that the course detail page also gets a redesigned free-enrollment dialog and a fix for the instructor avatar that shows through the open dialog.

### 1.2 Owner decisions

1. (2026-11-21) Scope covers course detail, `/learn` with `/learn/[course-slug]`, and the learning workspace with the public preview.
2. (2026-11-21) Motion level matches the new pages: Motion for React list reveal, sliding indicators, height and step transitions, shared easing. Layout and copy stay as they are, except for decision 4.
3. (2026-11-21) One PR per page group: PR1 course detail, PR2 `/learn` and `/learn/[course-slug]`, PR3 workspace and preview. The Owner checks each running screen before its merge.
4. (2026-11-21) On course detail, the free-course enrollment dialog is too plain and too empty, and the instructor avatar shows bright through the open dialog. PR1 fixes both.

### 1.3 Shared motion language (all PRs)

- Easing comes from Product Language §9: `cubic-bezier(0.2, 0, 0, 1)`. Timing is local to each surface and verified in the browser.
- The motion boundary is the smallest client component, wrapped in `LazyMotion` with `domMax` (or `domAnimation` when no layout animation is used) in `strict` mode, plus `MotionConfig reducedMotion="user"`. This matches `CatalogExplorer.tsx` and `HeroPractice.tsx`.
- Server-rendered content is never hidden before hydration. Use `initial={false}` on first render. Scroll reveal arms only after hydration and only for elements below the viewport, as `CatalogAnimatedGrid.tsx` does. Focus reveals a pending element at once.
- Exiting elements are `inert` and `aria-hidden` immediately, and no action waits for an exit animation.
- Under `prefers-reduced-motion: reduce`, final states appear immediately with the same text, focus and actions.
- Motion never runs on a real loading state beyond the existing skeletons, and never animates progress from zero on render.

### 1.4 Acceptance — PR1 course detail

| ID | Observable result |
| --- | --- |
| AC1 | With the enrollment dialog open at any width, nothing on the page (including the instructor avatar) paints above the dialog's backdrop. The dialog renders through a portal to `document.body`. |
| AC2 | The dialog behaves as a modal: focus moves into it on open, Tab stays inside it, `Esc` and the close button close it unless enrollment or payment creation is in flight, and focus returns to the button that opened it. |
| AC3 | For a free course, the dialog is a single column of about 32rem. It shows the title "Đăng ký khóa học miễn phí", the course cover thumbnail and title, the real counts "N chương · N chủ đề" from the detail data, the existing benefit lines ("Truy cập trọn đời", "Hệ thống Flashcard FSRS"), the price "Miễn phí", and one primary action "Đăng ký miễn phí" with the existing pending label. A quiet "Để sau" closes the dialog. There is no empty second column at any width. The enrollment action, success handling and redirect are unchanged. |
| AC4 | The paid dialog keeps its two stages and current content. Stage changes slide with Motion instead of the CSS `translateX` transition, and the stage that is not current is inert and hidden from assistive technology, as today. |
| AC5 | Opening the dialog fades the backdrop and scales the panel in from 0.96; closing reverses it. Under reduced motion, the dialog appears and disappears without scale. |
| AC6 | Page sections below the first viewport (stats, about, syllabus chapters, instructors) reveal once on scroll with a short stagger, using the catalog's scroll-reveal rules. Content in the first viewport is never hidden, and the enrollment card is never animated. |
| AC7 | Hover feedback on syllabus chapters and topic rows uses explicit transition properties (no `transition-all`) and Product Language easing. |
| AC8 | No horizontal scroll at 320, 375, 768 and 1440px with the dialog closed or open; at 320px the free dialog fits without clipping the action. |

PR2 and PR3 acceptance is written as plan revisions r2 and r3 before each PR opens, from a rendered audit of the current motion on those routes, and approved by the Owner then. Section 1.5 already binds them.

### 1.5 Guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Change only motion, the dialog shell and the free-dialog layout. No data, Server Action, route or copy change except the free-dialog strings in AC3. | Motion work silently changes enrollment, payment or learning behavior. |
| G2. `components/ui/*` stays unchanged. Shared motion helpers live in a feature-neutral `components/motion/` module only when a second route needs them; existing U2/U3 components are not refactored to use it in this initiative. | A local fix changes shared primitives, or the accepted U2/U3 pages regress. |
| G3. PR3 stays within the accepted [Learning Workspace brief](../../../../ui-design-system-and-review/surfaces/learner/learning-workspace.md) §6 (flashcard turn, corrective nudge, progress from the previous value, no gated actions). Any change to those behaviors needs an Owner decision first. | An accepted surface contract changes without its owner. |
| G4. Existing behavior tests stay green with their assertions unchanged; motion-specific tests are added where behavior depends on motion (inert exits, reduced motion, no hidden first-viewport content). | Motion changes hide a functional regression. |
| G5. No new package. `motion` is already installed. | Unapproved dependency growth. |

## 2. Repository facts

Baseline `eca348a7` (origin/main, 2026-11-21).

- Motion for React is used in `app/(client)/_components/home/HeroPractice.tsx`, `app/(client)/courses/_components/catalog/*`, `app/(client)/(auth)/login/page.tsx` and `components/auth/{auth-motion,auth-shell,word-deck}.tsx`. Nothing under `/courses/[course-slug]` or `/learn` imports it. Those routes use `tw-animate-css` fades (`motion-safe:animate-in fade-in-0`), CSS `transition-*` classes and a CSS-module sheet (`ReviewSheet.module.css`).
- `PublicCoursePaymentModal.tsx` is a hand-made `role="dialog"` overlay (`fixed inset-0 z-50`), rendered inside `PublicCourseEnrollmentCard`. That card sits in an `aside` with `lg:sticky` in `PublicCourseDetailView.tsx` line 100, which creates a stacking context. `PublicCourseInstructors.tsx` line 16 gives the avatar `relative` positioning later in the DOM, so it paints over the dialog. The dialog has no `Esc` handling or focus management.
- The free-course stage lives in `PublicCoursePaymentStageDiscount.tsx` lines 40–103: a 45/55 two-column layout whose right column holds only "Học phí / Miễn phí" and the button.
- The detail data (`PublicCourseDetail`) carries `syllabus` chapters with topics, which `PublicCourseStats.tsx` already counts.
- `/learn` renders `LearnDashboardClient.tsx` (583 lines) with paged course lists, `LearningStreakCard`, `PendingPayments` and `ReviewSheet`. `/learn/[course-slug]` renders `EnrolledCourseOverview.tsx`. The workspace is `LearningWorkspace.tsx` (1,467 lines) with `FlashcardStage`, `MemoryCheckStage`, `QuestionResponse`, `QuestionNavigator` and `TopicCompletionPanel`. The preview is `PublicCoursePreviewExperience.tsx`.
- Behavior tests exist for these surfaces, for example `__tests__/components/public-course-detail.test.tsx`, `enrolled-course-overview.test.tsx`, `public-course-preview.test.tsx`, and the learning-workspace suites listed in the surface brief.

## 3. Bounded hypotheses

- H1: Portalling the dialog with `createPortal` from the existing client component fixes AC1 without moving state. Invalidated if a test or the browser shows the avatar or another element above the backdrop after the portal.
- H2: The catalog's scroll-reveal hook can be reused by moving it to `components/motion/` for course detail and `/learn`, leaving the catalog's copy untouched (G2). If the extraction would change catalog behavior, keep a local copy instead.
- H3: The free dialog's counts come from props already passed to the enrollment card (`course.syllabus`), with no new data read.

## 4. Checkpoints

| PR | Branch | Content | Checks |
| --- | --- | --- | --- |
| PR1 | `feat/course-detail-motion` | This plan, AC1–AC8. | `npm run test:run`, `npm run lint`, `npx tsc --noEmit`, `npm run docs:check`. A component test for portal, focus, `Esc` and the free layout. In the browser: the avatar under an open dialog, free and paid dialogs at 320/375/768/1440px, reduced motion, keyboard. Owner QA of the running screen. |
| PR2 | `feat/learn-motion` | Plan r2 with the `/learn` and overview acceptance, then implementation. | The same suites, a rendered audit before and after, Owner QA. |
| PR3 | `feat/learning-workspace-motion` | Plan r3 with the workspace and preview acceptance within G3, then implementation. | The same suites plus the learning-workspace smoke specs, Owner QA. |

QA fixtures: the local stack with a published free course and a published paid course for PR1; an enrolled learner with progress and due reviews for PR2 and PR3. These are confirmed before browser QA. If a fixture is missing, browser QA is reported as blocked rather than skipped.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Scroll reveal hides server content or delays reading. | The catalog rules: arm after hydration, below the viewport only, reveal on focus; a test asserts first-viewport content is visible without JavaScript. |
| The dialog portal breaks the paid flow (polling, timers, success redirect). | Existing payment tests stay green; the paid flow is checked in the browser through stage 2 without creating a real PayOS order (a resumed `pending` fixture). |
| Motion adds bundle weight to `/learn`. | `LazyMotion` with `strict`; compare the route's first-load JS in `next build` before and after, and report the numbers. |

Each PR is independent and reverts on its own. No database, hosted or production configuration change is involved.

## 6. Progress

State lives in the program [progress.md](../../progress.md).
