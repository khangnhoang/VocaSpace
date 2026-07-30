# ASM-PR2B — Bản tóm tắt để owner duyệt

Status: `planning complete; ready for owner review; implementation not authorized/not started`.

Detailed specification: [plan.md](./plan.md).

Brief này là concise owner decision surface, không thay thế detailed plan. Mọi decision làm đổi case count/ID, behavior, ownership, veto, routing, future reference, variant/evidence contract, checkpoint, verification, delivery hoặc rollback phải được cập nhật vào plan và re-review trước implementation.

## Dependency và synchronized baseline

- Branch: `feat/agent-skills-asm-pr2b`.
- Baseline: `3cdbb440d7068c5280750f650cf0680a1992f3e0`.
- Baseline là merge commit PR #65:

  ```text
  Merge pull request #65 from khangnhoang/feat/agent-skills-asm-pr2a
  ```

- `main == origin/main == baseline`, divergence `0/0` sau authorized fetch và fast-forward-only sync.
- ASM-PR2A dependency hiện có 6 suites/37 cases và đúng một CI `validate --all` step.
- ASM-PR2B branch được tạo trực tiếp từ synchronized `main`, không phải từ unmerged feature head.

## Candidate và proposed allocation

| Candidate | Regression | Routing | Fresh-reader | Total |
| --- | ---: | ---: | ---: | ---: |
| `test-quality-strategy` | 6 | 5 | 4 | 15 |
| `nextjs-server-action-zod` | 8 | 7 | 5 | 20 |
| `supabase-safe-migration` | 11 | 6 | 5 | 22 |
| Total | 25 | 18 | 14 | 57 |

Counts không symmetric vì behavior density khác nhau. SSM giữ nhiều regression owners nhất do migration chronology, existing data, RLS, constraints, RPC privilege, triggers, locking, retry/idempotency, Storage, seed, DB authority và rollback/reporting đều là boundary riêng.

## Major protected behavior

### `test-quality-strategy`

- lowest useful layer và observable guarantee;
- mocks không che subject;
- focused bug regression và deterministic data;
- manual state matrix/fixture readiness;
- proportional smoke E2E/browser use;
- truthful automated/static/manual/pending/coverage claims;
- truthful test-plan headers;
- related frontend/validation/database routes và non-test near miss.

### `nextjs-server-action-zod`

- validate every untrusted input, use parsed data only;
- reusable schema/type SSOT and intentional `z.input`/`z.output`;
- validation/authentication/authorization/RLS/constraint/business-state separation;
- reject/replace privileged fields;
- side effects after checks; stable safe errors;
- FormData/RHF consistency;
- upload file/path/bucket boundary;
- webhook/payment shape versus authenticity versus DB state/idempotency;
- missing-contract/no-invention stop;
- pure UI and pure SQL near misses.

### `supabase-safe-migration`

- immutable published migrations;
- additive existing-data-safe backfill/constraint order;
- RLS allowed/denied role/state strength;
- constraint integrity;
- RPC grants, `SECURITY DEFINER`, safe `search_path`;
- trigger scope;
- short necessary locks, no external call inside;
- retry/idempotency final invariants;
- Storage bucket/role/owner boundaries;
- deterministic local seed;
- local verification versus remote `db push`/production permission;
- destructive stop, rollback and verification truthfulness.

## Cross-skill ownership

- TQS owns test layer and evidence quality, not validation/DB business rules.
- NSAZ owns app trust boundaries, not DB permission or persisted-state invariants.
- SSM owns migration/RLS/RPC/trigger/concurrency/Storage/seed and DB authority.
- Cross-skill cases have one primary suite owner and complementary routes.
- One candidate's pass cannot offset another candidate's failure.

Architectural rule:

> A suite execution for skill X may require routing related skills, but may only impose physical reference selection/read obligations for references owned by skill X's bundle.

Related owners appear in routing arrays. No cross-bundle physical reference expectation is allowed.

## Highest-risk cases and blocking vetoes

| Case/group | Blocking veto |
| --- | --- |
| Mocked DB/authorization/concurrency claim | Mock removes the guarantee being claimed |
| Browser/manual fixture claim | Required state was unavailable/unobserved but reported complete |
| Parsed-only/privileged-field boundary | Raw or client-privileged value reaches side effect |
| Upload/webhook/payment | Unauthorized/client-directed write or unverified event mutates state |
| Missing contract | Agent invents table/status/permission or reports fake success |
| Published migration | Historical merged migration is edited |
| RLS/Storage | Unauthorized row/object access becomes possible |
| `SECURITY DEFINER`/`search_path` | Privilege escalation or object shadowing |
| Lock/retry/idempotency | Duplicate/partial side effect or unsafe lock scope |
| DB authority | Any ungranted remote/production database action |
| Evidence/reporting | Targeted/static/unrun evidence is reported as broader success |

