# ASM-PR2B — Bản tóm tắt để owner duyệt

Status: historical PR2B delivery merged through PR #66; cumulative-correction transition starts with a local final-audit checkpoint on `audit/agent-skills-pr2abc-eval-contracts`, then conditionally delivers only after `0 Critical / 0 Required`, with exact post-delivery evidence owned by Git/GitHub/PR body/final report.

Detailed specification: [plan.md](./plan.md).

Brief này là concise owner delivery surface, không thay thế detailed plan. Historical implementation và current cumulative correction giữ nguyên case count/ID/prompt, ownership, routing, future-reference applicability, variant/evidence contract và rollback boundaries đã duyệt.

## Dependency và synchronized baseline

- Branch: `feat/agent-skills-asm-pr2b`.
- Baseline: `3cdbb440d7068c5280750f650cf0680a1992f3e0`.
- Baseline là merge commit PR #65:

  ```text
  Merge pull request #65 from khangnhoang/feat/agent-skills-asm-pr2a
  ```

- Historical branch-start snapshot: `main == origin/main == baseline`, divergence `0/0` sau authorized fetch và fast-forward-only sync.
- ASM-PR2A dependency hiện có 6 suites/37 cases và đúng một CI `validate --all` step.
- ASM-PR2B branch được tạo trực tiếp từ synchronized `main`, không phải từ unmerged feature head.

## Candidate và implemented allocation

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

## Implementation files

Exactly:

```text
.agents/evals/test-quality-strategy/{regression,routing,fresh-reader}.json
.agents/evals/nextjs-server-action-zod/{regression,routing,fresh-reader}.json
.agents/evals/supabase-safe-migration/{regression,routing,fresh-reader}.json
```

Plus truthful ASM-PR2B plan/brief/progress reconciliation. No skill/reference, runner/schema/test, CI, package, product, migration, seed or DB edit.

`supabase-safe-migration` is covered now but remains structurally unmigrated until ASM-PR6.

## CP0–CP5 completed state

1. CP0 — sync/dependency/branch/authority: complete at baseline `3cdbb440...`.
2. CP1 — discovery, exact 57-case plan, owner brief, tracker, original planning delivery and bounded planning-correction delivery: complete and owner-approved.
3. CP2 — TQS trio `6/5/4 = 15`: complete at `9d2251d`; four exact evaluator-only skip-path clarifications at `1ea50dc`.
4. CP3 — NSAZ trio `8/7/5 = 20`: complete at `34bd4d3`.
5. CP4 — SSM trio `11/6/5 = 22`: complete at `fc26f94`; no DB execution.
6. CP5 — cumulative nine-file/57-case/route/reference/veto/CI-no-change audit and durable-state reconciliation: complete in the checkpoint containing this record.

Each implementation checkpoint passed focused verification and formal review before commit. No amend/squash/rebase/reset/history rewrite occurred.

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

## Historical original planning review

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

## Recovered planning correction

Repository recovery classified the lost session as State A:

- branch `feat/agent-skills-asm-pr2b`;
- local HEAD, upstream and actual remote branch all at `49691285df6f9ee6da119cd3bf98d746fef140b8`;
- divergence `0/0`;
- clean worktree/index;
- no existing correction commit, partial correction or PR.

The bounded correction resolved three Required findings without changing the 57 cases or material program design:

1. Executor-package determinism:
   - added one exact 39-entry context catalog;
   - every entry freezes `context_id`, `source_type`, exact safe repository path or exact neutral inline text, purpose and applicable cases;
   - all 57 matrix rows resolve to exact context codes;
   - executor-visible context contains no route/reference/veto/conclusion/variant answer.
2. TQS routing ownership:
   - eligible routing cases now include `code-commenting-and-maintainability` as candidate and expected route;
   - physical `T-HEADER` selection remains owned only by TQS execution;
   - `tqs-route-nontest-near-miss` is a pure unrelated-documentation task with `test-quality-strategy` explicitly forbidden;
   - all 18 routing rows intentionally classify every candidate.
