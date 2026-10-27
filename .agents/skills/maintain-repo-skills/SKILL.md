---
name: maintain-repo-skills
description: Create, maintain, split, route and review repository skills/references and audit instruction ownership. Use when a repo-local skill or its governance changes, or when deciding where a working rule belongs.
---

# Maintain repository skills

## Use when / do not use when

Use for a SKILL.md/reference change, routing/description update, ownership audit or a new durable instruction. Do not activate merely because a product task follows a skill. AGENTS.md owns shared permissions; this skill grants no action. A new skill or material ownership/permission/acceptance change needs the Owner's decision; an exact current instruction may already settle it.

## Placement

Choose by owner and load time, not line count:
| Content | Owner |
| --- | --- |
| Shared principles, permissions, language and skill activation | AGENTS.md |
| When to plan/review/wait/stop and self-review cap/cadence | docs/agent-loops.md |
| Claude-specific tools, sessions and memory mechanics | .claude/rules.md |
| Importing shared instructions for Claude | CLAUDE.md |
| A task procedure all its users need | Its existing SKILL.md |
| Situational detail a meaningful group can skip | A directly linked reference with an exact read condition |
| Program shape/state or cross-program decisions | repo-docs-system's program/ADR owners |

Link another owner's rule rather than restating it. Keep enough permission/safety/ownership context in core for a reader to determine whether it may act, which resource to read and when to stop. Never reduce context by weakening an invariant.

## Author and maintain

1. Read the target, direct consumers and owning sources. Separate confirmed facts, Owner decisions, assumptions and conflicts.
2. State the scope, consumer, acceptance and verification proportionally; planning owns non-trivial plans. Do not build a new runner, registry or durable tracker for a prose edit.
3. Core holds activation, ownership, action/evidence boundaries, routing and stops. References hold only needed conditional procedure, examples or templates. Every reference must be directly linked from core, contained in the bundle and have an observable read condition; no hidden nested required chain or reparse-point routing.
4. Write descriptions with the verbs/objects a real request uses. Check matching requests and near misses against overlapping skill descriptions. This judgment check is not proof of native auto-trigger behavior.
5. Edit the canonical .agents/skills target. Keep its per-skill Claude symlink aligned when adding/removing a skill. Find every pointer to moved/changed paths/commands/sections with rg; fix active false pointers and preserve historical meaning.
6. State only tooling that exists. Deferred tooling is named once as deferred, not described as usable steps. Prefer current project choices/pitfalls over generic API tutorials; version-specific traps need an evidence source.
7. Self-review and run node .agents/scripts/validate-skill.mjs. For docs/pointer edits run npm run docs:check; if validator code changed run its tests. Read the review skill for readiness; report actual results, limits and authority, not a token/quality claim.

The validator owns its actual frontmatter/routing syntax. Do not copy another project's metadata/heading rules or change schema merely to make a new document pass. Length is a review signal, never a limit. No line reduction outweighs a known safety, routing, ownership or correctness regression.

## Evaluation and claims

Structural validation proves structure only. Existing eval tooling remains available; it is not a mandatory model-call workflow for every edit. No model, independent reader or remote call is granted by this skill. When execution is absent, report not_run rather than semantic PASS; historical evidence stays historical.

Optional authorized advice needs a concrete question, relevant bounded evidence and stated access limits. It cannot grant authority or decide acceptance. Comparative/model-quality/isolation claims require actual comparable evidence; don't infer them from file metrics or a new session.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Core/reference split](references/progressive-disclosure.md) | Moving content between core/reference, adding/removing/moving a bundled resource or reviewing such a split. | Ordinary edits without a split. |
| [Instruction audit](references/audit.md) | Auditing placement/duplication or deciding where existing instructions belong. | A bounded edit with settled ownership. |
| [Skill template](references/templates/skill.md) | Writing a new skill. | Editing an existing skill. |
| [Reference template](references/templates/reference.md) | Writing a new reference. | Editing an existing reference. |
| [Fresh reader](references/fresh-reader-testing.md) | Designing/running/reporting a separately authorized fresh-reader check. | No independent observation is requested or authorized. |
| [Eval design](references/eval-design.md) | Designing/changing/validating/preparing/reporting a skill evaluation suite or claiming comparative evidence. | Ordinary instruction edits without evaluation artifacts/claims. |
| [Eval adjudication](references/evaluation-adjudication-and-correction.md) | Planning semantic acceptance/sampling, grading observations or selecting a bounded correction probe. | No semantic evaluation/adjudication. |

## Stop and report

Stop for unresolved material authority/ownership/acceptance, conflicting approved sources, unsupported verification or scope/tooling expansion. Report the changed owner/files, checks and limitations, unresolved findings, pending independent/runtime evidence and Git/remote state. Review or a skill cannot approve itself.
