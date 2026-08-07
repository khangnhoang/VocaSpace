# ASM-PR4 — Detailed Implementation Plan: Product-Engineering Structural Migration Rollout

Plan này là approved execution contract cho ASM-PR4. Owner instruction ngày `2026-08-07` duyệt material plan và cấp CP2–CP12 skill implementation, bounded baseline/candidate và fresh-reader execution, coherent local checkpoint commits, correction/re-review trong phạm vi, cùng một final normal push sau `0 Critical / 0 Required`. Permission này không cấp suite/tooling/CI/product/database changes, intermediate push, PR, merge, deployment, force-push, destructive hoặc history action.

## 1. Trạng thái và authority

| Trường | Giá trị hiện tại |
| --- | --- |
| Plan status | `approved for CP2–CP12 implementation` |
| Planning date | `2026-08-07` |
| Current branch | `feat/agent-skills-asm-pr4` |
| Branch base | synchronized `main == origin/main == c8e4245f7fb8337063e2ef2a4e0d5120f6427556` |
| Dependency | ASM-PR3 final head `1301ed6` merged through PR #70 at `c8e4245`; owner chose pilot `continue` on `2026-08-05` |
| Immutable behavioral baseline proposed | `c8e4245f7fb8337063e2ef2a4e0d5120f6427556` |
| Discovery | `complete` |
| Preliminary size | `Large/high-risk` because the approved unit contains three skill owners, trust-boundary behavior, 54 frozen cases, semantic comparisons and independent rollback boundaries |
| Final size | `Large/high-risk`; discovery confirmed three sequential migrations and a cumulative cross-skill integration review |
| Current planning permission | consumed through planning checkpoint `3ac6a83f10a7f366dd5a418bf3d15b7f8ce37a5b` and its normal push |
| Current implementation permission | CP2–CP12 in approved order; bounded baseline/candidate and mandatory fresh-reader evidence; in-scope correction/re-review; coherent local checkpoint commits; final normal push only after CP12 reaches `0 Critical / 0 Required` |
| Program fresh-reader authority | bounded advisory read-only fresh readers may be used when materially useful; mandatory during any later ASM-PR4 migration execution |
| Specialist decision for planning | `0`; direct repository and frozen-suite evidence resolve the plan without a residual hard-risk cluster |
| Not granted | intermediate push; unbounded or non-program model execution; frozen-suite/tooling/CI/product/DB changes; PR/CI/merge; deploy; force-push; destructive or history actions |

## 2. Mục tiêu và outcome quan sát được

ASM-PR4 sẽ structurally migrate ba skill product-engineering đã được owner duyệt, theo thứ tự:

```text
frontend-workflow
→ test-quality-strategy
→ nextjs-server-action-zod
```

Outcome bắt buộc:

1. mỗi skill trở thành một core `SKILL.md` cộng đúng các reference đã được roadmap duyệt;
2. core vẫn đủ để quyết định activation, ownership, related-skill routing, permission/safety/evidence boundary, exact resource selection, stop và reporting behavior trước khi reference được đọc;
3. reference chỉ nhận existing conditional procedure có demonstrated consumer và valid skip group;
4. first migration của mỗi skill là structural-only, không cleanup wording, đổi semantics, thêm rule mới hoặc sửa example behavior;
5. committed suites vẫn byte-identical và được dùng làm audit-only oracle;
6. baseline/candidate comparison và mandatory fresh-reader evidence không phát hiện material regression, safety veto hoặc material `inconclusive`;
7. từng skill có validation, review, correction và rollback boundary độc lập;
8. cumulative review xác nhận cross-skill routing và physical reference ownership không bị lẫn giữa ba bundle;
9. final review đạt `0 Critical / 0 Required` trước bất kỳ delivery action nào được cấp sau này.

Core ngắn hơn không tự chứng minh thành công. Bất kỳ regression về permission, no-fake-success, test-evidence truthfulness, parsed-only input, authorization, side-effect order, routing, stop hoặc reporting đều phủ quyết lợi ích structural/context.

## 3. Nguồn authoritative và source ownership

- [`../../plan.md`](../../plan.md) sở hữu approved program scope, phase dependency, permission semantics và evidence architecture.
- [`../../structural-migration-roadmap.md`](../../structural-migration-roadmap.md) sở hữu ASM-PR4 candidates, order, target bundle, exclusions, completion, fresh-reader, stop và rollback contract.
- [`../../progress.md`](../../progress.md) sở hữu current actual planning, implementation, verification và delivery state.
- [`../README.md`](../README.md) sở hữu per-PR artifact layout, reader routing và pending-owner-decision rule.
- File này sở hữu detailed ASM-PR4 execution contract sau owner approval.
- [`owner-review-brief.md`](./owner-review-brief.md) là owner-facing decision surface; nó không thay thế file này.
- `.agents/skills/<candidate>/**` sở hữu operational behavior sau implementation.
- `.agents/evals/<candidate>/{regression,routing,fresh-reader}.json` là frozen test specification, audit-only trong ASM-PR4.
- `.agents/skills/maintain-repo-skills/references/{progressive-disclosure,fresh-reader-testing,eval-design}.md` sở hữu procedure và claim boundary áp dụng cho split/evidence.

Nếu các source trên conflict material về behavior, ownership, permission, acceptance, baseline hoặc order, dừng và xin owner quyết định; không tự trung bình hóa.

## 4. Git, dependency và baseline facts đã xác nhận

- Authorized fetch cập nhật `origin/main` tới `c8e4245`.
- Local `main` fast-forward-only tới `c8e4245`; local `main == origin/main`, divergence `0/0`.
- ASM-PR3 head `1301ed6` là ancestor của `origin/main`; PR #70 merge commit là `c8e4245`.
- `feat/agent-skills-asm-pr4` được tạo trực tiếp từ synchronized local `main`; branch không stacked trên unmerged work.
- Trước planning edits, `HEAD`, `main`, `origin/main` và merge-base đều là `c8e4245`.
- Skill cores và suite definitions dưới đây vẫn có current-tree hash bằng exact Git blob tại `c8e4245`; planning diff không chạm chúng.

