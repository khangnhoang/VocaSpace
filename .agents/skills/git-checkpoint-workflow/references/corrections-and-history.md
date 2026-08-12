# Corrections and history safety

## Corrections, amend, and squash

Later corrections:

* create a new commit by default;
* clearly describe the correction;
* preserve earlier checkpoints;
* remain independently understandable.

Example:

```text
feat(course-review): add rejection detail panel
fix(course-review): preserve rejection text after status refresh
```

Do not amend, squash, autosquash, or interactive-rebase unless the owner explicitly requests history cleanup.

Before rewriting history, identify affected commits, whether they were pushed, the resulting history, and whether force-push would be required. Force-push still requires a separate explicit request.

## Conflicts and destructive commands

For merge, rebase, cherry-pick, or sync conflicts:

* inspect both sides and repository intent;
* preserve unrelated changes;
* use relevant domain skills;
* run affected verification;
* create a new correction commit only after owner approval;
* stop when a product decision is required.

Do not broadly choose `ours` or `theirs`.

Do not run commands that may discard work without explicit approval, including:

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
```

Inspect state before aborting merge/rebase operations because conflict-resolution work may be lost.
