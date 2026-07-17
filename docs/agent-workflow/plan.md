# Master plan cho adaptive agent workflow của VocaSpace

## Trạng thái tài liệu

| Trường | Giá trị |
| --- | --- |
| Trạng thái | Draft — owner đã cho phép tạo branch và viết master plan; chưa cho phép implementation |
| Ngày tạo | 2026-07-17 |
| Branch planning | `docs/adaptive-agent-workflow-plan` |
| Base | `main == origin/main` tại `9bc37722943ca02720ae37a38c935e8b98417614` |
| Phạm vi quyền hiện tại | Tạo branch và sửa tài liệu plan cục bộ; không stage, commit, push, tạo PR hoặc implement workflow |
| Nguồn sở hữu intended scope của chương trình này | File này |
| Nguồn sở hữu trạng thái triển khai hiện tại sau khi chương trình được duyệt | `docs/agent-workflow/progress.md`, chỉ tạo ở PR triển khai đầu tiên có consumer thực tế |

Tài liệu này là draft do agent viết. Nó không tự cấp implementation permission và không thay thế owner decision. Self-review, specialist review, fresh-reader observation hoặc kết luận review đều chỉ là evidence; chúng không tự cấp quyền sửa `AGENTS.md`, skill, lifecycle, Git hoặc remote state.

## Ranh giới với chương trình agent-skill governance hiện có

[`docs/agent-skills/plan.md`](../agent-skills/plan.md) tiếp tục sở hữu foundation cho repo-local skill governance, structural validation, eval schema, synthetic packaging/reporting và future consumer discovery của chương trình đó.

Master plan này chỉ sở hữu:

- ngôn ngữ cập nhật và báo cáo cho owner;
- context routing trước discovery;
- đánh giá quy mô hai lần và escalation;
- độ sâu plan và review theo risk;
- plan self-review, implementation self-review và specialist review;
- bounded-context, quota guardrail và cách reconcile review feedback;
- ownership cần thiết giữa lifecycle, planning, review và domain skill.

Chương trình này không tự trở thành eval consumer, không chọn pilot cho `docs/agent-skills/plan.md` và không thay đổi dependency `agent-skills PR 3A → agent-skills PR 3B → future consumer discovery`. Nếu implementation sau này tạo real eval suite hoặc dùng eval foundation làm consumer, đó là material scope expansion cần owner approval riêng.

Repository/Git evidence hiện xác nhận agent-skills PR 3A đã merge vào `origin/main` qua merge commit `9bc37722943ca02720ae37a38c935e8b98417614`. `docs/agent-skills/progress.md` trên base hiện vẫn mô tả checkpoint trước merge; tracker đó thuộc chương trình khác và không được sửa ngầm trong planning branch này.

## Mục tiêu

Thiết lập một workflow thích ứng theo context, ownership và risk để agent:

1. báo cáo với owner bằng tiếng Việt tự nhiên khi owner dùng tiếng Việt;
2. nạp đúng context cần thiết mà không đọc toàn bộ repository cho mọi task;
3. đánh giá lại quy mô khi discovery làm lộ scope hoặc risk mới;
4. áp dụng self-review tối thiểu cho mọi thay đổi;
5. tăng độ sâu plan/review theo risk thay vì theo cảm tính hoặc số file;
6. dùng specialist reviewer có trigger, bounded context và quota guardrail rõ;
7. xác minh review feedback thay vì tin tuyệt đối hoặc biểu quyết số đông;
8. giữ owner control đối với material decision, implementation, Git và remote action.

## Yêu cầu đã xác nhận từ owner

Các yêu cầu dưới đây là input authoritative cho draft plan này. Chúng chưa phải implementation permission.

### Ngôn ngữ báo cáo cho owner

Rule mục tiêu ở `AGENTS.md`:

> Khi owner giao tiếp bằng tiếng Việt, hãy viết cập nhật và báo cáo bằng tiếng Việt tự nhiên, dễ hiểu. Chỉ giữ tiếng Anh cho code identifier, command, file path, branch, commit message, schema field, thông báo lỗi nguyên văn và thuật ngữ kỹ thuật đã quen dùng. Dịch các tiêu đề và từ báo cáo thông dụng sang tiếng Việt; không trộn Anh–Việt khi không cần thiết.

Rule phải giữ được các ranh giới sau:

- Giữ nguyên technical identifier và literal value, ví dụ `safeParse`, `course_id`, `valid`, `branch-caused-small-safe` khi đang chỉ exact machine value.
- Giữ các thuật ngữ kỹ thuật quen dùng khi dịch làm câu khó hiểu hơn, ví dụ Git, branch, commit, merge, checkpoint, manual QA, DB, migration, RLS, RPC, Zod, schema, DTO, API, Server Action, CI và PR.
- Dịch các từ báo cáo thông dụng, ví dụ `Summary`, `Findings`, `Required`, `Suggestion`, `Verdict`, `Approved`, `Scope`, `Risk`, `Verification`, `Next action`, `Changed files` và `Remote actions`.
- Commit message và generated PR title tiếp tục dùng tiếng Anh theo Git/PR workflow hiện có.
- Nội dung PR do agent tạo và báo cáo PR/CI cho owner dùng tiếng Việt tự nhiên.
- Thông báo lỗi nguyên văn, command output và quoted external text không bị dịch làm mất evidence.
- Nếu owner yêu cầu ngôn ngữ khác trong task hiện tại, instruction cụ thể đó được ưu tiên.

Không đưa một glossary dài vào `AGENTS.md`. Root rule phải ngắn; ví dụ và template chi tiết thuộc skill sở hữu output hoặc verification case.

