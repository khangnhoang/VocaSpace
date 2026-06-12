---

name: nextjs-server-action-zod
description: Next.js Server Actions, Route Handlers, API payloads, FormData, query params, route params, search params, webhook payloads, Zod schemas, safeParse, inferred types, DTO/interface types, validation, business rules, server-side input validation, React Hook Form validation, client/server boundary type-safety, and schema/type SSOT (Single Source of Truth). Enforces SSOT placement: Codex must decide whether each schema, DTO, interface, request/response payload type, inferred type, helper input/output type, or form submit type belongs in the closest schema module or can remain local before editing. Do not define reusable schemas/types inline in API routes, Server Actions, helpers, or UI files. Use before editing actions, route handlers, forms, schemas, helpers, or payload types that cross client/server boundaries. Do not use for database migrations unless validation call sites are also changing.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Next.js Server Action Zod Skill

## Activation scope

Use this skill when a task touches input validation, payload typing, or schema/type SSOT across a trust boundary, including:

* Next.js Server Actions
* Route Handlers
* API request payloads
* API response payloads reused by client/server code
* FormData parsing
* query params
* route params
* search params
* webhook payload validation
* Zod schemas
* form schemas
* server-side validation errors
* payload interfaces or DTO types
* request/response types
* helper input/output types that represent external or validated data
* `safeParse`, `parse`, `safeParseAsync`, `parseAsync`
* `z.infer`, `z.input`, `z.output`
* validation shared between client forms and server mutations
* React Hook Form validation
* client/server boundary type-safety
* upload handlers
* payment handlers
* webhook handlers
* helper functions that normalize, validate, or shape external input
* schema/type SSOT
* Single Source of Truth decisions
* reusable vs local interface placement
* moving inline payload interfaces/types into schema modules
* deciding whether a type belongs in UI-local code, helper-local code, or `src/lib/schemas`
* preventing duplicated validation rules across API, helper, UI, tests, and schema files

Do not use this skill for pure UI-only state that never crosses a client/server or external input boundary.

Do not use this skill for database migrations unless validation call sites, schema files, Server Actions, Route Handlers, or API payloads are also changing.

## Related skills

Also use `supabase-safe-migration` when the task changes or depends on Supabase/PostgreSQL behavior, including:

* migrations
* tables
* columns
* indexes
* constraints
* enums
* RLS policies
* RPC functions
* triggers
* SQL helper functions
* seed data
* integration tests that depend on database behavior
* race-condition-sensitive database logic
* Supabase Storage policies

If a task touches both database behavior and validation/API call sites, read and follow both skills before editing.

## Core rules

* Treat Zod schemas as the source of truth for untrusted input.
* Treat schema/type SSOT as a project-level architecture rule, not an optional cleanup.
* Keep reusable schemas, payload contracts, DTOs, and inferred types in the closest existing schema module.
* Before creating any `type` or `interface`, decide whether it is:

  * a schema-owned SSOT contract
  * a schema-inferred payload type
  * a local UI-only type
  * a local helper-only implementation type
* Do not define reusable Zod schemas, DTOs, interfaces, request payload types, response payload types, or inferred types inline inside API route files, Server Action files, helper files, or UI files.
* Do not define manual TypeScript interfaces for action/API payloads when a Zod schema can infer the type.
* Prefer `export type XInput = z.infer<typeof XSchema>` or `z.input` / `z.output` when transforms make input and output differ.
* Validate all untrusted input on the server before mutation.
* Client-side validation is only UX. It does not replace server-side validation.
* Never trust a payload because it came from the app UI.
* Never mutate database state, call payment logic, send emails, upload files, or trigger side effects before validation passes.
* Use only `parsed.data` after `safeParse` succeeds.
* Do not continue using the original raw payload after validation.
* Avoid `any` for payloads. If `any` or `unknown` is unavoidable, it must be immediately parsed by Zod.
* Keep validation close to the trust boundary, but keep reusable schemas/types in shared schema files.
* Do not hide business-rule changes inside validation without checking existing behavior and call sites.
* Do not weaken validation just to make TypeScript, tests, or UI code pass.
* Do not use Zod validation as authorization. Auth and permission checks must remain explicit.
* Do not expose stack traces, raw Zod internals, SQL errors, Supabase errors, or secret details to the client.
* Make the smallest validation/type change that satisfies the requested behavior.

