# FEAT6 detail plan — Payment history in the profile and a compact pending reminder

Revision: r2, 2026-10-20. Codex CLI `gpt-6.1-sol` / `high` plan review PASS at round 2 (r1 findings applied). Owner approval: 2026-10-20, implementation by one `sonnet-high-implementor` session with local commits. Product decisions: Owner-confirmed 2026-10-20 (§1.4). Source: [FEAT-006](../../future-features.md), [FUTURE-PAYMENT-001](../../problems.md#future-payment-001). Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a signed-in learner sees all of their own paid transactions (paid, pending, cancelled, expired, failed) in `/profile`, filtered and paged. The `/learn` pending-payment block becomes a compact card that matches the dashboard and links to that history. Payment creation, webhook, expiry and grading stay as they are.

| ID | Observable result |
| --- | --- |
| AC1 | From `lg` (1024 px) up, `/profile` uses two columns at about 40/60. The left column is today's profile card with its `Hồ sơ cá nhân` and `Bảo mật` tabs, unchanged in behaviour. The right column is a `Lịch sử thanh toán` section. |
| AC2 | Below `lg`, the profile card gets a third tab, `Thanh toán`, that shows the same history section; there is no right column. `/profile?tab=payments` opens that tab below `lg`. From `lg` up the param is ignored, because the history is always visible, and the left card opens on `Hồ sơ cá nhân`. |
| AC3 | The history lists the learner's own payments whose `gateway` is not `free`, newest first (`created_at desc, id desc`). Each row shows: the course title, linking to `/courses/[course-slug]`; `amount_final` in VND, plus a `Giảm X ₫` line when `amount_discount > 0`; a status badge; the creation date and time (`dd/mm/yyyy HH:mm`, `Asia/Ho_Chi_Minh`); and the order code (`gateway_order_id`). Status labels: `paid` is `Đã thanh toán`, `pending` is `Đang chờ thanh toán`, `creating` is `Đang tạo thanh toán`, `cancelled` is `Đã hủy`, `expired` is `Hết hạn`, `failed` is `Thất bại`. A `creating` or `pending` row whose `expires_at` is in the future also shows `Hạn dd/mm/yyyy` and a `Tiếp tục thanh toán` link to `/courses/[course-slug]` (Decision 17). If the course can no longer be read, the row shows `Khóa học không còn khả dụng`, with no link and no continue link. |
| AC4 | Filter chips above the list: `Tất cả`, `Đã thanh toán` (`paid`), `Đang chờ` (`creating`, `pending`) and `Khác` (`cancelled`, `expired`, `failed`). Changing the filter returns to page 1. |
| AC5 | Pages hold 5 rows (changed from 10 during Owner QA, 2026-10-20). `Trước` and `Sau` buttons sit around `Trang n/m`; `Trước` is disabled on page 1 and `Sau` on the last page, and the pager is hidden when the current filter has 5 rows or fewer. The server reads only the rows of the requested page plus an exact count. A page past the end (rows changed since the count) returns the last existing page with its real page number, so the UI never shows `n > m` or `m = 0`. Changing page or filter does not reload the whole page, and the list keeps its previous rows visible until the new page arrives. Only the response for the current filter and page updates the list; a slower earlier response is ignored. |
| AC6 | Empty states: there are no paid transactions at all (`Bạn chưa có giao dịch thanh toán nào.`), or the current filter has none. A failed read shows a quiet unavailable state with `Thử lại`; the profile card keeps working. |
| AC7 | A learner can never see another user's payments, and the history response never contains `gateway_metadata`, `discount_id`, `user_id` or any gateway transaction data. |
| AC8 | On `/learn`, the pending block becomes one compact white card in the dashboard card style (the streak card's border, radius and type scale). It shows only the visible (not dismissed) payment with the nearest `expires_at`, ties broken by newest `created_at`; payments with no `expires_at` (the column is nullable) come after all dated ones and still show when they are the only ones left. The card has: a small attention dot, the course title on one line, `Hạn dd/mm/yyyy` (omitted when `expires_at` is null), a text link `Tiếp tục thanh toán` to `/courses/[course-slug]`, and the existing `X` dismiss. When more visible payments exist, a line `+N khoản khác · Xem trong hồ sơ` links to `/profile?tab=payments`. The `Xem tất cả` sheet is removed. Dismissing hides the shown payment for the session (existing sessionStorage rule, Decision 18) and the next one takes its place. The card is absent when nothing is visible. Solid filled buttons are not used in this card. |

### 1.2 Scope and non-goals

- In scope:
  - the history server action and its Zod input and output;
  - the profile layout and the history component;
  - the `/learn` compact card;
  - tests;
  - the local QA fixture `scripts/dev/feat6-payment-history-qa.sql` (§4);
  - docs: Decision 43, the unit row, progress State and milestones, FEAT-006 status and FUTURE-PAYMENT-001;
  - folded in by Owner request: the FEAT3 rollout record (merged PR 168 `93ce589`, hosted migration `20261019090000`, production deployed 2026-10-19), and closing FEAT-012 and FEAT-003 in future-features.
- Non-goals:
  - any DB change, migration, RLS or grant change;
  - cancel, refund, retry or invoice actions;
  - changes to checkout, the webhook, expiry, or the course-page payment modal;
  - showing free enrolments;
  - the adjacent defects in §2 (reported separately);
  - an admin payment view.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The history reads through the user's session client, so the existing own-row RLS policy applies, with an explicit `user_id = auth user` filter as well. No service-role read. | A service-role read with a wrong filter shows other users' payments (AC7). |
| G2. The select lists only the columns the DTO needs (no `gateway_metadata`), and the strict Zod output schema rejects extra fields. | PayOS checkout and transaction data leak into the client (AC7). |
| G3. Paging uses `range` on the server with `count: 'exact'` and a stable order (`created_at desc, id desc`). The page input is a positive integer and the filter is a closed enum, both checked by Zod. PostgREST answers an offset past the end with `416`/`PGRST103`, so the action handles that one error by re-reading the count and returning the last existing page (page 1 with no rows when the total is 0); any other error stays an error. | Unbounded reads, duplicate or skipped rows across pages, arbitrary filter values reaching the query, or a past-the-end page shown as a failure or as `Trang 3/2`. |
| G4. One history instance is mounted at a time: in the right column from `lg` up, or in the `Thanh toán` tab below `lg`. The existing `useMediaQuery` pattern (`LearnDashboardClient.tsx:57`) returns `false` during SSR and hydration, so the history mounts, and reads, only after the client breakpoint is known; until then its slot shows a skeleton. A resize across `lg` remounts it in the other place and may read once more. | A desktop load with `?tab=payments` mounts the list in the phone tab and then in the right column, reading twice; or two lists drift apart on resize. |
| G6. The list applies a response only when it belongs to the latest request (filter and page); earlier responses are dropped. | Fast chip or page changes let a slow earlier response overwrite the newer list, so chips, page number and rows disagree. |
| G5. `/learn` keeps its existing pending read (`learn-dashboard.ts:72-90`) and dismiss storage. Only the presentation and the nearest-deadline choice change. | The dashboard read or dismiss contract (B2, Decisions 17-18) drifts. |

### 1.4 Owner decisions that bind this unit (2026-10-20)

- History lives in `/profile`: about 40/60 columns on desktop, and a third `Thanh toán` tab on phone.
- 5 rows per page with `Trước`/`Sau` (changed from 10 during Owner QA on 2026-10-20: the list on `/profile` was too long and needed scrolling); full row content plus status filter chips.
- Free enrolments are not shown.
- `/learn` shows one compact card (nearest deadline) with `+N khoản khác · Xem trong hồ sơ`; the `X` stays; the sheet goes.
- Overdue display needs no special rule: hosted `pg_cron` job `expire-stale-payments-every-5-minutes` runs `expire_stale_payments(100)` every 5 minutes (checked 2026-10-20), so the DB status is shown as is.
- Owner allows layout and styling to be refined during QA.

## 2. Repository facts

Baseline: `93ce589`, checked 2026-10-20.

- `public.payments` columns are `amount_original`, `amount_discount`, `amount_final`, `currency`, `status` (`payment_status` enum: creating, pending, paid, failed, expired, cancelled), `gateway`, `gateway_order_id`, `gateway_metadata`, `created_at` and `expires_at` (`supabase/migrations/20260609114505_remote_schema.sql:85-94`, `:823-845`). This justifies AC3 and AC4.
- RLS `"Users can view their own payments"` is `FOR SELECT TO authenticated USING (auth.uid() = user_id)` (`remote_schema.sql:1629`). The index is `payments_user_id_idx (user_id)` (`:1211`). This justifies G1 and the no-migration scope. Assumption, not measured: one learner has few payments, so sorting their rows needs no new index; revisit only with performance evidence.
- Free enrolments insert a `paid` row with `gateway = 'free'` (`app/actions/payment.ts:124-151`); PayOS rows use `gateway = 'payos'` (`:245`). This justifies the AC3 filter.
- Courses are readable through `can_view_course_basic(id)` (`remote_schema.sql:1537`), so a payment's course join can come back empty. This justifies the AC3 fallback.
- `/profile` is a single `max-w-3xl` column (`app/(client)/profile/page.tsx:6`). `ProfileSidebar` holds local tab state `"profile" | "security"` (`profile-sidebar.tsx:15`, `:138-174`) and loads the profile with `getUserProfile` (`app/actions/profile.ts:24-63`). Middleware protects `/profile` (`utils/supabase/middleware.ts:9-10`). This justifies AC1 and AC2.
- The `/learn` pending block is `PendingPaymentPreview` plus a `Sheet` with `PendingPaymentsPanel` (`LearnDashboardClient.tsx:403-436`, `PendingPayments.tsx`). Its preview limit is 3 on desktop and 1 otherwise (`learning-dashboard-state.ts:44-46`). Dismiss uses sessionStorage `vocaspace:learn-dashboard:dismissed-payments` (`LearnDashboardClient.tsx:48`, `:486-511`). The read covers `creating` and `pending` rows, newest first (`app/actions/learn-dashboard.ts:72-90`). This justifies AC8 and G5.
- The privacy page already discloses order code, course, amount, coupon used and payment status (`app/(client)/privacy/page.tsx:42-44`). The new read shows a learner only their own rows, so no `/privacy` change is needed (AGENTS.md user-data rule).
- Adjacent defects, out of scope and reported separately:
  - the lazy expiry in `createCheckoutSession` skips `creating` rows (`payment.ts:24-60`), and the resume lookup matches only `pending` (`:153-183`);
  - `anon` holds `ALL` on `payments` (RLS still blocks it), and `expire_stale_payments` is executable by `anon` (`remote_schema.sql:1910-1912`, `:2042-2044`).

## 3. Bounded implementation hypotheses

- A server action `getPaymentHistory(input)` takes Zod input `{ page: int ≥ 1, filter: 'all' | 'paid' | 'pending' | 'other' }` and returns `{ items, total, page, pageSize }`. Each item has `paymentId`, `status`, `amountOriginal`, `amountDiscount`, `amountFinal`, `currency`, `orderCode`, `createdAt`, `expiresAt` and `course: { slug, title } | null`. The schema lives with the other payment schemas (`lib/schemas/payment*.ts`). Any equivalent shape is allowed if AC3-AC7 hold.
- A client `PaymentHistory` component owns the filter, the page and the request state. It is rendered by a profile layout component that applies G4.
- The `/learn` card replaces `PendingPaymentPreview`, `PendingPaymentsPanel` and their `Sheet`. The nearest-deadline choice is a pure helper next to `getVisiblePendingPayments` (`lib/learn-dashboard.ts:302-316`).

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | History action, `PaymentHistory`, profile layout (AC1-AC7) | Action tests: auth required; Zod rejects bad page or filter; filter-to-status mapping; free rows excluded; `range` and count per page; the `PGRST103` past-the-end path returns the last page; selected columns exclude `gateway_metadata`; null course. Component tests: labels and badges for all six statuses; discount line; continue link only for future-dated pending rows; chips reset to page 1; `Trước`/`Sau` disabled states and the hidden pager; empty and unavailable states with `Thử lại`; two requests resolving in reverse order leave the newer result (G6). Profile tests: two columns at `lg`, third tab below `lg`, `?tab=payments`; a desktop hydration with `?tab=payments` reads exactly once; a resize across 1023/1024 px keeps one instance (G4). An integration test on the isolated runtime: learner A cannot read learner B's rows through the action, free rows are excluded, and a past-the-end page returns the last page. The QA fixture below. |
| CP2 | `/learn` compact card (AC8) and docs | Component tests: the nearest-deadline choice, tie-break, and null `expires_at` ordering (mixed and all-null lists); `+N` link target; dismiss shows the next payment; card absent when nothing is visible; no sheet. Update the existing learn-dashboard tests that assert the preview of 3 and the sheet. Then `npx tsc --noEmit --incremental false`, lint on changed paths, `npm run docs:check`, `git diff --check`, and Owner manual QA on local. |

### QA fixture readiness

- Account: `student@gmail.com` (`33333333-3333-4333-8333-333333333333`, `supabase/seed.sql:31-35`), which already has the 5 B2 QA payments (`seed.sql:1528-1630`, all with `amount_discount = 0`).
- CP1 adds `scripts/dev/feat6-payment-history-qa.sql`: local-only, not part of the seed, safe to rerun (fixed ids, `on conflict (id) do nothing`), and placing active rows only on courses where this user has no active payment, to respect `uq_active_payment`. It inserts for this user:
  - 8 terminal rows across `paid`, `cancelled`, `expired` and `failed`, two of them with a discount;
  - one `paid` free enrolment (`gateway = 'free'`);
  - one row on a course this learner cannot read (unpublished, not enrolled);
  - two active rows with the same `expires_at`;
  - one active row with a null `expires_at`.
  That gives more than 5 non-free rows (17 with the seed rows), so the `Tất cả` list has four pages. The implementor applies it to the local root DB with `psql` (never a reset) and records it in progress.md. Never reset the root or hosted DB.
- Owner QA steps:

| Step | Expected |
| --- | --- |
| Open `/profile` at desktop width | Two columns; history shows 5 rows newest first and `Trang 1/4`; the free enrolment is absent (AC1, AC3, AC5). |
| Look at a discounted row and the unreadable-course row | A `Giảm X ₫` line; `Khóa học không còn khả dụng` with no links (AC3). |
| Click `Đang chờ`, then `Khác` | Rows match the status group, back on page 1; the pager hides at 5 rows or fewer (AC4, AC5). |
| Click `Sau`, then `Trước` quickly | The list ends on the page shown in `Trang n/m` (AC5). |
| Narrow to phone width; open `/profile?tab=payments` | The `Thanh toán` tab is selected and shows the same history (AC2). |
| Open `/learn` | One compact card for the nearest deadline (of the tie, the newer one) and `+N khoản khác · Xem trong hồ sơ` (AC8). |
| Dismiss with `X` until nothing is left, reloading once in the same tab | The next payment takes its place each time; the null-deadline payment comes last with no `Hạn` line; dismissed ones stay hidden after reload (AC8). |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Other users' or gateway data leaks | G1, G2; integration test plus strict-schema test. |
| The layout breaks at mid widths | One breakpoint (`lg`), G4; Owner QA at phone, tablet and desktop. |
| A late or past-the-end response shows the wrong page | G3, G6; tests for reverse-order responses and `PGRST103`. |
| The /learn change drops a payment from view | The `+N` count comes from the same visible list; the history shows every pending row regardless of dismissal. |

- Rollout: Owner plan approval; implementation with local commits; Codex implementation review; Owner QA on local; then push/PR/CI, merge and deploy, each separately granted. No migration.
- Stop when: the history needs a DB change, or AC7 cannot hold with the session client.
- Rollback: revert the app commit; no data or schema change to undo.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
