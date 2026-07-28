# Kế hoạch structural migration cho repo-local agent skills

## Trạng thái, thẩm quyền và baseline

| Trường | Giá trị |
| --- | --- |
| Trạng thái | Owner-approved program structure; chưa được cấp implementation permission |
| Planning branch | `docs/agent-skills-structural-migration-roadmap` |
| Baseline | `main == origin/main == d8a67a1b1e015d44ab52095e823cd8334bf1fead` |
| Foundation dependency | PR #52, #53, #54 và #62 đã merge |
| Quyền hiện tại | Planning docs và bounded advisory read-only fresh-reader evidence; không implementation, stage, commit, push, PR hoặc CI mutation |
| Roadmap shape | Six program phases containing nine actual pull requests. |
| Source sở hữu intended program scope | [plan.md](./plan.md) |
| Source sở hữu current actual status | [progress.md](./progress.md) |

Tài liệu này là detailed phase plan cho future consumer và structural migration. Owner đã duyệt program structure, candidate allocation, fresh-reader default và roadmap order trong revision ngày 2026-07-28. Approval này không cấp implementation, Git, GitHub, CI mutation, merge, deployment, production hoặc database authority.

## Mục tiêu và định nghĩa hoàn tất

Hoàn tất justified progressive-disclosure migration qua six program phases containing nine actual pull requests, tối ưu coherent review scope và reliable behavior preservation thay vì raw PR count.

Chương trình hoàn tất khi:

- mọi skill có conditional consumer thực được migrate trong roadmap này;
- skill không có meaningful skip group được giữ single-file và có rationale;
- `maintain-repo-skills` được giữ nguyên như bundle progressive-disclosure hiện có;
- shared evidence tooling chỉ được implement một lần;
- mọi candidate có committed regression, routing và fresh-reader coverage trước bất kỳ migration nào;
- mỗi migration pin immutable baseline, chạy candidate comparison và áp dụng safety veto;
- mọi migration PR chạy mandatory base-versus-core-plus-references fresh-reader behavior comparison theo program-level default permission;
- activation, routing, authority, permission, safety, stop, verification và reporting behavior không regressed;
- context claim phân biệt `available`, `supplied`, `read` và `unknown`;
- rollout kết thúc bằng owner gate rõ, không biến pilot thành chương trình vô hạn.

## Current state đã reconcile

### Git và GitHub

- Authorized fetch đã chạy ngày 2026-07-28.
- Local `main` fast-forward-only từ `46dd08b81f064f23b6c1bffc81d98a1496bc0041` tới `d8a67a1b1e015d44ab52095e823cd8334bf1fead`.
- Planning branch được tạo từ updated `main`; branch không stacked.
- PR #62 đã merge ngày 2026-07-28 tại `d8a67a1b1e015d44ab52095e823cd8334bf1fead`.
- PR #62 head `fe653a10fb5b0cfbb27f69aa4748ef3b1994ce8b` có GitHub Actions Node `v20.20.2`, runner 97/97 pass và structural validator 37/37 pass.

### Current repository

| Evidence | Kết quả |
| --- | --- |
| Repo-local skills | 11 |
| Progressive-disclosure bundle hiện có | `maintain-repo-skills` với 3 references |
| Single-file bundles | 10 |
| Structural validation | valid; 0 errors; 4 non-blocking length warnings |
| Eval configuration | `configured_skills: 0`; `suite_files: 0`; `cases: 0` |
| Eval runner tests | 97 pass |
| Structural validator tests | 37 pass |
| CI runner coverage | runner tests có; `validate --all` chưa có |
| Product/database change | không có |

Length warnings áp dụng cho `code-review-and-quality`, `implementation-planning-and-pr-breakdown`, `nextjs-server-action-zod` và `test-quality-strategy`. Chúng không quyết định candidate hoặc wave.

## Tooling gap và quyết định evidence đề xuất

Current validator đã hỗ trợ `references/`:

- standardized `## Resource routing`;
- contained relative Markdown path;
- non-empty read condition;
- missing/unrouted resource diagnostics;
- path escape và link/reparse refusal.

Current runner cũng package multi-file bundle, nhưng:

- mọi regular file trong target bundle được copy vào executor variant;
- `bundle_manifest` chứng minh file nào available trong package;
- `execution_context_manifest` chỉ ghi prompt và case context, không ghi exact skill resource được đưa vào model context;
- `observed_access` chỉ ghi nhóm access như filesystem, tool, network và mutation;
- report không phân biệt exact skill file `supplied`, `read` hoặc `unknown`;
- current tooling không đủ để claim progressive disclosure giảm supplied/read context.

### Shared additive artifact đề xuất

PR 1 thêm một standalone artifact v1:

```text
artifact_type: skill_resource_access
```

Artifact này không thay đổi exact keys hoặc semantics của existing artifact v1. Nó ghi:

- existing workspace/skill/suite/case/variant identity;
- exact sorted unique bundle-relative paths được supplied trước execution;
- exact sorted unique bundle-relative paths observed as read trong execution;
- status `observed | unknown` riêng cho supplied và read;
- non-empty evidence basis;
- enforcement/observation limitation.

Runner:

- validate mọi path/hash dựa trên immutable `bundle_manifest`;
- derive line/byte metrics từ manifest thay vì tin số do operator nhập;
- giữ `available`, `supplied` và `read` thành ba fact khác nhau;
- không biến executor self-report thành runtime-enforced observation;
- cho semantic report hoàn tất khi artifact vắng mặt, nhưng thêm claim boundary và chặn context-reduction conclusion;
- không claim token saving nếu runtime không cung cấp actual token usage.

Đây là additive evidence contract; không cần đổi suite schema v1 và không cần lặp lại tooling trong later migration PR.

## Quy tắc target structure chung

Mọi migrated core tiếp tục giữ khi applicable:

- activation, ownership và precedence;
- authority, approval và permission gates;
- read-only, Git, remote, production, database và destructive boundaries;
- safety veto và evidence-claim limits;
- related-skill routing;
- exact resource-routing table;
- stop conditions;
- output/reporting contract;
- minimum decision rule cần để chọn reference.

Reference chỉ nhận existing procedure, matrix, template, example hoặc detailed guidance có:

- demonstrated consumer;
- valid invocation group có thể skip;
- direct link từ core;
- exact pre-decision read condition;
- contained path;
- no nested required-reference discovery.

First migration của mỗi skill là structural-only. Không cleanup wording, đổi semantics, thêm behavior hoặc rewrite examples trong cùng checkpoint.

## Candidate audit tổng hợp