### Workflow thích ứng

- Context routing diễn ra trước khi quyết định độ sâu discovery.
- Chỉ đọc tài liệu liên quan; mở rộng context khi có evidence cho thấy source khác sở hữu hoặc ràng buộc task.
- Có đánh giá quy mô sơ bộ sau context routing và đánh giá lại trong discovery.
- Agent phải nâng cấp task khi phát hiện scope, ownership, dependency hoặc risk rộng hơn dự kiến.
- Task nhỏ vẫn có main-agent self-review tối thiểu trên toàn bộ thay đổi thực tế.
- Plan lớn/rủi ro cao cần durable plan, plan self-review và owner gate rõ.
- Review feedback từ owner hoặc reviewer khác là claim cần kiểm chứng, không phải instruction tự động để sửa.
- Main agent luôn chịu trách nhiệm integration review và final reconciliation.
- Specialist reviewer chỉ được gọi theo risk/domain trigger và nhận bounded context.
- Không dùng số đông reviewer thay cho repository evidence, master plan hoặc owner decision.
- Self-review và review verdict không tự cấp permission.

### Cấu trúc skill trong đợt triển khai AW

- Đối với phần thay đổi nằm trong repo-local skill bundle, `AW-PR1` đến `AW-PR3B` chỉ sửa hoặc bổ sung trực tiếp trong các `SKILL.md` hiện có.
- Các PR này không tạo, tách, đổi tên hoặc di chuyển nội dung skill sang `references/`, và không refactor cấu trúc skill bundle. Constraint này không cấm các thay đổi đã lên kế hoạch ở `AGENTS.md` hoặc `docs/agent-loops.md`.
- Chấp nhận `SKILL.md` tạm thời dài hơn để behavior change, review evidence và rollback boundary nằm trong cùng một PR rõ ràng.
- Structural refactor chỉ được xem xét trong một PR riêng sau khi agent-skills eval foundation đã được implement và verified, affected-skill behavior có coverage đủ rõ, và owner duyệt scope refactor riêng.
- PR refactor sau này chỉ thay cách tổ chức nội dung; không trộn thêm behavior mới. Mọi reference phải có concrete consumer, exact read condition và kiểm tra chứng minh không làm mất routing, permission, stop hoặc reporting contract.
- Nếu một `AW-PR*` không thể implement an toàn nếu không tách reference, agent phải dừng và xin owner quyết định thay vì tự mở rộng scope.

## Sự thật repository đã xác nhận

- `AGENTS.md` sở hữu repository-level routing và behavior contract.
- `docs/agent-loops.md` sở hữu lifecycle routing, confidence reporting và stop rule.
- `implementation-planning-and-pr-breakdown` sở hữu planning procedure, dependency, acceptance criteria, verification planning và handoff.
- `code-review-and-quality` sở hữu implementation review procedure, finding taxonomy và readiness verdict.
- Domain skill sở hữu checklist và stop condition chuyên môn.
- `git-checkpoint-workflow` sở hữu branch/base, dirty-tree safety, staging, commit và remote boundary.
- `maintain-repo-skills` chỉ sở hữu governance cho repo-local skill artifact; không được route cho mọi product task.
- `test-quality-strategy` sở hữu test-layer selection, fixture-readiness gate, verification scope và manual-QA state matrix.
- `frontend-workflow` tiêu thụ fixture-readiness outcome và sở hữu browser/manual UI execution.
- Review mặc định read-only; correction chỉ được thực hiện khi owner instruction hoặc approved workflow cho phép.
- `code-review-and-quality` hiện yêu cầu taxonomy mức độ và tiêu đề báo cáo cho owner bằng tiếng Anh.
- `git-checkpoint-workflow` hiện hardcode tiêu đề checkpoint report bằng tiếng Anh.
- `github-pr-ci-workflow` hiện yêu cầu báo cáo tiếng Việt nhưng các trường trong template chủ yếu bằng tiếng Anh.
- Vì vậy chỉ thêm root language rule mà không reconcile direct output contracts sẽ tạo instruction conflict.

## Phạm vi

### Trong scope

- Root language/reporting rule trong `AGENTS.md`.
- Reconcile các output contract dành cho owner đang xung đột trực tiếp với language rule.
- Lifecycle preflight, context routing, sizing và escalation trong `docs/agent-loops.md`.
- Detailed planning/context procedure trong `implementation-planning-and-pr-breakdown`.
- Plan self-review, external-feedback verification và handoff gate.
- Universal minimum self-review cho task nhỏ.
- Main integration review và risk-based specialist review.
- Bounded-context package, quota guardrail, reviewer output và stop condition.
- Domain-owned specialist risk signals cho DB, trust boundary/backend, frontend, tests, Git và repo-skill governance.
- Fresh-reader/evidence plan cho material lifecycle, permission, routing và reporting changes.
- Durable documentation ownership và progress update points.
- Direct edits trong existing `SKILL.md` cho mọi thay đổi thuộc skill bundle, theo constraint cấu trúc đã được owner xác nhận.

### Ngoài scope

- Product behavior, product UI hoặc database migration.
- Remote database, deployment hoặc production change.
- Automatic subagent swarm hoặc reviewer cho mọi task.
- Model-based automatic grading hoặc winner selection.
- Native platform trigger automation.
- Bắt mọi task tạo plan file hoặc progress tracker.
- Bắt task nhỏ chạy full test suite, browser QA hoặc specialist review.
- Dịch code identifier, command, exact error, schema field hoặc machine-readable taxonomy.
- Tạo một skill mới nếu existing lifecycle/planning/review/domain skills có thể sở hữu behavior rõ ràng.
- Sửa eval foundation hoặc chọn real eval consumer trong chương trình `docs/agent-skills`.
- Tạo, tách, đổi tên, di chuyển reference hoặc refactor cấu trúc skill bundle trong `AW-PR1` đến `AW-PR3B`.
- Tự lên lịch structural-refactor PR trước khi eval foundation, affected-skill coverage và owner-approved refactor scope sẵn sàng.

