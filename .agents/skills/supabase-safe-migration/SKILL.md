---
name: supabase-safe-migration
description: Repository-specific workflow for Supabase/PostgreSQL changes, including migrations, tables, columns, constraints, indexes, RLS, RPC, triggers, SQL helpers, seed data, Storage policies, integration tests, race conditions, and database-dependent business behavior. Use before changing or relying on database behavior.
---

# Supabase Safe Migration

## Activation scope

Use this skill when a task touches:

* tables, columns, enums, constraints, or indexes
* migrations or schema drift
* RLS policies or permission helpers
* RPC functions, triggers, or SQL helpers
* seed data
* Supabase Storage policies
* database-backed integration tests
* race-condition-sensitive state
* Supabase CLI commands such as `db reset`, `db diff`, `db push`, or migration repair

Do not use it for pure UI work with no database dependency.

Database behavior changes must be represented by migrations, not ad hoc dashboard SQL.

Never push migrations or modify a remote database unless the user explicitly requests it.

## Related skills

Use:

* `nextjs-server-action-zod` when DB changes affect Server Actions, Route Handlers, RPC arguments, payloads, forms, schemas, or DTOs
* `test-quality-strategy` for database, RLS, RPC, migration, trigger, and concurrency coverage
* `code-commenting-and-maintainability` for non-obvious SQL and database-boundary comments
* `implementation-planning-and-pr-breakdown` for multi-step migration or dependency ordering
* `git-checkpoint-workflow` for local checkpoint commits

Read all relevant skills before editing.

## Core rules

* Read existing migrations, schema objects, policies, helpers, triggers, RPCs, tests, seed data, and call sites first.
* Make the smallest focused database change.
* Create a new migration unless the user explicitly asks to amend unpublished local work.
* Do not edit old published migrations.
* Do not weaken RLS or constraints to make code or tests pass.
* Reuse existing helpers and project patterns.
* Treat RLS as a security boundary and constraints as final integrity enforcement.
* Do not rely only on TypeScript or client validation for database invariants.
* Prefer additive, existing-data-safe steps.
* Keep locks and transactions short.
* Do not call external services while holding database locks.
* Preserve idempotency for retryable payment, webhook, and status-transition logic.
* Surface schema, permission, or data-model conflicts before editing.
* Do not hide business-rule changes inside SQL without reviewing schemas, actions, tests, and seed assumptions.
* Do not modify unrelated database objects.
* Never run `db push` without explicit permission.

## Required workflow

### Before editing

1. Identify the affected database behavior and business invariant.
2. Inspect relevant migrations and current schema objects.
3. Inspect related:
   * tables and relationships
   * constraints and indexes
   * RLS policies and helper functions
   * RPCs, triggers, and SQL helpers
   * Storage policies
   * seed data
   * TypeScript/Zod/action/handler call sites
   * integration tests
4. Search for an existing pattern or helper that already fits.
5. Decide whether the task needs:
   * a migration
   * seed changes
   * schema/type or call-site changes
   * RLS/RPC/trigger tests
   * local reset or drift checks
6. Surface conflicts before writing SQL.

### While editing

* Keep one migration focused on the approved behavior.
* Preserve naming and helper patterns.
* Apply changes in an existing-data-safe order.
* Keep permission checks and invariants explicit.
* Update application call sites only when required.
* Add concise Vietnamese comments only for non-obvious ordering, RLS, atomicity, lock, trigger, backfill, or rollback reasoning.
* Avoid unrelated refactors.

### After editing

* Apply the migration locally.
* Check drift when relevant.
* Run the smallest relevant test set.
* Confirm RLS/helper/trigger patterns were reused or intentionally changed.
* Confirm no unrelated schema object changed.
* Report exact changes, commands, results, skipped checks, and pending manual QA.

## Migration safety

For existing tables with data, prefer:

```txt
add nullable column or safe default
→ backfill existing rows
→ validate data
→ add NOT NULL / UNIQUE / CHECK
→ add final indexes
```

Before strict constraints:

* verify existing rows satisfy them
* backfill or clean data safely
* name constraints clearly
* avoid weakening rules merely to pass migration

For soft-delete models:

* inspect `removed_at` semantics
* consider partial unique indexes that ignore removed rows
* ensure public and staff access remain intentional

Indexes require a real query pattern. Check existing indexes first and avoid duplicates.

## File placement

Database changes belong in:

```txt
supabase/migrations/<timestamp>_<clear_change_name>.sql
```

Do not treat these as final implementations:

* SQL run only in Supabase Studio
* application-only checks for a DB invariant
* seed-only schema behavior
* test-only schema setup

Application changes may accompany the migration only when necessary for compatibility or behavior.

## RLS and permission rules

Before changing RLS:

* inspect existing policies and helper functions
* reuse a helper when it expresses the same boundary
* test both allowed and denied actors
* consider draft, private, removed, ownership, collaborator, and admin cases
* avoid broad policies that expose more rows than intended

Current helper patterns may include:

```txt
has_course_content_read_access(course_id)
has_course_management_access(course_id)
is_course_owner_or_co_owner(course_id)
is_admin()
get_my_role()
can_modify_content_by_topic(topic_id)
can_modify_exercise_child(exercise_id)
can_modify_question_option(question_id)
```

