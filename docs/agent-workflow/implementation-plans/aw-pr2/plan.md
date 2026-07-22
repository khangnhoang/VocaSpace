# AW-PR2 Implementation Plan — Lifecycle preflight, CI permission modes và adaptive planning

## 1. Trạng thái tài liệu và quyền hạn

| Trường | Giá trị |
| --- | --- |
| Trạng thái | Exact per-PR planning contract đã được owner duyệt ngày 2026-07-18 và amended ngày 2026-07-21 sau post-implementation review |
| Ngày lập | 2026-07-18 |
| Branch planning | Historical: `docs/agent-workflow-aw-pr2-planning` |
| Baseline | Planning historical: `b134e0842ea3eac5a7bacc064c37570e35e45847`; implementation: `b10be2654d1a1c2291f1483e82ade3d0404cc151` |
| Dependency | AW-PR1 đã merge qua PR #56 tại merge commit `b134e0842ea3eac5a7bacc064c37570e35e45847` |
| Planning delivery | Completed: commit `161798ac05bfa947e8362b1785151a349a073de4` merge qua PR #57 tại `b10be2654d1a1c2291f1483e82ade3d0404cc151` |
| Implementation branch | `feat/agent-workflow-aw-pr2`, được tạo từ updated `main`; CP2 preflight local/upstream/remote là `868bf5dde523c26a941b7ba73d59ef08e2ed898b` |
| Nguồn sở hữu intended program scope | [master plan](../../plan.md) |
| Nguồn sở hữu current delivery status | [progress.md](../../progress.md) |
| Nguồn sở hữu known-problem record | [problems.md](../../problems.md) |
| Owner review và decision record | [owner-review-brief.md](./owner-review-brief.md) — original six-file decision `approved` ngày 2026-07-18; seven-file amendment `approved` ngày 2026-07-21 |
| Quyền hiện tại | Implement CP2 trong exact revised seven-file contract; cập nhật owning tracker/decision records từ actual evidence; tạo coherent local checkpoint sau verification/formal review còn 0 Critical/Required |
| Chưa được phép | Push; PR create/update; CI watching; merge; force-push; CP3 implementation; specialist/sub-agent; structural/reference refactor; product/runtime/test/DB/CI workflow/production/destructive change |

Plan này là durable handoff và audit record cho AW-PR2. Nó không tự phê duyệt material decision, không tự cấp implementation/Git/remote permission và không thay thế owner instruction hiện hành. Original six-file scope được giữ như historical decision; current owner-approved behavior scope là seven files có thêm duy nhất `AGENTS.md`. Planning/history documents dùng để ghi amendment không được tính vào seven-file behavior set, nhưng phải được tính trong cumulative branch changed-file set.

### Post-implementation-review amendment — 2026-07-21

- CP1/CP1R đã implement lifecycle/planning behavior và được normal-push; review baseline local/upstream/remote là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.
- Independent review xác nhận `docs/agent-loops.md` tuyên bố `Universal Lightweight Preflight` cho mọi task, nhưng root `AGENTS.md` chỉ route lifecycle document theo các planning/checkpoint/review/CI phase có điều kiện. Một task nhỏ như typo correction không được bảo đảm tải preflight trước mutation.
- Finding này invalidated assumption lịch sử rằng `AGENTS.md` chỉ cần audit. Owner chấp nhận hai Required findings và duyệt amendment tối thiểu: thêm duy nhất `AGENTS.md` thành behavior file thứ bảy, sửa root route ngắn và cập nhật planning/problem/progress history.
- Amendment không đổi dependency `AW-PR1 → AW-PR2 → AW-PR3A → AW-PR3B`, không mở CP2, không cấp push/PR/CI-watch/merge hoặc specialist permission.

### CP1R2 delivery và CP2 authorization — 2026-07-22

- CP1R2 commits `3027959ac68ea9203d6af1594668cb22d6e7c3d9` và `868bf5dde523c26a941b7ba73d59ef08e2ed898b` đã được normal-push tới remote HEAD `868bf5dde523c26a941b7ba73d59ef08e2ed898b`. Các checkpoint-time claim “not pushed” vẫn đúng về mặt lịch sử tại thời điểm được ghi.
- One-time CP1R2 push permission đã được tiêu thụ. Nó không cấp standing push, PR, CI-watch, merge, force-push, specialist, production hoặc destructive permission.
- Owner instruction ngày 2026-07-22 cấp CP2 implementation permission và conditional local checkpoint permission. CP3 vẫn pending và không được phép trong checkpoint này.

## 2. Mục tiêu

Trên implementation branch, hoàn tất AW-PR2 như một governance change duy nhất, có thể review và rollback độc lập, để:

1. mọi task có lifecycle preflight nhẹ và context routing dựa trên ownership/evidence;
2. quy mô được đánh giá hai lần và được escalation khi discovery làm lộ risk/scope mới;
3. plan depth thích ứng với task nhỏ, vừa hoặc lớn/rủi ro cao;
4. mọi actual change set có universal minimum self-review;
5. durable-plan decision, plan self-review, external-feedback reconciliation và owner/implementation gate rõ;
6. `AW-P001` được reconcile giữa lifecycle, root routing, Git checkpoint và PR/CI skill mà không nới rộng permission;
7. AW-PR2 không kéo specialist orchestration của AW-PR3A hoặc domain escalation signals của AW-PR3B vào scope.

## 3. Confirmed repository facts

