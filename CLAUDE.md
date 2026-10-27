@AGENTS.md
@docs/agent-loops.md
@.claude/rules.md

## Claude Code

- `AGENTS.md` is the authoritative instruction source for this repository; the import above loads it in full.
- `docs/agent-loops.md` holds the shared lifecycle; the import above loads it in full.
- `.claude/rules.md` holds Claude-only working rules; the import above loads it.
- `.claude/skills/<name>` exposes each canonical `.agents/skills/<name>` through a relative directory symlink. Edit the shared target; do not duplicate skill content here.
