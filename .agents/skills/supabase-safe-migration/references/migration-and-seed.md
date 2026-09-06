# Migration and Seed

Read this reference only when its resource-routing condition in `SKILL.md` matches. The core remains authoritative for permission, safety, inspection, stop conditions, and reporting.

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

## Ordered soft-delete backfills and constraints

Before choosing a correction:

1. Inspect authoritative ADRs, mutation paths, and tests for active ordering, retained deleted-state metadata, and restore behavior. Resolve conflicting evidence before proposing data changes.
2. Validate current rows against that contract first, including invalid or ambiguous order and active/deleted conflicts. Do not invent a tie-breaker for ambiguous business order; stop for an owner decision when the intended order cannot be inferred.
3. Plan only the necessary correction, preserve the established active relative order and current retained deleted-state metadata throughout the correction and backfill according to the product contract, and validate the resulting data before applying strict constraints. Do not merge active display order with deleted-state retention merely to simplify ranking.
4. Treat recovery of historical deleted-state metadata and restore of a deleted row as separate scopes that each require authority. Do not infer missing historical metadata, overwrite current retained metadata from a historical source, or add either recovery or restore implementation to a backfill-only scope. For an authorized restore, determine transactional conflict handling before clearing the deletion marker when retained metadata conflicts with active ordering.
5. Require correction coverage for valid, invalid, and ambiguous data, preservation of deleted-state metadata, and the final ordering/constraint invariant. Restore-conflict coverage belongs to the separately authorized restore mutation; planned checks are not executed evidence.

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

## Seed data

Seed changes must:

* remain compatible with all migrations
* preserve IDs, roles, and assumptions used by tests
* not hide missing constraints, policies, or broken migrations
* be accompanied by affected test updates
* when intended for browser or frontend QA, reuse canonical fixture state and define the actor or role, starting data, action, expected visible result, and evidence; add only missing states and apply the fixture-readiness rules owned by `test-quality-strategy` before browser execution

## Verification details

### Migration or schema

* local `db reset`
* drift check when relevant
* valid/invalid data checks for important constraints
* explicitly list each preserved constraint and verify it over its full row scope, with valid and invalid data coverage for nullability, range, and uniqueness as applicable; an active-only ordering or uniqueness rule does not narrow table-wide constraints, including their application to soft-deleted rows

### Seed

* reset succeeds
* dependent integration tests pass
