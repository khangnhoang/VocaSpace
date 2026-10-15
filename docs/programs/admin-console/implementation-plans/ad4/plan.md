# AD4 detail plan — admin dashboard on real data

Revision: r2, 2026-10-15. Owner approval: 2026-10-15, conditional on the independent plan review PASS, which r2 received (round 2). Master plan: [plan.md](../../plan.md), Outcome 4, shared invariants 1, 5 and 7, unit AD4.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `/admin` shows only numbers computed from current database rows, each with its basis or period, in the dashboard layout of the accepted Admin design (section 14). No fabricated value, trend string, ratio or fallback identity remains, and totals stay correct however many rows exist.

| ID | Observable result |
| --- | --- |
| AC1 | An active admin opening `/admin` sees, in this order: the needs-attention panel, one metric band, the "Doanh thu theo tháng" card, the user composition, top courses and recent enrollments. The page content has one `h1`; the second `h1` in the shell's `admin-header.tsx` is a shell defect outside this unit. |
| AC2 | The needs-attention panel shows the number of courses with `status = 'pending'` and `removed_at is null`, and the longest wait (now minus the oldest `submitted_at` among them), with one Action Blue link to `/admin/courses?status=pending`. With no pending course it says so in plain text in the neutral style and shows no wait. |
| AC3 | The metric band has four metrics, each with a one-line basis: revenue = sum of `payments.amount_final` where `status = 'paid'` and `currency = 'VND'`, with the order created (`created_at`) in the current Vietnam calendar month or the five before it; students = active profiles (`removed_at is null`) with role `student`; published courses = `status = 'published'` and `removed_at is null`; "Thẻ đang học" = number of `user_flashcards` rows (the existing A5 count). The revenue basis line says it counts successful payments by order time ("theo thời điểm tạo đơn") over the last six months. |
| AC4 | The revenue card shows six months, oldest first, ending with the current month in `Asia/Ho_Chi_Minh`. A month with no paid payment shows 0. Each month's value is the AC3 revenue sum for that month, bucketed by the order time (`payments.created_at` of a `paid` row). The six values sum to the AC3 revenue metric. |
| AC5 | The revenue card has the "Cột", "Xu hướng" and "Bảng" view switch from section 14, default "Xu hướng"; all three views show the same six values in millions of đồng, keyboard operable, constant card height, and no view shows a percentage, growth rate or comparison. The trend plot is one focusable group: hover or Left/Right Arrow shows the month and exact amount ("Tháng 8 · 12.000.000 ₫") and a polite live region announces the same text. Under `prefers-reduced-motion` no reveal runs and every value is visible at once. |
| AC6 | User composition lists students, teachers and admins among active profiles as labeled horizontal bars with count and share of the three; no donut. |
| AC7 | Top courses lists at most five non-removed courses ranked by enrollment count (ties by title), each with its enrollment count (all enrollments, including those of removed learners, as today) and its revenue (sum of its paid VND payments, all time). |
| AC8 | Recent enrollments lists the five newest enrollments with learner name, learner email, course title and relative time. A learner whose profile is removed or missing shows the existing missing-learner label; any learner with no stored email shows no email; an email is never invented. No price column. |
| AC9 | Correctness does not depend on row counts: counts and sums are computed in the database, so a result never silently stops at the PostgREST `max_rows` limit (1000). |
| AC10 | A signed-out visitor, a non-admin and a removed admin get no dashboard numbers: the page gate behaves as today, and the summary RPC called directly returns an error and no data. |
| AC11 | No trend string, "Theo tuần" select, or other control without a working source remains on the page. When the summary read fails, the page shows a safe error state with no partial numbers and no raw database text, and a "Thử lại" button that reloads the data (Admin design section 13). |

### 1.2 Scope and non-goals