3. SSM applicability:
   - `ssm-reg-local-remote-authority` selects `S-MIGRATION`, plans local verification and stops before ungranted `db push`/production action;
   - existing-behavior-only RLS/RPC/trigger/Storage rows freeze that no migration or seed file is added, changed or reviewed;
   - `ssm-fresh-remote-push-core-stop` remains core-only only for the solely ungranted remote-push task;
   - all 22 SSM rows and change/review overlaps were re-audited.

Recovery adversarial re-review:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
```

Fresh-reader was not run because exact repository and schema evidence removed all material ambiguity. No model was executed or semantic-graded.

Recovery verification passed on Node `v24.11.1`: runner tests `130/130` on the bounded rerun after one 121-second timeout, structural-validator tests `37/37`, repository skill validation `valid` with 11 skills/0 errors/4 existing warnings, `validate --all` valid for 2 skills/6 files/37 implemented cases, `git diff --check` pass, and exact context/route/SSM/scope/hygiene audits pass.

Historical recovery authority:

```text
Planning delivery:
complete at the original planning commit and this planning-correction commit

Planning edit/commit/push authority:
consumed

Standing authority:
none

Implementation:
not authorized
not started

PR/CI watch-fix/merge:
not granted

Database/model/deployment:
not granted
not run
```

## Owner-approved implementation result

The historical ASM-PR2B implementation instruction approved the frozen detailed plan and CP2–CP5 execution. Exact result:

| Evidence | Actual result |
| --- | --- |
| Files/cases | 9 suite files; TQS `6/5/4 = 15`, NSAZ `8/7/5 = 20`, SSM `11/6/5 = 22`; total `25/18/14 = 57` |
| Checkpoint commits | CP2 `9d2251d`; CP3 `34bd4d3`; CP4 `fc26f94`; CP2 wording correction `1ea50dc`; CP5 `7dec9a1`; SSM observability correction `bbf0d79` |
| Runner tests | `130/130` pass; 0 fail/cancelled/skipped/todo on Node `v24.11.1` |
| Structural-validator tests | `37/37` pass; 0 fail/cancelled/skipped/todo |
| Repository validator | `valid`; 11 skills, 0 errors, 4 existing non-blocking `CORE_LENGTH_SIGNAL` warnings |
| Focused suite validation | `valid`: TQS 3 files/15; NSAZ 3/20; SSM 3/22; 0 diagnostics |
| Cumulative suite validation | `valid`: 5 configured skills, 15 files, 94 cases, 0 diagnostics |
| Frozen-design audit | Pass: 57/57 exact unique IDs, plan order, routes, criteria, vetoes, reference expectations, variants and physical ownership; corrected context catalog 42/42 and 12/12 future references |
| Scope/CI audit | Pass: only the nine suites and three authorized durable documents; `.github/workflows/ci.yml` diff empty |
| Formal review | `0 Critical / 0 Required`; `0 specialist` |
| Fresh-reader | `not_run`; deterministic evidence resolved the only concrete evaluator skip-path wording defect and left no material ambiguity |

No material design changed during CP2–CP5. The historical CP2 correction replaced four vague TQS routing skip descriptions with exact approved evaluator-only future-reference paths.

## SSM executor-observability correction

Investigation bắt đầu tại clean/synchronized `7dec9a1bf409af6d92b4530676f6b10b0966a07c` và audit đủ 22 SSM cases. Synthetic packager chỉ đưa exact declared contexts vào executor package; evaluator rubric và repository files không được khai báo không xuất hiện. Kết quả:

- `confirmed` (2): `ssm-reg-rpc-security-search-path`, `ssm-reg-trigger-safety`.
- `partially confirmed` (6): `ssm-reg-concurrency-short-locks`, `ssm-reg-retry-idempotency`, `ssm-reg-rls-role-denied-paths`, `ssm-reg-storage-policy-boundary`, `ssm-fresh-rls-storage`, `ssm-fresh-rpc-trigger-concurrency`.
- `rejected` (14): năm regression còn lại, cả sáu routing cases và ba fresh-reader cases còn lại; exact current inputs đã đủ cho route/authority/migration/seed/evidence criteria nên giữ nguyên.

Smallest correction thêm neutral raw SQL sources vào 8 affected cases:

| Context | Exact repository source | Lý do cần thiết |
| --- | --- | --- |
| `ctx-course-rpc-source` | `supabase/migrations/20260612100000_create_course_with_owner_rpc.sql` | Cho RPC-security case quan sát definer/search path, actor/state logic và grants thay vì đoán từ integration tests. |
| `ctx-rls-trigger-source` | `supabase/migrations/20260611140552_sync_rls_auto_enable_trigger.sql` | Cho executor quan sát trigger scope, tags, helper, failure behavior và definer/search path. |
| `ctx-ordering-rpc-source` | `supabase/migrations/20260630090000_course_structure_ordering_rpc.sql` | Cho executor quan sát ordering lock scope/order và atomic update structure. |
| `ctx-schema-history` | `supabase/migrations/20260609114505_remote_schema.sql` | Reuse source duy nhất chứa `handle_payment_success` và complete course/collaborator policy-helper structure, cần cho payment state/lock/idempotency/grants cùng course RLS `USING`/`WITH CHECK`. |
| `ctx-storage-bucket-migration` | `supabase/migrations/20260611162000_create_question_group_media_buckets.sql` | Reuse focused bucket/policy source cho SQL role/owner/admin predicates. |

Ba context IDs mới và hai IDs reuse đều deterministic/schema-safe. Raw SQL là implementation evidence trung tính: không chứa evaluator criteria, expected conclusion, route answer, veto, variant hoặc future-reference selection. `ctx-fact-existing-db-only` chỉ được làm rõ để phân biệt read-only source evidence với migration change/history-review request.

Verification hiện tại: focused SSM `22/22`, exact-byte package audit `12/12` additions với `PACKAGE_ERRORS=0`, runner `130/130`, structural validator `37/37`, repository validator 11 skills/0 errors/4 existing warnings, cumulative eval validation 5 skills/15 files/94 cases/0 diagnostics. Frozen 57-case allocation, mọi ID/route/criterion/veto/variant/reference expectation và physical-reference ownership giữ nguyên; CI không đổi.

Fresh-reader: `not_run`. Direct source, package-byte và semantic-diff evidence đã giải quyết hết material ambiguity; không model nào được chạy hoặc semantic-grade.

Adversarial review vòng đầu tìm thấy một `Required`: course RPC source chưa đủ chứng minh complete course/collaborator `USING`/`WITH CHECK` structure cho `ssm-reg-rls-role-denied-paths`. Case đó được chuyển sang `ctx-schema-history`; historical pre-delivery re-review đạt `0 Critical / 0 Required`, specialist `0`, verdict ready cho correction commit và normal push.

Delivery sau review đã hoàn tất tại `bbf0d79d7fd2a5d198f179a77a537720544b9b7c`. Commit được normal-push tới `origin/feat/agent-skills-asm-pr2b`; local HEAD, upstream và actual remote cùng SHA, divergence `0/0`, worktree/index sạch. Semantic correction authority đã consumed.

## Current cumulative correction checkpoint

Historical SSM correction đã complete, verified, committed và delivered tại `bbf0d79d7fd2a5d198f179a77a537720544b9b7c`. Cumulative correction ngày `2026-08-04` sửa đúng hai NSAZ packages bằng exact transform/caller/test evidence, giữ 57 cases và mọi ID/prompt/route/reference expectation. Executor catalog hiện `45 = 32 repository_file + 13 inline_text`.

Pre-extension verification passed focused NSAZ `20/20`, cumulative `9 skills / 27 files / 177 cases`, runner `130/130`, structural validator `37/37`, và repository validator `0 errors / 4` existing `CORE_LENGTH_SIGNAL` warnings. Final 20-case verification/audit is the delivery gate and its exact result belongs in the final report/PR body; synthetic preparation remains non-isolating and does not run or grade a model. After a passing gate, one commit, normal initial push, non-draft PR and initial CI watch are authorized; one later fix attempt requires logged `branch-caused-small-safe` evidence. Successful delivery consumes the grant; merge/auto-merge and unrelated high-risk actions remain ungranted.
