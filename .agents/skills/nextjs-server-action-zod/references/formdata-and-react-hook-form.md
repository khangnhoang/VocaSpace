# FormData and React Hook Form

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for server validation, parsed-only data, authorization, side-effect order, safe errors, and reporting.

## FormData

* Extract only expected fields.
* Use `getAll()` intentionally for repeated values.
* Treat missing, empty, and whitespace-only required values correctly.
* Validate files separately.
* Filter framework/internal keys if using `Object.fromEntries`.
* Keep reusable normalization contracts in the schema layer.

When aligning a form and server boundary, state which fields are single-valued and which are repeated. Use `getAll()` deliberately for repeated values rather than silently collapsing them through `get()` or `Object.fromEntries`.

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
