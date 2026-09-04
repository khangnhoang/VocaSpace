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