## Context routing trước discovery

### Preflight tối thiểu

Mọi task bắt đầu bằng một lượt routing nhẹ:

1. đọc owner request và instruction đã được cung cấp;
2. áp dụng root/nested `AGENTS.md`;
3. xác định target area hoặc target artifact sơ bộ;
4. route và đọc đầy đủ skill có activation condition khớp;
5. mở target file cùng direct reference cần thiết;
6. kiểm tra xem target có thuộc tracked program, approved plan, ADR, known-problem hoặc deferred-work source nào không;
7. đánh giá quy mô sơ bộ.

Preflight không phải broad discovery và không tự tạo plan/approval gate.

### Điều kiện đọc tài liệu

| Nguồn | Điều kiện phải đọc |
| --- | --- |
| Root/nested `AGENTS.md` | Luôn áp dụng cho khu vực tương ứng |
| Domain/lifecycle skill | Khi task hoặc discovered scope khớp activation condition; skill đã chọn phải đọc đầy đủ |
| Repository thực tế | Luôn kiểm tra phần trực tiếp liên quan; repository sở hữu hiện trạng triển khai thực tế |
| `progress.md` | Khi task thuộc chương trình được theo dõi hoặc có thể thay trạng thái/bằng chứng hiện tại |
| Master plan | Khi task thuộc program, thay intended scope/dependency/order hoặc có thể mâu thuẫn approved direction |
| `problems.md` | Khi target area có known issue/debt hoặc task tuyên bố sửa behavior đã được theo dõi |
| `future-features.md` hoặc deferred owner | Khi task thêm behavior mới hoặc có thể kéo deferred work vào scope |
| ADR | Khi task thay architecture/contract/decision mà ADR sở hữu |
| Per-PR plan/approved brief | Khi implement, sửa hoặc review đúng PR/scope đó |
| Git state | Khi sẽ sửa file, tạo branch/checkpoint/commit hoặc cần xác định baseline/ownership |

Không tạo source mới chỉ để hoàn tất taxonomy. Khi việc thiếu source ảnh hưởng đến quyết định hoặc cần được owner kiểm chứng, ghi `not applicable` trong update, plan hoặc checkpoint thích hợp. Task nhỏ độc lập không cần liệt kê các source không áp dụng.

### Trigger mở rộng context

Mở thêm context khi có một trong các dấu hiệu:

- target file link tới source khác;
- cùng symbol/contract có consumer ở boundary khác;
- plan/status/repository đưa ra claim mâu thuẫn;
- task có thể thay source of truth, approved decision hoặc deferred scope;
- verification không thể chọn an toàn từ context hiện có;
- ownership hoặc branch/base không rõ;
- domain skill route thêm related skill cụ thể;
- reviewer cung cấp evidence cho thấy scope hiện tại thiếu một dependency.

Không mở broad discovery chỉ vì “có thể hữu ích”. Mỗi expansion phải có lý do gắn với ownership, dependency, risk hoặc verification.

## Đánh giá quy mô hai lần

### Lần 1 — sau context routing

Mục tiêu là chọn độ sâu discovery, không phải đóng đinh nhãn task.

| Mức | Dấu hiệu |
| --- | --- |
| Nhỏ | Một source sở hữu; behavior/permission/status/dependency không đổi; verification rõ |
| Vừa | Nhiều file nhưng cùng một bounded contract; không có material decision mới; risk có thể chứng minh bằng targeted checks |
| Lớn/rủi ro cao | Nhiều source sở hữu; cross-domain; thay behavior, permission, governance, dependency, deferred scope hoặc cần owner decision |

### Lần 2 — trong discovery

Phải nâng cấp task khi phát hiện:

- thêm source of truth bị ảnh hưởng;
- repository và tài liệu mâu thuẫn;
- approved decision phải thay đổi;
- deferred item bị kéo vào implementation;
- dependency/baseline của PR khác bị ảnh hưởng;
- trust, security, database, permission hoặc governance boundary mới;
- verification/fixture/manual QA phức tạp hơn dự kiến;
- ownership không thể xác định.

Agent không được giữ nhãn “nhỏ” chỉ vì assessment ban đầu đã chọn như vậy.

## Độ sâu plan theo quy mô

### Task nhỏ

```text
route nhẹ
→ micro-discovery
→ sửa
→ main rà toàn bộ thay đổi thực tế có đúng duy nhất intent không
→ targeted verification
→ checkpoint gọn
```

Không cần durable plan hoặc formal adversarial review.

### Task vừa

```text
targeted discovery
→ plan ngắn
→ implement trong approved scope
→ main self-review theo contract
→ targeted verification
→ checkpoint
```

Plan có thể nằm trong response hoặc approved brief; không tự động tạo file.

### Task lớn/rủi ro cao

```text
full relevant discovery
→ durable plan
→ main plan self-review
→ specialist plan review nếu trigger khớp
→ main reconcile
→ owner gate
→ implement
→ main integration review
→ specialist implementation review nếu trigger còn khớp
→ verification/manual QA
→ checkpoint
```

Hai bước specialist trong luồng trên đều là nhánh tùy chọn và mặc định bị bỏ qua. Plan review không được dùng quá một specialist; implementation review không phải follow-up tự động của plan review.

