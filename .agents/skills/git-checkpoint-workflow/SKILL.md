---
name: git-checkpoint-workflow
description: Repository-specific Git checkpoint workflow for completed implementation prompts. Use when creating or reviewing local checkpoints, handling dirty working trees, staging, corrections, amend/squash decisions, branch safety, push requests, or pull-request actions. Enforces English Conventional Commits and local-only commits by default.
---

# Git Checkpoint Workflow

## Activation scope

Use this skill when:

* an implementation prompt is complete and ready for a checkpoint
* the user asks to commit
* a later prompt corrects an earlier checkpoint
* reviewing prompt-by-prompt diffs
* working-tree, branch, staging, or ownership is unclear
* considering amend, squash, rebase, push, or PR actions

Do not use it to justify committing incomplete, conflicting, unrelated, or knowingly broken work.

## Ownership

This skill owns:

* prompt-level local commits
* commit-readiness and staging safety
* checkpoint boundaries
* English Conventional Commit messages
* correction history
* amend/squash restrictions
* local versus remote-action boundaries
* checkpoint reporting

Planning, domain verification, code-review findings, and merge readiness belong to their respective skills.

## Related skills

Use:

* `implementation-planning-and-pr-breakdown` for approved prompt, task, phase, and PR boundaries
* domain skills for required verification
* `code-commenting-and-maintainability` for changed comments and structured documentation
* `code-review-and-quality` for checkpoint or PR review

## Core rules

* A completed implementation prompt should normally end with one local checkpoint commit.
* A response is not automatically a checkpoint; scope must be complete, coherent, and reviewable.
* Use English Conventional Commits for the entire message.
* Commit locally by default.
* Never push unless the user explicitly requests it.
* “Commit” never implies “push.”
* Never force-push without an explicit request for that action.
* Create correction commits instead of amending or squashing by default.
* Preserve prompt-by-prompt history for review.
* Do not mix unrelated changes.
* Do not stage changes whose ownership is unclear.
* Do not claim verification passed unless it ran.
* Do not discard work with destructive Git commands without explicit approval.

## Checkpoint workflow

For each completed implementation prompt:

1. Confirm approved scope and acceptance criteria are complete.
2. Update required plan/progress documentation.
3. Run the smallest relevant verification required by domain skills.
4. Record skipped or pending checks with reasons.
5. Inspect branch, working tree, and prompt-owned changes.
6. Audit unstaged and staged diffs.
7. Exclude unrelated files or hunks.
8. Stage only intended content.
9. Create one local English Conventional Commit.
10. Report hash, message, included scope, verification, manual QA, and that nothing was pushed.

Do not collapse several completed prompts into one checkpoint merely because they belong to one PR.

## Commit-readiness gate

Commit only when:

* prompt scope and acceptance criteria are complete
* the change is coherent and reviewable
* relevant automated checks passed
* skipped checks are explained
* required progress documentation is current
* branch and diff were audited
* unrelated changes are excluded
* no secret, debug code, conflict marker, or unexpected artifact is staged
* the repository is not intentionally broken
* no unresolved product or architecture decision remains

A local checkpoint is not final approval. Manual QA may remain pending when clearly reported.

## Do not commit

Do not checkpoint:

* analysis, planning, review, or inspection with no intended file change
* aborted or incomplete implementation
* unresolved conflicts
* speculative or out-of-scope work
* temporary experiments
* changes whose ownership cannot be separated
* current-change failures that remain unresolved
* a prompt that explicitly forbids commit

A user-requested WIP commit must be labeled and reported as knowingly incomplete.

## Starting state and branch safety

Before non-trivial work:

```bash
git branch --show-current
git status --short
```

Record the branch, dirty state, existing modified/untracked files, and missing prerequisites.

If the tree is already dirty:

* identify and preserve pre-existing changes
* do not revert, stage, or commit them
* use explicit path or safe hunk staging
* stop when ownership cannot be determined

Before committing, confirm the branch matches the approved task and baseline.

Do not create, rename, switch, merge, or delete branches merely to silence a problem. Do not assume local `main` or the branch baseline is current.

## Ownership and staging

A checkpoint may include implementation plus directly required:

* tests
* schemas/types
* migration changes
* comments
* documentation and progress updates

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

* only intended content is staged
* no unrelated refactor or formatting exists
* conflicts and debug code are absent
* comments/docs/tests/progress match behavior
* deletions and renames are intentional
* generated files follow repository conventions
* no secret, environment value, or unexpected binary is included

Do not commit before reviewing the staged diff.

## Verification and manual QA

Choose verification from repository scripts and domain skills. Prefer the smallest set that covers the changed risk.

Do not hard-code generic commands or repeat a successful command when no relevant code changed. Rerun checks after later edits that may invalidate them.

Pending manual QA does not block a local checkpoint when automated verification is appropriate, the implementation is coherent, and pending checks are reported. It does block merge readiness when the QA is required.

Manual-QA corrections create a new commit; do not amend by default.

## Checkpoint boundaries

One checkpoint represents:

* one completed implementation prompt
* one coherent logical outcome
* one reviewable diff
* one understandable history entry

Implementation and direct regression coverage may belong in the same checkpoint.

Do not split merely to increase commit count or combine independent outcomes to reduce it.

If one prompt contains independent outcomes, separate commits only when each is coherent and independently verifiable.

## Corrections, amend, and squash

Later corrections:

* create a new commit
* clearly describe the correction
* preserve earlier checkpoints
* remain independently understandable

Example:

```text
feat(course-review): add rejection detail panel
fix(course-review): preserve rejection text after status refresh
```

Do not amend, squash, autosquash, or interactive-rebase unless the user explicitly requests history cleanup.

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

* subject, body, footer, and breaking notes are entirely in English
* use imperative mood
* describe the completed change
* use a meaningful scope when useful
* avoid a trailing period, vague wording, and unverified claims
* keep identifiers and established technical names unchanged

Good:

```text
feat(course-authoring): add submission readiness checks
fix(course-review): preserve rejection feedback after resubmission
test(payment): cover duplicate webhook consumption
docs(skills): define local checkpoint workflow
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

* push or force-push
* create/update a remote branch
* open, update, merge, or close a PR
* create tags or releases
* deploy
* push migrations
* modify remote environments

A request to save, checkpoint, or commit does not authorize any remote action.

Before a requested push, confirm the exact branch and commits, remote branch state, and that force-push is not needed unless explicitly approved.

PR readiness and description are reviewed separately; known blockers require a draft or no PR unless the user decides otherwise.

## Conflicts and destructive commands

For merge, rebase, cherry-pick, or sync conflicts:

* inspect both sides and repository intent
* preserve unrelated changes
* use relevant domain skills
* run affected verification
* create a new checkpoint after resolution
* stop when a product decision is required

Do not broadly choose “ours” or “theirs.”

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

## Review ranges

Useful commands:

```bash
git show --stat --oneline HEAD
git diff HEAD^..HEAD
git log --oneline <baseline>..HEAD
git diff <baseline>..HEAD
```

Do not rewrite history merely to simplify a review range.

## Failure handling

If verification fails because of the current change:

* fix it when in scope and rerun
* stop when resolution requires scope expansion or a product decision
* do not commit broken work unless an explicit WIP commit is requested

For an unrelated pre-existing failure, confirm and document evidence; do not silently fix it.

If commit or hooks fail, report the exact reason, preserve the tree, fix only in-scope causes, and do not bypass hooks with `--no-verify` without explicit approval.

## Final report

```text
Commit:
<hash> <English Conventional Commit message>

Included:
- <logical area or files>

Verification:
- <command>: passed
- <command>: failed/skipped/not run — <reason>

Manual QA:
- completed/pending/not applicable

Remote actions:
- Nothing was pushed.
```

## Final checklist

* [ ] Scope and acceptance criteria are complete
* [ ] Progress docs and relevant verification are current
* [ ] Branch, dirty-tree ownership, and staged diff were audited
* [ ] Only prompt-owned changes are staged
* [ ] No conflicts, debug code, secrets, or invalid artifacts remain
* [ ] Checkpoint boundary is coherent
* [ ] The entire commit message is in English and follows Conventional Commits.
* [ ] New correction commit is used by default
* [ ] Commit is local
* [ ] Nothing was pushed
