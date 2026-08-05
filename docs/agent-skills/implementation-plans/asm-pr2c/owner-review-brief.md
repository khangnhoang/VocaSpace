# ASM-PR2C — Bản tóm tắt để owner duyệt

Status: historical ASM-PR2C implementation/delivery complete; PR #67 `MERGED` at `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb`; final head `9ff1a16a6619a1d9bd69ac43aac6638be2471a20` passed run `30877858346`. The exact 20-case cumulative-correction transition starts from local final audit on `audit/agent-skills-pr2abc-eval-contracts` and conditionally delivers after the `0/0` gate; Git/GitHub/PR body/final report own its exact post-delivery evidence.

Detailed specification: [plan.md](./plan.md).

Brief này là historical decision surface ngắn gọn, không thay thế detailed plan. Owner đã duyệt exact 83-case plan; CP2–CP6, semantic correction và final docs delivery đã hoàn tất trước khi PR #67 merge. Current instruction cấp exactly one commit, normal initial push, non-draft PR creation và initial CI watch only after final `0 Critical / 0 Required` plus passing verification. At most one CI fix attempt requires failed logs confirming `branch-caused-small-safe`. Successful delivery consumes this authority; merge/auto-merge và unrelated high-risk actions remain ungranted.

## Dependency và baseline

- Branch: `feat/agent-skills-asm-pr2c`.
- Baseline: `d61d64124ce8adb8f57b835ef4f8d95d787679ea`.
- PR #66 / ASM-PR2B: `MERGED`.
- PR #66 head: `367653d7ec768683bdd73864d4701e309a726dfc`.
- PR #66 merge commit: `d61d64124ce8adb8f57b835ef4f8d95d787679ea`.
- Sau sync: local `main`, refreshed `origin/main` và actual remote `main` cùng SHA, divergence `0/0`.
- Branch mới được tạo trực tiếp từ synchronized local `main`, không stack trên feature branch cũ.
- Starting evaluation baseline: `5 configured skills / 15 suite files / 94 cases / 0 diagnostics`.

## Allocation đã được owner duyệt

Allocation đã triển khai:

| Candidate | Regression | Routing | Fresh-reader | Total |
| --- | ---: | ---: | ---: | ---: |
| `implementation-planning-and-pr-breakdown` | 8 | 6 | 4 | 18 |
| `code-review-and-quality` | 9 | 6 | 5 | 20 |
| `git-checkpoint-workflow` | 10 | 6 | 5 | 21 |
| `github-pr-ci-workflow` | 11 | 7 | 6 | 24 |
| Total | 38 | 25 | 20 | 83 |

Phân bổ không đối xứng vì mỗi candidate có mật độ behavior/risk khác nhau. GitHub/CI cao nhất do các permission mode, initial push, failed-log classification, bounded self-fix, attempt limit và merge gate là những trạng thái độc lập; planning thấp hơn vì bốn reference tương lai tạo ít boundary độc lập hơn.

## Behavior bắt buộc giữ

### Planning

- discovery/planning-only không tự chuyển thành implementation;
- agent-authored material plan là draft tới khi owner quyết định;
- plan approval, implementation, commit, push, PR, merge và remote action là các gate riêng;
- tracked plan/brief/progress phải reconcile theo source ownership và Git/GitHub evidence;
- facts, assumptions, conflicts, dependency, sizing, scope, acceptance, verification, QA và stop behavior phải rõ;
- specialist mặc định `0`, chỉ dùng sau main review và bounded gate.

### Review

- mặc định read-only;
- `Critical`/`Required` vẫn blocking; verification status và verdict giữ đúng nghĩa;
- approval/confidence/test/verdict không cấp quyền action;
- manual QA còn thiếu chỉ cho phép limited verdict;
- correction phải được re-review bằng diff/evidence hiện tại;
- specialist package giữ fixed context, một risk cluster, read-only, no delegation và main reconciliation.

### Local Git

- base/dependency/dirty-tree ownership và fast-forward-only safety;
- explicit stage/commit permission, exact diff và secret audit;
- commit không bao gồm push;
- normal push cần quyền riêng và remote state rõ;
- correction mặc định dùng commit mới;
- amend/squash/rebase/reset/force-push/destructive recovery/branch deletion là permission riêng.

### GitHub/CI

- `inspect-only`, `watch-only`, PR-only, combined mode và explicit-fix-only không tự mở rộng;
- PR-only và combined mode không cấp initial push;
- self-fix chỉ cho exact `branch-caused-small-safe` sau existing PR/check + read logs + combined permission;
- tối đa hai completed self-fix attempts nếu không có quyền mới;
- `db-risk`, `secret-env-config`, `infra-flaky`, `unrelated-main`, `branch-caused-large-risky`, `unclear` đều có separate neutral executor-visible failed-log evidence và đều stop;
- với cả sáu stop class này, không được edit, validation-as-fix, commit, push, mutate PR, re-watch sau fix, merge hoặc thực hiện self-fix khác; chỉ `branch-caused-small-safe` có thể eligible;
- chỉ `branch-caused-small-safe` có package đủ exact combined-mode/existing-PR-check/read-log evidence để vào bounded self-fix;
- merge/auto-merge cần explicit current-task permission và mọi safety gate pass.

