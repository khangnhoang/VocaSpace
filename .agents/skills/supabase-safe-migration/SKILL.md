---

name: supabase-safe-migration
description: Supabase/PostgreSQL database changes: migrations, tables, columns, indexes, constraints, RLS policies, RPC functions, triggers, SQL functions, integration tests, db reset, race conditions. Use before editing anything that changes or depends on database behavior.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Supabase Safe Migration Skill

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

Do not use ad hoc SQL as the final implementation. Database behavior changes must be represented by a Supabase migration.

## Core rules

* Read existing migrations, schema, policies, triggers, SQL functions, and related call sites before writing.
* Make the smallest database change that satisfies the requested goal.
* Do not modify unrelated tables, policies, functions, or triggers.
* Do not weaken RLS policies to make code or tests pass.
* Do not create a new helper function when an existing function or pattern already fits.
* If a change is only a suggestion or optimization, ask for approval before implementing it.
* If requirements conflict with the current schema, policies, triggers, or data model, stop and surface the conflict.
* Do not push to the remote database unless explicitly requested.

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

4. Run lint/typecheck if available in `package.json`:

```bash
npm run lint
npm run typecheck
```

If a command does not exist, inspect `package.json` and use the closest existing script.

For integration-test-related database changes, database reset must pass before considering the task complete.

## Final response checklist

When finished, report:

* migration file created or changed
* tables/functions/policies/triggers changed
* existing trigger/RLS patterns reused
* verification commands run
* any failed command and the exact reason
* any follow-up recommendation that still needs user approval