| Artifact | Git blob tại `c8e4245` |
| --- | --- |
| `.agents/skills/frontend-workflow/SKILL.md` | `e898e60cc2707dd59e62e8d02ea48b10610a2b0e` |
| `.agents/evals/frontend-workflow/regression.json` | `b042b177b73e78e9a55f91c8ac5dafeac0abdbdc` |
| `.agents/evals/frontend-workflow/routing.json` | `0e57edfb4605c320d83c92ae56e90fd9cc04c26f` |
| `.agents/evals/frontend-workflow/fresh-reader.json` | `1607df35e724a0cbcb6caf27ea63cd7eb981835f` |
| `.agents/skills/test-quality-strategy/SKILL.md` | `7a611a173cb38fdbe51fdecc3cc9679195b1bda8` |
| `.agents/evals/test-quality-strategy/regression.json` | `6db19dd19a8ca3f989dad968ad284cc45418accc` |
| `.agents/evals/test-quality-strategy/routing.json` | `9cd9b2b30dc0af003b2d6d32343277eb5b052fa8` |
| `.agents/evals/test-quality-strategy/fresh-reader.json` | `1965140d35e87f00f374be6b87c899a7242ebb7b` |
| `.agents/skills/nextjs-server-action-zod/SKILL.md` | `c975dc52e0254489f464075a4c923c4e38765716` |
| `.agents/evals/nextjs-server-action-zod/regression.json` | `706ec44ded7f4e1cf6c2ccffa20a067012a09282` |
| `.agents/evals/nextjs-server-action-zod/routing.json` | `32ef47f8385b3bca0ded653b60367d07dfbe926e` |
| `.agents/evals/nextjs-server-action-zod/fresh-reader.json` | `df36f9e594795bfd41bfa0bc8fcb7a2c4dfbbc09` |

Baseline deterministic evidence trên Node `v24.11.1`:

| Check | Kết quả |
| --- | --- |
| structural validator tests | `37/37` pass |
| eval runner tests | `130/130` pass |
| repository structural validation | `11 skills / 0 errors / 4` existing non-blocking warnings |
| `frontend-workflow` suites | `1 skill / 3 files / 19 cases / 0 diagnostics` |
| `test-quality-strategy` suites | `1 / 3 / 15 / 0` |
| `nextjs-server-action-zod` suites | `1 / 3 / 20 / 0` |
| cumulative suites | `9 skills / 27 files / 177 cases / 0 diagnostics` |

Bốn current warnings thuộc `code-review-and-quality`, `implementation-planning-and-pr-breakdown`, `nextjs-server-action-zod` và `test-quality-strategy`. Chúng là non-blocking length signals, không phải migration criterion; candidate structural validation phải giải thích warning delta thay vì dùng line count làm success proof.

## 5. Confirmed decisions, assumptions, conflicts và open questions

### Confirmed decisions

- ASM-PR4 là một pull request chứa ba sequential per-skill migration boundary; không tách lại program shape trong plan này.
- Exact candidate order là `frontend-workflow → test-quality-strategy → nextjs-server-action-zod`.
- Mỗi candidate dùng cùng immutable PR base `c8e4245`, không dùng partially migrated working tree làm behavioral baseline.
- Suite definitions đã commit trước migration và là audit-only.
- Mỗi candidate phải pass structural validation, formal base-versus-candidate comparison, mandatory fresh-reader gate và formal main review trước khi candidate tiếp theo bắt đầu.
- Chỉ in-scope structural correction của active candidate được phép sau failure; behavior rewrite, suite correction, tooling hoặc CI need là stop/scope-expansion condition.
- Cross-bundle routing có thể activate skill khác, nhưng physical reference expectation chỉ áp dụng cho bundle đang được đánh giá.
- Raw observations, manifests, bundle copies, workspaces, transcripts, generated reports và absolute temp paths không được commit.
- ASM-PR4 phải merge trước ASM-PR5A, nhưng plan này không cấp PR hoặc merge action.

### Assumptions cần xác minh lại trước implementation

- Branch vẫn có thể tiếp tục dùng sau planning review mà không có target core/suite change từ upstream. Nếu upstream đổi một trong 12 frozen artifact, phải reconcile plan và re-review trước implementation.
- Same model class và equivalent execution conditions có thể được cung cấp cho baseline/candidate observations. Nếu không, comparison phải ghi exact variance và có thể thành blocking `inconclusive`.
- Exact `supplied`/`read` evidence có thể ghi bằng runtime/operator observation hoặc executor self-report. Nếu không có evidence, dùng `unknown`; không suy ra từ `available`.

### Conflict đã hòa giải

- Roadmap khuyến nghị một PR multi-skill nhưng yêu cầu rollback riêng từng skill. Plan dùng một branch/PR với sequential per-skill commit, comparison, review và rollback boundary; một skill pass không bù cho skill khác fail.
- Later candidate chạy trên working tree đã chứa prior migrated candidates, nhưng behavioral baseline của chính candidate vẫn pin `c8e4245`. Cumulative review cuối kiểm tra interaction; formal physical resource expectation của từng suite vẫn bundle-local.

### Open questions

- Không có open question blocking nội dung plan.
- Owner đã duyệt material plan và exact CP2–CP12 implementation/evidence/checkpoint/final-push boundary ngày `2026-08-07`.
- Executor/runtime/access của semantic evidence phải được record từ actual execution; không được suy đoán.

## 6. Exact planning scope và exclusions