## Future implementation files

Exactly:

```text
.agents/evals/test-quality-strategy/{regression,routing,fresh-reader}.json
.agents/evals/nextjs-server-action-zod/{regression,routing,fresh-reader}.json
.agents/evals/supabase-safe-migration/{regression,routing,fresh-reader}.json
```

Plus truthful ASM-PR2B plan/brief/progress reconciliation. No skill/reference, runner/schema/test, CI, package, product, migration, seed or DB edit.

`supabase-safe-migration` is covered now but remains structurally unmigrated until ASM-PR6.

## CP0–CP5

1. CP0 — sync/dependency/branch/authority: complete at baseline `3cdbb440...`.
2. CP1 — discovery, exact 57-case plan, owner brief, tracker, adversarial review, planning commit/push: current task.
3. CP2 — TQS trio `6/5/4`, focused verification/review, independent rollback.
4. CP3 — NSAZ trio `8/7/5`, trust-boundary and TQS ownership review, independent rollback.
5. CP4 — SSM trio `11/6/5`, hostile/denied DB review, no DB execution, independent rollback.
6. CP5 — cumulative nine-file/57-case/route/reference/veto/CI-no-change audit; no ceremonial commit.

Future checkpoints may commit only after focused verification, formal `0 Critical / 0 Required` review and exact owner permission. No amend/squash/rebase/reset/history rewrite.

## Verification and CI-no-change contract

Required commands include:

```text
node --version
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill test-quality-strategy
node .agents/scripts/run-skill-evals.mjs validate --skill nextjs-server-action-zod
node .agents/scripts/run-skill-evals.mjs validate --skill supabase-safe-migration
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Also audit exact file identity, IDs/counts/order, safe paths, executor leakage, physical ownership, UTF-8/newlines, whitespace/conflict/zero-width/link/fence/secret/absolute-path/raw-artifact hygiene.

`.github/workflows/ci.yml` must have an empty ASM-PR2B diff. Existing `--all` auto-discovers new trios.

Deterministic validation does not execute a model, semantic-grade behavior, prove isolation or prove supplied/read resource access.

## Planning review

First-pass main self-review found 3 `Required` planning defects:

- future writable scope conditionally included README after CP1;
- two SSM change cases missed `S-MIGRATION` in multi-reference overlap;
- TQS/NSAZ wording left conditional test-reference triggers ambiguous.

All three were corrected without changing 57 case IDs/counts. Re-review:

```text
Critical: 0
Required: 0
Suggestion: 1 rejected because symmetric/shorter counts would merge non-redundant owners
Specialist: 0
Fresh-reader: not_run
```

Fresh-reader remained `not_run` because roadmap/current-skill/schema evidence resolved every ambiguity deterministically; no residual leakage, ownership, near-miss or DB-stop comprehension gap remained.

Actual planning verification on Node `v24.11.1`:

- runner tests `130/130`;
- structural-validator tests `37/37`;
- repo skill validation `valid`, 11 skills, 0 errors, 4 existing non-blocking length warnings;
- `validate --all` `valid`, 2 configured skills, 6 suites, 37 current cases, 0 diagnostics;
- exact four-file scope, 57 unique lexical proposed IDs, empty `.agents/evals/**`/CI diff and document-integrity audits pass;
- `git diff --check` passes with only Windows LF→CRLF working-copy notices.

Self-review does not approve the plan or grant implementation.

## Owner decisions required

Owner approves, revises or rejects:

1. exact allocation `15 + 20 + 22 = 57`;
2. exact case IDs and detailed matrix;
3. behavior/forbidden/veto/route/reference expectations;
4. baseline/candidate and evidence contracts;
5. CP2–CP5 order and independent correction/rollback;
6. later suite implementation permission and its separate Git/remote gates.

Current task grants planning edit/commit/normal-push only. It does not grant suite implementation, PR, CI watch/fix, merge, deployment, production or database action.

Implementation: not authorized

Implementation: not started

Next action: owner review detailed [plan.md](./plan.md) and record an explicit decision.
