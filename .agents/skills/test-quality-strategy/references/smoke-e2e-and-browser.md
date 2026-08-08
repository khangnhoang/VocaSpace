# Smoke E2E and Browser Coverage

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for test-layer choice, verification scope, evidence claims, and reporting.

## Smoke E2E and browser coverage

The repository has working smoke E2E infrastructure. Keep the suite small and stable, and use it to protect broad critical flows that benefit from real browser execution.

Before planning, writing, or running E2E, inspect the existing browser config, scripts, fixtures, environment setup, route strategy, and scenarios. Reuse the established tooling and command.

Do not require smoke E2E for every change. Prefer a lower test layer when it proves the same guarantee faster and more deterministically. Add or extend E2E when the risk crosses multiple real boundaries, such as navigation, client/server integration, authentication, persistence, or a critical multi-step user flow.

Do not ask the owner to repeatedly run smoke/E2E tests for ordinary refactor checkpoints. Ask for smoke/E2E only when lower-level verification is insufficient or the change affects a critical browser workflow or cross-boundary integration.

Do not invent another browser framework or claim a flow is covered unless an existing or newly added repository test actually protects it.