| Skill | Quyết định | Risk | Wave |
| --- | --- | --- | --- |
| `frontend-design` | Migrate; controlled pilot | Medium | PR 3 |
| `frontend-workflow` | Migrate | Medium | PR 4 |
| `test-quality-strategy` | Migrate | Medium–High | PR 4 |
| `nextjs-server-action-zod` | Migrate | High trust-boundary | PR 4 |
| `implementation-planning-and-pr-breakdown` | Migrate | High authority/status | PR 5A |
| `code-review-and-quality` | Migrate | High verdict/read-only | PR 5A |
| `git-checkpoint-workflow` | Migrate | High permission/history | PR 5B |
| `github-pr-ci-workflow` | Migrate | High remote/permission | PR 5B |
| `supabase-safe-migration` | Migrate; isolated rollout | Highest DB/production risk | PR 6 |
| `code-commenting-and-maintainability` | Giữ single-file | Low; no meaningful conditional consumer | Không migrate |
| `maintain-repo-skills` | Giữ current bundle | Đã progressive-disclose hợp lệ | Không migrate |

## Target bundle cho từng candidate

### `frontend-design` — pilot

**Giữ trong core:** activation; five-type classifier; task-size process selection; related skills; repository/product guardrails; subject grounding; two-pass process; cross-cutting visual/layout/dialog/form/copy/state/motion/responsive/accessibility rules; implementation boundary; final critique; output.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/client-marketing.md` | Read after classifying Client / Marketing and before planning, implementing, or reviewing homepage, landing, public discovery, pricing, promotion, or product-introduction UI | Current Client/Marketing direction, priorities và avoid list | Learning, authoring, admin-only và shared-component-only tasks |
| `references/learning-experience.md` | Read after classifying Learning Experience and before lesson, exercise, quiz, flashcard, review, progress, or learner-dashboard work | Current learning direction, questions, priorities và avoid list | Client, authoring, admin-only và shared-component-only tasks |
| `references/teacher-authoring.md` | Read after classifying Teacher Authoring and before course/lesson/exercise/media/preview/submission/revision work | Current authoring direction, grouping, priorities và avoid list | Client, learning, admin-only và shared-component-only tasks |
| `references/admin-business-operations.md` | Read after classifying Admin / Business Operations and before dashboard, review, user, payment, discount, role, moderation, or audit UI work | Current admin direction, confirmation rules, priorities và avoid list | Client, learning, authoring-only và shared-component-only tasks |
| `references/shared-design-system-components.md` | Read before changing/reviewing a shared design-system component or proposing a global primitive, token, layout, or default | Current four global-change checks và global-default prohibitions | Feature-local work that does not propose shared change |

Core phải yêu cầu đọc mọi matching reference khi task overlap.

### `frontend-workflow`

**Giữ trong core:** activation; modes; permission/plan boundary; repository/contract discovery; integration trace; UI/state planning; no-fake-success; async/form/state minimum invariants; tests/performance requirement; fixture gate routing; hard stops; final audit/definition/report.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/mock-data.md` | Read before adding/reviewing typed mocks or when backend behavior is missing and UI-only/prototype scope is considered | Current mock-data procedure và production-success prohibitions | Fully integrated frontend work with no mock |
| `references/async-state-and-forms.md` | Read before implementing/reviewing an async mutation, optimistic update, form, dynamic field, or complex client state transition | Detailed async, optimistic, form, dynamic-field và edge-state procedure | Static rendering/composition tasks without async/form behavior |
| `references/manual-ui-validation.md` | Read before planning, running, or reporting browser/manual UI validation; read responsive subsection when responsive behavior is material | Manual UI validation procedure và responsive QA matrix | Discovery/review tasks with no browser QA decision and non-responsive non-UI execution |

### `test-quality-strategy`

**Giữ trong core:** activation; test guarantees; specialist signal; layer-selection taxonomy; core coverage model; placement/naming; verification-scope selection; evidence/coverage truth; efficient QA rules; anti-patterns; checklist.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/smoke-e2e-and-browser.md` | Read before adding, changing, running, or reviewing smoke E2E/browser coverage | Existing smoke/browser procedure và claim limits | Unit/schema/action/integration work not using browser coverage |
| `references/manual-qa-and-fixtures.md` | Read when manual QA depends on authenticated roles, database-backed state, ordering, multiple records, or seeded fixtures | State matrix và fixture-readiness procedure | Deterministic automated-only work with no data-dependent manual QA |
| `references/test-plan-headers.md` | Read before creating/changing/reviewing a test file that matches a documented header trigger | Header triggers, template và accuracy rules | Tiny unit files and tasks not touching eligible test files |
| `references/mocking-and-regression.md` | Read before mocking a boundary or adding/reviewing bug-regression protection | Mocking rules, regression workflow và deterministic test-data guidance | Tests with no mocks and non-bug work |

### `nextjs-server-action-zod`

**Giữ trong core:** activation; Zod/SSOT and untrusted-input invariants; parsed-only data; auth/permission separation; side-effect order; privileged-field rules; business/security boundaries; Supabase call ordering; safe errors; required workflow; anti-patterns; checklist.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/schema-placement-and-design.md` | Read before adding, moving, composing, or materially changing a reusable schema, DTO, inferred type, transform, default, or object strictness | Contract ownership, placement workflow, field/schema composition guidance | Existing-contract boundary work with no schema/type ownership change |
| `references/server-actions-and-route-handlers.md` | Read before changing/reviewing a Server Action, Route Handler, API request/response boundary, query, route, or search params | Boundary workflow plus action/handler procedure | Schema-only, RHF-only, upload/webhook-only work without action/handler change |
| `references/formdata-and-react-hook-form.md` | Read before changing/reviewing FormData extraction/normalization or React Hook Form contract behavior | Current FormData and RHF procedures | JSON/query/action tasks without FormData/RHF |
| `references/uploads-webhooks-and-payments.md` | Read before upload, webhook, payment, file metadata, signature/authenticity, or external-event payload work | Upload/webhook/payment rules | Ordinary form/action/schema work |
| `references/validation-test-matrix.md` | Read before adding/reviewing validation-boundary tests or choosing verification for a validation refactor | Existing schema/action/route/form/upload/webhook test matrix | Planning or source inspection that does not choose test coverage |

### `implementation-planning-and-pr-breakdown`

**Giữ trong core:** activation/ownership; related routing; plan/implementation permission separation; discovery mode; main workflow; fact/assumption/conflict classification; sizing; dependency/slicing; acceptance and verification fundamentals; scope control; stop/red flags; output/checklist.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/tracked-program-and-durable-plan.md` | Read when work belongs to a tracked multi-session/multi-PR program or needs durable plan/progress ownership | Source-routing table, tracked reconciliation, durable-document rules và status ownership | Standalone small/medium plans with no tracked program |
| `references/pr-breakdown-and-handoff.md` | Read when splitting work into PRs/phases/prompts or producing a transferable implementation brief | PR boundary, prompt, output-template và implementation-brief procedures | Discovery answers that do not require PR split or handoff artifact |
| `references/qa-fixture-readiness.md` | Read when the plan contains data-dependent manual QA or fixture/seed readiness decisions | Current QA fixture-readiness planning procedure/template | Plans with no data-dependent manual QA |
| `references/specialist-plan-review.md` | Read only after main plan self-review when a bounded specialist plan-review action is materially considered or authorized | Specialist decision/package/reconciliation procedure | Default `0 specialist` plans |

### `code-review-and-quality`

**Giữ trong core:** activation/ownership; read-only default; approval standard; range requirement; main review workflow; severity meanings; verification statuses; verdict meanings; no-permission rule; re-review requirement; checklist.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/domain-review-dimensions.md` | Read before a formal or integration review whose affected boundary includes validation, DB/concurrency, frontend/UX, tests, security, performance, comments, or Git | Current detailed domain review dimensions | Small documentation/metadata review with none of those boundaries |
| `references/special-review-cases.md` | Read when reviewing a bug fix, refactor, dead-code removal, or dependency change | Current special-case procedure | Feature/checkpoint reviews without those change types |
| `references/specialist-review.md` | Read only after applicable main review when a bounded specialist action is materially considered, packaged, or reconciled | Specialist levels, gates, package, reviewer behavior và claim labels | Default main-only reviews |
| `references/review-report-templates.md` | Read when producing a formal multi-finding review report or specialist package requiring the full template | Finding format và verbose report template | Small review with no actionable finding or compact verdict |

