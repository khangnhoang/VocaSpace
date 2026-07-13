---
name: git-checkpoint-workflow
description: Repository-specific Git checkpoint workflow for owner-approved local commits, dirty-tree safety, staging, correction commits, branch safety, push requests, and English Conventional Commit messages.
---

# Git Checkpoint Workflow

## Activation scope

Use this skill when:

* the owner asks for or approves a commit;
* an implementation prompt is complete and needs a commit recommendation;
* working-tree, branch, staging, or ownership is unclear;
* reviewing prompt-owned changes before a possible checkpoint;
* handling correction commits, amend/squash decisions, push requests, or PR-related Git actions.

Do not use it to justify committing incomplete, conflicting, unrelated, or knowingly broken work.

## Ownership

This skill owns:

* owner-approved local commits;
* commit-readiness and staging safety;
* prompt-owned versus unrelated change separation;
* English Conventional Commit messages;
* correction history;
* amend/squash restrictions;
* local versus remote-action boundaries;
* commit reporting.

Planning, domain verification, code-review findings, and merge readiness belong to their respective skills.

## Related skills

Use:

* `implementation-planning-and-pr-breakdown` for approved prompt, task, phase, and PR boundaries;
* domain skills for required verification;
* `code-commenting-and-maintainability` for changed comments and structured documentation;
* `code-review-and-quality` for checkpoint or PR review.

## Core rules

* Do not auto-commit after every completed implementation prompt.
* After implementation, report changed files, verification, known gaps, and a recommended English Conventional Commit message.
* Commit only after the owner explicitly asks for or approves a commit.
* Owner approval can be phrased naturally, such as `commit đi`, `duyệt commit`, `commit checkpoint này`, `create the commit`, or an equivalent instruction.
* Use English Conventional Commits for the entire commit message.
* Commit locally by default.
* Never push unless the owner explicitly asks for push.
* `Commit` never implies `push`.
* Never force-push without an explicit request for that action.
* Create correction commits instead of amending or squashing by default.
* Do not mix unrelated changes.
* Do not stage changes whose ownership is unclear.
* Do not claim verification passed unless it ran.
* Do not discard work with destructive Git commands without explicit approval.

## Implementation completion report

When implementation is complete but the owner has not approved a commit, report:

```text
Changed files:
- <file>: <why it changed>

Verification:
- <command>: passed/failed/skipped/not run - <reason>

Recommended commit message:
<type>(<scope>): <imperative summary>

Remote actions:
- Nothing was pushed.
```

Do not stage or commit in this reporting step unless the owner already approved the commit.

## Commit workflow after owner approval

When the owner explicitly asks for a commit:

1. Confirm the current branch and working tree.
2. Inspect unstaged, staged, and untracked changes.
3. Identify prompt-owned changes versus unrelated or unclear changes.
4. If unrelated or unclear changes are present, stop and report before staging.
5. Run or confirm the smallest relevant verification that remains current.
6. Audit the diff for conflicts, debug code, secrets, invalid artifacts, and unrelated formatting.
7. Stage only intended files or hunks.
8. Inspect the staged diff.
9. Create one local English Conventional Commit.
10. Report the hash, message, included scope, verification, and that nothing was pushed.

Do not collapse several independent outcomes into one commit merely because they belong to one branch.

## Commit-readiness gate

Commit only when:

* the owner explicitly approved or requested the commit;
* prompt scope and acceptance criteria are complete;
* the change is coherent and reviewable;
* relevant automated checks passed, or skipped checks are explained;
* required progress documentation is current;
* branch and diff were audited;
* unrelated changes are excluded;
* no secret, debug code, conflict marker, or unexpected artifact is staged;
* the repository is not intentionally broken;
* no unresolved product or architecture decision remains.

A local commit is not final approval. Manual QA may remain pending when clearly reported.

## Do not commit

Do not checkpoint:

* without explicit owner approval;
* analysis, planning, review, or inspection with no intended file change;
* aborted or incomplete implementation;
* unresolved conflicts;
* speculative or out-of-scope work;
* temporary experiments;
* changes whose ownership cannot be separated;
* current-change failures that remain unresolved;
* a prompt that explicitly forbids commit.

A user-requested WIP commit must be labeled and reported as knowingly incomplete.

## Branch naming

