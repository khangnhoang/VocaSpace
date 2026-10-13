# Claude Code working rules

Imported by `CLAUDE.md`; Codex does not load this file. Rules shared with Codex live in `AGENTS.md` and the skills.

Three rules below are standing Owner permissions that apply without asking again: the Codex review scope, Explore fan-out on Haiku, and foreground CI watching.

## Codex

- Standing permission: run a Codex review on your own for every plan and for the main implementation. Loop fix and resume until PASS; ask the Owner only when a finding needs a new decision.
- Small fixes during Owner QA (copy, layout, styling) get no Codex round. Any other Codex call happens only when the Owner asks.
- Use `codex exec`, not an MCP server. Default review: `codex exec - -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c sandbox_mode='"read-only"' -o <out> < <prompt>`, main session only. Add Codex subagents (default `medium`) only when the Owner asks for multi-agent.
- A new task or review target gets a fresh session; use `codex exec resume <id>` only for later rounds of the same task. Resume does not keep the first round's flags, so repeat `-m`, effort and sandbox on every resume and check the log header.
- If a Codex app thread holds the writer (`thread-store conflict`), give the Owner the round prompt to paste there instead of resuming.

## Planning

- Ask open Owner decisions with AskUserQuestion (recommended option first, marked "(Recommended)", at most 4 per call) before the plan is written or sent to review.

## Implementation

- Give an approved plan with no open decision to one `sonnet-high-implementor` session for all checkpoints; with no approved plan or an open decision, ask the Owner first. The handoff grants local commits only.
- Send corrections and later checkpoints to the same session with SendMessage; do not start a subagent or an independent review per checkpoint.
- Main does not edit product code or tests, even for small QA fixes.

## Discovery

- Standing permission: for multi-dimension discovery, fan out several narrow parallel `Explore` subagents with `model: "haiku"` without asking. Skip it for small work.
- Haiku only locates code. Main reads the critical files, verifies claims and decides. A `Workflow` script still needs an explicit Owner opt-in.

## CI

- Standing permission: when told to wait for CI, run `gh pr checks <n> --watch --interval 30` in the foreground; do not end the turn to wait for app events.

## Jev (TypeSafe), optional

- Use it only when a TypeSafe key and the `typesafe-ai` skill are available; otherwise skip it.
- Only for bulk, narrow judgments (about 20 or more items with the same question); not for review verdicts, plan decisions or single items. Output is advisory per `AGENTS.md` rule 5.
- Never send secrets, `.env*` contents, real user data or hosted DB rows. Do not install third-party Jev plugins unless the Owner asks.