### Planning checkpoint hiện tại

Được phép thay đổi:

```text
docs/agent-skills/progress.md
docs/agent-skills/structural-migration-roadmap.md
docs/agent-skills/implementation-plans/README.md
docs/agent-skills/implementation-plans/asm-pr3/plan.md
docs/agent-skills/implementation-plans/asm-pr3/owner-review-brief.md
docs/agent-skills/implementation-plans/asm-pr4/plan.md
docs/agent-skills/implementation-plans/asm-pr4/owner-review-brief.md
```

### Proposed future implementation scope sau owner approval

```text
.agents/skills/frontend-workflow/SKILL.md
.agents/skills/frontend-workflow/references/mock-data.md
.agents/skills/frontend-workflow/references/async-state-and-forms.md
.agents/skills/frontend-workflow/references/manual-ui-validation.md

.agents/skills/test-quality-strategy/SKILL.md
.agents/skills/test-quality-strategy/references/smoke-e2e-and-browser.md
.agents/skills/test-quality-strategy/references/manual-qa-and-fixtures.md
.agents/skills/test-quality-strategy/references/test-plan-headers.md
.agents/skills/test-quality-strategy/references/mocking-and-regression.md

.agents/skills/nextjs-server-action-zod/SKILL.md
.agents/skills/nextjs-server-action-zod/references/schema-placement-and-design.md
.agents/skills/nextjs-server-action-zod/references/server-actions-and-route-handlers.md
.agents/skills/nextjs-server-action-zod/references/formdata-and-react-hook-form.md
.agents/skills/nextjs-server-action-zod/references/uploads-webhooks-and-payments.md
.agents/skills/nextjs-server-action-zod/references/validation-test-matrix.md

docs/agent-skills/implementation-plans/asm-pr4/plan.md
docs/agent-skills/implementation-plans/asm-pr4/owner-review-brief.md
docs/agent-skills/progress.md
```

### Không được chạm trong ASM-PR4

- 9 suite JSON files của ba candidate;
- `.agents/scripts/**`, structural validator, eval runner/schema/tests;
- `AGENTS.md`, `docs/agent-loops.md`, other skill bundles;
- `.github/**`, `package.json`, lockfile, CI/config/tooling;
- application source, product tests/fixtures, browser config;
- Supabase/database migrations, RLS, RPC, seed, Storage;
- raw semantic evidence hoặc temporary workspace;
- cleanup/rewrite không cần cho structural split.

## 7. Target bundles và progressive-disclosure contract

### 7.1 `frontend-workflow`

Current core: `428` lines, single file.

Core phải giữ activation; related-skill routing; core rules; specialist signal; Discovery/Implementation/Review modes; permission/approved-plan boundary; task/repository/contract/integration/UI/state planning; no-fake-success minimum; async/form/state minimum invariants; tests/performance requirements; fixture-gate routing; implementation scope boundary; final audit; hard stops; definition/reporting contract.

| Reference | Exact read condition | Existing content moved | Valid skip group |
| --- | --- | --- | --- |
| `references/mock-data.md` | Read before adding/reviewing typed mocks or when backend behavior is missing and UI-only/prototype scope is considered | Current mock-data procedure, replacement boundary và production-success prohibitions | Fully integrated frontend work with no mock/prototype decision |
| `references/async-state-and-forms.md` | Read before implementing/reviewing an async mutation, optimistic update, form, dynamic field, or complex client state transition | Detailed async/optimistic, form, dynamic-field và edge-state procedure | Static rendering/composition without async/form/complex client state |
| `references/manual-ui-validation.md` | Read before planning, running, or reporting browser/manual UI validation; read responsive subsection when responsive behavior is material | Current manual UI validation procedure và responsive QA matrix | Tasks with no browser/manual QA decision and no material responsive behavior |

Core links trực tiếp cả ba references và yêu cầu đọc tất cả matching references khi conditions overlap.

### 7.2 `test-quality-strategy`

Current core: `532` lines, single file.

Core phải giữ activation; related-skill routing; observable-guarantee rules; specialist signal; layer taxonomy và lowest-useful-layer decision; required workflow; verification-scope selection; coverage model; placement/naming; evidence/coverage truth; efficient QA rules; anti-patterns; final checklist.

| Reference | Exact read condition | Existing content moved | Valid skip group |
| --- | --- | --- | --- |
| `references/smoke-e2e-and-browser.md` | Read before adding, changing, running, or reviewing smoke E2E/browser coverage | Existing smoke/browser procedure, prerequisite inspection và claim limits | Unit/schema/action/integration work not using browser coverage |
| `references/manual-qa-and-fixtures.md` | Read when manual QA depends on authenticated roles, DB-backed state, ordering, multiple records or seeded fixtures | State matrix, fixture-readiness và deterministic local fixture rules | Automated-only work with no data-dependent manual QA |
| `references/test-plan-headers.md` | Read before creating/changing/reviewing a test file matching a documented header trigger | Header triggers, Vietnamese template và evidence-accuracy rules | Tiny unit tests and tasks not touching eligible test files |
| `references/mocking-and-regression.md` | Read before mocking a boundary or adding/reviewing bug-regression protection | Mocking rules, regression workflow và deterministic test-data guidance | Tests with no mocks and non-bug work |

Core links trực tiếp cả bốn references và yêu cầu đọc mọi matching reference.

### 7.3 `nextjs-server-action-zod`

Current core: `541` lines, single file.

Core phải giữ activation; related-skill routing; Zod/SSOT and untrusted-input invariants; parsed-only data; auth/permission/state separation; side-effect order; privileged-field rules; specialist signal; business/security boundary; Supabase call order; safe errors; validation-boundary comment route; required workflow; anti-patterns; checklist.

