# U2 detail plan — Fix the shadcn build dependency graph

Revision: r1, 2026-11-17. Owner approval: 2026-11-17. Master plan: [r9](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: After U2 ships, shadcn no longer pulls the MCP SDK and Express graph that carries critical `proxy-addr` and its sibling advisories, or the nested Zod 3. The production CSS that imports `shadcn/tailwind.css` and the shadcn CLI keep working. Size is medium. It changes one direct dependency, but the dependency sits on the production build path and its graph shares resolutions with other consumers.

| ID | Observable result |
| --- | --- |
| AC1 | A clean `npm ci` from the final manifest and lockfile, on the CI runtime, resolves the approved shadcn 4.x target from `dependencies`. Root `zod` stays 4.6.7 and root `dotenv` stays 17.4.2. |
| AC2 | Full and omit-dev audits on the final lockfile no longer report [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) or any shadcn path to `@modelcontextprotocol/sdk`, `express` or `proxy-addr`. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) no longer reports `node_modules/shadcn/node_modules/zod`. A baseline-versus-candidate comparison by advisory ID and resolved path accounts for every added, removed and remaining entry. The candidate adds no affected path. |
| AC3 | `npm run build` compiles `app/globals.css` with `shadcn/tailwind.css`. Every compiled rule that differs from the baseline is explained by the shadcn stylesheet diff. Rules the app already uses keep their output. Preview pages that use shadcn components show no visual regression. |
| AC4 | The installed shadcn CLI reports the target version and reads the existing `components.json` with a read-only command without changing any tracked file. |
| AC5 | Lint, type check, build and the unit/form/component Vitest suite pass on the candidate. Every changed resolution shared with a non-shadcn consumer is covered by a check on that consumer. |

### 1.2 Scope and non-goals

- In scope: `package.json`, `package-lock.json` and the program State. Add a test only if the trial exposes a regression no existing check covers.
- Non-goals: moving shadcn to `devDependencies`, regenerating or editing components under `components/ui`, editing `components.json` or `app/globals.css`, Node/npm/CI changes, Vercel settings, and remediating advisories whose paths do not run through shadcn. Those stay with U3, U5 or later dispositions.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Trial in a disposable worktree with its own `npm ci`, CI placeholders and the CI runtime (Node 20 from `actions/setup-node` and npm 11.6.2). Record the actual versions. Never link another checkout's `node_modules`. | A different runtime or a shared install can hide an engine or resolution regression, and removing a Windows worktree can delete a linked target. |
| G2. Change only the shadcn request. No `npm audit fix`, `overrides`, `--force` or broad refresh. Explain every lockfile resolution change. When a resolution shared with a non-shadcn consumer changes, run that consumer's check or narrow the candidate. | Unexplained churn can hide a regression or wrongly attribute an advisory change. |
| G3. Run shadcn CLI checks with read-only commands only, then confirm the CLI left the worktree status and diff unchanged. Do not run `add`, `init`, `migrate` or `build`. | A CLI check can overwrite components or configuration outside the unit scope. |
| G4. Keep shadcn in `dependencies` (Owner decision, 2026-11-17). | The production build would depend on an unverified Vercel install mode and could lose the CSS import. |

### 1.4 Owner decisions that bind this unit

- Master plan decisions 4, 5 and 7: audit first, keep related changes in one bounded batch, and stop at the first blocking result for dependent work.
- (2026-11-17) Keep shadcn in `dependencies`. Defer the placement question with this reopening condition: a later change needs a smaller production install, and a read-only Vercel install-mode check proves that Preview still installs shadcn and produces the expected CSS.
- (2026-11-17) Run an independent Codex review of this plan before Owner approval. The review passed after one correction round. On 2026-11-17 the Owner approved r1 and authorized the CP1 trial, implementation and local commits. Push, PR, merge and hosted actions remain separate grants.

## 2. Repository facts

Baseline: `9b113f30` on `main`, checked 2026-11-17.

- `package.json` declares `"shadcn": "^4.0.5"` in `dependencies`. The lockfile resolves 4.0.5. No npm script or CI workflow invokes the shadcn CLI. `components.json` uses style `radix-nova` — justifies AC4 and G3.
- [app/globals.css](../../../../../app/globals.css) imports `shadcn/tailwind.css` on line 3. Both 4.0.5 and 4.23.0 export `./tailwind.css` from `dist/tailwind.css`. `npm diff` between the two versions removes no line from that file. It adds `@property` declarations, `@theme inline` keyframes and the `scroll-fade*` and `shimmer*` utilities. No source under `app`, `components`, `lib` or `hooks` uses those class names — justifies AC3.
- On 2026-11-17, registry metadata lists 4.23.0 as the latest shadcn, modified 2026-10-27, with engine `node >=20.18.1`. Compared with 4.0.5, it replaces `@modelcontextprotocol/sdk ^1.26.0` with `@modelcontextprotocol/server ^2.3.1`. That package depends only on `zod ^4.2.0` and `@modelcontextprotocol/core`, which depends only on `zod ^4.2.0`. It raises shadcn's own `zod` range from `^3.24.1` to `^4.2.0`. It drops `msw`, `node-fetch`, `https-proxy-agent`, `zod-to-json-schema`, `cosmiconfig`, `@antfu/ni` and `tailwind-merge`. It adds `undici ^7.30.1`, `socks`, `cn` and `@shadcn/registry 0.2.1` — justifies AC2 and the shared-resolution risk.
- `npm audit --package-lock-only` at the baseline reports 32 full and 21 omit-dev entries. A parent walk of the lockfile from production roots attributes these entries to shadcn alone: `proxy-addr` (critical), `@modelcontextprotocol/sdk`, `body-parser`, `hono`, `@hono/node-server`, `fast-uri`, `ip-address`, `qs`, `js-yaml`, `brace-expansion`, `minimatch`, `@ts-morph/common`, `ts-morph`, `postcss-selector-parser`, `browserslist`, `@babel/core`, nested `zod` and `shadcn` itself. `baseline-browser-mapping` and `source-map-js` also reach Next.js. The walk skipped devDependency roots, so some entries can stay on dev paths — justifies AC2's per-path comparison.
- Root `undici` 7.28.0 comes only from `jsdom` 29.1.1, a devDependency used by Vitest. The audit reports it inside ranges that end below 7.30.1. shadcn 4.23.0 requests `^7.30.1` — justifies G2 and the jsdom check in AC5.
- CI's [dependency setup](../../../../../.github/actions/setup-deps/action.yml) uses Node 20 and npm 11.6.2. U1 CP2 observed Node 20.20.2, which satisfies `>=20.18.1`.

