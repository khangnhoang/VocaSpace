<!-- Template: progress. Copy to docs/refactors/<program>/progress.md, fill every <placeholder>, delete this comment. This is the only place State lives. Edit the State block in place; append one line per milestone. Real markdown links to sibling files are added when the file is copied into the program folder. -->

# Progress — <program name>

Plan: `plan.md`. Problems: `problems.md`. Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | <detail plan path and revision, e.g. `<unit>/plan.md` r<n>> |
| Current unit / checkpoint | <unit and checkpoint, or "none active"> |
| Status | <one status from the program's vocabulary, e.g. not started, in progress, blocked, automated checks passed, manual QA pending, merged, completed> |
| Completed evidence | <checks actually run and results, commits; label historical evidence> |
| Accepted deviations | <bounded deviation from the Spec or plan hypotheses, or "none"> |
| Blockers / Owner decisions | <open blocker or pending Owner decision, or "none"> |
| Next action | <the single next step and who takes it> |
| Current authority | <what is permitted now: implement, commit, push, PR, merge, rollout step; everything else is not granted> |
| Hosted state | <optional, only for programs with a production rollout: step reached and the evidence location> |

## Milestones

One line each, newest last: date, what happened, commit or PR (`(this commit)` for the commit that adds the line). No review rounds or command logs.

- <YYYY-MM-DD> <what happened> (`<commit>` or PR <n>).
