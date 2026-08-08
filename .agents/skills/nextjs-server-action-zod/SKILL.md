---
name: nextjs-server-action-zod
description: Repository-specific rules for Next.js Server Actions, Route Handlers, FormData, query/route/search params, webhook and upload payloads, Zod validation, React Hook Form contracts, DTOs, inferred types, trust boundaries, and schema/type SSOT. Use before changing actions, handlers, forms, schemas, helpers, or payload types that cross client/server or external-input boundaries.
---

# Next.js Server Action and Zod

## Activation scope

Use this skill when a task touches:

* Server Actions or Route Handlers
* request/response payloads reused across modules
* FormData, query, route, or search params
* webhook, upload, payment, or external payloads
* Zod schemas and parse methods
* React Hook Form validation
* DTOs, interfaces, inferred types, or helper contracts crossing a boundary
* schema/type SSOT and placement
* server-side validation errors
* client/server type safety

Do not use it for pure UI-only state that never crosses a trust boundary.

For database behavior, also use `supabase-safe-migration`.

## Related skills

Use:

* `supabase-safe-migration` for DB/RLS/RPC/schema behavior
* `test-quality-strategy` for schema, action, API, form, upload, webhook, and integration coverage; it remains applicable whenever test or coverage work is in scope even when this skill is a near miss
* both `frontend-design` and `frontend-workflow` for product-facing UI work, including local render-state changes that are a near miss for this skill
* `code-commenting-and-maintainability` for non-obvious trust-boundary comments and structured test-plan headers
* planning, review, and Git skills when their lifecycle phases apply

## Resource routing

Read every reference whose condition matches before making the affected decision:

| Resource | Read condition |
| --- | --- |
| [references/schema-placement-and-design.md](references/schema-placement-and-design.md) | Read before adding, moving, composing, materially changing, or reviewing ownership of a reusable schema, DTO, inferred type, transform, default, object strictness, accepted privileged-field surface, or RPC argument contract; also read when aligning form defaults or submission values with reusable schema input/output semantics. Skip existing-contract boundary work with no schema/type ownership decision. |
| [references/server-actions-and-route-handlers.md](references/server-actions-and-route-handlers.md) | Read before changing or reviewing a Server Action, Route Handler, API request/response boundary, query, route, or search params. Skip schema-only, RHF-only, or external-payload work without an action/handler boundary. |
| [references/formdata-and-react-hook-form.md](references/formdata-and-react-hook-form.md) | Read before changing or reviewing FormData extraction/normalization or React Hook Form contract behavior. Skip JSON/query work and multipart FormData used only as upload transport when no form normalization or RHF contract is under review. |
| [references/uploads-webhooks-and-payments.md](references/uploads-webhooks-and-payments.md) | Read when the requested scope directly names or reviews upload, storage, provider, trusted file-metadata, webhook, payment, signature/authenticity, or external-event behavior. Skip ordinary form, action, or schema work even when supplied source contains an incidental file branch. |
| [references/validation-test-matrix.md](references/validation-test-matrix.md) | Read before adding or reviewing validation-boundary tests, or choosing verification for a validation refactor. Skip planning or source inspection that does not choose test coverage. |

Read all matching references when conditions overlap. Treat each skip condition as meaningful; do not load a reference merely because this skill is active.

Reviewing whether an action accepts client-controlled privileged fields and changing an RPC argument contract both require a schema/type ownership decision, so they trigger the schema-placement reference. By contrast, inspecting an existing action only as a caller of a reusable schema does not trigger the action/handler reference; read that reference when the action or handler boundary itself is being changed or reviewed.

Database-owned RPC concurrency, idempotency, or persisted-state work does not by itself trigger schema placement. Read the schema reference for an RPC only when the task also reviews or changes the reusable application schema, DTO, inferred type, or argument-ownership contract; otherwise route the database invariant to `supabase-safe-migration` and keep the schema reference skipped.

Applying an existing schema while reviewing FormData, upload, webhook, payment, or handler behavior does not by itself trigger schema placement. Read the schema reference for those tasks only when reusable schema/type ownership or design is itself changing or under review; upload path ownership and webhook/payment authenticity remain core plus external-payload concerns. An optional file field inside an ordinary form remains a FormData concern, including ordinary field narrowing or validation. It triggers the external-payload reference only when upload, storage, provider, file-metadata trust, or external side-effect behavior is itself a direct subject of the task.

