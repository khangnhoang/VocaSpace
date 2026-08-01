# ASM-PR2C — Bản tóm tắt để owner duyệt

Status: `pending owner decision`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface ngắn gọn, không thay thế detailed plan. Main self-review, planning commit và normal push không phải owner approval và không cấp quyền triển khai suite.

## Dependency và baseline

- Branch: `feat/agent-skills-asm-pr2c`.
- Baseline: `d61d64124ce8adb8f57b835ef4f8d95d787679ea`.
- PR #66 / ASM-PR2B: `MERGED`.
- PR #66 head: `367653d7ec768683bdd73864d4701e309a726dfc`.
- PR #66 merge commit: `d61d64124ce8adb8f57b835ef4f8d95d787679ea`.
- Sau sync: local `main`, refreshed `origin/main` và actual remote `main` cùng SHA, divergence `0/0`.
- Branch mới được tạo trực tiếp từ synchronized local `main`, không stack trên feature branch cũ.
- Starting evaluation baseline: `5 configured skills / 15 suite files / 94 cases / 0 diagnostics`.

## Quyết định cần owner xem xét

Đề xuất triển khai sau khi được duyệt:

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
- `db-risk`, `secret-env-config`, `infra-flaky`, `unrelated-main`, `branch-caused-large-risky`, `unclear` đều có neutral executor-visible failure evidence riêng và đều stop;
- chỉ `branch-caused-small-safe` có package đủ exact combined-mode/existing-PR-check/read-log evidence để vào bounded self-fix;
- merge/auto-merge cần explicit current-task permission và mọi safety gate pass.

## Ranh giới kiến trúc suite

Mỗi case có đúng một primary suite owner. Related skills có thể là required routes, nhưng suite của skill X chỉ được áp đặt future physical-reference selection/read/skip cho bundle X.

Mỗi case cũng freeze một exact neutral `executor_input.prompt`. Prompt cùng exact context/fact package và requested execution policy là toàn bộ executor-visible task contract; case ID, table heading, expected route/reference, veto, conclusion và variant identity không được dùng làm evidence. Audit correction đã xác nhận đủ `83/83` unique prompts.

Monolithic baseline chỉ được chấm current behavior; không phải chọn hoặc đọc reference tương lai chưa tồn tại. Migrated candidate phải chọn/skip tất cả và chỉ các reference matching của chính bundle đó.

Một candidate pass không bù được permission, routing, authority hoặc safety failure của candidate khác.

## Future checkpoints và rollback

1. CP0 — baseline/dependency/branch/authority: complete.
2. CP1 — owner decision và explicit implementation permission: pending.
3. CP2 — planning trio `8/6/4`; focused verify/review; independent rollback.
4. CP3 — review trio `9/6/5`; focused verify/review; independent rollback.
5. CP4 — local Git trio `10/6/5`; focused verify/review; independent rollback.
6. CP5 — GitHub/CI trio `11/7/6`; focused verify/review; independent rollback.
7. CP6 — cumulative 12-file/83-case verification, CI-no-change, final reconciliation.

Order này đi theo dependency thực: planning → review → local Git → GitHub/CI. Không có checkpoint commit nào được tự động suy ra; commit/push của future implementation cần permission riêng.

## Scope nếu owner duyệt implementation sau này

Implementation cần đúng 12 suite files:

```text
.agents/evals/implementation-planning-and-pr-breakdown/{regression,routing,fresh-reader}.json
.agents/evals/code-review-and-quality/{regression,routing,fresh-reader}.json
.agents/evals/git-checkpoint-workflow/{regression,routing,fresh-reader}.json
.agents/evals/github-pr-ci-workflow/{regression,routing,fresh-reader}.json
```

CP2–CP6 cũng cần quyền cập nhật truthful durable state trong đúng ba files:

```text
docs/agent-skills/implementation-plans/asm-pr2c/plan.md
docs/agent-skills/implementation-plans/asm-pr2c/owner-review-brief.md
docs/agent-skills/progress.md
```

`docs/agent-skills/implementation-plans/README.md` là audit-only sau registration hiện tại và chỉ được đổi nếu một layout/index fact thật sự thay đổi.

Không sửa candidate skills/references, runner/schema/validator/tests, CI, package, product, migration, seed hoặc database. Không chạy model, product tests, integration/build/browser/DB commands. Không tạo PR, watch/fix CI, merge hoặc rewrite history nếu không có quyền riêng.

## Verification contract

Planning delivery dùng current cumulative validation và focused document/scope audits. Runner/structural-validator test suites là `not_run` vì plan không phụ thuộc behavior mới ngoài synchronized baseline và direct source inspection.

Future implementation phải chạy per-skill validation ở từng checkpoint và cumulative `validate --all`, cùng audits cho exact IDs/counts/order, routes, future references, context paths, evaluator secrecy, baseline/candidate applicability, UTF-8/newlines, Markdown hygiene, exact diff scope và `git diff --check`.

## Review và evidence limitation

- Initial main adversarial plan review: first pass `0 Critical / 11 Required`; all supported findings corrected without changing 83 cases; re-review `0 Critical / 0 Required`.
- External-finding correction review: `0 Critical / 4 Required / 1 Nit`. Claims A–E đều `correct in scope`; exact prompts, three missing CI facts, future write contract và duplicate progress paragraph được sửa; final re-review `0 Critical / 0 Required`.
- Specialist: `0`.
- Fresh-reader: `not_run`; current correction instruction cấm model execution/semantic grading, còn direct repository evidence đủ cho main review mà không nâng claim thành fresh-reader evidence.
- Không có model execution hoặc semantic grading.
- Planning artifacts chỉ định nghĩa future suite contract; không chứng minh executor behavior, native activation, resource read hoặc migration safety.

## Quyết định nhỏ nhất cần từ owner

Owner chọn một trong ba hướng cho exact 83-case plan:

1. approve;
2. request material revisions;
3. reject.

Nếu approve và muốn triển khai ngay ở task sau, owner cần cấp riêng explicit permission cho CP2–CP6, exact twelve-suite files cùng truthful three-document reconciliation scope, checkpoint commit boundaries và normal push state mong muốn. `README.md` vẫn audit-only trừ khi index fact thật sự đổi.

Hiện tại: `pending owner decision`; suite implementation `not started` và không được task này authorize.
