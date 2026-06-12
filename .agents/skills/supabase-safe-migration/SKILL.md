---

name: supabase-safe-migration
description: Supabase/PostgreSQL database changes: migrations, tables, columns, indexes, constraints, RLS policies, RPC functions, triggers, SQL functions, seed data, integration tests, db reset, race conditions, or database-dependent business behavior. Use before editing anything that changes or depends on database behavior.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Supabase Safe Migration Skill

## Activation scope

Use this skill when a task touches Supabase/PostgreSQL behavior, including:

* tables
* columns
* indexes
* constraints
* enums
* RLS policies
* RPC functions
* triggers
* SQL helper functions
* seed data
* integration tests that depend on database behavior
* race-condition-sensitive database logic
* database-dependent business behavior
* Supabase Storage policies
* Supabase CLI commands such as `db reset`, `db diff`, `db push`, or migration repair

Do not use this skill for pure UI-only changes that do not depend on database behavior.

Do not use ad hoc SQL as the final implementation. Database behavior changes must be represented by a Supabase migration.

Do not push to the remote database unless the user explicitly requests it.

## Related skills

Also use `nextjs-server-action-zod` when the database task touches validation or call sites, including:

* Server Actions that call Supabase
* Route Handlers that read/write database data
* RPC argument validation
* API payloads that map to database columns
* form payloads that map to database mutations
* Zod schemas that need to change because of a database schema change
* TypeScript DTOs/interfaces that represent database-backed payloads

If a task touches both database behavior and validation/API call sites, read and follow both skills before editing.

## Core rules

* Read existing migrations, schema, policies, triggers, SQL functions, and related call sites before writing.
* Make the smallest database change that satisfies the requested goal.
* Do not modify unrelated tables, policies, functions, or triggers.
* Do not weaken RLS policies to make code or tests pass.
* Do not create a new helper function when an existing function or pattern already fits.
* If a change is only a suggestion or optimization, ask for approval before implementing it.
* If requirements conflict with the current schema, policies, triggers, or data model, stop and surface the conflict.
* Do not push to the remote database unless explicitly requested.
* Prefer additive, safe, reversible migration steps when working with existing data.
* Treat RLS as a security boundary, not as a convenience layer.
* Treat database constraints as final enforcement for data integrity.
* Do not rely only on client-side or server-side TypeScript validation when the database must enforce an invariant.
* Do not hide business-rule changes inside a migration without checking TypeScript, Zod, Server Actions, Route Handlers, tests, and seed data.
* Do not edit old migrations unless the user explicitly asks to amend local unpublished work.

## Required workflow

### Before editing

Before making any database change:

1. Identify whether the task changes database behavior, depends on database behavior, or only touches application code.
2. Inspect existing migrations in `supabase/migrations`.
3. Inspect related tables, columns, constraints, indexes, RLS policies, triggers, RPC functions, and SQL helper functions.
4. Inspect related TypeScript/Zod/Server Action/Route Handler call sites when applicable.
5. Check whether an existing helper function, RLS pattern, trigger pattern, or RPC pattern already fits.
6. Decide whether the change needs:

   * a new migration
   * a new or changed test
   * a seed update
   * a Zod/schema update
   * a Server Action or Route Handler update
   * a local db reset
   * a db diff check
7. Surface conflicts before editing.

Do not start writing SQL until the existing database pattern is understood.

### While editing

When editing database behavior:

1. Create a new migration unless explicitly told to amend unpublished local work.
2. Keep the migration focused on the requested change.
3. Use existing helper functions and naming patterns where possible.
4. Keep lock-sensitive SQL short.
5. Avoid external API calls inside database locks or transactions.
6. Preserve RLS safety.
7. Preserve idempotency for payment/webhook/status-transition logic.
8. Avoid broad policy changes that accidentally expose draft, removed, private, or user-owned data.
9. Update related call sites only when required by the database change.
10. Add comments only where they explain a non-obvious migration decision, RLS boundary, backfill order, trigger purpose, race-condition handling, or rollback-sensitive behavior.

### After editing

After editing:

1. Verify the migration applies cleanly.
2. Verify no unintended schema drift exists when relevant.
3. Verify related tests pass.
4. Verify RLS/helper/trigger patterns were reused or intentionally changed.
5. Verify no unrelated table/policy/function/trigger was modified.
6. Report exactly what changed and what was verified.

## Migration workflow

For any database change:

1. Inspect the current state:

   * `supabase/migrations`
   * related tables
   * related RLS policies
   * related indexes and constraints
   * related RPC functions
   * related triggers
   * related TypeScript/Zod/server action call sites when applicable

2. Create a new migration instead of editing old migrations, unless the user explicitly asks to amend local unpublished work.

3. For existing tables with data, use safe migration order:

   * add nullable column or safe default first
   * backfill existing rows
   * add `NOT NULL` only after data is valid
   * add unique/check constraints only after existing data is valid
   * add indexes after the final query pattern is clear

4. For soft-delete tables, consider whether constraints and indexes should ignore rows where `removed_at IS NOT NULL`.

