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
3. Plan only the necessary correction, preserve the established active relative order and deleted-state metadata according to the product contract, and validate the resulting data before applying strict constraints. Do not merge active display order with deleted-state retention merely to simplify ranking.
4. Keep restore as a separately authorized reconciliation mutation. Determine transactional conflict handling before restoring a row; clearing its deletion marker alone is not sufficient when retained metadata conflicts with active ordering. Do not add restore implementation to a backfill-only scope.
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

## Verification details

### Migration or schema

* local `db reset`
* drift check when relevant
* valid/invalid data checks for important constraints

### Seed

* reset succeeds
* dependent integration tests pass
