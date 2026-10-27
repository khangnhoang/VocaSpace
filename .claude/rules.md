# Claude Code working rules

Imported by `CLAUDE.md`. This file owns Claude-specific tools and session bindings. `AGENTS.md` owns shared rules, `docs/agent-loops.md` owns the shared lifecycle, and `.agents/skills/` owns task procedures.

Three rules below are standing Owner permissions that apply without asking again: the Codex review scope, Explore fan-out on Haiku, and foreground CI watching.

## Codex

- Standing permission: run a Codex review on your own for every plan and for the main implementation. Loop fix and resume until PASS; ask the Owner only when a finding needs a new decision.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round. Any other Codex call happens only when the Owner asks.
- Use `codex exec`, not an MCP server. Default review: `codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>`, main session only. Add Codex subagents only when the Owner asks for multi-agent; they use `gpt-6.1-sol` at effort `medium` unless the Owner names another model or effort.
- A new task or review target gets a fresh session; use `codex exec resume <id>` only for later rounds of the same task. Resume does not keep the first round's flags, so repeat `-m`, effort and sandbox on every resume and check the log header.
- If a Codex app thread holds the writer (`thread-store conflict`), give the Owner the round prompt to paste there instead of resuming.

## Planning

- Ask open Owner decisions with AskUserQuestion (recommended option first, marked "(Recommended)", at most 4 per call) before the plan is written or sent to review.
- Any decision that bundles several actions (for example commit, plan approval and an implementation grant) goes through AskUserQuestion, one question per decision, with option descriptions that say exactly what happens. Use the wrap-up buttons only for a single obvious yes/no.

## Preflight reading

- `.claude/skills/<name>` exposes each shared `.agents/skills/<name>` through a relative directory symlink so Claude Code can discover its name and description. Edit the canonical target. Discovery does not load the whole skill: before acting, invoke the skill or read its whole `SKILL.md` whenever the `AGENTS.md` routing matches the task. Apply the shared preflight in `docs/agent-loops.md`, already imported by `CLAUDE.md`.

## Implementation through Sonnet

- When the Owner hands a plan to Sonnet (orchestrator mode), start one implementor session for all checkpoints with `start_session`, not a subagent: model `claude-sonnet-5-5`, effort `high`, in the product checkout on the current branch (`use_worktree: false`). Do this only for an approved plan with no open decision; otherwise ask the Owner first. The handoff grants local commits only.
- The session has no agent definition, so the brief states the implementor limits itself: before the first edit, read `docs/agent-loops.md` and the whole `SKILL.md` of every skill the `AGENTS.md` routing table matches for the plan; do only the assigned checkpoints, stop and report on any mismatch with the plan, and no push, no PR, no merge.
- When the session ends a turn, Main is called to handle the next step. That note quotes only the start of the report, so read the full report and check the diff and commits before trusting it.
- Send corrections and later checkpoints to the same session with SendMessage; do not start a new session, a subagent or an independent review per checkpoint. Reviews or evidence that the plan or a skill requires (for example a fresh-reader round) still run at their checkpoint.
- While an implementor owns the plan, Main does not edit product code or tests, even for small QA fixes.
- The handoff prompt names the approved plan file as the source of task scope and acceptance and adds only the checkpoint scope, the authority and operational notes the plan lacks. Shared precedence and permission rules still apply; stop and report a material conflict. Do not restate the plan's scope or acceptance in your own words.
- A concern the plan does not cover goes into the prompt as a risk to prove with tests, stating the expected result. Hand over all checkpoints in one dispatch; split them only when a later checkpoint needs an Owner decision based on an earlier result, not so Main can check in between.

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
