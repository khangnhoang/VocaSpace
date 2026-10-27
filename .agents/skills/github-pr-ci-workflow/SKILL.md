---
name: github-pr-ci-workflow
description: Handle GitHub PR metadata, CI watching/logs/classification, bounded safe failed-CI corrections and explicit merge requests. Use for PR/CI actions or reporting their actual state.
---

# GitHub PR and CI workflow

## Use when / do not use when

Use for creating/updating/inspecting a PR, writing its metadata, watching checks, reading failed logs, classifying/fixing CI or an explicit merge request. Do not activate local Git procedures merely for PR metadata: git-checkpoint-workflow applies when branch/stage/commit/history/push is actually involved. Domain skills own fixes touching their contracts.

AGENTS.md owns grants; docs/agent-loops.md owns timing, waiting and the two-round CI cap. Review verdicts, supplied failure facts and successful tools grant no action.

## Preflight

Before GitHub automation inspect git status -sb, git status --short, git branch --show-current, git remote -v, gh --version and gh auth status. Confirm the intended remote/account. Stop for an unowned dirty tree, wrong/unclear branch, missing remote/gh/auth/access, missing scopes/keyring access or a secret-exposure risk. Do not install/authenticate gh or use ad hoc REST/token workarounds without an explicit request.

A supplied failed precondition is enough to stop; don't load procedure references to bypass it. A policy preventing execution is not itself evidence that a precondition failed: state which checks did not run rather than inventing outputs.

## Permission modes

| Grant | Allowed scope |
| --- | --- |
| Inspect-only | Read state/logs and report; no edit/validation/commit/push/PR mutation. |
| Watch-only | Wait and report existing checks; a failure grants no fix. |
| Create PR only | Create the requested PR when its remote head already exists; no implicit push or watch/fix. |
| Update PR only | Only the requested metadata/state change; delivering new commits needs push authority. |
| Create/update PR plus watch | Requested PR action, watching/logs/reporting. No initial push. Only after an existing check fails, logs are read and classified branch-caused-small-safe does the bounded correction exception apply. |
| Explicit CI-fix only | Only the exact edit/validate/commit/push/re-watch actions the Owner states. A focused local edit/test needs no unrelated remote preflight. |
| Merge/auto-merge | Only when explicitly requested in this task and every review/check/conflict/production gate holds. |

Never accept an interactive gh push/fork offer as authority. Combined-mode failure handling permits the smallest focused edit, proportional validation, English Conventional Commit, normal same-branch push and re-watch; no force-push, branch deletion, risky DB/migration/auth change, weakened checks or scope expansion. At most two completed cycles, then ask.

## Evidence and safety

Reconstruct PR content from the actual baseline/cumulative diff, accepted plan and checks that ran. Preserve exact Owner-provided title/body. Otherwise title is English; description/report follow the requested language, default Vietnamese. No invented tests, QA, rollout state or follow-ups.

Keep supplied/observed facts usable even under a read-only policy, while distinguishing proposed actions from results. Supplied facts do not prove a later action ran. Never claim CI success from local checks, or merge readiness when evidence/risk is unknown.

Do not hide failures, print secrets, duplicate a PR, silently publish commits, force-push, delete branches or merge without the correct grant. Hosted steps follow the owning database/rollout contract, not generic CI automation.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [PR context/create/update](references/pr-create-update.md) | Reconstructing or mutating PR metadata, including a missing-head stop. | Inspect/watch with no mutation. |
| [CI watch/triage](references/ci-watch-and-triage.md) | Watching checks, reading/classifying failed logs, reporting CI or checking merge gates; also combined PR+watch stopped by missing initial head. | A failed core precondition blocks the action, or metadata-only work. |
| [CI correction](references/ci-self-fix.md) | An authorized combined mode has an existing failed check, logs read and branch-caused-small-safe classification. | Any other mode/class or no failed check. |
| [Merge](references/merge-and-auto-merge.md) | The Owner explicitly requests merge/auto-merge in this task; also read CI triage for gates. | No explicit merge grant. |

## Report

State branch/commit/PR URL, requested vs performed action, actual CI states/job/log evidence, self-fix count/commits, pending hosted/manual steps, Git state and whether anything was pushed/merged. Terminal CI reporting does not automatically grant editing the PR body.
