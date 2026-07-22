# AW-PR3A Implementation Plan — Specialist review orchestration

## 1. Trạng thái và quyền hạn

| Trường | Giá trị |
| --- | --- |
| Trạng thái plan | `approved` — owner instruction ngày 2026-07-22 phê duyệt discovery contract và yêu cầu triển khai end-to-end |
| Quy mô cuối | Lớn/rủi ro cao (`Large/high-risk`) — thay lifecycle, permission-sensitive orchestration và evidence claims |
| Branch | `feat/agent-workflow-aw-pr3a` |
| Baseline | synchronized local `main == origin/main == 2b485c13c0fdbb5e4f3865d71b80a903c587b9fc` |
| Dependency | AW-PR2 merged qua PR #59 tại `18f9cbb77c4e5ca0a379bf943ebc509e687999d8`; dependency head `e7f2a2c96c7b1632f73211b6b321b64349fcec34` nằm trong baseline |
| Được phép | sync local `main`, tạo branch, lập plan/brief, implement exact scope, sửa finding trong scope, verification, stage và một local commit |
| Không được phép | push, tạo/cập nhật PR, CI watch/fix, merge, force-push, branch deletion, specialist/sub-agent/fresh-reader executor, production/DB/deployment/remote mutation |
| Structural constraint | sửa trực tiếp existing `SKILL.md`; không tạo/tách/đổi tên/di chuyển reference |

Instruction hiện tại đồng thời xác nhận các material decision đã discovery: AW-PR3A là một implementation PR độc lập sau AW-PR2; chấp nhận warning `CORE_LENGTH_SIGNAL` thứ tư cho `code-review-and-quality`; cho phép test-support snapshot đổi từ ba sang bốn warning; không đổi validator hoặc threshold. Plan này ghi lại contract đó, không tự mở thêm permission.

## 2. Mục tiêu

Main agent có một workflow thống nhất để quyết định khi nào plan hoặc implementation cần specialist review, giới hạn context/quota trước khi gọi, giữ reviewer read-only và reconcile findings bằng evidence thay vì majority vote.

AW-PR3A chỉ xây orchestration foundation. AW-PR3B mới sở hữu exact hard/conditional signals trong từng domain skill.

## 3. Hiện trạng repository đã xác nhận

- `docs/agent-loops.md` sở hữu lifecycle gate và universal minimum review nhưng chưa route main integration/specialist depth.
- `implementation-planning-and-pr-breakdown` có durable-plan self-review và feedback reconciliation nhưng chưa có plan-specialist decision/package route.
- `code-review-and-quality` chỉ có một đoạn ngắn “Multiple reviewers or models”; chưa có activation, quota, bounded package, reviewer stop/output hoặc claim-label contract.
- `maintain-repo-skills` giữ permission/evidence boundary; manual fresh-reader procedure yêu cầu executor hợp lệ và không cho dùng self-review thay thế.
- `code-review-and-quality/SKILL.md` hiện có 465 dòng; contract mới dự kiến vượt non-blocking threshold 500 dòng.
- Validator hiện `valid` với ba `CORE_LENGTH_SIGNAL`; current-repository test snapshot khóa ordered `(skill, code)` list.
- `AGENTS.md` đã route planning, review, test, Git và repo-skill governance; không cần root edit.
- Không có AW-PR3A problem record; không tạo problem/ADR/reference mới.

## 4. Confirmed requirements

