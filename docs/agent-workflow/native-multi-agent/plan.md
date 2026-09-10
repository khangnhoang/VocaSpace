# Master Plan — Native Multi-Agent Workflow cho VocaSpace

## Trạng thái tài liệu

| Trường | Giá trị |
| --- | --- |
| Trạng thái | Draft correction round 1; sẵn sàng cho same-session Master Plan Reviewer rereview |
| Plan revision | 5 — sửa hai review findings và giữ review artifact local-only ngoài Git scope; GOAL Revision không đổi |
| Ngày | 2026-09-10 |
| Planning branch | docs/native-multi-agent-master-plan |
| Baseline đã xác minh | main == origin/main == 00e0ce1764b8de3279cdad776ae762483cc36a9e trước khi tạo branch |
| Nguồn sở hữu | Tài liệu này sở hữu semantic architecture và workstream decomposition của chương trình native multi-agent |
| Quyền hiện tại | Master Plan correction và một local commit sau Reviewer PASS; review artifacts ngoài Git scope; không cấp quyền push, PR, merge, deployment hoặc database mutation |

Tài liệu này là candidate do Master Planner tạo. Nó chỉ trở thành Master Plan được chấp nhận sau fresh independent Master Plan Review và quyết định tương ứng của Owner. Nó không phải detailed per-file implementation plan.

## Ranh giới tài liệu và từ vựng chuẩn

docs/agent-workflow/plan.md tiếp tục sở hữu chương trình adaptive workflow đã tồn tại: lightweight preflight, sizing, review depth và optional specialist. Tài liệu này là phần mở rộng có chủ đích dành cho native managed-agent lifecycle. Hai tài liệu phải liên kết qua lại nhưng không được cùng sở hữu một semantic contract.

Các từ viết hoa sau là thuật ngữ chuẩn:

| Thuật ngữ | Nghĩa và ownership |
| --- | --- |
| Main | Orchestration authority duy nhất: chọn mode, quản lý phase/episode/session, kiểm tra handoff, quyết định transition và báo Owner |
| Reviewer | Lifecycle role chính thức, bắt buộc ở review phase của managed workflow; sở hữu review đầy đủ của candidate và verdict của phase |
| Specialist | Resource tư vấn tùy chọn cho một câu hỏi chuyên môn hẹp; không sở hữu phase, candidate, review verdict hoặc transition |
| Agent | Role đang sở hữu task/candidate tại thời điểm hiện tại; có thể là Main, Planner, Implementor hoặc Reviewer |
| Owner | Người duy nhất phê duyệt thay đổi semantic GOAL/scope, cấp authority và quyết định sau các owner gate |

Reviewer và Specialist không phải hai biến thể của cùng một review contract:

~~~text
Agent hoặc Reviewer
  └─ tùy chọn gọi Specialist cho một câu hỏi chuyên môn cụ thể
       └─ Specialist trả evidence/advice

Agent hoặc Reviewer vẫn giữ ownership và chịu trách nhiệm cho kết luận.

Main
  → Reviewer
  → verdict / findings đầy đủ
  → Main quyết định transition
~~~

Reviewer có thể gọi Specialist khi gate hẹp được đáp ứng và authority hiện tại cho phép. Đây là consultation bên trong phase, không phải lifecycle orchestration. Specialist không được gọi thêm agent, không đưa lifecycle verdict và không gửi phase transition trực tiếp cho Main.

## A. GOAL

### GOAL ID

NMA-001

### GOAL Revision

1

### Desired Outcome

VocaSpace có một workflow repository-native dùng native Codex subagents để phân tách planning, implementation và review khi task shape hoặc risk thực sự cần independence, trong khi routine work tiếp tục đi qua Normal Workflow nhẹ.

### Success Boundaries

- Main định tuyến nhất quán giữa NORMAL, MULTI_AGENT_MASTER_PLAN, MULTI_AGENT_E2E và OWNER_DECISION_REQUIRED dựa trên outcome shape, ownership, dependency và risk thay vì số file.
- Mỗi managed workflow dùng fresh initial role, explicit payload, same-session reconciliation và bounded correction budget.
- Reviewer bắt buộc hoàn thành review contract của phase; Specialist chỉ là optional advisory resource dưới ownership của caller.
- Mỗi lifecycle review round tạo một exact durable review artifact đủ cho Main, candidate author và future rereview/history mà không cho Reviewer sửa candidate.
- Lifecycle review artifact là local workflow evidence: được giữ dài hạn trong workspace nhưng không được stage, commit hoặc push lên repository remote.
- Main có thể phát hiện stale/crossed handoff, external blocker, scope change, detailed-plan drift và closed Master Plan mismatch mà không cần custom orchestration runtime hoặc persistent workflow database.
- Master Plan giữ được semantic lineage đủ để future sessions truy ngược ownership, dependency, assumptions và blast radius.
- Mỗi implementation phase chứng minh contract mới trong intended repository/native-agent context trước khi phase phụ thuộc được phép bắt đầu.

### Protected Invariants

- Chỉ Main sở hữu lifecycle orchestration và inter-phase transition.
- Reviewer sở hữu verdict của review phase; Specialist không thể approve/reject candidate hoặc thay Reviewer.
- Reviewer chỉ được mutate exact review artifact do Main cấp; candidate đang review và mọi source thuộc candidate là immutable đối với Reviewer.
- Agent gọi Specialist vẫn sở hữu task/review và phải tự tổng hợp, kiểm chứng evidence.
- Owner giữ quyền đối với GOAL revision, material scope change, authority expansion và hành động sau khi automatic reconciliation budget cạn.
- Exact Owner request và mọi amendment/clarification/authority steer liên quan luôn trực tiếp khả dụng cho role cần dùng; Main summary chỉ hỗ trợ routing và không thay thế Owner source.
- Master Planner/Planner derive candidate GOAL từ Owner source; Main không semantic-translate GOAL. Master Plan Reviewer kiểm tra GOAL fidelity độc lập trên cùng Owner source package.
- Initial specialized roles không thừa hưởng task mental model; reconciliation trong cùng workflow tái sử dụng đúng role session.
- Lower layer không được ép một giả định sai lên GOAL hoặc repository reality.
- Verification gap không được báo thành PASS.
- Normal Workflow vẫn là mặc định; native multi-agent chỉ mở khi independence đem lại lợi ích correctness cụ thể.
- Không tạo Harness V2, workflow database, cryptographic provenance, artifact fingerprint system, custom review oracle hoặc speculative framework. Durable review artifact tối thiểu không được mở rộng thành workflow event store.
- Commit, push, PR, merge, deployment và database mutation vẫn là các authority riêng.

### Scope Boundary

Trong scope:

- repository governance cho mode routing, roles, freshness, handoff, mandatory review artifact, reconciliation, blockers, Owner input/scope/authority change, GOAL, lineage và plan drift;
- project-scoped Codex role configuration;
- migration terminology Reviewer/Specialist;
- bounded verification và rollout contract cho workflow mới;
- liên kết và status reconciliation cần thiết giữa các owner source hiện có.

Ngoài scope:

- product feature, product UI, database/schema, production hoặc deployment behavior;
- tự xây agent runtime, durable event store, scheduler, dashboard hoặc evaluation harness mới;
- automatic swarm, majority voting hoặc model-based quality oracle;
- rewrite toàn bộ skill đang hoạt động;
- thay đổi lịch sử trong implementation-plan records chỉ để đồng nhất cách gọi mới;
- hard-code lựa chọn model ở nhiều source;
- bảo vệ theo threat model chống malicious subagent.

## B. Current-State Findings

### Repository authority và reusable contracts

- AGENTS.md là root owner của repository-wide behavior và skill routing. Rule 2 đã có nền tảng Simplicity First, gồm omission test cho control/artifact/provenance/fingerprint/validator/workflow stage. Khoảng trống còn lại là các operational examples dành riêng cho native-agent workflow; không cần viết lại nguyên tắc.
- docs/agent-loops.md sở hữu Universal Lightweight Preflight và lifecycle routing hiện tại.
- implementation-planning-and-pr-breakdown sở hữu durable planning, scope, dependency, acceptance, verification planning và plan feedback reconciliation.
- code-review-and-quality sở hữu formal implementation review, finding severity, verification status và verdict.
- test-quality-strategy sở hữu lựa chọn verification layer; Git/checkpoint authority thuộc git-checkpoint-workflow.
- docs/agent-workflow/plan.md và progress.md lần lượt sở hữu intended scope và delivery status của adaptive workflow cũ. implementation-plans/README.md đã có convention plan.md cộng owner-review-brief.md cho bounded implementation work.
- .agents/scripts/lib/skill-evals và các CLI liên quan là harness đánh giá agent-skill hiện hữu. Chúng không phải workflow runtime và không được tái sử dụng như orchestration engine. Existing deterministic skill validator vẫn có thể kiểm tra skill structure khi phù hợp.

### Repository gaps và drift

