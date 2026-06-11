---

name: nextjs-server-action-zod
description: Next.js Server Actions, Route Handlers, API payloads, FormData, Zod schemas, safeParse, inferred types, validation, business rules, server-side input validation, and client/server boundary type-safety. Use before editing actions, route handlers, forms, schemas, or payload types that cross client/server boundaries. Do not use for database migrations unless validation call sites are also changing.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Next.js Server Action Zod Skill

Use this skill when a task touches input validation or payload typing across a trust boundary, including:

* Next.js Server Actions
* Route Handlers
* API request payloads
* FormData parsing
* query params
* route params
* search params
* webhook payload validation
* Zod schemas
* form schemas
* server-side validation errors
* payload interfaces or DTO types
* `safeParse`, `parse`, `z.infer`, `z.input`, `z.output`
* validation shared between client forms and server mutations

Do not use this skill for pure UI-only state that never crosses a client/server or external input boundary.

If the task changes database schema, RLS, RPC functions, triggers, SQL constraints, migrations, or database race-condition behavior, also use the Supabase safe migration skill.

## Core rules

* Treat Zod schemas as the source of truth for untrusted input.
* Do not define manual TypeScript interfaces for action/API payloads when a Zod schema can infer the type.
* Prefer `export type XInput = z.infer<typeof XSchema>` or `z.input` / `z.output` when transforms make input and output differ.
* Validate all untrusted input on the server before mutation.
* Client-side validation is only UX. It does not replace server-side validation.
* Never trust a payload because it came from the app UI.
* Never mutate database state, call payment logic, send emails, upload files, or trigger side effects before validation passes.
* Use only `parsed.data` after `safeParse` succeeds.
* Do not continue using the original raw payload after validation.
* Avoid `any` for payloads. If `any` or `unknown` is unavoidable, it must be immediately parsed by Zod.
* Keep validation close to the trust boundary, but keep reusable schemas in shared schema files.
* Do not hide business-rule changes inside validation without checking existing behavior and call sites.
* Do not weaken validation just to make TypeScript, tests, or UI code pass.

## File placement rules

Prefer shared domain schema files:

```txt
src/lib/schemas/course.ts
src/lib/schemas/payment.ts
src/lib/schemas/exercise.ts
src/lib/schemas/question.ts
src/lib/schemas/user.ts
src/lib/schemas/auth.ts
```

Use local component types only for UI-only state that does not cross a boundary.

Good:

```ts
export const CreateCourseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).optional(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
```

Avoid:

```ts
interface CreateCoursePayload {
  title: string;
  description?: string;
}
```

Manual interfaces are acceptable only when:

* the type is private to one component
* the data is not submitted to a server action/API/RPC
* the type describes UI state, not external input
* a Zod schema would add no validation value

## Existing-code inspection workflow

Before writing or changing validation:

1. Inspect existing schema files in `src/lib/schemas`.
2. Inspect the related Server Action, Route Handler, form component, and server-side call sites.
3. Check whether a schema already exists and can be reused, extended, picked, omitted, or refined.
4. Check existing error return shape before introducing a new one.
5. Check whether the payload maps to database columns, enums, RLS expectations, or RPC arguments.
6. Check whether the same payload is used by client validation, server validation, tests, or fixtures.
7. Make the smallest schema change that satisfies the requested behavior.

Do not create duplicate schemas with slightly different rules unless the input boundary is genuinely different.

## Boundary validation workflow

For every Server Action or Route Handler that receives untrusted input:

1. Extract raw input explicitly.
2. Parse with the correct Zod schema.
3. Return early on validation failure.
4. Use only parsed and normalized data.
5. Check authentication and authorization.
6. Perform the mutation or side effect.
7. Return a serializable result.

Preferred pattern:

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

For async refinements or async transforms, use:

```ts
const parsed = await SomeSchema.safeParseAsync(rawPayload);
```

Do not use async `refine` / `transform` with regular `safeParse`.

## Server Action rules

* A Server Action must validate input server-side even when the form uses React Hook Form, HTML validation, or client-side Zod.
* Do not expose stack traces, raw Zod internals, SQL errors, Supabase errors, or secret details to the client.
* Return stable serializable errors for expected validation failures.
* Throw only for truly unexpected errors or framework control flow when the project pattern already does so.
* Do not use Server Action validation as authorization. Auth and permission checks must be explicit.
* Check `auth.uid()`, session, role, ownership, collaboration, or admin permission separately from Zod.
* Do not let user-submitted `user_id`, `role`, `owner_id`, `status`, or price-like fields override trusted server-side values unless the business rule explicitly allows it.

Preferred action shape:

```ts
"use server";

export async function createCourseAction(rawPayload: unknown) {
  const parsed = CreateCourseSchema.safeParse(rawPayload);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;

  // Auth check here.
  // Permission check here.
  // Mutation here.

  return {
    success: true,
  };
}
```

