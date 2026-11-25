# Claude Code working rules

Imported by `CLAUDE.md`. This file owns Claude-specific tools and session bindings. `AGENTS.md` owns shared rules, `docs/agent-loops.md` owns the shared lifecycle, and `.agents/skills/` owns task procedures.

Standing platform permissions below cover Explore fan-out on Haiku and foreground CI watching.

## Planning

- Ask open Owner decisions with AskUserQuestion (recommended option first, marked "(Recommended)", at most 4 per call) before the plan is written or sent to review.
- Any decision that bundles several actions (for example commit, plan approval and an implementation grant) goes through AskUserQuestion, one question per decision, with option descriptions that say exactly what happens. Use the wrap-up buttons only for a single obvious yes/no.

## Preflight reading

- `.claude/skills/<name>` exposes each shared `.agents/skills/<name>` through a relative directory symlink so Claude Code can discover its name and description. Edit the canonical target. Discovery does not load the whole skill: before acting, load it whenever the `AGENTS.md` routing matches the task. Apply the shared preflight in `docs/agent-loops.md`, already imported by `CLAUDE.md`.
- Read a skill completely by loading it with the `Skill` tool, which loads the whole `SKILL.md`. Read a file under its `references/` with `Read`, completely, because the `Skill` tool does not load references. Do not read a skill or reference through Bash or a partial `Read`.

## Node commands

- Run Node, npm and npx commands with the PowerShell tool. In Git Bash, `~/.bashrc` runs `fnm env --use-on-cd`, so a `cd` in a non-interactive Bash call prints a Node-version error; avoid `cd` there and use `git -C <path>` for Git. VocaSpace has no `.node-version`; CI uses Node 20 ([FEAT-027](../docs/programs/infrastructure/future-features.md#feat-027-pin-the-local-node-version-to-ci) records aligning them).

## Desktop app file virtualization

- On Windows the Claude desktop app runs as an MSIX package, so a file a Claude process (Main, an implementor or a tool they start) writes under `%APPDATA%` or `%LOCALAPPDATA%` can land in `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache` and be invisible to the Owner's own shells and programs. Put anything the Owner also uses (a runtime, a version manager, a shared cache) in a folder outside `AppData`, such as `%USERPROFILE%\.<tool>`, and confirm it from the Owner's own shell before relying on it. Files only Claude processes read, such as the scratchpad, may stay under `AppData`.

## Implementation by Main

- When the Owner approves a plan for Main to implement itself, Main has the same local-commit grant as an implementor handoff: commit each checkpoint locally after its self-review, and commit the approved plan with or before the first checkpoint if it is still uncommitted. No push, PR or merge.

## Implementation through Sonnet

- Confirm the requested model/session/effort is available; never substitute silently. Check the started session's actual effort and correct it to the granted level through native session controls if needed.
- When the Owner hands a plan to Sonnet (orchestrator mode), start one implementor session for all checkpoints with `start_session`, not a subagent: model `claude-sonnet-5-5`, effort `high`, in the product checkout on the current branch (`use_worktree: false`). Do this only for an approved plan with no open decision; otherwise ask the Owner first. The handoff grants local commits only.
- The session has no agent definition. Use the implementation brief in `.agents/skills/implementation-planning-and-pr-breakdown/references/pr-breakdown-and-handoff.md`; name the accepted plan and add only assigned work, read-first sources, missing operational facts and the actual grant. No push, PR or merge.
- When the session ends a turn, Main is called to handle the next step. That note quotes only the start of the report, so read the full report and check the diff and commits before trusting it.
- Send corrections and later checkpoints to the same session with SendMessage; do not start a new session, a subagent or an independent review per checkpoint. Reviews or evidence that the plan or a skill requires (for example a fresh-reader round) still run at their checkpoint.
- While an implementor owns the plan, Main does not edit product code or tests, even for small QA fixes.
- Shared writer rule (`AGENTS.md`): Main reads the implementor's state from the app's "Linked sessions now" note or `list_sessions` with `linked: true`. A session that is running a turn is active; an open session that ended its turn is idle. When the state is unclear, treat it as running and edit nothing.

## Discovery

- Standing permission: for multi-dimension discovery, fan out several narrow parallel `Explore` subagents with `model: "haiku"` without asking. Skip it for small work.
- Haiku reads the code and reports findings with `file:line` evidence; its output is advisory. Main synthesizes the reports, reads only the critical files to verify key claims, and writes the plan, so Main keeps the key facts without spending context on broad search. A `Workflow` script still needs an explicit Owner opt-in.

## CI

- Standing permission: when told to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground; do not end the turn to wait for app events.

## Cloud sessions

- Run `scripts/dev/cloud-isolated-db.sh` only in a cloud session (`CLAUDE_CODE_REMOTE=true`) whose task needs the local DB; it starts the isolated runtime (API 45441) and prints the test env.

## Auto mode

- When auto mode denies an action the Owner seems to have asked for, treat the grant as not explicit enough: ask with AskUserQuestion, naming the exact command and target, and run it only after the Owner approves. Do not retry it unchanged or drop the step silently.

## Jev (TypeSafe), optional

- Use it only when a TypeSafe key and the `typesafe-ai` skill are available; otherwise skip it.
- Only for bulk, narrow judgments (about 20 or more items with the same question); not for review verdicts, plan decisions or single items. Output is advisory per `AGENTS.md` rule 5.
- Never send secrets, `.env*` contents, real user data or hosted DB rows. Do not install third-party Jev plugins unless the Owner asks.

## Memory

- Claude memory holds only unit state, facts about the Owner, machine observations and evaluation notes; delete a unit's state when the unit closes.
- A new durable working rule goes to its owner (`AGENTS.md`, this file or the owning skill) as a separate `chore(agent-rules): …` commit on the next PR. Until that PR exists, keep it in memory marked "pending move" and delete it once committed.