## Plan review và feedback reconciliation

### Main plan self-review

Mọi durable plan phải được main agent review read-only sau khi draft ổn định. Review phải đối chiếu:

- owner-confirmed goal và exclusions;
- repository facts;
- master plan/ADR/per-PR contract liên quan;
- source ownership;
- dependency/order;
- acceptance criteria;
- verification/manual QA/fixture readiness;
- risk, permission và stop condition;
- expected file/domain boundary;
- khả năng plan tự mâu thuẫn hoặc phát minh contract.

Nếu tìm thấy lỗi trong phạm vi planning đã được cho phép, agent có thể sửa draft rồi re-review. Việc sửa material decision do agent đề xuất không biến decision đó thành approved.

### Feedback từ owner hoặc reviewer khác

Mỗi feedback item là một claim cần xác minh:

1. kiểm tra evidence trong repository và source authoritative;
2. kiểm tra claim còn hiện hành hay đã bị quyết định mới thay thế;
3. kiểm tra claim có thuộc approved goal/master plan không;
4. phân loại `đúng trong scope`, `đúng nhưng cần scope/decision mới`, `sai`, `stale`, `xung đột` hoặc `không đủ evidence`;
5. chỉ sửa khi claim đúng và correction được quyền hiện tại hoặc workflow đã duyệt cho phép;
6. dừng và báo owner khi correction thay material decision, behavior, architecture, permission hoặc scope.

Không dùng số phiếu reviewer để giải quyết conflict. Repository fact, source ownership và owner decision quyết định kết quả.

## Self-review sau implementation

### Minimum gate cho mọi thay đổi

Main agent phải rà toàn bộ thay đổi thực tế, kể cả nội dung untracked, trước targeted verification và checkpoint:

- chỉ có file/hunk thuộc intent;
- không có line-ending, encoding hoặc formatting ngoài ý muốn;
- không có debug artifact, secret, conflict marker hoặc unrelated cleanup;
- claim về behavior, tài liệu và trạng thái khớp thay đổi thực tế;
- verification được chọn theo thay đổi thực tế, không theo nhãn task ban đầu.

Task nhỏ không cần full severity taxonomy nếu không có blocker; nhưng không được bỏ minimum gate.

### Main integration review

Với task nhiều boundary, main agent phải trace end-to-end thay vì chỉ ghép specialist report:

```text
data/storage invariant
→ generated type/schema
→ validation/permission/business rule
→ action/handler/RPC
→ result contract
→ frontend state/feedback
→ tests/fixtures/manual QA
```

Main agent chịu trách nhiệm xác minh các vấn đề do specialist báo và đưa ra kết luận cuối về mức độ sẵn sàng.

## Specialist review

### Nguyên tắc tính chi phí

Một specialist không đồng nghĩa một lượt review rẻ. Chi phí dự kiến phụ thuộc chủ yếu vào:

- lượng context được cấp ngay từ đầu;
- số source of truth phải đối chiếu;
- độ rộng và số lượng câu hỏi;
- số skill phải đọc chéo;
- số vòng review hoặc tự kiểm tra;
- quyền mở rộng discovery hoặc gọi thêm agent.

Plan không tuyên bố số token chính xác khi không có telemetry tương ứng. Tuy nhiên, mọi context đã cấp khi spawn phải được xem là chi phí đã phát sinh. Thu hẹp yêu cầu sau khi spawn chỉ có thể làm câu trả lời ngắn hơn; nó không khôi phục phần context đã nạp. Vì vậy quota gate phải áp dụng cho review package **trước** khi spawn, không chỉ cho số specialist hoặc độ dài report cuối.

### Hai tầng trigger

Domain signal trước hết kích hoạt domain skill cho main agent. Nó không tự động gọi sub-agent.

Sau main self-review, specialist chỉ được gọi khi đồng thời thỏa các điều kiện sau:

- còn một hard-risk signal cụ thể do domain skill sở hữu;
- phần chưa chắc chắn có thể làm sai plan hoặc implementation theo cách đáng kể;
- repository evidence, main review và verification hiện có chưa đủ chứng minh an toàn;
- main agent có thể giới hạn nó thành một risk cluster và 1–3 câu hỏi chính xác;
- lợi ích dự kiến đủ lớn so với quota và được ghi rõ trước khi spawn.

Owner có thể yêu cầu specialist ngoài điều kiện mặc định, nhưng review package vẫn phải được giới hạn trước khi spawn trừ khi owner chủ động mở rộng phạm vi.

### Hard-risk signal đề xuất

Các signal dưới đây là proposal cần được đặt và tinh chỉnh trong domain skill sở hữu chúng.

| Specialist | Hard-risk signal |
| --- | --- |
| DB | RLS/policy, `SECURITY DEFINER`, existing-data backfill, strict constraint trên dữ liệu cũ, transaction/lock/concurrency/idempotency, permission-sensitive RPC, destructive/compatibility-sensitive migration |
| Backend/trust boundary | permission/auth boundary, privileged field, webhook/payment/upload authenticity, cross-module request/result contract, partial failure hoặc side-effect ordering |
| Frontend | optimistic update/rollback, async race/stale response, permission-sensitive UI, critical multi-route/modal flow, client/server contract change với nhiều loading/error/retry state, complex accessibility interaction |
| Test | mock có thể che guarantee, cross-boundary auth/persistence flow, concurrency/idempotency, non-deterministic/missing fixture, regression khó tái hiện hoặc test layer không rõ |
| Git | unclear base/dependency, dirty ownership không tách được, branch divergence, history rewrite, force/remote boundary |
| Governance | permission/routing/source ownership/lifecycle thay đổi, sub-agent orchestration, evidence-claim boundary hoặc material fresh-reader behavior |

