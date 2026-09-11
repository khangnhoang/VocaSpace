## Core Engineering Rules

These rules apply to all repository work. `docs/agent-loops.md` and routed skills own detailed procedures and may add stricter requirements, but must not weaken these rules.

1. **Think Before Coding.** Do not assume; surface trade-offs.
   - Separate repository-confirmed facts, Owner decisions, assumptions, proposals, and unresolved questions.
   - Inspect the current contract first; stop when an unresolved ownership, permission, or acceptance decision could change the solution.

2. **Simplicity First.** Use the smallest mechanism that fully solves the current problem.
   - Before adding a control, artifact, provenance layer, fingerprint, validator, or workflow stage, ask: “If omitted, is there a realistic failure mode in which the requested outcome becomes incorrect, unsafe, unverifiable at the claim level already required by the task or owning contract, or impossible to complete?” If not, omit it.
   - Extra rigor, auditability, provenance, and theoretical completeness are luxuries unless required by a concrete risk or completion claim already established by the task or owning contract. Never use this rule to bypass required security, data-integrity, permission, ownership, correctness, or stop gates, or requirements for truthful verification claims.
   - Prefer native composition over custom orchestration and ephemeral in-session state over persistence. Add a runtime, database, scheduler, durable log, cryptographic provenance, or generalized framework only when an established requirement cannot be met safely by native primitives and bounded repository artifacts.

3. **Surgical Changes.** Touch only what the requested outcome or a necessary correctness constraint requires.
   - Do not refactor, rename, reformat, modernize, or fix unrelated code; report adjacent defects separately.
   - Clean up only artifacts made obsolete by your change, and explain any scope expansion required for security, integrity, or contract preservation.

4. **Goal-Driven Execution.** Define observable success and work toward it within the current scope, authority, and execution bounds.
   - State what must change, what must remain true, and what is explicitly excluded before implementation.
   - Completing planned steps is not completion when the required outcome remains unverified or is contradicted by repository evidence.

5. **Use Models Only for Judgment Calls.** Use deterministic tools for deterministic questions.
   - Use search, Git, tests, schemas, validators, and exact comparisons for factual or structural checks.
   - Model, reviewer, specialist, and evaluator output is advisory until reconciled against repository evidence under its owning workflow.

6. **Token Budgets Are Not Advisory.** Treat stated token, context, attempt, and evaluation budgets as hard constraints.
   - Route context before reading broadly; do not repeatedly load unchanged or irrelevant sources.
   - Narrow or stop before exceeding a budget; never use budget pressure to omit mandatory evidence, weaken a safety gate, or report incomplete work as complete.

7. **Surface Conflicts, Do Not Average Them.** Treat incompatible instructions or evidence as a decision boundary.
   - Identify the conflicting sources, their owners, and the affected behavior; resolve the conflict using documented ownership and precedence instead of inventing a compromise.
   - When permission or safety remains ambiguous after applying established precedence, take the safer, more restrictive action and report the ambiguity rather than assuming authority.

8. **Read Before Writing.** Inspect the owning sources and direct dependencies before proposing or applying a change.
   - Apply the Universal Lightweight Preflight; read the applicable `AGENTS.md`, target sources, nearby contracts and tests, and each skill whose activation condition matches. Read every selected skill completely.
   - Load conditional skill resources only when their stated read conditions match, and inspect current Git, plan, progress, problem, or Owner-decision state only when it can affect scope, dependency, authority, or truthfulness.

9. **Tests Verify Intent Through Observable Behavior.** Test the promised contract, not the implementation structure.
   - Assert meaningful inputs, outputs, state transitions, permissions, persistence, and user-visible results at the layer selected by `test-quality-strategy`.
   - Report failed, skipped, unavailable, and inconclusive checks explicitly; deterministic agent-skill validation does not substitute for product, integration, browser, or live-model evidence.

10. **Treat Completed Implementation as a Review Checkpoint.** Completion does not authorize automatic Git or remote actions.
    - Report changed files, verification actually executed, skipped or failed checks, remaining risks, manual QA status, and a recommended English Conventional Commit message.
    - Keep commit, push, PR action, CI fixing, merge, deployment, database mutation, and branch deletion as separate authorities.

11. **Match Conventions, Even If You Disagree.** Follow the repository’s current owning patterns unless changing them is the task.
    - Match nearby naming, placement, contracts, error handling, test style, and documentation structure instead of importing generic external patterns.
    - Preserve one semantic owner and canonical source of truth; surface an ownership mismatch when the existing abstraction cannot correctly own new behavior.

12. **Fail Loud.** A blocked, failed, partial, or unverified result must remain visibly so.
    - Preserve and report the exact failure, state, affected claim, and working-tree or external-state condition.
    - Do not hide blockers behind mocks, fallbacks, skipped checks, stale evidence, or weaker validation; state the smallest requirement needed to resume.

## Owner-facing language

When the owner communicates in Vietnamese, write updates and reports in natural, easy-to-understand Vietnamese, including common report headings and terms. Preserve exact technical literals and evidence such as code identifiers, commands, file paths, branches, commit messages, PR titles, schema fields, machine-readable values, exact errors, and familiar technical terms when translation would reduce clarity. A language instruction in the owner's current task takes precedence.

## Agent lifecycle loops

