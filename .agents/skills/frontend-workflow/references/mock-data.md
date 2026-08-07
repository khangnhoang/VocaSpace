# Mock data

Read this reference before adding or reviewing typed mocks, or when backend behavior is missing and UI-only/prototype scope is considered. The core `SKILL.md` remains authoritative for approval, scope, no-fake-success, stop, and reporting behavior.

Typed mock data is allowed only for explicit UI-only, prototype, or unavailable-backend scope.

It must be:

* typed, deterministic, isolated, and clearly named
* easy to replace
* representative of complete, empty, error, long, null, and status variants

Do not scatter hardcoded mocks through production components.

When a production mutation is missing:

* do not show fake success
* do not deceptively update production state
* do not use local storage as a hidden backend

Use a typed callback/adapter, view-only implementation, clearly disabled action, explicit integration TODO, or stop and ask whether backend scope should be added.
