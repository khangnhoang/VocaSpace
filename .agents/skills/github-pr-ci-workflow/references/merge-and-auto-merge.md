# Merge and auto-merge

Default:

* Do not merge.
* If CI passes, report that the PR is ready for owner review/merge.

Auto-merge:

* Only allowed when the owner explicitly requests auto-merge in the current task.
* Auto-merge still requires all safety checks below to pass.

Before any merge, verify:

```powershell
gh pr view <branch> --json mergeStateStatus,reviewDecision,statusCheckRollup
gh pr checks
```

Also verify from available GitHub CLI output:

* all required checks passed;
* no pending checks remain;
* no merge conflicts exist;
* no requested changes remain;
* no unresolved review comments are detectable;
* no branch protection or repository rule blocks merge;
* no unapproved DB/schema/RLS/RPC/migration/production-risk changes are present;
* risk is clear and acceptable under the owner's current instruction.

If any check is inconclusive, do not merge. Report what could not be verified.