- PR #56 có base/head `main` ← `docs/agent-workflow-language-reporting`, trạng thái `MERGED`, merge commit `b134e0842ea3eac5a7bacc064c37570e35e45847`.
- Toàn bộ năm commit cumulative của AW-PR1 là ancestor của `origin/main`; cumulative PR #56 thay sáu file đúng language/reporting scope.
- CI readily available của PR #56 đều thành công: `Test and Build`, `production-gate`, `Vercel`, `Vercel Preview Comments` là `SUCCESS`; GitHub không trả `reviewDecision`.
- Historical planning branch được tạo độc lập từ synchronized `main`, giao qua PR #57 và merge trước implementation.
- Implementation branch `feat/agent-workflow-aw-pr2` được tạo từ synchronized `main == origin/main == b10be2654d1a1c2291f1483e82ade3d0404cc151`.
- Trước amendment, local/upstream/remote implementation HEAD cùng là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`; working tree sạch và cumulative branch diff có bốn file.
- `AGENTS.md` hiện sở hữu root routing/invariant và đã giới hạn narrow commit/push exception vào bounded PR/CI self-fix workflow.
- Trước CP2, `docs/agent-loops.md` sở hữu lifecycle trigger/stop rule nhưng CI Loop 3 còn làm inspect/watch/fix permission mơ hồ.
- `implementation-planning-and-pr-breakdown` hiện sở hữu detailed planning procedure; CP1/CP1R đã thêm adaptive preflight, two-pass sizing, durable-plan decision, plan self-review, tracked-program reconciliation và claim-reconciliation contract.
- Trước CP2, `git-checkpoint-workflow` sở hữu default owner-approved commit/push rule nhưng chưa cross-reference narrow PR/CI exception.
- Trước CP2, `github-pr-ci-workflow` sở hữu exact failure taxonomy, command procedure, normal push conditions và self-fix cycle; nó còn cho create/update-only normal-push already-committed branch, trái default root/Git boundary, và attempt thứ ba còn được cho phép bằng owner approval **hoặc** agent judgment.
- `code-review-and-quality` sở hữu formal implementation review; specialist orchestration/multi-reviewer expansion thuộc AW-PR3A, không thuộc AW-PR2.
- `progress.md` ghi AW-PR2 master-program `approved=yes`, implementation permission riêng, CP1/CP1R/CP1R2 delivery evidence và CP2 current checkpoint; approval state và action permission không được suy ra lẫn nhau.
- `AW-P001` hiện giữ `confirmed` + `in progress` + target `AW-PR2` cho tới khi CI four-source reconciliation hoàn tất và CP3 cung cấp cumulative seven-file integration/closure evidence theo plan.
- `AW-P002` được tạo sau independent review để sở hữu universal-preflight root-routing gap, tách biệt khỏi CI permission drift của `AW-P001`.
- `docs/agent-skills/plan.md` và `progress.md` thuộc chương trình agent-skill governance khác; chúng xác nhận durable plan không phải universal file gate và không phải changed-file candidate của AW-PR2.

## 4. Assumptions

- PR #56 được xem là exact AW-PR1 dependency baseline vì merge commit và toàn bộ cumulative commits đã được xác minh trên fetched `origin/main`.
- AW-PR2 là một documentation/governance PR; không cần application test/build/browser/Supabase hoặc GitHub Actions workflow change.
- Existing seven-value `AW-P001` failure taxonomy và normal push conditions của exact combined PR+CI self-fix loop được giữ nguyên. Create/update-only push implication và combined-mode initial-push implication phải bị loại bỏ để khớp default root/Git contract; narrow exception chỉ bắt đầu sau khi PR/check tồn tại và failure được phân loại `branch-caused-small-safe`.
- Historical assumption: `AGENTS.md` đã đủ root routing và chỉ cần audit. Post-implementation review đã phủ định assumption này vì conditional route không bảo đảm task nhỏ tải universal preflight trước mutation.
- Không còn authoring question chưa giải quyết cho amendment hoặc CP2: owner đã duyệt seven-file behavior scope, root correction và exact CP2 contract. Mọi Git/remote action ngoài conditional local checkpoint và toàn bộ CP3 vẫn là gate riêng.
- Historical delivery prerequisite đã được đáp ứng: planning-only PR merged, local `main` được sync và `feat/agent-workflow-aw-pr2` được tạo từ updated main trước implementation.

Nếu implementation discovery phủ định bất kỳ assumption nào, agent phải dừng và báo thay vì tự sửa plan thành authority mới.

## 5. Context routing record

| Source đã mở | Evidence khiến source liên quan | Câu hỏi cần trả lời | Vai trò trong AW-PR2 |
| --- | --- | --- | --- |
| `AGENTS.md` | Root route trước CP1 chỉ nạp lifecycle theo phase có điều kiện, trong khi lifecycle tuyên bố universal preflight | Làm sao bảo đảm task nhỏ tải preflight trước mutation mà không duplicate procedure? | `required change` theo amendment 2026-07-21 |
| `docs/agent-loops.md` | Lifecycle overlay được root bắt buộc đọc cho planning/checkpoint/review/CI | Preflight, sizing, universal gate và high-level CI mode thuộc lifecycle ở mức nào? | `required change` |
| `docs/agent-workflow/plan.md` | Authoritative intended scope/dependency; current correction phát hiện thiếu per-PR convention route và delivery split | Program-level route/permission invariant cần ngắn đến đâu? | `required planning correction`; `audit only` trong future implementation |
| `docs/agent-workflow/problems.md` | Sở hữu `AW-P001`, safe interim behavior và closure criteria | Create/update-only no-push có cần là closure criterion mà không đổi state không? | `required planning correction`; future implementation status update owner |
| `docs/agent-workflow/progress.md` | Sở hữu current planning/implementation/delivery evidence | Master approval, per-PR plan decision và planning/implementation delivery tách ra sao? | `required planning correction` và future implementation checkpoint owner |
| `docs/agent-workflow/implementation-plans/README.md` | Current convention owner cho exact per-PR layout | Reader load/reconcile plan và brief thế nào; source này không được sở hữu gì? | `required planning correction` |
| `docs/agent-workflow/implementation-plans/aw-pr2/plan.md` | Detailed agent-facing contract hiện tại | Historical six-file decision và current seven-file amendment có được phân biệt chính xác không? | `required planning/history correction` |
| `docs/agent-workflow/implementation-plans/aw-pr2/owner-review-brief.md` | Owner-facing decision surface hiện tại | Current review đang duyệt planning contract, implementation hay cả hai? | `required planning correction` |
| `maintain-repo-skills/SKILL.md` | Planned implementation sửa repo-local skill contracts | Permission, structural, evidence, source-ownership và stop boundary nào bắt buộc? | `audit only` |
| `maintain-repo-skills/references/fresh-reader-testing.md` | Material permission/routing change kích hoạt exact read condition | Fresh-reader evidence hợp lệ/`not_run` phải được ghi thế nào? | `audit only` |
| `maintain-repo-skills/references/progressive-disclosure.md` | Owner cấm reference split/structural refactor | Mandatory permission/routing rule phải ở core và khi nào phải reject split? | `audit only` |
| `implementation-planning-and-pr-breakdown/SKILL.md` | Direct procedure owner cho context/planning/handoff | Detailed read conditions, sizing, plan depth, self-review và gate đặt ở đâu? | `required change` |
| `git-checkpoint-workflow/SKILL.md` | `AW-P001` yêu cầu audit default commit/push boundary và minimum change-set audit | Default rule và narrow exception cross-reference reconcile ra sao? | `required change` |
| `github-pr-ci-workflow/SKILL.md` | Sở hữu exact CI modes/procedure/taxonomy/self-fix loop | Mode nào cấp edit/commit/push; attempt được định nghĩa và giới hạn thế nào? | `required change` |
| `code-review-and-quality/SKILL.md` | Cần phân biệt minimum/formal/specialist review và tránh AW-PR3A scope | AW-PR2 có cần sửa formal review owner không? | `audit only` |
| `docs/agent-skills/plan.md` và `progress.md` | Master plan link trực tiếp để phân định two-program ownership | Có duplicate durable-plan/eval/future-consumer ownership không? | `audit only` |
| PR #55 merge history | Master plan/problem tracker được merge qua PR #55 | Durable source convention và baseline history có đúng không? | `audit only` |
| PR #56 cumulative diff/state | Hard dependency AW-PR1 | AW-PR1 đã merge nguyên trạng và có thể làm base độc lập chưa? | `audit only` |
| Git state và fetched history | Current task cho phép inspect; branch rename đã hoàn tất trong pass được cấp quyền trước và cần được revalidate như repository fact | Base/upstream/collision/dirty ownership, PR #55/#56 merge và planning branch hiện tại có rõ không? | `audit only` evidence; không phải changed file |

`not applicable` trong discovery này:

- deferred feature source: AW-PR2 không thêm product behavior hoặc kéo deferred feature vào scope;
- ADR: AW-PR2 áp dụng owner-approved workflow plan, không đổi architecture decision do ADR sở hữu;
- product/domain source: không có product/runtime/DB/test behavior trong scope;
- eval design: không thiết kế/chạy eval suite hoặc runner;
- additional domain skill: không có discovered domain ownership change; scenario DB chỉ chứng minh routing behavior, không thay DB contract.

Không tạo source mới cho các mục `not applicable` này.

## 6. Đánh giá quy mô hai lần

### Lần 1 — sau routing

- Phân loại: `lớn/rủi ro cao`.
- Lý do: nhiều source owner; thay lifecycle/governance/permission; có tracked conflict `AW-P001`; cần owner gate và durable handoff.
- Không dùng số file làm rule: bốn file permission có một bounded contract, nhưng permission drift làm semantic risk cao.
- Risk cluster ban đầu: context ownership, adaptive depth, universal gate, CI edit/commit/push boundary, AW-PR2/3A/3B boundary.
- Discovery depth: full relevant discovery, exact source/mode/scenario matrices, durable plan, main plan self-review.

### Lần 2 — trong discovery

- Final size: vẫn `lớn/rủi ro cao`.
- Escalation về depth: có — durable per-PR plan và exact scenario/permission matrices là bắt buộc.
- Escalation về scope/permission: không.
- Không phát hiện source of truth mới ngoài source master plan đã dự kiến.
- Reconciliation pass phát hiện implementation-plan README, per-PR brief, master-plan route và current progress phải được xét cùng nhau để tách planning delivery khỏi implementation delivery; đây là planning-document correction, không mở rộng future behavior scope.
- `AW-P001` không rộng hơn owner-confirmed four-source contract.
- Lifecycle và skill ownership có thể reconcile mà không duplicate procedure.
- Không cần sửa review orchestration của AW-PR3A.
- Không cần thêm domain signal của AW-PR3B.
- Không cần reference split, structural refactor, taxonomy change hoặc runtime tooling.
- Không phát hiện authoring question/material proposal mới ngoài các claim đã reconcile; exact per-PR owner decision hiện `approved`, còn planning delivery và implementation permission vẫn là gate riêng.

Escalation không bao giờ tự cấp implementation, specialist, commit, push, PR hoặc merge permission.

## 7. Source-ownership matrix

| Source | Current owner | Proposed owner | Behavior/invariant owned | Procedure owned | Must not duplicate | Changed-file candidate |
| --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Root behavior/routing | Thêm unconditional route tới lifecycle preflight; giữ conditional detailed-loop route | Mọi repository task phải tải lifecycle preflight trước action/discovery-depth choice; short no-commit/no-push + narrow exception route | Không sở hữu mode/command matrix | Lifecycle preflight steps, CI cycle, attempt definition, planning checklist | `required change` theo amendment 2026-07-21 |
| `docs/agent-loops.md` | Lifecycle trigger/confidence/stop | Lifecycle preflight, two-pass sizing trigger, plan/review depth route, universal minimum-review invariant, high-level CI permission mode/stop | Khi nào route/read/size/escalate/review/stop; tracked-program route chỉ là một short subsection/paragraph + vài bullets | Chỉ concise lifecycle flow, không command-level procedure | Exact layout, detailed source reconciliation, CI taxonomy/cycle, Git staging procedure, specialist package | `required change` |
| `implementation-planning-and-pr-breakdown` | Planning/discovery/handoff procedure | Detailed context routing/read conditions, tracked-program artifact detection/reconciliation, sizing, adaptive plan depth, durable-plan decision, plan self-review, feedback reconciliation, owner/implementation gate | Planning remains read-only until valid gate; pending/conflicting owner record stops implementation | Exact planning workflow và handoff | Domain checklist, formal implementation review, Git/PR commands, specialist orchestration | `required change` |
| `git-checkpoint-workflow` | Git/base/dirty/stage/commit/push safety | Giữ default owner-approved contract; explicit narrow cross-reference; operational minimum change-set audit | Commit/push remain separately permissioned by default | Git state, diff/staging/commit/push safety | PR/CI failure taxonomy, self-fix cycle, attempt definition | `required change` |
| `github-pr-ci-workflow` | PR/CI commands, classification, self-fix, merge gates | Exact permission-mode procedure, unchanged taxonomy, exact cycle/attempt, normal push conditions, default 2 attempts/third owner-only | Only combined create/update + watch grants bounded `branch-caused-small-safe` loop | GitHub commands/log/classify/fix/commit/push/re-watch/report | Generic Git safety details, lifecycle routing, formal review | `required change` |
| `code-review-and-quality` | Formal implementation review/verdict | Giữ nguyên trong AW-PR2 | Formal review remains distinct/read-only by default | Formal finding/review procedure | Universal micro-review procedure, plan-review orchestration, domain signals | `audit only` |
| `docs/agent-workflow/plan.md` | Intended program scope/dependency | Add concise route to README and planning→implementation dependency; no per-PR detail | Master-program contract and dependency | Không sở hữu exact layout, current status hoặc detailed per-PR steps | Current evidence và AW-PR2 matrices/procedure | `required planning correction`; future implementation `audit only` |
| `docs/agent-workflow/problems.md` | Known problem/status/closure evidence | Keep state; include PR-only no-push in interim/closure evidence | `AW-P001` state, interim safety và resolution evidence | Không sở hữu exact mode commands | Master scope và skill procedure | `required planning correction`; future status update only from evidence |
| `docs/agent-workflow/progress.md` | Current planning/implementation/delivery status | Distinguish planning delivery, implementation delivery and approval meanings | Actual permission/implemented/verified/delivery facts | Không sở hữu future behavior | Master intended scope và problem procedure | `required planning correction` and future checkpoints |
| `docs/agent-workflow/implementation-plans/README.md` | Exact directory convention và artifact routing | Giữ nguyên ownership; add reconciliation/stop boundary | Không sở hữu scope/status/permission | Route reader tới per-PR artifacts và existing program owners | Master plan, progress, problem hoặc per-PR behavior | planning artifact only |
| `docs/agent-workflow/implementation-plans/aw-pr2/owner-review-brief.md` | Owner decision surface và evidence-backed decision record | Giữ nguyên ownership; distinguish plan/delivery/implementation decisions | Pending brief không tự approve; explicit owner evidence mới đổi exact field | Tóm tắt decisions, requested permission và review path | Full matrices/procedure/status evidence | owner review artifact only |
| `docs/agent-workflow/implementation-plans/aw-pr2/plan.md` | Detailed AW-PR2 implementation handoff | Giữ nguyên ownership; reconcile planning/implementation delivery | Không sở hữu runtime/current permission hoặc owner approval | Exact planned scope/order/criteria/verification/rollback | Master scope, current status, operational skill procedure | agent planning artifact only |

## 8. Exact implementation scope

### Trong scope

- Add the minimum root route in `AGENTS.md`: every repository task loads `docs/agent-loops.md` and applies `Universal Lightweight Preflight` before acting or choosing discovery depth; the existing conditional list continues to route only detailed loops.
- Add concise lifecycle preflight/context routing invariant to `docs/agent-loops.md`.
- Add detailed source read conditions, expansion triggers and `not applicable` handling to planning skill.
- Add preliminary sizing after routing and mandatory final sizing during discovery; define observable escalation signals.
- Add adaptive micro/short/durable plan depth without a universal plan-file gate.
- Add universal minimum actual-change self-review route and distinguish it from formal/specialist review.
- Add durable-plan self-review, external-feedback claim reconciliation and owner/implementation gate to planning skill.
- Reconcile `AW-P001` through high-level lifecycle modes, Git default boundary cross-reference and exact PR/CI procedure.
- Preserve exact CI failure taxonomy và normal push conditions của combined bounded self-fix loop, nhưng chốt rõ combined mode không cấp initial push và exception chỉ bắt đầu sau existing PR/check + `branch-caused-small-safe` classification.
- Set default maximum to 2 completed attempts; third attempt only with explicit owner permission.
- Update current progress/problem sources only from actual implementation and verification evidence.
- Modify existing `SKILL.md` files directly; keep all new mandatory permission/routing content in core.

### Exact exclusions

- Không implement specialist selection, bounded-context package, multi-reviewer reconciliation hoặc main integration review orchestration của AW-PR3A.
- Không thêm/sửa domain hard-risk/conditional signals của AW-PR3B.
- Không tạo, tách, rename, move `references/`; không structural refactor hoặc opportunistic rewrite.
- Không đổi CI failure taxonomy.
- Không sửa `.github/workflows/**`, product code, runtime, tests, DB, RLS, RPC, migrations, auth, production hoặc remote environment.
- Không mở rộng auto-merge, force-push, branch deletion hoặc self-fix permission.
- Không tạo ADR, deferred-feature source, problem tracker, progress tracker hoặc skill mới.
- Không sửa master plan chỉ để chứa detail thuộc per-PR plan.
- Không stage/commit/push/create PR/merge trong implementation nếu owner chưa cấp action tương ứng.

### Planning và implementation delivery boundary

Historical planning outcome và implementation là hai delivery units độc lập. Original approved handoff was:

```text
docs/agent-workflow-aw-pr2-planning
  → planning-only commit/push/PR/merge, mỗi action cần permission tương ứng
    → sync local main với origin/main bằng fast-forward-only
      → create feat/agent-workflow-aw-pr2 từ updated main
        → revalidate plan decision, exact scope và implementation permission
          → change exactly the six originally approved implementation files
```

- Historical planning branch không chứa AW-PR2 behavior edit trong `docs/agent-loops.md` hoặc `SKILL.md`.
- Original six-file decision được giữ làm history. Amendment ngày 2026-07-21 thêm duy nhất `AGENTS.md`, tạo current seven-file behavior/tracker scope ở section 17.
- Planning/history artifacts không được tính vào seven-file behavior scope. Vì amendment được owner cho phép sau implementation start, master plan, detailed plan và owner brief có thể xuất hiện trong cumulative implementation-branch diff chỉ để ghi revised contract/history; chúng phải được phân loại riêng.
- Implementation không bắt đầu trước planning PR merge. Implementation permission có thể được ghi sớm nếu owner nói rõ, nhưng chỉ được dùng sau merge/baseline sync khi exact permission vẫn còn hiệu lực và được revalidate.
- Historical preflight kết luận exact changed-file set là sáu file và `AGENTS.md` chỉ cần audit; independent review đã invalidated kết luận đó. Owner-approved amendment giải quyết stop gate trước root mutation.
- Từ amendment này, nếu cần thêm behavior file thứ tám, đổi remaining `audit only` thành changed file hoặc chạm excluded source, dừng và xin owner duyệt revised plan/scope trước mutation ngoài seven-file set.
- Planning delivery rollback không được dùng như behavior rollback; current behavior rollback áp dụng cho seven-file implementation contract, còn amendment documents giữ rollback/history boundary riêng.

Historical planning-only PR sửa đúng sáu planning documents: master `plan.md`, `progress.md`, `problems.md`, implementation-plan `README.md`, AW-PR2 detailed `plan.md` và `owner-review-brief.md`. Current amendment sửa only the owning planning/history sources needed to record the decision; cumulative changed-file accounting is specified separately from the seven behavior files.

## 9. Lifecycle preflight và context routing được đề xuất

### Minimum preflight

Mọi task đi qua lượt nhẹ sau trước khi chọn discovery depth:

1. đọc owner request/current action permission và exact exclusions;
2. áp dụng root/nested `AGENTS.md` cho target path;
3. xác định target artifact/area và direct repository evidence sơ bộ;
4. route mọi skill có activation condition khớp và đọc đầy đủ skill đã chọn;
5. mở target file/symbol cùng exact direct reference cần để hiểu contract;
6. kiểm tra task có thuộc tracked program, master/per-PR plan, owner decision record, ADR, problem hoặc deferred source không;
7. kiểm tra Git state khi task có file/Git mutation, baseline/ownership/dependency question;
8. ghi preliminary sizing và discovery depth.

Lifecycle invariant ở `docs/agent-loops.md` chỉ cần giữ trigger, route, escalation/gate và stop rule. Tracked-program addition phải concise và concrete: ưu tiên một short subsection hoặc một paragraph với không quá vài bullets; không exact layout, matrix, reconciliation procedure hoặc Git/CI commands. Detailed read-condition matrix, program-artifact reconciliation, planning record và durable-plan procedure thuộc planning skill.

### Read-condition matrix

| Source | Phải đọc khi | Không đọc chỉ vì |
| --- | --- | --- |
| Root/nested `AGENTS.md` | Luôn áp dụng cho target path | Không có ngoại lệ |
| Activated skill | Task/discovered scope khớp activation; đọc đầy đủ | Tên skill có vẻ gần nghĩa nhưng activation không khớp |
| Direct repository evidence | Luôn đọc phần target/consumer cần thiết | “Đọc repo cho chắc” mà không có ownership/dependency signal |
| Master plan | Task thuộc program; có thể đổi intended scope/dependency/order/approved direction | Typo độc lập hoặc behavior không thuộc tracked program |
| `progress.md` | Task thuộc tracked program hoặc có thể đổi current status/evidence | Source chỉ tồn tại trong repo nhưng task không phải consumer |
| `problems.md` | Target có known issue/debt hoặc task tuyên bố resolve tracked behavior | Không có matching problem record |
| Program artifact convention | Task thuộc tracked program có convention/index riêng | Repository không theo dõi task bằng program artifacts |
| Deferred feature/source | Task thêm behavior hoặc evidence cho thấy deferred scope có thể bị kéo vào | Routine correction không thêm behavior |
| ADR | Task thay architecture/contract/decision do ADR sở hữu | Local wording/formatting không đổi decision |
| Per-PR plan và owner decision record | Implement/fix/review exact PR/scope và artifacts tồn tại | Unrelated task hoặc program không có per-PR consumer |
| Git state | Sẽ mutate file/branch/checkpoint/remote hoặc cần baseline/ownership | Pure explanation không phụ thuộc repository state |

### Tracked-program reconciliation procedure thuộc planning skill

Future planning-skill edit phải yêu cầu agent:

1. detect task có thuộc tracked program từ direct program/progress/problem/per-PR evidence;
2. đọc authoritative master source, current status/problem source và program-owned artifact convention theo exact read condition;
3. load cả exact per-PR `plan.md` và owner decision record khi chúng tồn tại;
4. reconcile material behavior, scope, ownership, dependency, acceptance, verification và permission giữa hai artifact;
5. coi brief `pending` là không có implementation permission và dừng khi hai artifact material conflict;
6. nếu explicit owner decision đổi material implementation contract, update detailed plan trong planning permission rồi re-review trước implementation;
7. không tạo per-PR artifacts, empty directory hoặc retrospective taxonomy nếu không có actual consumer.

Planning skill không được hard-code AW-specific filesystem layout; nó đọc convention do tracked program sở hữu. README không trở thành procedure owner.

### Context expansion trigger

Mở thêm source chỉ khi có evidence cụ thể:

- target link trực tiếp source khác;
- cùng contract có consumer ở boundary khác;
- repository/master plan/progress/problem/ADR đưa claim mâu thuẫn;
- task có thể thay source of truth, approved decision, dependency hoặc deferred scope;
- verification không chọn an toàn từ context hiện có;
- ownership, dirty change, base hoặc branch không rõ;
- activated skill route thêm source/skill bằng exact condition;
- external feedback cung cấp evidence về missing dependency.

Mỗi expansion record phải nêu source, evidence, câu hỏi và candidate status. Không broad-read bundle hoặc tạo source mới để hoàn thành taxonomy.

### `not applicable`

- Ghi trong plan/update/checkpoint khi việc source không tồn tại hoặc không áp dụng ảnh hưởng tới quyết định hoặc owner cần kiểm chứng.
- Không bắt task nhỏ độc lập liệt kê hàng loạt source không áp dụng.
- Không tạo file mới để biến một category `not applicable` thành “đã có source”.

## 10. Two-pass sizing và adaptive plan depth

### Observable sizing signals

| Size | Observable signals | Discovery/plan depth |
| --- | --- | --- |
| Nhỏ | Một source owner; behavior/permission/status/dependency không đổi; target và verification rõ; rollback cục bộ | Lightweight route → micro-discovery → micro-plan trong hành động/response → minimum review → targeted check |
| Vừa | Nhiều file nhưng một bounded contract; ownership ổn định; không material decision mới; targeted verification chứng minh đủ; rollback vẫn coherent | Targeted discovery → concise plan trong response/approved brief → implementation gate hiện có → minimum review + risk-relevant review |
| Lớn/rủi ro cao | Nhiều source owner hoặc dependency chain; permission/governance/security/DB/auth/concurrency/deferred scope; material decision; complex verification/rollback | Full relevant discovery → durable plan hoặc existing authoritative durable source → plan self-review → explicit owner/implementation gate → risk-based review |

Preliminary sizing diễn ra sau minimum preflight. Final sizing diễn ra trong discovery, sau khi source ownership/dependency/risk/verification đã đủ rõ và trước implementation.

Exact escalation triggers:

- thêm source of truth/owner;
- repository và approved source mâu thuẫn;
- material behavior/permission/architecture/dependency decision mới;
- deferred scope bị kéo vào;
- base/branch/dirty ownership không rõ;
- new trust/security/DB/auth/governance boundary;
- verification/manual QA/rollback phức tạp hơn;
- scenario không làm behavior an toàn/forbidden phân biệt được;
- structural refactor/reference hoặc out-of-scope tooling trở thành prerequisite.

Escalation chỉ đổi discovery/plan/review depth. Nó không tự cấp implementation, specialist, Git, remote, production hoặc destructive permission.

### Durable-plan decision

Durable plan bắt buộc khi task lớn/rủi ro cao cần continuity qua session/agent, nhiều source owner/dependency, exact permission contract, material decision, multi-phase order hoặc rollback boundary cần owner kiểm chứng.

Không tạo plan file khi:

- task nhỏ có intent/owner/verification rõ;
- task vừa có concise response plan hoặc approved brief đủ;
- authoritative existing plan đã sở hữu đầy đủ detail và không cần material revision;
- file mới chỉ duplicate master/progress/problem/ADR.

Nếu existing source thiếu material detail, update đúng owning source khi được phép hoặc tạo per-PR artifact theo repository convention; không tạo tracker/ADR/reference ngẫu nhiên.

### Owner gate

Owner gate bắt buộc trước implementation khi:

- task là planning-only/read-only;
- durable plan do agent viết hoặc material revision chưa được owner duyệt;
- behavior/permission/architecture/ownership/dependency/acceptance/verification decision mới;
- domain/high-risk action cần explicit permission;
- implementation permission chưa được nói rõ.

Plan approval không tự cấp implementation. Implementation permission không tự cấp stage, commit, push, PR, merge hoặc remote action.

Gate được đánh giá từ exact current owner instruction, không bắt buộc một lượt hội thoại thứ hai. Một instruction có thể đồng thời duyệt plan/material decision và cấp implementation permission nếu nói rõ cả hai; lifecycle không được phát minh thêm approval gate khi các quyền cần thiết đã đầy đủ.

## 11. Universal minimum self-review và review levels

### Universal minimum actual-change gate

Áp dụng cho mọi actual change set, bất kể initial/final size:

- intended file/hunk only;
- không unrelated cleanup/formatting;
- encoding, EOL, final newline và trailing whitespace đúng;
- không secret, debug artifact, conflict marker hoặc unexpected binary/generated file;
- docs/status/behavior claim khớp actual change và evidence;
- verification chọn theo actual risk, kể cả risk discovered sau sizing lần 1;
- staged/unstaged/untracked content được audit, không bỏ sót untracked file;
- không scope/permission/remote/destructive leak.

`docs/agent-loops.md` sở hữu invariant rằng gate này luôn diễn ra. `git-checkpoint-workflow` sở hữu exact Git/change-set audit procedure. Planning skill chỉ route plan/review depth, không duplicate Git commands.

### Phân biệt review

| Review type | Mục đích | Áp dụng | Owner |
| --- | --- | --- | --- |
| Minimum change-set review | Xác nhận actual diff chỉ chứa intent, sạch và được verify phù hợp | Mọi actual change | Lifecycle invariant + Git checkpoint procedure |
| Main integration review | Trace nhiều boundary và reconcile whole outcome | Multi-boundary implementation | `code-review-and-quality`; orchestration detail thuộc AW-PR3A |
| Formal implementation review | Finding taxonomy, verification status, readiness verdict | Checkpoint/branch/PR khi task/review route yêu cầu | `code-review-and-quality` |
| Specialist review | Một hard-risk cluster với bounded context | Chỉ sau main review và permission/trigger hợp lệ | AW-PR3A/AW-PR3B; không implement trong AW-PR2 |

Hard-risk discovery chỉ route domain skill và có thể tạo stop/owner question; nó không tự cho phép specialist.

## 12. Durable plan self-review và external feedback

### Durable plan self-review

Mọi durable plan phải được main agent review sau khi draft ổn định, đối chiếu:

- owner-confirmed goal/exclusions/permission;
- repository implementation facts;
- owning master plan, ADR, per-PR brief, progress/problem source;
- source ownership và không duplicate;
- dependency/order/baseline;
- observable acceptance criteria;
- automated verification/manual QA/fixture readiness khi áp dụng;
- permission/stop/rollback boundary;
- expected/forbidden files/domains;
- self-contradiction, stale claim, invented contract và hidden scope expansion.

Finding trong current planning permission được sửa rồi re-review. Material decision do agent đề xuất vẫn cần owner approval; self-review không cấp implementation permission.

### External feedback reconciliation

Trong AW-PR2, planning skill áp dụng contract dưới đây cho feedback về discovery/plan và nguyên tắc permission chung. Exact implementation-review orchestration, multi-reviewer reconciliation và specialist finding flow vẫn thuộc AW-PR3A/`code-review-and-quality`, không được copy vào planning skill ở PR này.

Mỗi feedback item được ghi như một claim và phân loại đúng một trong:

```text
đúng trong scope
đúng nhưng cần scope/decision mới
sai
stale
xung đột
không đủ evidence
```

Evidence priority:

1. higher-level safety/permission restriction và exact current owner instruction;
2. repository routing/lifecycle/domain skill theo source ownership và specificity;
3. owner-approved master plan/ADR/per-PR contract cho intended decision;
4. actual repository/Git behavior cho current implementation fact;
5. progress/problem tracker cho status/known issue trong ownership của chúng;
6. reviewer assertion chỉ là claim cho tới khi được source trên xác minh.

Chỉ sửa khi claim đúng và current permission cho phép correction. Dừng khi correction cần material scope/decision/permission mới. Không dùng majority vote; review verdict/confidence không cấp edit/commit/push/merge permission.

## 13. `AW-P001` pre-CP2 conflict inventory

| Source | Current contract | Conflict/gap | Safe interpretation trước AW-PR2 | Proposed correction owner |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | Commit owner-approved; push explicit; narrow exception là bounded small/safe loop khi owner yêu cầu PR creation/update plus CI watching | Không có material CI conflict; chỉ root route, không mode detail | Giữ exact narrow interpretation | CI permission wording audit unchanged; root route edited only for `AW-P002` |
| `docs/agent-loops.md` | CI Loop trigger là inspect/handle; “default inspection” lại có local fix; remote correction khi CI watching **hoặc** fixing; max `1-2` attempts | Inspect/watch/fix instruction hẹp có thể bị suy thành edit/commit/push; third-attempt override không rõ | Inspect/watch read-only; explicit fix chỉ action owner nói; max 2 | Lifecycle high-level mode + stop + route |
| `git-checkpoint-workflow` | Mọi commit/push cần owner approval/request | Nhìn như phủ định narrow exception; không cross-reference owner skill | Dùng stricter default; exception chỉ khi exact PR/CI mode activates | Add narrow cross-reference, no copied procedure |
| `github-pr-ci-workflow` | Combined create/update + watch cho bounded `branch-caused-small-safe` cycle; “normal push” wording còn có thể bao gồm initial push của already-committed branch; create/update-only không self-fix nhưng cũng có thể normal-push branch đó; default 2 attempts | PR-only và combined initial-push allowance trái root/Git separate-push rule; third attempt cho owner **hoặc** agent judgment; explicit fix-only inference chưa đủ rõ | PR-only no push; combined mode cũng no initial push; exception chỉ sau existing PR/check + `branch-caused-small-safe`; third attempt owner-only; explicit fix-only exact actions only | Exact procedure/mode/attempt owner |

Không có master-plan contradiction cần sửa. Conflict là scheduled implementation scope, không phải blocker cho plan.

## 14. Pre-CP2 contract mode matrix

`Mơ hồ` dưới đây là drift phải được AW-PR2 loại bỏ; safe interim behavior vẫn theo [problems.md](../../problems.md).

| Mode | Read logs? | Edit local? | Run validation? | Commit? | Push? | Watch again? | Merge? | Owner permission hiện cần | Exact procedure owner hiện tại | Stop condition hiện tại |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. inspect-only | Có | `Mơ hồ` ở lifecycle; `Không` theo safe interim/GH exception | `Mơ hồ` | Không | Không | Không | Không | Explicit inspect/read request | Lifecycle trigger + GH read commands | Safe interim stops before mutation |
| 2. watch-only | Có | Không theo safe interim; lifecycle remote wording còn mơ hồ | Không | `Mơ hồ` ở lifecycle; không theo narrow exception | `Mơ hồ` ở lifecycle; không theo narrow exception | Có, tới terminal state | Không | Explicit watch request | GH watch/report; lifecycle mode | Terminal/fail/blocked; safe interim does not fix |
| 3. create PR only | Không mặc định | Không self-fix | Chỉ preflight cần cho clean committed branch, không fix validation | Không tạo fix commit | Có thể normal-push **already-committed clean branch** nếu PR creation cần và normal conditions pass | Không | Không | Explicit create PR | GH creation + Git push safety | Dirty/unclear/missing branch stops; otherwise create/report |
| 4. update PR only | Không mặc định | Không self-fix | Không mặc định | Không tạo fix commit | Chỉ already-committed branch khi exact update requires và normal conditions pass; metadata-only không push | Không | Không | Explicit update PR | GH update + Git push safety | Dirty/unclear state stops; otherwise update/report |
| 5. create/update PR + CI watching | Có | Chỉ `branch-caused-small-safe` sau failed-log classification | Có, focused | Có, focused English Conventional Commit | Current wording có thể cho initial push hoặc self-fix push; safe interim chỉ cho self-fix push sau existing PR/check | Có | Không | Exact combined request; safe interim vẫn cần explicit permission cho initial push | GH exact cycle/taxonomy + Git commit safety | Remote head thiếu thì dừng trước initial push; trước failed check/classification chỉ create/update/watch/report; sau đó stop cho mọi non-small-safe class, unclear risk hoặc limit |
| 6. explicit CI-fix instruction | Có | Chỉ action/scope owner nói | Có nếu edit được cấp | `Mơ hồ` giữa lifecycle và Git/GH narrow mode | `Mơ hồ` giữa lifecycle và Git/GH narrow mode | Chỉ khi owner nói | Không | Explicit fix scope; other actions unclear in current drift | GH triage/domain skill; Git owns separately approved commit/push | Safe interim stops before inferred commit/push/watch |
| 7. explicit commit only | Không mặc định | Không cấp edit mới | Confirm/run smallest current relevant checks | Có, owned existing change | Không | Không | Không | Explicit commit approval | Git checkpoint | Stop after local commit/report; no remote action |
| 8. explicit push only | Không mặc định | Không | Confirm branch/commits/state; không cấp fix | Không tạo commit mới | Có, exact normal push scope | Không | Không | Explicit push approval | Git checkpoint | Dirty/diverged/force-needed/unclear ownership stops |
| 9. explicit auto-merge | Đọc checks/review state | Không cấp edit | Không cấp local fix validation | Không cấp commit | Không cấp push | Chỉ check theo merge gate; không infer CI loop | Có nếu all gates pass | Explicit current-task auto-merge | GH merge procedure | Any inconclusive/failing/pending/protected/high-risk gate stops |
| 10. fix attempt 1 | Có | Có trong exact combined mode, small/safe only | Có | Có | Có | Có | Không | Combined mode or separately explicit action bundle | GH completed-cycle definition + Git safety | Reclassification/risk/scope expansion stops |
| 11. fix attempt 2 | Có | Có cùng constraints | Có | Có | Có | Có | Không | Same as attempt 1 | GH completed-cycle definition + Git safety | Default final attempt; stop/report if not green |
| 12. fix attempt 3 | Có | `Mơ hồ`: GH skill cho owner **hoặc** agent judgment; lifecycle says at most 1-2 | Có nếu được phép | Có nếu được phép | Có nếu được phép | Có nếu được phép | Không | Safe interim requires explicit owner permission | GH cycle + Git safety, but sources conflict on eligibility | No explicit owner permission means stop before edit |

## 15. Proposed permission-mode matrix

| Mode | Read logs? | Edit local? | Run validation? | Commit? | Push? | Watch again? | Merge? | Owner permission cần thiết | Exact procedure owner | Stop condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. inspect-only | Có | Không | Không; chỉ read-only diagnostics nếu không mutate | Không | Không | Không | Không | Explicit inspect/read request | Lifecycle routes; GH owns commands | Before any mutation; report evidence |
| 2. watch-only | Có | Không | Không | Không | Không | Có, tới terminal/blocked timeout | Không | Explicit watch request | Lifecycle mode; GH watch/report | On fail/pending-too-long/blocked; no fix |
| 3. create PR only | Không mặc định | Không | Chỉ non-mutating readiness/remote-head check | Không | Không | Không | Không | Explicit create PR; head branch phải đã tồn tại trên remote | GH owns create/check commands | Remote head missing, dirty/unclear state, hoặc CLI prompt đề nghị push/fork → stop và xin explicit permission |
| 4. update PR only | Không mặc định | Không | Không mặc định; metadata/state check only | Không | Không | Không | Không | Explicit requested metadata/state update | GH owns edit/check commands | Requested update cần new commit/push hoặc CLI prompt remote mutation ngoài request → stop |
| 5. create/update PR + CI watching | Có | Chỉ `branch-caused-small-safe` trong PR scope, sau failed-log classification | Có, focused on failure | Có, focused fix | **Không** initial push; chỉ normal same-branch push của focused self-fix sau existing PR/check | Có, sau self-fix | Không | Exact combined request; initial push vẫn cần explicit push permission riêng | GH owns exact cycle/taxonomy; Git owns commit safety | Remote head thiếu → stop xin push permission; trước failed check/classification chỉ create/update/watch/report; sau đó any non-small-safe class, unclear root cause hoặc limit → stop |
| 6. explicit CI-fix instruction | Có | Chỉ exact fix action/scope owner nói | Có, proportional to allowed edit | Chỉ khi owner cũng says commit | Chỉ khi owner also says push | Chỉ khi owner also says watch | Không | Each action separately explicit | GH triage; domain/Git procedure as activated | Before any ungranted action or scope expansion |
| 7. explicit commit only | Không mặc định | Không cấp edit mới | Có/confirm smallest relevant check for owned change | Có | Không | Không | Không | Explicit commit approval | Git checkpoint | After local commit/report; no remote action |
| 8. explicit push only | Không mặc định | Không | Confirm exact branch/commits/remote state | Không tạo commit mới | Có, normal exact branch | Không | Không | Explicit push approval | Git checkpoint | If dirty/diverged/force needed/ownership unclear |
| 9. explicit auto-merge | Đọc check/review/merge state | Không cấp edit | Không cấp fix validation | Không cấp commit | Không cấp push | Không tự thành watch/fix mode | Có only if all merge gates pass | Explicit current-task auto-merge | GH merge procedure | Any failed/pending/inconclusive/protected/high-risk gate |
| 10. fix attempt 1 | Có | Smallest `branch-caused-small-safe` fix only | Có | Có | Có | Có | Không | Covered only by combined mode or separately explicit actions | GH exact cycle | Stop/reclassify if risk/scope changes |
| 11. fix attempt 2 | Có | Same narrow boundary | Có | Có | Có | Có | Không | Covered only by combined mode or separately explicit actions | GH exact cycle | Default limit reached; stop/report if not green |
| 12. fix attempt 3 | Có | Only same narrow boundary **after explicit owner permission** | Có | Có | Có | Có | Không | Explicit third-attempt permission | GH exact cycle | No permission means stop before edit; all other stop rules remain |

Global invariants cho mọi mode:

- không force-push, branch deletion hoặc unrelated cleanup;
- create PR only và update PR only không cấp push; interactive CLI push/fork path phải bị từ chối và report;
- combined PR action + CI watching không cấp initial push; narrow commit/push exception chỉ bắt đầu sau khi PR/check tồn tại, failed logs đã được đọc và failure được phân loại `branch-caused-small-safe`;
- merge là separate permission mode;
- không DB/RLS/RPC/migration/production-risk change trong generic self-fix;
- không self-fix `branch-caused-large-risky`, `unrelated-main`, `infra-flaky`, `secret-env-config`, `db-risk` hoặc `unclear`;
- không đổi exact seven-value CI failure taxonomy;
- attempt là một **completed** `logs → edit → local validation → commit → push → re-watch` cycle; đọc log hoặc reverted local experiment không tính completed attempt nhưng phải report khi relevant.

## 16. Adaptive workflow scenario matrix

| Scenario | Context phải đọc | Initial size | Final size | Plan depth | Review depth | Owner gate | Stop condition | Specialist decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Sửa typo độc lập | Root/nested instructions, target file, exact local context; Git state nếu sửa | Nhỏ | Nhỏ nếu no contract/status change | Micro-flow, không plan file | Minimum change-set review | Existing edit permission đủ; Git actions separate | Typo hóa ra đổi meaning/source claim | 0; không signal |
| 2. Sửa owner-facing template trong một skill | Root, lifecycle if output phase affected, `maintain-repo-skills`, target skill, direct reporting owner, Git state | Vừa | Vừa nếu one bounded output contract; lớn nếu permission/taxonomy drift | Concise plan/brief; durable only if multi-source material | Minimum + targeted governance/formal review as requested | Skill edit permission; material wording decision nếu có | Template conflicts root/lifecycle or needs reference split | 0 mặc định; hard-risk chỉ được đề xuất sau main review |
| 3. Thay source ownership của docs | Root, lifecycle, planning + governance skill, master/progress/problem/ADR/per-PR owners có liên quan, Git state | Lớn/rủi ro cao | Lớn/rủi ro cao | Durable plan | Plan self-review + formal implementation review | Explicit owner decision + implementation permission | Duplicate source, unresolved authority, invented source | 0 mặc định; AW-PR3A rules if later authorized |
| 4. Nhiều file, một bounded contract | Instructions, owning skill/docs, direct consumers, targeted tests/verification, Git state | Vừa | Vừa nếu no new owner/risk; escalate otherwise | Concise response/brief, no automatic file | Minimum + targeted integration check | Existing implementation permission | New independent outcome/dependency/rollback appears | 0 unless hard-risk remains and separately allowed |
| 5. DB/RLS/auth/permission change | Root/lifecycle/planning, exact domain skill(s), migrations/schema/code/tests, ADR/plan/progress/problem as triggered, Git | Lớn/rủi ro cao | Lớn/rủi ro cao | Durable plan | Main integration + domain/formal review | Explicit high-risk implementation/DB/remote permissions | Missing ownership, unsafe migration/RLS/auth decision, unclear production impact | Domain skill activates; specialist is **not** auto-authorized |
| 6. Discovery phát hiện deferred scope | Current task sources + deferred owner source + master/progress/problem if program-tracked | Initial nhỏ/vừa | Lớn hoặc blocked | Durable revision only if owner approves expansion | Plan self-review | Material scope decision required | Stop before implementation; do not pull deferred item in | 0; specialist cannot decide owner scope |
| 7. Repository mâu thuẫn progress/master plan | Root/lifecycle/planning, repository facts, master, progress, problem, Git/history | Vừa/lớn | Lớn hoặc blocked | Durable reconciliation proposal | Plan self-review against ownership | Owner decision if intended behavior conflicts; descriptive stale status may update only with permission | Cannot tell stale fact vs changed decision | 0; evidence/owner resolves, not majority vote |
| 8. Base/branch ownership không rõ | Git status/branch/HEAD/local+origin main/upstream/history, Git skill, PR state if relevant | Vừa | Blocked/high-risk | No implementation plan mutation until baseline resolves | Read-only Git audit | Owner decision/permission if base cannot be inferred from approved source | Dirty ownership unclear, dependency unmerged, divergence or branch collision | 0; stop/report now; later package only under separately authorized orchestration |
| 9. Planning delivery chuyển sang implementation | Master plan, progress/problem, implementation-plan README, exact per-PR plan + owner record, Git/remote branch state | Lớn/rủi ro cao | Lớn hoặc blocked | Existing durable plan; không tạo duplicate | Whole planning-package review + future implementation preflight | Plan decision, từng planning delivery action và implementation permission tách riêng | Planning PR chưa merge, main chưa sync, wrong branch/base hoặc planning artifact xuất hiện mà không có approved amendment/history purpose | 0; dependency/permission evidence quyết định |
| 10. Combined PR + CI watching nhưng remote head chưa tồn tại | Root/Git/GH permission sources, exact owner instruction, branch/remote/PR/check state | Vừa | Blocked trước PR/CI loop | Không sửa plan; xin exact push permission | Read-only Git/remote audit | Explicit initial-push permission | CLI cần push/fork, chưa có PR/check hoặc chưa có failed-log classification | 0; permission evidence giải quyết |
| 11. Preflight/review phát hiện cần thêm behavior file | Exact plan/brief, changed-file classification, direct evidence của proposed file, Git state | Lớn/rủi ro cao | Blocked trước mutation ngoài approved scope | Revised durable plan/scope chỉ sau owner decision | Read-only scope reconciliation | Owner duyệt revised changed-file set và implementation permission | Historical instance: `AGENTS.md` became file 7 and was approved on 2026-07-21; any file 8 or other category change stops again | 0; specialist không thay owner scope decision |

## 17. Changed-file classification và exact file plan

| File | Classification | Exact planned change | Must not change |
| --- | --- | --- | --- |
| `AGENTS.md` | `required change` — amendment 2026-07-21 | Require every repository task to load lifecycle and apply `Universal Lightweight Preflight` before action/depth choice; retain conditional list only for detailed loops | No preflight procedure, mode matrix, command, CI cycle or planning checklist duplication |
| `docs/agent-loops.md` | `required change` | Add concise Loop 0 preflight/two-pass sizing/adaptive gate route; tracked-program route is one short subsection/paragraph plus at most a few bullets; add universal minimum review invariant; rewrite Loop 3 high-level modes/stop/default attempt cap and route to GH owner | No exact layout, read/reconciliation procedure, matrices, commands, taxonomy, self-fix cycle or specialist package |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | `required change` | Add detailed context read/expansion, tracked-program convention/per-PR plan/owner-record loading and reconciliation, pending/conflict/material-decision handling, two-pass sizing, adaptive plan/durable decision, plan self-review, feedback classification, owner/implementation gate | No AW-specific filesystem layout, Git/CI command procedure, formal implementation review, domain signals or references |
| `.agents/skills/git-checkpoint-workflow/SKILL.md` | `required change` | Preserve default explicit commit/push approval; add explicit cross-reference to only narrow GH exception; make the actual-change audit explicitly cover intended hunk, unrelated formatting, encoding/EOL, secret/debug/conflict marker, claim accuracy, risk-based verification, staged/unstaged/untracked and permission/scope leak | No duplicated CI modes/taxonomy/cycle/attempt details |
| `.agents/skills/github-pr-ci-workflow/SKILL.md` | `required change` | Make inspect/watch/create/update/combined/fix-only modes exact; PR-only và combined modes cannot initial-push and must reject interactive push/fork; preserve normal same-branch push only inside the post-failure bounded self-fix cycle; remove agent-judgment third attempt | No taxonomy/GHA/auto-merge/force/DB-risk expansion |
| `.agents/skills/code-review-and-quality/SKILL.md` | `audit only` | Verify formal review ownership remains distinct and no AW-PR2 wording forces specialist orchestration | No AW-PR3A/AW-PR3B change |
| `docs/agent-workflow/progress.md` | `required change` | On the implementation branch, record actual permission/checkpoint/verification/delivery states only when evidenced; preserve distinction from already-merged planning delivery | No future action as complete; no intended behavior copy; separate planning/history files from behavior-scope accounting |
| `docs/agent-workflow/problems.md` | `required change` | Keep `confirmed/scheduled/AW-PR2` until implementation begins; move to `in progress` only with valid implementation start; mark `resolved/completed` only after four-source + verification closure evidence including PR-only no-push | No premature resolution; no procedure duplication |
| `docs/agent-workflow/plan.md` | `audit only` | Confirm no material contradiction; no edit planned | No detailed implementation expansion or status update |
| `.github/workflows/**`, product/runtime/test/DB files | `excluded` | None | Any change is scope leak and stop condition |

Historical six-file decision gồm lifecycle, planning skill, Git skill, GitHub PR/CI skill, progress và problems. Current behavior/tracker set là đúng bảy file trong bảng trên sau khi thêm duy nhất `AGENTS.md`; remaining audit-only sources là `code-review-and-quality` và master plan với tư cách behavior source.

Planning/history amendment files ngoài seven-file behavior set là `docs/agent-workflow/plan.md`, file này và `owner-review-brief.md`. `progress.md` cùng `problems.md` vừa thuộc seven-file tracker scope vừa ghi actual history theo ownership. Cumulative branch changed-file set phải được lấy từ Git và báo riêng; không được gọi toàn bộ cumulative set là exact seven-file behavior diff. Nếu cần behavior file thứ tám hoặc excluded source, dừng và xin owner duyệt revised scope trước mutation đó.

## 18. Implementation order

1. Historical completed gate: planning-only PR merged; local `main` synchronized; `feat/agent-workflow-aw-pr2` created from `b10be2654d1a1c2291f1483e82ade3d0404cc151`; original six-file scope approved.
2. Historical CP1/CP1R: edit `docs/agent-loops.md` and planning skill, update trackers, verify, commit and normal-push through remote HEAD `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.
3. Post-implementation review gate: preserve the blocked finding, obtain owner amendment, revise master/per-PR/owner decision sources and create `AW-P002` before root mutation.
4. Apply the minimum `AGENTS.md` route as behavior file 7; keep lifecycle procedure unchanged unless direct consistency evidence requires a narrow correction.
5. Verify root-to-lifecycle typo scenario, same-instruction implementation, source ownership, seven-file scope versus cumulative Git diff, `AW-P001`/`AW-P002` separation and all documentation/skill checks.
6. Formal self-review the amendment/root correction; update progress/problem evidence only from actual results; create a local correction checkpoint only when 0 Critical/Required remain.
7. Historical stop gate đã được owner mở bằng instruction ngày 2026-07-22. Reconcile `git-checkpoint-workflow/SKILL.md` và `github-pr-ci-workflow/SKILL.md` trong cùng logical change set với lifecycle để default boundary và narrow exception không trở thành competing final contracts; stop before CP3.

## 19. Acceptance criteria

### Lifecycle/context/planning

- Root `AGENTS.md` requires every repository task, including a typo-only edit, to load `docs/agent-loops.md` and apply `Universal Lightweight Preflight` before action or discovery-depth choice; conditional bullets route only the later detailed loops.
- A typo-only task can decide that master plan, progress, browser, DB and specialist context are unnecessary without listing them mechanically.
- A governance/source-ownership change loads all direct authoritative sources and records why each expansion occurred.
- A tracked-program implementation reads the program convention, exact per-PR plan and owner decision record when present; pending/conflicting records stop implementation, while material owner changes update/re-review the detailed plan.
- Preliminary sizing happens after routing; final sizing happens during discovery before implementation.
- New owner/source/dependency/permission/deferred/risk/verification signals force reclassification or stop.
- File count is never the only sizing rule.
- Small tasks keep a micro-flow; medium tasks may keep a concise in-response/brief plan; high-risk tasks use an existing or new durable authoritative plan.
- A plan file is not a universal implementation gate and duplicate sources are not created.
- Every actual change set receives the universal minimum self-review.
- Durable plan self-review checks ownership, evidence, dependency, criteria, verification, permission, scope and contradiction.
- External feedback is classified as a claim and reconciled by evidence/source ownership/owner decision, not majority vote.
- Plan/review verdict never grants implementation/Git/remote permission.

### `AW-P001`

- Inspect-only is read-only.
- Watch-only cannot edit, validate fixes, commit or push.
- Create PR only requires an existing remote head and cannot edit, commit or push; an interactive push/fork path stops for permission.
- Update PR only changes exact requested metadata/state and cannot edit local content, commit or push; required commit delivery stops for explicit push permission.
- Combined create/update + CI watching không cấp initial push. Chỉ sau khi remote head/PR/check tồn tại và failed logs phân loại failure là `branch-caused-small-safe`, mode này mới cho focused validation/commit/normal same-branch push/re-watch.
- Explicit fix-only grants only exact actions owner states; commit/push/watch are not inferred.
- Default maximum is 2 completed attempts; attempt 3 requires explicit owner permission.
- Merge remains a separate permission mode.
- `git-checkpoint-workflow` default owner-approved contract and GH narrow exception no longer appear contradictory.
- `docs/agent-loops.md` routes high-level mode/stop only; GH skill owns exact command/classification/cycle/attempt procedure.
- Exact CI taxonomy, combined self-fix normal-push conditions, auto-merge safeguards, no-force/no-delete/no-DB/no-large-risky boundaries remain unchanged.

### Scope/structure/status

- Historical planning-only PR merged before implementation branch creation; `feat/agent-workflow-aw-pr2` started from updated `main`.
- Historical six-file decision and its invalidated `AGENTS.md` audit-only assumption remain visible. Current behavior/tracker scope is seven files after the dated owner amendment; planning/history-only files are not counted in that behavior set.
- Cumulative branch changed-file reporting distinguishes the seven behavior/tracker contract from authorized amendment/history documents and uses actual Git evidence rather than claiming an exact seven-file cumulative diff.
- Exact revised file-set gate is complete before the `AGENTS.md` mutation. If file 8, another audit-only source or an excluded source becomes necessary, stop before that mutation and obtain another revised plan/scope decision.
- No reference/file split/rename/move/structural refactor occurs in skill bundles.
- `AW-P001` is `confirmed/in progress/AW-PR2` after authorized implementation began and closes only from current four-source verification evidence in CP2/CP3.
- `AW-P002` remains separate from `AW-P001`, records the root-routing defect/history and closes only after root-to-lifecycle routing plus proportional verification pass.
- Progress separates `implemented`, `verified`, `committed`, `pushed`, `PR open` and `merged`.
- No AW-PR3A/AW-PR3B, product, runtime, test, DB or GitHub Actions workflow scope appears in diff.

## 20. Verification strategy

### Implementation verification

Run only after actual AW-PR2 implementation changes exist:

1. `node .agents/scripts/validate-skill.mjs` — all current skill bundles remain structurally `valid`.
2. `git diff --check` — whitespace/error audit.
3. Strict UTF-8 decode, final newline, trailing whitespace and EOL audit for every changed file.
4. Markdown heading/fence and relative-link target audit.
5. Conflict-marker and secret-oriented actual-diff audit.
6. `git status --short`, branch/baseline and unstaged/staged/untracked audit; current branch must be `feat/agent-workflow-aw-pr2`. Compare the seven behavior/tracker files in section 17 with actual cumulative Git files, and classify authorized planning/history amendment documents separately.
7. Targeted ownership search: lifecycle must not copy detailed planning or CI procedure; planning must not copy domain/formal-review procedure; Git skill must not copy self-fix cycle.
8. Targeted dependency/status search: AW-PR1 must be merged baseline; AW-PR2 must not be marked implemented/verified before evidence.
9. Targeted CI permission search: no inspect/watch mutation; no create/update-only push/self-fix; no combined initial push; no interactive push/fork acceptance; combined exception only after existing PR/check + `branch-caused-small-safe`; no explicit-fix commit/push inference; no agent-judgment third attempt; no `1-2` vs `3` conflict.
10. `AW-P001` search: correct state transition and target; no premature `resolved/completed`.
11. Scope search: no AW-PR3A specialist package/orchestration or AW-PR3B domain signal added.
12. Structural search/change-status: no `references/`, rename, move or new skill bundle file.
13. Scenario review of all eleven adaptive scenarios and all twelve CI modes in sections 15–16.
14. Fresh-reader procedure assessment for material permission/routing behavior. If no qualified separate executor and authorization exist, record `fresh-reader: not_run` with actual reason; never relabel main self-review as fresh-reader evidence.
15. Root-route scenarios: a typo-only repository task must load lifecycle before mutation; the conditional list must still route detailed planning/checkpoint/review/CI loops only after universal preflight; a same-instruction implementation grant must not imply Git/remote permission.
16. Problem/status audit: `AW-P001` remains the CI-permission problem; `AW-P002` alone owns the root-routing defect; historical `609e5ea…` remote evidence and any later local-only correction state must not be conflated.

Do not run application Vitest/build/browser/E2E/Supabase because planned changes are governance Markdown only. Do not modify CI to make skill validation run.

### Historical planning-document correction verification — 2026-07-18

- `git diff --check`;
- strict UTF-8/final newline/trailing whitespace/EOL;
- Markdown heading/fence/relative-link;
- conflict marker/secret-oriented diff;
- changed-file/untracked audit;
- targeted old branch/single-PR delivery, historical-six versus current-seven scope, cumulative-file accounting, ambiguous `approved`, duplicate ownership, root preflight route, PR-only push, CI attempt/permission, AW-P001/AW-P002 separation, AW-PR3A/3B, reference/rename/move và invented-permission searches.

`node .agents/scripts/validate-skill.mjs`: `not_run` cho planning task vì actual change chỉ tổ chức lại planning documents ngoài skill bundle; chạy validator không chứng minh semantic quality của plan. Application checks cũng `not_run` vì không có runtime change.

## 21. Progress/problem update plan

- Historical planning-document delivery ghi exact per-PR six-file decision `approved`; planning-only PR merge không tự implement behavior. Authorized implementation sau đó chuyển `AW-P001` thành `confirmed/in progress`.
- Amendment ngày 2026-07-21 phải ghi review baseline local/upstream/remote `609e5ea…`, CP1R đã pushed, historical six-file preflight bị invalidated, current seven-file behavior scope, exact permission boundaries và cumulative changed-file accounting.
- `problems.md` tạo `AW-P002` riêng cho universal-preflight root-routing gap; không gộp vào `AW-P001`. Record giữ discovery/blocked history, owner-approved amendment, safe interim, closure criteria và current verified state khi evidence đủ.
- Planning delivery fields chỉ phản ánh current checkpoint. Sau mỗi authorized commit/push/PR/merge action, `progress.md` chỉ được cập nhật từ evidence thực tế trong một follow-up được cấp quyền; không pre-record `committed`, `pushed`, `PR open` hoặc `merged` trong chính action chưa xảy ra.
- Owner đã cấp AW-PR2 implementation permission; progress/problem hiện phải phản ánh branch/base và in-progress state bằng evidence thực tế.
- Khi behavior files hoàn tất nhưng verification chưa đủ: `implemented=yes`, `verified=no`; problem chưa được `resolved/completed`.
- Chỉ sau exact four-source audit, scenario checks, validator/docs checks trong CP2 **và** cumulative seven-file integration/closure evidence trong một CP3 được owner cho phép: `AW-P001` → problem `resolved`, handling `completed`; `progress.md` → AW-PR2 `verified=yes`.
- `committed`, `pushed`, `PR open`, `merged` chỉ thay đổi sau action có evidence; không suy từ review verdict.
- AW-PR1 merged state đã được sửa từ fetched Git evidence trong planning correction này; không chờ future implementation để duy trì stale tracker.

## 22. Rollback boundary

- Planning-only PR và future implementation PR là hai rollback units độc lập. Revert planning delivery chỉ loại convention/per-PR planning artifacts/status correction; nó không phải behavior rollback.
- Revised AW-PR2 behavior contract là một coherent seven-file target; khi hoàn tất, behavior rollback phải gồm root route cùng lifecycle + planning + Git + PR/CI behavior và tracker evidence để không tái tạo routing/permission drift.
- Tracker rollback/update phải phản ánh actual repository state sau revert; không để `AW-P001 resolved/completed` nếu affected sources lại drift.
- Không partial-revert chỉ attempt rule hoặc chỉ Git cross-reference khi điều đó làm four-source matrix mâu thuẫn.
- Master plan, detailed plan và owner brief hiện có amendment/history changes ngoài behavior set; rollback chúng theo planning-history ownership, không gộp như behavior files. Product/runtime/test/DB/CI workflow vẫn không thay đổi.
- Planning/history artifacts có thể được giữ làm historical decision/amendment record nếu behavior commit bị revert; progress/problem phải ghi rollback evidence. Không partial-revert planning artifact như thể nó là một trong seven behavior files.
- Không amend/squash/force-push mặc định; correction/revert Git action cần owner permission theo owning workflow.
- Structural rollback là direct `SKILL.md`/docs text revert; không tạo reference workaround.

## 23. Stop conditions

Dừng và báo owner nếu:

- PR #56/AW-PR1 dependency hoặc synchronized base không còn xác định được;
- historical planning merge/synchronized-base evidence không xác minh được, current branch không phải `feat/agent-workflow-aw-pr2`, hoặc merge-base không phải updated `main` đã ghi;
- working tree có dirty change với ownership không rõ;
- master plan và owner-confirmed requirement có material conflict;
- một remaining audit-only/excluded file cần material edit hoặc behavior set phải mở rộng quá bảy file; dừng trước mutation đó và xin owner duyệt revised scope;
- planning/history artifact xuất hiện trong cumulative diff mà không có amendment/history ownership rõ, hoặc bị mô tả sai như một behavior file;
- AW-PR2 cần specialist orchestration/multi-reviewer behavior thuộc AW-PR3A;
- AW-PR2 cần domain signal thuộc AW-PR3B;
- cần reference split, rename/move hoặc structural refactor;
- cần đổi CI failure taxonomy, combined self-fix normal-push conditions hoặc mở rộng self-fix permission;
- create/update-only vẫn suy ra push, combined mode vẫn suy ra initial push, hoặc một interactive CLI path có thể push/fork mà không có explicit permission;
- scenario không phân biệt rõ allowed/forbidden behavior;
- cần runtime/tooling/product/test/DB/GitHub Actions/production/remote change;
- cần implementation, stage, commit, push, PR, merge hoặc specialist permission chưa được cấp;
- fresh-reader/evidence claim đòi isolation/executor không available; ghi `not_run`, không invent evidence;
- main implementation review còn Nghiêm trọng (`Critical`) hoặc Bắt buộc (`Required`) unresolved;
- verification failure cần scope/decision mới.

## 24. Open owner decisions

Không còn authoring question chưa giải quyết; original six-file decision ngày 2026-07-18 và seven-file amendment ngày 2026-07-21 đều có explicit owner evidence và vẫn tách biệt với master-program `approved=yes`.

Delivery/implementation sequence cần owner action riêng:

1. CP1R2 correction và one-time normal push đã hoàn tất; permission push đó đã được tiêu thụ;
2. CP2 có implementation permission và conditional local checkpoint permission theo instruction ngày 2026-07-22; không có push, PR, CI-watch, merge hoặc CP3 permission.

Owner có thể gộp nhiều permission trong một instruction rõ ràng, nhưng agent không được thực hiện action trước prerequisite hoặc suy action không được nêu.

Fresh-reader executor/specialist permission không được suy ra. Nếu owner muốn fresh-reader evidence `passed` thay vì `not_run`, cần permission riêng cho một bounded read-only executor ở implementation checkpoint.

## 25. Specialist decision

Quyết định hiện tại: `0 specialist`.

Lý do:

- main-only discovery đã xác định exact source ownership, dependency, conflict literals, mode matrix, scope và verification;
- không còn hard-risk cluster mà repository/master-plan evidence không giải quyết được;
- không có unresolved DB/auth/security/architecture behavior;
- specialist orchestration chính là later scope AW-PR3A và task hiện tại cấm reviewer/sub-agent;
- gọi specialist sẽ không thay owner permission gate hoặc exact four-source evidence.

Không chuẩn bị bounded package vì chưa có 1–3 câu hỏi material chưa được trả lời. Nếu implementation discovery tạo hard-risk mới trước khi AW-PR3A tồn tại, dừng và chỉ đề xuất bounded read-only package theo approved master-plan format; không implement AW-PR3A và không tự spawn.

## 26. Implementation gate và handoff

Implementation agent chỉ được bắt đầu khi tất cả điều kiện sau đúng:

- owner đã approve exact plan/material behavior; current owner record đã đáp ứng riêng điều kiện này nhưng không đáp ứng các permission/delivery gate còn lại;
- planning-only PR chứa exact artifact này đã merge vào `main`;
- local `main` đã được fetch/sync fast-forward-only và bằng `origin/main`;
- current branch là `feat/agent-workflow-aw-pr2`, được tạo từ updated `main`, không phải planning branch;
- owner đã cấp hoặc revalidate implementation permission riêng cho merged exact plan;
- PR #56 merge commit vẫn có trong current baseline;
- branch/base/dirty ownership rõ;
- exact current behavior/tracker set là bảy file ở section 17; original six-file decision và dated amendment remain auditable;
- không có stop condition section 23;
- AW-PR3A/AW-PR3B và structural exclusions vẫn giữ nguyên.

Implementation checkpoint phải báo riêng seven-file behavior/tracker contract, planning/history amendment files và actual cumulative Git changed-file set; không được gọi cumulative diff là exact seven-file diff nếu có planning/history documents. Report actual verification, skipped checks/evidence limits, remaining risks và current Git/remote state. Current instruction permits CP2 implementation và local checkpoint after zero blockers; nó không cấp push/PR/CI-watch/merge, không kích hoạt combined PR+CI exception và không mở CP3.

## 27. Historical main plan self-review record — 2026-07-18

Review range: toàn bộ six-document planning correction, gồm [owner-review-brief.md](./owner-review-brief.md), directory index, full specification, master plan, progress và problems; đối chiếu `AGENTS.md`, `docs/agent-loops.md`, năm routed skills, hai conditionally required governance references, PR #55/#56 Git evidence và fetched current Git state.

Checklist:

- source ownership và no-duplication;
- AW-PR1 dependency/baseline;
- planning-only branch/PR, merge dependency và future implementation branch;
- master-program approval, per-PR plan decision, implementation và Git/remote permission separation;
- exact CI modes và attempt 2/3 boundary;
- create/update-only no-push, combined no-initial-push, post-failure exception và interactive CLI stop;
- AW-PR2/AW-PR3A/AW-PR3B separation;
- historical planning files versus original future six-file implementation scope;
- acceptance/verification/status/rollback/stop gates;
- no reference split/structural refactor;
- no invented implementation/Git/remote permission;
- no self-contradiction/stale claim/hidden scope.

### Review-claim reconciliation

| Claim | Kết luận | Evidence và correction |
| --- | --- | --- |
| PR create/update không tự cấp push | `chấp nhận` | Root/Git rule restrictive hơn GH current wording; future PR-only modes no-push, combined exception giữ nguyên |
| Planning và implementation delivery phải tách | `chấp nhận một phần` | Planning PR merge là hard dependency; permission có thể cấp có điều kiện sớm nhưng chỉ dùng sau merge/sync/revalidation |
| Approval states phải rõ | `chấp nhận` | `approved=yes` chỉ master-program; per-PR decision, planning delivery và implementation/Git permission tách riêng |
| Per-PR structure cần routing/ownership | `chấp nhận một phần` | README owns layout/route, planning skill owns generic procedure, lifecycle route concise, progress/problems giữ status ownership |
| Owner brief và detailed plan phải reconcile | `chấp nhận` | Brief 104 dòng, không copy full mode matrix; material owner change phải update/re-review detailed plan |
| Combined PR + CI watching có tự cấp initial push | `chấp nhận` | Root/Git boundary và owner decision đều giữ push riêng; narrow exception chỉ bắt đầu sau existing PR/check và `branch-caused-small-safe` classification |
| `problems.md` có hiệu lực gì sau planning-only PR merge | `chấp nhận một phần` | Safe interim trở thành authoritative trong problem-tracker ownership ngay khi merge, nhưng không implement lifecycle/skill behavior, không cấp permission và không resolve `AW-P001` |

### Findings từ draft ban đầu đã sửa

| Finding | Severity | Correction |
| --- | --- | --- |
| Current mode matrix gộp permission/procedure owner/stop | Bắt buộc (`Required`) | Tách thành exact columns cho cả 12 mode |
| Owner gate có thể bị hiểu là bắt buộc thêm một conversation turn | Bắt buộc (`Required`) | Ghi rõ một current instruction có thể đồng thời duyệt decision và cấp implementation permission |
| Git minimum audit còn “if needed” | Bắt buộc (`Required`) | Chốt exact audit fields trong required file plan |
| Feedback/specialist wording có thể lấn AW-PR3A | Bắt buộc (`Required`) | Giới hạn AW-PR2 vào plan feedback/common permission principle và stop trước orchestration |
| Problem transition dùng “có thể” thay vì exact state change | Bắt buộc (`Required`) | Chốt `scheduled → in progress` khi implementation thực sự bắt đầu |
| Base/branch scenario dựa vào AW-PR3A trước dependency | Bắt buộc (`Required`) | Chốt stop/report; later package cần orchestration permission riêng |
| Owner brief vượt target ban đầu sau khi thêm decision record | Bắt buộc (`Required`) | Bỏ duplicate matrix/status detail; brief ở pass đó còn 98 dòng, current brief là 104 dòng sau khi tách explicit permission fields |
| Moved plan và directory index còn relative links theo depth cũ | Bắt buộc (`Required`) | Sửa link tới master/progress/problems và xác minh mọi target tồn tại |
| Một ký tự zero-width trong context record | Structural hygiene | Loại ký tự ẩn và re-run strict text audit |

### Findings của planning-document reconciliation đã sửa

| Finding | Severity | Correction |
| --- | --- | --- |
| Proposed create/update-only mode còn normal-push already-committed branch | Bắt buộc (`Required`) | Chốt no-push, existing remote head/metadata-only boundary và interactive push/fork stop |
| Plan dùng planning branch như implementation handoff trực tiếp | Bắt buộc (`Required`) | Tách planning-only PR → merge/sync → `feat/agent-workflow-aw-pr2` → implementation |
| `approved=yes` có thể bị đọc thành per-PR approval | Bắt buộc (`Required`) | Gắn `approved` với master-program và thêm exact per-PR/permission fields |
| Master plan, README, lifecycle và planning skill chưa chia route/procedure rõ | Bắt buộc (`Required`) | Master route ngắn; README layout; lifecycle short route; planning skill future detailed reconcile procedure |
| Brief đang xin implementation trong khi planning delivery chưa xong | Bắt buộc (`Required`) | Current review chỉ là per-PR planning contract; delivery và implementation permissions tách riêng |
| Progress còn ghi AW-PR1 open/unmerged và không có planning checkpoint | Bắt buộc (`Required`) | Ghi fetched merge evidence và current AW-PR2 planning-only state |
| `AW-P001` closure criteria bỏ sót PR-only push ambiguity | Bắt buộc (`Required`) | Bổ sung safe interim/closure mode, giữ `confirmed/scheduled/AW-PR2` |
| Apply-patch tạo mixed EOL trong ba tracked Markdown files | Bắt buộc (`Required`) | Normalize cơ học theo working-tree CRLF convention rồi re-run text checks |
| Combined mode còn có thể bị hiểu là cấp initial push | Bắt buộc (`Required`) | Tách initial publication khỏi post-failure self-fix; remote head thiếu thì stop xin push permission |
| Scope-expansion stop chưa bảo đảm xảy ra trước mọi mutation | Bắt buộc (`Required`) | Thêm read-only file-set preflight, scenario và acceptance/stop rule trước khi sửa bất kỳ file implementation nào |
| Owner decision record còn `pending` sau explicit approval | Bắt buộc (`Required`) | Ghi `approved` với exact evidence và giữ riêng mọi implementation/Git/remote permission ở `not granted` |
| `problems.md` interim guidance dễ bị hiểu là behavior implementation | Bắt buộc (`Required`) | Giới hạn authority vào problem-tracker ownership; không sửa procedure, cấp permission hoặc resolve state |
| No-check wording có thể buộc xin push dù remote head đã tồn tại | Bắt buộc (`Required`) | Chỉ remote-head absence kích hoạt initial-push stop; trước failed classification chỉ create/update/watch/report |
| Header còn giữ branch-rename permission từ correction pass trước | Bắt buộc (`Required`) | Thay bằng exact current permission: planning-doc reconciliation, decision record, verification và self-review |

### Historical re-review result

- Nghiêm trọng (`Critical`) còn lại: `0`.
- Bắt buộc (`Required`) còn lại: `0`.
- Đề xuất (`Suggestion`) còn lại: `0`.
- Tại thời điểm review lịch sử, owner brief và full specification khớp six planning files, original six implementation files, delivery sequence, permission matrix, exclusions, stop conditions và `approved` decision record; brief 104 dòng, gần target 50–100 và dưới giới hạn 150 dòng.
- Không còn stale old branch, single-PR delivery assumption, ambiguous `approved`, proposed PR-only/combined-initial push, duplicate ownership, premature `AW-P001` transition, attempt 2/3 conflict, hidden AW-PR3A/AW-PR3B scope hoặc structural workaround.
- Verification re-run pass: tracked `git diff --check`, no-index whitespace audit cho ba untracked artifacts, strict UTF-8/final-newline/trailing-whitespace/EOL, Markdown heading/fence/link/table, conflict/zero-width/secret pattern, targeted semantic assertions và exact changed-file/staged audit.
- Evidence limit: fresh-reader, specialist, skill validator và application checks đều `not_run` đúng scope; PR #56 CI không được re-assess trong pass này, còn merge/baseline được revalidated bằng fetched Git evidence.
- Self-review/re-review không cấp implementation, stage, commit, push, PR hoặc merge permission.

## 28. Post-implementation-review amendment self-review — 2026-07-21

Review range: amendment/root correction against `AGENTS.md`, lifecycle, current planning skill, master/per-PR plan, owner brief, progress/problems, Git checkpoint/governance/review workflows and local/upstream/remote baseline `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.

Confirmed corrections:

- original six-file decision remains historical; current owner-approved behavior/tracker scope is seven files with only `AGENTS.md` added;
- root now routes every repository task to lifecycle preflight before action/depth choice while the existing list still routes detailed loops;
- `AW-P002` owns the root-routing defect separately from `AW-P001`;
- CP1R pushed state and remote HEAD evidence are current;
- cumulative branch accounting distinguishes five currently changed behavior/tracker files, three planning/history-only amendment files and the two CP2 behavior files not yet changed;
- permission remains limited to this correction and conditional local checkpoint; CP2, push, PR, CI watch, merge, specialist and remote actions remain ungranted.

Findings corrected during self-review:

| Finding | Severity | Correction |
| --- | --- | --- |
| Patch introduced mixed EOL in changed Markdown | Bắt buộc (`Required`) | Normalize all six current correction files to UTF-8 no-BOM CRLF and rerun text checks |
| AW-P001 matrix still said root was `Audit unchanged` | Bắt buộc (`Required`) | Limit unchanged claim to CI-permission wording and identify root edit as AW-P002-only |
| Historical forward-looking branch/six-file wording remained ambiguous | Bắt buộc (`Required`) | Label historical facts explicitly and route current state to the seven-file amendment/cumulative accounting |
| Initial closure-status patch matched the AW-P001 table instead of AW-P002 | Bắt buộc (`Required`) | Restore AW-P001 to `confirmed/in progress`; set only AW-P002 to `resolved/completed` and re-review both trackers |

Re-review result before local checkpoint:

- Nghiêm trọng (`Critical`): `0`.
- Bắt buộc (`Required`): `0`.
- Đề xuất (`Suggestion`): `0`.
- Skill validator: `valid`, 11 skills, 0 errors, 3 non-blocking `CORE_LENGTH_SIGNAL` warnings.
- Root typo-only, universal-preflight and same-instruction permission scenarios: `pass`.
- Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, scope and Git-state audits: `pass`.
- Fresh-reader: `not_run` — task cấm specialist/sub-agent và reviewer hiện tại đã nhận suspected finding/expected behavior, nên không phải qualified fresh reader.
- Application tests/build/browser/Supabase/CI: `not_run` — governance Markdown/root routing only; không có runtime/domain/CI-workflow change.

## 29. CP2 implementation checkpoint — 2026-07-22

- Preflight xác nhận local HEAD, upstream và read-only remote HEAD cùng là `868bf5dde523c26a941b7ba73d59ef08e2ed898b`; working tree sạch, ahead/behind `0/0`; merge-base với synchronized `main == origin/main` là `b10be2654d1a1c2291f1483e82ade3d0404cc151`.
- CP1R2 one-time push permission đã được tiêu thụ; CP2 instruction chỉ cấp behavior/tracker edits, verification/formal correction và conditional local checkpoint. Push, PR, CI-watch, merge, force-push, specialist, production/destructive và CP3 vẫn chưa được cấp.
- CP2 reconcile ba behavior owners như một logical contract: lifecycle giữ high-level modes/routing/stop; Git skill giữ default explicit commit/push cùng narrow cross-reference; GitHub PR/CI skill giữ exact commands, taxonomy, cycle, attempts và normal-push conditions.
- Static contract scenarios pass cho inspect-only, watch-only, create PR existing/missing remote head, update-only, combined before/after `branch-caused-small-safe`, explicit fix-only, commit-only, push-only, attempts 1/2/3, initial-push rejection, interactive push/fork rejection và non-small-safe stop behavior.
- Repository skill validator trả `valid` với 11 skills, 0 errors và 3 non-blocking `CORE_LENGTH_SIGNAL` warnings. Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, exact seven-file behavior scope, ten-file cumulative scope và Git-state audits pass.
- Formal self-review tìm thấy và sửa một Bắt buộc (`Required`): Git skill đã route exception nhưng local-only report/checklist vẫn tuyệt đối tuyên bố không push. Re-review còn 0 Nghiêm trọng (`Critical`), 0 Bắt buộc (`Required`).
- Fresh-reader: `not_run` vì current instruction cấm specialist/sub-agent và self-review không thay thế independent executor. Application test/build/browser/Supabase/CI: `not_run` vì CP2 chỉ thay governance Markdown/skill contracts và không sửa workflow/runtime/domain behavior.
- `AW-P001` giữ `confirmed/in progress` cho tới CP3 cumulative integration/closure evidence; `AW-P002` giữ `resolved/completed`; AW-PR2 chưa được đánh dấu fully implemented/verified.