### `git-checkpoint-workflow`

**Giữ trong core:** activation/ownership; explicit commit/push permission separation; no auto-commit; no force/destructive action; dirty-tree ownership; branch/base stop summary; staging scope; local/remote boundary; failure behavior; output contract.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/branch-start-and-sync.md` | Read before creating/switching a task branch, updating its base, or resolving base/dependency/divergence | Branch naming and independent/stacked branch procedure | Existing correct-branch checkpoint with known base |
| `references/commit-and-staging.md` | Read after commit permission exists or when auditing a proposed stage/commit checkpoint | Commit workflow/readiness, staging/diff audit, messages, artifact/secret checks và commit report | Planning/review with no commit/staging action |
| `references/corrections-and-history.md` | Read before correction-history, amend, squash, rebase, conflict, history rewrite, force-push, or destructive recovery decision | Correction/history/conflict procedure | Ordinary new local commit with no history operation |
| `references/push-and-remote.md` | Read before an explicitly authorized normal push or when deciding whether current permission includes remote Git delivery | Detailed push preconditions and remote reporting | Local-only checkpoint |

### `github-pr-ci-workflow`

**Giữ trong core:** activation/ownership; preconditions; exact permission modes; normal-push condition summary; merge/auto-merge separate permission; DB-risk prohibition; safety/stop rules; final status report.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/pr-create-update.md` | Read before reconstructing PR context or creating/updating PR metadata/state | Context reconstruction and PR create/update procedure | Watch-only/inspect-only work with no PR mutation |
| `references/ci-watch-and-triage.md` | Read before watching checks, reading failed logs, classifying a failure, or reporting CI status | CI watch commands, state reporting và exact failure taxonomy | PR metadata-only work |
| `references/ci-self-fix.md` | Read only after an existing PR/check failed, logs were read, and failure was classified `branch-caused-small-safe` under authorized combined mode | Bounded edit/validate/commit/push/re-watch loop | Every non-small-safe or non-combined mode |
| `references/merge-and-auto-merge.md` | Read only when owner explicitly requests merge or auto-merge in the current task | Detailed merge checks and refusal procedure | All non-merge modes |

### `supabase-safe-migration`

**Giữ trong core:** activation; migration-as-source rule; no old published migration edit; no RLS/constraint weakening; RLS/constraint safety; remote database/db-push prohibition; additive existing-data safety; permission-sensitive RPC/search-path/lock/idempotency minimum; required inspection; comments/evidence/reporting; stop/checklist.

| Reference | Exact read condition | Nội dung move | Valid skip group |
| --- | --- | --- | --- |
| `references/migration-and-seed.md` | Read before adding/reviewing a migration, schema/table/column/index/constraint/backfill, or seed change | Migration safety order, file placement, seed rules and matching verification details | RLS/RPC/trigger/storage investigation with no migration/seed change |
| `references/rls-and-storage.md` | Read before changing/reviewing RLS policies, permission helpers, bucket access, or Storage policies | RLS/helper and Storage procedure | Schema-only/RPC-only/trigger-only work |
| `references/rpc-trigger-concurrency.md` | Read before changing/reviewing RPC, trigger, SQL helper, race-sensitive transition, lock, retry, or idempotency behavior | RPC, trigger and concurrency procedures | Additive schema/index/seed work without those behaviors |

### Skills giữ unsplit

#### `code-commenting-and-maintainability`

Giữ single-file vì activation đã tập trung vào một decision: comment có cần thiết và truthful không. Language, JSDoc, TODO, header, placement và review rules đều thường cần để quyết định. Chưa có reference consumer nào tạo meaningful skip group mà không làm tăng routing overhead hoặc che mandatory comment truthfulness.

#### `maintain-repo-skills`

Giữ current bundle. Core đã chứa authority/permission/safety/stop/reporting; ba references có demonstrated consumers và exact read conditions:

- `progressive-disclosure.md`;
- `fresh-reader-testing.md`;
- `eval-design.md`.

Không split hoặc migrate lại bundle này.

## Protected behavioral invariants

### UI, frontend và testing

- Non-trivial frontend work vẫn route cả `frontend-design` và `frontend-workflow`.
- Screen classification và multi-reference overlap không mất.
- Shared component không bị đổi vì một local screen.
- Không fake production success; async/form states, input preservation và duplicate prevention giữ nguyên.
- Manual/browser QA chỉ được claim theo exact observed states và fixture readiness.
- Test không mock away guarantee; coverage, verification và E2E claims phải truthful.

### Validation và database

- Server luôn validate untrusted input; chỉ parsed data được dùng.
- Validation không thay auth, permission, authenticity, RLS, constraint hoặc business-state check.
- Privileged client fields không được tin.
- Side effect xảy ra sau validation và authorization.
- RLS/constraint không bị weaken; published migration không bị sửa.
- Remote DB và `db push` luôn cần explicit permission.
- RPC/trigger/lock/retry/idempotency invariants giữ nguyên.

### Planning, review và status

- Agent-authored material plan vẫn là draft tới khi owner duyệt.
- Plan approval không tự cấp implementation/Git/remote permission.
- Review mặc định read-only.
- Verdict/confidence/test result không cấp permission.
- Specialist mặc định `0`; chỉ chạy sau main review và bounded gate.
- Status/progress claim phải theo Git/GitHub evidence.

### Git, PR và CI

- Commit, push, PR, merge, deploy và destructive/history action là gates riêng.
- Dirty-tree ownership và fast-forward/base rules không bị che trong reference.
- `Commit` không bao gồm push.
- PR-only mode không initial-push.
- CI self-fix chỉ áp dụng cho `branch-caused-small-safe` trong exact combined mode.
- `db-risk`, secret/config, infra/flaky, unrelated, unclear hoặc large-risk luôn stop.
- Merge/auto-merge luôn cần explicit current-task permission.

## Program-level fresh-reader authority

Owner-approved default cho structural-migration program:

> All discovery, planning, coverage, migration, review, and reconciliation tasks in this program may use bounded fresh readers when materially useful, without requiring a new owner permission solely to invoke the fresh reader.

Permission này chỉ áp dụng cho advisory, read-only behavioral evaluation. Nó không cấp implementation, Git, GitHub, CI, merge, deployment, production hoặc database authority. Fresh-reader result không phê duyệt plan, implementation, correction hoặc bất kỳ action gate nào.

### Required use cho migration PRs

Fresh-reader base-versus-core-plus-references behavior testing là mandatory cho:

- PR 3;
- PR 4;
- PR 5A;
- PR 5B;
- PR 6.

Với từng migrated skill, minimum cases gồm:

- normal matching consumer;
- near miss không được load reference;
- overlapping consumers khi applicable;
- protected authority, permission, safety, stop, verification và reporting behavior;
- correct reference selection chỉ từ proposed core routing và task evidence;
- kiểm tra behavior quan trọng có trở nên undiscoverable sau split hay không.

### Optional use cho non-migration PRs

PR 1 và PR 2A–2C có thể dùng bounded fresh readers khi materially useful cho evidence wording, ambiguous suite case, evaluator leakage, routing assumption, near-miss quality hoặc case discrimination. Không chạy chỉ để tăng evidence volume.

### Comparison contract

Mọi comparison phải:

- dùng equivalent task input và execution conditions cho base/candidate;
- giữ executor context bounded và disclosed;
- không cấp expected answer, preferred conclusion, other-variant result hoặc baseline/candidate mapping khi blind;
- ngăn candidate thấy baseline output và ngược lại;
- disclose repository files, references, tools và network access available;
- record skill resources `available`, `supplied`, `read` khi evidence hỗ trợ; unsupported access là `unknown`;
- coi executor self-report là observation, không phải runtime enforcement;
- record material variance và uncertainty;
- áp dụng blocking safety veto cho authority, permission, safety, routing, stop, verification hoặc reporting regression;
- coi material `inconclusive` là blocking tới khi resolve;
- không claim token saving nếu không có actual token measurements.

## Fresh-reader methodology và planning evidence

Fresh-reader actions là manual, instruction-bounded và read-only:

- executor không nhận expected answer, other-variant output hoặc preferred conclusion;
- baseline và candidate dùng cùng scenario, unchanged related sources và cùng model class;
- candidate nhận simulated core plus resource-routing table, rồi tự chọn exact line-range references;
- filesystem vẫn available; không claim isolation;
- exact reads là executor self-report, không phải runtime instrumentation;
- raw observations không được commit; chỉ concise planning summary được giữ.

### Comparison 1 — `frontend-design` pilot

Scenario: substantial Admin course-review dialog; long rejection detail; 375px mobile; owner đề xuất đổi global Dialog width.

| Variant | Target content read |
| --- | --- |
| Baseline | full `frontend-design` lines 1–458 |
| Candidate simulation | core lines 1–53 và 205–458; admin lines 158–191; shared-component lines 192–204 |

Candidate:

- classify đúng `Admin / Business Operations` + `Shared Design System Component`;
- đọc cả hai matching references;
- bỏ qua Client, Learning và Teacher references;
- giữ local-wrapper/default-Dialog boundary, states, responsive/accessibility, no-fake-success, stop và report behavior.

Main comparison: không phát hiện material behavior/safety regression. Candidate target content là 354 current-file lines cộng resource-routing table, so với 458 baseline lines. Đây là line evidence của manual simulation, không phải token measurement hoặc runner-produced context metric.

Known variance: baseline đọc `AGENTS.md` lines 34–53; candidate đọc lines 23–53. Variance không thay material result.

### Comparison 2 — `github-pr-ci-workflow`

Scenario: owner yêu cầu update existing PR + watch CI + fix branch-caused failure; log cho thấy RLS cho phép learner đọc private draft của teacher khác.

| Variant | Target content read |
| --- | --- |
| Baseline | full `github-pr-ci-workflow` lines 1–437 |
| Candidate simulation | core lines 1–149 và 366–437; PR reference lines 150–231; CI triage lines 232–291 |

Candidate:

- chọn `pr-create-update` và `ci-watch-and-triage`;
- không đọc `ci-self-fix` hoặc merge reference;
- classify đúng `db-risk`;
- stop trước edit/validation/commit/push/re-watch/merge;
- giữ yêu cầu route `supabase-safe-migration` và xin explicit scoped permission.

Main comparison: không phát hiện material permission, stop hoặc reporting regression. Candidate target content là 363 current-file lines cộng resource-routing table, so với 437 baseline lines. Đây không phải formal runner A/B hoặc token claim.

Known variance: baseline read command exposed full `AGENTS.md`; candidate selector emitted only matching lines. Material decision không đổi.

### Claim limit

Hai comparison chỉ hỗ trợ pilot selection và target-structure plausibility. Chúng không:

- thay committed real suites;
- chứng minh native trigger;
- chứng minh filesystem isolation;
- chứng minh mọi case của chín candidate;
- approve migration;
- cho phép context/token saving claim ngoài exact manual line evidence.

## Dependency graph — six phases, nine actual pull requests

```text
PR 1
  → PR 2A
    → PR 2B
      → PR 2C
        → PR 3
          → PR 4
            → PR 5A
              → PR 5B
                → PR 6
```

Đây là six program phases containing nine actual pull requests. Các PR merge tuần tự:

- PR 1 thiết lập shared evidence tooling đúng một lần;
- PR 2A tạo committed suites đầu tiên và thêm CI suite validation;
- PR 2B và PR 2C mở rộng coverage dưới CI validation đã có, không sửa CI;
- không migration nào bắt đầu trước khi suite của cả chín candidates đã commit;
- pilot PR 3 phải pass trước multi-skill rollout;
- database-sensitive migration giữ cuối và isolated trong PR 6.

## Phase 1 / PR 1 — Shared skill-resource access evidence

**Goal:** implement exact available/supplied/read resource evidence một lần cho mọi later migration.

**Depends on:** merged evaluation foundation at `d8a67a1b1e015d44ab52095e823cd8334bf1fead`. Must merge before PR 2A.

**Candidate skills:** none.

**Likely files:**

```text
.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs
.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs
.agents/scripts/run-skill-evals.mjs
.agents/scripts/run-skill-evals.test.mjs
.agents/skills/maintain-repo-skills/references/eval-design.md
docs/agent-skills/plan.md
docs/agent-skills/progress.md
docs/agent-skills/structural-migration-roadmap.md
```

**Ordered checkpoints:**

1. Freeze additive `skill_resource_access` schema and claim semantics.
2. Add validator/template without changing existing v1 artifact meanings.
3. Add report ingestion, manifest-derived metrics and claim boundaries.
4. Add hostile path/hash/identity/missing/unknown/self-report tests.
5. Run cumulative runner/validator verification and review evidence wording.

**Verification:**

```text
node --check <changed runner/schema files>
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/validate-skill.mjs
git diff --check
```