| Reference | Exact read condition | Existing content moved | Valid skip group |
| --- | --- | --- | --- |
| `references/schema-placement-and-design.md` | Read before adding, moving, composing or materially changing a reusable schema, DTO, inferred type, transform, default or object strictness | Contract classification, placement workflow, field/schema design và composition guidance | Existing-contract boundary work with no schema/type ownership change |
| `references/server-actions-and-route-handlers.md` | Read before changing/reviewing a Server Action, Route Handler, API request/response boundary, query, route or search params | Boundary workflow and action/handler procedure | Schema-only, RHF-only or external-payload work without action/handler change |
| `references/formdata-and-react-hook-form.md` | Read before changing/reviewing FormData extraction/normalization or React Hook Form contract behavior | Current FormData và RHF procedures | JSON/query/action tasks without FormData/RHF |
| `references/uploads-webhooks-and-payments.md` | Read before upload, webhook, payment, file metadata, signature/authenticity or external-event payload work | Upload/webhook/payment rules | Ordinary form/action/schema work |
| `references/validation-test-matrix.md` | Read before adding/reviewing validation-boundary tests or choosing verification for a validation refactor | Existing schema/action/route/form/upload/webhook test matrix | Planning/source inspection that does not choose test coverage |

Core links trực tiếp cả năm references và yêu cầu đọc mọi matching reference. Validation không được thay thế authentication, authenticity, RLS, constraints hoặc business-state checks sau split.

### 7.4 Common structure rules

- Reference path phải relative, contained trong đúng bundle và resolve tới regular file; không symlink/junction/reparse indirection.
- Không nested required-reference discovery.
- Không thêm script, asset, metadata, placeholder, example mới hoặc reference ngoài approved catalog.
- Move content giữ nguyên nghĩa và established wording; chỉ heading/link adaptation tối thiểu được phép để reference đọc độc lập.
- Core-without-reference review phải vẫn quyết định được authority, permission, safety, route, exact reference selection, stop và truthful report.
- Mỗi reference review phải chứng minh consumer, skip group, exact condition, no duplicate/weakening và no hidden mandatory rule.

## 8. Frozen suite contract và protected inventory

### 8.1 Counts và immutable rule

| Candidate | Regression | Routing | Fresh-reader | Total |
| --- | ---: | ---: | ---: | ---: |
| `frontend-workflow` | 8 | 7 | 4 | 19 |
| `test-quality-strategy` | 6 | 5 | 4 | 15 |
| `nextjs-server-action-zod` | 8 | 7 | 5 | 20 |
| **Total** | **22** | **19** | **13** | **54** |

Không đổi case IDs, prompts, contexts, criteria, expected/forbidden behavior, safety vetoes, routes, configs hoặc future-reference expectations trong ASM-PR4.

- Suite gap phát hiện trước baseline capture: stop affected candidate, tạo separately reviewed coverage correction, merge/re-pin baseline rồi restart affected candidate.
- Failure sau baseline: không weaken suite; classify candidate regression, environment variance hoặc genuine suite defect và dừng tại gate tương ứng.
- Unsplit baseline được đánh giá theo existing behavior, không có future-path obligation.
- Migrated candidate phải chọn exact matching references và skip every irrelevant reference theo committed evaluator-only contract.

### 8.2 `frontend-workflow` protected mapping

- Async reference cases: `fw-reg-async-optimistic-recovery`, `fw-reg-complex-state-matrix`, `fw-reg-form-dynamic-field-recovery`, `fw-route-async-form-contract`, `fw-route-workflow-mechanics-only`, `fw-fresh-async-form-overlap`.
- Manual reference cases: `fw-reg-fixture-and-browser-evidence`, `fw-route-browser-fixture-validation`, `fw-fresh-manual-ui-fixture`; `fw-reg-complex-state-matrix` và `fw-route-nontrivial-frontend-both` chỉ chọn manual resource khi browser QA thực sự được plan.
- Mock reference cases: `fw-reg-mock-boundary-no-fake-success`, `fw-route-mock-missing-backend`, `fw-fresh-mock-boundary`; `fw-reg-hard-stop-and-final-report` chỉ chọn mock resource nếu owner explicitly considers UI-only prototype scope.
- Core-only/skip behavior: `fw-reg-contract-discovery-no-invention`, `fw-reg-discovery-mode-no-edit`, `fw-route-design-review-only-near-miss`, `fw-route-nonfrontend-neither`, `fw-route-nontrivial-frontend-both` khi không có conditional trigger, và `fw-fresh-static-integrated-skip-all`.
- Safety invariants: no invented contract, no unauthorized edit in Discovery, no fake production success, recoverable optimistic/form state, duplicate/stale-response safety, truthful fixture/browser evidence, hard stop on missing backend contract và correct frontend/design/test/validation coactivation.

### 8.3 `test-quality-strategy` protected mapping

- Browser/E2E reference: `tqs-reg-browser-e2e-claim-boundary`, `tqs-reg-fixture-manual-evidence-readiness`, `tqs-route-browser-fixture-owners`, `tqs-fresh-browser-fixture-overlap`.
- Manual fixture reference: `tqs-reg-fixture-manual-evidence-readiness`, `tqs-route-browser-fixture-owners`, `tqs-fresh-browser-fixture-overlap`.
- Test-plan-header reference: `tqs-reg-mock-regression-determinism`, `tqs-reg-test-plan-header-truth`, `tqs-route-db-invariant-integration`, `tqs-route-form-action-boundary`, `tqs-route-provider-mock-regression`, `tqs-fresh-mock-regression-header-overlap`, `tqs-fresh-schema-header-selection`.
- Mocking/regression reference: `tqs-reg-mock-regression-determinism`, `tqs-route-provider-mock-regression`, `tqs-fresh-mock-regression-header-overlap`.
- Core-only/skip behavior: `tqs-reg-layer-and-behavior-guarantee`, `tqs-reg-verification-coverage-truth`, `tqs-route-nontest-near-miss`, `tqs-fresh-tiny-unit-skip-all`; schema-header case selects header only.
- Safety invariants: lowest layer must prove the real guarantee, mocks cannot remove DB/auth/idempotency subject, browser/manual/fixture/full-suite claims stay truthful, deterministic data and regression linkage remain, header matches actual groups/evidence, and related owner routes stay correct.

