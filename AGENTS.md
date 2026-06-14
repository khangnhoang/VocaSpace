My 12-rule behavior contract is:

1. Think Before Coding: Don't assume. Surface tradeoffs.
2. Simplicity First: Minimum code. No speculation.
3. Surgical Changes: Touch only what I must.
4. Goal-Driven Execution: Define success. Loop until verified.
5. Use model only for judgment calls
6. Token budgets are not advisory
7. Surface conflicts, don't average them
8. Read before I write
9. Tests verify intent through observable behavior, not implementation details.
10. Create a local checkpoint after every completed implementation prompt.
11. Match conventions, even if I disagree
12. Fail loud.

## Skill routing

Before planning non-trivial work, editing repository files, reviewing changes, or creating commits, inspect the task scope and read the relevant skill file(s):

- Use `.agents/skills/supabase-safe-migration/SKILL.md` for Supabase/PostgreSQL work: migrations, tables, columns, indexes, constraints, RLS policies, RPC functions, triggers, SQL functions, seed data, integration tests, db reset, or race-condition-sensitive database behavior.
- Use `.agents/skills/nextjs-server-action-zod/SKILL.md` for validation/type-boundary work: Next.js Server Actions, Route Handlers, API payloads, FormData, Zod schemas, DTOs/interfaces, inferred types, form validation, safeParse, client/server boundary type-safety, or schema/type SSOT.
- Use `.agents/skills/test-quality-strategy/SKILL.md` for unit tests, schema tests, component tests, form interaction tests, React Hook Form tests, Server Action tests, Route Handler/API tests, integration tests, regression tests, smoke tests, future E2E planning, or test coverage strategy.
- Use `.agents/skills/frontend-design/SKILL.md` for product-aware frontend UI/UX work: pages, components, learning experiences, course authoring screens, admin dashboards, dialogs, forms, tables, responsive design, accessibility, and product UI.
- Use `.agents/skills/frontend-workflow/SKILL.md` for non-trivial frontend engineering work: repository discovery, frontend planning, database/type inspection, Zod and API contract inspection, mock data boundaries, implementation, state management, async behavior, performance review, automated verification, manual UI validation, and final frontend audits.
- Use `.agents/skills/code-commenting-and-maintainability/SKILL.md` when adding, changing, reviewing, or removing comments, JSDoc/TSDoc, TODO/FIXME notes, or documentation for non-obvious implementation logic.
- Use `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` for non-trivial implementation, refactor, migration, multi-domain, or multi-PR work that requires repository discovery, confirmed facts and assumptions, scope and exclusions, dependency ordering, implementation prompt breakdown, acceptance criteria, verification strategy, manual QA planning, implementation briefs, or plan/progress tracking.
- Use `.agents/skills/git-checkpoint-workflow/SKILL.md` after completing an implementation prompt or when handling local commits, checkpoint diffs, staging, dirty working trees, correction commits, amend/squash decisions, branch safety, push requests, or pull-request actions. Completed implementation prompts should normally end with a local English Conventional Commit checkpoint when the skill's readiness gate is satisfied. Never push unless the user explicitly requests it.
- Use `.agents/skills/code-review-and-quality/SKILL.md` when reviewing a completed implementation prompt, checkpoint commit, correction commit, branch, or pull request; auditing correctness, architecture, scope, verification evidence, or merge readiness; or reviewing code written by a human or agent.
- For non-trivial UI implementation, use both frontend-design and frontend-workflow.
- If a frontend task also touches schemas, Server Actions, Route Handlers, APIs, tests, Supabase, or database behavior, read all corresponding skills.
- If a task touches multiple domains, read and follow all relevant skills before editing.
- Do not start editing until the relevant skill instructions and existing project conventions have been inspected.
