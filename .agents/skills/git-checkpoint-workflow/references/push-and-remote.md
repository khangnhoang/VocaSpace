# Normal push and remote delivery

## Local and remote boundaries

A successful commit is local only unless `github-pr-ci-workflow` has activated and owns its exact bounded post-failure normal-push cycle.

Without explicit approval or that exact narrow exception, do not:

* push or force-push;
* create/update a remote branch;
* open, update, merge, or close a PR;
* create tags or releases;
* deploy;
* push migrations;
* modify remote environments.

A request to save, checkpoint, or commit does not authorize any remote action. The narrow PR/CI exception never authorizes initial publication of a branch.

Before a requested push, confirm:

* the worktree and index are clean;
* the exact current branch and intended commit range;
* the configured upstream and intended remote/ref;
* refreshed remote branch state and local/remote ahead-behind counts;
* a normal push is sufficient and force-push is neither required nor authorized.

State the exact supplied branch, commit range or delivery `HEAD`, upstream, remote/ref, remote state, and initial ahead/behind values. Do not replace available identifiers or counts with a generic statement that they are known.

Perform only the exact authorized normal push. Reconcile the result by refreshing or inspecting the remote-tracking ref, then verify the remote HEAD equals the intended local delivery HEAD, the upstream is correct, divergence is the expected `0 behind / 0 ahead`, and the worktree/index remain clean. Report the command result, local and remote commit IDs, upstream, divergence, and cleanliness. Do not claim delivery from a proposed command, a local commit, or stale remote state.

PR readiness and description are reviewed separately; known blockers require a draft or no PR unless the owner decides otherwise.
