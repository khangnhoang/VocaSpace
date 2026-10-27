# Corrections and history

Read for a correction, conflict, rewrite or destructive recovery question.

Fix findings from pre-commit self-review before committing. A finding after a reviewed commit normally gets a new independently understandable correction commit, preserving prior checkpoints.

Amend, squash, autosquash, rebase and interactive history edits need an explicit Owner request. Before rewriting, identify affected commits, pushed status, intended history and whether a force-push would follow; force-push needs a separate grant.

For conflicts inspect both sides and intent, preserve unrelated work, use domain checks and stop for a material decision. Never select ours/theirs wholesale. Inspect state before aborting, because resolved work may be lost.

git reset --hard, git clean, git checkout -- . and git restore . can discard work and require explicit authority. A failed command never grants destructive recovery.