- Không có CLAUDE.md; không có competing root authority.
- Không có project .codex configuration hoặc .codex/agents role profiles ở baseline.
- Existing adaptive plan từng đặt native platform trigger automation ngoài scope. Chương trình mới là extension được Owner yêu cầu, không được sửa lịch sử thành tuyên bố rằng capability này đã nằm trong scope cũ.
- progress.md vẫn ghi AW-PR3B có PR open=yes và merged=no. Git hiện xác minh merge commit 46dd08b81f064f23b6c1bffc81d98a1496bc0041 là ancestor của origin/main. Đây là tracker drift cần sửa trước khi dùng tracker làm migration baseline, nhưng không làm Master Plan này mất freeze readiness.

### Semantic collision Reviewer/Specialist đã xác nhận

Các active owner source đang dùng từ reviewer cho Specialist theo nghĩa cũ:

- docs/agent-loops.md dùng cụm package/reviewer behavior khi route optional specialist.
- implementation-planning-and-pr-breakdown/SKILL.md dùng bounded specialist package and reviewer contract, reviewer behavior và another reviewer để chỉ Specialist.
- code-review-and-quality/SKILL.md ghi small tasks do not spawn a reviewer trong section optional specialist.
- code-review-and-quality/references/specialist-review.md có heading Reviewer behavior and output và gọi Specialist là reviewer.
- docs/agent-workflow/plan.md dùng specialist reviewer xuyên suốt adaptive program contract.

Contract thực tế của các đoạn này vẫn là optional, bounded, advisory và Main-owned. Vì vậy đây chủ yếu là terminology migration, không phải lý do xóa hoặc hợp nhất Specialist. Historical implementation plans được giữ nguyên như evidence lịch sử; active behavior owners phải chuyển sang từ vựng chuẩn.

### Reviewer artifact semantics hiện tại

- code-review-and-quality/references/review-report-templates.md đã sở hữu detailed finding format, verification section, verdict và Owner-facing report shape. Đây là source cần reuse cho nội dung review artifact.
- code-review-and-quality hiện nói review là read-only theo mặc định. Với lifecycle Reviewer, active contract phải làm rõ đây là candidate-read-only cộng exact owned-artifact write; nếu giữ filesystem read-only tuyệt đối thì mandatory artifact không thể vận hành.
- Template hiện tại không bắt buộc một durable file cho mỗi lifecycle review turn, không có workflow/candidate/episode/round identity và không quy định exact destination do Main cấp trước khi review.
- Handoff ban đầu của candidate này có artifact_refs nhưng chỉ là conversational transport field; Main chưa có expected artifact reference và episode_id cộng candidate_revision cộng completed_correction_rounds chưa phân biệt explicit review round.
- Các review artifact dưới agent-skill eval harness thuộc riêng evaluation runtime/retention contract. Chúng không phải reusable workflow artifact owner và không được kéo vào kiến trúc này.
- Vì vậy gap thật là durability, review-turn identity và deterministic selection. Finding taxonomy/report content được adapt từ existing review template; không tạo competing content owner.

### Native Codex capability có thể dựa vào

Codex hiện cung cấp native subagent lifecycle: spawn fresh agent, gửi message/follow-up tới cùng session, interrupt active turn, chờ status/result và để main thread tổng hợp. Project có thể định nghĩa custom agent profiles dưới .codex/agents. Các primitive này đủ cho identity, liveness, quiescence và session reuse của thiết kế này; không cần persistent orchestration service.

Current native contract và canary ngày 2026-09-10 xác nhận ba semantics không tương đương:

- live message có thể được đưa vào active turn nhưng không trigger một turn mới và không có before-next-action ordering guarantee;
- follow-up gửi khi child đang RUNNING được giao tại model message boundary hoặc sau pending tool call; khi child idle nó mới trigger turn;
- interrupt kết thúc current turn, giữ nguyên agent/session để Main gửi follow-up resume. Canary chỉ đọc thấy cả message và follow-up sau khi pending tool hoàn tất; canary interrupt không thấy pending tool output và resume trong đúng session.

Required disposition cho native runtime hiện tại là `A. LIVE_STEERING_SUPPORTED`: Main có thể gửi steer tới running child và child có thể consume trong active turn tại native message/tool boundary, nhưng send success không bảo đảm child đã consume steer trước next affected action.

Do đó native live delivery hữu ích cho thông tin không phụ thuộc timing, nhưng không phải authority/safety boundary. Khi Owner steer phải có hiệu lực trước protected action kế tiếp, observable contract là interrupt/quiesce, audit state đã có, rồi resume same session bằng exact steer. Action đã hoàn tất trước khi interrupt có hiệu lực không thể bị thu hồi hồi tố. Hard-boundary procedure này là limitation/safety contract của disposition A, không phải overall disposition `C. INTERRUPT_AND_RESUME_REQUIRED`.

Các permission mode/sandbox mà child kế thừa không đồng nghĩa native runtime tự enforce từng repository authority như `commit` hoặc `push`. Managed workflow vì thế phải truyền explicit authority snapshot và không được giả định một Owner message đã thay đổi quyền của running child chỉ vì transport nhận message thành công.

Freshness semantic của plan là zero inherited conversation history, hiện được biểu diễn bằng fresh spawn với fork_turns="none" hoặc platform-equivalent. Exact API/tool spelling là implementation detail phải được kiểm tra lại ở phase triển khai; semantic contract không phụ thuộc vĩnh viễn vào một tên tool.

Nguồn platform đã kiểm tra:

