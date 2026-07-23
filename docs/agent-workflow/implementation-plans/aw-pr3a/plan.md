# AW-PR3A Implementation Plan — Specialist review orchestration

## 1. Trạng thái và quyền hạn

| Trường | Giá trị |
| --- | --- |
| Trạng thái plan | `approved` — original implementation và current applicable-review-depth correction đều được owner phê duyệt ngày 2026-07-22 |
| Quy mô cuối | Lớn/rủi ro cao (`Large/high-risk`) — thay lifecycle, permission-sensitive orchestration và evidence claims |
| Branch | `feat/agent-workflow-aw-pr3a` |
| Baseline | synchronized local `main == origin/main == 2b485c13c0fdbb5e4f3865d71b80a903c587b9fc` |
| Dependency | AW-PR2 merged qua PR #59 tại `18f9cbb77c4e5ca0a379bf943ebc509e687999d8`; dependency head `e7f2a2c96c7b1632f73211b6b321b64349fcec34` nằm trong baseline |
| Được phép | implement exact five-file correction, sửa finding trong scope, verification, stage, một local correction commit và normal-push branch sau final audit |
| Không được phép | tạo/cập nhật PR, CI watch/fix, merge, force-push, branch deletion, specialist/sub-agent/fresh-reader executor, production/DB/deployment/remote mutation khác |
| Structural constraint | sửa trực tiếp existing `SKILL.md`; không tạo/tách/đổi tên/di chuyển reference |

Original instruction xác nhận AW-PR3A là một implementation PR độc lập sau AW-PR2, chấp nhận warning `CORE_LENGTH_SIGNAL` thứ tư và current-repository snapshot tương ứng, không đổi validator hoặc threshold. Current owner instruction phê duyệt correction từ authorship-specific gate sang applicable-main-review-depth gate trong exact five-file scope và cấp edit/commit/normal-push sau final audit; nó không cấp PR, CI, merge hoặc action ngoài permission table.

## 2. Mục tiêu

Main agent có một workflow thống nhất để quyết định khi nào plan hoặc implementation cần specialist review, giới hạn context/quota trước khi gọi, giữ reviewer read-only và reconcile findings bằng evidence thay vì majority vote.

AW-PR3A chỉ xây orchestration foundation. AW-PR3B mới sở hữu exact hard/conditional signals trong từng domain skill.

## 3. Hiện trạng repository trước implementation ban đầu

Các fact dưới đây là discovery baseline trước original implementation; current behavior nằm trong lifecycle/review skill và current delivery evidence nằm trong `docs/agent-workflow/progress.md`.

- `docs/agent-loops.md` sở hữu lifecycle gate và universal minimum review nhưng chưa route main integration/specialist depth.
- `implementation-planning-and-pr-breakdown` có durable-plan self-review và feedback reconciliation nhưng chưa có plan-specialist decision/package route.
- `code-review-and-quality` chỉ có một đoạn ngắn “Multiple reviewers or models”; chưa có activation, quota, bounded package, reviewer stop/output hoặc claim-label contract.
- `maintain-repo-skills` giữ permission/evidence boundary; manual fresh-reader procedure yêu cầu executor hợp lệ và không cho dùng self-review thay thế.
- `code-review-and-quality/SKILL.md` hiện có 465 dòng; contract mới dự kiến vượt non-blocking threshold 500 dòng.
- Validator hiện `valid` với ba `CORE_LENGTH_SIGNAL`; current-repository test snapshot khóa ordered `(skill, code)` list.
- `AGENTS.md` đã route planning, review, test, Git và repo-skill governance; không cần root edit.
- Không có AW-PR3A problem record; không tạo problem/ADR/reference mới.

## 4. Confirmed requirements

1. Final `small/low-risk` task dùng main-agent minimum review và bình thường kết thúc mà không evaluate specialist decision hoặc spawn specialist.
2. Mặc định `0 specialist`; activation chỉ được xét sau khi main agent hoàn tất applicable review depth, không xảy ra chỉ vì domain skill được đọc hoặc task mang nhãn medium.
3. Nếu review evidence làm lộ concrete hard risk hoặc material uncertainty khiến final sizing không còn đúng, reclassify trước, hoàn tất formal/integration review mới áp dụng, rồi mới evaluate specialist gates.
4. Explicit owner request có thể kích hoạt consideration nhưng không bypass review depth, material uncertainty, evidence gap, bounded context, quota benefit hoặc explicit specialist permission.
5. Agent-authored durable plan giữ narrower planning-owned rule: main-agent plan self-review comes first.
6. Một plan/implementation checkpoint mặc định tối đa một specialist cho một risk cluster; reviewer thứ hai cần explicit owner permission.
7. Package được chốt trước khi spawn, có 1–3 câu hỏi, fixed context, lý do từng source, exclusions, output, stop condition, read-only, one turn và no delegation.
8. Reviewer không broad-discover, không tự implement/commit/push/mở remote scope; thiếu context thì trả `Blocked` cùng source/lý do.
9. Main agent làm integration review khi boundaries/risk yêu cầu, xác minh finding và đưa final verdict; không dùng majority vote.
10. Implementation chỉ gọi lại specialist khi hard risk còn tồn tại và main review/verification chưa đủ.
11. `bounded-context` không đồng nghĩa filesystem isolation; không claim `self-review`, `fresh-reader` hoặc `independent` nếu điều kiện không đạt.
12. Trigger không cấp specialist permission; escalation không cấp implementation, Git hoặc remote action.

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

### Approved correction amendment — 2026-07-22

Exact correction set:

