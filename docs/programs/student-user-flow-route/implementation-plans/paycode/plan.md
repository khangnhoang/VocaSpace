# PAYCODE detail plan — PayOS order codes from the database sequence

Revision: r3, 2026-10-21. r3 applies the Codex round-2 finding: the sequence gets `maxvalue 9999999999999 no cycle`, so the RPC itself fails when the 13-digit range is used up and checkout takes the AC5 path. r2 applied the Codex round-1 findings: the hosted check reads `last_value` and `is_called`, the migration checks all stored digit codes and the sequence itself and aborts outside the supported range, AC5 covers only this checkout's reservation, and CP1 adds a migration scenario check on the isolated runtime. Owner approval: 2026-10-21 (r3), implementation in a Sonnet session. Owner decisions: 2026-10-21 (§1.4). Source: PAYGRANT handoff and [PAYGRANT plan](../paygrant/plan.md) §1.2 (missing `get_next_sequence_value`). Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: every new PayOS checkout takes its order code from `public.payos_order_code_seq` through a service-role-only RPC. When the code cannot be obtained, checkout fails visibly with a safe message and a server log instead of falling back to `Date.now()`. New codes never collide with codes already stored or with `Date.now()` codes that the old deployment may still create until the new code is deployed.

| ID | Observable result |
| --- | --- |
| AC1 | A new RPC returns the next value of `public.payos_order_code_seq` and nothing else: it takes no sequence name or other argument. While codes remain, two calls by `service_role` return two strictly increasing 13-digit integers from `9000000000000` to `9999999999999` (below `Number.MAX_SAFE_INTEGER`). The sequence has `maxvalue 9999999999999` and `no cycle`, so after `9999999999999` the RPC returns an error instead of a 14-digit or repeated code. |
| AC2 | `service_role` holds EXECUTE on the RPC; `anon`, `authenticated` and `PUBLIC` do not. Through the Data API, `anon` and a signed-in learner calling it get error `42501`. The sequence grants from PAYGRANT AC3 are unchanged. |
| AC3 | After the migration, the sequence's next value is greater than every all-digit `gateway_order_id` of gateway `payos` already in `payments` (of any length, compared without overflow), greater than the sequence's previous value, and at least `9000000000000`. Rows of other gateways and non-digit codes are ignored. When that next value would exceed `9999999999999`, the migration raises an exception and changes nothing. |
| AC4 | `createCheckoutSession` for a paid course calls the new RPC and uses its value as `gateway_order_id`, PayOS `orderCode`, the `VOCASPACE <code>` description and `gateway_metadata.payos_order_code`. |
| AC5 | When the RPC returns an error, or a value that is not a positive safe integer, `createCheckoutSession` returns `{ error }` with a stable safe Vietnamese message that carries no database detail, logs the failure server-side with `console.error`, and for this checkout does not insert a payment, does not reserve the requested coupon's discount and does not call PayOS. The existing cleanup of this learner's expired pending payments for the course, which runs before and may release their reservations, stays as it is. `Date.now()` is no longer used for PayOS order codes. |
| AC6 | Existing payment behavior is unchanged: free enrolment (its `FREE-<ms>` code is not a PayOS code), resuming a pending payment, the webhook lookup by `gateway` and `gateway_order_id`, payment history and the existing payment suites. |
| AC7 | Program docs record PAYGRANT as merged and deployed (PR 170, `8696f64`, `main` CI run `39490209356`, production deploy `dpl_DZYfu6Wh6UWmaCymmZC5x581sKeg` READY, hosted migration `20261021090000` applied before merge), replace `(this commit)` in the 2026-10-21 PAYGRANT milestone with `4cfd08a`, add Decision 45 and the PAYCODE unit row, and `npm run docs:check` passes. |
| AC8 | After an Owner-granted hosted apply, a read-only catalog check on hosted shows the RPC with the AC2 privileges and the sequence with `is_called = true` and `last_value >= 8999999999999`, so its next value is at least `9000000000000`. The check does not call the RPC. |

### 1.2 Scope and non-goals

- In scope:
  - one new migration (RPC, privileges, `setval`) and its rollback file in `supabase/rollbacks/`;
  - the order-code step of `createCheckoutSession` in `app/actions/payment.ts`;
  - integration coverage in `__tests__/integration/payment-privileges.test.ts` and action coverage in `__tests__/actions/payment.test.ts`;
  - docs: this plan, Decision 45, the unit row, progress State and milestones including the PAYGRANT backlog in AC7.
- Non-goals:
  - PAYMENT-LATE-001 (status-guarded checkout transitions): stays open for a later unit (Owner, 2026-10-21);
  - the free-enrolment `FREE-<ms>` code and the misleading `23505` message after a `payments` insert;
  - any change to `handle_payment_success`, the webhook, the cron route, RLS or the PAYGRANT grants;
  - checking production data for past abuse of `handle_payment_success`, and the Owner's PAYGRANT smoke test (both Owner actions, recorded in State when reported).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The RPC hard-codes `public.payos_order_code_seq`; it accepts no sequence name. | A caller with EXECUTE could advance or read any sequence in the database. |