### 8.4 `nextjs-server-action-zod` protected mapping

- Schema placement reference covers reusable schema/type ownership cases including `nsaz-reg-authz-state-and-privileged-fields`, `nsaz-reg-formdata-rhf-contract`, `nsaz-reg-schema-type-ownership`, `nsaz-route-db-rpc-contract`, `nsaz-route-schema-only-boundary`, `nsaz-fresh-schema-placement`.
- Action/handler reference covers every action/route/upload/webhook handler case and missing-contract stop case, but is skipped by pure schema, pure UI và pure SQL near misses when no handler boundary exists.
- FormData/RHF reference covers `nsaz-reg-formdata-rhf-contract`, `nsaz-route-form-action-cross-owners`, `nsaz-fresh-formdata-action-test-overlap` and skips JSON/schema/upload/webhook-only cases.
- Upload/webhook/payment reference covers `nsaz-reg-side-effect-order-safe-errors`, `nsaz-reg-upload-file-boundary`, `nsaz-reg-webhook-payment-authenticity`, `nsaz-route-upload-storage-boundary`, `nsaz-route-webhook-payment-boundary`, `nsaz-fresh-upload-webhook-test-overlap`.
- Validation-test reference covers validation-refactor/test-selection cases, including form, upload, webhook, RPC/schema routes; it skips existing-contract action review without a test decision.
- Core-only/near-miss behavior includes `nsaz-route-pure-sql-near-miss` and `nsaz-route-pure-ui-near-miss`; both select no NSAZ reference and do not activate NSAZ.
- Safety invariants: parsed-only data, privileged-field rejection/replacement, auth/permission/state separation, side effects after checks, missing-contract stop, upload path ownership, webhook authenticity/replay/idempotency, stable safe errors and correct cross-owner routing.

## 9. Dependency graph và slicing strategy

```text
Owner approves ASM-PR4 material plan
  → owner grants exact implementation/evaluation/checkpoint permissions
    → re-establish c8e4245 artifact baseline
      → frontend-workflow baseline → migration → verification/comparison/fresh-reader → review/correction → revertible checkpoint
        → test-quality-strategy baseline → migration → verification/comparison/fresh-reader → review/correction → revertible checkpoint
          → nextjs-server-action-zod baseline → migration → verification/comparison/fresh-reader → review/correction → revertible checkpoint
            → cumulative cross-skill validation/integration review
              → owner delivery/PR/CI/merge gates, each separately permissioned
```

Slicing strategy là foundation-first trong phạm vi một PR: mỗi candidate là một complete structural vertical slice có immutable baseline và rollback riêng. Thứ tự roadmap giữ frontend engineering trước test evidence trước high-trust validation boundary. Không chạy song song vì các skill route lẫn nhau, cùng cumulative suite và cùng final progress artifacts.

## 10. Ordered implementation checkpoints

### CP0 — Branch, stale-doc reconciliation và discovery (`complete` for planning)

- Sync `main`, confirm PR #70 merge dependency, create `feat/agent-skills-asm-pr4` from `c8e4245`.
- Reconcile ASM-PR3 current-state docs và relabel roadmap historical snapshots.
- Inspect authoritative plan/roadmap/progress, governance references, three target cores, 9 suite files, runner/validator contracts and Git blobs.
- Run deterministic baseline checks and write/review this plan package.

### CP1 — Owner decision và exact later permission (`complete`)

- Owner approved the material plan on `2026-08-07` and authorized CP2–CP12 local skill implementation, bounded evidence execution, in-scope correction/re-review, coherent local checkpoint commits and one final normal push after CP12 passes.
- Intermediate push, frozen-suite/tooling/CI/package/product/database changes, PR creation/update, CI watch/fix, merge, deployment, force-push, destructive and history actions remain ungranted.
- Existing program authority already covers bounded advisory read-only fresh-reader execution for migration comparison when materially useful/required; no new owner round-trip is needed solely for that bounded action. It does not cover candidate edits, corrections, Git hoặc remote action.
- This exact current owner instruction satisfies the CP2 start gate.

### CP2 — Re-establish immutable baseline and preconditions

- Confirm current branch, clean ownership and exact base ancestry.
- Confirm all 12 blob hashes still match `c8e4245` and no suite/core prerequisite changed.
- Re-run focused/all validation and structural validator; freeze 54 cases and 12 blobs.
- If a suite gap or upstream artifact change exists, stop before migration.

### CP3 — `frontend-workflow` monolith baseline

- Prepare comparison workspace against `c8e4245` with the current monolith as baseline role.
- Execute/evaluate all 19 baseline cases under disclosed equivalent conditions; baseline has no future-reference obligation.
- Record actual access and resource-evidence limitations; keep raw evidence transient.
- Self-review checkpoint; require `0 Critical / 0 Required` before CP4.

### CP4 — `frontend-workflow` structural migration

- Create exactly three approved references; move existing conditional content with minimal heading/link adaptation.
- Add exact direct resource-routing table and all-match rule to core.
- Keep mandatory modes, permission, no-fake-success, contract discovery, async/form minimum, fixture route, stop and reporting behavior in core.
- Validate content equivalence, link/path containment and excluded scope.
- Self-review checkpoint; require `0 Critical / 0 Required` before CP5.

### CP5 — `frontend-workflow` candidate evidence, review and rollback boundary