Migration additive đơn giản, generated types thay đổi cơ học, responsive adjustment cục bộ hoặc nhiều test layer nhưng một layer thấp đã chứng minh đủ là conditional signal; chúng route domain skill nhưng không mặc định spawn specialist.

### Quota và deduplication guardrail

- Mặc định không gọi specialist.
- Plan review có hard-risk dùng tối đa một specialist cho một risk cluster.
- Mỗi review package chỉ có 1–3 câu hỏi chính xác, một tập file/tài liệu hoặc đoạn trích cố định, một lượt review và không được tự gọi agent khác.
- Khi nền tảng cho phép chọn lượng hội thoại kế thừa, dùng mức nhỏ nhất đủ cho package; không fork toàn bộ authoring context theo mặc định.
- Implementation chỉ gọi specialist lại khi hard-risk vẫn tồn tại và main review cùng verification không đủ chứng minh; continuity không tự động biện minh cho một lượt gọi mới.
- Reviewer thứ hai trong cùng plan hoặc implementation checkpoint cần owner cho phép rõ ràng.
- Broad whole-plan review không được dùng làm mặc định.
- Không gọi một reviewer cho mỗi skill hoặc mỗi file.
- Giới hạn quota bằng độ rộng của package, không chỉ bằng số agent hoặc số vấn đề được phép báo.
- Thu hẹp câu hỏi sau khi spawn không được tính là đã tuân thủ quota gate ban đầu.
- Reviewer ưu tiên vấn đề mức Nghiêm trọng/Bắt buộc; Đề xuất chỉ báo khi được yêu cầu hoặc có giá trị rõ.

### Bounded-context package

Trước khi spawn, main agent phải ghi được đầy đủ:

```text
Cụm rủi ro:
1–3 câu hỏi chính xác:
Context tối đa — file/tài liệu/đoạn trích cố định:
Lý do từng source là cần thiết:
Lý do main-only review chưa đủ:
Lợi ích dự kiến so với quota:
Phạm vi đã duyệt và loại trừ:
Output ngắn cần trả:
Quy tắc mở rộng: không mở rộng mặc định
Điều kiện dừng:
Quyền hạn: chỉ đọc, một lượt, không delegation
```

Nếu không giải thích được lợi ích dự kiến so với quota, không gọi specialist.

Ví dụ package đúng cho governance risk của planning branch này:

```text
Cụm rủi ro:
- source ownership, permission và dependency của agent-skills PR 3B

Câu hỏi:
1. Plan mới có tạo source of truth trùng với master plan cũ không?
2. Plan có mở rộng permission ngoài contract hiện tại không?
3. Plan có làm thay đổi dependency của agent-skills PR 3B không?

Context tối đa:
- plan mới;
- master plan và progress hiện tại;
- đúng các đoạn permission/routing trong AGENTS.md và docs/agent-loops.md.

Loại trừ:
- language taxonomy;
- quota design ngoài ba câu hỏi;
- chi tiết PR breakdown không liên quan dependency của agent-skills PR 3B.
```

Reviewer:

- chỉ đọc và chỉ chạy một lượt;
- không tự implement, commit, push hoặc mở remote scope;
- không broad-discover, không tự đọc thêm source ngoài package và không gọi sub-agent;
- không yêu cầu follow-up turn để thu hẹp hoặc mở rộng package;
- nếu thiếu context, trả `Blocked` cùng source còn thiếu và lý do thay vì tự mở rộng;
- báo vấn đề kèm vị trí, bằng chứng, tác động và cách sửa nhỏ nhất;
- dừng khi 1–3 câu hỏi đã được trả lời hoặc cần owner quyết định.

Main agent tự kiểm tra source còn thiếu hoặc xin owner cho phép một package mới; reviewer không được biến lượt review hiện tại thành discovery mở.

### Nhãn review và claim boundary

- `main self-review`: agent tự review artifact mình vừa tạo.
- `specialist review`: reviewer tập trung vào một domain/risk cluster.
- `bounded-context review`: reviewer nhận package giới hạn bằng instruction; không ngụ ý filesystem isolation.
- `fresh-reader`: chỉ dùng khi prompt/context không leak expected answer, author conclusion hoặc suspected defect và observation được ghi theo contract.
- `independent review`: chỉ dùng khi independence thực sự được thiết lập và mô tả; không dùng cho reviewer fork toàn bộ authoring context.

Self-review và specialist review không tự thay thế fresh-reader evidence khi skill governance contract yêu cầu fresh reader.

## Ownership dự kiến

| Source | Ownership sau implementation |
| --- | --- |
| `AGENTS.md` | Root language invariant, repository routing và yêu cầu đọc lifecycle/skill |
| `docs/agent-loops.md` | Preflight lifecycle, two-pass sizing, escalation, gate selection, main-review invariant, permission/stop rule |
| `implementation-planning-and-pr-breakdown` | Context read conditions, planning procedure, durable-plan decision, plan self-review, dependency/PR breakdown và plan-review orchestration |
| `code-review-and-quality` | Implementation review procedure, reviewer selection, bounded package, finding verification, multi-reviewer reconciliation và readiness conclusion |
| `test-quality-strategy` | Test-layer risk, mock/fixture/manual-QA signal và specialist test checklist |
| `frontend-workflow` | Async/UI-flow specialist signal, browser/manual UI execution và frontend integration checklist |
| `nextjs-server-action-zod` | Trust-boundary specialist signal và validation/request/result contract checklist |
| `supabase-safe-migration` | DB specialist signal và migration/RLS/RPC/concurrency checklist |
| `git-checkpoint-workflow` | Git specialist signal, baseline/dirty-tree/branch/staging/commit/remote procedure và localized owner report template |
| `github-pr-ci-workflow` | PR/CI-specific localized owner report template; English PR title và exact CI taxonomy giữ nguyên |
| `maintain-repo-skills` | Governance specialist signal cho repo-local skill changes, fresh-reader/evidence boundary và owner-permission invariant trong activation scope của skill |

