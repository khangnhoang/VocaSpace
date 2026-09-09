# Contributing to VocaSpace

Thank you for helping improve VocaSpace. Contributions may target the language-learning product, its test coverage, documentation, or the repository-owned agent system.

## Before you start

1. Check existing issues and pull requests to avoid duplicate work.
2. Open an issue before a large change, schema migration, or agent-system redesign so scope and ownership can be agreed first.
3. Read [`AGENTS.md`](AGENTS.md). It defines the repository's engineering contract and routes work to the relevant instructions under [`.agents/skills`](.agents/skills).

Keep changes narrow. Do not mix unrelated refactors, formatting, generated artifacts, or evaluation evidence into the same pull request.

## Local setup

You need a current Node.js LTS release, npm, Git, and a running Docker installation.

```bash
git clone https://github.com/khangnhoang/VocaSpace.git
cd VocaSpace
npm install
npm run dev
```

The development command starts local Supabase and Next.js. It is designed to reject a non-local Supabase endpoint. Never commit credentials or point routine local development at production data.

## Making a change

1. Create a focused branch from an up-to-date `main`.
2. Inspect the owning source, nearby tests, and applicable skill instructions before editing.
3. Implement the smallest change that satisfies the observable requirement.
4. Add or update tests when behavior changes.
5. Update documentation when public behavior, setup, architecture, or agent contracts change.

For database work, add a new migration. Do not edit published migration history. Test migration and rollback behavior against local Supabase before requesting review.

For agent-skill changes, keep `SKILL.md`, conditional references, evaluation suites, and lifecycle routing consistent. Model-based evaluation is not automatically authorized by a documentation or code change.

## Verification

Run the checks proportional to your change and record exactly what ran in the pull request.

Common product checks:

```bash
npm run lint
npm run test:ci
npm run build
```

When applicable:

```bash
npm run test:integration
npm run test:e2e:smoke
```

Deterministic agent-skill checks:

```bash
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
```

Do not report a skipped, blocked, incomplete, or budget-exhausted check as passed. Live semantic evaluation may send repository content to a model provider and consume calls; run it only with explicit authority over the exact scope, model, budget, and egress.

## Pull requests

A useful pull request should include:

- the problem and intended outcome;
- the smallest relevant implementation summary;
- verification commands and their results;
- manual validation performed, if any;
- known gaps, skipped checks, or operational risks; and
- screenshots or recordings for material UI changes.

Use an English Conventional Commit subject when committing, for example:

```text
docs(readme): present VocaSpace as an agent-engineered OSS project
```

Maintainers may request that a broad pull request be split if its parts have different owners, risk levels, or verification requirements.

## Reporting security issues

Do not open a public issue containing credentials, personal data, or exploitable security details. Contact the repository owner privately through their GitHub profile until a dedicated security-reporting channel is published.

## License

By contributing, you agree that your contribution will be licensed under the repository's [MIT License](LICENSE).
