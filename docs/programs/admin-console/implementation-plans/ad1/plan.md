# AD1 detail plan — `/admin` route gate

Revision: r3, 2026-10-13 (Codex plan review r2 PASS with two minor fixes: the production status check is a script, the matcher list is exact; r2 for Codex plan review r1: guest redirect wins over the hidden-route 404, HTML status and client navigation stated apart, a revoked-admin navigation test for AC3, the proxy matcher limit stated, line reference and rollback fixed). Owner approval: 2026-10-13. Master plan: [plan.md](../../plan.md) (unit AD1, Outcome 1, invariant 1).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges, only an active admin (`profiles.role = 'admin'` and `removed_at is null`) can render any page under `/admin`. A signed-out visitor is sent to sign in; any other signed-in user gets the app's 404 page, as if the route did not exist. The admin sidebar links only to pages that exist and highlights the page the admin is on. The mocked `/admin/courses` screen is no longer reachable until AD3 builds the real one (ADMIN-001).

| ID | Observable result |
| --- | --- |
| AC1 | A signed-out request to `/admin` or any path under `/admin/` that reaches the proxy is redirected (307) to `/login?reason=signin_required`, with the request's query and hash dropped and exactly one `reason`, as `/profile` does today (`utils/supabase/middleware.ts:47-58`). This includes the routes AC6 removes: for a signed-out visitor the redirect wins over their 404. Paths the proxy matcher skips (`_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt` and paths ending in `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`; `proxy.ts:11-15`) are not admin pages: no admin route has such a name, so they keep today's behaviour (a static file or the 404 page) and the matcher is not changed. A path that only starts with the same letters (`/adminish`, `/administrator`) is not treated as admin. |
| AC2 | A signed-in user whose active profile is not `admin` (student, teacher), a user whose admin profile has `removed_at` set, and a user whose profile cannot be read get the app's not-found page (`app/not-found.tsx`) on every existing admin page (`/admin`, `/admin/user-management`), and no admin page content, sidebar or header is sent to them. On a document load the response status is 404; this is checked against a production build (`next build` and `next start`), not only `next dev`. On a client-side navigation the result is the not-found page in place of the admin page (an RSC response has no document status). The check runs before the admin shell renders, and the admin route tree has no `loading.tsx` or Suspense boundary above the check, so streaming has not started when `notFound()` is called. |
| AC3 | The check in AC2 runs in every server render of an admin page, including the server render that a client-side navigation from one admin page to another requests; it does not rely only on a layout that Next.js may keep mounted between admin pages. Observable test: an admin opens `/admin`, loses admin access (role set to `student` by the service role), then follows the sidebar link to "Quản lý User" without a reload and gets the not-found page with no admin content. One server helper owns the "active admin" rule for pages, so the layout and the pages cannot drift. |
| AC4 | An active admin opens `/admin` and `/admin/user-management` and sees the same content and behaviour as today; the account menu link "Quản trị hệ thống" still leads to `/admin`. |
| AC5 | The sidebar lists exactly two links, "Dashboard" (`/admin`) and "Quản lý User" (`/admin/user-management`). "Thống kê & Doanh thu" (`/admin/stats`), "Cài đặt hệ thống" (`/admin/settings`) and "Quản lý Khóa học" (`/admin/courses`) are removed. "Dashboard" is marked active only on `/admin`, not on `/admin/user-management`; "Quản lý User" is active on `/admin/user-management` and its sub-paths. |
| AC6 | `/admin/courses`, `/admin/stats` and `/admin/settings` return the 404 page for every signed-in caller, the admin included (a signed-out visitor is redirected first, AC1). The admin course components (`app/admin/courses/_components/*`) and `lib/schemas/admin-course.ts` stay in the repository, with their existing tests, for AD3 to reuse (Owner, 2026-10-13). |
| AC7 | Existing admin Server Actions keep their own server checks unchanged (`requireAdmin` in `app/actions/user.ts:19-42`, the check in `getAdminDashboardData`, `app/actions/admin-dashboard.ts:19-32`). |
| AC8 | Docs: progress State describes AD1 while it runs; at the final CP ADMIN-001 moves to `Resolved` and a milestone records the unit; `npm run docs:check` passes. |

### 1.2 Scope and non-goals