## SSOT rules

SSOT means Single Source of Truth.

For validation and payload typing, the schema layer is the SSOT.

Codex must reason about schema/type/interface placement before editing API routes, Server Actions, helpers, forms, or UI files.

The goal is repo-wide consistency:

* one source of truth for reusable validation rules
* one exported inferred type for each reusable payload contract
* no duplicated payload interfaces across API/helper/UI/test files
* no slightly different validation rules for the same domain field
* no local interface that secretly represents a reusable server/client boundary contract

### Schema-owned SSOT contracts

Put the schema/type in the closest `src/lib/schemas/<domain>.ts` file when any of these are true:

* it describes untrusted input
* it describes validated output from untrusted input
* it describes a Server Action payload
* it describes a Route Handler request body
* it describes a Route Handler response body reused by client code
* it describes `FormData` after extraction or normalization
* it describes query params, route params, or search params
* it describes webhook payloads
* it describes upload payloads or upload validation result
* it describes RPC arguments
* it maps to database columns, enums, or mutation payloads
* it is used by both UI and server code
* it is used by both implementation and tests
* it is imported by more than one module
* it represents a domain concept such as course, exercise, question, payment, discount, user, role, media, enrollment, collaborator, topic, lesson, or option
* it is likely to be reused by future create/update/detail/list flows
* it would cause duplicated validation rules if kept local

Use Zod as the SSOT:

```ts
export const CreateCourseSchema = z.object({
  title: CourseTitleSchema,
  description: CourseDescriptionSchema.optional(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
```

When input and output differ because of transforms, use explicit input/output types:

```ts
export type CreateCourseRawInput = z.input<typeof CreateCourseSchema>;
export type CreateCourseInput = z.output<typeof CreateCourseSchema>;
```

### Local UI-only types

A local UI type or interface is allowed only when all of these are true:

* it is private to one UI file or one small UI component group
* it only describes rendering state or component props
* it does not cross a client/server or external input boundary
* it is not a request payload
* it is not a response payload reused by another module
* it is not a DTO
* it is not a domain validation contract
* it is not used by both UI and server code
* it is not likely to be imported by tests or other features
* a Zod schema would add no validation value

Acceptable local examples:

```ts
type LocalRenderState = "idle" | "uploading" | "done" | "error";
```

```ts
type QuestionOptionDraftRow = {
  tempId: string;
  isExpanded: boolean;
};
```

```ts
interface CourseCardProps {
  title: string;
  description?: string;
  onClick?: () => void;
}
```

These are UI rendering or component props, not trust-boundary payload contracts.

### Component props placement

Component props may stay near the component when they only describe rendering behavior.

Good local UI props:

```ts
interface QuestionOptionEditorProps {
  value: QuestionOptionDraftRow[];
  disabled?: boolean;
  onChange: (value: QuestionOptionDraftRow[]) => void;
}
```

But if props mirror a submitted payload or domain contract, import the schema-inferred type instead:

```ts
import type { UpdateQuestionOptionsInput } from "@/lib/schemas/exercise";
```

If a form component receives initial values that mirror server/domain data, check whether an existing schema-inferred type or database-derived type should be reused instead of creating a new interface.

### Helper-local implementation types

Helper-local types are allowed only for private implementation details.

Good:

```ts
type UploadAttempt = {
  startedAt: number;
  retryCount: number;
};
```

Bad:

```ts
type UploadMediaPayload = {
  type: "image" | "audio";
  file: File;
};
```

`UploadMediaPayload` is a trust-boundary/upload validation contract, so it belongs in the schema layer.

### API and Route Handler types

Avoid defining reusable payload interfaces directly inside `app/api/**/route.ts`.

Good:

```ts
// src/lib/schemas/exercise.ts
export const UploadQuestionGroupMediaSchema = z.object({
  type: z.enum(["image", "audio"]),
});

export type UploadQuestionGroupMediaInput = z.infer<
  typeof UploadQuestionGroupMediaSchema
>;
```

Good:

```ts
// app/api/question-group-media/route.ts
import {
  UploadQuestionGroupMediaSchema,
  type UploadQuestionGroupMediaInput,
} from "@/lib/schemas/exercise";
```

