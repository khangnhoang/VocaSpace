# Claude Code working rules

Imported by `CLAUDE.md`; Codex does not load this file. Rules shared with Codex live in `AGENTS.md` and the skills.

Three rules below are standing Owner permissions that apply without asking again: the Codex review scope, Explore fan-out on Haiku, and foreground CI watching.

## Codex

- Standing permission: run a Codex review on your own for every plan and for the main implementation. Loop fix and resume until PASS; ask the Owner only when a finding needs a new decision.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round. Any other Codex call happens only when the Owner asks.
- Use `codex exec`, not an MCP server. Default review: `codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>`, main session only. Add Codex subagents only when the Owner asks for multi-agent; they use `gpt-6.1-sol` at effort `medium` unless the Owner names another model or effort.
- A new task or review target gets a fresh session; use `codex exec resume <id>` only for later rounds of the same task. Resume does not keep the first round's flags, so repeat `-m`, effort and sandbox on every resume and check the log header.
- If a Codex app thread holds the writer (`thread-store conflict`), give the Owner the round prompt to paste there instead of resuming.

## Planning

- Ask open Owner decisions with AskUserQuestion (recommended option first, marked "(Recommended)", at most 4 per call) before the plan is written or sent to review.

## Implementation

- When the Owner hands a plan to Sonnet (orchestrator mode), dispatch one `sonnet-high-implementor` session for all checkpoints. Do this only for an approved plan with no open decision; otherwise ask the Owner first. The handoff grants local commits only.
- Send corrections and later checkpoints to the same session with SendMessage; do not start a subagent or an independent review per checkpoint. Reviews or evidence that the plan or a skill requires (for example a fresh-reader round) still run at their checkpoint.
- While an implementor owns the plan, Main does not edit product code or tests, even for small QA fixes.

## Discovery

- Standing permission: for multi-dimension discovery, fan out several narrow parallel `Explore` subagents with `model: "haiku"` without asking. Skip it for small work.
- Haiku reads the code and reports findings with `file:line` evidence; its output is advisory. Main synthesizes the reports, reads only the critical files to verify key claims, and writes the plan, so Main keeps the key facts without spending context on broad search. A `Workflow` script still needs an explicit Owner opt-in.

## CI

- Standing permission: when told to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground; do not end the turn to wait for app events.

## Jev (TypeSafe), optional

- Use it only when a TypeSafe key and the `typesafe-ai` skill are available; otherwise skip it.
- Only for bulk, narrow judgments (about 20 or more items with the same question); not for review verdicts, plan decisions or single items. Output is advisory per `AGENTS.md` rule 5.
- Never send secrets, `.env*` contents, real user data or hosted DB rows. Do not install third-party Jev plugins unless the Owner asks.

## Memory

- Claude memory holds only unit state, facts about the Owner, machine observations and evaluation notes; delete a unit's state when the unit closes.
- A new durable working rule goes to its owner (`AGENTS.md`, this file or the owning skill) as a separate `chore(agent-rules): …` commit on the next PR. Until that PR exists, keep it in memory marked "pending move" and delete it once committed.