## FormData rules

When handling `FormData`:

* Extract only expected fields.
* Prefer explicit extraction over blindly trusting all entries.
* Be careful with `Object.fromEntries(formData)` because framework-added fields may exist.
* Convert repeated fields intentionally with `formData.getAll()`.
* Validate file inputs separately.
* Treat missing fields, empty strings, and whitespace-only strings as invalid when the field is required.

Good:

```ts
const rawPayload = {
  title: formData.get("title"),
  description: formData.get("description"),
};
```

Avoid relying on this without filtering:

```ts
const rawPayload = Object.fromEntries(formData);
```

If using `Object.fromEntries`, filter framework/internal keys before parsing.

## Required string rules

For required plain text strings, never use bare `z.string()`.

Use:

```ts
z.string().trim().min(1)
```

Add a max length unless there is a strong reason not to:

```ts
z.string().trim().min(1).max(120)
```

Required strings should reject:

* empty strings
* whitespace-only strings
* unexpected non-string values
* values that exceed the business length limit

Use field-specific limits. Do not apply one global string limit to all fields.

## Optional string rules

Be explicit about optional string semantics.

If empty string should become `undefined`, normalize it intentionally:

```ts
const OptionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();
```

If empty string should be rejected when provided:

```ts
z.string().trim().min(1).optional()
```

Do not accidentally allow `"   "` as a meaningful value.

## Field-specific validation rules

### Name/title fields

Use trim, min, max, and plain-text constraints.

Example:

```ts
z.string().trim().min(1).max(120)
```

Reject HTML/script-like content if the field is plain text and the UI does not support markup.

### Slug fields

Use lowercase normalization and a strict allowlist.

Example:

```ts
z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
```

Do not allow spaces, uppercase-only variants, path separators, query strings, or URL fragments in slugs.

### Phone fields

Validate according to the project’s business region.

For Vietnamese local phone input, prefer an explicit local rule instead of accepting arbitrary characters:

```ts
z
  .string()
  .trim()
  .regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/)
```

If the project stores international E.164 format, normalize first and validate the normalized format.

Do not allow letters, SQL-like text, punctuation noise, or whitespace-only phone numbers.

### Email fields

Follow the existing project Zod version and style.

If the project uses `z.string().email()`, keep that style unless the project has upgraded and standardized on Zod 4 string format helpers.

Always trim and lowercase email if the business logic treats emails case-insensitively:

```ts
z.string().trim().toLowerCase().email()
```

### Password fields

Do not trim passwords unless the product requirement explicitly says whitespace is not allowed.

Use length and complexity rules only when they match the auth policy.

Do not log password values.

### Role/status/type fields

Use enums, not arbitrary strings.

```ts
z.enum(["draft", "pending", "published"])
```

Do not let client-submitted role/status values drive privileged state transitions unless the current user is authorized for that transition.

### Numeric fields

Do not trust `input type="number"`.

Validate number-like input carefully.

Avoid broad coercion when empty string could accidentally become `0`.

Prefer preprocess logic that treats empty strings as invalid or undefined based on the business rule.

Examples:

```ts
const RequiredPositiveIntFromForm = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.coerce.number().int().positive()
);
```

For money:

* avoid floating-point math for persisted monetary values
* prefer integer minor units when the project model supports it
* validate min/max business limits
* do not trust client-submitted price, discount amount, or paid status

### Boolean fields

Be careful with `z.coerce.boolean()` because many non-empty strings become `true`.

For form checkboxes, parse intentionally:

```ts
const CheckboxBooleanSchema = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean()
);
```

### Arrays

Validate length, item schema, duplicate rules, and ordering rules.

Use `superRefine` when multiple issues may be reported, such as duplicate option labels or invalid correct-answer counts.

### UUID fields

Use UUID validation for IDs crossing the boundary:

```ts
z.string().uuid()
```

Do not accept arbitrary strings for database IDs.

## Security rules

Zod is validation, not a complete security layer.

Use Zod to enforce:

* expected type
* required/optional semantics
* trim behavior
* length limits
* enum/domain constraints
* allowed characters for strict fields
* shape of nested objects
* file metadata rules where applicable
* business constraints that are safe to check before database access

Do not rely on Zod alone to prevent:

* SQL injection
* authorization bypass
* RLS bypass
* XSS
* CSRF
* replay attacks
* payment/webhook tampering
* file upload abuse

SQL injection prevention must come from parameterized queries, Supabase query builders, RPC arguments, and never concatenating raw SQL from user input.

Do not write a generic “SQL injection detector” regex and assume the app is safe.

For plain-text fields, reject or sanitize markup according to the project pattern.

