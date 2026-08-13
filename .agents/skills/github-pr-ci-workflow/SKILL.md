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

Do not activate `git-checkpoint-workflow` merely because a task creates, updates, reviews, or merges a PR. It applies when the task actually requires local branch, staging, commit, history, or push procedure. Likewise, do not activate `maintain-repo-skills` merely because a CI failure is described as a documentation defect; activate it only when the repo-local skill artifact, routing, governance, or evidence contract itself is in scope.

For create-PR-only with a missing remote head, this skill owns the stop and push-permission request. Do not activate `git-checkpoint-workflow` unless the owner separately requests or authorizes the local branch or push work.

## Resource routing

Read only the references whose conditions match:

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [references/pr-create-update.md](references/pr-create-update.md) | Read before reconstructing PR context or creating or updating PR metadata or state, including a create-PR missing-head stop or a combined update/self-fix procedure that cannot execute under P0 | The task is inspect-only or watch-only and no PR mutation is requested |
| [references/ci-watch-and-triage.md](references/ci-watch-and-triage.md) | Unless supplied or observed facts establish a failed core precondition, read before watching checks, reading failed logs, classifying a failure, reporting CI status, or verifying CI gates for merge | A supplied or observed fact establishes a failed precondition, or the task changes only PR metadata and does not inspect or watch CI |
| [references/ci-self-fix.md](references/ci-self-fix.md) | Read only after an existing PR/check failed, logs were read, and the failure was classified as `branch-caused-small-safe` under authorized combined mode | The mode is not combined or the failure is any other classification |
| [references/merge-and-auto-merge.md](references/merge-and-auto-merge.md) | Read only when the owner explicitly requests merge or auto-merge in the current task; also read [references/ci-watch-and-triage.md](references/ci-watch-and-triage.md) for the required CI gates | The current task does not explicitly request merge or auto-merge |

Do not read every reference merely because this skill is active. Each referenced procedure remains subordinate to the permission and stop rules in this core.

A supplied CI failure, domain-risk fact, or requested failure classification is not a failed core precondition. Read [references/ci-watch-and-triage.md](references/ci-watch-and-triage.md) before assigning an exact failure category, including `db-risk`, then route the owning domain skill and stop before any ungranted fix.

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
* Treat executor-visible supplied facts as known. A read-only or P0 policy prevents live actions but does not erase supplied branch, PR, check, log, classification, permission, or execution facts; require new runtime evidence only for an action or result that was not supplied or observed.
* When an exact authorized action is supplied without an unnecessary identifier or implementation detail, describe and bound that action at the supplied specificity. Do not declare the action undefined, invent missing detail, or expand the evidence request to unrelated actions.

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

If supplied or observed facts establish that a precondition fails, stop and report from this core before reading a conditional procedure reference. A read-only policy that prevents running the precondition commands does not itself establish that a precondition failed; when the task asks for a conditional procedure, read its matching reference and distinguish the unexecuted procedure from observed state.

When execution policy prevents these checks, account for all six precondition commands as not run and require the output of all six before claiming the preflight ran successfully. Do not omit `gh --version`, `gh auth status`, branch, remote, or either worktree-status check.

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

When the exact grant is limited to a local edit and focused validation, do not add Git/GitHub preflight or remote evidence requirements. Those preconditions become relevant only if an authorized action actually needs Git or GitHub state.

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
Commit(s) của PR:
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
