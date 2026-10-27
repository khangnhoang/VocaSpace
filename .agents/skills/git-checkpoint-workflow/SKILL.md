---
name: git-checkpoint-workflow
description: Prepare branches and safe local checkpoints, stage related changes, create authorized commits and handle correction/history or normal-push decisions. Use for Git ownership/base questions and after an implementation checkpoint.
---

# Git checkpoint workflow

## Use when / do not use when

Use for branch/base/sync decisions, dirty-tree ownership, staging/committing, corrections/history, normal push or a completed checkpoint report. Do not activate for a PR metadata action alone; github-pr-ci-workflow owns it. Planning owns task scope, review owns readiness and domain skills own verification.

AGENTS.md owns separate action grants. Natural phrasing counts, including an approved handoff's local-commit grant; saving/committing never implies push. Only github-pr-ci-workflow's existing bounded failed-CI exception can supply standing commit/push authority. No automatic commit at completion.

## Before working

Confirm git branch --show-current and git status --short; know HEAD/base, staged, unstaged and untracked changes. Preserve pre-existing work; do not stage/revert it. Stop if ownership or the intended dependency cannot be established.

A new branch needs the verified base/dependency, fresh remote state when permitted and an unused semantic name. Never branch from stale main or silently stack on unmerged work. A request to move current task-owned changes to a new branch covers those changes; it does not authorize discarding unrelated work.

Never share another checkout's node_modules through a symlink/junction: removing a Windows worktree can delete the target.

## Checkpoint

With a commit grant, verify scope/acceptance and self-review first, finish every candidate edit, then stage explicit paths or safely separable hunks and inspect the exact staged diff. Never stage/commit concurrently with an unfinished edit. Without a grant, leave changes reviewable and propose the message.

Create an English Conventional Commit: <type>(<scope>): <imperative summary>. Keep a checkpoint coherent; split only for an independent review/rollback reason. Pre-commit self-review fixes happen before its commit. Findings after a reviewed commit normally get a new correction commit; amend/squash/rebase need an explicit request.

For multi-checkpoint work, commit locally as granted, finish the cumulative self-review, then push once only when push is granted. Later corrections get their own review and delivery authority.

Report files/scope, checks actually run, pending/manual QA, the lifecycle self-review evidence block, hash/message or proposed message, and exact Git/remote state. No commit is final Owner approval.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Branch and sync](references/branch-start-and-sync.md) | Starting/switching a branch or resolving base, dependency, ancestry/tracking/divergence. | Base/branch are established and unchanged. |
| [Stage and commit](references/commit-and-staging.md) | Auditing/staging/creating an authorized local commit. | No stage/commit action. |
| [History/corrections](references/corrections-and-history.md) | A correction, conflict, amend/squash/rebase, rewrite or destructive recovery decision. | Ordinary new checkpoint with no history question. |
| [Push](references/push-and-remote.md) | Authorized normal push or requested remote-delivery procedure. | Work stays local. |

## Stop

No unrelated/unclear staged work, secret, unresolved material decision, change-caused failing check, unclear base or ungranted action. Preserve the actual failure/state and report the smallest resolver. Do not bypass a failed hook with --no-verify unless explicitly authorized.
