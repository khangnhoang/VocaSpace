# F1 detail plan — learner navigation, not-found page and sign-in reason

Revision: r3, 2026-10-07 — Codex plan review r3 PASS (0 findings); plan approved for implementation. (r2 Codex plan review FAIL, 2 Required: Header wiring test, dashboard result shape; rebased on `main` `4ab4d89` after E2E-001 merged). r2 (r1 Codex plan review FAIL, 6 Required: streamed not-found status, topic-slug scope, redirect precedence and query policy, title facts and checks, verification matrix, STUDENT-005 timing). Owner approval: decisions in §1.4 approved 2026-10-07; plan approved after the r3 Codex plan review PASS. Master plan: [plan.md](../../plan.md) (Decision 21).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges, the mobile account menu offers the same destinations as desktop for guests, learners, course collaborators and admins; an unknown or not-found page shows a VocaSpace page with a way back; and a visitor sent to `/login` because a page needs sign-in sees why. Fixes `NAVIGATION-001`, `STUDENT-005` and `AUTH-003` from [problems.md](../../problems.md).

| ID | Observable result |
| --- | --- |
| AC1 | A signed-out visitor below the `lg` breakpoint opens the account sheet and sees `Đăng nhập` (to `/login`) and `Đăng ký ngay` (to `/register`); following either closes the sheet. |
| AC2 | A signed-in user below `lg` sees in the sheet exactly the destinations the desktop menu shows for the same user: `Không gian học tập`, `Hồ sơ cá nhân`, the course-workspace link under the same condition (teacher role, a collaborator membership, or a pending invitation) and with the same label as desktop (`Lời mời cộng tác` when only an invitation exists, else `Khóa học của tôi`), `Quản trị hệ thống` only when `profiles.role = 'admin'`, and `Đăng xuất`, which signs the user out. Both menus link the course workspace through `getTeacherCourseListPath()`, and following a sheet link closes the sheet. |
| AC3 | Neither menu shows `Cài đặt` (no settings page exists; Decision 21 item 1). |
| AC4 | A URL with no route, and a page whose action returns `not_found` (an invalid or unknown public course slug; an invalid or unknown `/learn/[course-slug]`), render one VocaSpace page with the client header exactly once, a Vietnamese "page not found" heading, a short explanation, a primary `Về trang chủ` link to `/` and a secondary `Xem khóa học` link to `/courses`, and `robots` `noindex`. An unmatched URL and any not-found response that has not started streaming return HTTP 404; a learner route that already streamed its `loading.tsx` keeps the framework status (Next.js 16 cannot change it after streaming starts). Existing `topic_unavailable`, unenrolled and recoverable-error surfaces are unchanged. |
| AC5 | On that page the document title is exactly `Không tìm thấy trang \| VocaSpace` (absolute, not combined with the learner template `%s \| Vocaspace Learn` or the course fallback `Khóa học \| VocaSpace`), on a direct load and after a client navigation from a differently titled page, for an unmatched URL, a public-course not-found and a learner not-found. |
| AC6 | Where a page today redirects a visitor to `/login` because they are signed out (the middleware for `/teacher`, `/teacher/...`, `/profile`, `/profile/...`; the server redirects in `/learn` on `errorCode === "AUTH_REQUIRED"` and in `/learn/[course-slug]` and `/learn/[course-slug]/[topic-slug]` on `status: "auth_required"`), the destination is same-origin `/login` with exactly one `reason=signin_required`: teacher redirects keep their other query parameters and replace any incoming `reason`; profile redirects clear query and hash first; `/learn` redirects carry only `reason`. Slug validation that returns `not_found` before the auth check keeps its precedence. The login card shows a non-error notice `Vui lòng đăng nhập để tiếp tục.`; `/login` with no `reason` or any other value shows no notice. |
| AC7 | Existing behavior stays: signed-in users still reach those pages; the `/profile` redirect still drops every other query parameter and the hash (A5 AC1 and its middleware regression test); login and register still send a signed-in user to `/`; `auth_error` notices still show; after sign-in the user still goes to `/` (no return-to); sign-out still lands on bare `/login`. |

### 1.2 Scope and non-goals