1. Small task dùng main-agent minimum review và không spawn specialist.
2. Mặc định `0 specialist`; activation xảy ra sau main self-review, không xảy ra chỉ vì domain skill được đọc.
3. Specialist cần hard-risk signal do owning domain skill cung cấp hoặc explicit owner request; đồng thời phải có material uncertainty, evidence gap, bounded risk cluster, quota benefit và permission hợp lệ.
4. Một plan/implementation checkpoint mặc định tối đa một specialist cho một risk cluster; reviewer thứ hai cần explicit owner permission.
5. Package được chốt trước khi spawn, có 1–3 câu hỏi, fixed context, lý do từng source, exclusions, output, stop condition, read-only, one turn và no delegation.
6. Reviewer không broad-discover, không tự implement/commit/push/mở remote scope; thiếu context thì trả `Blocked` cùng source/lý do.
7. Main agent làm integration review, xác minh finding và đưa final verdict; không dùng majority vote.
8. Implementation chỉ gọi lại specialist khi hard risk còn tồn tại và main review/verification chưa đủ.
9. `bounded-context` không đồng nghĩa filesystem isolation; không claim `fresh-reader` hoặc `independent` nếu điều kiện không đạt.
10. Trigger không cấp specialist permission; escalation không cấp implementation, Git hoặc remote action.

## 5. Exact scope

### Behavior owners

| File | Ownership và thay đổi |
| --- | --- |
| `docs/agent-loops.md` | Route review depth, main-integration invariant và high-level specialist permission/stop boundary |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | Plan-review decision, exact route tới bounded package và specialist status trong durable plan |
| `.agents/skills/code-review-and-quality/SKILL.md` | Review levels, activation, bounded package, quota/deduplication, reviewer contract, reconciliation và claim labels |

### Supporting owners

| File | Phân loại và thay đổi |
| --- | --- |
| `.agents/scripts/validate-skill.test.mjs` | `required test-support` — thêm ordered warning cho `code-review-and-quality`; không đổi validator/threshold hoặc weaken assertion |
| `docs/agent-workflow/progress.md` | `required tracker` — reconcile AW-PR2 merged dependency và ghi actual AW-PR3A checkpoints/evidence |
| `docs/agent-workflow/implementation-plans/README.md` | `planning/history` — route reader tới AW-PR3A plan/brief |
| file này | `planning/history` — detailed implementation contract |
| `owner-review-brief.md` | `planning/history` — owner decision và permission record |

### Audit-only / forbidden

- `AGENTS.md`, `docs/agent-workflow/plan.md`, `docs/agent-workflow/problems.md`.
- Domain skills, gồm Supabase, Zod/trust boundary, frontend, tests, Git và repo-skill governance; exact signals thuộc AW-PR3B.
- `.agents/scripts/validate-skill.mjs`, `.github/workflows/**`, agent-skill eval runner/suites.
- Product/runtime/UI/DB/migration/RLS/RPC/auth/seed/deployment/production/remote environment.
- Mọi bundled reference hoặc structural skill refactor.

Nếu implementation cần file thứ chín, exact domain signal, new reference, validator behavior hoặc CI workflow thì dừng vì material scope expansion.

## 6. Ownership và thiết kế

### Lifecycle

Lifecycle chỉ sở hữu invariant và route:

```text
minimum review for every actual change
→ main formal/integration review when boundaries or risk require it
→ specialist decision only after main evidence remains insufficient
→ owning planning/review skill executes bounded orchestration
```

Lifecycle không chứa package template, domain signals hoặc tool-specific spawn procedure.

### Planning skill

- Self-review durable plan trước.
- Ghi `specialist decision` chỉ khi hard risk hoặc owner request làm quyết định hữu ích; task nhỏ không cần mục verbose.
- Planning skill quyết định risk cluster, questions, benefit/quota và permission state.
- Khi specialist plan review hợp lệ, planning skill đọc và dùng bounded package/reviewer contract do `code-review-and-quality` sở hữu; không duplicate package.
- Findings đi qua existing external-feedback reconciliation.
- Nếu specialist là necessary evidence nhưng permission không có, ghi `not_run`; trạng thái plan là `Blocked` khi main evidence không đủ để tiếp tục an toàn.

### Review skill

Review skill sở hữu một contract dùng cho plan và implementation:

- levels: minimum, formal main, main integration, specialist;
- two-tier activation và separate permission gate;
- pre-spawn quota/deduplication;
- bounded package record;
- reviewer read-only/one-turn/no-delegation contract;
- output và `Blocked` behavior;
- main reconciliation, final verdict và exact claim labels.