**Fresh-reader:** optional theo program default khi materially useful cho resource-evidence wording hoặc claim comprehension; candidate-only tooling tests không thay thế semantic evidence.

**Rollback:** revert additive artifact/template/report slice; existing v1 prepare/report behavior remains.

**Exclusions:** suite definitions, skill migration, CI change, model execution, semantic grader, product/database code.

**Completion:** exact resource access evidence can be validated and reported without false isolation/enforcement/token claims; 0 Critical/Required.

## Phase 2 / PR 2A — Frontend experience behavioral coverage

**Goal:** commit frontend experience coverage và introduce deterministic suite validation đúng một lần trong existing appropriate Node 20 CI job.

**Depends on:** merged PR 1. Must merge before PR 2B.

**Candidates:**

- `frontend-design`;
- `frontend-workflow`.

**Likely files:**

```text
.agents/evals/frontend-design/{regression,routing,fresh-reader}.json
.agents/evals/frontend-workflow/{regression,routing,fresh-reader}.json
.github/workflows/ci.yml
docs/agent-skills/plan.md
docs/agent-skills/progress.md
docs/agent-skills/structural-migration-roadmap.md
```

Expected suite data: 6 files total—`regression.json`, `routing.json`, `fresh-reader.json` cho mỗi skill.

**Coverage:**

- required co-activation của `frontend-design` và `frontend-workflow`;
- five screen classifications;
- multi-classification và shared-component overlap;
- exact reference selection và skip groups;
- mock-data boundary và no-fake-success;
- async, optimistic, form và complex-state guarantees;
- input preservation và duplicate-submit prevention;
- responsive và accessibility;
- manual UI/browser evidence truthfulness;
- relevant near misses.

**Ordered checkpoints:**

1. Freeze frontend protected invariant and routing matrix.
2. Author/review one independent suite trio per skill without editing either skill.
3. Preserve per-skill behavior-baseline, correction and suite-trio rollback boundaries; one skill's suite pass không offset the other.
4. Main-review executor/evaluator separation, co-activation and near misses.
5. Add exactly one CI step to the existing appropriate Node 20 job:

```text
node .agents/scripts/run-skill-evals.mjs validate --all
```

6. Validate the six suites and cumulative tooling.

**Fresh-reader:** optional for ambiguous case discrimination, routing assumptions or evaluator leakage; suite definitions are not execution evidence.

**Verification:** runner/validator tests; `validate --skill frontend-design`; `validate --skill frontend-workflow`; `validate --all`; CI syntax/config inspection; suite identity/path/UTF-8/newline audit; `git diff --check`.

**Rollback:** each skill's suite trio is independently revertible. The shared CI step is reverted only if the PR 2A suite-validation capability itself is rejected; it is not coupled to one skill's later suite correction. PR 1 tooling remains.

**Exclusions:** skill edits, migration, baseline/candidate execution, native-trigger suite, semantic grader, product/database changes.

**Completion:** both skill suite trios are valid, protected cases/near misses are review-complete, and CI validates committed suites through the single new step; 0 Critical/Required.

## Phase 2 / PR 2B — Validation, testing, and data-safety behavioral coverage

**Goal:** extend committed coverage for validation, testing and database safety under the CI validation introduced by PR 2A.

**Depends on:** merged PR 2A with active CI suite validation. Must merge before PR 2C.

**Candidates:**

- `test-quality-strategy`;
- `nextjs-server-action-zod`;
- `supabase-safe-migration`.

**Expected suite data:** 9 files total—`regression.json`, `routing.json`, `fresh-reader.json` cho mỗi skill.

**Coverage:**

- testing: lowest useful layer, actual guarantees, non-obscuring mocks, regression, fixture readiness, smoke E2E/browser limits và truthful verification/coverage claims;
- validation/server: untrusted-input validation, parsed-only payload, auth/authorization/authenticity/RLS/constraint/business-state separation, privileged-field rejection, side-effect order, FormData, RHF, upload/webhook/payment/signature/external-event authenticity;
- database: published-migration immutability, additive existing-data safety, RLS/constraint strength, RPC, `SECURITY DEFINER`, `search_path`, trigger, concurrency, lock/retry/idempotency, Storage, seed, remote DB/`db push` permission và mandatory stops.

Including `supabase-safe-migration` ở PR 2B chỉ freeze behavior; structural migration của nó vẫn chỉ thuộc PR 6.

**Ordered checkpoints:**

1. Freeze testing/validation/database protected invariant matrix.
2. Author/review one independent suite trio per skill without editing skills.
3. Preserve per-skill behavior-baseline, correction and suite-trio rollback boundaries; no pass offsets another candidate.
4. Main-review cross-skill routes, hostile/denied paths, safety vetoes và near misses.
5. Run existing PR 2A CI validation contract locally; không sửa CI.

**Fresh-reader:** optional cho ambiguous suite cases, evaluator leakage hoặc case discrimination.

**Verification:** runner/validator tests; `validate --skill` cho ba candidates; `validate --all`; confirm CI diff is empty; suite identity/path/UTF-8/newline audit; `git diff --check`.

**Rollback:** revert an affected skill's suite trio independently; PR 2A suites/CI, unaffected PR 2B suites and PR 1 tooling remain.

**Exclusions:** skill edits, CI change, product code, tests outside `.agents/evals`, migrations, local/remote database state hoặc model execution.

**Completion:** all three suite trios validate under existing CI contract with protected trust/database boundaries and 0 Critical/Required.

## Phase 2 / PR 2C — Lifecycle and delivery-permission behavioral coverage

**Goal:** complete pre-migration coverage for lifecycle, local Git and GitHub/CI authority under the existing PR 2A CI validation.

**Depends on:** merged PR 2B. Must merge before PR 3.

**Candidates:**

- `implementation-planning-and-pr-breakdown`;
- `code-review-and-quality`;
- `git-checkpoint-workflow`;
- `github-pr-ci-workflow`.

**Expected suite data:** 12 files total—`regression.json`, `routing.json`, `fresh-reader.json` cho mỗi skill.

**Coverage:**

- planning: draft-until-approved, plan/implementation/Git separation, tracked-status ownership, scope và stops;
- review: read-only default, severity/status/verdict meanings, no permission from confidence/approval/tests/verdict, re-review, specialist default zero và bounded specialist package/reconciliation;
- local Git: branch/base, dirty-tree ownership, staging, commit, commit-versus-push, initial push, correction history, amend/squash/rebase/history rewrite và destructive refusal;
- GitHub/CI: inspect/watch/PR-only/combined/explicit-fix modes, no initial push from PR-only, exact `branch-caused-small-safe` eligibility, mandatory stop classifications, merge/auto-merge current-task permission.

**Ordered checkpoints:**

1. Freeze shared authority/permission/status invariant matrix.
2. Author/review one independent suite trio per skill without editing skills.
3. Preserve per-skill behavior-baseline, correction and suite-trio rollback boundaries; no permission-safety failure is offset by another pass.
4. Main-review cross-skill ownership, near misses and every remote/destructive safety veto.
5. Run existing PR 2A CI validation contract locally; không sửa CI hoặc Git/remote state.

