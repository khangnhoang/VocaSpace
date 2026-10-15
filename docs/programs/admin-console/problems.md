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

- Status: Implemented and independently reviewed PASS in AD7 (`648c6a8`, 2026-10-15); CI passed on `f1805b6`, hosted migration `20261015090000` applied and catalog verified before merge in PR 158. Hosted write-based runtime probes and Owner production acceptance remain unverified; root migration is outside this rollout grant.
- Problem: `is_admin()` (`20260609114505_remote_schema.sql:593-598`), the admin branch of `can_view_course_basic` and the admin check in `moderate_platform_content` look only at `role = 'admin'`, not `removed_at`; `updateUserByAdmin` (`app/actions/user.ts:115-133`) lets an admin change their own role.
- Evidence: files above at `b6720ec`.
- Direction: AD7.
- Local evidence (2026-10-15): the new active-admin migration, canonical-UUID self-role guard and self-edit form passed focused unit/form, real SQL/Storage/action integration and browser checks; see [progress.md](./progress.md). No hosted state is inferred from these results.
- Exit condition: a removed admin has no admin power in SQL or actions, and an admin cannot change their own role, with tests.

### ADMIN-005: Admin screens have no accepted design

- Status: Open (2026-10-14). The Admin screen-type design was accepted on 2026-10-15; the admin pages are not yet redesigned against it.
- Problem: the Admin screen-type design is accepted and listed in `docs/ui-design-system-and-review/index.md` (`docs/ui-design-system-and-review/screen-types/admin-business-operations.md`); the design lifecycle writes no per-page brief. The three admin pages (`/admin`, `/admin/courses`, `/admin/user-management`) still follow the earlier dark admin shell and have not been redesigned or reviewed against that design.
- Evidence: AD3 ships `/admin/courses` without a brief, by Owner decision of 2026-10-14 (AD3 detail plan §1.4); the Owner reviews the running screen.
- Owner QA of AD3 (2026-10-14): the admin pages look poor. The likely causes are the plain default admin shell and the Admin reference ranking polish low. The live course search works but feels abrupt: typing, then a visible jump, then the results. Fix it with the redesign, not in AD3.
- Direction: the design half is done (the screen-type section now uses a shared design per screen type instead of per-page briefs, and the Admin screen-type design is accepted). A later frontend change redesigns the admin pages against it, including the as-you-type search region, the dashboard charts and the users-list row actions, and the Owner reviews the running screens.
- Exit condition: the admin pages are reviewed against the accepted Admin design (listed in the design index since 2026-10-15).

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git.

- ADMIN-001 Resolved (2026-10-13, AD1): every `/admin` page is gated to active admins (signed-out to `/login?reason=signin_required`, others to the 404 page), the sidebar lists only the two existing pages, and the mock `/admin/courses` screen returns 404 until AD3.
- ADMIN-002 Resolved (2026-10-14, AD2, in the repository; hosted after the Owner applies the migration): `authenticated` has no table-level `UPDATE` on `courses` and column `UPDATE` only on `title, slug, description, price, thumbnail_url, removed_at`, so a direct update of `status` or the review fields is refused for every signed-in role (66 role-matrix tests in `ad2-course-listing-approval.test.ts` on the isolated runtime), and a course reaches `published` only through the `approve_course_review` RPC of an active admin.