`implementation-planning-and-pr-breakdown` và `code-review-and-quality` không copy domain checklist. Domain skill sở hữu risk signal cụ thể; lifecycle/planning/review skill chỉ sở hữu cách route, gọi reviewer và reconcile kết quả.

## Dependency graph

```text
Owner review master plan
  → AW-PR1 language/report contract
    → AW-PR2 lifecycle preflight và adaptive planning
      → AW-PR3A specialist orchestration contract
        → AW-PR3B domain escalation signals
          → evidence-based rollout/revision gate
```

`AW-PR1` có thể merge độc lập trước workflow expansion. `AW-PR2`, `AW-PR3A` và `AW-PR3B` chạy tuần tự vì chúng sửa shared lifecycle/review contract. Không parallel các PR cùng sửa `agent-loops`, planning hoặc review skill.

## PR breakdown đề xuất

`AW-PR*` là định danh nội bộ của chương trình adaptive workflow trong plan và progress. Tên pull request, branch và commit thực tế vẫn theo workflow Git thông thường.

Mọi `AW-PR*` phải giữ skill-structure constraint đã xác nhận: phần thay đổi thuộc skill bundle sửa trực tiếp `SKILL.md`, không tạo hoặc di chuyển reference. Structural refactor là một future owner-gated PR riêng và không thuộc dependency graph của chương trình này.

### AW-PR1 — Owner-facing language và report localization

**Mục tiêu:** owner nhận update/report bằng tiếng Việt tự nhiên mà không mất exact technical evidence.

**Trong scope:**

- thêm root language rule ngắn vào `AGENTS.md`;
- reconcile direct conflicts trong `docs/agent-loops.md`;
- Việt hóa template/taxonomy dành cho owner trong `code-review-and-quality`, `git-checkpoint-workflow` và `github-pr-ci-workflow`;
- audit các output-owner skill khác, chỉ sửa nơi có hardcoded conflict thực tế;
- giữ English commit message, PR title, command, identifier, exact error và machine-readable status.

**Ngoài scope:** lifecycle sizing, specialist review, product text, code comments hoặc repository-wide translation.

**Acceptance criteria:**

- Vietnamese owner prompt tạo Vietnamese headings và prose tự nhiên;
- các từ báo cáo thông dụng không bị giữ English chỉ vì template cũ;
- technical identifier/literal evidence không bị dịch;
- no conflict giữa root rule và exact review/checkpoint template;
- owner yêu cầu English vẫn được tôn trọng;
- không thay permission, severity meaning hoặc Git/PR action boundary.

### AW-PR2 — Lifecycle preflight và adaptive planning

**Mục tiêu:** route context và chọn planning depth theo evidence/risk thay vì đọc toàn repo hoặc dùng một workflow nặng cho mọi task.

**Trong scope:**

- preflight/context routing invariant trong `docs/agent-loops.md`;
- read-condition matrix và expansion trigger trong planning skill;
- sizing lần 1/lần 2, task escalation và plan depth;
- universal minimum self-review gate;
- durable-plan, plan self-review, external-feedback verification và owner gate;
- output/reporting đủ gọn theo task size.

**Ngoài scope:** sub-agent orchestration và domain specialist trigger.

**Acceptance criteria:**

- typo độc lập không kéo master plan/progress/browser/DB context vào task;
- docs change có source-of-truth impact được nâng thành governance task;
- agent không giữ nhãn nhỏ khi discovery phát hiện material scope;
- plan feedback được kiểm chứng với repository/approved source;
- self-review không tự authorize implementation.

### AW-PR3A — Specialist review orchestration

**Mục tiêu:** main agent có cách gọi specialist reviewer hẹp, tiết kiệm quota và reconcile findings đáng tin cậy.

**Trong scope:**

- review levels và two-tier specialist activation;
- main integration review;
- bounded-context package;
- reviewer read-only/expansion/stop/output contract;
- quota/deduplication guardrail;
- review labels và independence/fresh-reader claim boundary;
- plan-review orchestration trong planning skill;
- implementation-review orchestration trong review skill.

**Ngoài scope:** exact domain signal edits.

**Acceptance criteria:**

- small task không spawn reviewer;
- mặc định 0 specialist; plan có hard-risk dùng tối đa 1 specialist cho 1 risk cluster;
- mỗi package giới hạn 1–3 câu hỏi, context cố định, một lượt và không delegation;
- reviewer thứ hai cần owner cho phép rõ ràng;
- implementation chỉ gọi lại khi hard-risk còn tồn tại và main review/verification chưa đủ;
- broad whole-plan review không phải lựa chọn mặc định;
- main xác minh finding và không dùng majority vote;
- reviewer không tự implement hoặc broad-discover;
- không claim independent/fresh-reader khi context không đáp ứng.

### AW-PR3B — Domain-owned escalation signals

**Mục tiêu:** domain skill cung cấp observable signal để orchestration không dựa vào cảm giác “task hơi lớn”.

