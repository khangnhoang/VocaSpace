# PR creation and update

## Context reconstruction

When the owner asks to create or update a PR, reconstruct the PR content from reliable evidence:

```powershell
git log --oneline main..HEAD
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Read relevant full diffs when needed:

```powershell
git diff main...HEAD -- <path>
```

Use these sources:

* owner-provided current task notes;
* current-session verification output still available to Codex;
* commit history on the branch;
* cumulative diff against `main`;
* changed docs, ADR, SOP, or progress files;
* existing issue, plan, progress, or release notes in the repo.

Rules:

* If the owner provides an exact PR title, use it exactly.
* If the owner provides an exact PR body, use it exactly.
* If an exact title is not provided, write the PR title in English.
* If an exact body is not provided, write the PR description in the language explicitly requested by the owner; when no language is requested, default to Vietnamese.
* Do not invent tests, manual QA, decisions, risks, or follow-ups.
* If a decision exists only in chat and the context is unavailable, ask the owner for the missing summary or mark it as unknown.
* If the branch includes commits from earlier sessions, use Git history and repository docs instead of guessing intent.

The agent-generated PR description in the selected language must include localized equivalents of:

* tóm tắt;
* file hoặc khu vực đã thay đổi;
* test đã chạy và kết quả;
* ảnh hưởng production;
* rủi ro hoặc giới hạn;
* việc cần làm tiếp theo.

## PR creation and update procedure

Before creating a PR, verify that the exact head branch already exists on the remote. If it does not, stop and request explicit push permission. Do not accept any interactive `gh` prompt that offers to push or fork the branch.

Before creating a PR, check whether one already exists for the current branch:

```powershell
gh pr view <branch>
```

If a PR exists:

* do not create a duplicate;
* update title, body, labels, or draft state only when the owner requested that exact metadata/state change;
* preserve owner-provided title/body unless the owner asks to replace them.
* do not deliver new commits or push under update-PR-only permission.

If no PR exists:

* create the PR with `gh pr create` only after the remote-head check passes;
* default base branch is `main` unless the repo or task says otherwise;
* prefer `--body-file` for long Markdown descriptions;
* do not merge as part of PR creation.

Recommended shape:

```powershell
gh pr create --base main --head <branch> --title "<English title>" --body-file <body-file>
```

For updates:

```powershell
gh pr edit <branch> --title "<English title>" --body-file <body-file>
```

Use a temporary body file only for PR creation/update. Do not commit temporary PR-body files unless the owner explicitly requested a checked-in artifact.
