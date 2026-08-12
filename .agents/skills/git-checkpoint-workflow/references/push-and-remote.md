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

Before a requested push, confirm the exact branch and commits, remote branch state, and that force-push is not needed unless explicitly approved.

PR readiness and description are reviewed separately; known blockers require a draft or no PR unless the owner decides otherwise.