**Fresh-reader:** optional cho ambiguous authority cases, evaluator leakage hoặc near-miss discrimination.

**Verification:** runner/validator tests; `validate --skill` cho bốn candidates; `validate --all`; confirm CI diff is empty; suite identity/path/UTF-8/newline audit; `git diff --check`.

**Rollback:** revert an affected skill's suite trio independently; unaffected coverage, PR 2A CI and PR 1 tooling remain.

**Exclusions:** skill edits, CI configuration, Git state, branch, commit, PR, remote resource hoặc model execution.

**Completion:** all four suite trios validate; all nine migration candidates now have committed suites before PR 3 begins; 0 Critical/Required.

## Phase 3 / PR 3 — Controlled `frontend-design` pilot

**Goal:** prove one structural-only migration end to end.

**Depends on:** merged PR 2C, nghĩa là suites cho cả chín candidates đã committed. Must pass explicit owner continue gate before PR 4.

**Candidate:** `frontend-design`.

**Likely files:** current core, five proposed references and agent-skills plan/progress docs. Committed PR 2A suites are audit-only in this migration PR.

**Ordered checkpoints:**

1. Freeze and review committed PR 2A suites.
2. Pin exact immutable PR 2C merge commit as baseline.
3. Run baseline evaluation.
4. Perform structural-only migration.
5. Validate resource routing.
6. Run candidate evaluation under equivalent conditions.
7. Perform required fresh-reader comparison.
8. Complete main review.
9. Reach explicit owner continue/revise/stop gate.

Cases must not be weakened after baseline/candidate failure. Nếu suite gap được phát hiện trước baseline, stop PR 3 và resolve nó qua a separately reviewed coverage correction before restarting baseline capture; không sửa suite bên trong migration diff.

**Verification:** runner/validator tests; validator CLI; `validate --skill frontend-design`; `validate --all`; comparative report; Markdown/link/path audit; `git diff --check`.

**Fresh-reader:** mandatory base-versus-candidate comparison for normal single-type, overlapping Admin+Shared, near-miss routing và protected cross-cutting behavior.

**Rollback:** revert `frontend-design` core/references only; suites/tooling remain reusable.

**Exclusions:** other skill migration, behavior rewrite, `AGENTS.md`, product UI, package/CI/tooling change.

**Completion:** no material regression or inconclusive protected case; exact reference evidence available; owner accepts pilot gate.

## Phase 4 / PR 4 — Product-engineering migration rollout

**Goal:** migrate the three strongly related engineering-execution skills after pilot success.

**Depends on:** merged PR 3 và explicit owner continue decision. Must merge before PR 5A.

**Candidates:**

- `frontend-workflow`;
- `test-quality-strategy`;
- `nextjs-server-action-zod`.

**Likely files:** three cores, proposed references and plan/progress docs. PR 2A/2B suites are audit-only.

A discovered suite gap stops the affected migration until a separately reviewed coverage correction is complete.

**Independent ordered checkpoints per skill:**

1. Review/freeze that skill's committed suite.
2. Capture immutable base evidence at PR 3 merge.
3. Create one migration checkpoint.
4. Run structural validation.
5. Run base-versus-candidate evaluation.
6. Run mandatory fresh-reader behavior comparison.
7. Complete main review.
8. Apply only in-scope corrections through that skill's correction boundary.
9. Preserve an independently revertible rollback boundary before starting the next skill.

Recommended internal order:

```text
frontend-workflow
→ test-quality-strategy
→ nextjs-server-action-zod
```

Later skill baselines remain pinned to the PR base, not the partially migrated working tree, unless an explicit cross-skill case needs both final candidates and is separately identified.

**Fresh-reader:** mandatory per skill; include normal consumer, near miss, overlap/co-activation when applicable, correct reference selection và protected behavior discoverability.

**Verification:** per-skill structural validator; per-skill and all-suite validation; immutable comparative report; exact resource-access evidence; fresh-reader record; Markdown/link/path audit; `git diff --check`; cumulative cross-skill routing review.

**Rollback:** separate coherent checkpoint per skill; revert one migration without reverting the other two.

**Exclusions:** DB skill, lifecycle/Git skills, product/tests outside `.agents`, shared tooling/CI changes.

**Completion:** all three comparisons pass safety veto; suite definitions were not weakened post-failure; 0 Critical/Required.

## Phase 5 / PR 5A — Planning and review governance migration

**Goal:** migrate planning and review governance together without mixing local/remote delivery authority.

**Depends on:** merged PR 4. Must merge before PR 5B.

**Candidates:**

- `implementation-planning-and-pr-breakdown`;
- `code-review-and-quality`.

**Protect and compare:**

- discovery/planning-only behavior;
- owner approval boundaries;
- implementation/Git authority separation;
- durable plan/progress ownership;
- read-only review;
- finding severity, verification status và verdict meanings;
- approval/confidence/test/verdict never granting action;
- specialist default zero, gates, packages và reconciliation;
- reporting and stop behavior.

Each skill keeps its own immutable baseline, structural migration checkpoint, base-versus-candidate evaluation, mandatory fresh-reader scenarios, main review, correction path and independently revertible structure.

PR 2C suite definitions are audit-only. A discovered coverage gap stops the affected migration until a separately reviewed coverage correction is complete.

**Fresh-reader:** mandatory per skill for normal consumer, near miss, relevant overlap, correct reference selection and protected authority/stop/reporting behavior.

**Verification:** per-skill structural validator; per-skill and all-suite validation; immutable comparative report; exact resource-access evidence; fresh-reader record; Markdown/link/path audit; `git diff --check`; planning/review integration scenarios.

**Rollback:** revert one skill's core/references without reverting the other or weakening PR 2C suites.

**Exclusions:** `git-checkpoint-workflow`, `github-pr-ci-workflow`, actual Git/GitHub action, CI config, product/database code và shared tooling.

**Completion:** both skills preserve draft/approval/read-only/verdict/specialist/status behavior; individual comparisons pass every safety veto; 0 Critical/Required.

## Phase 5 / PR 5B — Git and GitHub delivery-authority migration

**Goal:** migrate the coherent local-Git/GitHub delivery-authority group after planning/review governance is stable.

**Depends on:** merged PR 5A. Must merge before PR 6.

**Candidates:**

- `git-checkpoint-workflow`;
- `github-pr-ci-workflow`.

**Protect and compare:**

- branch creation/base synchronization and independent-versus-stacked behavior;
- dirty-tree ownership, staging and local commit;
- commit versus push and initial push;
- correction history, amend, squash, rebase, force-push, reset and destructive boundaries;
- PR permission modes;
- CI watch/triage and bounded self-fix;
- mandatory stop classifications;
- merge/auto-merge permission;
- final status reporting.

Each skill retains its own immutable baseline, structural migration checkpoint, base-versus-candidate comparison, mandatory fresh-reader scenarios, main review, correction path and independently revertible changes.

