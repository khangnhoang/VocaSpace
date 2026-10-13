# Problems, risks and follow-ups — Admin console

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ADMIN-003: The admin dashboard shows invented numbers

- Status: Open (2026-10-13).
- Problem: the revenue trend is total revenue times fixed fractions (`app/actions/admin-dashboard.ts:130-138`); revenue is enrolments times the current price, not paid amounts (`:86-89`); four trend lines in `app/admin/_components/stats-cards.tsx:19-43` are hard-coded text; the period select, "Xem tất cả" and the header search do nothing.
- Evidence: files above at `b6720ec`.
- Direction: AD4.
- Exit condition: every number on the dashboard is computed from real data with a stated definition, and controls without behaviour are removed or wired.

### ADMIN-004: Admin checks ignore removed admins and allow self role change

- Status: Open (2026-10-13).
- Problem: `is_admin()` (`20260609114505_remote_schema.sql:593-598`), the admin branch of `can_view_course_basic` and the admin check in `moderate_platform_content` look only at `role = 'admin'`, not `removed_at`; `updateUserByAdmin` (`app/actions/user.ts:115-133`) lets an admin change their own role.
- Evidence: files above at `b6720ec`.
- Direction: AD7.
- Exit condition: a removed admin has no admin power in SQL or actions, and an admin cannot change their own role, with tests.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- ADMIN-001 Resolved (2026-10-13, AD1): every `/admin` page is gated to active admins (signed-out to `/login?reason=signin_required`, others to the 404 page), the sidebar lists only the two existing pages, and the mock `/admin/courses` screen returns 404 until AD3.
- ADMIN-002 Resolved (2026-10-14, AD2, in the repository; hosted after the Owner applies the migration): `authenticated` has no table-level `UPDATE` on `courses` and column `UPDATE` only on `title, slug, description, price, thumbnail_url, removed_at`, so a direct update of `status` or the review fields is refused for every signed-in role (62 role-matrix tests in `ad2-course-listing-approval.test.ts` on the isolated runtime), and a course reaches `published` only through the `approve_course_review` RPC of an active admin.