- In scope: AC1–AC8; the tests named in §4; splitting `app/admin/user-management/page.tsx` into a server page and its existing client component if AC3 needs it.
- Non-goals:
  - any change to admin Server Actions, `is_admin()`, `can_view_course_basic`, `moderate_platform_content` or other SQL (removed-admin checks in SQL are AD7, ADMIN-004);
  - an admin's own role change (AD7);
  - the dashboard's invented numbers, the dead header search and placeholder avatar, the period select (AD4, ADMIN-003);
  - building the real `/admin/courses` screen or course approval (AD2, AD3);
  - a dedicated 403 page; redirects for non-admins;
  - any database migration.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The page gate reads the caller with `supabase.auth.getUser()` (not `getSession()`) and the role from `profiles` filtered by `id = user.id` and `removed_at is null`; any error or missing row counts as "not admin". | A forged or stale session cookie, or a removed admin, passes the gate (fail open). |
| G2. The signed-out redirect never carries `next`, `redirect_to` or any other query from the `/admin` URL. | An open-redirect parameter reaches `/login` (same rule as `/profile`, G1 of A5). |
| G3. The proxy only adds the signed-out redirect for `/admin`; it does not query `profiles`. The role check stays in server rendering (AC3). | Every request through the proxy pays a profile query, or a proxy-only role check leaves the pages unchecked when the proxy matcher changes. |
| G4. No admin Server Action loses or weakens its own check (AC7). | Hiding pages becomes the only protection for admin data. |
| G5. Browser runs use the isolated runtime (API 45441) with the e2e app on port 3100 and `.next-e2e`; root 45321 and hosted are not reset or written. | A run writes the Owner's local data or hosted. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 1 and 8; master plan invariant 1 (server check on every admin page and action).
- (2026-10-13) A signed-in non-admin or removed admin who opens an admin page gets the 404 page; a signed-out visitor goes to `/login?reason=signin_required`.
- (2026-10-13) The mocked `/admin/courses` screen is removed from the sidebar and returns 404 until AD3; its components stay for AD3.
- (2026-10-13) The sidebar's always-active "Dashboard" link is fixed in AD1.

## 2. Repository facts

Baseline: `46951eb`, checked 2026-10-13.

- `app/admin/layout.tsx:5-22` renders the sidebar, header and children with no auth or role check — justifies AC2, AC3.
- `proxy.ts` calls `updateSession` for every path its matcher keeps (`proxy.ts:11-15` skips `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt` and paths ending in `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`); `updateSession` redirects signed-out users only for `/teacher` and `/profile` (`utils/supabase/middleware.ts:43-59`); signed-in users pass through — justifies AC1, G3.
- `app/admin/page.tsx` is a server component whose only check is inside `getAdminDashboardData` (it renders an error card, not a 404, for a non-admin). `app/admin/user-management/page.tsx` is a `"use client"` page whose data comes from `getAllUsers` (`requireAdmin`); `__tests__/components/admin-user-management-create.test.tsx:5` imports that page — justifies AC3 and the split in §1.2.
- `app/admin/courses/page.tsx` is a `"use client"` page of mock courses (`MOCK_ADMIN_COURSES`) with accept and reject actions that only show toasts; nothing outside `app/admin/courses` imports it. `__tests__/components/admin-course-table.test.tsx` and `__tests__/schemas/admin-course.test.ts` test its components and schema — justifies AC6.
- `components/ui/admin-sidebar.tsx:25-31` lists five links including `/admin/stats` and `/admin/settings`, which have no route; `isActive` is `pathname === url || pathname.startsWith(url + "/")` (`:60-61`), so `/admin` is active on every admin page. `__tests__/components/admin-sidebar.test.tsx` asserts five links — justifies AC5.
- `profiles` has the select policy `Profiles - Public Active Select` (`removed_at is null`, `20260609114505_remote_schema.sql:1503`); `requireAdmin` already reads the role with the user's client and `.is("removed_at", null)` — G1 matches the existing action check.
- The local seed has an `admin@gmail.com` admin, and the smoke suite signs in student, teacher and admin seed users (`e2e/smoke/account-menu.smoke.spec.ts`); E2E is not run in CI — justifies the local smoke run in CP3.
- `app/robots.ts` already disallows `/admin`.
- No `loading.tsx` exists under `app/admin` (the only ones are under `app/(client)`) — supports the 404 status in AC2.
- Playwright starts `next dev` on port 3100 with `.next-e2e` (`playwright.config.ts:27-34`) with `reuseExistingServer: false`; `scripts/e2e/support/auth-users.mjs` creates users through the auth admin API — supports the AC3 revocation test and the production status check.

## 3. Bounded implementation hypotheses