Avoid:

```ts
// app/api/question-group-media/route.ts
interface UploadQuestionGroupMediaInput {
  type: "image" | "audio";
}
```

A Route Handler may define a tiny local type only when it is truly response-local, not reused elsewhere, and not a domain contract.

If the response shape is consumed by UI, tests, or helpers, prefer exporting it from the schema/domain layer.

### Server Action types

Server Action input/output contracts should usually come from schema modules.

Avoid:

```ts
// actions/create-course.ts
interface CreateCoursePayload {
  title: string;
  description?: string;
}
```

Prefer:

```ts
// src/lib/schemas/course.ts
export const CreateCourseSchema = z.object({
  title: CourseTitleSchema,
  description: CourseDescriptionSchema.optional(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
```

Then:

```ts
// actions/create-course.ts
import {
  CreateCourseSchema,
  type CreateCourseInput,
} from "@/lib/schemas/course";
```

### Test types

Do not create schema-like payload interfaces only in test files.

Tests should import schema contracts from the schema layer when testing reusable payload behavior.

A test-local type is allowed only when it describes test harness internals, mocks, or local fixture builders that do not become app contracts.

## SSOT placement workflow

Before editing validation, API routes, Server Actions, helpers, forms, or tests:

1. Search existing schema modules in `src/lib/schemas`.
2. Identify the domain schema file closest to the task.
3. List every new or changed `type`, `interface`, and Zod schema needed by the task.
4. For each one, classify it as:

   * schema-owned SSOT contract
   * schema-inferred payload type
   * local UI-only type
   * local helper-only implementation type
   * test-only harness type
5. Move schema-owned contracts to the closest schema module.
6. Export inferred types from the schema module.
7. Import schemas/types into API routes, Server Actions, helpers, forms, and tests.
8. Do not duplicate the same field rules in multiple files.
9. Do not create manual interfaces for payloads that can be inferred from Zod.
10. If a local type is kept, ensure it is not exported as a reusable payload/domain contract.
11. If Codex thinks an inline interface/type is justified, it must be able to explain why the type is local-only and not a trust-boundary contract.

Codex must not start implementation until this placement decision is complete.

## Required workflow

### Before editing

Before writing or changing validation/type-boundary code:

1. Identify whether the task touches a trust boundary:

   * Server Action input
   * Route Handler input
   * API payload
   * API response consumed outside the route file
   * FormData
   * query params
   * route params
   * search params
   * webhook payload
   * upload payload
   * React Hook Form submit payload
   * helper code that normalizes external input
2. Inspect existing schema files, especially `src/lib/schemas`.
3. Inspect related Server Actions, Route Handlers, forms, helpers, tests, and call sites.
4. Check whether a schema already exists and can be reused, extended, picked, omitted, partially applied, or composed.
5. Check existing error return shape before introducing a new one.
6. Check whether the payload maps to database columns, enums, RLS expectations, RPC arguments, Storage paths, or business rules.
7. Decide schema/type/interface placement using the SSOT placement workflow.
8. Decide whether the change needs:

   * schema unit tests
   * Server Action tests
   * Route Handler/API tests
   * React Hook Form tests
   * integration tests
   * smoke/E2E tests
   * typecheck
   * lint
9. Surface conflicts before editing.

Do not start editing API route, Server Action, helper, or form files until schema/type/interface placement is decided.

### While editing

When editing validation/type-boundary code:

1. Reuse existing schemas and field schemas where possible.
2. Create new schemas only when the input boundary or business rule is genuinely different.
3. Place reusable schemas/types/interfaces in the closest schema module.
4. Keep API routes, Server Actions, and helpers focused on orchestration, not duplicated payload contracts.
5. Parse raw input at the trust boundary.
6. Return early on validation failure.
7. Use only parsed/normalized data after validation.
8. Keep auth/permission checks separate from validation.
9. Perform mutations or side effects only after validation and authorization pass.
10. Preserve existing result/error shape unless the task requires changing it.
11. Add useful Vietnamese comments for non-trivial functions and data-flow stages.
12. Avoid unrelated refactors.

### After editing

After editing:

1. Verify no reusable schema/type/interface was defined inline in API route, Server Action, helper, UI, or test files.
2. Verify the relevant schema module owns the reusable validation contract.
3. Verify call sites import schemas/types instead of duplicating them.
4. Verify local types are truly UI-only, helper-only, or test-harness-only implementation details.
5. Verify raw payload is not used after `safeParse` succeeds.
6. Verify side effects happen only after validation succeeds.
7. Verify auth/permission checks remain separate from Zod validation.
8. Verify useful comments exist for non-trivial functions and long data flows.
9. Run or recommend the smallest relevant verification command.
10. Report exactly what changed and what was verified.

## Schema/type SSOT file placement rules

Put reusable schemas and boundary payload types in the closest existing schema module.

Prefer:

```txt
src/lib/schemas/<domain>.ts
```

Examples:

* course creation/update payloads: `src/lib/schemas/course.ts`
* exercise/question payloads: `src/lib/schemas/exercise.ts` or `src/lib/schemas/question.ts`
* payment/discount/webhook payloads: `src/lib/schemas/payment.ts`
* user/profile/auth payloads: `src/lib/schemas/user.ts` or `src/lib/schemas/auth.ts`
* upload/media payloads: the closest domain schema file, usually `src/lib/schemas/exercise.ts` for exercise/question media
* enrollment/progress payloads: the closest enrollment/progress schema file if it exists, otherwise the closest domain schema file

API route files, Server Action files, helpers, forms, and tests should import schemas/types from schema modules.

Avoid placing reusable schemas/types in:

* `app/api/**/route.ts`
* Server Action files
* helper files
* React component files
* form component files
* test files only
* inline function bodies

Inline schemas are allowed only when all are true:

* the schema is private to one tiny implementation detail
* it does not represent a reusable request/response/domain payload
* it is not needed by tests, forms, Server Actions, Route Handlers, or helpers
* moving it to a schema module would add no clarity
* it does not duplicate field rules that already exist in a schema module

When unsure, put the schema in the schema layer.

## Existing-code inspection workflow

Before writing or changing validation:

1. Inspect existing schema files in `src/lib/schemas`.
2. Inspect the related Server Action, Route Handler, form component, helper, and server-side call sites.
3. Check whether a schema already exists and can be reused, extended, picked, omitted, or refined.
4. Check whether an interface/type already exists and whether it should be replaced by a schema-inferred type.
5. Check existing error return shape before introducing a new one.
6. Check whether the payload maps to database columns, enums, RLS expectations, or RPC arguments.
7. Check whether the same payload is used by client validation, server validation, tests, fixtures, or helpers.
8. Make the smallest schema/type placement change that satisfies the requested behavior.

Do not create duplicate schemas with slightly different rules unless the input boundary is genuinely different.

Do not create duplicate interfaces that mirror existing schema-inferred types.

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
* Server Action input types should come from schema modules unless the action has no reusable payload contract.

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

## Route Handler rules

For Route Handlers:

* Validate request body, FormData, query params, route params, and search params server-side.
* Keep request parsing, validation, auth, mutation/side effects, and response shaping clearly separated.
* Return stable JSON for expected validation failures.
* Do not leak internal errors to the client.
* Do not trust user-submitted IDs, paths, filenames, roles, statuses, payment states, or privileged fields.
* Prefer server-generated paths and IDs for permission-sensitive uploads.
* Keep reusable request/response schemas in schema modules.
* Avoid defining reusable `interface` or `type` contracts directly in `route.ts`.

Preferred flow:

