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
* `code-review-and-quality` for checkpoint or PR review;
* `github-pr-ci-workflow` for the only narrow exception to default explicit commit/push permission.

## Resource routing

Read only the references whose conditions match:

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [references/branch-start-and-sync.md](references/branch-start-and-sync.md) | Read before creating or switching a task branch, updating its base, or resolving base, dependency, ancestry, tracking, or divergence | The current branch and base are already established and no branch-start or synchronization decision is needed |
| [references/commit-and-staging.md](references/commit-and-staging.md) | Read after commit permission exists or when auditing a proposed stage or local-commit checkpoint | The task is planning or review only and no stage or commit action is proposed |
| [references/corrections-and-history.md](references/corrections-and-history.md) | Read before a correction-history, amend, squash, rebase, conflict, history-rewrite, force-push, or destructive-recovery decision | The task is an ordinary new local commit with no correction, conflict, rewrite, force, or destructive-recovery decision |
| [references/push-and-remote.md](references/push-and-remote.md) | Read before an explicitly authorized normal push or another requested remote-delivery procedure | The checkpoint is local-only, remote delivery is explicitly ungranted, or no remote-delivery procedure is requested |

Do not read every reference merely because this skill is active. Each referenced procedure remains subordinate to the permission and stop rules in this core.

## Core rules

* Do not auto-commit after every completed implementation prompt.
* After implementation, report changed files, verification, known gaps, and a recommended English Conventional Commit message.
* Commit only after the owner explicitly asks for or approves a commit, except for the bounded post-failure PR/CI self-fix exception owned by `github-pr-ci-workflow`.
* Owner approval can be phrased naturally, such as `commit đi`, `duyệt commit`, `commit checkpoint này`, `create the commit`, or an equivalent instruction.
* Use English Conventional Commits for the entire commit message.
* Commit locally by default.
* Never push unless the owner explicitly asks for push, except for the same narrow PR/CI exception.
* `Commit` never implies `push`.
* The exception does not grant initial push. It applies only when the owner explicitly requested create/update PR plus CI watching and `github-pr-ci-workflow` has established an existing PR/check, read failed logs, classified the failure as `branch-caused-small-safe`, and authorized its exact bounded cycle. This skill does not duplicate that procedure.
* Never force-push without an explicit request for that action.
* Create correction commits instead of amending or squashing by default.
* Do not mix unrelated changes.
* Do not stage changes whose ownership is unclear.
* Do not claim verification passed unless it ran.
* Do not discard work with destructive Git commands without explicit approval.

## Specialist escalation signals

Existing dirty-tree, base/dependency, divergence, conflict, history-rewrite, and remote-permission stop rules execute first. A hard-risk signal exists when, after the applicable stop, observable Git facts still expose a potentially material unresolved uncertainty about change ownership, ancestry or dependency, recoverability, or history integrity that bounded read-only analysis could help resolve.

A known clean base, ordinary ahead/behind inspection, a coherent correction commit, branch naming, and a non-destructive local checkpoint are conditional review signals handled through the normal Git procedure unless evidence exposes unresolved material risk. Dirty state, commit count, diff size, branch existence, an owner commit or push request, and Git-skill activation alone are ordinary non-triggers and never permission.

Route a hard-risk candidate through the global specialist gates only after applicable main review. Specialist advice never authorizes staging, commit, switch, merge, rebase, amend, squash, push, force-push, branch deletion, PR action, or destructive recovery.

## Branch, ownership, and staging minimum

Before non-trivial work or any requested commit, confirm the current branch and inspect staged, unstaged, and untracked state. If the tree is already dirty, identify and preserve pre-existing changes; do not revert, stage, or commit them; use explicit path or safe hunk staging; and stop when ownership cannot be determined.

Before creating or switching a task branch, the base, dependency, ancestry, tracking, and divergence must be known. Stop if the base is unclear, synchronization cannot fast-forward safely, an independent task's dependency is absent from refreshed `origin/main`, or remote state cannot be refreshed under current permission. Read [references/branch-start-and-sync.md](references/branch-start-and-sync.md) for the detailed procedure.