- In scope: the mobile account sheet and the desktop account menu in the client header; a root not-found page; the sign-in reason on the redirects listed in AC6; the login notice; tests; the program docs.
- Non-goals: a settings page; a return-to-original-page after sign-in (open-redirect risk); header search; header visual redesign; teacher-area not-found UI beyond the shared root page; changing streaming or `loading.tsx` to force 404 on streamed learner routes; `topic_unavailable` and other recovery surfaces; `/auth/set-password` and sign-out redirects; any database, RLS, Server Action contract or auth-provider change; E2E-001 (fixed separately in PR 138).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The redirect adds only the fixed literal `reason=signin_required` to a same-origin `/login`; the login page renders text only from a fixed map keyed with `Object.hasOwn`, never the raw parameter, and never navigates based on it | User-controlled text or a redirect target in the URL becomes a phishing or open-redirect vector |
| G2. The middleware guard set and its signed-in/signed-out decisions do not change; `/profile` still clears query and hash before adding `reason` | Weakens the teacher guard (AUTH-003 risk) or reopens A5 AC1 |
| G3. Course-link visibility, its label and the admin flag come from one pure helper fed by the server data `Header` already reads, used by both menus; the sheet does not fetch the profile itself | The two menus drift, or a second client query disagrees with desktop |
| G4. The not-found page renders the client header itself and is the root `app/not-found.tsx`, so it never renders inside `(client)/layout.tsx` (exactly one header) | Double or missing header on not-found pages |

### 1.4 Owner decisions that bind this unit

- Decision 21 (2026-10-07, Owner-approved): (1) remove the dead `Cài đặt` item from both menus; (2) one generic sign-in notice for every sign-in redirect, not per-route text; (3) no return-to after sign-in in this unit; (4) the not-found page uses the client header and the two links in AC4.

## 2. Repository facts

Baseline: `fb685fe`, checked 2026-10-07; product sources unchanged at `4ab4d89` (E2E-001 fix, PR 138); Next.js 16.2.6 installed.

- `components/ui/mobile-account-sheet.tsx` already has `Đăng xuất`, `/learn`, `/profile` and a hardcoded `/teacher/courses` link labelled `Khóa học & lời mời`, a non-link `Cài đặt` row, nothing for guests and no admin link — narrows NAVIGATION-001 to AC1–AC3.
- `components/ui/header.tsx` desktop menu: `Cài đặt` is a `DropdownMenuItem` with no action; admin link when `profile.role === "admin"`; course link via `getTeacherCourseListPath()`, shown for teacher role, a membership or a pending invitation and labelled `Lời mời cộng tác` or `Khóa học của tôi` — justifies AC2, AC3, G3.
- No `not-found.tsx` exists under `app/`; `notFound()` is called in `PublicCourseDetailRoute.tsx`, `learn/[course-slug]/page.tsx` and `learn/[course-slug]/[topic-slug]/page.tsx`; with a root `not-found.tsx`, Next.js 16.2.6 suppresses the implicit route-group fallback (`next-app-loader` index.js:266), so the root page renders outside `(client)/layout.tsx` — justifies AC4, G4.
- Both learner routes have `loading.tsx`; their pages await actions before `notFound()`, so a streamed response keeps status 200 — justifies the AC4 status clause.
- The topic page calls `notFound()` only for `not_found`; a malformed or missing topic in an accessible course returns `topic_unavailable` and renders the existing recovery surface (`app/actions/learning-workspace.ts:462`, `:538`; protected by `e2e/smoke/learning-workspace.smoke.spec.ts:96`) — justifies the AC4 exclusion.
- Malformed course slugs return `not_found` before the auth check (`app/actions/enrolled-course-overview.ts:49`, `app/actions/learning-workspace.ts:414`) — justifies the AC6 precedence clause.
- Titles: root metadata `VocaSpace`; `app/(client)/learn/layout.tsx` sets template `%s | Vocaspace Learn`; the public course page falls back to `Khóa học | VocaSpace` in `generateMetadata`; `/terms` and `/privacy` use `<page> | VocaSpace` — justifies AC5.
- `utils/supabase/middleware.ts` redirects signed-out `/teacher*` keeping its query and `/profile*` with query and hash cleared; `app/(client)/learn/page.tsx:7` calls `redirect("/login")` when `!result.success && result.errorCode === "AUTH_REQUIRED"` (`app/actions/learn-dashboard.ts:38`), while the overview and topic pages use `status: "auth_required"` and `status: "not_found"`; `app/(client)/login/page.tsx` reads only `auth_error` through a fixed map in a `Suspense` child — justifies AC6, G1, G2.
- `__tests__/utils/supabase-middleware.test.ts` covers the guard set — the regression net for G2. E2E specs check sign-in redirects by pathname and the sign-out redirect by `/\/login$/` (`e2e/d2/public-course-preview.spec.ts:126`) — neither changes.
- `supabase/seed.sql` seeds `admin@gmail.com` (admin), `teacher@gmail.com` (teacher) and `student@gmail.com` (student); no pending course invitation is seeded — justifies the fixture decision in §4.