```ts
// Nhận request từ client, validate payload tại server boundary rồi mới chạy auth và side effect.
// Data flow: raw request -> schema validation -> auth/permission -> mutation/upload -> safe response.
export async function POST(request: Request) {
  // 1. Parse raw request.
  // 2. Validate payload.
  // 3. Check auth/session.
  // 4. Check permission/business rule.
  // 5. Perform mutation/upload/side effect.
  // 6. Return safe response.
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
* Keep reusable FormData normalization schemas/types in the schema layer.

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

## React Hook Form rules

React Hook Form validation is UX only. It does not replace server-side validation.

When changing a form:

* Reuse the same schema contract when the form and server boundary share the same rules.
* Use separate create/update schemas when the workflows genuinely differ.
* Keep default values aligned with schema input expectations.
* Validate dynamic fields, arrays, optional fields, and nested objects intentionally.
* Keep submit payload shape aligned with the Server Action or Route Handler schema.
* Do not add form-only types that duplicate reusable schema-inferred types.
* Test dynamic form behavior when adding/removing fields or options changes payload shape.
* Make user-facing validation messages clear enough for the user to fix the input.

When React Hook Form needs a UI-specific type, make sure it does not replace the server payload schema.

If the form submit payload crosses into a Server Action or Route Handler, the submit payload type should usually come from `z.input` or `z.output` of the schema contract.

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

## Upload and file validation rules

For uploads:

* Validate file existence, type, size, extension, and content type server-side.
* Do not trust `File.name` for storage paths.
* Prefer server-generated paths for permission-sensitive uploads.
* Do not trust client-provided bucket names or paths.
* Check auth and permission before upload when the upload is restricted.
* Use safe user-facing errors and log raw errors only server-side.
* Keep reusable file validation in schema/helper modules, not inline in Route Handlers.
* Do not expose internal Storage error details to the client.

Zod can validate metadata and payload shape. Additional file inspection may still be needed depending on the project’s upload model.

## Webhook rules

For webhooks:

* Validate payload shape before processing.
* Verify webhook signature before trusting the event.
* Make webhook processing idempotent.
* Do not trust client-side payment status.
* Do not update payment/course enrollment state from unverified payloads.
* Avoid logging full webhook payloads if they may contain sensitive data.

Zod validates shape. Signature verification validates source authenticity. Database state checks validate whether the transition is allowed.

## Commenting rules

Use Vietnamese comments when comments are needed in project source code, unless the surrounding file has a strong English-only convention.

Comments should make code readable for a future maintainer, not restate syntax.

For non-trivial exported functions, Route Handlers, Server Actions, upload handlers, webhook handlers, validation helpers, parser helpers, and data-normalization helpers, add a short comment before the function explaining:

* what the function does
* what problem it solves
* what trust boundary it controls
* what data flow it owns
* what side effect or mutation it protects

Inside long functions, comment meaningful data-flow stages, such as:

* raw input extraction
* type narrowing
* schema/FormData validation
* auth/session lookup
* role/permission check
* business-rule check
* mutation/upload/side effect
* response shaping
* safe error handling

Good:

```ts
// Nhận multipart media từ form, validate type/file server-side rồi upload vào bucket tương ứng.
// Data flow: FormData -> type/file narrow -> media validation -> auth/role check -> Storage upload -> public URL response.
export async function POST(request: Request) {
  // ...
}
```

Good:

```ts
// Chuẩn hoá payload từ form trước khi đưa qua schema để Server Action chỉ xử lý dữ liệu đã validate.
const rawPayload = {
  title: formData.get("title"),
  description: formData.get("description"),
};
```

Bad:

```ts
// Gọi safeParse.
const parsed = CreateCourseSchema.safeParse(rawPayload);
```

Bad:

```ts
// Nếu lỗi thì return.
if (!parsed.success) return;
```

Do not add noisy comments for obvious syntax.

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
* SSOT placement when a reusable payload/interface/schema is moved out of API/helper/UI files

Prefer testing the schema directly and the server action behavior when the action has meaningful branching.

## Testing matrix

Choose the smallest useful test set based on the validation/type-boundary change.

* Pure schema behavior change:

  * schema unit tests for valid and invalid payloads
  * edge cases for required/optional strings, enums, UUIDs, arrays, transforms, defaults, and refinements

* SSOT refactor only:

  * typecheck when available
  * existing relevant tests
  * no behavior-only test is required if runtime behavior is unchanged
  * add tests only if the refactor exposes missing validation coverage

* Server Action validation change:

  * tests for valid payload
  * tests for invalid payload
  * tests proving mutation/side effect does not run when validation fails
  * tests proving auth/permission checks remain separate when practical

* Route Handler/API validation change:

  * tests for valid request
  * tests for invalid request
  * tests for malformed body/FormData/query params
  * tests for safe error response shape

* React Hook Form behavior change:

  * form tests for default values
  * validation messages
  * dynamic fields
  * disabled states
  * submit payload shape
  * add/remove option behavior when relevant

* Upload validation change:

  * valid file type/size
  * invalid file type
  * too-large file
  * missing file
  * invalid media type
  * unauthorized upload if relevant
  * safe error response

* Webhook/payment validation change:

  * valid webhook payload
  * invalid payload shape
  * invalid signature when applicable
  * idempotency/retry behavior when practical
  * invalid state transition

* Bug fix:

  * regression test that fails before the fix and passes after the fix

* Critical user flow affected:

  * smoke/E2E happy path
  * failure-path test if validation affects user-visible behavior

Do not add E2E tests for every schema-only change.

Prefer unit tests for pure schema behavior.

Prefer integration tests for server validation contracts and Supabase-backed behavior.

Prefer smoke/E2E tests only for critical flows or cross-layer regressions.

## Verification workflow

After validation changes, verify with the strongest relevant checks available in the repo.

Prefer this order:

1. Inspect `package.json` scripts.
2. Run relevant unit/schema tests.
3. Run relevant integration tests if action behavior touches Supabase or business flows.
4. Run form/UI tests if React Hook Form behavior changed.
5. Run typecheck if available.
6. Run lint if available.
7. Run app build only when validation changes affect production code paths broadly.

Common commands:

```bash
npm run test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