Không copy hard-risk checklist từ master plan vào review skill. Trước AW-PR3B, agent chỉ dùng signal thực sự đã được owning domain skill xác định hoặc explicit owner request; không invent signal bằng cảm giác “task lớn”.

## 7. Dependency và checkpoint order

```text
CP0 baseline/dependency/permission
→ CP1 durable plan + owner record + plan self-review
→ CP2 lifecycle/planning/review orchestration + test-support snapshot
→ CP3 cumulative verification + formal main review + progress closure
→ stage exact eight-file set
→ one local commit
```

- CP1 phải ổn định trước behavior edits.
- CP2 là một coherent contract; không tách direct regression support khỏi behavior.
- CP3 chỉ sửa exact scope findings và owning records.
- Không parallel vì lifecycle/planning/review cùng sở hữu một permission-sensitive contract.

## 8. Acceptance criteria

1. Một typo-only task không tạo specialist decision hoặc spawn reviewer.
2. Domain skill activation riêng lẻ chỉ route main-agent checklist, không cấp specialist permission.
3. Một hard-risk plan có insufficient evidence nhưng không có specialist permission ghi đúng permission state; không spawn và block nếu safety chưa chứng minh được.
4. Một authorized risk cluster chỉ tạo tối đa một package gồm 1–3 exact questions và fixed sources trước spawn.
5. Reviewer thứ hai không được gọi nếu thiếu explicit owner permission.
6. Package thiếu context trả `Blocked`; reviewer không tự mở filesystem/discovery/delegation scope.
7. Implementation không gọi lại specialist chỉ vì continuity; residual hard risk và insufficient main verification phải còn tồn tại.
8. Overlapping concerns được deduplicate thành một risk cluster; không gọi một reviewer cho mỗi skill/file.
9. Specialist finding là claim; main xác minh bằng owner decision, source ownership và repository evidence, không majority vote.
10. Final readiness verdict luôn thuộc main agent.
11. `bounded-context`, `fresh-reader`, `independent` và isolation claims đúng actual setup.
12. Existing severity, verification status, readiness verdict, commit/push/PR/merge permission và CI behavior không đổi.
13. Validator trả `valid` với đúng bốn ordered `CORE_LENGTH_SIGNAL` warnings.
14. Không có domain-signal edit, new reference, structural refactor hoặc file ngoài exact eight-file set.

## 9. Verification strategy

### Automated/structural

1. `node .agents/scripts/validate-skill.mjs`
2. `node --test .agents/scripts/validate-skill.test.mjs`
3. `git diff --check`
4. Markdown heading/fence/link/table, UTF-8, final newline và trailing-whitespace checks cho exact changed files.
5. Scope audit: no rename/move/reference, no validator threshold/behavior, no domain skill/product/runtime/DB/CI workflow change.

### Static behavior scenarios

- small/typo task;
- domain activation without specialist permission;
- hard risk with missing permission;
- one authorized bounded reviewer;
- second reviewer without permission;
- package missing context;
- overlapping risk deduplication;
- implementation repeat-review gate;
- conflicting reviewer findings;
- contaminated fresh-reader/independence claim;
- escalation without Git/remote permission expansion.

These are source-level contract scenarios, not runner-produced, isolated, versioned-suite or model-execution evidence.

### Manual QA và fresh-reader

- Product/browser/manual UI QA: không áp dụng; không có runtime/UI behavior.
- Fixture readiness: không áp dụng; không có data-dependent QA.
- Fresh-reader: `not_run` vì current instruction cấm specialist/sub-agent và không có qualified independent executor. Self-review không thay thế evidence này.
- Application tests/build/browser/Supabase: `not_run`; changed contract nằm trong lifecycle/skill governance và validator test-support.