- Run structural validator, focused/all suite validation, runner/validator tests and hygiene audits.
- Execute all 19 candidate cases; produce complete comparative report with no failed/regressed/materially inconclusive protected case.
- Mandatory fresh-reader gate covers the four `fw-fresh-*` cases with exact core/reference selection and skips.
- Formal main review; correct only in-scope structural findings and rerun invalidated evidence.
- Reach `0 Critical / 0 Required`, then create a coherent independently revertible checkpoint only if owner granted commit permission.

### CP6 — `test-quality-strategy` monolith baseline

- Reconfirm its core/suite blobs against `c8e4245`; prior `frontend-workflow` migration does not replace this baseline.
- Execute/evaluate all 15 baseline cases; no future-reference obligation.
- Self-review checkpoint; require `0 Critical / 0 Required`.

### CP7 — `test-quality-strategy` structural migration

- Create exactly four approved references and direct exact routing.
- Keep lowest-layer, coverage/evidence truth, verification-scope selection, related-owner routing, anti-patterns and checklist in core.
- Preserve browser/fixture/header/mock/regression procedures verbatim-first in their owned references.
- Self-review checkpoint; require `0 Critical / 0 Required`.

### CP8 — `test-quality-strategy` candidate evidence, review and rollback boundary

- Run focused/all validation, structural/hygiene checks and all 15 candidate comparisons.
- Mandatory fresh-reader gate covers all four `tqs-fresh-*` cases, including overlap and skip-all behavior.
- Verify browser/fixture/header/mock physical reference expectations stay TQS-owned even when other skills route.
- Formal main review/correction/reverification; reach `0 Critical / 0 Required` before any owner-authorized checkpoint.

### CP9 — `nextjs-server-action-zod` monolith baseline

- Reconfirm its core/suite blobs against `c8e4245`; prior candidate changes do not become its behavioral baseline.
- Execute/evaluate all 20 baseline cases and disclose actual execution/access limits.
- Self-review checkpoint; require `0 Critical / 0 Required`.

### CP10 — `nextjs-server-action-zod` structural migration

- Create exactly five approved references and direct exact routing.
- Keep parsed-only, auth/permission/state separation, side-effect order, privileged-field, business/security, Supabase-order, safe-error and stop invariants in core.
- Do not weaken upload/webhook/payment authenticity or DB/RLS separation while moving detailed procedures.
- Self-review checkpoint; require `0 Critical / 0 Required`.

### CP11 — `nextjs-server-action-zod` candidate evidence, review and rollback boundary

- Run focused/all validation, structural/hygiene checks and all 20 candidate comparisons.
- Mandatory fresh-reader gate covers all five `nsaz-fresh-*` cases, including multi-reference overlaps and existing-contract skip behavior.
- Formal integration review traces parse → auth → permission/state → side effect → safe result and verifies reference selection does not hide trust-boundary rules.
- Correct only in-scope structural findings; reach `0 Critical / 0 Required` before any owner-authorized checkpoint.

### CP12 — Cumulative final review and documentation reconciliation

- Run validator tests `37/37`, runner tests `130/130`, structural validator, three focused validations and `validate --all`.
- Audit 15-file target bundle shape: three cores + 12 direct regular-file references.
- Confirm all nine suite files unchanged from `c8e4245`; no tooling/CI/product/DB/other-skill diff.
- Review cumulative cross-skill routing, overlap and physical ownership; one skill's pass cannot offset another's issue.
- Reconcile plan/brief/progress only with actual evidence.
- Final main review and correction loop continues until `0 Critical / 0 Required` or stops `Blocked`.

### CP13 — Owner delivery boundary

- Report exact commits, files, checks, semantic/fresh-reader evidence, claim limits, rollback and remaining permission state.
- Delivery action occurs only under exact current owner instruction. Normal push does not imply PR; PR/CI/merge remain separate gates.
- ASM-PR5A remains blocked until ASM-PR4 is merged.

## 11. Acceptance criteria

1. Branch/base/dependency evidence remains exact and auditable.
2. `frontend-workflow` bundle contains one core + exactly 3 approved references.
3. `test-quality-strategy` bundle contains one core + exactly 4 approved references.
4. `nextjs-server-action-zod` bundle contains one core + exactly 5 approved references.
5. All 12 references have demonstrated consumers, exact pre-decision read conditions, meaningful skip groups, direct contained regular-file links and no nested routing.
6. Core-only review for each skill can decide activation, owner routes, permission/safety/evidence boundaries, every matching reference, stop and report behavior.
7. Existing conditional procedure content moves without material rewrite, loss, conflicting duplication or new behavior.
8. All 9 suite definitions and 54 cases remain byte-identical to `c8e4245`.
9. Structural validator has `0 errors`; warning delta is explained and not used as behavior proof.
10. Each focused suite remains valid at `19`, `15` and `20` cases; cumulative validation remains `9 / 27 / 177 / 0` unless an independently merged prerequisite is reconciled first.
11. Validator and runner black-box suites pass; no CI/tooling/package/product/DB diff exists.
12. Each candidate comparison has complete evidence; no material case is failed/regressed or materially `inconclusive`; no safety veto fires.
13. All 13 committed fresh-reader cases pass with exact matching selection/skip behavior and truthful access disclosure.
14. `available`, `supplied`, `read` and `unknown` remain distinct; self-report is never upgraded to runtime enforcement.
15. No raw evidence, secret, credential, transcript, bundle copy, workspace metadata or absolute temp path is committed.
16. Per-skill formal review reaches `0 Critical / 0 Required` before the next skill starts.
17. Final cumulative review reaches `0 Critical / 0 Required` after any authorized correction.
18. Documentation records only actual state and keeps plan approval, implementation, commit, push, PR, CI and merge permissions separate.

## 12. Verification và evidence matrix

