---
name: github-pr-ci-workflow
description: Safe GitHub CLI workflow for Codex/agents to create or update pull requests, reconstruct PR context, watch CI, triage failed checks, make bounded branch-caused CI fixes, and report status without merging by default.
---

# GitHub PR CI Workflow

## Activation scope

Use this skill when the owner asks Codex or another agent to:

* create, update, inspect, or prepare a GitHub pull request with GitHub CLI;
* write or refresh a PR title or PR description;
* watch GitHub Actions checks for a PR;
* read failed CI logs through GitHub CLI;
* fix a failed PR branch after CI reports a branch-caused failure;
* decide whether a PR is ready for owner review, merge, or another correction pass.

This skill is for agent execution. Keep PR titles in English. Use the language explicitly requested by the owner for generated PR descriptions and final owner reports. When no language is requested, default both to Vietnamese.

## Ownership

This skill owns:

* GitHub CLI preflight checks;
* PR context reconstruction;
* PR creation and update commands;
* CI watch commands and status reporting;
* failed-log collection and failure classification;
* bounded CI self-fix loops;
* merge permission gates for PR/CI automation.

It does not replace:

* `git-checkpoint-workflow` for local commit safety, Conventional Commit messages, branch state, staging, force-push limits, and prompt-owned changes;
* `code-review-and-quality` for readiness review and merge-risk assessment;
* `supabase-safe-migration` for database schema, RLS, RPC, migration, production-data, or Supabase CLI work;
* domain skills for application changes.

Read the related skill before acting when the PR or CI failure touches that domain.

## Core rules

* Do not create, update, watch, fix, or merge a PR before checking local Git state and GitHub CLI authentication.
* Do not use ad hoc REST API workarounds unless the owner explicitly requests that workaround in the current task.
* Do not print tokens, secrets, cookies, auth headers, private keys, service-role keys, or environment values.
* Do not create a PR from a dirty worktree unless the owner explicitly included those changes in the task.
* Do not create duplicate PRs for the same branch.
* Do not invent decisions, tests, production impact, or follow-ups.
* Do not hide CI failures.
* Do not merge by default.
* Auto-merge is a separate permission mode and requires explicit owner approval in the current task.
* The bounded PR/CI self-fix loop is a narrow exception to the default no-commit/no-push rule.
* That exception applies only after the owner explicitly asks for PR creation/update plus CI watching, a remote head and PR/check already exist, failed logs have been read, and the failure is classified as `branch-caused-small-safe`.
* The combined mode does not grant initial push, and PR-only modes never grant push.
* An explicit CI-fix-only instruction grants only the actions the owner states; never infer commit, push, re-watch, PR update, or merge.
* Never force-push unless the owner explicitly approves force-push.
* Never delete branches unless the owner explicitly asks.
* Never edit DB schema, RLS, RPC, migrations, or production-risk behavior in a generic CI fix loop.

## Preconditions

Run these commands before PR or CI automation:

```powershell
git status -sb
git status --short
git branch --show-current
git remote -v
gh --version
gh auth status
```

Stop and report when:

* the worktree is dirty and the task did not explicitly include those changes;
* the current branch is unclear or wrong for the task;
* no Git remote can be used for the PR;
* `gh` is missing;
* `gh auth status` fails or shows no usable authenticated GitHub account;
* private repository access is unavailable;
* GitHub CLI output indicates missing scopes or token permissions;
* proceeding would require printing or exposing secrets.

On Windows, `gh` authentication may be stored in Windows Credential Manager/keyring. If sandboxed execution cannot access the keyring but the owner-verified non-sandbox shell can, GitHub CLI PR/CI commands may be run only in that owner-approved non-sandbox shell. Do not fall back to REST API or print/copy tokens.

Do not install GitHub CLI or authenticate GitHub CLI unless the owner explicitly asks for that setup task.

## Permission modes