## Ranh giới kiến trúc suite

Mỗi case có đúng một primary suite owner. Related skills có thể là required routes, nhưng suite của skill X chỉ được áp đặt future physical-reference selection/read/skip cho bundle X.

Mỗi trong 83 case ID map chính xác một lần tới một frozen, sufficient, evaluator-answer-free `executor_input.prompt`. Prompt cùng exact context/fact package và requested execution policy là toàn bộ executor-visible task contract; case ID, table heading, expected route/reference, veto, conclusion và variant identity không được dùng làm evidence. Prompt string không bắt buộc globally unique; duplicate chỉ hợp lệ khi phần executor-visible package còn lại thật sự phân biệt case. Cả 83 prompt string hiện tại được giữ nguyên.

Monolithic baseline chỉ được chấm current behavior; không phải chọn hoặc đọc reference tương lai chưa tồn tại. Migrated candidate phải chọn/skip tất cả và chỉ các reference matching của chính bundle đó.

Một candidate pass không bù được permission, routing, authority hoặc safety failure của candidate khác.

## Delivery checkpoints và rollback

1. CP0 — baseline/dependency/branch/authority: complete.
2. CP1 — owner decision và explicit implementation permission: complete.
3. CP2 — planning trio `8/6/4`: complete and normal-pushed at `ce5068e260a2a323f5936b0b4890fb59265f425a`; synchronized `0/0`, clean.
4. CP3 — review trio `9/6/5`: complete and normal-pushed at `0ec7ea1e73dbad7ecd015422efb3df7b2d8b428d`; synchronized `0/0`, clean.
5. CP4 — local Git trio `10/6/5`: complete and normal-pushed at `22240314d2177b7eda58d3740ae9f1d07e5105fd`; synchronized `0/0`, clean.
6. CP5 — GitHub/CI trio `11/7/6`: complete and normal-pushed at `17d2b68839e0a8e0adeaae10612000180ab67d86`; synchronized `0/0`, clean.
7. CP6 — exact 12 files/83 cases cumulative validation/audit, final re-review, reconciliation commit và normal push complete tại `fe4c1e1eed121a1a90447164940961da5d22cb05`.

Order này đi theo dependency thực: planning → review → local Git → GitHub/CI. Historical checkpoint, semantic-correction và finalization delivery permissions đều đã consumed trước khi PR #67 merge. Current cumulative grant là một transition contract mới, conditionally authorizes delivery only after the final `0/0` gate, và được consumed khi delivery thành công; nó không cấp merge/auto-merge hoặc standing authority.

Sau CP6, PR #67 được tạo từ `feat/agent-skills-asm-pr2c` vào `main`. Historical semantic correction head `5185b8da0988377a417dba9803ac99fa86fdb4eb` có run `30876909878` terminal passing. Final docs head `9ff1a16a6619a1d9bd69ac43aac6638be2471a20` sau đó pass run `30877858346`, và PR #67 merge tại `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb`. Không có CI self-fix attempt nào được dùng.

Trong CP2–CP5, tên trio chỉ là suite implementation boundary của checkpoint đó. Historical CP2–CP6 permission đã cho phép reconcile truthful state trong đúng `plan.md`, `owner-review-brief.md`, và `progress.md`; không candidate trio nào khác được sửa, README vẫn audit-only nếu index fact không đổi, và mỗi checkpoint vẫn independently revertible. Current cumulative correction giữ nguyên 83 case IDs/prompts/routes/reference applicability; current conditional delivery authority đến từ exact owner instruction mới, không phải kế thừa grant cũ.

## Owner-approved implementation scope

Implementation cần đúng 12 suite files:

```text
.agents/evals/implementation-planning-and-pr-breakdown/{regression,routing,fresh-reader}.json
.agents/evals/code-review-and-quality/{regression,routing,fresh-reader}.json
.agents/evals/git-checkpoint-workflow/{regression,routing,fresh-reader}.json
.agents/evals/github-pr-ci-workflow/{regression,routing,fresh-reader}.json
```

CP2–CP6 được cấp quyền cập nhật truthful durable state trong đúng ba files:

```text
docs/agent-skills/implementation-plans/asm-pr2c/plan.md
docs/agent-skills/implementation-plans/asm-pr2c/owner-review-brief.md
docs/agent-skills/progress.md
```

`docs/agent-skills/implementation-plans/README.md` là audit-only sau registration hiện tại và chỉ được đổi nếu một layout/index fact thật sự thay đổi.