## 3. Bounded implementation hypotheses

- Start with shadcn 4.23.0, the newest stable 4.x. Use `npm install --package-lock-only --save-prod shadcn@4.23.0` with npm 11.6.2, which keeps the existing caret style. Refresh registry and advisory evidence at CP1. A newer 4.x patch may replace the target if it keeps the Spec. A 5.x major needs an Owner decision.
- Expect npm to dedupe shadcn's Zod onto root 4.6.7 and to resolve `undici` to a single 7.x release at or above 7.30.1, hoisted or nested. Either layout satisfies the Spec when G2's consumer checks pass.
- If 4.23.0 still reaches `proxy-addr` or regresses CSS or CLI behavior, inspect the newest 4.x release that drops the MCP SDK before holding the unit. Record the blocker and the deferred target.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 — Isolated trial | The target removes the affected shadcn paths and keeps build, CSS and CLI behavior. | Use the sequence below. Stop dependent steps at the first blocking result. |
| CP2 — Implementation candidate | A minimal reviewed diff on `docs/dependency-modernization-u2` reproduces the trial. | Run `npm ci`, both audits, build with CSS comparison, lint, `tsc` and `npm run test:run` on the final candidate. Reuse a CP1 result only when the base, manifest, lockfile and runtime are unchanged. Run `npm run docs:check` and `git diff --check`. |

CP1 sequence:

1. At the refreshed baseline, record `node --version`, `npm --version`, `npm ls shadcn zod dotenv undici proxy-addr express --all --package-lock-only`, and the JSON and exit status of `npm audit --package-lock-only --json` and `npm audit --package-lock-only --omit=dev --json`. Run `npm ci` and `npm run build` with the CI placeholder environment, then keep every `.css` file under `.next/static` as the baseline CSS set.
2. Apply the candidate lockfile change and diff the manifest and lockfile. List added, removed and changed packages with their paths. Check engines and peers for the new packages. Fail fast: if `npm ls proxy-addr express @modelcontextprotocol/sdk --all --package-lock-only` still shows a shadcn path, hold the target before running wider checks.
3. Run `npm ci` and both audits. Compare advisory IDs and resolved paths with step 1, and classify each change as removed, remaining with its owning unit, or added. Any added affected path is a blocker.
4. Record `git status --short` and the hash of `git diff` and of any untracked file content. Run `npm exec --no -- shadcn --version` and one read-only command that loads `components.json`, chosen from the target's `--help` output, such as `info`. Then confirm that the status and both hashes are unchanged. The expected manifest and lockfile changes from step 2 stay in place.
5. Run `npm run build` with the same placeholders and compare the CSS set with the baseline after normalizing hashed file names. Map every differing rule to the shadcn stylesheet diff. An unexplained change or a changed rule the app uses is a blocker.
6. Run `npm run lint`, `npm exec --no -- tsc --noEmit` and `npm run test:run`. The unit run covers the jsdom consumer when `undici` changes. If another shared resolution such as `source-map-js`, `browserslist`, `postcss` or `@babel/core` changes for a non-shadcn consumer, add that consumer's check from the master plan's U5 guidance or narrow the candidate.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The new graph changes a resolution that Next.js, PostCSS or Vitest also use | Compare lockfile paths in CP1 step 2 and cover each changed consumer in step 6. Narrow the candidate when the change cannot be explained. |
| Additive CSS from shadcn changes rendered output | Compare compiled CSS in step 5 and spot-check shadcn component pages on Preview before merge. |
| The newer CLI rejects the existing `components.json` | Detect it in CP1 step 4. Record any blocker. Do not migrate the configuration within U2. |
| Advisory data moves between trial and release | Rerun both audits on the final candidate in CP2. Repeat them on the exact reviewed revision immediately before merge and keep the JSON and exit status. The existing CI does not run audits, so CI results do not count as audit evidence. |

- Rollout runbook: Follow the master plan's order and gates and the [production release SOP](../../../../sop/production-release-gate.md). Before merge, required CI and Preview must pass on the reviewed revision, including a Preview spot check of pages that render shadcn components. After merge, confirm `production-gate`, that the production domain serves the merge revision and that a bounded read-only smoke passes.
- Stop when a shadcn path to the target advisories remains, an added affected path appears, CSS or CLI behavior changes without explanation, a shared consumer check fails or cannot run, or the fix would require a placement, configuration or major change.
- Rollback: Discard the trial worktree, or revert the U2 commit as one unit. For production, follow the SOP rollback and recheck domain, revision and smoke. No database change is involved.

## 6. Progress

Current State and milestones: [program progress](../../progress.md).
