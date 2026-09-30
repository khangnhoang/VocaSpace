# Claude Code configuration for this repository

## Managed-workflow role profiles

[`agents/`](agents/) is the **Claude Code platform projection** of the project-scoped role configuration
that `native-multi-agent-workflow` requires. Its Codex counterpart is [`.codex/agents/`](../.codex/agents/).

Nothing here is read by Codex, and nothing under `.codex/` was changed to create it. Codex continues to
resolve its own profiles from `.codex/config.toml` + `.codex/agents/*.toml`; the two configurations are
independent and currently describe the same roles.

`agents/` contains **only** agent profiles, matching the upstream convention — no README or other
frontmatter-less markdown may be added there, because that directory is globbed for agent definitions.

### Role → profile mapping

Logical role names come from the Master Plan role matrix ([`docs/native-multi-agent/plan.md`](../docs/native-multi-agent/plan.md), "Role matrix").
Handoffs reference logical role/class, so these profile names are dispatch handles only.

| Logical role(s) | Profile | Codex counterpart |
| --- | --- | --- |
| Master Planner, Planner, Master Plan Correction | `nma-planner` | `planner.toml` |
| Implementor | `nma-implementor` | `implementor.toml` |
| Master Plan Reviewer, Plan Reviewer, Implementation Reviewer | `nma-reviewer` | `reviewer.toml` |
| Specialist | `nma-specialist` | `specialist.toml` |

### Config mapping

| Dimension | Codex | Claude Code |
| --- | --- | --- |
| Model | `.codex/config.toml` → `default_subagent_model = "gpt-5.6-sol"` (one global default; roles do not pick a model) | `model: inherit` → the main session's model |
| Reasoning effort | `model_reasoning_effort = "high"` (Class A) / `"medium"` (Class B) | `effort: high` (Reviewer) / `effort: medium` (Planner, Implementor, Specialist) |
| Sandbox | `sandbox_mode = "workspace-write"`; `"read-only"` for Specialist | `tools:` allow-list; Claude Code has no equivalent sandbox |
| Write scope | enforced by the sandbox | contract-enforced only (see gaps below) |

`model: inherit` is deliberate: it preserves the Codex structure in which **no role picks its own model**
and one global default supplies it. Restoring a stronger model is therefore a settings change, not an edit
to these profiles.

### Owner-authorized deviations (updated 2026-09-30)

1. **Model identity.** `gpt-5.6-sol` is not reachable from a Claude Code session, so every profile runs on
   the main session's Claude model. `native-multi-agent-workflow` forbids silently substituting a model, so
   the substitution is recorded here and was explicitly authorized by the Owner rather than inferred.
2. **Effort.** Per explicit Owner instruction, `nma-planner` and `nma-specialist` use `medium` instead of
   the Codex Class A `high`; `nma-reviewer` (`high`) and `nma-implementor` (`medium`) match Codex.
   Frontmatter `effort` only takes effect while the `CLAUDE_CODE_EFFORT_LEVEL` environment variable is
   unset — that variable overrides every profile.

### Fidelity gaps

Claude Code cannot express two Codex guarantees, so they remain contract-enforced:

- **No path-scoped write.** `nma-planner`, `nma-implementor` and `nma-reviewer` all hold `Write`/`Edit`.
  "Write only the assigned candidate path" and "write only `expected_review_artifact_ref`" are honour-bound,
  not enforced by the tool layer.
- **No true read-only sandbox.** `nma-specialist` omits `Write`/`Edit` but retains `Bash`, which can still
  mutate. Its read-only contract is honour-bound.

Neither gap weakens an existing invariant: a successful tool call never grants implementation, Git, remote,
production or destructive authority. They are recorded here rather than papered over.

### Dispatch

Main alone dispatches these profiles. Each initial role is spawned fresh with zero inherited task history
and the complete bounded package; correction, rereview, blocker resume and synchronized steer reuse the
**same** stored role session (`SendMessage` against the exact agent identity), never a replacement.

Review artifacts are written under [`docs/native-multi-agent/reviews/`](../docs/native-multi-agent/reviews/),
which is Git-ignored — they must stay untracked and unstaged.