- [Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [OpenAI Multi-agent API](https://developers.openai.com/api/docs/guides/responses-multi-agent)

Native concurrency có lợi cho independent read-mostly work nhưng tăng token cost và làm shared-write conflict dễ xảy ra. Kiến trúc này vì thế tuần tự hóa author/reviewer trên một candidate. Reviewer là candidate-read-only nhưng được ghi đúng review artifact đã được Main cấp; Specialist vẫn filesystem read-only.

## C. Target Architecture

### Mode taxonomy

| Mode | Chọn khi | Không chọn khi | Kết thúc |
| --- | --- | --- | --- |
| NORMAL | Một coherent bounded outcome, ownership chain ổn định, acceptance/verification xác định được và một agent có thể hoàn thành đáng tin cậy | Chỉ vì task chạm nhiều file hoặc UI + BE + DB | Implement, proportional verification, report |
| MULTI_AGENT_MASTER_PLAN | Problem space chứa nhiều independently deliverable capabilities/contracts hoặc dependency/order chưa ổn định nên chưa thể lập bounded implementation task đáng tin cậy | Chỉ vì một vertical capability có nhiều layer | Reviewed Master Plan; không implementation |
| MULTI_AGENT_E2E | Một bounded deliverable nhưng ambiguity, semantic risk, cross-owner interaction hoặc correction risk khiến independent plan/review có lợi rõ | Routine work hoặc broad initiative chưa decomposition | Reviewed implementation candidate và Owner report |
| OWNER_DECISION_REQUIRED | Conflict về GOAL, scope, ownership, permission, acceptance, baseline hoặc exhausted budget làm mọi route tự động còn lại không an toàn | Blocker có thể giải quyết bằng bounded retry sau một state change đã biết | Owner quyết định route/authority/disposition |

Một capability dọc xuyên UI, backend và persistence có thể là E2E nếu vẫn có một outcome và một acceptance boundary. Một initiative gồm CSV import, organization support, permission redesign và rollout độc lập thường là Master Plan dù tổng số file ban đầu chưa biết.

### Role matrix

| Role | Class | Ownership | Bắt buộc | Có thể gọi Specialist |
| --- | --- | --- | --- | --- |
| Main | Orchestrator | Mode, state, session, handoff admission, counters, transition, Owner gates | Mọi workflow | Có, nếu Main đang trực tiếp sở hữu analysis/review trong NORMAL |
| Master Planner | A | Derive candidate GOAL từ Owner source; sở hữu Master Plan candidate/decomposition/lineage proposal | Master Plan Only | Có |
| Master Plan Reviewer | A | Full review của Master Plan candidate, owned review artifact và verdict | Master Plan Only | Có |
| Planner | A | Detailed plan candidate và lineage delta | E2E | Có |
| Plan Reviewer | A | Full review của detailed plan candidate, owned review artifact và verdict | E2E | Có |
| Implementor | B | Working-tree candidate theo accepted plan; mismatch reporting | E2E | Có cho bounded technical uncertainty, không để redesign plan |
| Implementation Reviewer | A | Full review của exact implementation candidate, owned review artifact và verdict | E2E | Có |
| Master Plan Correction | A | Read-only verification và correction recommendation cho closed-plan mismatch | Khi closed Master Plan bị challenge | Có |
| Specialist | Project-configured judgment profile, mặc định A | Một câu hỏi/risk cluster, evidence và limitations | Không | Không |

Class A hiện ánh xạ GPT-5.6 Sol / high; Class B ánh xạ GPT-5.6 Sol / medium. Project-scoped Codex config là canonical owner của mapping. Skills và handoff chỉ tham chiếu role/class. Nếu required configured model không khả dụng, role trả BLOCKED; không silent substitute.

### Freshness và session reuse

- Mỗi initial specialized role được spawn mới với zero inherited task history. Payload chỉ gồm repository authority, exact Owner Source Package, routing summary được gắn nhãn non-authoritative, GOAL/current accepted contract, exact candidate/artifact refs, relevant evidence, scope, exclusions, permissions và required output. Reviewer payload còn nhận review_round và exact expected_review_artifact_ref do Main cấp.
- Master Planner và Master Plan Reviewer là hai fresh sessions độc lập. Planner, Plan Reviewer, Implementor và Implementation Reviewer cũng độc lập ở lần khởi tạo.
- Correction trong cùng reconciliation episode dùng follow-up tới đúng author session và đúng Reviewer session. Không spawn replacement chỉ để có kết quả thuận lợi hơn.
- Nếu session cần reuse không còn khả dụng, Main đặt BLOCKED(session_unavailable). Owner quyết định có cho phép replacement session cùng explicit package hay không; replacement không được giả vờ là continuity.
- Khi Reviewer gọi Specialist, Specialist cũng nhận fresh bounded package và chỉ một consultation depth. Reviewer tổng hợp evidence rồi tự hoàn thành mọi required review dimension và verdict.

### Specialist consultation contract

- Specialist chỉ được cân nhắc khi caller có một câu hỏi chuyên môn cụ thể mà chính caller chưa đủ hiểu biết, repository evidence hoặc độ sâu chuyên môn để kết luận đáng tin cậy.
- Câu hỏi phải materially ảnh hưởng correctness/readiness, nằm trong một risk cluster và gói được thành 1–3 exact questions với bounded context, expected benefit và current permission rõ.
- Specialist không phải workflow gate, không phải replacement/fallback cho lifecycle Reviewer và không được nhận toàn bộ phase để review chung.
- Main, Planner, Implementor hoặc Reviewer có thể là caller. Caller giữ ownership, kiểm chứng claim và quyết định cách kết quả ảnh hưởng candidate của mình.
- Reviewer không được giao các required review dimensions hoặc verdict cho Specialist. Nếu Specialist thiếu evidence cho câu hỏi thiết yếu, Reviewer tự trả BLOCKED; nếu câu hỏi không thiết yếu, Reviewer ghi limitation rồi vẫn chịu trách nhiệm cho verdict.
- Specialist không gọi thêm Specialist/agent, không mutate candidate và không gửi handoff trực tiếp cho Main. Consultation depth tối đa là Main→Reviewer→Specialist hoặc Main/Agent→Specialist.

### Owner Source Package và GOAL derivation boundary

Main duy trì một ordered Owner Source Package tối thiểu cho workflow:

~~~text
owner_input_revision
owner_inputs[]
  source_ref_or_verbatim_text
  kind: initial_request | amendment | clarification | authority_steer
  applies_to
routing_summary  # optional, non-authoritative
~~~

- `owner_inputs[]` giữ nguyên wording của initial Owner request và mọi later input liên quan. Nếu source gốc không trực tiếp đọc được bởi fresh role, Main phải nhúng verbatim text; một paraphrase hoặc summary không đủ.
- `owner_input_revision` là sequence logic tăng khi relevant Owner input được thêm; nó không phải hash, provenance system hoặc GOAL Revision.
- Mỗi managed role nhận exact initial request cùng mọi later input liên quan tới contract của role đó. Main chỉ được bỏ input chứng minh là không liên quan và thêm routing context; không rewrite, collapse hoặc thay Owner source bằng diễn giải của mình. Khi amendment supersede nội dung cũ, cả hai vẫn được đưa theo thứ tự cùng quan hệ `applies_to`.
- Master Planner/Planner tự derive candidate GOAL và ghi `owner_input_revision` đã dùng. Main chỉ route và kiểm tra contract, không tự tạo semantic GOAL thay Planner/Owner.
- Master Plan Reviewer nhận cùng Owner Source Package mà Master Planner đã dùng và independently kiểm tra từng GOAL field với exact Owner input; không dùng Main summary, Planner summary hoặc Owner Summary làm source thay thế.
- Nếu exact source thiếu, role trả `BLOCKED(owner_input_unavailable)`. Nếu source cho phép nhiều materially different interpretations ảnh hưởng outcome, scope, invariant, ownership hoặc architecture direction, role trả `BLOCKED(ambiguous_owner_intent)` cùng các interpretation và affected dimensions; Main đặt OWNER_DECISION_REQUIRED thay vì tự chọn.
- Reviewer `PASS` chỉ xác nhận candidate trung thành với input theo review contract; nó không chứng minh Owner đã approve semantic GOAL. Candidate GOAL hoặc material revision vẫn cần Owner decision theo planning/authority contract.

### Running-role steer boundary

Main phân biệt ba delivery semantics: best-effort message vào active turn, follow-up được consume tại native message/tool boundary, và interrupt current turn rồi resume same session. Hai semantics đầu không tạo guarantee rằng child đọc steer trước action đã được model quyết định hoặc tool call đã dispatch.

Khi later Owner input thay đổi authority hoặc semantic contract có thể ảnh hưởng protected action kế tiếp của role đang RUNNING, Main phải:

1. append exact Owner wording vào Owner Source Package và tăng `owner_input_revision`;
2. yêu cầu native runtime interrupt/quiesce current turn và chờ trạng thái xác nhận turn không còn RUNNING;
3. audit repository/external state liên quan để phát hiện action đã dispatch hoặc hoàn tất trước boundary;
4. resume đúng same role session bằng verbatim steer, refreshed Owner Source Package, authority snapshot và candidate identity;
5. chỉ route tiếp từ state thực tế sau audit; không giả định revocation undo action đã xảy ra.

Nếu native runtime không thể xác nhận quiescence hoặc same-session resume, Main đặt `BLOCKED(owner_steer_not_synchronized)` và báo Owner. Không xây message bus, scheduler, polling loop hoặc persistent event system để bù. Steer thuần thông tin không ảnh hưởng action ordering có thể dùng live message/follow-up, nhưng Main không được claim before-next-action delivery.

### Authority flow

- Child role đề xuất next route nhưng không transition workflow.
- Reviewer ghi owned review artifact rồi trả concise handoff/verdict cho Main; Specialist chỉ trả advisory result cho caller.
- Main xác minh handoff identity/revision, cập nhật ephemeral ledger rồi mới route.
- Main không adjudicate detailed findings. Candidate author đọc Findings, independently verify/disposition từng finding và tạo correction; Reviewer chịu trách nhiệm rereview và verdict.
- Owner gates không thể được child role tự giải quyết hoặc suy ra từ PASS.

## D. Workflow State and Event Model

### Minimal ephemeral ledger

Main giữ trong current orchestration context:

~~~text
workflow_id
mode
goal_id
goal_revision
owner_input_revision
owner_input_refs
phase
active_role_thread_ids
candidate_ref
candidate_revision
episode_id
review_round
expected_review_artifact_ref
completed_correction_rounds
blocker
owner_decision_pending
~~~

review_round là logical review stage do Main cấp: 0 cho initial review, 1 cho rereview sau correction round 1, 2 cho rereview sau correction round 2. Owner-authorized correction ngoài automatic budget tiếp tục 3, 4… thay vì reset. Mỗi independent episode mới bắt đầu lại ở 0. expected_review_artifact_ref là exact destination của review artifact cho current round.

Không tạo database/event log. Native thread status sở hữu identity và liveness. Canonical plans, owned review artifacts và existing progress conventions sở hữu durable cross-session truth. Ledger chỉ tồn tại để Main không nhầm current route.

### External events

Chỉ cần ba event class:

| Event | Nguồn | Main xử lý |
| --- | --- | --- |
| OWNER_INPUT | Owner | Append lossless source, tăng owner_input_revision, phân loại authority/clarification/semantic change; nếu child RUNNING và action ordering bị ảnh hưởng thì quiesce trước khi route |
| ROLE_HANDOFF | Active role | Validate identity/workflow/phase/episode/candidate; với Reviewer còn validate review_round và exact artifact ref rồi áp dụng transition table |
| PLATFORM_STATUS_CHANGE | Native runtime hoặc environment | Cập nhật liveness/blocker; không tự đổi semantic verdict |

### Core transitions

| Current result | Transition do Main thực hiện |
| --- | --- |
| Author COMPLETED | Main đặt review_round=0, cấp exact review artifact destination rồi mở fresh Reviewer cho exact candidate/revision |
| Reviewer PASS | Validate exact review artifact/handoff rồi sang dependent phase hoặc final Owner report |
| Reviewer BLOCKING_FINDINGS | Validate artifact, route exact review_artifact_ref tới same author nếu budget còn; sau revised candidate cấp round artifact tiếp theo và gửi lại same Reviewer |
| Role BLOCKED | Reviewer ghi blocker vào expected artifact khi applicable; Main giữ phase, phân loại resolver và chờ state change/Owner input; không tăng correction counter |
| Implementor PLAN_CONTRACT_MISMATCH | Dừng implementation và reopen same Planner theo Section H |
| Planner MASTER_PLAN_CONTRACT_MISMATCH | Dừng E2E và đi theo closed/open Master Plan correction path |
| Correction budget exhausted | OWNER_DECISION_REQUIRED |
| Material Owner scope change | Invalidate/supersede candidate theo Contract 5 trước khi route |
| Authority/semantic steer tới RUNNING role | Interrupt/quiesce, audit actual state, rồi resume same session với exact Owner input; live message alone không authorize transition/action |

Main không chạy đồng thời hai writer trên cùng candidate. Trong lúc review, author/implementor không mutate candidate. Trước khi mở review, Main giữ một exact candidate-scoped start snapshot trong current review turn; ngay trước verdict admission, Main so sánh exact end state. Candidate có tracked baseline dùng exact Git object/diff comparison; candidate untracked hoặc already dirty dùng exact in-turn path/existence/byte comparison hoặc semantic equivalent. Snapshot không được persist thành artifact identity, hash/fingerprint, registry hoặc provenance record. Nếu candidate đã đổi ngoài route, Reviewer/Main giữ verdict không được admit và ghi `BLOCKED(candidate_moved)`.

## E. Handoff Contract

Task artifact, Reviewer-owned review artifact và conversational handoff là ba đối tượng khác nhau. Planner có thể tạo plan file; Implementor chủ yếu tạo working-tree diff; Correction role có thể chỉ trả recommendation. Mọi lifecycle Reviewer phải tạo hoặc cập nhật đúng một durable review artifact cho review round được giao, rồi trả một concise handoff trỏ tới artifact đó.

### Mandatory lifecycle review artifact

Main xác định exact expected_review_artifact_ref trước khi Reviewer chạy. Reviewer không được tự tìm hoặc chọn latest review, newest Markdown file hay most recent findings. Canonical destination:

~~~text
docs/agent-workflow/native-multi-agent/reviews/
  <workflow_id>/<episode_id>/
  <candidate_revision>-review-r<review_round>.md
~~~

workflow_id, episode_id và candidate_revision phải là path-safe logical identifiers do Main cấp. Một path chứa đúng một review artifact cho một logical review round; không tách Owner summary, findings và verification thành nhiều file.

Trong contract này, lifecycle review turn là một logical review_round, không phải mỗi transport retry hoặc follow-up message. Vì vậy BLOCKED/resume của cùng round cập nhật cùng exact artifact thay vì sinh tên latest/attempt mới.

Ownership boundary:

- Reviewer không được sửa candidate plan, implementation/code candidate hoặc source thuộc candidate.
- Reviewer được tạo/cập nhật duy nhất expected_review_artifact_ref thuộc review round đó. Đây là candidate-read-only, artifact-write boundary; không phải filesystem read-only tuyệt đối.
- Main và candidate author không sửa nội dung findings/verdict trong Reviewer-owned artifact.
- Candidate author và Reviewer không mutate cùng candidate đồng thời. Trong review phase, author/implementor bị pause.
- Main so sánh pre/post review working-tree scope để phát hiện Reviewer ghi ngoài quyền và so sánh exact candidate-scoped start/end content để phát hiện candidate movement. Nếu Reviewer thay đổi bất kỳ path nào ngoài expected_review_artifact_ref, Main quarantine handoff và đặt BLOCKED(reviewer_scope_violation); không tự revert hoặc coi candidate vẫn current.
- Nếu candidate path/existence/content currentness thay đổi, verdict không được admit; Reviewer ghi `BLOCKED(candidate_moved)` vào expected artifact của revision cũ và không repurpose path đó cho revision mới.
- BLOCKED rồi resume trong cùng logical review round cập nhật cùng artifact; review_round và correction counter không tăng. Artifact ghi blocker/resolution evidence cần thiết nhưng không trở thành event log.

Artifact là durable local workspace evidence xuyên role sessions, không phải repository publication artifact. Canonical `reviews/` directory phải bị Git ignore; Reviewer/Main không được stage, commit hoặc push review artifact. Retention/cleanup vẫn cần explicit Owner instruction; Git commit permission cho candidate không mở rộng sang review artifacts.

Artifact reuse existing code-review-and-quality finding/verdict/verification format và bổ sung đúng các phần:

~~~text
Review Identity
  workflow_id
  role
  phase
  owner_input_revision
  episode_id
  review_round
  candidate_ref
  candidate_revision
  review_artifact_ref

Verdict / Status

Owner Summary
  concise outcome
  finding IDs/counts or blocker
  recommended_next_route

Findings
  detailed finding ID/severity/location
  evidence
  failure mode and impact
  smallest sufficient correction
  affected lineage/workstream when relevant

Verification
Open Questions / Blocker
~~~

Owner Summary là projection để Main báo Owner và route mà không phải consume toàn bộ detailed findings. Findings là canonical detailed source cho candidate author và future rereview/history.

Main không adjudicate findings. Author phải đọc Findings, independently verify và disposition từng blocking finding trong correction response. Reviewer sau đó rereview exact revised candidate và chịu trách nhiệm cho verdict. Nếu author và Reviewer chưa thống nhất sau budget hiện hành, Main áp dụng reconciliation/Owner gate; Main không tự chọn bên thắng.

### Conversational handoff

~~~text
workflow_id
role
phase
owner_input_revision
episode_id
review_round
candidate_ref
candidate_revision
status
summary
artifact_refs
review_artifact_ref
findings_or_blocker
verification
recommended_next_route
~~~

owner_input_revision là required cho mọi managed role. review_round và review_artifact_ref là required đối với lifecycle Reviewer, not_applicable với non-reviewer role. Reviewer handoff phải echo exact values Main đã cấp; summary là Owner Summary; findings_or_blocker chỉ chứa finding IDs/counts hoặc blocker; và verification cùng recommended route là projection từ durable artifact. artifact_refs không được dùng để chọn review output và chỉ chứa supporting artifact references khi cần. Handoff không phải competing detailed finding source.

### Status vocabulary

| Status | Ai dùng | Semantics |
| --- | --- | --- |
| COMPLETED | Author role/Implementor | Candidate sẵn sàng cho review; không phải approval |
| PASS | Lifecycle Reviewer | Full phase review contract đạt; không tự authorize transition/action |
| BLOCKING_FINDINGS | Lifecycle Reviewer | Candidate có defect thuộc quyền kiểm soát của author và cần correction |
| BLOCKED | Mọi role | External/environment/permission/evidence condition ngăn role hoàn thành đáng tin cậy |
| PLAN_CONTRACT_MISMATCH | Implementor | Accepted detailed plan xung đột repository reality |
| MASTER_PLAN_CONTRACT_MISMATCH | Planner | Master Plan contract upstream bị repository reality challenge |

OWNER_DECISION_REQUIRED là workflow state do Main đặt, không phải child handoff status.

Specialist không dùng PASS hoặc BLOCKING_FINDINGS. Specialist trả:

~~~text
question
evidence
answer_or_insufficient_evidence
limitations
advisory_findings
~~~

Caller phải kiểm chứng và chịu trách nhiệm cho kết luận cuối.

### Candidate identity và stale-handoff prevention

- Main cấp workflow_id, phase, owner_input_revision, episode_id, review_round, expected_review_artifact_ref và monotonic candidate_revision như plan-r1, plan-r2 hoặc impl-r1. Đây là logical identity, không phải content fingerprint.
- Main chỉ nhận Reviewer handoff nếu native sender/thread đúng active role; toàn bộ echoed identifiers khớp open ledger; review_artifact_ref bằng exact expected destination; và artifact tồn tại với matching Review Identity.
- Handoff mismatch được quarantine là stale/crossed; không transition, không tăng budget. Main yêu cầu same session reissue với current identifiers hoặc báo BLOCKED nếu session không còn.
- Artifact refs của non-reviewer role dùng path, Git baseline/range hoặc native task reference hiện có. Reviewer artifact selection luôn dùng exact preassigned reference, không dùng directory scan/mtime/latest-name heuristic. Không thêm cryptographic hash.
- Main phải xác nhận expected review artifact path bị Git ignore và không tracked/staged trước khi admit handoff hoặc tạo candidate commit. Nếu artifact lọt vào Git scope, workflow đặt `BLOCKED(review_artifact_git_scope_violation)` cho tới khi exact staging/scope được sửa an toàn; không tự xóa durable evidence.
- Với mọi review, logical identity ngăn stale/crossed handoff nhưng không tự chứng minh same-path content stability. Main vì thế tuần tự hóa writer/reviewer, freeze candidate scope, giữ exact start snapshot trong review turn và exact-compare path/existence/content ngay trước admission. Với uncommitted implementation, package còn cung cấp HEAD, working-tree status và changed-path scope. Nếu exact comparison khác, không admit verdict cho revision cũ.

## F. GOAL Contract

Mọi Master Plan dùng schema:

~~~text
GOAL ID
GOAL Revision
Desired Outcome
Success Boundaries
Protected Invariants
Scope Boundary
~~~

Rules:

- GOAL ID ổn định, human-readable và không tái sử dụng cho initiative khác.
- Master Planner/Planner derive candidate GOAL trực tiếp từ exact Owner Source Package. Main không được thay Owner/Planner diễn giải semantic GOAL; Main summary không phải GOAL source.
- Candidate GOAL ghi owner_input_revision đã dùng. Master Plan Reviewer phải nhận cùng exact Owner inputs và independently kiểm tra GOAL fidelity trước khi verdict.
- GOAL Revision là integer chỉ tăng khi Owner phê duyệt semantic change đối với outcome, boundaries, invariants hoặc scope.
- Desired Outcome mô tả trạng thái đạt được, không mô tả implementation.
- Success Boundaries nêu observable outcomes và claim boundary cần chứng minh.
- Protected Invariants nêu điều luôn phải đúng xuyên các workstream.
- Scope Boundary nêu included outcome và explicit exclusions.
- Các câu như reuse service X, create table Y hoặc put endpoint in module Z không nằm trong GOAL; chúng thuộc lower-layer contract.
- Plan Revision thay đổi khi decomposition/contract chi tiết được correction nhưng GOAL không đổi.

Precedence:

~~~text
Owner intent / GOAL
  → current repository and runtime reality
  → Master Plan contracts and decomposition
  → accepted Detailed Implementation Plan
  → implementation
~~~

Lower layer phát hiện conflict phải báo mismatch lên trên; không được lặng lẽ sửa semantic root. Nếu Owner input có nhiều materially different interpretations ảnh hưởng outcome, scope, invariant, ownership hoặc architecture direction, workflow dừng ở Owner gate. Chỉ Owner tăng GOAL Revision; Reviewer PASS không thay thế Owner approval.

## G. Semantic Lineage Contract

### Representation

Lineage là một hoặc vài Markdown table trong canonical Master Plan, không phải graph database. Mỗi semantic contract/workstream có stable ID và đúng các field:

| ID | owns | depends_on | consumes | produces | assumes |
| --- | --- | --- | --- | --- | --- |
| NMA-WSx | Canonical source hoặc role owner | Upstream IDs | Named semantic inputs | Named semantic outputs | Assumption, evidence source và invalidation condition |

Downstream relationship được suy từ depends_on và consumes/produces; không lưu thêm một danh sách downstream có thể drift. Detailed plan tham chiếu Master Plan IDs và chỉ thêm task-local edges/assumptions cần thiết, không copy toàn bộ graph.

### Ownership

- Master Planner tạo lineage và nêu assumption evidence/invalidation condition.
- Master Plan Reviewer cố falsify dependency, ownership, affected/unaffected và missing-edge claims.
- E2E Planner cập nhật task-local lineage delta.
- Plan Reviewer cố falsify delta và blast-radius claim.
- Implementor consume accepted lineage, báo mismatch thay vì redesign.
- Implementation Reviewer xác minh observable implementation với accepted semantic contracts.
- Main chỉ route và bảo toàn revision; không tự viết lại lineage để né mismatch.
- Specialist chỉ trả evidence cho câu hỏi được giao; caller quyết định lineage có cần đổi hay không.

### Blast-radius semantics

1. Bắt đầu từ contract hoặc assumption bị invalidated.
2. Đi theo depends_on và consumes→produces edges một cách transitive.
3. Phân loại node thành affected, unaffected hoặc needs_review.
4. affected khi contract/input/assumption mà node dựa vào đã đổi.
5. unaffected chỉ khi không có changed semantic path tới node và mọi direct assumption liên quan vẫn được current evidence xác nhận.
6. Không tìm thấy edge không phải bằng chứng unaffected. Unknown giữ needs_review.
7. Reviewer phải cố tìm missing edge và challenge evidence cho unaffected.

Stable IDs cùng repository search đủ cho quy mô hiện tại. Không tạo graph engine, parser hoặc fingerprint registry nếu implementation evidence chưa chứng minh nhu cầu.

### Initial lineage

| ID | owns | depends_on | consumes | produces | assumes |
| --- | --- | --- | --- | --- | --- |
| NMA-WS1 | docs/agent-workflow current-truth owners | none | Git history, adaptive plan/progress ownership | Reconciled baseline và program boundary | origin/main ancestry là current delivery evidence; invalidated khi Git/status đổi trước implementation |
| NMA-WS2 | AGENTS.md + docs/agent-loops.md + active terminology owners | NMA-WS1 | Root simplicity rule, current preflight, Reviewer/Specialist audit | Canonical mode routing và collision-free role vocabulary | Existing Specialist semantics được giữ; invalidated nếu active skill ownership đổi |
| NMA-WS3 | Native multi-agent orchestration skill | NMA-WS2 | Mode vocabulary, exact Owner source/authority, native lifecycle and quiescence primitives | State, Owner Source Package, safe steer, handoff, review-round/artifact, budget, blocker và scope-change contracts | Native identity/message/follow-up/interrupt/wait primitives khả dụng; invalidated bởi platform capability change |
| NMA-WS4 | Project .codex agent profiles | NMA-WS2, NMA-WS3 | Role boundaries, Owner source/steer contract, artifact ownership và class mapping | Fresh Planner/Reviewer/Implementor/Specialist profiles có same-session resume | Config schema/model availability hiện hành; invalidated bởi Codex config/model drift |
| NMA-WS5 | Planning skill + Master Plan convention | NMA-WS3, NMA-WS4 | Exact Owner Source Package, GOAL, lineage, handoff/artifact, Reviewer distinction | Operable Master Plan Only lifecycle | Existing durable-plan ownership vẫn phù hợp; invalidated nếu plan/progress convention đổi |
| NMA-WS6 | Lifecycle/planning/review skills | NMA-WS5 | Accepted master contracts, Owner steer boundary, plan drift, reconciliation | Operable Multi-Agent E2E lifecycle | Sequential shared-tree ownership và native quiescence đủ; invalidated nếu concurrent writers trở thành requirement |
| NMA-WS7 | Program integration/progress owners | NMA-WS5, NMA-WS6 | Verified managed modes và legacy compatibility | Rollout-ready repository contract | Phase evidence còn current; invalidated bởi later edits tới consumed owners |

## H. Plan Drift and Master Plan Correction

### Detailed-plan mismatch trong active E2E workflow

1. Implementor dừng phần phụ thuộc và trả PLAN_CONTRACT_MISMATCH cùng repository evidence; không tự redesign plan.
2. Main giữ working tree, không revert, và gửi mismatch tới same Planner session.
3. Planner independently verifies claim:
   - false: trả evidence bác bỏ; Main có thể resume same Implementor;
   - true: tăng detailed Plan Revision, sửa candidate nhỏ nhất giữ GOAL, cập nhật lineage và blast radius.
4. Main gửi corrected candidate tới same Plan Reviewer session.
5. Plan Reviewer rereview full affected contract, cố falsify affected/unaffected claims và trả verdict.
6. PASS: Main gửi revised accepted plan tới same Implementor; implementation tiếp tục.
7. BLOCKING_FINDINGS: dùng reconciliation episode của plan-drift event.
8. Nếu correction chạm Master Plan contract, Planner trả MASTER_PLAN_CONTRACT_MISMATCH.

### Open versus closed Master Plan mismatch

- Nếu original Master Planner/Reviewer sessions vẫn active trong cùng Master Plan workflow, Main tái sử dụng chúng theo correction contract.
- Nếu Master Plan thuộc workflow đã đóng, Main pause E2E và spawn fresh Master Plan Correction A với zero inherited history.

Correction payload chỉ chứa GOAL, canonical Master Plan, challenged contract, mismatch claim/evidence, current repository sources và relevant lineage. Correction role:

1. independently verifies mismatch;
2. trace tới GOAL/protected invariants;
3. đề xuất smallest goal-preserving correction;
4. phân tích direct/transitive blast radius;
5. liệt kê invalidated assumptions;
6. nêu unaffected chỉ khi có positive evidence;
7. trả recommendation, không sửa canonical plan và không tiếp tục implementation.

Main đặt OWNER_DECISION_REQUIRED và báo Owner. Owner quyết định sửa Master Plan, đổi current task, đổi scope hay dừng.

## I. Five Previously Unresolved Contracts

### Contract 1 — Universal Preflight Routing

Main được phép đọc nhẹ:

- Owner request, current permissions và explicit exclusions;
- applicable root/nested AGENTS.md;
- skill metadata, rồi toàn bộ exact skill được activated;
- direct target/owner source và nearby contract/test;
- Git status/baseline khi task có thể mutate;
- directly linked Master Plan, ADR, progress/problem source;
- one-hop dependency/consumer clues cần để phân loại shape.

Discovery còn bounded cho Main khi một coherent outcome, một ownership chain và acceptance boundary đã nhìn thấy mà không cần khảo sát nhiều independent capabilities. Main giao substantive discovery cho Master Planner/Planner khi chính discovery phải:

- phân rã nhiều independently deliverable capabilities;
- resolve dependency/order giữa nhiều semantic owners;
- xác định một bounded task từ broad problem;
- hoặc cần independent planning judgment để giảm material correctness risk.

Không dùng score. Main trả lời bốn câu:

1. Có một outcome hay nhiều independent outcomes?
2. Ownership/dependency đủ ổn định để lập bounded task chưa?
3. Independent planning/review có thể materially giảm risk không?
4. Có conflict/authority gap khiến không route an toàn không?

Escalation:

- NORMAL → E2E khi discovery lộ material ambiguity/risk nhưng outcome vẫn coherent.
- NORMAL → Master Plan khi lộ nhiều independent capabilities hoặc unstable decomposition.
- Bảo toàn working tree; dừng mutation phụ thuộc; không revert tự động.
- Nếu partial work không thể được disposition an toàn dưới route mới, Main đặt OWNER_DECISION_REQUIRED.
- Task nhỏ không mở managed workflow chỉ vì nhiều file, nhiều skill hoặc mong muốn review chung chung.

### Contract 2 — Handoff Protocol

Section E là canonical schema. Mỗi lifecycle review round tạo một Reviewer-owned durable artifact; code-review-and-quality tiếp tục sở hữu detailed finding/report content. Main preassign exact path, nhận concise handoff tách biệt task/review artifact, kiểm tra native thread identity cùng workflow/phase/episode/review-round/candidate identity và exact artifact reference, quarantine stale result và là bên duy nhất transition. Main không chọn artifact bằng latest/mtime/glob và không adjudicate findings. Không có hash, persistent DB hoặc custom message bus.

### Contract 3 — Reconciliation Budget Exhaustion

- Initial review là round 0 và không tiêu correction budget.
- Một completed correction round gồm: same author nhận findings → author tạo revised candidate → same Reviewer hoàn tất rereview.
- Main cấp review_round=0 cho initial review; sau correction round 1/2 cấp review_round=1/2. Mỗi independent episode reset review_round về 0.
- Trước mỗi rereview, Main cấp candidate_revision hiện hành và exact artifact path cho review_round đó. Owner-authorized extra round tiếp tục review_round=3, 4… cùng counter, không reset.
- Reviewer chỉ echo review_round trong review artifact/handoff; Reviewer không tự tăng hoặc diễn giải counter.
- Main tăng completed_correction_rounds chỉ khi same Reviewer hoàn tất rereview corrected candidate bằng PASS hoặc BLOCKING_FINDINGS và matching round artifact đã được nhận. BLOCKED ở author, environment hay rereview đều không tiêu round.
- Mỗi episode có tối đa 2 automatic correction rounds.
- Nếu Reviewer vẫn trả BLOCKING_FINDINGS sau rereview round 2, Main pause và đặt OWNER_DECISION_REQUIRED. Không spawn reviewer khác, không tự round 3, không abandon workflow.
- episode_id định danh một candidate subject cộng một causal issue family, ví dụ initial plan, implementation hoặc later independent plan drift.
- Cùng unresolved root cause dù biểu hiện khác vẫn dùng cùng episode; không reset budget bằng cách đổi tên finding.
- Một later independent drift event với root cause mới mở episode mới. Nếu independence không chứng minh được, Main hỏi Owner.
- Owner có thể explicit authorize thêm round cho cùng episode. Counter tiếp tục 3, 4… và reuse same sessions nếu khả dụng; không reset về 0.
- Chỉ Main sở hữu counter.

### Contract 4 — External / Environment Blocker Semantics

BLOCKING_FINDINGS là defect thuộc candidate/author control và đi vào correction loop. BLOCKED là service, secret, dependency, test infra, runtime, unsafe repository state, required manual validation, permission hoặc necessary evidence không khả dụng.

| Blocker class | Resolver/route |
| --- | --- |
| Transient service/runtime | Main chỉ bounded retry sau observed state change; không busy loop |
| Secret/credential/permission | Owner hoặc authorized operator; Main không tự xin/đoán secret |
| Broken external dependency/test infra | Owning system/team hoặc separate authorized task; current phase giữ BLOCKED |
| Unsafe/unexpected Git state | Main đọc và báo exact state; Owner quyết định nếu không có safe non-destructive route |
| Required manual/production validation | Owner/authorized operator cung cấp evidence; không giả lập PASS |
| Missing candidate evidence | Route lại current author/Reviewer nếu thuộc contract và session khả dụng; nếu source/authority thiếu thì Owner gate |

Sau resolution, Main revalidate current candidate/revision rồi resume đúng role. Verification report dùng Verified, Partially verified, Not verified hoặc Blocked; skipped/unavailable checks phải rõ. BLOCKED không tăng correction counter.

### Contract 5 — Owner Input, Scope or Authority Change During Active Workflow

Mọi later Owner steer trước hết được append nguyên văn vào Owner Source Package; Main summary không thay thế source. Main pause route hiện tại và phân loại trước khi gửi requirement cho child:

| Loại | Tiêu chí | Candidate/revision disposition | Route |
| --- | --- | --- | --- |
| Clarification | Không đổi GOAL, scope boundary, invariant, ownership, dependency hoặc acceptance | Current candidate tăng logical revision nếu content đổi; active review bị invalidated | Same author hấp thụ, rồi review lại affected candidate |
| Detailed-plan change | Outcome vẫn trong GOAL nhưng plan contract/acceptance/dependency đổi materially | Mark current candidate SUPERSEDED_BY_OWNER_CHANGE; giữ evidence | Reopen same Planner, tạo new plan revision và review episode |
| Master Plan contract change | GOAL giữ nguyên nhưng workstream/upstream contract đổi | Current lower candidate suspended | Master Plan amendment/correction rồi Owner approval |
| Broad-scope expansion | Requirement tạo nhiều independent capabilities hoặc unstable decomposition | Current E2E candidate suspended, không append | Route Master Plan Only |
| GOAL/invariant/scope semantic change hoặc prior work disposition không rõ | Outcome/protected invariant/scope boundary thay đổi, hoặc phần implementation lớn có thể bỏ/giữ/rework | Preserve; không revert/discard ngầm | OWNER_DECISION_REQUIRED; Owner tăng GOAL Revision và quyết định disposition |

Owner input không tiêu correction round. Nếu Reviewer đang review candidate bị thay đổi, verdict đó trở thành stale và không được dùng. Same role session có thể tiếp tục trong active workflow sau explicit revised payload; freshness chỉ bắt buộc ở initial role creation, không phải mỗi Owner clarification.

Authority-only delta không tự đổi candidate/GOAL revision, nhưng tăng owner_input_revision và authority snapshot:

- Với child idle/completed, Main follow-up same session bằng exact Owner wording trước khi route action phụ thuộc.
- Với child RUNNING, live message hoặc boundary-delivered follow-up không đủ chứng minh child đã đọc delta trước protected action kế tiếp. Main dùng Running-role steer boundary: interrupt/quiesce → audit actual state → resume same session bằng exact steer.
- Grant mới không hồi tố authorize action trước khi role nhận refreshed snapshot. Revocation không undo action đã dispatch/hoàn tất; nếu audit thấy action đã xảy ra, Main báo exact state và route theo Owner disposition.
- Ví dụ `commit: not granted → allowed, push: not granted` và reverse `commit: allowed → revoked` đều dùng cùng synchronization boundary nếu Implementor đang RUNNING. Sau resume, child chỉ được hành động theo snapshot mới; nếu boundary không xác nhận được, workflow giữ BLOCKED.

## J. Workstream Decomposition

### Phase dependency overview

~~~text
Phase 1: NMA-WS1
  → Phase 2: NMA-WS2 → NMA-WS3 + NMA-WS4
      → Phase 3: NMA-WS5
          → Phase 4: NMA-WS6
              → Phase 5: NMA-WS7
~~~

Phase boundary dựa trên contract dependency, không dựa trên số file. Mỗi phase phải pass gate của chính nó trước khi dependent phase bắt đầu. Failed, skipped hoặc unavailable mandatory evidence giữ phase BLOCKED.

### Phase 1 — Current truth và ownership baseline

#### NMA-WS1 — Reconcile current truth and program boundary

- Objective: sửa tracker drift đã xác nhận và thiết lập link/ownership boundary giữa adaptive program cũ với native multi-agent extension.
- Owned contracts: canonical current status, plan/progress ownership, historical-vs-active boundary.
- Dependencies: none.
- Expected affected areas: docs/agent-workflow current plan/progress và minimal navigation tới native plan.
- Semantic outputs: reconciled baseline; active owner map consumed by mọi phase sau.
- Completion boundary: Git evidence và tracker không còn mâu thuẫn; hai program không claim cùng contract; historical per-PR evidence không bị rewrite.
- Verification intent:
  - xác minh merge ancestry/remote branch state và exact tracker row;
  - kiểm tra links, Markdown, diff scope, UTF-8/EOL và git diff --check;
  - independent docs review phải challenge ownership overlap.
- Likely workflow: NORMAL vì correction nhỏ, deterministic và một owner chain.

Phase 1 gate: current-truth assertions match Git; no ambiguous semantic owner. Phase 2 không dùng stale tracker làm baseline.

### Phase 2 — Operable native orchestration foundation

#### NMA-WS2 — Root principle, routing and terminology migration

- Objective: bổ sung operational anti-overengineering guidance còn thiếu, route managed modes từ root/lifecycle và loại semantic collision Reviewer/Specialist trong active owners.
- Owned contracts: Normal-first routing, mode taxonomy, reserved role vocabulary, consultation boundary.
- Dependencies: NMA-WS1.
- Expected affected areas: AGENTS.md; docs/agent-loops.md; active adaptive plan; planning/review skill wording và direct specialist references.
- Semantic outputs: collision-free roles và root-reachable route consumed by NMA-WS3–WS7.
- Completion boundary:
  - AGENTS Rule 2 được bổ sung tối thiểu về native-before-custom, ephemeral-before-persistent, no unjustified crypto/audit/oracle/generalization;
  - active sources dùng Reviewer cho lifecycle role và Specialist cho optional advisor;
  - historical implementation plans không bị mass rewrite;
  - Specialist vẫn optional/advisory, Reviewer vẫn mandatory/full-contract.
- Verification intent:
  - repository-wide terminology audit phân biệt active owner và historical records;
  - root-to-lifecycle-to-skill reachability scenarios;
  - scenarios chứng minh Reviewer có thể gọi Specialist nhưng vẫn tự trả đủ dimensions/verdict; Specialist không transition;
  - existing Specialist permission, bounded-context và no-recursion invariants không regress.
- Likely workflow: MULTI_AGENT_E2E vì cross-owner governance wording có semantic collision risk.

#### NMA-WS3 — Native orchestration core contract

- Objective: tạo một repo-local skill owner duy nhất cho managed-mode lifecycle mà chỉ composition native primitives.
- Owned contracts: Main ledger/events, lossless Owner Source Package, safe running-role steer/quiescence, handoff, mandatory review artifact identity/path, stale admission, reconciliation budget, blockers, scope/authority change, freshness/session reuse và Owner gates.
- Dependencies: NMA-WS2.
- Expected affected areas: một native-multi-agent workflow skill/bounded references; root/lifecycle route chỉ khi cần.
- Semantic outputs: canonical orchestration contract consumed by managed planning và E2E roles.
- Completion boundary: năm unresolved contracts có một owner; every lifecycle review round có exact preassigned single artifact; Main không adjudicate findings; không duplicated contract across role profiles và không runtime/database/harness mới.
- Verification intent:
  - deterministic scenario matrix cho mọi status/transition, review_round 0/1/2, exact artifact selection, local-only artifact Git boundary, two-round exhaustion, blocker non-consumption, stale/crossed handoff, lossless Owner source, ambiguous-intent Owner gate và năm scope-change classes;
  - native canary ghi exact disposition `A. LIVE_STEERING_SUPPORTED`, phân biệt active-turn delivery, next-boundary delivery và interrupt+same-session resume; authority grant/revocation case phải dùng observable quiescence thay vì message-send success;
  - validate-skill trên bundle và direct-reference routing;
  - negative checks: no latest/glob artifact lookup, Main cannot adjudicate findings, child cannot transition, Specialist cannot verdict, no third automatic correction, no silent model fallback.
- Likely workflow: MULTI_AGENT_E2E.

#### NMA-WS4 — Project-scoped native role profiles

- Objective: cấu hình fresh Planner, Reviewer, Implementor và Specialist profiles; Master Planner/Correction dùng Planner profile với phase payload.
- Owned contracts: role instructions, Class A/B model mapping, candidate-read-only/artifact-write boundary và delegation boundaries.
- Dependencies: NMA-WS2, NMA-WS3.
- Expected affected areas: project .codex/agents configuration và minimal config documentation.
- Semantic outputs: executable native role identities consumed by NMA-WS5/NMA-WS6.
- Completion boundary: model/effort có một config owner; Reviewer và Specialist là profiles riêng; Reviewer profile không dùng filesystem read-only nếu điều đó chặn expected review artifact, nhưng chỉ được mutate exact owned artifact; unavailable model yields BLOCKED; no duplicated lifecycle rules.
- Verification intent:
  - current Codex config schema parse/load check;
  - role-boundary inspection, exact candidate-scoped start/end content comparison cho tracked, already-dirty và untracked cases, artifact-only write audit, `git check-ignore`/tracked/staged audit cho review path, `candidate_moved`/`reviewer_scope_violation`/`review_artifact_git_scope_violation` stop scenarios và no-conflicting-instruction audit;
  - bounded native smoke trong repository context chứng minh zero-history initial spawn, native identity/status, same-session follow-up, interrupt+same-session resume, exact Owner steer propagation, same Reviewer rereview, exact preassigned review artifact write và exactly one-level Reviewer→Specialist consultation;
  - smoke phải chứng minh Specialist answer quay về Reviewer, Reviewer tự tổng hợp full verdict, Main mới transition.
- Likely workflow: MULTI_AGENT_E2E.

Phase 2 gate: static contracts pass và native smoke chạy được bằng current project config; exact in-turn comparison chứng minh candidate path/existence/content không đổi trong cả tracked, already-dirty và untracked cases; chỉ exact Reviewer-owned artifact được ghi; artifact vẫn ignored/untracked/unstaged; handoff khớp artifact identity; runtime observation vẫn phù hợp disposition A; và authority-sensitive steer chỉ resume sau confirmed quiescence/state audit. Nếu native feature/config/model, candidate-stability detector, local-only artifact boundary hoặc same-session interrupt/resume không khả dụng, phase là BLOCKED và NMA-WS5/NMA-WS6 không bắt đầu. Không thay bằng custom runner.

### Phase 3 — Master Plan Only lifecycle

#### NMA-WS5 — GOAL, lineage and reviewed Master Plan contract

- Objective: làm Master Plan Only operable qua existing planning ownership, gồm GOAL, lineage, workstream/phase decomposition, Master Plan Reviewer và closed-plan correction route.
- Owned contracts: Master Plan artifact convention, Owner-source fidelity, Planner-owned candidate GOAL derivation, GOAL/Plan revision, lineage table, phase verification, fresh Master Plan Review và Master Plan review artifact consumption.
- Dependencies: NMA-WS3, NMA-WS4.
- Expected affected areas: implementation-planning-and-pr-breakdown skill/references/templates; native program documentation/progress convention.
- Semantic outputs: reviewed Master Plans usable by future independent E2E sessions.
- Completion boundary: workflow kết thúc sau reviewed plan; không implementation; no material architecture decision deferred to Implementor.
- Verification intent:
  - deterministic cases cho vague GOAL rejection, implementation leakage, missing lineage edge, false unaffected claim, Owner GOAL revision, materially ambiguous Owner input và closed Master Plan mismatch;
  - một bounded non-mutating native rehearsal trên current repository question với expected acceptance recorded before dispatch: fresh Master Planner, fresh Master Plan Reviewer, exact r0/r1 review artifacts, one same-session correction/rereview và Main-owned transition;
  - rehearsal cấp cùng exact ordered Owner Source Package cho Planner và Reviewer; Reviewer phải kiểm tra GOAL fidelity từ source đó, không từ Main/Planner summary, và PASS không được ghi thành Owner approval;
  - xác minh Owner Summary đủ cho Main route/report, còn author correction dùng detailed Findings chứ không dùng summary;
  - Reviewer must answer all Master Plan review dimensions even if it calls Specialist;
  - current plan/progress/artifact links, local-only review artifact Git-boundary audit và skill validator pass.
- Likely workflow: MULTI_AGENT_E2E cho chính implementation workstream; capability được tạo là Master Plan Only.

Phase 3 gate: native rehearsal chứng minh GOAL/lineage/reconciliation semantics trong intended context. Không dùng CLI success đơn thuần làm semantic PASS.

### Phase 4 — Multi-Agent E2E lifecycle

#### NMA-WS6 — Detailed plan, implementation review and drift routing

- Objective: nối existing planning/review/test/Git contracts vào fresh Planner→Plan Reviewer→Implementor→Implementation Reviewer lifecycle.
- Owned contracts: detailed-plan candidate, implementation candidate, mandatory review artifact/dimensions/verdict, plan drift, open/closed Master Plan mismatch và E2E correction episodes.
- Dependencies: NMA-WS5.
- Expected affected areas: docs/agent-loops; planning/review skills và chỉ các domain/Git/test routes thật sự xung đột.
- Semantic outputs: bounded managed implementation lifecycle consumed by rollout.
- Completion boundary:
  - lifecycle Reviewer không bị optional Specialist gate làm bypass;
  - Implementor không tự sửa plan;
  - same-session correction và two-round exhaustion hoạt động;
  - BLOCKED, manual QA pending và verification gaps không biến thành PASS.
- Verification intent:
  - deterministic full-flow matrix gồm PASS, finding round 1/2, exhausted budget, blocker-resume, stale result, all Owner scope-change classes, plan drift, Master Plan mismatch và authority grant/revocation khi Implementor RUNNING;
  - bounded representative repository pilot trong isolated/safely serialized working state với fresh roles, explicit permission và one real correction path;
  - pilot chứng minh mỗi Plan/Implementation Reviewer round chỉ ghi exact preassigned local-only artifact, artifact không tracked/staged, candidate không đổi, handoff là projection và author independently dispositions detailed Findings;
  - pilot chứng minh verbatim later steer được preserve; live message alone không mở/đóng protected authority; interrupt/quiesce, state audit và same-session resume xảy ra trước next affected action;
  - pilot gồm một Reviewer→Specialist path chỉ khi gate/permission thực sự đạt; nếu không có justified Specialist, dùng dedicated bounded consultation smoke từ Phase 2 thay vì gọi cho đủ số;
  - exact Git identity/scope audit cộng in-turn path/existence/content comparison cho candidate currentness, relevant test layer và manual evidence theo existing skills.
- Likely workflow: MULTI_AGENT_E2E.

Phase 4 gate: pilot chứng minh complete E2E semantics, gồm lossless Owner intent và running-role authority synchronization, không chỉ prompt/template presence. Nếu manual/live evidence bắt buộc chưa có, phase giữ Partially verified hoặc BLOCKED và không rollout.

### Phase 5 — Compatibility, rollout and durable status

#### NMA-WS7 — Integration closure and controlled adoption

- Objective: xác nhận managed modes, Normal path và existing skill ecosystem cùng hoạt động; ghi current status và rollout boundary.
- Owned contracts: compatibility matrix, durable progress evidence, adoption/rollback boundary.
- Dependencies: NMA-WS5, NMA-WS6.
- Expected affected areas: native program progress/navigation và only confirmed duplicated active wording.
- Semantic outputs: repository-ready contract và evidence package cho Owner review/adoption.
- Completion boundary:
  - Normal task không spawn role ngoài nhu cầu;
  - Master Plan Only không implement;
  - E2E không bypass lifecycle Reviewer;
  - legacy Specialist vẫn optional và gọi được bởi Agent/Reviewer;
  - old skill-eval harness không bị biến thành workflow runtime.
- Verification intent:
  - cumulative active-owner terminology/route/permission audit;
  - local review artifact inventory đối chiếu exact workflow/episode/candidate/review_round, không dựa vào latest hoặc mtime, đồng thời xác nhận không artifact nào tracked/staged;
  - skill validator và relevant repository structural tests;
  - fresh-reader governance test cho mode choice, Reviewer/Specialist distinction, handoff và Owner gates;
  - reuse Phase 2–4 live evidence nếu exact consumed contracts/config không đổi; rerun only modes whose inputs changed;
  - application build/browser/Supabase checks là not applicable trừ khi actual diff ngoài plan chạm các behavior đó.
- Likely workflow: MULTI_AGENT_E2E vì integration review trải nhiều governance owners.

Phase 5 gate: every completion claim có current proportional evidence; skipped/not-applicable/blocked được ghi chính xác. Rollout approval vẫn thuộc Owner và không cấp Git/remote authority.

## K. Migration / Compatibility Strategy

### Reuse → adapt → remove only proven duplication

1. Reuse root preflight, adaptive sizing, planning, review, test, Git và optional Specialist contracts.
2. Reconcile current status và link new program; không rewrite adaptive history.
3. Reserve Reviewer cho mandatory lifecycle role.
4. Rename active semantic wording:
   - specialist reviewer → Specialist;
   - reviewer behavior trong specialist reference → Specialist behavior and output;
   - spawn a reviewer trong optional branch → call/spawn a Specialist;
   - bounded specialist package/reviewer contract → bounded Specialist consultation contract.
5. Giữ file path specialist-review.md ban đầu để tránh needless link churn; chỉ rename path nếu fresh-reader evidence chứng minh path gây nhầm thật sự.
6. Historical docs dưới implementation-plans giữ nguyên. Khi cần đọc lịch sử, canonical glossary của plan này giải thích cách gọi cũ.
7. Thêm lifecycle Reviewer contract song song; không chuyển optional Specialist gate thành mandatory review gate.
8. Reviewer được phép gọi Specialist theo exact bounded gate. Existing rule Specialist không delegation vẫn giữ.
9. Tạo project role profiles sau khi active terminology rõ; không duplicate orchestration logic vào từng profile.
10. Chỉ xóa wording/reference khi repository search chứng minh không còn active consumer hoặc competing owner.
11. Reuse review-report-templates cho finding/verdict content; native orchestration owner chỉ bổ sung mandatory artifact timing, logical identity, deterministic local-only path và handoff projection.
12. Reviewer profile chuyển từ ambiguous read-only wording sang candidate-read-only/artifact-write. Main preassign path, audit chỉ owned artifact thay đổi và xác nhận review path bị Git ignore/untracked/unstaged; không dùng evaluator review-artifact store hoặc retention subsystem.
13. Initial/later role payload dùng một exact ordered Owner Source Package; `routing_summary` tách riêng và non-authoritative. Không tạo message database, transcript store, hash hoặc provenance layer.
14. Map current native runtime vào semantic boundary: ordinary live delivery cho non-order-sensitive context; interrupt/quiesce + audit + same-session resume cho authority/contract steer ảnh hưởng protected action. Không hard-code tool spelling vào durable rule.

### Compatibility assertions

- Existing main-only review vẫn hợp lệ trong NORMAL.
- Existing Specialist signals/permission gates vẫn hợp lệ cho optional consultation.
- Managed workflow bắt buộc lifecycle Reviewer bất kể có Specialist hay không.
- Existing severity/verification taxonomy được tái sử dụng; lifecycle handoff status không thay taxonomy finding.
- Reviewer-owned artifact là detailed source; conversational handoff chỉ là transport/projection, còn Main không adjudicate findings.
- Planner và Master Plan Reviewer cùng đọc exact Owner source; Main routing summary không phải semantic source và Reviewer PASS không phải Owner GOAL approval.
- Authority grant/revocation tới RUNNING role chỉ có hiệu lực workflow sau confirmed quiescence, state audit và same-session resume; message delivery success không đủ.
- Existing per-PR plan convention được mở rộng bằng Master Plan ID/lineage refs, không thay thế.
- Existing skill-eval tools chỉ validate skill artifacts; native orchestration dùng native session primitives.

## L. Risks and Open Questions

### Risks đã có mitigation

| Risk | Impact | Mitigation/phase gate |
| --- | --- | --- |
| Codex custom-agent schema hoặc native tool semantics drift | Profiles không load hoặc freshness/reuse claim sai | NMA-WS4 verifies current docs/runtime; semantic contract uses platform-equivalent wording; BLOCKED instead of custom fallback |
| Required GPT-5.6 Sol profile unavailable | Class A/B intent bị silent downgrade | Single config owner; explicit BLOCKED; Owner decides replacement |
| Shared working tree thay đổi trong review | Reviewer verdict áp vào wrong candidate | Serialized writers, logical revision/native identity và exact candidate-scoped start/end path/existence/content comparison trong review turn |
| Reviewer ghi nhầm hoặc Main chọn nhầm artifact | Findings của revision/round khác bị route | Main preassign exact path; artifact/handoff echo identity; no latest/glob/mtime selection |
| Local review artifact lọt vào Git/remote scope | Internal workflow evidence bị publish ngoài ý Owner | Versioned ignore rule; admission và pre-commit tracked/staged audit; block without deleting evidence |
| Old reviewer terminology còn trong active source | Optional Specialist bị hiểu thành mandatory Reviewer hoặc ngược lại | NMA-WS2 active-owner audit; historical records exempt and documented |
| Live smoke tốn quota hoặc thiếu authority | Structural checks không đủ chứng minh native semantics | Live evidence is phase gate; obtain separate authority/budget or remain BLOCKED |
| Message/follow-up đến sau affected action đã dispatch | Grant/revocation bị áp sai thời điểm | Authority-sensitive steer bắt buộc quiesce, audit state và resume same session; already-completed action được báo, không giả vờ rollback |
| Main summary làm drift Owner intent | Planner derive sai GOAL hoặc Reviewer xác nhận nhầm target | Same ordered verbatim Owner Source Package cho role; summary non-authoritative; ambiguity route Owner |

### Open questions không chặn freeze

- Exact Codex config keys/tool spelling có thể thay đổi trước implementation. Đây là compatibility fact được NMA-WS4 kiểm tra, không phải semantic architecture decision.
- Representative pilot task cho NMA-WS6 chỉ được chọn khi Owner cấp implementation/pilot authority. Selection không được thay acceptance contract; thiếu authority giữ phase BLOCKED.

Không còn unresolved semantic decision nào cần Implementor tự phát minh. Model substitution và extra correction đều có Owner gate.

## Freeze Readiness

Đây là Section M của Master Plan.

Freeze Readiness: READY

Evidence:

- GOAL schema, revision ownership và precedence đã concrete.
- Routing giữa NORMAL, MULTI_AGENT_MASTER_PLAN, MULTI_AGENT_E2E và OWNER_DECISION_REQUIRED đã có deterministic decision questions và escalation rules.
- Main, author, mandatory Reviewer và optional Specialist có ownership tách biệt; freshness/session reuse đã concrete.
- Owner source được preserve losslessly; Planner-owned GOAL derivation, independent Reviewer fidelity check, ambiguity gate và giới hạn của Reviewer PASS đã concrete.
- Minimal state/event model và handoff admission semantics đã concrete mà không cần persistent runtime.
- Running-role steer có exact disposition `A. LIVE_STEERING_SUPPORTED`, phân biệt active-turn delivery, running-turn boundary delivery, idle new-turn delivery và interrupt+same-session resume; authority-sensitive delta có observable quiescence/state-audit gate.
- Mandatory single local-only review artifact, candidate-read-only/artifact-write boundary, review_round semantics, deterministic artifact selection, Git exclusion và exact in-turn candidate content comparison đã concrete; existing report template tiếp tục sở hữu detailed content.
- Semantic lineage vocabulary, storage, ownership và blast-radius rules đã concrete.
- Detailed-plan drift và open/closed Master Plan mismatch có exact route/stop/Owner gate.
- Cả năm unresolved contracts có implementable semantics.
- Bảy workstream trong năm dependency phases có completion boundary và near-phase verification gate.
- Reviewer/Specialist collision đã có repository evidence và migration path không hợp nhất role.
- Remaining platform/pilot questions có explicit verification phase và fail-loud behavior, không bị đẩy thành design choice cho Implementor.

Candidate này sẵn sàng cho same-session Master Plan Reviewer A rereview round 1. PASS của Reviewer vẫn không tự cấp implementation, commit, push, PR hoặc merge authority.
