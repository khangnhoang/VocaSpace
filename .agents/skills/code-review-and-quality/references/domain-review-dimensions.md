# Domain review dimensions

Read this reference when formal or integration review inspects validation, database/concurrency, frontend/UX, tests or CI coverage, manual behavior evidence, security, performance, comments, Git state, or cross-owner change-set evidence. This includes correction re-review with post-correction tests/status, review of baseline/range/currentness/ancestry/divergence/worktree or cumulative change-set evidence, and any verdict limited by required manual behavior or a state matrix. Skip it when the task only classifies or renders already-supplied findings—even if those findings mention Git, tests, permissions, naming, or other domains—decides or prepares a bounded specialist package without main-review inspection of its sources, enforces read-only authority or blocks because the review target/range/implementation evidence is absent, or performs a small docs/metadata review with none of these boundaries.

## Validation and trust boundaries

Use `nextjs-server-action-zod`.

Check:

* server-side validation of untrusted input
* parsed data used instead of raw payload
* intentional `z.input`/`z.output`
* auth separate from validation
* privileged client fields ignored or replaced
* side effects after validation and permission
* safe result/error shapes
* correct schema/type placement
* intentional FormData, upload, and webhook handling

## Database and concurrency

Use `supabase-safe-migration`.

Check:

* migration safety for existing data
* constraints after valid backfill
* RLS boundaries and helper reuse
* justified `SECURITY DEFINER` and safe `search_path`
* permission-sensitive and idempotent RPC transitions
* short, necessary locks
* no external calls inside locks
* soft-delete behavior
* realistic indexes and integration coverage

## Frontend and UX

Use `frontend-workflow` and `frontend-design`.

Check:

* correct screen type and hierarchy
* primary, secondary, and destructive actions
* loading, empty, error, success, pending, and disabled states
* input preservation and double-submit prevention
* stale-response and optimistic rollback behavior
* permission-dependent rendering
* null, long-content, and mobile safety
* accessibility and dialog context
* shared-component safety
* real integration rather than fake success

## Tests

Use `test-quality-strategy`.

Check:

* correct test layer
* behavior-focused assertions
* regression, failure, permission, hostile-input, retry, and concurrency coverage
* deterministic fixtures
* guarantees not mocked away
* required test-plan header and accurate verification metadata
* no duplicated low-value tests

Do not require unavailable E2E infrastructure or expensive coverage when a lower layer proves the same guarantee.

## Security, performance, comments, and Git

Review security through the affected domain. A security finding must identify actor, entry point, missing boundary, impact, and mitigation.

Check realistic performance risks only: N+1 queries, unbounded work, missing pagination, duplicate requests, waterfalls, excessive rendering/subscriptions, large payloads, and lock duration. Do not demand speculative optimization.

Use `code-commenting-and-maintainability` for stale, redundant, missing, or unsupported comments and documentation.

Use `git-checkpoint-workflow` for coherent checkpoints, English Conventional Commits, correction history, branch/baseline correctness, unrelated files, secrets/artifacts, and remote-action boundaries.
