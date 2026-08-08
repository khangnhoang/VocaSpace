# Schema Placement and Design

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for untrusted-input, parsed-only, authorization, side-effect, business/security, safe-error, and reporting invariants.

## Contract ownership

Before creating a `type`, `interface`, or schema, classify it as:

```txt
schema-owned reusable boundary contract
schema-inferred input/output type
local UI-only type
local helper implementation type
test-harness-only type
```

## Put it in the closest schema module when it:

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

## Local UI types

May remain local only when they describe rendering state or props, never cross a trust boundary, are not reusable domain contracts, and add no validation value.

```ts
type UploadState = "idle" | "uploading" | "done" | "error";

interface CourseCardProps {
  title: string;
  onClick?: () => void;
}
```

If component props mirror a submitted payload or reusable server data, import the schema- or database-derived type instead.

## Local helper/test types

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

When an existing caller or test demonstrates unknown-field stripping or replacement of redirect, ownership, pricing, status, or other privileged client fields with trusted server data, preserve that evidenced compatibility unless the approved scope explicitly changes it. State both sides of that contract when they are evidenced: unknown client fields remain ignored or stripped, and redirects or other privileged values continue to come from trusted server-owned data. Keep those server-owned fields outside the caller-owned contract.

Do not summarize this only as generic caller compatibility. In the review result, explicitly identify evidenced unknown privileged fields as ignored or stripped and identify the corresponding redirect or other privileged value as trusted server-owned data.