After commit permission exists, stage only intended task-owned files or hunks and inspect the staged diff before committing. Read [references/commit-and-staging.md](references/commit-and-staging.md) for the full readiness, staging, verification, message, artifact, secret, and commit-report procedure.

## Local and remote boundary

A successful commit is local only unless `github-pr-ci-workflow` has activated and owns its exact bounded post-failure normal-push cycle. A request to save, checkpoint, or commit does not authorize any remote action, and that narrow exception never authorizes initial publication of a branch.

Without explicit approval or that exact narrow exception, do not push, force-push, create or update a remote branch or PR, merge, create tags or releases, deploy, push migrations, or modify remote environments. Before any authorized normal push, read [references/push-and-remote.md](references/push-and-remote.md).

For a planning-only task with no branch, staging, commit, history, push, PR, or remote-delivery decision, do not activate checkpoint delivery or read a conditional Git reference. Route non-trivial implementation planning to `implementation-planning-and-pr-breakdown` instead. In a routing answer, explicitly name that planning owner; do not stop after saying that Git does not apply.

When an approved non-trivial plan establishes the task boundary or branch base and Git work is also requested, keep both owners: route `implementation-planning-and-pr-breakdown` for the approved plan/base and `git-checkpoint-workflow` for the branch or synchronization procedure. Do not replace the planning owner with Git merely because branch preparation is the immediate action.

## Execution and evidence truth

When the supplied execution policy is synthetic, read-only, or otherwise prohibits actions, distinguish the permitted procedure from observed execution. State explicitly that the prohibited action did not run under that policy, never invent a result, and name the exact post-action evidence required before claiming a branch, commit, correction, push, upstream, divergence, hook, or clean-state result.

## Implementation completion report

When implementation is complete but the owner has not approved a commit, report:

```text
Các file đã thay đổi:
- <file>: <why it changed>

Kiểm tra:
- <command>: đạt/không đạt/bỏ qua/chưa chạy - <lý do>

Commit message đề xuất (English Conventional Commit):
<type>(<scope>): <imperative summary>

Thao tác remote:
- Không có nội dung nào được push.
```

Use the language requested by the owner. When the owner communicates in Vietnamese and does not request another language, keep these headings and explanations in natural Vietnamese while preserving commands, paths, branches, exact errors, technical literals, and the English commit message unchanged.

Do not stage or commit in this reporting step unless the owner already approved the commit or the exact narrow PR/CI exception is active.

## Correction, history, and destructive stops

Create correction commits instead of amending or squashing by default. Do not amend, squash, rebase, force-push, reset, discard work, or use destructive recovery without the exact explicit authority. Read [references/corrections-and-history.md](references/corrections-and-history.md) before any correction-history, conflict, rewrite, force, or destructive-recovery decision.

## Failure handling

If verification fails because of the current change, fix it only when in scope and rerun; stop when resolution requires scope expansion or a product decision; and do not commit broken work unless an explicit WIP commit is requested. For an unrelated pre-existing failure, confirm and document evidence rather than silently fixing it.

If commit or hooks fail, report the exact reason, preserve the tree, fix only in-scope causes, and do not bypass hooks with `--no-verify` without explicit approval.

## Final checklist

* [ ] Owner explicitly approved/requested the commit, or the exact bounded `github-pr-ci-workflow` exception is active
* [ ] Scope and acceptance criteria are complete
* [ ] Progress docs and relevant verification are current
* [ ] Branch, dirty-tree ownership, and staged diff were audited
* [ ] Only prompt-owned changes are staged
* [ ] No conflicts, debug code, secrets, or invalid artifacts remain
* [ ] Commit boundary is coherent
* [ ] The entire commit message is in English and follows Conventional Commits
* [ ] New correction commit is used by default
* [ ] Commit remains local unless the exact bounded `github-pr-ci-workflow` exception includes its normal same-branch push
* [ ] Nothing was pushed, or the owning PR/CI report records the exact authorized exception push
