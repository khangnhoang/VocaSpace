# Branch start and synchronization

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

When the task is intentionally stacked, verify the exact dependency branch or commit and create the new branch from that verified dependency `HEAD`; do not synchronize through `main` or imply that the stacked procedure is the same as the independent procedure. State which procedure the supplied facts select and why.

Stop and report if the working tree is dirty, the base is unclear, local `main` cannot fast-forward cleanly, an independent task's required dependency is not present in `origin/main`, or any fetch, switch, or pull step fails.

Do not create, rename, switch, merge, or delete branches merely to silence a problem. Do not assume local `main` or the branch baseline is current.

Before claiming branch creation or synchronization, report the resolved base and dependency, local/tracking/remote commit IDs, current branch, resulting `HEAD`, verified ancestry or provenance, ahead/behind state, and clean worktree/index. A proposed procedure or read-only inspection is not evidence that fetch, fast-forward, switch, or branch creation ran.
