# Codex review brief

Read this before preparing, running or resuming a Codex review. docs/agent-loops.md owns when review is required and how Main waits; AGENTS.md owns permissions. A reviewer never dispatches another reviewer merely because it reads these sources.

## Invocation and continuity

Use codex exec from Main, not an MCP workaround. Default review uses gpt-6.1-sol, high effort and read-only sandbox unless the Owner specifies another configuration. Verify actual local CLI help and the startup header; never substitute a model silently.

~~~sh
codex exec - -m gpt-6.1-sol -c 'model_reasoning_effort="high"' -s read-only -o <out> < <prompt>
~~~

Create a fresh session for a new target/phase. Later rounds of the same target use the exact stored session ID, not --last; repeat model, effort and sandbox each time. For a CLI whose resume has no -s option use -c 'sandbox_mode="read-only"'; confirm the header rather than assuming the initial flags persist. Shell quoting differs: use a native executable/argument-array invocation when PowerShell would strip TOML quotes or block codex.ps1.

If a thread-store conflict means another session holds the writer, stop and give the Owner the round prompt for that session. Do not start a competing replacement. Save prompts/results outside tracked source files. Use the tool's completion wait for that exact process/session, not repeated log-tail commands.

## Brief

~~~text
Read first, completely (list actual paths):
1. AGENTS.md and CLAUDE.md
2. .claude/rules.md only when its platform mechanics affect the target
3. docs/agent-loops.md
4. Every matching SKILL.md and its conditionally required references
5. Accepted plan/path/revision and necessary direct source/evidence

Role: independent read-only reviewer. No candidate edits, Git mutation,
app/browser/database/network actions, .env/secret reads or model/subagent calls.
The caller captures your final response; do not write another artifact.

Target: exact plan revision, working-tree file plus diff, or <base>..<head>.
Scope/exclusions and acceptance: cite the accepted source, do not replace it.
Owner decisions: exact material input not otherwise present in the repository.
Known inaccessible facts: supplied snapshots, provenance and limits.
Review holistically for intent, ownership, correctness, scope, implementability,
permissions and evidence. Inspect the real candidate, including untracked files.
Return severity, file:line, consequence and smallest correction, then
PASS or CHANGES REQUIRED (or an explicit blocker). State checks and limits.
~~~

Do not supply the author's conclusion or expected verdict. The reviewer must not use author self-review as its evidence. Supply real files/diffs and material Owner decisions; a plan summary is not the candidate. The review target stays unchanged while reviewed. Reconcile each finding with the repository before acting; an ungranted correction stays a recommendation. Migration review, when relevant, includes SQL, rollback, grants/RLS and rollout order, without granting database execution.
