<!-- Template: progress. Copy to docs/programs/<program>/progress.md, fill every <placeholder>, delete this comment. This is the only place State lives. Edit the State block in place; append one line per milestone. Real markdown links to sibling files are added when the file is copied into the program folder. -->

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

One line each, newest last. No review rounds or command logs. The file has only `## State` and `## Milestones`.

Grammar: `- YYYY-MM-DD <text> (<ref>).` where `<ref>` is a short commit hash (7-40 hex characters, backticks optional), `PR <n>`, `PR <n>, <hash>`, or `this commit`. The final period is optional. At most one milestone cites `(this commit)`, and it is always the last one: it marks the commit that adds the line, and the next commit that edits this file replaces it with that commit's hash.

- <YYYY-MM-DD> <what happened> (`<commit>`).
- <YYYY-MM-DD> <what happened> (PR <n>, `<commit>`).
- <YYYY-MM-DD> <what happened in this commit> (this commit).