Judge that external trigger from the requested review or change, not merely from an incidental Storage call or file branch visible in supplied ordinary-form source. A task framed around FormData/RHF/action behavior keeps that branch under the form/action procedures unless upload, storage, provider, or file-trust behavior is explicitly part of the requested scope.

Needing to narrow an existing `File` field, validate an external payload, or preserve an existing boundary contract is still boundary use, not schema-placement work. Supplied form/action code merely using a shared schema, existing RHF defaults, or existing input/output types does not create a schema-placement decision by itself. A task that aligns or changes those defaults, input/output semantics, transforms, or shared types does trigger schema placement, as does any task that must decide reusable ownership, composition, strictness, or another schema-design contract.

Therefore, implementing an RHF/FormData form and Server Action around an existing shared schema reads the FormData and action references but skips schema placement unless the task explicitly asks to align or change schema-owned defaults, input/output semantics, transforms, shared types, or ownership. Do not turn the general need for client/server alignment into an unstated schema-design task.

A FormData/RHF task still triggers schema placement when it directly reviews reusable schema ownership, `z.input`/`z.output`, transforms, defaults, or shared payload types. Conversely, calling `request.formData()` only to receive an upload does not trigger the FormData/RHF reference when form extraction/normalization and RHF behavior are not part of the decision.

When supplied task facts establish an eligible non-trivial test file or structured test-plan header, route `code-commenting-and-maintainability` directly; do not make that owner conditional on separately editing an inline comment. Route `test-quality-strategy` directly for implementation, migration, or code-review work so verification is chosen at the lowest useful layer, even when no test file is named and this skill is a pure UI or pure SQL near miss. Also route it whenever any other task explicitly includes test or coverage work.

Do not infer validation-test procedure work merely because existing tests are supplied as evidence or must be inspected while changing a schema-owned contract. Read the validation-test reference only when the requested work adds, changes, reviews, or deliberately chooses validation-boundary coverage. Similarly, inspecting an existing action and UI caller to place or type a reusable schema does not trigger the action/handler reference when their boundary behavior is not itself changing or under review.

When a task changes an application action or RPC argument contract together with non-trivial integration or concurrency tests, read the validation-test reference for the application-boundary coverage even when `supabase-safe-migration` owns the persisted-state invariant.

## Core rules

* Zod is the SSOT for reusable untrusted-input contracts.
* Validate all untrusted input on the server.
* Client validation is UX, not enforcement.
* Use only parsed/normalized data after success.
* Never reuse raw payload after parsing.
* Auth and permission checks remain separate from validation.
* Perform mutation, upload, payment, email, and other side effects only after validation and authorization.
* Do not trust payloads merely because they came from the application UI.
* Do not trust client-provided owner, role, status, payment, price, path, or other privileged fields.
* Avoid `any`; parse unavoidable `unknown`/`any` immediately.
* Do not leak raw Zod, SQL, Supabase, stack, or secret details.
* Do not weaken validation to satisfy TypeScript or tests.
* Do not hide business-rule changes in schemas without inspecting callers.
* Keep changes surgical.

Parsed-only use is a per-boundary, per-value invariant. Trace every exported boundary argument and each downstream query, RPC, mutation, upload, or other side-effect value from raw extraction through parsing to use. After parsing, replace raw variables—including identifiers—with `parsed.data`; a helper must either parse its own untrusted argument or receive an already parsed contract. A safe parse in one caller does not prove that another exported helper or downstream operation has stopped using raw input.

Make review results explicit rather than collapsing independent guarantees into generic “authorization” or “effects” wording. For each applicable boundary, report parsing and parsed-only use, authentication, authorization, business-state checks, separate RLS/constraint enforcement, every side effect after those gates, and the stable serializable caller result with internal details kept server-side. For FormData/RHF plus test work, also state single versus repeated value handling, server enforcement, invalid and denied no-side-effect paths, and failed-input preservation when the supplied flow makes them applicable.

## Specialist escalation signals

