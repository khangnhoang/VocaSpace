# Problems, risks and follow-ups — Admin console

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

### ADMIN-001: `/admin` pages are not gated

- Status: Open (2026-10-13).
- Problem: anyone, signed in or not, can open `/admin`, `/admin/courses` and `/admin/user-management`. `app/admin/layout.tsx` has no role check and `utils/supabase/middleware.ts` only guards teacher and profile routes. Real data stays behind the role checks inside `getAdminDashboardData` and the `requireAdmin` actions in `app/actions/user.ts`, but `/admin/courses` is a client page of mock data with no check at all. The sidebar also links to `/admin/stats` and `/admin/settings`, which do not exist.
- Evidence: `app/admin/layout.tsx:5-22`, `utils/supabase/middleware.ts:45-62`, `components/ui/admin-sidebar.tsx:29-30` at `b6720ec`.
- Direction: AD1.
- Exit condition: a signed-out visitor and a non-admin are sent away from every `/admin` page, with tests, and the sidebar has no dead link.

### ADMIN-002: Course members can publish a course with a direct table update

- Status: Open (2026-10-13).
- Problem: `authenticated` has table-level `UPDATE` on `courses` (`20260609114505_remote_schema.sql:2019`), which covers `status`, `submitted_at`, `reviewed_at`, `reviewed_by` and `reject_message`, and the `Courses - Staff Update Secured` policy (`20260915100000_d1_trusted_lifecycle.sql:478-482`) allows any owner, co-owner or editor (`has_course_authoring_access`). So a course member can set `status = 'published'` from the browser and the course appears in the public catalog without any review. The app itself has no publish path: no RPC or action sets a course to `published`.
- Evidence: privileges and the policy read on the root DB and, read-only, on hosted (2026-10-13); the catalog lists only `status = 'published'` courses (`20260710182617_public_course_read_model.sql:30`). Inferred from grants and policy; not reproduced with a client call yet.
- Direction: AD2 (Owner decisions 3 to 5).
- Exit condition: a client table update of those columns is refused for every signed-in role, with integration tests; they change only through the AD2 lifecycle RPCs, the existing `moderate_platform_content`, or trusted service-role paths.

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
