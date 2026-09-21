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
| Model | `.codex/config.toml` → `default_subagent_model = "gpt-5.6-sol"` (one global default; roles do not pick a model) | `model: inherit` → the session/subagent model, i.e. `CLAUDE_CODE_SUBAGENT_MODEL` |
| Reasoning effort | `model_reasoning_effort = "high"` (Class A) / `"medium"` (Class B) | `effort: max` on all four profiles |
| Sandbox | `sandbox_mode = "workspace-write"`; `"read-only"` for Specialist | `tools:` allow-list; Claude Code has no equivalent sandbox |
| Write scope | enforced by the sandbox | contract-enforced only (see gaps below) |

`model: inherit` is deliberate: it preserves the Codex structure in which **no role picks its own model**
and one global default supplies it. Restoring a stronger model is therefore a settings change, not an edit
to these profiles.

### Owner-authorized deviations (2026-09-18)

1. **Model identity.** `gpt-5.6-sol` is not reachable from a Claude Code session on this machine — the CCR
   gateway runs provider-only and every model slot is remapped to `anthropic.ccr.deepseek-v4-1-flash`.
   `native-multi-agent-workflow` forbids silently substituting a model, so the substitution is recorded
   here and was explicitly authorized by the Owner rather than inferred.
2. **Effort.** All four profiles use `effort: max`, per explicit Owner instruction, instead of the Codex
   Class A `high` / Class B `medium` split. Consequence worth knowing: **Class A and Class B profiles are
   now config-identical**; their distinction survives only in instructions, tool lists and the scope Main
   assigns. A Reviewer is still independent by construction (fresh session, zero inherited history), but it
   is no longer differentiated from the Implementor by any config-level setting.

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
