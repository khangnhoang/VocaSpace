# Validation Test Matrix

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for boundary invariants, verification truth, required workflow, stops, and reporting; also follow `test-quality-strategy` for test-layer and evidence decisions.

## Testing matrix

Choose the smallest relevant set.

### Schema

* valid payload
* missing/whitespace/length boundaries
* invalid enum/UUID/format
* arrays, transforms, defaults, and refinements
* unknown keys when strictness matters

### Server Action

* valid and invalid payload
* mutation not called after failure
* missing auth and denied permission
* stable safe errors

### Route Handler

* valid/malformed body, FormData, params, or query
* auth/permission
* safe error and success shape

### Form

* defaults
* messages
* dynamic fields
* pending/disabled behavior
* payload shape
* input preservation after failure

### Upload

* valid file
* missing, wrong type, too large
* unauthorized caller
* safe provider error

### Webhook/payment

* valid shape and authenticity
* invalid signature
* invalid transition
* retry/idempotency

### SSOT-only refactor

* typecheck and existing relevant tests
* no new behavior test required unless a coverage gap is exposed

Bug fixes require regression coverage when practical.

Do not require E2E for schema-only work or claim unavailable browser tooling.
