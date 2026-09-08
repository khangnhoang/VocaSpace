# RPC, Trigger, and Concurrency

Read this reference only when its resource-routing condition in `SKILL.md` matches. The core remains authoritative for permission, safety, inspection, stop conditions, and reporting.

## Trigger rules

Inspect existing triggers before adding one.

Reuse the shared `handle_updated_at` pattern when it exists and fits.

Trigger tests should prove the intended effect and, when practical, that unrelated rows remain unaffected.

For trigger review, state the intended effect, any possible effect on unrelated operations or rows, and the corresponding planned verification. Do not report a planned test as executed evidence.

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

For every RPC review, report each boundary explicitly even when the conclusion is `unknown` or not applicable:

* whether `SECURITY DEFINER` is necessary for the required operation, with the evidence or missing fact that decides it
* when `SECURITY DEFINER` is used, whether `search_path` and caller access are safe
* whether the return value exposes only the data required by the caller; state the actual return shape, or that it is unknown, instead of omitting this boundary
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