| Layer | Check | Required outcome |
| --- | --- | --- |
| Frozen artifacts | blob/hash + diff audit against `c8e4245` | 3 original cores and 9 suite files match baseline before active migration; suites remain unchanged throughout |
| Structural tooling | `node --test .agents/scripts/validate-skill.test.mjs` | pass, expected current baseline `37/37` |
| Eval tooling | `node --test .agents/scripts/run-skill-evals.test.mjs` | pass, expected current baseline `130/130` |
| Bundle structure | `node .agents/scripts/validate-skill.mjs` | valid, 0 errors, warning delta explained |
| Focused suite | `validate --skill <candidate>` | valid: 19 / 15 / 20 cases, 0 diagnostics |
| Cumulative suite | `validate --all` | valid, expected current `9/27/177/0` |
| Markdown/path/content | direct links, containment, regular-file/reparse, UTF-8/no-BOM, newline, fence/table and moved-content audits | pass |
| Semantic behavior | complete base-versus-candidate report for every case | no failed/regressed/materially inconclusive protected case |
| Fresh reader | 4 + 4 + 5 committed fresh-reader cases | pass with exact matching selections/skips |
| Resource evidence | observation-bound `skill_resource_access` | exact disclosed evidence or honest `unknown`; no inferred enforcement |
| Source scope | suite/tooling/CI/product/DB/other-skill diff | empty |
| Git hygiene | status, staged/unstaged/untracked audit, `git diff --check` | exact owned scope only |

Không chạy product Vitest, build, browser, E2E hoặc database reset chỉ để chứng minh structural skill migration; các check đó không trực tiếp bảo vệ skill contract. Nếu discovery khi implementation cho thấy real product/tooling/DB boundary change, đó là scope conflict và phải dừng.

## 13. Semantic comparison và fresh-reader procedure

Cho từng candidate:

1. prepare một comparative workspace từ current tree với `--baseline-ref c8e4245f7fb8337063e2ef2a4e0d5120f6427556`;
2. pin suite/criteria/context từ one validated current-tree capture; ref chỉ chọn skill bundle;
3. execute opaque baseline/candidate roles với equivalent prompt/context, same model class và disclosed actual access;
4. không cung cấp evaluator criteria, expected answer, other variant output hoặc role identity cho executor;
5. preserve raw observation verbatim; human/main reviewer mới đề xuất semantic status;
6. runner chỉ validate/aggregate, không grade hoặc choose winner;
7. record optional observation-bound resource evidence; missing optional evidence để `unknown`, present invalid evidence là hard failure;
8. compare formal baseline with any earlier pre-migration snapshot; unexplained material drift là `inconclusive`;
9. keep full raw evidence transient; commit only concise owner-approved status summary nếu later instruction cho phép.

Fresh-reader observation phải thực sự không nhận author conclusion, expected answer hoặc full authoring context. Instruction-bounded context không phải filesystem isolation. Nếu không có valid executor/context hoặc equivalent conditions, record `not_run`/`Blocked`; không thay bằng self-review.

## 14. Risks, mitigations và earliest detection

| Risk | Tác động | Mitigation | Earliest gate |
| --- | --- | --- | --- |
| Mandatory rule bị move khỏi core | permission/safety/routing regression | mandatory-core inventory + core-only review + safety veto | CP4/CP7/CP10 |
| Exact read condition load thiếu/thừa reference | hidden behavior hoặc context overreach | committed selection/skip mapping + all-match routing + fresh readers | active migration/fresh gate |
| TQS procedure split làm false evidence claim | owner nhận sai coverage/readiness | evidence rules stay core + browser/fixture/header cases | CP7/CP8 |
| NSAZ split che auth/side-effect invariants | unsafe mutation/trust-boundary regression | keep invariants core + integration trace + safety veto | CP10/CP11 |
| Suite bị sửa để candidate pass | invalid oracle | blob freeze and suite diff empty | CP2 onward |
| Later candidate dùng prior working tree làm baseline | comparison không còn độc lập | pin every baseline to `c8e4245` | CP6/CP9 |
| Cross-skill route bị hiểu thành cross-bundle physical read | load unrelated references | suite contract says physical ownership is evaluated-bundle-local | per-skill and CP12 |
| Execution conditions khác nhau | false improvement/equivalence | same model/package/policy, disclose variance, block material variance | semantic comparison |
| `available` bị suy ra thành `supplied/read` | false context claim | observation-bound artifact or `unknown` | evidence capture |
| Structural move thành wording cleanup | semantic drift khó review | verbatim-first move, minimal headings/links, content audit | active migration |
| Raw evidence bị commit | secret/noise/provenance leak | transient workspace + exact Git artifact audit | every checkpoint/CP12 |
| Một skill fail nhưng batch tiếp tục | unsafe rollout/rollback coupling | sequential hard gate; no offsetting passes | CP5/CP8/CP11 |
| Planning approval bị hiểu là implementation authority | unauthorized edits/actions | explicit approved brief and exact permission table | CP1 |

## 15. Rollback và stop boundaries

- Trước commit: correct only active candidate files under exact owner permission; không dùng destructive Git recovery.
- Sau owner-authorized checkpoint: rollback bằng new explicit correction/revert boundary cho đúng candidate core + references; không revert suites/tooling hoặc other candidate.
- Không amend/squash/rebase/reset/force-push/delete branch nếu owner chưa cấp exact permission.
- Stop affected candidate ngay khi có suite gap, artifact drift, material behavior regression, safety veto, material `inconclusive`, wrong/missing reference selection, mandatory rule unavailable from core, unknown ownership, tooling/CI need hoặc scope expansion.
- Stop whole ASM-PR4 nếu shared baseline/order/permission conflict hoặc cumulative review phát hiện cross-skill regression không thể sửa cục bộ.
- `not_run` không phải pass. Mandatory semantic/fresh-reader evidence không chạy hợp lệ thì candidate status là `Blocked`.