Use actual repository definitions; do not assume names or behavior without inspection.

Common ownership predicates include:

```sql
auth.uid() = user_id
auth.uid() = id
```

Use explicit restrictive behavior when hard delete must be blocked.

Do not create a new permission helper until existing helpers are proven insufficient and the new boundary is approved.

## RPC rules

Use RPC when an operation must be atomic, permission-sensitive, or concurrency-safe at the database layer.

Before creating or changing one:

1. Inspect existing RPC and helper patterns.
2. Decide whether `SECURITY DEFINER` is necessary.
3. Set a safe `search_path` when using `SECURITY DEFINER`.
4. Check actor permission and current state explicitly.
5. Make retryable transitions idempotent.
6. Avoid duplicate side effects.
7. Return only required data.
8. Update callers and tests when needed.

Do not create RPC merely to hide ordinary CRUD.

## Trigger rules

Inspect existing triggers before adding one.

Reuse the shared `handle_updated_at` pattern when it exists and fits.

Do not:

* create another updated-at helper unnecessarily
* modify managed schemas such as `auth`, `storage`, `cron`, or `realtime` without explicit scope
* touch auth provisioning triggers unless the task is specifically about provisioning

Trigger tests should prove the intended effect and, when practical, that unrelated rows remain unaffected.

## Race conditions and idempotency

For counters, ordering, reservations, payments, webhooks, enrollment, or concurrent status changes:

* identify the shared row and invariant
* prefer atomic `UPDATE ... WHERE ... RETURNING`
* use `SELECT ... FOR UPDATE` only when serialization is necessary
* keep lock scope short
* never call external APIs inside the lock
* make retries idempotent
* test duplicate or simultaneous operations when practical

Common sensitive cases:

```txt
payment paid/cancelled transitions
discount reservation consumption
enrollment creation
webhook retries
used_count / reserved_count
ordering updates
duplicate submission
```

## Storage policies

Before changing Storage:

* inspect bucket-specific policies
* preserve owner/admin checks
* keep public access only when product requirements need public URLs
* do not trust client-provided bucket names or paths
* prefer server-generated paths for permission-sensitive uploads
* inspect related upload validation and handlers

Do not broaden Storage access casually.

## Seed data

Seed changes must:

* remain compatible with all migrations
* preserve IDs, roles, and assumptions used by tests
* not hide missing constraints, policies, or broken migrations
* be accompanied by affected test updates

## Database-specific comments

Follow `code-commenting-and-maintainability`.

Comment only non-obvious:

* safe migration order
* existing-data backfill
* RLS boundary
* trigger/helper purpose
* lock or atomic update
* partial constraint/index
* `SECURITY DEFINER` or `search_path`
* retry/idempotency invariant
* rollback-sensitive behavior

Good:

```sql
-- Backfill trước khi thêm NOT NULL để migration chạy được trên database đã có dữ liệu.
```

Do not narrate ordinary SQL syntax.

## Verification matrix

Choose the smallest relevant set.

### Migration or schema

* local `db reset`
* drift check when relevant
* valid/invalid data checks for important constraints

### RLS

* allowed role
* denied role
* ownership/admin/collaborator cases
* draft/private/removed cases when relevant

### RPC

* success
* invalid state
* unauthorized caller
* idempotent retry when applicable

### Trigger

* trigger effect
* unaffected data when practical

### Race-sensitive change

* duplicate, retry, or concurrent requests
* final invariant

### Seed

* reset succeeds
* dependent integration tests pass

Inspect `package.json` and Supabase config before choosing exact commands.

Typical commands may include:

```bash
npx supabase db reset
npx supabase db diff --schema public
npm run test:integration
npm run lint
npm run typecheck
```

Do not invent unavailable scripts.

A DB-backed integration change is not complete until the local database can be rebuilt successfully.

When smoke E2E uses an isolated Supabase workdir/runtime, migrations and RPCs needed by E2E must be applied there too, not only to the root local Supabase database. If E2E reports a missing function after migration work, check both the root DB and the E2E DB/workdir; reset the E2E workdir locally when it is stale, then restart PostgREST/schema cache only after confirming the function exists. Never apply this troubleshooting flow to production without explicit owner approval.

Never run `npx supabase db push` without explicit user permission.

## Anti-patterns

Do not:

* edit published migrations
* use dashboard SQL as the final change
* weaken RLS or constraints
* duplicate permission helpers
* create redundant updated-at functions
* trust client-provided owner, role, status, price, payment, or counter fields
* hold locks during external calls
* make retryable operations non-idempotent
* skip reset after migration changes
* ignore unexplained schema drift
* change unrelated tables, policies, or triggers
* claim remote application when only local checks ran

## Final checklist

* [ ] Existing DB patterns and call sites were inspected
* [ ] A focused new migration represents the behavior
* [ ] Existing data remains valid
* [ ] RLS and constraints preserve intended boundaries
* [ ] RPC/trigger/lock behavior is justified
* [ ] Retryable behavior is idempotent
* [ ] Relevant application contracts remain compatible
* [ ] Reset and relevant tests passed
* [ ] Drift was checked when needed
* [ ] No unrelated DB object changed
* [ ] Comments explain only non-obvious decisions
* [ ] Remote DB was not modified without explicit permission
* [ ] Exact verification and limitations were reported
