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
* `test-quality-strategy` for schema, action, API, form, upload, webhook, and integration coverage
* `frontend-workflow` for form interaction and UI states
* `code-commenting-and-maintainability` for non-obvious trust-boundary comments
* planning, review, and Git skills when their lifecycle phases apply

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

## Specialist escalation signals

A hard-risk signal exists when observable boundary facts expose a potentially material unresolved uncertainty about authorization or privileged client fields; source authenticity for webhook, payment, or upload input; validation, authentication, side-effect ordering, or partial failure; or a cross-module request/result mismatch that can cause an unsafe side effect or materially incorrect response.

Schema placement, create/update composition, FormData normalization, nullable/default semantics, and safe error-shape decisions are conditional review signals when normal source tracing and focused tests can decide them. Pure local UI types, mechanical schema composition, routine valid/invalid cases, domain activation, and payload or file count are ordinary non-triggers.

Route a hard-risk candidate through the global specialist gates only after applicable main review. Validation never substitutes for authentication, authenticity, RLS, constraints, or business-state checks. A signal does not authorize a side effect, implementation, or remote action.

## Contract ownership

Before creating a `type`, `interface`, or schema, classify it as:

```txt
schema-owned reusable boundary contract
schema-inferred input/output type
local UI-only type
local helper implementation type
test-harness-only type
```

### Put it in the closest schema module when it:

* validates untrusted input
* represents an action or route payload
* represents FormData after extraction
* covers query, route, search, webhook, upload, or RPC arguments
* maps to DB enums/columns or mutation data
* is shared by UI/server, implementation/tests, or multiple modules
* represents a reusable domain contract
* would otherwise duplicate field rules

Typical location:

```txt
lib/schemas/<domain>.ts
```

Use actual repository paths and conventions.

Example:

```ts
export const CreateCourseSchema = z.object({
  title: CourseTitleSchema,
  description: CourseDescriptionSchema.optional(),
});

export type CreateCourseInput = z.output<typeof CreateCourseSchema>;
export type CreateCourseRawInput = z.input<typeof CreateCourseSchema>;
```

Use `z.input` and `z.output` when transforms make them differ.

### Local UI types

May remain local only when they describe rendering state or props, never cross a trust boundary, are not reusable domain contracts, and add no validation value.

```ts
type UploadState = "idle" | "uploading" | "done" | "error";

interface CourseCardProps {
  title: string;
  onClick?: () => void;
}
```

If component props mirror a submitted payload or reusable server data, import the schema- or database-derived type instead.

### Local helper/test types

Keep local only for private implementation or harness details.

A helper payload that normalizes or validates external input belongs to the schema layer.

Tests import reusable schema-owned contracts rather than recreating payload interfaces.

## Placement workflow

Before editing:

1. Search existing schema modules.
2. Inspect related actions, handlers, forms, helpers, tests, and callers.
3. List every schema/type/interface to add or change.
4. Classify each by ownership.
5. Reuse, compose, or extend existing schemas when possible.
6. Move reusable contracts to the closest domain schema module.
7. Export inferred types.
8. Import them everywhere else.
9. Ensure any local type is truly private and non-boundary.

Do not begin boundary implementation before this placement decision is complete.

## Boundary workflow

For every untrusted input:

1. Extract raw input explicitly.
2. Parse with the correct schema.
3. Return a stable safe validation result on failure.
4. Use only parsed/normalized data.
5. Check authentication.
6. Check role, ownership, collaboration, or other authorization.
7. Check stateful business rules when needed.
8. Perform mutation or side effect.
9. Return a serializable safe response.

Example:

```ts
const parsed = CreateCourseSchema.safeParse(rawPayload);

if (!parsed.success) {
  return {
    success: false,
    errors: parsed.error.flatten().fieldErrors,
  };
}

const input = parsed.data;
```

Use `safeParseAsync` for async refinements or transforms.

## Server Actions

* Validate server-side even when the form uses HTML, RHF, or client Zod.
* Preserve the established result/error shape unless scope requires change.
* Return stable serializable expected errors.
* Throw only for unexpected errors or established framework control flow.
* Keep authorization explicit.
* Replace privileged client fields with trusted server values.
* Use schema-owned input/output contracts.

## Route Handlers

Separate:

```txt
request extraction
→ validation
→ auth/permission
→ business rule
→ mutation/upload/side effect
→ safe response
```

Validate body, FormData, query, route, and search params server-side.

Do not trust client IDs, filenames, bucket paths, roles, statuses, or payment state.

Reusable request/response contracts belong in schema modules, not `route.ts`.

## FormData

* Extract only expected fields.
* Use `getAll()` intentionally for repeated values.
* Treat missing, empty, and whitespace-only required values correctly.
* Validate files separately.
* Filter framework/internal keys if using `Object.fromEntries`.
* Keep reusable normalization contracts in the schema layer.

Prefer explicit extraction:

```ts
const rawPayload = {
  title: formData.get("title"),
  description: formData.get("description"),
};
```

## React Hook Form

* Reuse the same schema when client and server rules are truly the same.
* Separate create/update schemas when workflows differ.
* Align defaults and submit payloads with schema input/output semantics.
* Keep dynamic arrays and nested values intentional.
* Do not create form-only duplicates of reusable boundary types.
* Test add/remove/reorder, validation, pending state, payload shape, and failure preservation when relevant.

Server validation remains mandatory.

## Schema design

### Required strings

Use trim, min, and an appropriate max:

```ts
z.string().trim().min(1).max(120)
```

Reject empty, whitespace-only, wrong-type, and excessive values.

### Optional strings

Choose semantics explicitly:

```ts
z.string().trim().min(1).optional()
```

or normalize empty strings to `undefined` with preprocess/transform.

Do not accidentally treat whitespace as meaningful.

### Common fields

* title/name: trim, min, max, plain-text policy
* slug: lowercase and strict allowlist
* email: trim/lowercase when business semantics are case-insensitive
* password: do not trim unless explicitly required
* role/status/type: enum, not arbitrary string
* UUID: `z.string().uuid()`
* arrays: item, length, duplicates, ordering, and cross-item invariants
* numeric form input: handle empty string deliberately; avoid accidental `0`
* money: validate business bounds and avoid trusting client-calculated persisted values
* checkbox/boolean: parse known representations intentionally; avoid broad coercion

Example slug:

```ts
z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
```

Field limits and formats must follow repository business requirements, not generic assumptions.

## Composition and object strictness

Prefer:

* shared field schemas
* `.pick()`
* `.omit()`
* `.partial()`
* `.extend()`
* object shape composition

Name distinct workflows explicitly:

```txt
CreateCourseSchema
UpdateCourseSchema
PublishCourseSchema
```

Do not force incompatible boundaries into one schema.

For external mutation payloads, decide unknown-key behavior intentionally.

Use strict objects when unknown keys should fail. If ordinary `z.object` strips keys, confirm silent stripping is acceptable.

Do not allow pass-through fields without an approved reason.

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

## Uploads

Validate server-side:

* file presence
* media type/content type
* extension when relevant
* size
* auth and permission
* server-generated storage path when sensitive

Do not trust client bucket, filename, or path.

Return safe errors; keep raw provider errors server-side.

Zod validates metadata/shape, but deeper file inspection may still be required.

## Webhooks and payments

* Validate payload shape.
* Verify webhook authenticity/signature.
* Check allowed current state.
* Make processing idempotent.
* Reject untrusted client payment state.
* Avoid logging sensitive full payloads.
* Do not update payment/enrollment from unverified events.

Shape validation, source authenticity, and DB-state validity are separate guarantees.

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