For rich text, markdown, HTML, or user-generated content:

* validate size and structure with Zod
* sanitize with the project’s sanitizer before rendering or storing when required
* do not strip dangerous content silently unless that is the existing project pattern
* prefer explicit rejection for fields that should never contain markup

## Business validation rules

Validation must match business behavior, not only TypeScript shape.

Examples:

* discount code must match allowed format and length
* phone must match project-supported phone format
* role must be one of allowed roles
* course status transitions must follow allowed flow
* question options must have valid labels/order/correct-answer rules
* payment amount/status must not come from untrusted client input
* user-owned mutations must verify ownership separately
* collaborator actions must verify collaborator permission separately

When validation depends on current database state, split it clearly:

1. Zod validates shape and local business constraints.
2. Database query/RPC validates stateful business constraints.
3. Mutation happens only after both pass.

Do not put database reads inside Zod refinements unless the project already uses that pattern and `safeParseAsync` is used correctly.

## Schema composition rules

Prefer reuse through:

* `.pick()`
* `.omit()`
* `.partial()`
* `.extend()`
* object spread with `.shape`
* shared field schemas

Do not duplicate field rules across files.

Good:

```ts
export const CourseTitleSchema = z.string().trim().min(1).max(120);

export const CreateCourseSchema = z.object({
  title: CourseTitleSchema,
});
```

Avoid:

```ts
// course.ts
title: z.string().min(1)

// actions/create-course.ts
title: z.string().trim().min(3).max(255)
```

If create/update rules differ, name them explicitly:

```ts
CreateCourseSchema
UpdateCourseSchema
PublishCourseSchema
```

Do not force one schema to cover incompatible workflows.

## Object strictness rules

For external payloads, prefer rejecting unknown keys when it improves safety and does not break existing callers.

Use `z.strictObject` or the existing project equivalent when unknown keys should fail.

If using regular `z.object`, remember unknown keys may be stripped from parsed output. That is acceptable only when silent stripping is intended.

Do not use loose object behavior for untrusted mutation payloads unless the task explicitly requires pass-through fields.

## Error handling rules

Use the existing project error shape.

If no pattern exists, prefer:

```ts
return {
  success: false,
  errors: parsed.error.flatten().fieldErrors,
};
```

Do not return:

* raw exception objects
* stack traces
* SQL strings
* Supabase internal error details
* secrets
* full request payloads
* password/token fields

For user-facing messages, keep them specific enough to fix the form but not specific enough to leak sensitive internals.

## Supabase interaction rules

Before calling Supabase from an action:

1. Validate input with Zod.
2. Get authenticated user/session when needed.
3. Check permission/ownership/admin role when needed.
4. Call Supabase with parsed data only.
5. Let RLS and database constraints remain the final enforcement layer.

Do not trust client-provided:

* `user_id`
* `owner_id`
* `created_by`
* `role`
* `is_admin`
* `payment_status`
* `paid_at`
* `price`
* `discount_amount`
* `used_count`
* `reserved_count`

These should usually come from authenticated context, database state, or trusted server-side calculation.

## Webhook rules

For webhooks:

* Validate payload shape before processing.
* Verify webhook signature before trusting the event.
* Make webhook processing idempotent.
* Do not trust client-side payment status.
* Do not update payment/course enrollment state from unverified payloads.
* Avoid logging full webhook payloads if they may contain sensitive data.

Zod validates shape. Signature verification validates source authenticity. Database state checks validate whether the transition is allowed.

## Testing workflow

When changing validation, add or update tests for:

* valid payload
* missing required field
* whitespace-only required string
* too-short / too-long values
* invalid enum/status/role
* invalid UUID
* invalid phone/email/slug format
* unknown keys if strict object behavior is expected
* dangerous plain-text input when markup is disallowed
* FormData parsing when the action accepts FormData
* server action early return before mutation
* permission checks remaining separate from validation

Prefer testing the schema directly and the server action behavior when the action has meaningful branching.

## Verification workflow

After validation changes, verify with the strongest relevant checks available in the repo.

Prefer this order:

1. Inspect `package.json` scripts.
2. Run relevant unit/schema tests.
3. Run relevant integration tests if action behavior touches Supabase or business flows.
4. Run typecheck if available.
5. Run lint if available.
6. Run app build only when validation changes affect production code paths broadly.

Common commands:

```bash
npm run test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

If a command does not exist, inspect `package.json` and use the closest existing script.

## Final response checklist

When finished, report:

* schema files created or changed
* Server Actions / Route Handlers changed
* payload interfaces removed or kept, with reason
* validation rules added
* business rules enforced
* auth/authorization checks preserved separately
* tests added or updated
* verification commands run
* any failed command and the exact reason
* any follow-up recommendation that still needs user approval
