# RPC, Trigger, and Concurrency

Read this reference only when its resource-routing condition in `SKILL.md` matches. The core remains authoritative for permission, safety, inspection, stop conditions, and reporting.

## Trigger rules

Inspect existing triggers before adding one.

Reuse the shared `handle_updated_at` pattern when it exists and fits.

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

## Verification details

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
