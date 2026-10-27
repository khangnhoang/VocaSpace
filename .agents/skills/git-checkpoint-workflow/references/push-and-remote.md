# Normal push

Read for an authorized normal push/remote-delivery procedure. A local commit never grants push. github-pr-ci-workflow owns its narrow failed-CI exception, which does not allow initial publication.

Before pushing confirm the exact granted branch/range and remote/ref, clean index/worktree, upstream, fresh remote state and ahead/behind. Ensure a normal push suffices; force-push is not implied. Stop if any required evidence or permission is unavailable.

Perform only the exact authorized push. Inspect the resulting remote head/tracking state: it must equal the intended local head, with the expected upstream/divergence and clean tree/index. Report actual command/result and exact observed IDs/counts; never invent identifiers or claim delivery from a proposed command, stale tracking ref or local commit.

PR actions, merge, tags/releases, deployment, database writes and branch deletion remain separate. Known blockers mean draft/no PR unless the Owner decides otherwise.