| G2. Revoke EXECUTE from `PUBLIC`, `anon` and `authenticated` explicitly. | `ALTER DEFAULT PRIVILEGES` grants every new `public` function to `anon` and `authenticated` (§2), so anyone with the anon key could burn order codes. |
| G3. The `setval` floor is above any `Date.now()` value until long after the hosted apply (next value `9000000000000`), not only above the stored maximum; the migration compares stored codes as `numeric` and aborts when the target leaves the 13-digit range. | Between the hosted apply and the deploy, the old code keeps inserting `Date.now()` codes; a sequence starting at the stored maximum would walk into that range and hit the unique index `payments_gateway_order_idx`. |
| G4. Hosted apply before deploy. | With AC5, a deploy without the RPC makes every paid checkout fail. |
| G5. Add a new migration; do not edit published migrations. | Hosted history diverges from the repository. |
| G6. No hosted migration, hosted data read, commit, push, PR, merge or deploy without a separate Owner grant. | Production changes without authority. |

### 1.4 Owner decisions that bind this unit

- 2026-10-21: when the order code cannot be obtained, checkout returns an error and logs it; no `Date.now()` fallback.
- 2026-10-21: the migration raises the sequence above the existing codes. G3 sets the floor so it also stays clear of `Date.now()` codes created before the deploy; new codes stay 13 digits, the same length as today.
- 2026-10-21: PAYMENT-LATE-001 is not folded into this unit.
- 2026-10-21: work on a branch with the repository prefix (`fix/payos-order-code-rpc`) instead of the `claude/` branch.
- Recorded as Decision 45 in the master plan.

## 2. Repository facts

Baseline: `69cd6bb`, checked 2026-10-21.

- `createCheckoutSession` reserves the discount (`app/actions/payment.ts:215-239`), then calls `supabaseAdmin.rpc("get_next_sequence_value", { seq_name: "payos_order_code_seq" })` and uses `Date.now().toString()` on any error, without logging (`:241-246`). The code becomes `gateway_order_id` (`:265`), PayOS `orderCode: Number(...)` and the description `VOCASPACE <code>` (`:291-293`), and `gateway_metadata.payos_order_code` (`:317`). Justifies AC4, AC5.
- `get_next_sequence_value` exists nowhere in `supabase/migrations/` or `supabase/seed.sql`, and not on hosted (PAYGRANT §2). Every checkout in production uses `Date.now()`. Justifies the unit.
- `payos_order_code_seq` starts at `100000` (`20260609114505_remote_schema.sql:848-853`). After PAYGRANT only `service_role` and `postgres` hold privileges on it (`20261021090000_paygrant_payment_privileges.sql:15`); `service_role` keeps `USAGE`, `SELECT`, `UPDATE` (`payment-privileges.test.ts:212-224`). Justifies AC1, AC2.
- `payments_gateway_order_idx` is unique on `(gateway, gateway_order_id)` (`remote_schema.sql:1207`); the webhook passes `String(orderCode)` as `p_gateway_order_id` (`app/api/webhook/payos/route.ts:85`). A collision fails the insert with `23505`, which today returns the "being processed" message (`payment.ts:277-282`). Justifies AC3, G3.
- Default privileges grant every new `public` function to `anon` and `authenticated` (`remote_schema.sql:2124-2127`). Justifies G2.
- The PayOS SDK types `orderCode` as `number` (`@payos/node` `CreatePaymentLinkRequest`); a value above `Number.MAX_SAFE_INTEGER` would lose precision in `Number(...)`. Justifies the AC1 upper bound.
- Seed payments use gateway `local-seed`, not `payos` (`supabase/seed.sql:1530-1560`). `createCheckoutSession` runs `expireStalePendingPayments`, which may release expired payments' reservations, before any course or discount step (`payment.ts:120`, `:52-60`). The action test mocks `adminRpc` with `{ data: 12345 }` for every case (`__tests__/actions/payment.test.ts:135`). `payment-privileges.test.ts` already holds the payment catalog sweep and runs on the root runtime and in the CI root job (PAYGRANT §2). Justifies the test placement.

## 3. Bounded implementation hypotheses

- Migration `supabase/migrations/<timestamp>_paycode_payos_order_code.sql`:
  - `create function public.next_payos_order_code() returns bigint language sql volatile security invoker set search_path = '' as $$ select nextval('public.payos_order_code_seq') $$;` (invoker works because `service_role` holds `USAGE` on the sequence);
  - `revoke all on function ... from public, anon, authenticated; grant execute ... to service_role;`
  - `alter sequence public.payos_order_code_seq maxvalue 9999999999999 no cycle`;
  - a `do` block: target = `greatest(<last_value, minus 1 when not is_called>, <max(gateway_order_id::numeric) over gateway 'payos' and gateway_order_id ~ '^[0-9]+$'>, 8999999999999)`; `raise exception` when target `>= 9999999999999`; otherwise `setval('public.payos_order_code_seq', target, true)`. A failed migration rolls back as one transaction;
  - a short Vietnamese comment on G1-G3.

  Rollback drops the function and restores `no maxvalue`; it does not lower the sequence. Another name or `SECURITY DEFINER` with `search_path = ''` may replace this if AC1-AC3 and G1-G2 hold.