- A server-only helper (for example `lib/auth/admin-access.ts`, `requireAdminPage()`), wrapped in React `cache()` so the layout and the page share one lookup within one server request (it is not a cache across navigations), returns the admin's user id or calls `notFound()`. It may be replaced by an equivalent as long as G1 and AC3 hold.
- `app/admin/layout.tsx` and each admin `page.tsx` call it before rendering. `app/admin/user-management/page.tsx` becomes a server page that calls it and renders the current client page moved to `_components/` (the test import moves with it); behaviour of the client component is unchanged.
- `updateSession` gains an `isAdminRoutePath` matching `/admin` and `/admin/…`, redirected like `/profile`.
- `app/admin/courses/page.tsx` is deleted, so Next.js returns 404 for that route; `_components` folders are not routable.
- Sidebar: `isActive` treats `/admin` as an exact match only.
- Existing action checks are not refactored onto the new helper (non-goal; their error shape differs).

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Main prepares this plan, AD1 State in progress.md and ADMIN-001 as in progress; after Codex plan review PASS, Owner approval and an explicit grant, Main commits them on `fix/admin-route-gate`, branched from `feat/admin-console-plan` (`46951eb`, so the PR also carries the master plan commit). | `npm run docs:check` |
| CP2 | Gate (AC1–AC4, AC7) | `__tests__/utils/supabase-middleware.test.ts`: new admin cases (signed-out `/admin`, `/admin/user-management`, `/admin/x?next=…#h` → exact login URL with one `reason`; forged `reason` replaced; `/adminish` and `/administrator` not redirected; signed-in `/admin` passes through with no profile query). New helper unit test: no user, auth error, profile error, no active row (removed admin), student, teacher → `notFound()`; admin → user id; the profile query filters `removed_at`. `admin-user-management-create.test.tsx` passes with the moved import. `__tests__/proxy.test.ts`, `admin-dashboard.test.ts` pass. |
| CP3 | Sidebar, removed routes, browser evidence and docs (AC2–AC6, AC8); final verification | `admin-sidebar.test.tsx` updated: exactly the two links with their hrefs; "Dashboard" active on `/admin` and not on `/admin/user-management`; "Quản lý User" active on `/admin/user-management`. New smoke spec `e2e/smoke/admin-gate.smoke.spec.ts` on the isolated runtime (G5): guest on `/admin/user-management` and on `/admin/courses` lands on `/login?reason=signin_required`; student and teacher get the not-found page, status 404 and no sidebar on `/admin` and `/admin/user-management`; admin opens `/admin` from the account menu, sees two sidebar links, navigates client-side to "Quản lý User" and sees the user table; admin gets 404 on `/admin/courses`, `/admin/stats`, `/admin/settings`; the AC3 revocation case uses an admin created for the test (not `admin@gmail.com`), whose role is set back or the user deleted in `finally`. The existing `account-menu.smoke.spec.ts` passes. Production status check: `next build` and `next start` on port 3100 with `.next-e2e` against the isolated runtime, then a script sends document requests to it, signed out and with the session cookies of a signed-in student and admin (Playwright's config always starts `next dev`, so the spec is not pointed at this server): guest 307, student 404 with the not-found page and no sidebar, admin 200. Then `npm run test:ci`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (the route set changes), `npm run docs:check`, `git diff --check`. |

### 4.1 QA fixture readiness

- QA type: smoke E2E on the isolated runtime with seed accounts (student, teacher, admin) and one admin created and cleaned up by the AC3 test; no seed change. A removed admin is covered by the helper unit test, not by the browser (the seed has no removed admin, and adding one is not needed for confidence: the gate treats "no active row" as not admin).
- Owner manual QA on :3000 (optional): sign in as admin and as a student and open `/admin`.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A layout-only check is skipped on client navigation between admin pages | AC3: every admin page calls the helper; the smoke spec navigates client-side |
| `notFound()` renders with status 200 or with the admin shell | AC2 is checked on a production build; the check runs before any shell or Suspense boundary; if a clean 404 cannot be had, stop and report (no silent 200) |
| A future admin page forgets to call the helper | The layout call still blocks entry from outside `/admin`; the helper is the one place to call; AD3–AD7 detail plans add their pages through it |
| Moving the user-management client page breaks its test or behaviour | The move is file-only; its existing component test must pass unchanged in what it asserts |

- Rollout runbook: none beyond merge and the normal production deploy; no migration, no hosted step.
- Stop when: the gate needs a database change; an existing admin action must change to make the gate work; a document load of a gated page cannot return status 404 with the app's not-found page and no admin shell on the production build. Report to the Owner.
- Rollback: revert the PR; nothing persistent changes. A revert reopens ADMIN-001 (ungated pages, the mock `/admin/courses` screen and the dead sidebar links come back); after a revert deploy, check that `/admin` behaves as before and reopen ADMIN-001 in problems.md.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
