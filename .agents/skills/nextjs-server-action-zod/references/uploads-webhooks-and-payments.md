# Uploads, Webhooks, and Payments

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for parsed-only data, authorization/state separation, side-effect order, privileged fields, business/security boundaries, Supabase order, safe errors, and reporting.

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

Zod validates metadata/shape, but deeper file inspection may still be required. State this limit explicitly during upload review: declared filename, extension, MIME/content type, and size do not prove actual file contents, so use deeper content inspection when the threat model or repository contract requires it.

## Webhooks and payments

* Validate payload shape.
* Verify webhook authenticity/signature.
* Check allowed current state.
* Make processing idempotent.
* Reject untrusted client payment state.
* Avoid logging sensitive full payloads.
* Do not update payment/enrollment from unverified events.

Shape validation, source authenticity, and DB-state validity are separate guarantees.