- `docs/agent-loops.md`;
- `.agents/skills/code-review-and-quality/SKILL.md`;
- file này;
- `owner-review-brief.md`;
- `docs/agent-workflow/progress.md`.

Planning skill giữ narrower agent-authored durable-plan rule và là audit-only cho correction. Master plan, domain skills, validator/snapshot test, plan index, references, CI, product/runtime và database tiếp tục ngoài correction scope.

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
→ final small/low-risk fast path normally stops without specialist evaluation
→ reclassify first when review evidence invalidates sizing
→ main formal/integration review only when task, checkpoint, lifecycle or risk requires it
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
- applicable review depth theo final sizing, review target và discovered risk;
- external human/agent branch hoặc PR dùng formal/integration review mà không claim self-review;
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

1. Final small/low-risk task không có new risk hoàn tất minimum review và skip specialist-decision evaluation.
2. Small task có review evidence làm lộ hard risk được reclassify trước khi chạy deeper main review hoặc specialist gates.
3. Explicit owner request trên small work không bypass applicable review depth hoặc remaining gates.
4. Self-authored non-small implementation dùng formal/integration review khi task, checkpoint, lifecycle hoặc risk yêu cầu; medium label riêng lẻ không tạo heavyweight ceremony.
5. External human/agent branch hoặc PR dùng formal main review và integration review khi cần, không bị gọi sai là `main self-review`.
6. Specialist evidence cần thiết nhưng permission hoặc bounded package không có được ghi `not_run`; dùng `Blocked` khi main evidence không đủ kết luận.
7. Agent-authored durable plan tiếp tục dùng planning-owned main-agent self-review first rule.
8. Domain skill activation riêng lẻ chỉ route main-agent checklist, không cấp specialist permission.
9. Một authorized risk cluster chỉ tạo tối đa một package gồm 1–3 exact questions và fixed sources trước spawn.
10. Reviewer thứ hai không được gọi nếu thiếu explicit owner permission.
11. Package thiếu context trả `Blocked`; reviewer không tự mở filesystem/discovery/delegation scope.
12. Implementation không gọi lại specialist chỉ vì continuity; residual hard risk và insufficient main verification phải còn tồn tại.
13. Overlapping concerns được deduplicate thành một risk cluster; không gọi một reviewer cho mỗi skill/file.
14. Specialist finding là claim; main xác minh bằng owner decision, source ownership và repository evidence, không majority vote.
15. Final readiness verdict luôn thuộc main agent.
16. `bounded-context`, `self-review`, `fresh-reader`, `independent` và isolation claims đúng actual setup.
17. Existing severity, verification status, readiness verdict, commit/push/PR/merge permission và CI behavior không đổi.
18. Validator trả `valid` với đúng bốn ordered `CORE_LENGTH_SIGNAL` warnings.
19. Correction không có domain-signal edit, new reference, structural refactor hoặc file ngoài exact five-file set.

## 9. Verification strategy

### Automated/structural

1. `node .agents/scripts/validate-skill.mjs`
2. `node --test .agents/scripts/validate-skill.test.mjs`
3. `git diff --check`
4. Markdown heading/fence/link/table, UTF-8, final newline và trailing-whitespace checks cho exact changed files.
5. Scope audit: no rename/move/reference, no validator threshold/behavior, no domain skill/product/runtime/DB/CI workflow change.

### Static behavior scenarios

- final small/low-risk task with no new risk skips specialist evaluation;
- small task whose review reveals hard risk is reclassified before deeper review;
- explicit owner request on small work does not bypass remaining gates;
- self-authored non-small implementation uses the applicable main review only when required;
- external human/agent branch or PR uses formal/integration review without a false self-review claim;
- specialist evidence needed but permission/package unavailable;
- domain activation without specialist permission;
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
- verification finding cần file thứ sáu của correction hoặc material decision mới;
- cần PR, CI, merge, force-push, branch deletion, deployment, production/DB hoặc remote action khác ngoài exact normal push được cấp.

## 13. Progress và completion

`docs/agent-workflow/progress.md` ghi CP0–CP3 bằng evidence thực tế. Không mark `implemented`, `verified` hoặc `committed` trước khi corresponding gate pass. Local commit không thay `pushed`, `PR open` hoặc `merged`.

Completion cho current task:

- exact five-file correction hoàn tất;
- validator/tests/static scenarios và cumulative review pass;
- 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`);
- fresh-reader được ghi `not_run` đúng claim boundary;
- exact files staged và một local English Conventional Commit được tạo;
- branch được normal-push sau final audit; không có PR, CI hoặc merge action.

## 14. Implementation brief

### Approved goal

Implement bounded, permission-safe specialist review orchestration cho plan và implementation mà không thêm domain signals.

### Required order

Baseline AW-PR2 merged → plan/brief → lifecycle route → plan orchestration → review package/reconciliation → warning snapshot → cumulative verification/progress → local commit.

### Approved scope

Current correction chỉ gồm exact five-file amendment trong section 5; original AW-PR3A scope và history vẫn được giữ để audit.

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

Kết quả original implementation: 0 Nghiêm trọng (`Critical`), 0 Bắt buộc (`Required`), không có material conflict hoặc scope expansion. Fresh-reader/specialist review `not_run` đúng permission và không được dùng như plan-approval evidence.

Current correction decision xác nhận authorship-specific reusable gate là contract defect đối với external human/agent branch hoặc PR. Owner đã duyệt applicable-main-review-depth design, small fast path, late-risk reclassification, explicit-owner non-bypass rule, planning-owned durable-plan exception và exact five-file implementation/commit/normal-push permission. Correction chỉ được đóng sau current validator/tests/scenarios, cumulative self-review và final AW-PR3A audit.