**Trong scope:** thêm hoặc làm rõ specialist escalation section trong các domain skill thực sự có consumer: Supabase, trust boundary/Zod, frontend, tests, Git và repo-skill governance.

**Ngoài scope:** thay domain implementation procedure, product behavior hoặc tự động spawn cho mọi activation.

**Acceptance criteria:**

- hard/conditional signal phân biệt rõ;
- domain activation không đồng nghĩa specialist activation;
- planning/review skill không duplicate domain checklist;
- overlapping signal được group theo risk cluster;
- permission và remote boundary không bị nới lỏng.

## Verification strategy

### Cho planning branch hiện tại

- main adversarial plan self-review với repository/master-plan/skill evidence;
- một pilot governance specialist review chỉ đọc; package ban đầu rộng hơn guardrail mới và có follow-up thu hẹp sau khi spawn;
- chỉ dùng pilot đó làm evidence phát hiện lỗ hổng về quota, không dùng làm bằng chứng rằng package đã tuân thủ guardrail mới;
- main xác minh phản hồi, sửa plan và tự review lại thay đổi;
- UTF-8, final newline, trailing whitespace, Markdown heading/fence và relative-link audit;
- `git diff --check` và kiểm tra nội dung untracked thực tế;
- không chạy application test/build/browser/Supabase vì branch chỉ thêm master plan.

Specialist plan review của branch này không được gọi là fresh-reader nếu reviewer nhận review criteria hoặc authoring context.

### Cho implementation PR sau này

- `node .agents/scripts/validate-skill.mjs` cho mọi skill change;
- targeted structural/Markdown/link/encoding checks;
- targeted search cho duplicated ownership, stale English template và conflicting lifecycle claim;
- staged/change-set audit xác nhận phần skill bundle không có reference mới, rename/move hoặc structural refactor trong `AW-PR1` đến `AW-PR3B`;
- behavior examples cho small/medium/high routing;
- bounded plan-review và implementation-review scenarios;
- lightweight manual fresh-reader check khi thay material ownership, permission, routing, source hierarchy, lifecycle hoặc status interpretation;
- nếu không có valid fresh reader hoặc authorization, ghi `not_run` với lý do, không thay bằng self-review;
- application test/build/browser/Supabase chỉ chạy khi thay đổi thực tế của PR triển khai chạm runtime/domain tương ứng.

## Documentation và progress

- File này sở hữu intended scope, dependency, proposed PR structure và decision status của chương trình adaptive workflow.
- Không dùng `docs/agent-skills/progress.md` làm tracker cho chương trình này.
- Tạo `docs/agent-workflow/progress.md` ở implementation PR đầu tiên sau owner approval, khi đã có concrete status cần theo dõi.
- Progress phải phân biệt `planned`, `approved`, `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`.
- Mỗi implementation PR có per-PR brief nếu master plan chưa đủ chi tiết cho exact changed files/acceptance/verification.
- Không tạo `problems.md`, `future-features.md` hoặc ADR mới khi chưa có concrete consumer.
- Trong phần skill bundle, `AW-PR1` đến `AW-PR3B` không tạo, tách, đổi tên hoặc di chuyển reference kể cả khi đã thấy possible consumer; structural refactor cần PR và owner gate riêng sau khi test/eval evidence sẵn sàng.
- Material deviation phải cập nhật source sở hữu quyết định dự kiến; trạng thái hiện tại chỉ cập nhật từ evidence thực tế.

## Rủi ro và giảm thiểu

| Rủi ro | Tác động | Giảm thiểu |
| --- | --- | --- |
| Root language rule xung đột skill template | Agent tiếp tục trộn ngôn ngữ hoặc vi phạm một instruction | Reconcile direct output owners trong AW-PR1 |
| Rule dịch quá mức | Technical evidence khó đọc | Giữ identifier, command, literal status và thuật ngữ kỹ thuật quen dùng |
| Context routing quá rộng | Mất quota và lặp discovery | Exact read condition và evidence-based expansion |
| Context routing quá hẹp | Bỏ sót source/dependency | Expansion trigger và sizing lần 2 |
| Anchoring vào nhãn task nhỏ | Scope creep âm thầm | Mandatory reclassification khi ownership/risk thay đổi |
| Formal workflow áp dụng cho mọi task | Chi phí thủ tục lớn | Review/plan depth theo risk; task nhỏ giữ micro-flow |
| Domain trigger đồng nghĩa spawn | Multi-agent review quá mức | Tách domain activation khỏi specialist activation |
| Reviewer nhận package quá rộng ngay khi spawn | Context và quota đã phát sinh trước khi có thể thu hẹp | Pre-spawn record, 1 risk cluster, 1–3 câu hỏi, context cố định, một lượt, không delegation |
| Thu hẹp yêu cầu sau khi spawn được xem là tiết kiệm quota | Report ngắn nhưng context ban đầu vẫn rộng | Đánh giá quota trên package ban đầu; late narrowing không được tính là tuân thủ |
| Reviewer thứ hai được gọi theo thói quen | Lặp evidence và tăng quota | Cần owner cho phép rõ ràng |
| Reviewer conflict | Main chọn theo số đông | Reconcile bằng evidence/source ownership/owner decision |
| Same-model review bị gọi independent | Evidence claim sai | Review label và fresh-reader contract rõ |
| Domain trigger bị copy nhiều nơi | Drift | Domain skill sở hữu signal; planning/review chỉ sở hữu orchestration |
| Tách reference trong lúc đang đổi behavior | Review không phân biệt được lỗi behavior với lỗi routing/progressive disclosure | `AW-PR*` sửa trực tiếp `SKILL.md`; defer structural refactor sang PR riêng có test/eval evidence |
| `SKILL.md` tạm thời dài hơn | Context cost tăng trong giai đoạn chuyển tiếp | Chấp nhận có chủ đích; chỉ refactor khi coverage và exact read condition đủ mạnh |
| Correction loop tự mở rộng permission | Agent tự thay decision | Read-only default và material-change stop rule |
| Master plan mới trùng agent-skill plan | Hai source of truth | Boundary section và separate progress owner |