A hard-risk signal exists when observable boundary facts expose a potentially material unresolved uncertainty about authorization or privileged client fields; source authenticity for webhook, payment, or upload input; validation, authentication, side-effect ordering, or partial failure; or a cross-module request/result mismatch that can cause an unsafe side effect or materially incorrect response.

Schema placement, create/update composition, FormData normalization, nullable/default semantics, and safe error-shape decisions are conditional review signals when normal source tracing and focused tests can decide them. Pure local UI types, mechanical schema composition, routine valid/invalid cases, domain activation, and payload or file count are ordinary non-triggers.

Route a hard-risk candidate through the global specialist gates only after applicable main review. Validation never substitutes for authentication, authenticity, RLS, constraints, or business-state checks. A signal does not authorize a side effect, implementation, or remote action.

## Business and security boundaries

Zod validates shape and local constraints. It does not replace:

* auth or authorization
* RLS
* stateful DB checks
* SQL parameterization
* XSS/content sanitization
* CSRF controls
* webhook authenticity
* replay protection
* upload content inspection

For stateful rules:

```txt
Zod validates shape/local constraints
→ DB/RPC validates current state and invariant
→ mutation occurs
```

Avoid DB reads inside Zod refinements unless repository patterns justify it and async parsing is used correctly.

Do not build “SQL injection detector” regexes. Use parameterized query builders and RPC arguments.

Plain text, markdown, and rich text require the repository’s established rejection or sanitization policy.

## Supabase call rules

Before calling Supabase:

1. Parse input.
2. Resolve authenticated actor.
3. Check role/ownership/permission.
4. Call Supabase with parsed trusted data only.
5. Keep RLS and constraints as final enforcement.

Usually derive these server-side rather than trusting input:

```txt
user_id owner_id created_by role is_admin
payment_status paid_at price discount_amount
used_count reserved_count
```

## Error handling

Follow the existing result shape.

Do not return:

* raw exceptions
* stack traces
* SQL or Supabase internals
* secrets
* full sensitive payloads
* passwords or tokens

Messages should help the user correct input without exposing internals.

## Validation-boundary comments

Follow `code-commenting-and-maintainability`.

Comment only non-obvious:

* normalization
* intentional `z.input`/`z.output` differences
* validation/auth/mutation order
* ignored privileged fields
* extra upload/webhook verification
* compatibility behavior
* delayed side effects

Explain the boundary or invariant, not ordinary parsing.

## Required workflow

### Before editing

* inspect schema modules and ownership
* inspect all callers and tests
* inspect DB/RPC mapping when applicable
* decide placement
* choose expected result/error compatibility
* choose relevant tests
* surface conflicts

### While editing

* reuse schemas
* parse at the boundary
* use only parsed data
* keep auth separate
* delay side effects
* preserve compatible result shapes
* avoid unrelated refactors

### After editing

* verify no reusable contract remains inline
* verify callers import the SSOT type/schema
* verify local types are truly local
* verify raw input is not reused
* verify side-effect order and authorization
* run the smallest relevant checks
* report exact behavior, commands, and limitations

## Anti-patterns

Do not:

* define reusable payload contracts inline in actions, routes, forms, helpers, or tests
* duplicate manual interfaces that mirror Zod
* use bare `z.string()` for required text
* broadly coerce booleans or numbers without empty-input semantics
* use async refinement with synchronous parse
* treat client validation as security
* trust privileged client fields
* expose internal errors
* weaken schemas to satisfy tests
* hide DB behavior inside validation
* invent formats or business limits
* add duplicate schemas with slightly different rules without a real boundary difference
* claim unavailable smoke/E2E infrastructure

## Final checklist

* [ ] Contract ownership and placement are explicit
* [ ] Reusable schemas/types live in the closest schema module
* [ ] Inputs are parsed server-side
* [ ] Only parsed data is used
* [ ] Auth/permission/state checks are separate
* [ ] Side effects occur afterward
* [ ] Privileged client fields are ignored or replaced
* [ ] Error shapes are stable and safe
* [ ] Forms align with schema input/output
* [ ] Upload/webhook authenticity needs are covered
* [ ] Relevant tests passed
* [ ] No duplicate inline contract remains
* [ ] Comments explain only non-obvious boundaries
* [ ] Exact verification and limitations were reported
