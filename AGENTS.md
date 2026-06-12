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
10. Checkpoint after every step
11. Match conventions, even if I disagree
12. Fail loud.

## Skill routing

Before editing code, inspect the task scope and read the relevant skill file(s):

- Use `.agents/skills/supabase-safe-migration/SKILL.md` for Supabase/PostgreSQL work: migrations, tables, columns, indexes, constraints, RLS policies, RPC functions, triggers, SQL functions, seed data, integration tests, db reset, or race-condition-sensitive database behavior.
- Use `.agents/skills/nextjs-server-action-zod/SKILL.md` for validation/type-boundary work: Next.js Server Actions, Route Handlers, API payloads, FormData, Zod schemas, DTOs/interfaces, inferred types, form validation, safeParse, client/server boundary type-safety, or schema/type SSOT.
- Use `.agents/skills/test-quality-strategy/SKILL.md` for unit tests, schema tests, component tests, form interaction tests, React Hook Form tests, Server Action tests, Route Handler/API tests, integration tests, regression tests, smoke tests, future E2E planning, or test coverage strategy.
- If a task touches multiple domains, read and follow all relevant skills before editing.
- Do not start editing until the relevant skill instructions and existing project conventions have been inspected.

## Code comments

Use Vietnamese comments in project source code when a comment is needed.

Comments should explain intent, data flow, business rules, validation boundaries, auth/security assumptions, race-condition reasoning, or non-obvious implementation constraints.

For non-trivial exported functions, Route Handlers, Server Actions, RPC wrappers, upload handlers, payment handlers, and validation helpers, add a short comment before the function explaining:

- what the function does
- what problem it solves
- what data flow or trust boundary it controls  

Inside long functions, comment each meaningful stage of the flow, such as input extraction, validation, auth/permission checks, mutation/side effect, response shaping, and error handling.

Do not add comments that only restate obvious syntax.