- In scope: one migration adding a read-only summary RPC; the dashboard Server Action and its Zod contract; the `/admin` page and its `app/admin/_components/*` rebuilt to section 14; tests at the integration, action and component layers; program docs.
- Non-goals: the admin shell (sidebar, top bar, shell colors, the sidebar pending count), the course, user, payment or discount pages; AD5 payments and orders view; a `paid_at` column or any change to the payment flow; remembering the chosen revenue view; refunds; new personal-data fields or read audiences; changes to `components/ui/*`.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Compute every count and sum inside the RPC; the action reads row lists only for the five recent enrollments. | A list read is capped at 1000 rows and the dashboard shows a wrong total with no error (AC9). |
| G2. The RPC checks `public.is_admin()` first and raises with SQLSTATE `42501` otherwise. It is `SECURITY INVOKER`, has a fixed `search_path`; `EXECUTE` is revoked from `PUBLIC`, `anon`, `authenticated` and `service_role`, then granted to `authenticated` only, as the AD2 migration does (the schema's default privileges otherwise grant all three API roles). | A definer function or a missing check lets a non-admin or a removed admin read business totals (AC10). |
| G3. The action keeps its active-admin check (role `admin`, `removed_at is null`) before the RPC and before the service-role email read, and uses `getActiveProfileEmails` only for profile ids the enrollment query returned. | Service role bypasses RLS and could expose emails before authorization (AUTH-019 contract). |
| G4. Month buckets and the six-month window are computed in SQL with `Asia/Ho_Chi_Minh`, from one `now()` per call. | Buckets drift by a day at month edges, or the metric and the chart use different windows and stop summing to the same value (AC4). |
| G5. Only `status = 'paid'` and `currency = 'VND'` rows count as revenue. | Pending, expired or failed orders, or a non-VND amount, inflate revenue. |
| G6. The UI renders only fields the action returns; on any action error it shows the error state without numbers. | A partial or default zero is shown as if it were real (invariant 5). |
| G7. Use the isolated runtime (API 45441) for rebuilds and integration; never reset root (45321). | The Owner's development data is destroyed or receives an unapproved migration. |
| G8. Keep the page `h1` text "Tổng quan Quản trị", or change the marker in `e2e/smoke/admin-gate.smoke.spec.ts` in the same commit. | The smoke test uses that text to prove non-admins see no dashboard; a renamed title makes the check pass without testing anything. |

### 1.4 Owner decisions that bind this unit

- Master plan decision 8 and Outcome 4; the gate "including metric definitions" is met by AC2 to AC8.
- (2026-10-15) Scope: real data plus the dashboard layout of the accepted Admin design section 14; the admin shell stays out of scope.
- (2026-10-15) The FSRS card becomes "Thẻ đang học" with the existing `user_flashcards` count; the fabricated stability line is removed.
- (2026-10-15) Revenue metric period: the last six months, the same window as the chart; Vietnam calendar months.
- (2026-10-15, after plan review) Revenue months use the order time `payments.created_at`, replacing `updated_at`: deleting a learner rewrites `updated_at` of their paid rows. An order lives at most 15 minutes (the PayOS link expiry; the database does not enforce it), so only an order created in the last 15 minutes of a month and paid in the next lands one month early.
- (2026-10-15) Aggregation: a read-only database RPC; its migration reaches hosted before merge, as for AD2 and AD7.
- (2026-10-15) Keep top courses (labeled bars, enrollments and paid revenue) and recent enrollments (no price column, no invented email).
- Admin design section 19 (2026-10-15): default revenue view "Xu hướng", the view-switch grammar, the data-bar gradient and one-time reveal.

## 2. Repository facts

Baseline: `44335ad`, checked 2026-10-15 on the isolated runtime rebuilt from it.

- [`admin-dashboard.ts`](../../../../../app/actions/admin-dashboard.ts) computes revenue as enrollment count × current course price, builds the monthly series from fixed shares of that total (`mockRevenueTrends`), labels the `user_flashcards` row count as reviews, maps a missing email to `no-email@vocaspace.com`, and shows the course's current price per enrollment — justifies AC3, AC4, AC8.
- `app/admin/_components/stats-cards.tsx` (removed by this unit, so no longer linked) hard-codes the trend strings "+12.5% so với tháng trước", "+120 học viên mới tuần này", "Bao gồm 142 bài học (Topics)" and "Độ ổn định (Stability) trung bình: 85%" — justifies AC11.
- `supabase/config.toml` sets `max_rows = 1000`; the action reads every active profile's role and every course with its enrollment ids as row lists — justifies AC9 and G1.
- `payments` has `status` (`creating`, `pending`, `paid`, `failed`, `expired`, `cancelled`), `amount_final`, `currency` (default `VND`), `created_at` and `updated_at`, and no `paid_at`. A `BEFORE UPDATE` trigger (`set_updated_at_payments`) sets `updated_at`, and `payments_user_id_fkey` is `ON DELETE SET NULL`, while `admin_delete_learner` deletes a learner who has paid rows; so `updated_at` of a paid row can move to the deletion time. A checkout order expires after 15 minutes (`PAYMENT_TIMEOUT_MS` in `app/actions/payment.ts`). A free enrollment inserts a `paid` row with amount 0 — justifies AC3, AC4, G5 and the `created_at` decision.
- On the rebuilt runtime, `payments` has `Staff can view course payments` (`is_admin()` or course owner/co-owner); `enrollments` and `user_flashcards` have `Active Admin Select` policies; `is_admin()` checks `removed_at is null` (AD7) — justifies `SECURITY INVOKER` in G2.
- [`a5-admin-reads-and-profile-owner.test.ts`](../../../../../__tests__/integration/a5-admin-reads-and-profile-owner.test.ts) asserts that the flashcard metric equals the count of all `user_flashcards` rows and that a removed learner's enrollment still counts and shows as a missing learner — constrains AC3, AC7, AC8.
- The accepted [Admin design](../../../../ui-design-system-and-review/screen-types/admin-business-operations.md) section 14 defines the dashboard regions, the revenue card views and the share bars; section 21 reports the current trend strings, purple area chart and inert "Theo tuần" select as defects — justifies AC1, AC5, AC6, AC11.
- [`/privacy`](../../../../../app/(client)/privacy/page.tsx) already discloses payment data; AD4 adds only aggregates and keeps the existing recent-enrollment fields, so no new user-data read path is added.

## 3. Bounded implementation hypotheses

- Migration `supabase/migrations/<timestamp>_ad4_admin_dashboard_summary.sql` with `public.admin_dashboard_summary()` returning one `jsonb` object (pending count and oldest `submitted_at`, role counts, published course count, flashcard count, six revenue buckets, top five courses). Name and shape may change while G1, G2, G4 and G5 hold.
- `getAdminDashboardData` keeps its `{ data?, error? }` result: active-admin check, RPC call, five-row enrollment read, email lookup, then `adminDashboardSchema.safeParse`. The schema in `lib/schemas/admin-dashboard.ts` changes to the new shape (`studentEmail` nullable, no `price`, revenue months, pending block).
- Components under `app/admin/_components/` are replaced: a needs-attention panel, a metric band, a revenue card with the three views (a small client component holding the view state), share bars for composition and top courses, and the recent-enrollment list. The reveal uses CSS only; no new package.
- Relative time and money formatting stay in the action or a local formatter; exact placement may change.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | The summary RPC returns correct aggregates to an active admin and refuses everyone else. | Isolated rebuild (`db reset` on `.e2e-runtime`); new `ad4-admin-dashboard-summary.test.ts`: denied for anon, student, teacher and removed admin with a valid session; month buckets around a Vietnam month edge; excluded statuses and currency; zero months; more than 1000 counted rows; top-course ranking and ties; pending count and oldest wait. Totals are asserted against service-role readback of the same definitions, not absolute numbers, because other suites share the database. Fixtures INSERT `paid` rows with an explicit `created_at` computed from the current Vietnam month, so month-edge rows stay inside the six-month window. The suite uses `resolveLocalDatabasePort` (both known runtimes) and no isolated-target guard, so CI runs it by auto-discovery in the root integration job; `ci.yml` does not change. Existing A5, AD2, AD3, AD7 suites still pass. |
| CP2 | The action returns the new contract from real data with the existing safety order. | `__tests__/actions/admin-dashboard.test.ts` rewritten for the new shape: admin success, non-admin and removed admin refused before RPC and email read, RPC error, schema failure, missing learner with null email; A5 integration updated to the new fields. |
| CP3 | `/admin` renders section 14 from the action data, with no fabricated text. | Component tests: panel with and without pending courses, metric basis lines, the view switch (default, click, arrow keys, constant height, table values), share bars, missing-learner row, error state. Focused lint and `npx tsc --noEmit`. |
| CP4 | The unit is verified end to end and the docs are true. | Browser QA on the isolated runtime at 1440, 375 and 320 px; `npm run test:ci`; integration run; `npm run build`; `npm run docs:check`; `git diff --check`; progress and problems updated. |

### 4.1 Manual QA and fixture readiness

Fixture outcome: canonical seed plus a narrow fixture. The local seed has one paid and four unpaid payments, nine enrollments and no pending course. The QA fixture adds, on the isolated runtime only, paid payments in at least three of the six months (one at a Vietnam month edge), one pending course, and one removed learner with an enrollment; it removes only its own rows after QA, including after a failure.

| State | Check |
| --- | --- |
| Pending course present / absent | Amber panel with count, wait and link / neutral "no course waiting" text |
| Revenue in some months, zero in others | Six months shown, zeros visible, values match the fixture; "Xu hướng" default; switching views keeps the card height; arrow keys move the tooltip and a screen reader hears the same text; "Bảng" lists the same values |
| Removed learner in recent enrollments | Missing-learner label, no email |
| Narrow widths 375 and 320 px | One column, no sideways scroll, 44 px targets on the view switch |
| Reduced motion | No reveal animation; values visible at once |

The Owner reviews the running screen before merge, as the Admin design requires.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| An order created in the last 15 minutes of a month and paid in the next counts in the earlier month. | Accepted by the Owner (2026-10-15) as the cost of a time that never changes; the basis line says "theo thời điểm tạo đơn". |
| Hosted has non-VND paid rows, which G5 would silently drop. | Rollout step 2 checks it read-only; stop and ask the Owner if any exist. |
| RLS hides rows from the invoker RPC and totals come out low. | Integration tests compare RPC totals with service-role counts over the same fixture. |
| The redesign drifts from section 14. | Component tests for the binding behaviors; browser QA; the Owner reviews the running screen. |

- Rollout runbook (each step needs its Owner grant): 1. CI green on the PR. 2. Read-only on hosted: list paid payments by currency, and current function names to avoid a clash. 3. `supabase db push` of the AD4 migration. 4. Read-only verification: migration listed; function exists and is `SECURITY INVOKER`; `EXECUTE` held by `authenticated` only; called with no session it is refused. 5. Merge; deploy check of `/admin` by the Owner. Root migration only when the Owner asks.
- Stop when: a metric definition cannot be met by the data (for example non-VND paid rows), RLS prevents a correct invoker total, section 14 conflicts with the data available, or the next action lacks a grant.
- Rollback: the RPC is additive and read-only; reverting the app leaves it unused and harmless. Drop it with a new migration only if needed. No data is changed.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