Before acting on any repository task, read `docs/agent-loops.md` and apply its Universal Lightweight Preflight before choosing discovery depth.

After that preflight, continue into the matching detailed lifecycle loop before acting on that phase when the task involves any of the following:

* non-trivial planning, unclear scope, PR breakdown, dependency ordering, or multi-domain implementation planning;
* completion of an implementation task before the final checkpoint report;
* review of a PR, branch, diff, commit range, checkpoint, or merge readiness;
* inspection or handling of CI failures on a PR.

`docs/agent-loops.md` is a lifecycle routing overlay. It does not override the domain skills in `.agents/skills/*/SKILL.md`.

If it conflicts with a domain skill or a safer permission rule, follow the more specific or more restrictive instruction and report the conflict.

## Skill routing

Before planning non-trivial work, editing repository files, reviewing changes, or creating commits, inspect the task scope and read the relevant skill file(s):

- Use `.agents/skills/supabase-safe-migration/SKILL.md` for Supabase/PostgreSQL work: migrations, tables, columns, indexes, constraints, RLS policies, RPC functions, triggers, SQL functions, seed data, integration tests, db reset, or race-condition-sensitive database behavior.
- Use `.agents/skills/nextjs-server-action-zod/SKILL.md` for validation/type-boundary work: Next.js Server Actions, Route Handlers, API payloads, FormData, Zod schemas, DTOs/interfaces, inferred types, form validation, safeParse, client/server boundary type-safety, or schema/type SSOT.
- Use `.agents/skills/test-quality-strategy/SKILL.md` for unit tests, schema tests, component tests, form interaction tests, React Hook Form tests, Server Action tests, Route Handler/API tests, integration tests, regression tests, smoke E2E tests, browser automation, or test coverage strategy.
- Use `.agents/skills/frontend-design/SKILL.md` for product-aware frontend UI/UX work: pages, components, learning experiences, course authoring screens, admin dashboards, dialogs, forms, tables, responsive design, accessibility, and product UI.
- Use `.agents/skills/frontend-workflow/SKILL.md` for non-trivial frontend engineering work: repository discovery, frontend planning, database/type inspection, Zod and API contract inspection, mock data boundaries, implementation, state management, async behavior, performance review, automated verification, manual UI validation, and final frontend audits.
- Use `.agents/skills/code-commenting-and-maintainability/SKILL.md` when adding, changing, reviewing, or removing comments, JSDoc/TSDoc, TODO/FIXME notes, test-plan headers or other structured test documentation when `test-quality-strategy` requires it, or documentation for non-obvious implementation logic.
- Use `.agents/skills/maintain-repo-skills/SKILL.md` when creating, changing, reviewing, splitting, routing, documenting, or evaluating repo-local agent skills or their bundled resources. Do not use it merely because an ordinary product task follows an existing skill.
- Use `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` for non-trivial implementation, refactor, migration, multi-domain, or multi-PR work that requires repository discovery, confirmed facts and assumptions, scope and exclusions, dependency ordering, implementation prompt breakdown, acceptance criteria, verification strategy, manual QA planning, implementation briefs, or plan/progress tracking.
- Use `.agents/skills/git-checkpoint-workflow/SKILL.md` after completing an implementation prompt or when handling commit recommendations, local commits, checkpoint diffs, staging, dirty working trees, correction commits, amend/squash decisions, branch safety, push requests, or pull-request actions. Completed implementation prompts should end with a review checkpoint report, not an automatic commit. Create a local English Conventional Commit only after explicit owner approval. Never push unless the user explicitly requests it; the narrow exception is the bounded small/safe PR/CI self-fix loop defined in `.agents/skills/github-pr-ci-workflow/SKILL.md`.
- Use `.agents/skills/github-pr-ci-workflow/SKILL.md` when creating or updating GitHub pull requests with GitHub CLI, writing PR titles/bodies, watching CI, reading failed CI logs, fixing small safe branch-caused CI failures, deciding whether to stop/report, or handling explicit auto-merge requests. When the owner explicitly asks for PR creation/update plus CI watching, this skill allows bounded `branch-caused-small-safe` fixes to be committed and normally pushed to the same PR branch; it does not allow large/risky fixes, force-push, merge, branch deletion, or unrelated work.
- Use `.agents/skills/code-review-and-quality/SKILL.md` when reviewing a completed implementation prompt, checkpoint commit, correction commit, branch, or pull request; auditing correctness, architecture, scope, verification evidence, or merge readiness; or reviewing code written by a human or agent.
- Use `.agents/skills/native-multi-agent-workflow/SKILL.md` when selecting, running, changing, or reviewing `MULTI_AGENT_MASTER_PLAN` or `MULTI_AGENT_E2E`; when handling a managed role handoff, review artifact, correction round, Owner steer, or managed-workflow blocker; or when deciding that such a workflow must stop at `OWNER_DECISION_REQUIRED`. Keep routine coherent work in `NORMAL`.
- For non-trivial UI implementation, use both frontend-design and frontend-workflow.
- If a frontend task also touches schemas, Server Actions, Route Handlers, APIs, tests, Supabase, or database behavior, read all corresponding skills.
- If a task touches multiple domains, read and follow all relevant skills before editing.
- Do not start editing until the relevant skill instructions and existing project conventions have been inspected.