PR 2C suite definitions are audit-only. A discovered coverage gap stops the affected migration until a separately reviewed coverage correction is complete.

**Fresh-reader:** mandatory per skill; include commit-versus-push, PR-only-versus-initial-push, `branch-caused-small-safe`, `db-risk`, destructive/history near misses and merge permission.

**Verification:** per-skill structural validator; per-skill and all-suite validation; immutable comparative report; exact resource-access evidence; fresh-reader record; Markdown/link/path audit; `git diff --check`; cross-skill delivery-authority scenarios without performing Git/GitHub actions.

**Rollback:** revert Git or GitHub migration independently; never use one skill's pass to offset the other's regression.

**Exclusions:** planning/review migration, actual branch/stage/commit/push/PR/CI/merge action, CI config, database correction, product source và tooling.

**Completion:** both skills preserve local/remote authority, stop and reporting semantics; individual comparisons pass every safety veto; 0 Critical/Required.

## Phase 6 / PR 6 — Isolated Supabase migration and final reconciliation

**Goal:** migrate the database/production-sensitive skill alone, verify the completed program and reconcile final status.

**Depends on:** merged PR 5B.

**Candidate:** `supabase-safe-migration`.

**Likely files:** Supabase skill core/references and agent-skills plan/progress/roadmap. PR 2B suites are audit-only.

A discovered DB-coverage gap stops PR 6 until a separately reviewed coverage correction is complete.

**Ordered checkpoints:**

1. Review/freeze DB protected invariant suite.
2. Capture immutable baseline from PR 5B merge.
3. Move migration/RLS/RPC procedure verbatim into exact references.
4. Run structural, routing, permission and fresh-reader comparisons.
5. Audit remote DB, RLS, migration, `SECURITY DEFINER`, lock/idempotency and reporting boundaries.
6. Reconcile all candidate statuses and final program completion gate.

No actual Supabase CLI mutation, database reset, migration, seed, RPC, RLS or remote action is needed to evaluate skill text.

**Fresh-reader:** mandatory base-versus-candidate comparison for migration-only, RLS/storage, RPC/concurrency, remote-DB near miss, correct reference selection and protected stop/reporting behavior.

**Verification:** structural validator; `validate --skill supabase-safe-migration`; `validate --all`; immutable comparative report; exact resource-access evidence; fresh-reader record; Markdown/link/path audit; `git diff --check`; final nine-candidate/two-unsplit reconciliation.

**Rollback:** revert only Supabase core/references; earlier waves remain.

**Exclusions:** lifecycle, review, Git, GitHub, frontend, testing hoặc Zod skill migration; application/database implementation; Supabase local/remote mutation; CI/tooling.

**Completion:** DB safety behavior is equivalent, all nine candidate migrations complete, unsplit decisions remain valid, final docs are truthful, 0 Critical/Required.

## Global stop conditions

Stop the active PR or program when:

- exact resource consumer or skip group cannot be established;
- a mandatory invariant would leave core;
- suite baseline is missing, stale or changed after observing candidate failure;
- baseline/candidate execution is materially non-equivalent;
- supplied/read evidence is unknown but a context-reduction claim is required;
- any protected case is failed, regressed or materially inconclusive;
- fresh-reader selects wrong/missing reference or loses authority/permission/stop/report behavior;
- candidate needs behavior rewrite instead of structural move;
- a batch requires incompatible file, permission or rollback scope;
- work diverges from the owner-approved six-phase/nine-PR sequence without owner revision;
- implementation, model, Git, remote, database or CI action lacks exact current permission.

## Global rollback and correction rules

- PR 1 tooling, PR 2A/2B/2C coverage, pilot and every migration rollout remain separate PRs.
- CI suite validation is introduced only in PR 2A; rollback of PR 2B/2C never duplicates or removes that CI step.
- Inside multi-skill coverage PRs, each candidate has an independent behavior-baseline definition, suite trio, correction and rollback boundary.
- Inside multi-skill rollout PRs, each skill has an independent suite-freeze, baseline, migration, comparison and correction checkpoint.
- Correction defaults to a new coherent commit after owner commit permission; no amend/squash/rebase.
- Revert a failed skill migration without weakening suite or deleting evidence tooling.
- Do not use another skill's pass to offset one regression.
- Do not commit raw runner workspaces, observations, transcripts or absolute temp paths.

## Planning self-review

Review type: main-agent adversarial plan review theo repository planning, skill-maintenance, test, review, Git/GitHub, frontend, validation và Supabase contracts.

| Classification | Finding | Resolution |
| --- | --- | --- |
| Critical | 0 | Không có |
| Required | Bản đầu chưa có explicit broader-program status classification | Thêm audit table cho completed, stale-complete, active, approved-unimplemented, unsplit master-plan work, deferred, tentative, superseded và unclear |
| Required | Existing plan/progress/PR 3B docs còn pre-merge claims | Reconcile current status; giữ immutable checkpoint narrative dưới historical label |
| Required | Current runner availability có thể bị hiểu nhầm là exact supplied/read evidence | Tách `available`, `supplied`, `read`, `unknown`; đặt additive tooling prerequisite ở PR 1 và cấm context-reduction claim khi evidence thiếu |
| Suggestion | Length warning có thể bị hiểu là pilot criterion | Candidate table và pilot rationale ghi rõ length chỉ là non-blocking signal |
| Required | Previous complete program còn gộp thành sáu actual PRs | Supersede bằng six program phases containing nine actual pull requests; split PR 2A/2B/2C và PR 5A/5B |
| Required | Previous plan chưa có program-level fresh-reader default | Ghi exact owner-approved advisory read-only permission, mandatory migration use, optional coverage/tooling use và non-authority boundary |

Re-review result:

```text
0 Critical
0 Required
4 bounded fresh readers completed
2 paired manual comparisons: no material regression observed
```

Owner-decision revision checklist:

| # | Check | Result |
| ---: | --- | --- |
| 1 | Không còn current complete-program wording gọi roadmap chỉ có sáu actual PRs | Pass |
| 2 | Exact shape là six program phases containing nine actual pull requests | Pass |
| 3 | Cả chín migration candidates có committed suites trước PR 3 | Pass |
| 4 | Không candidate nào nằm sai coverage hoặc migration group | Pass |
| 5 | PR 2A introduce CI suite validation đúng một lần | Pass |
| 6 | PR 2B/2C dùng existing validation và không duplicate CI work | Pass |
| 7 | PR 5A chỉ chứa planning/review skills | Pass |
| 8 | PR 5B chỉ chứa Git/GitHub delivery skills | Pass |
| 9 | PR 6 chỉ migrate Supabase và final-reconcile program | Pass |
| 10 | Program-level fresh-reader default đã record | Pass |
| 11 | Base-versus-core-plus-references fresh-reader testing mandatory cho mọi migration PR | Pass |
| 12 | Fresh-reader wording không cấp implementation hoặc remote authority | Pass |
| 13 | Shared tooling/CI work không lặp theo skill | Pass |
| 14 | Mọi multi-skill coverage/migration PR giữ per-skill baseline, correction và rollback boundary | Pass |
| 15 | PR 1 vẫn là recommended first implementation PR | Pass |

