# Async state and forms

Read this reference before implementing or reviewing an async mutation, optimistic update, form, dynamic field, or complex client-state transition. The core `SKILL.md` remains authoritative for approval, scope, safety, related-skill routing, stop, and reporting behavior.

## Async behavior

For async operations:

* disable affected controls and prevent duplicate submission
* show pending, success, and safe error feedback
* preserve useful input after failure
* wait for server confirmation unless an approved optimistic strategy exists
* update/revalidate data using repository conventions
* handle overlapping/stale responses
* clean up subscriptions, timers, and aborted requests when relevant

For optimistic updates, define optimistic state, confirmation, rollback, duplicate handling, and failure feedback.

## Forms

Use existing schemas when appropriate.

* normalize values consistently
* keep field errors near fields
* distinguish required/optional fields
* handle server errors separately
* preserve values after recoverable failures
* avoid exposing server-owned fields
* ensure keyboard and mobile usability

For dynamic fields, use stable keys, preserve values, handle add/remove/reorder safely, prevent accidental deletion, keep derived values synchronized, and submit the intended order.

When removing a field is destructive or irreversible, apply the core confirmation rule: identify the object, action, consequence, and reversibility before confirming removal.

## UI states and edge cases

Implement all meaningful planned states and remain safe with null/undefined values, long text, missing images, slow/failed requests, empty results, restricted permissions, repeated actions, stale data, and partial data.
