# VocaSpace

**VocaSpace is an open-source language-learning platform and a real-world reference implementation for repository-owned agent engineering.**

The application supports learners, teachers, and course operations. The same repository is maintained through versioned agent skills, behavioral evaluation suites, bounded semantic review, and a Codex CLI harness designed to reduce redundant model work while preserving evaluation evidence.

[Open VocaSpace](https://vocaspace.vercel.app/) · [Read the ASM-PR6 case study](docs/case-studies/asm-pr6-agent-skill-evaluation.md) · [Contribute](CONTRIBUTING.md)

## What VocaSpace does

VocaSpace is a full-stack product rather than a synthetic agent benchmark. Its application surfaces include:

- learner registration, profiles, course discovery, enrollment, and learning dashboards;
- course, chapter, and topic progression;
- flashcards, exercises, review flows, and spaced-repetition scheduling;
- teacher course authoring for learning content and assessments;
- administrative course and user operations; and
- payment creation, status handling, and PayOS webhook integration.

The product is built with Next.js, React, TypeScript, Supabase/PostgreSQL, Tailwind CSS, Vitest, and Playwright.

## Why this repository is interesting

VocaSpace also treats its agent workflow as maintained repository infrastructure:

- **Repository-owned agent skills** keep domain instructions versioned beside the code they govern.
- **Behavioral evaluation suites** exercise routing, safety, and fresh-reader behavior for those skills.
- **A Codex CLI harness** prepares immutable inputs, records provenance and hashes, enforces attempt budgets, and preserves incomplete outcomes instead of converting them into passes.
- **Bounded semantic review** uses affected-graph probes before broader evaluation runs.
- **Evidence-aware reuse** imports only exact-valid donor reader results and records their provenance.
- **Human adjudication** keeps evaluator proposals advisory when uncertainty reflects missing implementation evidence rather than a defect in the skill.

This is intended as a practical example of applying Codex to core open-source maintenance work: implementation guidance, review, testing, migration safety, and evidence-backed correction inside a real application repository.

## Evidence from ASM-PR6

The ASM-PR6 evaluation sequence provides one concrete case study for the repository's Supabase migration skill:

| Result | Evidence classification |
| --- | --- |
| `270` recorded model attempts across 8 live comparison runs | Reconstructed from retained harness attempt records |
| About `672` attempts under the stated full-fanout counterfactual | Estimated; the counterfactual was not executed |
| About `402` fewer attempts, or approximately `60%` | Derived from `672 - 270`; conditional on that counterfactual |
| Main-agent adjudication: `21/21` required graphs passed, `0 Critical / 0 Required` | Observed evidence plus main-agent adjudication for the exact final evidence set; not owner acceptance |

The comparison is deliberately narrow. It estimates what would have happened if every correction checkpoint had rerun full `2 readers + 1 evaluator` fanout while preserving comparable evidence. It is not a universal benchmark, a cost guarantee, or a claim that another model or configuration will behave identically.

See [the public case study](docs/case-studies/asm-pr6-agent-skill-evaluation.md) for the calculation, evidence boundaries, and adjudication scope.

## How the agent system works

```text
AGENTS.md
  -> docs/agent-loops.md
    -> .agents/skills/<skill>/SKILL.md
      -> conditional references and repository sources

.agents/evals/<skill>/*.json
  -> deterministic validation
  -> prepared reader/evaluator graphs
  -> bounded live execution
  -> advisory evaluator proposals
  -> main-agent adjudication and decision evidence
```

The main components are:

- [`AGENTS.md`](AGENTS.md): repository-wide behavior and skill-routing contract;
- [`docs/agent-loops.md`](docs/agent-loops.md): lifecycle routing for discovery, planning, implementation, review, and CI;
- [`.agents/skills`](.agents/skills): versioned domain skills and conditional reference material;
- [`.agents/evals`](.agents/evals): behavioral suites and evaluator rubrics;
- [`.agents/scripts`](.agents/scripts): deterministic validators and the CLI execution/evaluation harness; and
- [`docs/agent-skills`](docs/agent-skills): architecture, evaluation design, and implementation evidence.

## Application architecture

| Area | Location | Responsibility |
| --- | --- | --- |
| Next.js routes and Server Actions | [`app`](app) | learner, teacher, admin, payment, upload, and webhook flows |
| UI components | [`components`](components) | shared product interface and primitives |
| Domain logic and schemas | [`lib`](lib) | validation, learning logic, course readiness, and read models |
| External integrations | [`services`](services) | service clients such as PayOS |
| Database | [`supabase`](supabase) | migrations, seed data, local configuration, RLS, RPCs, and storage policies |
| Product tests | [`__tests__`](__tests__) and [`e2e`](e2e) | unit, integration, regression, and browser smoke coverage |
| Agent infrastructure | [`.agents`](.agents) | skills, evaluation suites, schemas, and execution tooling |

## Getting started

### Prerequisites

- a current Node.js LTS release and npm;
- Docker running locally; and
- Git.

### Run the application

```bash
git clone https://github.com/khangnhoang/VocaSpace.git
cd VocaSpace
npm install
npm run dev
```

`npm run dev` starts the repository's local Supabase stack on its canonical `4532x` ports, obtains the local credentials, and launches Next.js. It refuses to connect the development process to a non-local Supabase URL.

Useful local database commands:

```bash
npm run supabase:dev:status
npm run supabase:dev:stop
```

Production integrations such as payments require their own deployment secrets. Do not commit local or production credentials.

## Testing and evaluation

Run product checks first:

```bash
npm run lint
npm run test:ci
npm run build
```

The integration and browser suites require the appropriate local services:

```bash
npm run test:integration
npm run test:e2e:smoke
```

Agent-skill validation is a separate evidence system, not a substitute for product tests. Deterministic checks do not call a model:

```bash
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
```

Live semantic evaluation can send repository material to the configured model provider and consume model calls. It therefore requires explicit scope, budget, egress, and evidence review. Start with the [evaluation design](.agents/skills/maintain-repo-skills/references/eval-design.md) and inspect the CLI help before preparing or executing a run:

```bash
node .agents/scripts/run-skill-eval-cli.mjs --help
```

## Contributing

Small, evidence-backed contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the repository's [`AGENTS.md`](AGENTS.md) before changing code or agent infrastructure.

## License

VocaSpace is available under the [MIT License](LICENSE).