## Điều kiện phải dừng

Dừng và báo owner khi:

- proposed implementation cần thay material behavior đã được owner chốt trong master plan này;
- repository evidence mâu thuẫn owner-confirmed requirement và không thể reconcile bằng descriptive correction;
- không xác định được source sở hữu language, lifecycle, planning hoặc domain trigger rule;
- một PR cần sửa domain procedure ngoài workflow/reporting scope;
- phần skill-bundle của một `AW-PR*` cần tạo, tách, đổi tên hoặc di chuyển reference để tiếp tục;
- specialist orchestration cần model/subagent permission chưa được cấp;
- correction cần mở rộng sang eval runner, CI, product code, database hoặc production;
- fresh-reader claim cần isolation/enforcement không available;
- implementation, commit, push, PR, merge hoặc remote permission chưa được owner cấp;
- plan review còn Critical/Bắt buộc finding chưa được resolve.

## Rollback

- Mỗi PR phải giữ một coherent outcome và có thể revert độc lập theo reverse dependency.
- AW-PR1 không phụ thuộc specialist workflow; có thể giữ language rule ngay cả khi later workflow bị dừng.
- Revert domain signals trước orchestration nếu rollout tạo over-trigger.
- Revert orchestration trước lifecycle preflight nếu main-only flow phải được khôi phục.
- Không squash/amend history mặc định; correction dùng checkpoint mới theo Git workflow.
- Nếu fresh-reader/evidence cho thấy behavior xấu đi, dừng rollout thay vì làm yếu safety/permission rule để đạt pass.

## Quyết định cần owner review trước implementation

Owner cần review và chốt:

1. boundary giữa master plan này và `docs/agent-skills/plan.md`;
2. language rule cùng nguyên tắc technical term/common report term;
3. ownership split giữa lifecycle, planning, review và domain skill;
4. proposed PR dependency `AW-PR1 → AW-PR2 → AW-PR3A → AW-PR3B`;
5. specialist hard/conditional signal model và quota guardrail;
6. việc plan approval có kèm implementation permission cho PR nào hay không.

Nếu owner chỉ duyệt plan, không implementation PR nào được tự bắt đầu.

## Plan review record

| Review | Trạng thái |
| --- | --- |
| Main self-review | Hoàn tất — rà soát chỉ đọc toàn bộ bản nháp, hiện trạng repository, ownership, quyền hạn, dependency, quota và ranh giới bằng chứng; còn 0 Nghiêm trọng, 0 Bắt buộc |
| Governance specialist pilot | Hoàn tất — chỉ đọc; package ban đầu rộng hơn guardrail mới và follow-up thu hẹp diễn ra sau spawn; còn 0 Nghiêm trọng, 0 Bắt buộc nhưng không dùng lượt này làm bằng chứng tuân thủ quota gate mới |
| Main reconciliation | Hoàn tất — phản hồi về quota, namespace `AW-PR*`, cách ghi `not applicable` và constraint sửa trực tiếp `SKILL.md` đã được kiểm chứng và sửa trong plan; không đổi mục tiêu, quyền hạn hoặc dependency của agent-skills PR 3B |
| Fresh-reader | Không áp dụng cho lượt review khi viết plan; các PR triển khai có thay đổi đáng kể phải đánh giá lại |

Discovery và self-review đã xử lý các điểm sau trước checkpoint:

- Rule ngôn ngữ chỉ ở root sẽ xung đột với taxonomy và mẫu report đang cố định bằng tiếng Anh; AW-PR1 được mở rộng vừa đủ để đồng bộ các nguồn trực tiếp tạo report cho owner.
- Master plan mới có nguy cơ trùng ownership với chương trình agent-skill foundation; ranh giới đã tách rõ và không dùng plan này để chọn nơi sử dụng eval hoặc thay dependency của agent-skills PR 3B.
- Base `progress.md` của chương trình agent-skill còn mô tả agent-skills PR 3A trước merge; plan ghi repository/Git fact hiện tại nhưng không sửa ngầm tracker thuộc chương trình khác.
- Pilot specialist cho thấy giới hạn số agent chưa đủ: package ban đầu vẫn quá rộng, và thu hẹp sau spawn không bù lại context đã nạp.
- Guardrail đã đổi sang giới hạn trước khi spawn theo risk cluster, 1–3 câu hỏi, context cố định, một lượt review, không delegation và owner gate cho reviewer thứ hai.
- Pilot chỉ được ghi nhận là specialist review có context giới hạn bằng instruction; không được xem là fresh-reader, review độc lập hoặc bằng chứng tuân thủ guardrail mới.
- Các PR của adaptive workflow dùng namespace `AW-PR*`; tên Git/PR thực tế không bị ép theo namespace tài liệu.
- `not applicable` chỉ được ghi vào update, plan hoặc checkpoint khi việc thiếu source ảnh hưởng quyết định hoặc cần owner kiểm chứng; task nhỏ không phải liệt kê máy móc.
- `AW-PR1` đến `AW-PR3B` sửa trực tiếp existing `SKILL.md`; reference split và structural refactor được defer sang future owner-gated PR sau khi test/eval evidence đủ rõ.