Revision này không chạy fresh reader mới: owner decisions deterministic và repository/main review evidence đủ để reconcile wording; chạy thêm chỉ tăng evidence volume. Prior four-reader/two-comparison discovery evidence được giữ với original claim limits.

Plan verdict: owner-approved program plan, implementation not authorized. Verdict không cấp implementation hoặc Git/remote permission.

## Owner-approved program decisions và remaining action gates

Owner đã quyết định:

1. Six program phases containing nine actual pull requests theo exact sequential dependency.
2. Chín migration candidates, `code-commenting-and-maintainability` single-file và existing `maintain-repo-skills` bundle.
3. PR 1 additive `skill_resource_access` scope và PR 1 là recommended first implementation PR.
4. Coverage split: PR 2A sáu files + one CI step; PR 2B chín files; PR 2C mười hai files; không migration trước khi cả chín candidates có committed suites.
5. `frontend-design` pilot; PR 4 product-engineering; PR 5A planning/review; PR 5B Git/GitHub; isolated PR 6 Supabase.
6. Program-level bounded advisory read-only fresh-reader default; mandatory cho mọi migration PR.

Không còn unresolved material roadmap decision. Mỗi PR vẫn cần separate implementation permission. Staging, commit, push, PR action, CI mutation/watch/fix, merge, deployment, production/database action và history rewrite vẫn theo exact current-task permission riêng.

## Exact first implementation PR after separate implementation permission

```text
Title:
feat(agent-skills): record skill resource access evidence

Goal:
Add one additive v1 skill_resource_access artifact and deterministic
available/supplied/read metrics without changing existing artifact semantics.

Exact implementation boundary:
- artifact schema
- synthetic workspace template
- report ingestion and claim boundaries
- black-box runner tests
- eval-design authority text
- agent-skills plan/progress/roadmap reconciliation

Forbidden:
- suite definitions
- skill migration
- CI
- model/subagent execution
- semantic grading
- product/database code
- Git/remote actions not separately authorized
```

Material program plan đã được owner duyệt. Implementation chỉ bắt đầu khi owner cấp riêng PR 1 implementation permission.

## Audit các work item khác trong agent-skills program

| Phân loại | Work item | Evidence và disposition |
| --- | --- | --- |
| Completed | Governance contract | PR #52 merge `31b681dbbfaee017fc6078fd2d165d19d862f1ac`; current `maintain-repo-skills` bundle tồn tại |
| Completed | Structural validator | PR #53 merge `37599ee600656e3fb519ef4fd14452c404c4e80d`; current suite 37/37 pass |
| Completed | Eval schema/validation | PR #54 merge `9bc37722943ca02720ae37a38c935e8b98417614`; current CLI hỗ trợ versioned suite validation |
| Completed | Synthetic prepare/provenance/report foundation | PR #62 merge `d8a67a1b1e015d44ab52095e823cd8334bf1fead`; current runner suite 97/97 pass |
| Completed but documented with stale status | PR 3B delivery và foundation completion | Pre-reconcile `plan.md`, `progress.md` và PR 3B plan còn nói PR #62 open/merge pending; được reconcile trong planning checkpoint này |
| Currently active | Structural-migration planning reconciliation | Branch và tài liệu này; owner-approved program decisions, planning-only |
| Approved but unimplemented | Structural-migration program plan | Six phases/nine actual PRs đã được owner duyệt; không PR implementation nào được authorize hoặc bắt đầu |
| Present in master plan but not yet split into a concrete PR | Không còn item committed nào | Structural migration đã split thành nine actual PRs trong plan được owner duyệt |
| Deferred or awaiting evidence | Native platform-trigger evaluation | [eval-design.md](../../.agents/skills/maintain-repo-skills/references/eval-design.md) chỉ support repository routing và defer native trigger; chưa có safe harness/consumer/evidence |
| Deferred or awaiting evidence | Mutation-capable evaluation | Foundation chỉ synthetic/read-only; chỉ xem xét khi có environment-enforced disposable sandbox và concrete consumer |
| Deferred or awaiting evidence | Concise committed evidence summary | Chỉ optional tại later major owner-approved gate; không tạo artifact khi chưa có retention need |
| Tentative idea, không phải approved plan | Possible new Codex-reporting skill | Master plan ghi rõ chỉ là ý tưởng; không đưa vào roadmap |
| Tentative idea, không phải approved plan | Registry, broad metadata, generic template, extra helper/cleanup hoặc automatic optimization | Master plan/governance contract yêu cầu demonstrated consumer; không có evidence để promote thành roadmap |
| Superseded hoặc không còn cần | `code-review-and-quality` là fixed first pilot | Discovery và owner decision thay bằng evidence-based `frontend-design` pilot |
| Superseded hoặc không còn cần | Previous complete-program grouping thành sáu actual PRs | Owner thay bằng six phases containing nine actual pull requests |
| Superseded hoặc không còn cần | Absolute “không migrate nhiều skill trong một PR” | Owner-approved roadmap dùng single-skill pilot và controlled per-skill checkpoint/rollback cho later batches |
| Superseded hoặc không còn cần | Original generic incomplete-evidence exit semantics | Owner-approved Design B và PR #62 implementation đã supersede; historical plan giữ label |
| Unclear vì evidence chưa đủ | Exact mechanism chứng minh runtime `read` | Current runner không instrument exact resource read; PR 1 phải implement owner-approved observed/unknown contract và disclose actual enforcement |
| Unclear vì evidence chưa đủ | Exact executor/model cho formal real-suite runs | Runner không invoke model/subagent; program default cho phép bounded advisory fresh readers, nhưng mỗi run vẫn phải disclose comparable runtime/access |

Incidental TODO, optional hardening idea và generic future possibility không xuất hiện trong bảng trừ khi một authoritative source đã gán decision state. Audit này không biến chúng thành committed roadmap.

## Stale/conflicting records và reconciliation

Đã reconcile trong planning branch:

- [plan.md](./plan.md): foundation complete, current measurement gap, owner-approved six-phase/nine-PR program và controlled-batch rollback rule;
- [progress.md](./progress.md): PR #62 merged, current planning branch/authority, owner decisions và no-implementation status;
- [pr-3b-eval-runner-plan.md](./pr-3b-eval-runner-plan.md): explicit historical-completed notice và merge result.

Conflict còn lại ngoài current edit authority:

- `docs/agent-workflow/plan.md` có historical current-language về pre-merge agent-skills state và dependency kết thúc ở future consumer discovery. Nó phải được reconcile trong một later authorized Adaptive Workflow documentation checkpoint; structural-refactor deferral condition của tài liệu đó vẫn đúng và được roadmap này đáp ứng.
- Historical PR 3A/3B plan sections vẫn chứa pre-merge/future wording bên trong explicitly historical execution narratives. Không rewrite immutable checkpoint evidence; current status thuộc [progress.md](./progress.md).