Use a semantic branch prefix based on the primary purpose of the task:

* `feat/<short-kebab-case-name>`
* `fix/<short-kebab-case-name>`
* `refactor/<short-kebab-case-name>`
* `test/<short-kebab-case-name>`
* `docs/<short-kebab-case-name>`
* `chore/<short-kebab-case-name>`
* `perf/<short-kebab-case-name>`
* `ci/<short-kebab-case-name>`

Do not use generic agent prefixes such as:

* `codex/`
* `chatgpt/`
* `agent/`

Choose the prefix from the task's primary scope, not from incidental changes.

Keep the remainder concise, lowercase, and kebab-case.

Before creating a task branch, resolve the correct base branch, inspect existing local and remote branch names for conflicts, report the proposed branch name and base, and create the branch only after all checkpoint requirements pass.

## Starting state and branch safety

Before non-trivial work or any requested commit:

```bash
git branch --show-current
git status --short
```

Record the branch, dirty state, existing modified/untracked files, and missing prerequisites.

If the tree is already dirty:

* identify and preserve pre-existing changes;
* do not revert, stage, or commit them;
* use explicit path or safe hunk staging;
* stop when ownership cannot be determined.

Before committing, confirm the branch matches the approved task and baseline.

Before creating a new task branch:

* confirm the intended base branch with the owner or repository/task instructions;
* choose a semantic branch name following the Branch naming rules;
* check and record worktree cleanliness, current branch, current `HEAD`, local `main`, `origin/main`, whether the current dependency `HEAD` is already contained in `origin/main`, and whether the new task is independent or intentionally stacked;
* update the base branch from its remote only with explicit permission when network or remote state is involved;
* if fetch, pull, or network access is unavailable or not permitted, stop and report the limitation instead of guessing.

For an independent task branch, use this sequence:

1. Fetch the remote after receiving permission so `origin/main` and remote branch state are current.
2. Confirm that `origin/main` contains the latest required dependency branch or commit and that the task does not intentionally depend on unmerged work.
3. Switch to local `main`.
4. Pull `origin/main` into local `main` with fast-forward-only behavior and confirm local `main` matches `origin/main`.
5. Create the new task branch from the updated local `main`.

Do not create the task branch directly from a stale local `main`, a stale remote-tracking ref, or the current feature branch merely because it contains recent work.

If several PRs or task branches remain unmerged and it is unclear whether the new task is independent, depends on one of them, or must wait for them, fail loud: report the known branch and dependency state, then stop before creating a branch, editing, staging, or committing. Do not guess a base or silently create a stacked branch.

Create a stacked branch from the current dependency `HEAD` only when the task explicitly depends on that unmerged work. If the required dependency is already merged into current `origin/main`, follow the independent-task sequence instead.

Stop and report if the working tree is dirty, the base is unclear, local `main` cannot fast-forward cleanly, an independent task's required dependency is not present in `origin/main`, or any fetch, switch, or pull step fails.

Do not create, rename, switch, merge, or delete branches merely to silence a problem. Do not assume local `main` or the branch baseline is current.

## Ownership and staging

A commit may include implementation plus directly required:

* tests;
* schemas/types;
* migration changes;
* comments;
* documentation and progress updates.

It must not include pre-existing user/agent work, unrelated cleanup, broad formatting, unnecessary dependency changes, personal settings, environment files, or debug artifacts.

Prefer:

```bash
git add path/to/file-a path/to/file-b
```

Use hunk staging only when owned and unowned changes can be separated safely.

Avoid `git add .` or `git add -A` unless the tree began clean and every change is confirmed in scope.

Always inspect:

```bash
git diff --cached
```

## Diff audit

Before commit, inspect at minimum:

```bash
git status --short
git diff --check
git diff
git diff --cached
```

Confirm:

* only intended content is staged;
* no unrelated refactor or formatting exists;
* conflicts and debug code are absent;
* comments/docs/tests/progress match behavior;
* deletions and renames are intentional;
* generated files follow repository conventions;
* no secret, environment value, or unexpected binary is included.

Do not commit before reviewing the staged diff.

## Verification and manual QA

Choose verification from repository scripts and domain skills. Prefer the smallest set that covers the changed risk.

Do not hard-code generic commands or repeat a successful command when no relevant code changed. Rerun checks after later edits that may invalidate them.

