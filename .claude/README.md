# Claude Code configuration for this repository

## Shared instructions and skills

`CLAUDE.md` imports `AGENTS.md` (shared rules), `docs/agent-loops.md` (shared lifecycle),
and `.claude/rules.md` (Claude-only bindings). Keep each rule in its owning source.

Each `.claude/skills/<name>` is a relative directory symlink to
`../../.agents/skills/<name>`, matching the local MAITrans layout. Edit the canonical
skill under `.agents/skills/`; the link also exposes its supporting resources.
When adding or removing a shared skill, add or remove its corresponding link.

On Windows, enable Developer Mode and clone with `git -c core.symlinks=true clone <url>`,
or set `git config core.symlinks true` in an existing checkout before checking out
tracked links. Changing the setting alone does not turn existing plain files into symlinks.