## 16. Documentation và progress tracking

Update points:

- CP0: register plan/brief, branch/base, stale-doc reconciliation, discovery, deterministic baseline, current permission and planning review.
- CP1: explicit owner decision đã được record; `approved` chỉ áp dụng cho exact current boundary.
- CP2–CP12: record only actual blobs, commands, observations, findings, commits and status after they occur.
- CP13: record exact delivery state; không dự đoán commit/PR/run identifiers.

Status vocabulary:

```text
not started
pending owner review
approved
in progress
blocked
implemented
automated checks passed
semantic comparison passed
fresh-reader passed
review passed
committed
pushed
PR open
merged
```

## 17. Plan self-review

Main-agent self-review phải kiểm tra:

- exact owner intent, exclusions và planning/Git permissions;
- ASM-PR3 merge dependency, branch baseline và 12 artifact hashes;
- approved candidate/order/target bundle từ roadmap;
- mandatory core versus conditional reference ownership;
- exact 54-case frozen counts và selection/skip coverage;
- per-skill baseline, correction, review, commit and rollback independence;
- observable acceptance/verification and semantic claim limits;
- no hidden suite/tooling/CI/product/DB/ASM-PR5 scope;
- no agent-authored implementation authority or remote permission;
- no stale current-state or future-completion claim.

Planning-package self-review ngày `2026-08-07`:

- Review range: toàn bộ 7-file planning scope, gồm stale ASM-PR3 reconciliation, roadmap snapshot relabel, README index, ASM-PR4 plan/brief và current progress.
- Initial finding: `0 Critical / 1 Required`. Draft ban đầu vừa ghi program-level fresh-reader authority đã tồn tại, vừa yêu cầu owner cấp lại semantic/fresh-reader permission ở CP1.
- Resolution: bỏ permission gate lặp; ghi rõ bounded advisory read-only fresh-reader execution đã được program authorize, còn candidate edits, corrections, Git và remote actions vẫn cần permission riêng.
- Re-review: `0 Critical / 0 Required`; không có remaining `Suggestion` hoặc `Nit` cần thay đổi.
- Deterministic evidence: validator `37/37`; runner `130/130`; structural `11/0/4`; focused `19/15/20`; cumulative `9/27/177/0`.
- Document audits: exact 7-file scope, relative links, UTF-8/no-BOM, final newline, balanced fences, exact 12-reference catalog, zero-width, secret/conflict-marker scan và `git diff --check` đều pass.
- Historical verdict tại planning checkpoint: package ready for final cumulative review and owner-review delivery; material plan decision lúc đó còn `pending owner review`.

Final cumulative planning review ngày `2026-08-07`:

- Baseline/range: `c8e4245` to complete 7-file working-tree planning diff on `feat/agent-skills-asm-pr4`.
- Findings: `0 Critical / 0 Required`; no remaining non-blocking finding requires correction.
- Branch/dependency: `HEAD == main == origin/main == merge-base == c8e4245` before the planning commit; ASM-PR3 head `1301ed6` is an ancestor of `origin/main`.
- Frozen scope: all 3 target cores and 9 suite files match `c8e4245`; case counts remain `19/15/20`; skill/eval/script/CI/product/DB diff counts are zero.
- Document integrity: exact scope, relative links, UTF-8/no-BOM, final newline, balanced fences, zero-width, secret/conflict-marker, stale-current-state and false-approval scans pass; `git diff --check` pass.
- Historical final verdict tại planning checkpoint: `Approved` for the owner-authorized planning checkpoint commit and normal push only. Owner sau đó cấp exact CP2–CP12 permission ngày `2026-08-07`; planning verdict tự nó không cấp implementation hoặc remote action.

Specialist decision: `0`. No unresolved material uncertainty remains after repository discovery; plan size, three candidates and trust-boundary skill activation alone do not justify specialist execution. Fresh-reader for planning is `not_run`; direct deterministic evidence is sufficient, while fresh-reader becomes mandatory for later migration execution.

## 18. Transferable implementation brief

### Approved goal

Owner-approved: structurally migrate only `frontend-workflow`, `test-quality-strategy` and `nextjs-server-action-zod` into their exact approved core/reference bundles, sequentially, without behavior change.

### Confirmed behavior

- Frontend workflow keeps no-fake-success, recoverable async/form state, contract discovery and truthful QA/reporting.
- Test strategy keeps lowest-layer guarantee, real-subject mocking, fixture readiness and exact evidence claims.
- NSAZ keeps parsed-only data, privileged-field protection, auth/permission/state separation, side-effect order, authenticity and safe errors.

### Dependencies and order

Merged ASM-PR3 `c8e4245` baseline → owner plan approval → exact implementation/evaluation/Git permissions → FW → TQS → NSAZ → cumulative review → separate delivery gates.

### Expected files

Only three target cores, 12 approved references and exact ASM-PR4 plan/brief/progress reconciliation.

### Forbidden files/domains

Frozen suites, scripts/tooling/tests, AGENTS/lifecycle, other skills, CI/package, product code/tests/fixtures and database/Supabase artifacts.

### Automated verification

Validator `37/37`, runner `130/130`, structural validator, focused `19/15/20`, cumulative `9/27/177`, link/path/content/hygiene audits and `git diff --check`.

### Semantic verification

All 54 base/candidate cases, all 13 committed fresh-reader cases, exact resource evidence, per-skill formal review and final cumulative integration review.

### Known limitations

Synthetic packaging is not isolation; exact reads may be self-reported; no token-saving/native-trigger claim. Current owner instruction grants only CP2–CP12 local implementation/evidence/checkpoint work and one final normal push after the final gate; all other remote actions remain ungranted.