Use the narrowest mode stated by the owner. A broader-looking task name, review verdict, CI classification, or CLI prompt does not expand the selected mode.

### Inspect-only

Inspect-only may read GitHub state and failed logs, then report. It does not grant local edits, fix validation, commits, pushes, PR mutation, re-watch, or merge.

### Watch-only

Watch-only may watch existing checks and report their terminal or blocked state. A failure does not grant edit, validation, commit, push, PR update, or self-fix permission.

### Create PR only

Create-PR-only may create the requested PR only when the head branch already exists on the remote. It does not grant local edit, commit, push, CI watching, or fixing. If the remote head is missing, or `gh` offers an interactive push or fork path, decline it, stop, and request explicit push permission.

### Update PR only

Update-PR-only may perform only the requested metadata or state change, such as title, body, labels, or draft state. It does not grant local edit, commit, push, CI watching, or fixing. If the requested update requires delivering new commits, stop and request explicit push permission.

### Create/update PR plus CI watching

This combined mode may inspect state, reconstruct context, create or update the PR, watch checks, read failed logs, and report. It does not grant initial push: the remote head must already exist, or the owner must separately grant initial-push permission.

Before any failed check is classified, this mode grants only the requested PR action, watching, log reading, and reporting. The bounded self-fix exception begins only after a PR/check exists, failed logs have been read, and the failure is classified as `branch-caused-small-safe`. Then—and only then—the exception may grant the smallest focused edit, proportional validation, focused English Conventional Commit, normal same-branch push, and re-watch.

### Explicit CI-fix only

An explicit CI-fix instruction grants only the actions the owner states. An edit does not imply validation, commit, push, re-watch, PR update, or merge; each omitted action remains ungranted.

### Normal push conditions

Without separate explicit push permission, normal push is allowed only inside the bounded post-failure self-fix exception and only when all conditions are true:

* the owner explicitly requested create/update PR plus CI watching;
* the current branch is the intended PR branch;
* the remote head, PR, and relevant check already exist;
* failed logs were read and the failure was classified as `branch-caused-small-safe`;
* the pushed change is the focused commit produced by that bounded fix cycle;
* the push is a normal push to the same branch;
* the push is not a force-push.

Create-PR-only, update-PR-only, and the initial create/update step of combined mode do not grant push of an already-committed branch. If initial publication or commit delivery is required, stop and request explicit push permission. Never accept an interactive CLI push/fork operation as implicit permission.

### Auto-merge mode

Auto-merge mode is allowed only when the owner explicitly requests auto-merge in the current task.

Even in auto-merge mode, do not merge when:

* any required check is failing;
* any required check is pending;
* merge conflicts exist;
* reviewers requested changes;
* unresolved review comments are detectable;
* branch protection blocks merge;
* the PR includes DB schema, RLS, RPC, migration, production-data, deployment, or other production-risk changes without explicit owner approval;
* the risk is unclear.

If any condition fails, stop and report. Do not reinterpret "create PR", "watch CI", "ready", "approve", or "ship" as merge permission.

## Context reconstruction

When the owner asks to create or update a PR, reconstruct the PR content from reliable evidence:

```powershell
git log --oneline main..HEAD
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Read relevant full diffs when needed:

```powershell
git diff main...HEAD -- <path>
```

Use these sources:

* owner-provided current task notes;
* current-session verification output still available to Codex;
* commit history on the branch;
* cumulative diff against `main`;
* changed docs, ADR, SOP, or progress files;
* existing issue, plan, progress, or release notes in the repo.

Rules:

* If the owner provides an exact PR title, use it exactly.
* If the owner provides an exact PR body, use it exactly.
* If an exact title is not provided, write the PR title in English.
* If an exact body is not provided, write the PR description in the language explicitly requested by the owner; when no language is requested, default to Vietnamese.
* Do not invent tests, manual QA, decisions, risks, or follow-ups.
* If a decision exists only in chat and the context is unavailable, ask the owner for the missing summary or mark it as unknown.
* If the branch includes commits from earlier sessions, use Git history and repository docs instead of guessing intent.

The agent-generated PR description in the selected language must include localized equivalents of:

* tóm tắt;
* file hoặc khu vực đã thay đổi;
* test đã chạy và kết quả;
* ảnh hưởng production;
* rủi ro hoặc giới hạn;
* việc cần làm tiếp theo.

## PR creation and update

Before creating a PR, verify that the exact head branch already exists on the remote. If it does not, stop and request explicit push permission. Do not accept any interactive `gh` prompt that offers to push or fork the branch.

Before creating a PR, check whether one already exists for the current branch:

```powershell
gh pr view <branch>
```

If a PR exists:

* do not create a duplicate;
* update title, body, labels, or draft state only when the owner requested that exact metadata/state change;
* preserve owner-provided title/body unless the owner asks to replace them.
* do not deliver new commits or push under update-PR-only permission.

If no PR exists:

* create the PR with `gh pr create` only after the remote-head check passes;
* default base branch is `main` unless the repo or task says otherwise;
* prefer `--body-file` for long Markdown descriptions;
* do not merge as part of PR creation.

Recommended shape:

```powershell
gh pr create --base main --head <branch> --title "<English title>" --body-file <body-file>
```

For updates:

```powershell
gh pr edit <branch> --title "<English title>" --body-file <body-file>
```

Use a temporary body file only for PR creation/update. Do not commit temporary PR-body files unless the owner explicitly requested a checked-in artifact.

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

For every other category, including `branch-caused-large-risky`, stop and report:

* failed job;
* key log evidence;
* classification;
* why Codex did not self-fix;
* smallest recommended next owner decision.

## Self-fix loop

Self-fix is allowed only for `branch-caused-small-safe` failures.

This is the only PR/CI exception to the default no-commit/no-push rule. It begins only after the owner explicitly requested create/update PR plus CI watching, the remote head and PR/check already exist, failed logs were read, and the failure was classified as `branch-caused-small-safe`. It does not require separate owner approval for each focused fix commit and normal same-branch push inside that bounded cycle. It does not grant initial push and does not apply to PR-only, watch-only, inspect-only, or explicit-fix-only instructions.

For each attempt:

1. Make the smallest safe fix.
2. Avoid unrelated cleanup and opportunistic refactors.
3. Run relevant local checks that cover the failure.
4. Use `git-checkpoint-workflow` for commit safety.
5. Commit a focused English Conventional Commit.
6. Push to the same branch.
7. Watch CI again.

Definition:

* A fix attempt is one completed cycle of read failed logs -> edit -> local validation -> commit -> push -> re-watch CI.
* Reading logs without editing does not count as a fix attempt.
* A local-only edit that is reverted before commit does not count as a completed fix attempt, but it must be reported if relevant.

Loop limits:

* default maximum: 2 fix attempts;
* a third completed attempt is allowed only when the owner explicitly permits it;
* after the limit, stop and report instead of continuing.

The self-fix loop must not:

* broaden PR scope;
* touch DB schema, RLS, RPC, migrations, production data, or Supabase remote state;
* change secrets or GitHub repository settings;
* force-push;
* delete branches;
* make a large or risky branch-caused fix;
* mask a failing test by weakening coverage;
* skip failed logs;
* continue after root cause becomes unclear.

If a fix requires a domain skill, read it before editing. If the required skill rules conflict with generic CI self-fix, stop and report.

## Merge rules

Default:

* Do not merge.
* If CI passes, report that the PR is ready for owner review/merge.

Auto-merge:

* Only allowed when the owner explicitly requests auto-merge in the current task.
* Auto-merge still requires all safety checks below to pass.

Before any merge, verify:

```powershell
gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup
gh pr checks
```

Also verify from available GitHub CLI output:

* all required checks passed;
* no pending checks remain;
* no merge conflicts exist;
* no requested changes remain;
* no unresolved review comments are detectable;
* no branch protection or repository rule blocks merge;
* no unapproved DB/schema/RLS/RPC/migration/production-risk changes are present;
* risk is clear and acceptable under the owner's current instruction.

If any check is inconclusive, do not merge. Report what could not be verified.

## Safety rules

Codex must not:

* merge unless explicitly asked in the current task;
* force-push unless explicitly approved;
* delete local or remote branches unless explicitly asked;
* edit DB schema, RLS, RPC, migrations, or production-data behavior in a generic PR/CI fix loop;
* start unrelated cleanup;
* start Post-MVP features;
* hide CI failures;
* print secrets or tokens;
* use ad hoc REST API workarounds unless explicitly asked;
* rewrite owner-provided PR title or body;
* claim CI passed from local tests alone;
* claim a PR is safe to merge when review, checks, conflicts, or production risk are unknown.

## Final report format

Final responses for PR/CI workflow tasks must use the language explicitly requested by the owner. When no language is requested, they default to Vietnamese. Include localized equivalents of:

```text
Branch:
URL của PR:
Trạng thái PR:
- Đã tạo / đã tồn tại / đã cập nhật / chưa tạo
PR title cuối cùng (English):
Nội dung PR:
- Do agent tạo / do owner cung cấp / đã cập nhật / không đổi
Trạng thái CI:
Job thất bại và tóm tắt log:
Số lần self-fix:
Commit self-fix:
Command đã chạy:
Git status hiện tại:
Trạng thái merge:
- Đã merge / chưa merge
Blocker hoặc quyết định còn cần từ owner:
```

In every language, preserve the English PR title, commands, exact CI states, exact failure classifications, identifiers, paths, branch names, errors, permission modes, and other machine-readable values. If no PR was created or no CI was watched, say so directly and explain why.

## Final checklist

* [ ] Preconditions were checked.
* [ ] GitHub CLI is installed and authenticated.
* [ ] Worktree ownership is clear.
* [ ] PR context was reconstructed from session and repository evidence.
* [ ] Exact owner-provided title/body were preserved, when provided.
* [ ] Generated PR title is English.
* [ ] Generated PR description follows the owner's explicit language request, or defaults to Vietnamese when none was provided.
* [ ] Existing PR was checked before creating a new one.
* [ ] PR was not duplicated.
* [ ] CI was watched or a blocker was reported.
* [ ] Failed logs were read before any CI fix.
* [ ] CI failure classification used the approved taxonomy.
* [ ] Inspect-only and watch-only remained read-only/non-mutating.
* [ ] Create-PR-only used an existing remote head and neither PR-only mode inferred edit, commit, or push.
* [ ] No interactive push/fork path was accepted without explicit permission.
* [ ] Combined mode did not initial-push and entered self-fix only after an existing PR/check, failed-log review, and `branch-caused-small-safe` classification.
* [ ] Explicit-fix-only performed only the exact actions stated by the owner.
* [ ] Only `branch-caused-small-safe` failures inside the exact combined mode were self-fixed, committed, and normally pushed.
* [ ] `branch-caused-large-risky` and all unrelated/main/infra/flaky/secret/env/db/unclear failures stopped and reported.
* [ ] Normal push conditions were satisfied.
* [ ] Fix attempts stayed within the two-attempt default; any third completed attempt had explicit owner permission.
* [ ] No force-push happened without explicit approval.
* [ ] No branch was deleted without explicit approval.
* [ ] No generic CI loop changed DB schema, RLS, RPC, migrations, or production data.
* [ ] No REST workaround was used without explicit approval.
* [ ] Default mode did not merge.
* [ ] Auto-merge happened only with explicit current-task permission and passing safety gates.
* [ ] Final report follows the owner's explicit language request, or defaults to Vietnamese when none was provided.
