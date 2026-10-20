# PAYGRANT detail plan — Payment grant hardening and docs reconciliation

Revision: r3, 2026-10-21. r3 applies the Codex round-2 findings: explicit per-runtime environment, the new test on the root runtime and the CI root job, and the read-only public functions named. r2 applied the round-1 findings: the lazy `creating` expiry dropped under the Owner's cheap-only rule, two-runtime verification, the full AC1 matrix and separate exit conditions. Owner approval: 2026-10-21 (r3), implementation in the main session with the hosted apply after CP1. Owner decisions: 2026-10-21 (§1.4). Sources: [PAYMENT-GRANT-001 and PAYMENT-EXPIRY-001](../../problems.md). Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: only trusted server paths (`service_role`, and `postgres` for the hosted cron job) can run the payment RPCs or write the `payments` table and the order-code sequence. A learner can no longer mark their own order `paid` and get enrolled without paying. The learner-facing payment reads keep working. The program docs stop saying that FEAT6, TFEAT1 and LF6 are unmerged, and they record the Owner's closing decisions.

| ID | Observable result |
| --- | --- |
| AC1 | `anon`, `authenticated` and `PUBLIC` cannot EXECUTE `public.handle_payment_success(text, text, text)`, `public.reserve_discount_usage(uuid)` or `public.expire_stale_payments(integer)`. `service_role` keeps EXECUTE on all three. Through the Data API, for each caller in {anon, signed-in learner who owns the payment} and each payment status in {`creating`, `pending`}, on a real payment that holds a discount reservation, calling `handle_payment_success` with that payment's `gateway` and `gateway_order_id` returns error `42501`. After each call, the payment's status is unchanged, no enrollment row exists for that user and course, and the discount's `reserved_count` and `uses_count` are unchanged. The same callers get `42501` from `reserve_discount_usage` and `expire_stale_payments`, and the discount counters and payment statuses are unchanged. |
| AC2 | On table `public.payments`, `anon` holds no privilege. `authenticated` holds `SELECT` only (no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER`). `service_role` is unchanged. The two existing `SELECT` policies are unchanged. |
| AC3 | On sequence `public.payos_order_code_seq`, `anon` and `authenticated` hold no privilege. `service_role` is unchanged. |
| AC4 | These flows keep working, and their existing suites pass unchanged except for assertions that AC1-AC3 changes on purpose: checkout and resume (service role), the PayOS webhook RPC (service role), the cron route (service role), the learner payment history and the `/learn` pending card (session client `SELECT` under own-row RLS), the admin dashboard summary (`SECURITY INVOKER`, needs `authenticated` `SELECT`), and learner deletion. |
| AC5 | The program docs match Git and the Owner decisions. FEAT6 is recorded as merged and rolled out (PR 169, `c05080a`, hosted migration `20261020120000`). TFEAT1 (PR 166) and LF6 (PR 150) are recorded as merged. The history part of FUTURE-PAYMENT-001 is done. PERF-ACTION-001 is resolved by the Owner's acceptance. PAYMENT-EXPIRY-001 is resolved as cron-only cleanup by the Owner's cheap-only rule, with its wrong PayOS-failure claim corrected. The pre-existing late-checkout race (§2) is a new open entry. PAYMENT-GRANT-001 stays open until AC6 holds. `npm run docs:check` passes. |
| AC6 | After the Owner-granted hosted apply, a read-only catalog check on hosted returns the same privileges as AC1-AC3, and the cron job `expire-stale-payments-every-5-minutes` still runs as `postgres`. Only then is PAYMENT-GRANT-001 resolved. |

### 1.2 Scope and non-goals

- In scope:
  - one new migration that revokes privileges, plus its rollback file in `supabase/rollbacks/`;
  - an integration test for AC1-AC3, and updates to existing tests only where AC1-AC3 changes what they assert;
  - docs: Decision 44, the unit row, progress State and milestones, and the problems and future-features entries named in AC5, including TFEAT-001 in `docs/programs/teacher-workflow/future-features.md`.
- Non-goals:
  - any application code change, including the lazy expiry in `app/actions/payment.ts` (dropped, §1.4);
  - changing any function body or RLS policy;
  - fixing the late-checkout race (recorded only);
  - the missing `get_next_sequence_value` RPC (§2): checkout falls back to `Date.now()` order codes; report it separately;
  - the `ALTER DEFAULT PRIVILEGES` that grant new functions to `anon` by default (later migrations keep revoking per function, as in GRANT-001), and other baseline functions that keep `anon` EXECUTE;
  - checking production data for past abuse of `handle_payment_success` (Owner action, §5).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Keep `authenticated` `SELECT` on `payments`. | Payment history, the `/learn` pending card, the admin dashboard summary and the payment modal's Realtime subscription stop working. |
| G2. Do not revoke anything from `service_role` or `postgres`. | Checkout, the webhook, the cron route or the hosted `pg_cron` job (runs as `postgres`, §2) break, and payments stop being marked paid or expired. |
| G3. On the three functions, revoke from `PUBLIC` as well as from `anon` and `authenticated`. | Functions get EXECUTE through `PUBLIC` by default (§2), so revoking only the named roles leaves them callable. |
| G4. Add a new migration. Do not edit `20260609114505_remote_schema.sql`. | Hosted history diverges from the repository. |
| G5. Apply the migration to both local runtimes before running their suites (§4). | A suite runs against a database without the revoke and passes for the wrong reason. |
| G6. No hosted migration, data read on hosted tables, push, PR, merge or deploy without a separate Owner grant. | Production changes without authority. |

### 1.4 Owner decisions that bind this unit

- 2026-10-21: fix PAYMENT-GRANT-001 and reconcile the stale docs first. Fix PAYMENT-EXPIRY-001 only if cheap; otherwise leave the cleanup to the cron.
- 2026-10-21: fold `handle_payment_success`, `reserve_discount_usage` and `payos_order_code_seq` into the same unit and PR.
- 2026-10-21: close PERF-ACTION-001. The Owner accepts the measured level: card rating is optimistic since LF8, and answer latency stays as measured.
- Applying the cheap-only rule (r2): a safe lazy `creating` expiry needs status-guarded checkout updates and a release-once guarantee (§2), so it is not cheap. PAYMENT-EXPIRY-001 is closed as cron-only.
- Recorded as Decision 44 in the master plan.

## 2. Repository facts

Baseline: `c05080a`, checked 2026-10-21. Hosted catalog checked read-only on 2026-10-21 under Owner grant.

- `handle_payment_success` is `SECURITY DEFINER` with no caller check. It locks the row by `gateway` and `gateway_order_id`, sets `paid` from `creating` or `pending`, consumes the discount and inserts the enrollment (`20260609114505_remote_schema.sql:361-470`). EXECUTE is granted to `anon` and `authenticated` (`:1928-1929`). A learner sees their own order code in the PayOS QR and in FEAT6 history (`app/actions/payment-history.ts:201`). Justifies AC1.
- `expire_stale_payments` and `reserve_discount_usage` are `SECURITY DEFINER` and granted to `anon` and `authenticated` (`:1910-1911`, `:1967-1968`). `payments` has `GRANT ALL` to `anon` and `authenticated` (`:2042-2043`), and so does `payos_order_code_seq` (`:2048-2049`). No later migration revokes any of these. Justifies AC1-AC3.
- Hosted, 2026-10-21:
  - `anon`, `authenticated` and `PUBLIC` have EXECUTE on all three functions. `anon` and `authenticated` have every table privilege on `payments`, and `USAGE` and `UPDATE` on the sequence.
  - The cron job `expire-stale-payments-every-5-minutes` runs as `postgres`.
  - `get_next_sequence_value` does not exist on hosted or in the migrations.
  - Of the `public` `SECURITY DEFINER` functions that write `enrollments`, `payments` or `discounts`, only these three are executable by `anon` or `authenticated`. The public readers `get_public_course_catalog` and `get_public_course_detail` read `enrollments` without an `auth.uid()` check, but they write nothing, so they do not give the same bypass.
  - `enrollments` has no `INSERT` or `UPDATE` policy, and `discounts` writes are limited to admins and course owners or co-owners.
  - Justifies AC1-AC3, AC6 and G2.
- All application writes and RPC calls on these objects use a service-role client:
  - `app/actions/payment.ts:21`;
  - `app/api/webhook/payos/route.ts:7`;
  - `app/api/cron/expire-payments/route.ts:6`;
  - `lib/discounts/discount-pricing.ts:181`.

  Session-client reads are `app/actions/payment-history.ts:62`, `app/actions/learn-dashboard.ts:74`, `admin_dashboard_summary` (`20261015120000_ad4_admin_dashboard_summary.sql`) and Realtime in `PublicCoursePaymentModal.tsx:221-236`. Justifies AC4 and G1.
- Existing integration tests call `handle_payment_success` with the service-role client only (`payment-discount-rpc.test.ts:5`, `payment-race.test.ts:14`, `a5-learner-deletion.test.ts:255`). `payment-race` and `payment-discount-rpc` require the root runtime (API 45321, `payment-race.test.ts:28`). `feat6-payment-history` requires the isolated runtime (API 45441). `ad4-admin-dashboard-summary` has no port guard and is chosen for the isolated run. The CI root job collects every integration file not excluded at `ci.yml:174`, so a new file without a port guard runs there with no CI change. The isolated job is at `ci.yml:194-208`. `waitForLocalPostgresQuery` resolves the database port of the runtime under test (`helpers/local-postgres-coordination.ts:6`). `vitest.integration.config.ts:4` loads `.env.test.local` outside CI. That file exists only in the main checkout and points at 45321. `package.json` has no `typecheck` script. Justifies G5 and the CP1 commands.
- PAYMENT-EXPIRY-001 facts:
  - `expireStalePendingPayments` filters `status: "pending"` (`app/actions/payment.ts:36`, `:47`). `uq_active_payment` covers `creating` and `pending` (`remote_schema.sql:1215`), so a stuck `creating` row blocks a new checkout until the cron expires it.
  - A PayOS error marks the row `failed` (`payment.ts:299-302`). A `creating` row is stuck only when the process dies between insert and update, or when that unchecked `failed` update errors. `problems.md` wrongly says a PayOS failure leaves `creating`.
  - Checkout's later `pending` and `failed` updates match on the payment id only (`payment.ts:299-302`, `:322-329`). Today, when the cron expires a `creating` row whose PayOS call is still running, the row can come back as `pending`, or its discount can be released twice. Making a lazy expiry safe needs these updates guarded and release-once handling, so the fix is not cheap.
  - Justifies the §1.4 cheap-only outcome and the new open entry in AC5.

## 3. Bounded implementation hypotheses

- Migration `supabase/migrations/<timestamp>_paygrant_payment_privileges.sql`:
  - `revoke all ... from public, anon, authenticated` on the three functions;
  - `revoke all on table public.payments from anon`;
  - `revoke insert, update, delete, truncate, references, trigger on table public.payments from authenticated`;
  - `revoke all on sequence public.payos_order_code_seq from anon, authenticated`;
  - a Vietnamese comment on why `SELECT` stays and why `PUBLIC` is revoked.

  The rollback file restores the baseline grants. Any equivalent SQL may replace this if AC1-AC3 and G1-G3 hold.
- New integration file `__tests__/integration/payment-privileges.test.ts`. It gets no port guard beyond the local-URL check, so it runs on the root runtime locally and in the CI root job:
  - a catalog sweep with `has_function_privilege`, `has_table_privilege` and `has_sequence_privilege` for `anon`, `authenticated`, `public` and `service_role`, using the `waitForLocalPostgresQuery` pattern of `course-structure-ordering-rpc.test.ts`;
  - the AC1 matrix (anon and owner learner × `creating` and `pending`), with fixtures built by the service role: a course, a discount with a reservation, and payments with real order codes;
  - after each call, assert the `42501` code, the payment status, no enrollment row, and both discount counters.

  It may instead extend `payment-discount-rpc.test.ts` if that is smaller.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC1-AC4: migration, rollback and tests | Bash. Root runtime (API 45321): copy the main checkout's `.env.test.local` (root URL and keys, 45321) into the worktree if it is missing, then `npx supabase db reset`, then `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/payment-privileges.test.ts __tests__/integration/payment-race.test.ts __tests__/integration/payment-discount-rpc.test.ts __tests__/integration/a5-learner-deletion.test.ts`. Isolated runtime (API 45441): run `ci.yml:196-199` (prepare the workdir, start it, write `.e2e-runtime/supabase.env`), then `supabase --workdir .e2e-runtime db reset`, then `source .e2e-runtime/supabase.env` and run `ALLOW_DB_INTEGRATION_TESTS=true NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY:-$PUBLISHABLE_KEY}" SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-$SECRET_KEY}" E2E_SUPABASE_WORKDIR=.e2e-runtime npm run test:integration -- __tests__/integration/feat6-payment-history.test.ts __tests__/integration/ad4-admin-dashboard-summary.test.ts`. The inline variables win over `.env.test.local`, because dotenv does not override variables that are already set. The new test fails with the rollback applied and passes with the migration. Also run `npx vitest run __tests__/actions/payment.test.ts __tests__/actions/payment-resume.test.ts`, `npx tsc --noEmit --incremental false`, `npm run lint` and `git diff --check`. |
| CP2 | AC5 docs, in the same branch. State says the hosted apply is pending and PAYMENT-GRANT-001 stays open | `npm run docs:check`, and a manual read of each changed entry against Git. |
| Rollout | AC6, after an Owner grant | Apply the migration to hosted and rerun the read-only catalog check from §2. Merge and deploy need separate grants. Record the result in progress and resolve PAYMENT-GRANT-001. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| An app path relies on a revoked privilege that discovery missed | AC4 suites, and an Owner smoke test of checkout to the QR and of `/profile` history after the hosted apply |
| Realtime on `payments` needs more than `SELECT` | It needs only `SELECT` plus RLS. The modal also polls `checkPaymentStatus` (service role) every 10 s |
| `handle_payment_success` was already abused in production | Out of scope. The Owner can compare recent `paid` rows against PayOS transactions. A hosted data read needs its own grant |
| Order of hosted apply and deploy | No code depends on the revoked privileges, so either order is safe. Apply first to close the hole sooner |

- Rollout runbook:
  1. After local CP1 passes, apply the migration to hosted under an Owner grant, before merge, as FEAT6 did.
  2. Run the hosted read-only catalog check (AC6).
  3. Push, open the PR and run CI.
  4. Merge and deploy under separate grants.
  5. Record the hosted state, merge and deploy in progress, and resolve PAYMENT-GRANT-001.
- Stop when: an AC4 suite fails because of a revoke, the hosted catalog differs from §2 in a way the migration does not cover, or the cron job's role is not `postgres`.
- Rollback: `supabase/rollbacks/<timestamp>_paygrant_payment_privileges.down.sql` restores the baseline grants, which reopens the hole. Use it only when a production flow is broken and no forward fix is possible.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