- Action: request the code before `resolveDiscountPricing` so a failure needs no discount release; check `Number.isSafeInteger(value) && value > 0`; on failure `console.error("🚨 [CHECKOUT_ORDER_CODE_FAILED]:", error)` and return the existing `"Hệ thống gặp sự cố ngoài dự kiến."`. Moving the call may leave sequence gaps when a later step fails; gaps are harmless.
- Tests:
  - integration: add the RPC to the catalog sweep, a `service_role` call twice (increasing, in range), and `anon`/learner calls returning `42501`;
  - migration scenarios (AC3), a `psql` script run on the isolated runtime reset to `20261021090000`, each scenario inside `begin; <fixture>; \i <migration>; <assert>; rollback;`: (a) no `payos` rows, next value `9000000000000`; (b) mixed rows (a `payos` code `9000000000123`, a `payos` non-digit code, a 20-digit code of another gateway), next value `9000000000124`; (c) sequence already at `9000000000500` with lower data, next value `9000000000501` (not lowered); (d) a `payos` all-digit code of 20 digits, the migration raises and the sequence is unchanged; (e) the rollback file after the migration drops the function and leaves the sequence value where it was; (f) after `setval(..., 9999999999998)`, one `nextval` returns `9999999999999` and the next raises `2200H`. `setval` and `nextval` are not undone by `rollback`, so every scenario sets the sequence explicitly first and catches its expected error before asserting, and the full reset that follows restores a clean state;
  - action: assert the RPC name and that the code reaches the insert and PayOS; with a valid coupon, RPC error and non-integer data each return the safe error with no insert, no `reserveDiscountUsage` call, no PayOS call and one `console.error`, while `expireStalePendingPayments` still ran.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP0 | This plan, Decision 45, unit row, progress State and the PAYGRANT backlog (AC7) | `npm run docs:check`; Codex plan review to PASS; Owner approval |
| CP1 | AC1-AC6: migration, rollback, action change, tests | Bash (Git Bash), in this order. Isolated runtime (API 45441): run `ci.yml:196-199` to prepare, start and write `.e2e-runtime/supabase.env`; `supabase --workdir .e2e-runtime db reset --version 20261021090000`; run the new integration cases with the inline isolated variables of the PAYGRANT plan §4 and see them fail (no RPC); run the migration scenario script (§3) and see every scenario pass; `supabase --workdir .e2e-runtime db reset` (full rebuild with the new migration) and rerun `payment-privileges.test.ts` there to pass. Root runtime (API 45321, `.env.test.local` from the main checkout if missing): `npx supabase migration up --local` (or `db reset` when the Owner allows losing local dev data), then `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/payment-privileges.test.ts __tests__/integration/payment-race.test.ts __tests__/integration/payment-discount-rpc.test.ts`. `npx vitest run __tests__/actions/payment.test.ts __tests__/actions/payment-resume.test.ts`; the new action cases fail before the action change. `npx tsc --noEmit --incremental false`, `npm run lint`, `git diff --check`. |
| Rollout | AC8, after Owner grants | Hosted apply (G4), then the read-only catalog check; push, PR, CI, merge and deploy each under its own grant; Owner smoke test: a paid checkout reaches the QR with a 13-digit code starting with `9`. Record in progress. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Local or staging uses the same PayOS merchant as production, so two databases issue the same code and PayOS rejects the second | Closed: the Owner confirmed on 2026-10-21 that local and staging use a different PayOS merchant from production |
| The deploy happens before the hosted apply | G4 and the runbook order; the Rollout CP checks the hosted catalog first |
| PayOS rejects a 13-digit code starting with `9` | Codes are already 13 digits today; the Owner smoke test after deploy confirms |
| PostgREST returns `bigint` as a JSON number | Values stay below `Number.MAX_SAFE_INTEGER` (AC1) and the action checks `Number.isSafeInteger` |

- Rollout runbook:
  1. After CP1 passes locally and the Owner approves, apply the migration to hosted under an Owner grant.
  2. Run the read-only catalog check (AC8).
  3. Push, open the PR and run CI.
  4. Merge and deploy under separate grants.
  5. Owner smoke test; record hosted state, merge, deploy and the smoke result in progress.
- Stop when: the hosted catalog already has a function with this name, the hosted apply fails on the AC3 range exception (report the stored maximum and the sequence state to the Owner), or a payment suite fails because of the change.
- Rollback: deploy the previous action first (it falls back to `Date.now()` again), then the rollback file drops the RPC. The sequence stays raised; that is harmless.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