Pending manual QA does not block a local commit when automated verification is appropriate, the implementation is coherent, and pending checks are reported. It does block merge readiness when the QA is required.

Manual-QA corrections create a new commit; do not amend by default.

## Corrections, amend, and squash

Later corrections:

* create a new commit by default;
* clearly describe the correction;
* preserve earlier checkpoints;
* remain independently understandable.

Example:

```text
feat(course-review): add rejection detail panel
fix(course-review): preserve rejection text after status refresh
```

Do not amend, squash, autosquash, or interactive-rebase unless the owner explicitly requests history cleanup.

Before rewriting history, identify affected commits, whether they were pushed, the resulting history, and whether force-push would be required. Force-push still requires a separate explicit request.

## Commit message rules

Format:

```text
<type>(<scope>): <imperative summary>
```

Common types:

```txt
feat fix refactor test docs chore perf build ci revert
```

Requirements:

* subject, body, footer, and breaking notes are entirely in English;
* use imperative mood;
* describe the completed change;
* use a meaningful scope when useful;
* avoid a trailing period, vague wording, and unverified claims;
* keep identifiers and established technical names unchanged.

Good:

```text
feat(course-authoring): add submission readiness checks
fix(course-review): preserve rejection feedback after resubmission
test(payment): cover duplicate webhook consumption
docs(skills): require owner approval before checkpoint commits
```

Avoid:

```text
fix issue
update files
misc changes
final fix
done
```

Use a body only when rationale, compatibility, risk, or a known limitation is not obvious. Do not narrate every file or put routine verification logs in the message.

## Local and remote boundaries

A successful commit is local only.

Without explicit approval, do not:

* push or force-push;
* create/update a remote branch;
* open, update, merge, or close a PR;
* create tags or releases;
* deploy;
* push migrations;
* modify remote environments.

A request to save, checkpoint, or commit does not authorize any remote action.

Before a requested push, confirm the exact branch and commits, remote branch state, and that force-push is not needed unless explicitly approved.

PR readiness and description are reviewed separately; known blockers require a draft or no PR unless the owner decides otherwise.

## Conflicts and destructive commands

For merge, rebase, cherry-pick, or sync conflicts:

* inspect both sides and repository intent;
* preserve unrelated changes;
* use relevant domain skills;
* run affected verification;
* create a new correction commit only after owner approval;
* stop when a product decision is required.

Do not broadly choose `ours` or `theirs`.

Do not run commands that may discard work without explicit approval, including:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
```

Inspect state before aborting merge/rebase operations because conflict-resolution work may be lost.

## Files, artifacts, and secrets

Commit generated files only when repository conventions require them.

Do not commit environment files, credentials, private keys, build output, caches, temporary files, personal settings, or debug dumps.

Review the actual staged diff for passwords, tokens, API/service-role keys, connection strings, webhook secrets, cookies, or personal values. Keyword search is only supplementary.

If a secret is found: unstage and remove it safely, do not commit or push, report the issue, and follow rotation guidance if exposure already occurred.

## Failure handling

If verification fails because of the current change:

* fix it when in scope and rerun;
* stop when resolution requires scope expansion or a product decision;
* do not commit broken work unless an explicit WIP commit is requested.

For an unrelated pre-existing failure, confirm and document evidence; do not silently fix it.

If commit or hooks fail, report the exact reason, preserve the tree, fix only in-scope causes, and do not bypass hooks with `--no-verify` without explicit approval.

## Final report after an approved commit

```text
Commit:
<hash> <English Conventional Commit message>

Included:
- <logical area or files>

Verification:
- <command>: passed
- <command>: failed/skipped/not run - <reason>

Manual QA:
- completed/pending/not applicable

Remote actions:
- Nothing was pushed.
```

## Final checklist

* [ ] Owner explicitly approved or requested the commit
* [ ] Scope and acceptance criteria are complete
* [ ] Progress docs and relevant verification are current
* [ ] Branch, dirty-tree ownership, and staged diff were audited
* [ ] Only prompt-owned changes are staged
* [ ] No conflicts, debug code, secrets, or invalid artifacts remain
* [ ] Commit boundary is coherent
* [ ] The entire commit message is in English and follows Conventional Commits
* [ ] New correction commit is used by default
* [ ] Commit is local
* [ ] Nothing was pushed
