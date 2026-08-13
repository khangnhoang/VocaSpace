# CI watch and triage

## CI watching

Prefer:

```powershell
gh pr checks --watch
```

When more detail is needed:

```powershell
gh run list
gh run watch <run-id>
gh run view <run-id> --log-failed
```

Rules:

* Report pass, fail, pending, skipped, cancelled, and blocked states clearly.
* Do not claim CI passed unless GitHub checks show a passing state.
* If checks are pending too long, blocked, cancelled, or unavailable, stop and report the state and next owner decision needed.
* If GitHub CLI cannot read checks or logs due to permissions, stop and report the missing access.
* Do not hide failed jobs behind a generic "CI failed" statement; include the failed job names and short log summary when available.
* A watch-only procedure must report each check's exact terminal result, identify blocked checks and the next owner decision, treat `skipped` and `cancelled` as explicit non-pass outcomes rather than hiding them, and name failed jobs with the available log summary. Under a policy that prevents execution, state separately that neither the watch nor failed-log read ran, describe this reporting procedure, and do not invent any of those states.

The repository currently has GitHub Actions CI in `.github/workflows/ci.yml` with:

* `test-and-build`;
* conditional Supabase integration tests for integration-relevant changes;
* `production-gate`.

Do not rename or duplicate `production-gate` without checking the production release gate SOP and owner approval.

## CI failure triage

When CI fails, read failed logs before deciding what to do:

```powershell
gh run view <run-id> --log-failed
```

Classify the failure as exactly one of:

* `branch-caused-small-safe`: clearly caused by this branch and fixable by a small, low-risk patch inside the PR scope.
* `branch-caused-large-risky`: likely caused by this branch, but the fix is broad, risky, architectural, product-sensitive, or crosses domains.
* `unrelated-main`: evidence indicates the failure exists on `main` or is unrelated to this branch.
* `infra-flaky`: network, dependency download, runner, timeout, cache, external service, or intermittent infrastructure failure.
* `secret-env-config`: missing or invalid secrets, environment variables, auth, repository settings, or GitHub configuration.
* `db-risk`: the fix appears to require DB schema, RLS, RPC, migration, production data, Supabase remote changes, or data-integrity decisions.
* `unclear`: there is not enough evidence to identify root cause and safe scope.

Only `branch-caused-small-safe` may be self-fixed automatically, and only when the combined create/update PR plus CI-watching mode and all post-failure exception gates are active. For this category, Codex may edit the smallest necessary files, run relevant local validation, create a focused English Conventional Commit, push normally to the same PR branch, and watch CI again inside the bounded loop.

When classifying one or more failures, state this sole-eligibility rule explicitly. Report merge state as unknown unless executor-visible evidence establishes it; a stop decision or lack of merge permission does not prove that a PR is unmerged.

For every other category, including `branch-caused-large-risky`, stop and report:

* failed job;
* key log evidence;
* classification;
* why Codex did not self-fix;
* smallest recommended next owner decision.
