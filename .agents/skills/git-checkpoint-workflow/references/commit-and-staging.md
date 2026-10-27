# Stage and local commit

Read before auditing/staging/creating an authorized local commit. The parent and AGENTS.md own permission; this procedure adds none.

1. Confirm branch/HEAD and inspect git status --short, git diff and git diff --cached, including untracked candidate files.
2. Separate task-owned files/hunks from pre-existing or unclear work. Stop if ownership cannot be separated.
3. Confirm acceptance and self-review passed, no unresolved product/architecture/implementation/ownership decision remains, and relevant checks still hold after the final edit. Pending manual QA must be reported and may still block merge.
4. Audit encoding/EOL, conflict markers, debug artifacts, accidental renames/deletions, generated files and secrets in the actual content. Keyword search is supplementary.
5. Finish edits; stage explicit paths with git add -- path/a path/b (or safely separable hunks), not git add . unless the tree began clean and all changes are in scope.
6. Read the complete git diff --cached and run git diff --cached --check. Include the implementation and directly needed tests/types/migrations/docs only. No personal settings, .env*, credentials, build/cache output or unrelated cleanup.
7. Commit only after staging audit succeeds: <type>(<scope>): <imperative summary>, entirely English, no trailing period or vague “update files”. Body only for a non-obvious reason, risk or compatibility limit.
8. Report hash, scope, actual checks/pending QA, self-review and exact remote state. Nothing was pushed unless separately authorized and actually verified.

If a secret appears, stop delivery, remove/unstage only the task-owned exposure, preserve unrelated work and report whether rotation may be needed. Resume only after a new explicit-path/hunk staging audit proves it is absent.

If a check/hook fails, preserve the exact error and tree. Fix only in-scope causes, rerun the focused check and re-audit staging. No --no-verify without an explicit grant. An unrelated pre-existing failure is evidence to report, not silently fix. Do not commit a broken candidate unless the Owner explicitly requests a labeled WIP.