## 10. Risk và mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Trigger bị hiểu là permission | Unauthorized sub-agent execution | Separate activation, permission và action gates ở lifecycle/planning/review |
| Package broad ngay khi spawn | Quota/context đã phát sinh | Record fixed package trước spawn; late narrowing không tính compliance |
| Planning và review duplicate ownership | Drift | Planning sở hữu decision; review sở hữu reusable package/reviewer contract |
| AW-PR3A invent domain signals | Lấn AW-PR3B | Route only to owning domain skill; no signal list edit |
| Main agent rubber-stamp specialist | Sai verdict/source hierarchy | Findings remain claims; main integration/reconciliation mandatory |
| False fresh-reader/independence claims | Misleading evidence | Exact label definitions and actual-access limitation |
| Code-review skill vượt 500 dòng | New deterministic warning/test failure | Owner accepts warning; update exact snapshot only |
| Context compression để né warning | Safety/permission regression | Preserve core contract; no structural refactor or behavior deletion |

## 11. Rollback

- Revert AW-PR3A orchestration as one coherent unit while giữ nguyên AW-PR1 language và AW-PR2 preflight/CI contracts.
- Revert warning snapshot cùng code-review length change.
- Không amend/squash mặc định; future correction dùng commit mới.
- Nếu evidence cho thấy over-trigger hoặc permission regression, dừng rollout thay vì weaken safety rule.

## 12. Stop conditions

Dừng trước mutation ngoài scope khi:

- cần exact domain signal edits hoặc domain procedure change;
- cần specialist/sub-agent/fresh-reader execution;
- cần new reference, eval suite/runner, validator behavior/threshold hoặc CI workflow;
- dependency/base/branch ownership không còn rõ;
- plan, master, current repository hoặc owner instruction có material conflict;
- verification finding cần file thứ chín hoặc material decision mới;
- cần push, PR, merge, deployment, production/DB/remote action.

## 13. Progress và completion

`docs/agent-workflow/progress.md` ghi CP0–CP3 bằng evidence thực tế. Không mark `implemented`, `verified` hoặc `committed` trước khi corresponding gate pass. Local commit không thay `pushed`, `PR open` hoặc `merged`.

Completion cho current task:

- exact behavior/test/planning set hoàn tất;
- validator/tests/static scenarios và cumulative review pass;
- 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`);
- fresh-reader được ghi `not_run` đúng claim boundary;
- exact files staged và một local English Conventional Commit được tạo;
- không có remote action.

## 14. Implementation brief

### Approved goal

Implement bounded, permission-safe specialist review orchestration cho plan và implementation mà không thêm domain signals.

### Required order

Baseline AW-PR2 merged → plan/brief → lifecycle route → plan orchestration → review package/reconciliation → warning snapshot → cumulative verification/progress → local commit.

### Approved scope

Ba behavior owners, progress tracker, validator test-support và ba planning artifacts được liệt kê ở section 5.

### Forbidden scope

Domain signals, references, validator implementation/threshold, eval foundation, CI/product/runtime/DB/remote actions.

### Verification

Validator, dedicated validator tests, static contract scenarios, documentation/diff/scope audits và formal main review. Fresh-reader `not_run` theo current permission.

## 15. Main plan self-review record

Hoàn tất ngày 2026-07-22. Main agent đã đối chiếu draft với owner instruction, master plan, progress/problems, artifact convention, actual lifecycle/planning/review/test behavior, synchronized baseline/dependency, exact file ownership, permission, acceptance criteria, verification, rollback và stop rules.

Corrections trong self-review:

- đổi các AW-PR2 permission/scope claims còn dùng từ `current` sang historical/final wording trước khi ghi AW-PR3A current permission;
- giữ reusable bounded package ở review skill và chỉ route plan-specific decision ở planning skill để tránh duplicate ownership;
- giữ exact domain signals ngoài AW-PR3A và ghi rõ safe pre-AW-PR3B behavior;
- phân loại warning snapshot là test-support, không biến nó thành behavior owner hoặc validator change.

Kết quả: 0 Nghiêm trọng (`Critical`), 0 Bắt buộc (`Required`), không có material conflict hoặc scope expansion. Fresh-reader/specialist review `not_run` đúng current permission và không được dùng như plan-approval evidence.
