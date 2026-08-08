# Server Actions and Route Handlers

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for parsed-only data, authorization/state separation, side-effect order, privileged fields, business/security boundaries, safe errors, and reporting.

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