5. For race-condition-sensitive logic:

   * prefer atomic `UPDATE ... WHERE ... RETURNING ...` for counter/state transitions
   * use `SELECT ... FOR UPDATE` only when the operation must serialize work around one row
   * keep locked sections short
   * do not perform external API calls while holding a database lock

6. For RPC functions:

   * use `SECURITY DEFINER` only when needed
   * always set `search_path`
   * make payment/webhook/status-transition functions idempotent
   * validate current state before mutating state
   * avoid duplicate side effects

## File placement rules

Database behavior changes belong in Supabase migrations.

Prefer:

```txt
supabase/migrations/<timestamp>_<clear_change_name>.sql
```

Do not implement database behavior changes only as:

* manual SQL run in Supabase Studio
* ad hoc SQL pasted into the dashboard
* application-only TypeScript checks
* seed-only changes
* test-only schema setup

Application code may be updated in the same task only when needed to keep call sites compatible with the database change.

## Existing trigger patterns

Before adding a trigger or trigger function, inspect existing triggers and reuse the existing pattern when possible.

Current project pattern:

* `set_updated_at_<table>` triggers use the shared `handle_updated_at` function.
* For public tables with an `updated_at` column, prefer adding a `BEFORE UPDATE` trigger that calls the existing `handle_updated_at` function.
* Do not create a new `updated_at` trigger function if `handle_updated_at` fits.
* Do not modify managed Supabase schemas such as `auth`, `storage`, `cron`, or `realtime` unless the user explicitly asks for that exact change.
* Do not touch `on_auth_user_created` / `handle_new_user` unless the task is explicitly about auth user provisioning.

## Existing RLS patterns

Before adding or changing an RLS policy, inspect existing policies and reuse current helper functions and policy shapes when the access pattern matches.

Current project patterns to prefer:

* Public readable course content:

  * `has_course_content_read_access(course_id)`
  * `removed_at IS NULL`

* Staff course management:

  * `has_course_management_access(course_id)`

* Course owner or co-owner management:

  * `is_course_owner_or_co_owner(course_id)`

* Admin checks:

  * `is_admin()`

* Teacher/admin course creation:

  * `get_my_role() = 'teacher'::user_role`
  * or admin/teacher role checks already used in existing policies

* Child content permission helpers:

  * `can_modify_content_by_topic(topic_id)`
  * `can_modify_exercise_child(exercise_id)`
  * `can_modify_question_option(question_id)`

* User-owned data:

  * `auth.uid() = user_id`
  * `auth.uid() = id`

* Deleted-content staff visibility:

  * `removed_at IS NOT NULL`
  * combined with the matching management helper

* Hard-delete restriction:

  * use an explicit restrictive policy pattern such as `false` when hard delete must be blocked

* Storage policies:

  * preserve bucket-specific checks
  * preserve owner/admin checks
  * do not broaden storage access casually

Do not invent a new RLS helper if an existing helper expresses the same permission boundary.

If the requested change appears to need a new permission boundary, explain why and ask before creating a new helper or policy pattern.

## RPC rules

Before creating or changing an RPC function:

1. Inspect existing RPC functions and helper SQL functions.
2. Check whether the RPC needs `SECURITY DEFINER`.
3. If using `SECURITY DEFINER`, set a safe `search_path`.
4. Validate current database state before mutating.
5. Make status transitions idempotent when the RPC can be retried.
6. Avoid duplicate side effects.
7. Keep permission checks explicit.
8. Return only the data the caller needs.
9. Check related TypeScript call sites and tests.

Use RPC when the operation must be atomic, permission-sensitive, or race-condition-sensitive at the database layer.

Do not use RPC only to hide ordinary CRUD without a clear database-side reason.

## Constraint and index rules

For constraints:

* Add constraints only after existing data is valid.
* Backfill or clean data before adding `NOT NULL`, `UNIQUE`, or strict `CHECK` constraints.
* Name constraints clearly and consistently.
* For soft-delete tables, consider partial unique indexes that ignore removed rows.
* Do not weaken constraints just to make app code pass.

For indexes:

* Add indexes only when the query pattern is clear.
* Prefer partial indexes for soft-delete/status-filtered access patterns when useful.
* Avoid adding duplicate indexes.
* Check existing indexes before creating new ones.

## Race-condition rules

When a task touches counters, ordering, payment state, webhook handling, enrollment state, reservations, or any concurrent mutation:

* Identify the shared row or invariant that must be protected.
* Prefer atomic SQL updates when possible.
* Use row locks only when serialization is necessary.
* Keep the locked section short.
* Do not call external APIs while holding a database lock.
* Make retryable operations idempotent.
* Add or update integration/concurrency tests when practical.

Examples of race-condition-sensitive behavior:

* payment paid/cancelled transitions
* discount reservation consumption
* enrollment creation after payment
* question option ordering
* counters such as `used_count` / `reserved_count`
* webhook retries
* duplicate submit protection

## Storage policy rules

When changing Supabase Storage behavior:

* Inspect existing bucket policies first.
* Preserve bucket-specific checks.
* Preserve owner/admin checks.
* Do not broaden read/write access casually.
* Keep public buckets public only when the product requires public URLs.
* Do not trust client-provided paths for ownership or authorization.
* Prefer server-generated paths when uploads are permission-sensitive.
* Check related upload Route Handlers, Server Actions, and validation schemas.

## Seed data rules

When changing seed data:

* Keep seed data compatible with all migrations.
* Do not use seed data to hide missing constraints, missing policies, or broken migrations.
* Keep test users, roles, and IDs consistent with existing test expectations.
* Update integration tests when seed assumptions change.

## Commenting rules

For SQL migrations, add comments only when they explain non-obvious intent.

Use Vietnamese comments when a comment is needed in project-owned SQL or TypeScript code, unless the surrounding file has a strong English-only convention.

Good comments explain:

* why the migration step exists
* why the order is safe for existing data
* which RLS boundary is being enforced
* why a trigger or helper function exists
* why a lock or atomic update is needed
* why a constraint/index is partial
* why a policy intentionally allows or denies a role
* what data flow or trust boundary is being protected

Avoid comments that only restate SQL syntax.

Good:

```sql
-- Backfill trước khi thêm NOT NULL để migration chạy được trên database đã có dữ liệu.
update public.topics
set course_id = c.id
from public.courses c
where topics.course_id is null
  and topics.course_slug = c.slug;
```

Bad:

```sql
-- Update topics.
update public.topics
set course_id = null;
```

For TypeScript functions touched by database work, add a short Vietnamese comment before non-trivial functions explaining:

* what the function does
* what database operation it controls
* which validation/auth/permission/data-flow boundary matters

Inside long functions, comment meaningful data-flow stages such as:

* input extraction
* validation
* auth/session lookup
* permission check
* database mutation/RPC call
* response shaping
* safe error handling

Do not add noisy comments for obvious syntax.

## Testing matrix

Choose the smallest useful test set based on the database change.

* Migration-only schema change:

  * `npx supabase db reset`
  * `npx supabase db diff --schema public` when drift matters

* RLS policy change:

  * integration tests for allowed role
  * integration tests for denied role
  * integration tests for removed/draft/private edge cases when relevant

* RPC function change:

  * integration tests for success path
  * integration tests for invalid state
  * integration tests for unauthorized caller when applicable
  * idempotency test for retryable payment/webhook/status-transition logic

* Trigger change:

  * integration test proving the trigger fires
  * test that unrelated rows or tables are not affected when practical

* Constraint/index change:

  * migration reset must pass
  * test valid data and invalid data when the constraint is business-critical

* Race-condition-sensitive change:

  * integration/concurrency test when practical
  * test duplicate requests, retries, or simultaneous inserts/updates

* Seed data change:

  * db reset must pass
  * related integration tests must pass

* TypeScript call-site change caused by DB change:

  * relevant unit/integration tests
  * typecheck when available

Do not add E2E tests for every migration-only change.

Prefer integration tests for database behavior.

Prefer smoke/E2E tests only when the database change affects a critical user flow through the UI.

## Verification workflow

After database changes, verify with the strongest relevant checks available in the repo.

Prefer this order:

1. Run local database reset:

```bash
npx supabase db reset
```

2. Check for unintended schema drift when relevant:

```bash
npx supabase db diff --schema public
```

3. Run relevant tests:

```bash
npm run test
```

4. Run integration tests when the change touches database-dependent behavior:

```bash
npm run test:integration
```

5. Run lint/typecheck if available in `package.json`:

```bash
npm run lint
npm run typecheck
```

If a command does not exist, inspect `package.json` and use the closest existing script.

For integration-test-related database changes, database reset must pass before considering the task complete.

For remote database work, do not run `npx supabase db push` unless the user explicitly requests it.

## Anti-patterns

Do not:

* edit old migrations unless explicitly asked to amend unpublished local work
* run dashboard SQL and treat it as the final implementation
* weaken RLS to make tests pass
* broaden storage access casually
* create duplicate helper functions when an existing helper fits
* add new RLS helper functions without checking existing helpers
* create a new `updated_at` trigger function when `handle_updated_at` fits
* skip db reset after migration changes
* ignore schema drift after a migration-sensitive change
* rely on app-only validation for database invariants
* trust client-provided privileged fields such as `user_id`, `owner_id`, `role`, `is_admin`, `payment_status`, `paid_at`, `price`, or counters
* perform external API calls while holding database locks
* make payment/webhook/status-transition logic non-idempotent
* hide unrelated refactors inside a migration task
* modify managed Supabase schemas unless explicitly asked

## Final response checklist

When finished, report:

* migration file created or changed
* tables changed
* columns changed
* constraints/indexes changed
* functions/RPCs changed
* policies changed
* triggers changed
* storage policies changed
* seed data changed
* TypeScript/Zod/Server Action/Route Handler call sites changed
* existing trigger/RLS/RPC patterns reused
* tests added or updated
* verification commands run
* any failed command and the exact reason
* any skipped command and why it was skipped
* any follow-up recommendation that still needs user approval
