# Branch start and synchronization

Read for starting/switching branches or resolving base/dependency/tracking.

1. Record current branch, HEAD, local main, origin/main, upstream, ahead/behind and staged/unstaged/untracked ownership. Preserve existing work; stop for an unclear base or unowned changes.
2. Choose <type>/<short-kebab-name>: feat, fix, refactor, test, docs, chore, perf or ci; never generic codex/claude/agent prefixes. Check local/remote name conflicts.
3. Independent task: with remote permission, fetch, confirm required dependencies are contained in refreshed origin/main, switch to local main, pull --ff-only, confirm main equals origin/main, then create the branch. Do not use stale main or a convenient feature branch.
4. Stacked task: only when intentionally dependent on verified unmerged work, branch from that exact dependency HEAD and state why. If independence is unclear, stop rather than guess.
5. Stop for a dirty tree unless the Owner explicitly included moving those known task-owned changes, a failed fetch/switch/pull, missing dependency or non-fast-forward state. No reset/stash/discard workaround is implied.
6. Claim completion only after observing the resulting branch/HEAD, ancestry, upstream/divergence and worktree/index state. A proposed command is not execution evidence.

Do not create/rename/switch/merge/delete branches merely to silence a problem. Network sync, history changes and deletion need their actual grants.
