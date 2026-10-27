# Shared agent instructions

These rules apply to every agent working in this repository. Direct Owner instructions and higher-level safety rules take precedence. Read [agent-loops.md](docs/agent-loops.md) before acting; it owns the common lifecycle. Skills own task procedures.

## Core engineering rules

1. **Think before coding.** Separate repository-confirmed facts, Owner decisions, assumptions and open questions. Inspect the current contract; stop when an unresolved ownership, permission or acceptance decision could change the solution.
2. **Simplicity first.** Add a control, artifact or workflow step only when omitting it creates a realistic correctness, safety, ownership, verification or completion failure. Prefer native composition and temporary session state over custom runtimes, durable logs or orchestration.
3. **Surgical changes.** Touch only the requested outcome and necessary correctness constraints. No unrelated refactor, cleanup, rename or formatting; report adjacent defects separately.
4. **Goal-driven execution.** State what must change, what must stay true and what is excluded. Finished steps are not completion while the promised outcome is unverified.
5. **Models for judgment only.** Use search, Git, schemas, tests and exact comparisons for factual questions. Reviewer, adviser and evaluator output is advisory until reconciled against the owning evidence.
6. **Respect budgets.** Explicit token, context, attempt and evaluation budgets are hard limits. Read deliberately; do not reload unchanged sources. Budget pressure never permits skipping required evidence or reporting incomplete work as complete.
7. **Surface conflicts.** Name incompatible sources and their owners; apply documented precedence rather than averaging them. If permission remains unclear, take the narrower action and report the ambiguity.
8. **Read before writing.** Read applicable root/nested instructions, the target, direct consumers, nearby contracts/tests and every matching skill completely. Load conditional references only when their read condition matches. Match conventions and keep one semantic owner per fact.
9. **Test observable behavior.** Assert inputs, outputs, permissions, persistence and visible state transitions at the appropriate layer. Report failed, skipped, unavailable and inconclusive checks. Structure checks are not product, browser or live-model proof.
10. **Completion is a review checkpoint.** Report changed files, checks actually run, risks and pending QA. Implementation, commit, push, PR, CI fixing, merge, deployment, database mutation and branch deletion are separate authorities. One explicit instruction may grant several; never infer the others. A verdict or successful tool call grants none.
11. **Preserve safety and contracts.** Follow current naming, placement, error handling, test and documentation conventions unless changing them is the task. Never trade security, data integrity, permissions or truthful verification for brevity.
12. **Fail loud.** Keep blocked, failed, partial and unverified results visible. Preserve the exact failure and relevant working-tree/external state; state the smallest requirement to resume. Do not hide it behind mocks, fallbacks or weaker checks.

## Language

Owner-facing replies and questions follow the Owner's current language; use natural Vietnamese when the Owner uses Vietnamese. Preserve technical identifiers, commands, paths and exact errors. Repository docs/skills use English; code and test comments follow code-commenting-and-maintainability.

## User-data disclosure

A change adding user data, a read path exposing it to other people, or a third party/tracker updates /privacy in the same PR, and /terms when relevant. Legal wording needs Owner approval.

## Skill routing

Read every matching SKILL.md in full before its action. This table owns activation, not execution permission.

| Skill | Read when |
| --- | --- |
| [playwright-cli](.agents/skills/playwright-cli/SKILL.md) | Driving a browser, verifying a web page through a browser, or authoring/running/debugging/healing Playwright tests. Existing config, an open browser or source-only discussion alone does not activate it. |
| [supabase-safe-migration](.agents/skills/supabase-safe-migration/SKILL.md) | Supabase/PostgreSQL migrations, schema, indexes, constraints, RLS, RPC, triggers, functions, seed, Storage, DB integration or race-sensitive database behavior. |
| [nextjs-server-action-zod](.agents/skills/nextjs-server-action-zod/SKILL.md) | Server Actions, Route Handlers, API payloads, FormData, Zod, DTOs, inferred types, validation or client/server type boundaries. |
| [test-quality-strategy](.agents/skills/test-quality-strategy/SKILL.md) | Choosing, writing, changing, reviewing or reporting tests, regression coverage, mocks, fixtures or verification strategy. |
| [frontend-design](.agents/skills/frontend-design/SKILL.md) | Product-facing UI/UX, pages, components, forms, dialogs, tables, responsive design or accessibility. |
| [frontend-ui-review](.agents/skills/frontend-ui-review/SKILL.md) | An explicit rendered UI review against accepted designs, or a substantial new-page/redesign/shared-visual checkpoint with an accepted design and runnable target. Not source-only review or ordinary functional QA. |
| [frontend-workflow](.agents/skills/frontend-workflow/SKILL.md) | Non-trivial frontend discovery, planning, implementation, state/async behavior, performance, automated/manual verification or final audit. |
| [code-commenting-and-maintainability](.agents/skills/code-commenting-and-maintainability/SKILL.md) | Adding/changing/reviewing comments, JSDoc/TSDoc, TODO/FIXME, required test-plan headers or explanations of non-obvious behavior. |
| [maintain-repo-skills](.agents/skills/maintain-repo-skills/SKILL.md) | Creating/changing/reviewing/splitting/routing a repo skill/reference or auditing the instruction system. Not merely following a skill. |
| [implementation-planning-and-pr-breakdown](.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md) | Non-trivial discovery/planning, dependency or PR breakdown, acceptance, verification strategy, implementation briefs or plan revisions. |
| [repo-docs-system](.agents/skills/repo-docs-system/SKILL.md) | Creating/changing/closing/migrating program docs, State, problems, future features, ADRs, backlog or docs taxonomy. |
| [git-checkpoint-workflow](.agents/skills/git-checkpoint-workflow/SKILL.md) | Branch/base/dirty-tree decisions, staging, commits, corrections/history, pushes or checkpoint delivery. Local commits need an explicit grant. |
| [github-pr-ci-workflow](.agents/skills/github-pr-ci-workflow/SKILL.md) | GitHub PR metadata/actions, CI watching/logs/classification/fixing or explicit merge/auto-merge. Its bounded small-safe CI exception is the only standing commit/push exception. |
| [code-review-and-quality](.agents/skills/code-review-and-quality/SKILL.md) | Author self-review, review of plans/briefs/code/checkpoints/branches/PRs, readiness or preparing a Codex review. Small self-review reads the method, not every formal-review reference. |

Non-trivial UI implementation uses both frontend skills plus every affected domain skill. Playwright CLI owns browser-driving mechanics; test-quality-strategy owns required evidence and fixture readiness, and frontend skills own UI acceptance. Use a different driver only when explicitly requested or Playwright cannot reach the required surface; do not duplicate checks without a concrete reason.