## 3. Bounded implementation hypotheses

- The reason literal and its message live in one small module (for example `lib/auth/sign-in-reason.ts`) used by the middleware, the `/learn` pages and the login page — may change if G1 holds and there is one source for the literal.
- A pure helper (for example `getAccountMenuState({ role, hasMembership, hasPendingInvitation })`) returns the admin flag and the course-link visibility and label; `Header` uses it for both menus and passes the result to `MobileAccountSheet` — may change if G3 and AC2 hold.
- `app/not-found.tsx` renders `<Header />` plus a small presentational component; the title is set by an absolute `metadata` title or a React `<title>`, chosen by the CP3 browser check — may change if AC4, AC5 and G4 are observed.

## 4. Checkpoints

Fixture decision: browser QA uses the three seeded users for guest, student, teacher and admin. The invitation-only label has no seed: it is covered by the helper unit test and the `Header` orchestration test with mocked query results, not in the browser; no fixture is added. Smoke E2E and any run of `npm run test:e2e` need exclusive use of the shared e2e stack (fixed project and ports, the runner resets the database), so they run only when no other branch is using it, for the whole preparation, reset and run; any failure is compared with `main` and only a new one blocks.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC6, AC7: sign-in reason on the listed redirects and the login notice | Unit: middleware cases (teacher with and without query and with an incoming `reason` → one `reason`, other params kept; profile query and hash cleared then `reason`; signed-in unchanged; non-guarded paths unchanged); page tests: dashboard `{ success: false, errorCode: "AUTH_REQUIRED" }` → `/login?reason=signin_required`; overview and topic `auth_required` → the same, `not_found` → `notFound()` (extend existing route tests); login notice shown for `signin_required`, absent for none, an unknown value and `__proto__`, and `auth_error` still shown. Browser: signed-out `/teacher?x=1`, `/profile?next=x#h`, `/learn`, `/learn/<valid-format slug>` land as specified with the notice |
| CP2 | AC1–AC3: mobile and desktop menu parity | Unit: the helper for student, teacher, member-only, invitation-only and admin. Orchestration: render the real async `Header` with a mocked Supabase client returning controlled profile, membership and pending-invitation results, and assert both the desktop menu and the props given to the sheet for member-only, invitation-only, admin and guest. Component: sheet guest links, learner set, label, admin link only when flagged, logout form present, no `Cài đặt`, link click closes the sheet. Browser at 320, 375 and 1280 px: guest, student, teacher, admin; sheet opens by keyboard, Escape closes it, focus stays inside while open and returns to the trigger; logout from the sheet signs out |
| CP3 | AC4, AC5: root not-found page | Component: heading, two links. Browser: `/khong-ton-tai` (404, one header, title), an unknown `/courses/<slug>` (one header, title, status recorded), an unknown `/learn/<slug>` as the student (one header, title, status recorded), each by direct load and by client navigation from a differently titled page; a missing topic in an enrolled course still shows the `topic_unavailable` surface |
| CP4 | Unit-wide verification and docs | `npm run test:run`; `npx tsc --noEmit`; eslint on changed files; `npm run build`; `npm run docs:check`; `git diff --check`; smoke E2E under the exclusive-stack rule above (only failures new against `main` block); progress records the checks. Problems NAVIGATION-001, STUDENT-005 and AUTH-003 stay open until the PR merges, then move to Resolved. Required browser QA of CP1–CP3 blocks the PR |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Root not-found also catches `/teacher/*` and admin misses and shows the client header there | Accepted (Decision 21 item 4); teacher-specific not-found stays out of scope |
| A streamed learner not-found returns 200 | Accepted in AC4; `noindex` set; changing streaming is a non-goal |
| Title competes with the learner template or the course fallback | AC5 requires an absolute title; CP3 checks direct load and client navigation on all three paths |
| Adding `reason` changes URLs other tests or E2E specs assert | CP1 updates only exact-URL unit expectations; E2E asserts pathname only |

- Rollout runbook: none beyond merge and the normal Vercel deploy; no migration, no hosted setting.
- Stop when: a guard decision would change (G2); the not-found page cannot render one header without changing `(client)/layout.tsx`; AC5 cannot be met on one of the three paths without changing streaming; an Owner decision in 1.4 is rejected.
- Rollback: revert the PR; no data or settings to undo.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