Không sửa candidate skills/references, runner/schema/validator/tests, CI, package, product, migration, seed hoặc database. Không chạy model, product tests, integration/build/browser/DB commands. Không tạo PR, watch/fix CI, merge hoặc rewrite history nếu không có quyền riêng.

## Verification contract

Historical PR2C checkpoint không chạy local runner/structural-validator test suites vì không đổi tooling behavior; GitHub Actions của final PR head sau đó pass cả hai test steps. Current cumulative correction đã chạy local runner `130/130`, structural validator tests `37/37`, cumulative `9/27/177`, và repository validator `0 errors / 4` existing warnings; không có model execution hoặc semantic grading.

Implementation đã chạy per-skill validation ở từng checkpoint và cumulative `validate --all`, cùng audits cho exact IDs/counts/order, routes, future references, context paths, evaluator secrecy, baseline/candidate applicability, UTF-8/newlines, Markdown hygiene, exact diff scope và `git diff --check`.

## Review và evidence limitation

- Initial main adversarial plan review: first pass `0 Critical / 11 Required`; all supported findings corrected without changing 83 cases; re-review `0 Critical / 0 Required`.
- External-finding correction review: `0 Critical / 4 Required / 1 Nit`. Claims A–E đều `correct in scope`; exact prompts, three missing CI facts, future write contract và duplicate progress paragraph được sửa; final re-review `0 Critical / 0 Required`.
- Remaining-finding correction review: `0 Critical / 3 Required / 1 Suggestion`. Claims A–D đều `correct in scope`; chỉ hai tracked-plan rows bỏ `P-HANDOFF`, CP2–CP6 scope được làm rõ, six-class CI stop/no-self-fix contract được hoàn chỉnh, và prompt uniqueness được hạ đúng thành mapping/sufficiency policy mà không sửa prompt. Final re-review `0 Critical / 0 Required`.
- CP2–CP5 focused validators: exact `18/20/21/24`, mỗi skill 3 files và 0 diagnostics; mỗi checkpoint formal review `0 Critical / 0 Required`, committed, normal-pushed, synchronized `0/0`, clean.
- Pre-semantic-correction CP6 cumulative validator: `9 skills / 27 files / 177 cases / 0 diagnostics`; frozen-contract audit pass exact `12 files / 83 cases / 38 regression / 25 routing / 20 fresh-reader`, prompts/packages/reference applicability `83/83`, routes `25/25`, contexts `47/47`, physical ownership, secrecy, P0, identity/order/UTF-8, exact scope và empty CI diff.
- CP6 adversarial review: initial `0 Critical / 1 Required` vì duplicate implementation-created veto ID; smallest correction đổi review veto ID thành `crq-approval-any-ungranted-action`; full rerun và final review `0 Critical / 0 Required`.
- Runner/validator tests: `not_run` vì không có unestablished tooling behavior; model execution `not_run` theo exact task limit.
- Specialist: `0`.
- Fresh-reader: `not_run`; exact task cấm model execution, còn deterministic repository/package evidence đủ cho main review mà không nâng claim thành fresh-reader evidence.
- Không có model execution hoặc semantic grading.
- Suite definitions và deterministic validation không tự chứng minh model behavior, native activation hoặc observed resource reads.
- Historical pre-merge semantic audit corrected 25 routing polarities and nine substantive packages, then reported context catalog `53/53`; those claims remain head-scoped historical evidence.
- Current cumulative correction replaces the two contradictory pending-plan packages with a consistent synthetic checkpoint and rewrites 16 `P0` cases so evaluators require procedural reasoning, an explicit no-run statement, exact missing execution evidence, and a fabricated-execution veto. All 83 PR2C case IDs/prompts/routes/reference applicability remain unchanged; the catalog remains `53/53` because one stale repository context was replaced by one neutral inline fact.
- Current verification: focused PR2C skills `18/20/21/24`, cumulative `9 skills / 27 files / 177 cases / 0 diagnostics`, runner `130/130`, structural tests `37/37`, repository validator `0 errors / 4` existing warnings, semantic invariant audit pass, and synthetic preparation pass for all four PR2C owners. `code-review-and-quality` is included because its unchanged suites package the corrected durable status sources. Synthetic packaging is not enforced isolation; the runner did not execute or grade a model.

## Cumulative correction delivery transition

PR #67 đã merge; historical finalization authority không còn mở. For the current correction, this section records a transition rather than predicting its final SHA: pre-delivery it is local and under final audit; after a passing `0/0` gate, one commit, normal push, non-draft PR and initial CI watch may run, with at most one logged `branch-caused-small-safe` fix attempt. Successful delivery consumes the grant; Git/GitHub/PR body own exact post-delivery evidence. Merge/auto-merge, database, deployment, destructive, force-push, history-rewrite and scope-expansion actions remain ungranted.