If a command does not exist, inspect `package.json` and use the closest existing script.

For database-dependent validation changes, `npx supabase db reset` may also be required under the Supabase safe migration skill.

## SSOT final verification

After editing, verify:

* no reusable request payload type is defined inline in API routes
* no reusable response payload type is defined inline in API routes when reused elsewhere
* no reusable DTO/interface is defined inline in helpers
* no reusable schema is defined inline in API routes, Server Actions, helpers, forms, or tests
* no form submit payload duplicates a schema-inferred type
* no Server Action input/output type duplicates a schema-inferred type
* no Route Handler request/response type duplicates a schema-inferred type
* no route params/search params/query params validation is duplicated outside schema modules
* all reusable schemas/types are exported from the closest schema module
* API routes, Server Actions, helpers, forms, and tests import schema contracts from the schema layer
* local types are truly UI-only, helper-only, or test-harness-only implementation details
* every local type/interface has a clear reason to stay local
* schema/type names are consistent with existing project naming
* no duplicate field validation rule was introduced

## Anti-patterns

Do not:

* define reusable schemas inline in API route files
* define reusable schemas inline in Server Action files
* define reusable schemas inline in helper files
* define reusable DTOs/interfaces inline in API route files
* define reusable DTOs/interfaces inline in helper files when a schema-inferred type should own the contract
* define reusable request/response payload types inline in UI files
* duplicate field validation rules across files
* create manual interfaces for payloads that can be inferred from Zod
* keep a local interface only because it is faster than placing it in the schema layer
* weaken validation to make UI or tests pass
* use client-side validation as the only validation
* mutate database state before validation succeeds
* call payment logic before validation succeeds
* upload files before validation succeeds
* send emails before validation succeeds
* continue using raw payload after `safeParse` succeeds
* use `any` for payloads without immediately parsing through Zod
* trust client-provided privileged fields
* put auth/permission decisions inside Zod as a replacement for explicit authorization
* return raw Zod errors, SQL errors, Supabase internals, stack traces, secrets, or full payloads to the client
* add generic SQL-injection detector regexes and assume the app is safe
* hide unrelated refactors inside a validation task
* add E2E tests for every schema-only change
* create duplicate create/update schemas when composition would work
* force one schema to cover incompatible workflows
* use async refinements with regular `safeParse`

## Final response checklist

When finished, report:

* schema files created or changed
* Server Actions changed
* Route Handlers changed
* helper files changed
* form files changed
* UI files changed
* tests changed
* payload interfaces removed or kept, with reason
* local interfaces/types kept, with reason
* reusable inline schemas/types moved to schema modules
* schema/type SSOT placement decisions made
* validation rules added
* business rules enforced
* auth/authorization checks preserved separately
* upload/webhook/payment safeguards preserved when relevant
* tests added or updated
* verification commands run
* any failed command and the exact reason
* any skipped command and why it was skipped
* any follow-up recommendation that still needs user approval
