# Local commit and staging procedure

## Commit workflow after permission is established

Use this workflow when the owner explicitly asks for a commit or when `github-pr-ci-workflow` has activated its exact bounded post-failure exception:

1. Confirm the current branch and working tree.
2. Inspect unstaged, staged, and untracked changes.
3. Identify prompt-owned changes versus unrelated or unclear changes.
4. If unrelated or unclear changes are present, stop and report before staging.
5. Run or confirm the smallest relevant verification that remains current.
6. Audit the diff for conflicts, debug code, secrets, invalid artifacts, and unrelated formatting.
7. Stage only intended files or hunks.
8. Inspect the staged diff.
9. Create one local English Conventional Commit.
10. Report the hash, message, included scope, verification, and exact remote-action state. For an owner-approved local checkpoint, state that nothing was pushed; for the narrow PR/CI exception, route the remote report to `github-pr-ci-workflow`.

Do not collapse several independent outcomes into one commit merely because they belong to one branch.

## Commit-readiness gate

Commit only when:

* the owner explicitly approved/requested the commit, or the exact bounded `github-pr-ci-workflow` exception is active;
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

* without explicit owner approval or the exact bounded `github-pr-ci-workflow` exception;
* analysis, planning, review, or inspection with no intended file change;
* aborted or incomplete implementation;
* unresolved conflicts;
* speculative or out-of-scope work;
* temporary experiments;
* changes whose ownership cannot be separated;
* current-change failures that remain unresolved;
* a prompt that explicitly forbids commit.

A user-requested WIP commit must be labeled and reported as knowingly incomplete.

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

Describe the selected explicit path-based or hunk-based staging method; do not leave the separation mechanism implicit.

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

## Files, artifacts, and secrets

Commit generated files only when repository conventions require them.

Do not commit environment files, credentials, private keys, build output, caches, temporary files, personal settings, or debug dumps.

Review the actual staged diff for passwords, tokens, API/service-role keys, connection strings, webhook secrets, cookies, or personal values. Keyword search is only supplementary.

If a secret is found: preserve unrelated work, unstage and remove only the task-owned secret safely, do not commit or push, report the issue, and require credential rotation when exposure occurred or may have occurred. Resume only after ownership is resolved and an exact staged-diff inspection proves that task scope is isolated and no credential remains.

## Failure handling

If verification fails because of the current change:

* fix it when in scope and rerun;
* stop when resolution requires scope expansion or a product decision;
* do not commit broken work unless an explicit WIP commit is requested.

For an unrelated pre-existing failure, confirm and document evidence; do not silently fix it.

If commit or hooks fail, report the exact supplied reason, preserve the tree, fix only in-scope causes, and stop for owner direction if the fix expands scope or requires a product decision. Do not bypass hooks with `--no-verify` without explicit approval. Resume only after the focused rerun passes and the staged diff, ownership, and commit-readiness evidence have been re-audited; do not claim a fix, rerun, or passing hook without its output.

## Final report after a permitted commit

This template is for a local-only checkpoint. When the narrow PR/CI exception pushed a focused fix, use the owning `github-pr-ci-workflow` report instead and state the exact remote action; do not claim that nothing was pushed.

```text
Commit đã tạo:
<hash> <English Conventional Commit message>

Phạm vi gồm:
- <khu vực logic hoặc file>

Kiểm tra:
- <command>: đạt
- <command>: không đạt/bỏ qua/chưa chạy - <lý do>

Manual QA:
- hoàn tất/đang chờ/không áp dụng

Thao tác remote:
- Không có nội dung nào được push.
```

Localize owner-facing prose according to the owner's language while preserving the English Conventional Commit message and exact technical evidence.
