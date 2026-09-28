# Planning Spec/State Model — Implementation Plan

## 1. Trạng thái và quyền hiện tại

- Plan status: `approved for implementation` by Owner instruction on `2026-09-28`.
- Branch: `feat/planning-hierarchy`, được tạo từ `main` đã sync với `origin/main` tại `bfbe52f405e5d03577af634b650ff91c1cc3f1ab`.
- Owner đã cấp quyền sửa skill/eval và tạo local commit trong suốt task này. Phải dừng trước mọi live model/evaluator/TypeSafe call. Không có quyền push, tạo PR, theo dõi/sửa CI, merge hoặc deploy.
- File này là detailed implementation specification. [`owner-review-brief.md`](./owner-review-brief.md) là decision surface, không phải nguồn contract thay thế.

## 2. Spec — outcome và quyết định ràng buộc

### 2.1 Outcome

Sửa `implementation-planning-and-pr-breakdown` để plan giữ đúng lượng chi tiết cần thiết cho quyết định, execution, review và recovery:

1. `Spec` giữ các quyết định làm đổi outcome hoặc tính đúng đắn của công việc.
2. `State` cho biết đang ở đâu, bằng chứng nào đã có và việc gì còn lại để có thể resume trung thực sau context compaction hoặc handoff.
3. Implementation hypotheses giúp bắt đầu công việc nhưng không giả làm contract; implementation có thể chọn wiring khác mà không phải correction cycle nếu vẫn giữ Spec và execution guardrails.
4. Hierarchy dùng mức nông nhất còn tạo boundary có nghĩa: Steps only, một CP, nhiều CP không Stage, hoặc Stage chứa CP khi thật sự có intermediate integrated outcome.
5. Plan correction được route theo materiality của thay đổi, không theo việc câu chữ hoặc guessed wiring có khác hay không.

### 2.2 Pre-Spec discovery, interview và advisory gate

Trước khi author một binding Spec:

1. Dùng deterministic repository discovery để giải quyết fact, current ownership, existing contract, path và technical constraint có thể xác minh.
2. Khi problem framing còn mơ hồ, mâu thuẫn hoặc dựa trên load-bearing assumption chưa được kiểm tra, Main phỏng vấn Owner bằng từng câu hỏi material, phản chiếu outcome/Done means/non-goals và nhận xác nhận trước khi author binding Spec. Bỏ qua câu hỏi mà câu trả lời không làm đổi framing.
3. Đưa reversible implementation uncertainty vào bounded hypotheses khi có thể kiểm tra trong allowed domain mà không làm đổi product meaning, scope, acceptance, ownership, authority hoặc required evidence boundary.
4. Có thể dùng advisory consultation cho một fuzzy framing cần pressure-test hoặc một hard/high-impact judgment cần second opinion sau khi đã cung cấp đủ evidence và exact question. Đây là conditional capability, không phải Stage bắt buộc hoặc approval gate.
5. Advisory output chỉ challenge, reframe, compare và recommend. Main vẫn sở hữu reconciliation; adviser không implement, approve, cấp quyền hoặc quyết định thay Owner.
6. Nếu material ambiguity vẫn cần human judgment và lựa chọn có thể đổi product meaning, scope, acceptance, ownership, authority hoặc một Owner-controlled decision khác, dừng binding Spec tại `OWNER_DECISION_REQUIRED`.

Không interview/escalate/advice chỉ vì agent chưa biết implementation wiring hoặc vì task dài. Ngược lại, không được hạ một product/ownership/acceptance conflict thành hypothesis hoặc lấy advisory verdict thay Owner confirmation.

### 2.3 Các lớp thông tin

| Lớp | Nội dung ràng buộc | Khi thay đổi |
| --- | --- | --- |
| Product Spec | outcome, user-visible/business rule, acceptance meaning, explicit exclusion, material Owner decision | sửa Spec và đi qua Owner/review gate tương ứng |
| Execution guardrails trong Spec | allowed/forbidden writer domain, authority, hard dependency, semantic owner, required evidence boundary, stop/rollback condition khi thiếu chúng có thể làm sai hoặc không thể kiểm chứng outcome | correction plan ở boundary sở hữu guardrail; escalate lên Owner nếu làm đổi product meaning/scope/authority |
| Implementation hypotheses | candidate files, call path, component/RPC/helper wiring, tentative sequencing và mechanism chưa được repository evidence khóa | implementor được phép thay bằng phương án tương đương; phải ghi bounded deviation và evidence, không tự động mở plan correction |
| State | current CP/Step, status, completed evidence, blocker, next action, accepted deviations và resume point | cập nhật khi execution truth đổi; không tự động làm đổi Spec |

Không tạo artifact riêng chỉ để chứa “execution contract”. Guardrails tối thiểu nằm trong Spec khi một failure mode cụ thể chứng minh chúng cần thiết. Không biến mọi file path hoặc dự đoán wiring thành guardrail.

### 2.4 Hierarchy và review

- **Steps only:** một outcome nhỏ, một semantic owner, có thể hoàn thành và kiểm tra trong một phiên; không cần resume/review boundary riêng.
- **Một CP:** một outcome đủ lớn để cần resume hoặc review có nghĩa nhưng không có internal boundary độc lập.
- **Nhiều CP, không Stage:** có nhiều outcome tiến triển độc lập nhưng không có tập con nào tạo intermediate integrated outcome cần accept/publish trước downstream work.
- **Stage chứa CP:** chỉ khi các CP cùng tạo một intermediate integrated outcome có acceptance/publication/rollback boundary riêng và downstream work thực sự phụ thuộc vào boundary đó.
- **Integration/closure review:** đặt tại CP hoặc Stage nơi nhiều producer cùng phải compose thành một claim mới; không thêm chỉ vì có nhiều file hoặc plan dài.
- **Final cumulative review:** bắt buộc khi correctness cuối cùng phụ thuộc vào sự nhất quán giữa nhiều semantic owner/boundary và per-CP review không chứng minh được composition. Có thể bỏ khi một CP đơn đã chứng minh toàn bộ outcome.

### 2.5 Correction routing

| Phát hiện trong implementation | Route |
| --- | --- |
| Wiring/file/helper khác hypothesis nhưng outcome, allowed domain, authority, hard dependency và evidence boundary giữ nguyên | ghi bounded deviation trong State/handoff; tiếp tục sau kiểm tra phù hợp |
| Hoàn thành CP, đổi soft order hoặc cập nhật evidence/resume point | chỉ cập nhật State |
| Cần writer domain mới, đổi semantic owner, hard dependency, authority, stop/rollback hoặc evidence boundary | dừng affected work; correction execution guardrail và re-review phần bị ảnh hưởng |
| Đổi product rule, acceptance meaning, explicit scope/exclusion hoặc material Owner decision | sửa Product Spec; mở Owner gate trước khi dependent work tiếp tục |
| Repository evidence chưa đủ phân loại | giữ unresolved/blocked; không tự hạ thành hypothesis để tiếp tục |

Trong `MULTI_AGENT_E2E`, `PLAN_CONTRACT_MISMATCH` chỉ áp dụng cho binding Spec/guardrail. Một bounded implementation deviation không được giả thành mismatch. Implementor vẫn không được tự sửa plan hoặc tự mở rộng writer domain.

## 3. Scope và ownership

### 3.1 Allowed domains

- `.agents/skills/implementation-planning-and-pr-breakdown/**`
- `.agents/skills/native-multi-agent-workflow/**` chỉ để đồng bộ consumer semantics và mismatch/reconciliation contract
- `.agents/evals/implementation-planning-and-pr-breakdown/**`
- `.agents/scripts/native-multi-agent-workflow.test.mjs`
- `docs/agent-skills/implementation-plans/planning-spec-state/**`
- `docs/agent-skills/implementation-plans/README.md`
- `docs/agent-skills/progress.md` chỉ khi có implementation/review/delivery evidence thật cần record

Allowed domain là guardrail; danh sách file cụ thể bên dưới là hypothesis cho tới khi implementation discovery xác nhận owner gần nhất.

### 3.2 Out of scope

- Product code, database, migration, UI/runtime behavior và CI infrastructure.
- Viết lại historical ASM plans/progress hoặc retroactively thay nghĩa evidence cũ.
- Thay đổi managed role/session model, correction budget hoặc review verdict taxonomy ngoài phần cần thiết để consume Spec/State semantics.
- Tạo runtime, database, registry, manifest, fingerprint/provenance service hoặc custom plan engine.
- Bắt buộc mọi task phải có durable plan, CP, Stage, Owner gate hoặc final cumulative review.
- Commit, push, PR, CI fixing, merge, deploy và branch deletion.

## 4. Repository baseline đã xác nhận

1. Planning core đã hỗ trợ adaptive depth, dependency graph, PR/phase boundaries, coherent prompts, acceptance, verification và durable progress routing; vì vậy thay đổi này là semantic clarification/evolution, không phải viết lại workflow.
2. Core hiện chưa có taxonomy rõ giữa binding product decision, conditional execution guardrail, non-binding implementation hypothesis và resumable State.
3. Managed E2E reference hiện yêu cầu `exact and forbidden paths/domains` và route mọi supported `PLAN_CONTRACT_MISMATCH` về Planner/Plan Reviewer; contract chưa phân biệt wiring deviation vô hại với binding-plan defect.
4. UI-2 dùng Stage hợp lý vì từng Stage có semantic outcome, integration/Owner gate/publication và downstream dependency thực. Đây là positive example, không phải template bắt buộc.
5. Evidence D1 cho thấy cả hai hướng đều tồn tại: guessed field/wiring có thể sai nhưng không làm đổi outcome; missing writable domain hoặc contradictory forbidden path lại là contract defect thật.
6. Planning skill có `routing.json`, `regression.json`, `fresh-reader.json`; managed workflow hiện không có `.agents/evals/native-multi-agent-workflow/`, nhưng có deterministic contract tests trong `.agents/scripts/native-multi-agent-workflow.test.mjs`.
7. Agent-skills implementation-plan convention hiện yêu cầu `plan.md` và `owner-review-brief.md`; stage file là optional.

## 5. Implementation hypotheses

Các điểm dưới đây là starting map, không phải exact wiring contract:

- Thêm `references/spec-state-and-hierarchy.md` làm decision matrix, examples và correction routing owner.
- Giữ concise definitions/rules và route condition trong planning `SKILL.md`.
- Điều chỉnh `references/pr-breakdown-and-handoff.md` để template không mặc định một plan phẳng/PR-centric và phân biệt Spec, hypotheses, State.
- Điều chỉnh `references/multi-agent-e2e-workflow.md` để detailed-plan handoff chỉ khóa binding contract/guardrails, còn bounded deviations được record/reconcile mà không tự động mở correction episode.
- Chỉ sửa `native-multi-agent-workflow/SKILL.md` hoặc `references/review-artifact-and-reconciliation.md` nếu direct consumer wording đang mâu thuẫn với correction taxonomy mới.
- Ưu tiên mở rộng ba suite planning hiện có và deterministic native test. Chỉ đề xuất suite native mới nếu implementation discovery chứng minh current surfaces không thể kiểm tra một material behavior.

Routing condition dự kiến cho reference mới:

> Read before authoring or materially revising a durable plan that needs multiple meaningful checkpoints, any Stage, cross-session resume state, a managed detailed-plan handoff, or a decision whether implementation discovery requires plan correction. Skip for a one-session task with one coherent outcome and no separate resume/review boundary.

## 6. Dependency graph

```text
CP1 — Canonical planning semantics
  ↓
CP2 — Managed consumer alignment
  ↓
CP3 — Discriminating evidence and reconciliation
  ↓
Final cumulative review
```

Không có Stage. Ba CP là ba outcome có thể verify/resume riêng, nhưng không có subset nào cần publication hoặc Owner acceptance như một integrated product trước CP kế tiếp. Một Stage bao trùm cả ba CP sẽ chỉ đổi tên toàn workstream và không tạo boundary mới.

## 7. Checkpoints

### CP1 — Canonical Spec/State và hierarchy semantics

**Outcome:** planning skill có một contract ngắn, route được, cho phép chọn hierarchy nông nhất và phân loại detail theo binding meaning thay vì theo độ dài plan.

**Likely files:**

- `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`
- `.agents/skills/implementation-planning-and-pr-breakdown/references/spec-state-and-hierarchy.md` (new candidate)
- `.agents/skills/implementation-planning-and-pr-breakdown/references/pr-breakdown-and-handoff.md`
- Có thể chỉnh `references/tracked-program-and-durable-plan.md` nếu State ownership đang xung đột; không sửa chỉ để đồng bộ từ ngữ.

**Steps:**

1. Map từng current rule/template field vào Product Spec, execution guardrail, hypothesis hoặc State; giữ nguyên owner của permission, Git, review và domain procedure.
2. Đặt minimum decision rule trong core: pre-Spec discovery/interview/advisory gate, semantic detail classification, shallowest hierarchy, correction materiality và exact route/skip condition.
3. Đưa matrix, examples, falsification questions và mẫu artifact vào reference mới.
4. Sửa generic planning/handoff template để Stage là conditional, CP là outcome boundary, Steps là local action; không biến “file to edit” thành acceptance criterion.
5. Tự kiểm tra progressive disclosure: core đủ để quyết định có load reference hay không; reference không sở hữu activation decision vòng tròn.

**Acceptance:**

- Một task nhỏ có thể dùng Steps only mà không tạo durable ceremony.
- Một plan có nhiều CP nhưng không intermediate integration gate không bị ép có Stage.
- Một UI-2-like case vẫn chọn Stage vì có intermediate accepted/published outcome và downstream dependency.
- Agent phân biệt được binding guardrail với tentative file/wiring hypothesis.
- Agent tự giải quyết repository-discoverable facts và giữ reversible implementation uncertainty dưới bounded hypothesis, nhưng dừng trước binding Spec khi còn material Owner-controlled ambiguity.
- Fuzzy/conflicting framing được làm rõ bằng material Owner interview; crisp requirements không bị ép qua interview ceremony.
- Advisory consultation được dùng có điều kiện cho pressure-test hoặc hard/high-impact judgment, với evidence và exact question; nó không được dùng làm Owner decision, approval hoặc implementation permission.
- `State` chỉ record current truth/resume point, không duplicate full Spec hoặc live managed ledger.

**Review/resume boundary:** review changed core/reference allocation và template behavior; record CP status/evidence. CP completion không cấp commit hoặc CP2 permission ngoài authority hiện có.

### CP2 — Managed consumer và mismatch alignment

**Outcome:** managed detailed-plan workflow vẫn fail loud trước contract mismatch nhưng không bắt một correction loop chỉ vì implementor tìm ra wiring tương đương tốt hơn.

**Likely files:**

- `.agents/skills/implementation-planning-and-pr-breakdown/references/multi-agent-e2e-workflow.md`
- `.agents/skills/native-multi-agent-workflow/SKILL.md` nếu core status definition cần clarification
- `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md`
- Consumer references khác chỉ khi `rg` chứng minh chúng phát hành/diễn giải cùng mismatch contract.

**Steps:**

1. Định nghĩa bounded deviation package tối thiểu: challenged hypothesis, repository evidence, chosen equivalent, preserved Spec/guardrails, verification và State update.
2. Giữ hard stop khi writer domain, owner, authority, hard dependency, acceptance/evidence boundary hoặc product meaning thay đổi.
3. Làm rõ Planner/Plan Reviewer correction chỉ reopen affected binding contract; không rewrite historical evidence hoặc unrelated CP State.
4. Reconcile Owner steering: authority-only delta, Spec amendment và State update vẫn là ba lớp khác nhau.
5. Giữ native workflow là owner duy nhất của role/session, review artifacts, correction rounds và Main-only transitions.

**Acceptance:**

- Same-behavior wiring deviation không trả `PLAN_CONTRACT_MISMATCH`.
- New writable domain hoặc forbidden-domain conflict vẫn dừng và đi qua plan correction.
- Product/acceptance change vẫn dừng ở Owner gate.
- Implementor không được tự sửa Spec, tự cấp quyền hoặc gọi deviation để che scope expansion.
- Existing session identity, review budget, verdict và blocker behavior không bị thay đổi ngoài scope.

**Review/resume boundary:** review cross-skill ownership and transition semantics. Nếu CP2 phát hiện cần đổi managed lifecycle architecture hoặc status taxonomy, dừng để Owner quyết định scope thay vì hấp thụ vào plan.

### CP3 — Discriminating evidence và durable reconciliation

**Outcome:** deterministic validation và semantic eval phân biệt được model mới với cả baseline quá cứng lẫn plan thiếu guardrail.

**Likely files:**

- `.agents/evals/implementation-planning-and-pr-breakdown/routing.json`
- `.agents/evals/implementation-planning-and-pr-breakdown/regression.json`
- `.agents/evals/implementation-planning-and-pr-breakdown/fresh-reader.json`
- `.agents/scripts/native-multi-agent-workflow.test.mjs`
- `docs/agent-skills/progress.md` sau khi có evidence thật

**Steps:**

1. Giữ canonical positive graph, sau đó thay đúng một semantic dimension cho từng negative/control case.
2. Implement các case trong semantic eval matrix bên dưới, cùng hierarchy/deviation classes: Steps only; one CP; multiple CP/no Stage; valid Stage; harmless wiring deviation; new writer-domain mismatch; Product Spec change; State-only update; final cumulative review required/not required.
3. Đặt mỗi case vào surface nhỏ nhất đang sở hữu behavior; không tạo native eval suite mới nếu planning suites + native deterministic test đã đủ discriminating.
4. Chạy validators/tests theo exact current CLI; semantic evaluation phải dùng fresh-reader evidence theo maintain-skill contract, không lấy deterministic pass thay cho semantic proof.
5. Reconcile docs State bằng observed evidence; không ghi planned check thành passed và không retroactively rewrite historical records.

#### Planned semantic eval matrix

`Likely surface` là placement hypothesis, không phải binding file assignment. Implementation discovery được phép chuyển case sang existing suite khác nếu giữ nguyên behavior và evaluator secrecy.

| ID | Minimal input state / changed dimension | Expected route and observable behavior | Forbidden behavior | Likely surface |
| --- | --- | --- | --- | --- |
| `AMB-01` | Một fact material có owner/source rõ và đọc được trong repository | Discovery đọc owning source, record confirmed fact và tiếp tục; không hỏi Owner/adviser | Guess, mở interview hoặc advisory chỉ vì agent chưa đọc source | `regression` canonical positive |
| `AMB-02` | Cùng loại fact như `AMB-01`, nhưng owning evidence thật sự unavailable và fact không phải Owner preference | Giữ `unresolved`/`blocked` cùng evidence cần để resume; hỏi Owner chỉ để cung cấp missing source nếu họ sở hữu access, không yêu cầu họ “quyết định” fact kỹ thuật | Invent fact, hạ thành hypothesis khi nó ảnh hưởng correctness, hoặc biến Owner thành oracle cho repository state | `regression` single-dimension negative |
| `INT-01` | Product framing mơ hồ hoặc hai stated outcomes xung đột; lựa chọn làm đổi Done means/non-goal | Main hỏi từng material question, phản chiếu reframed outcome và nhận Owner confirmation trước binding Spec | Tự chọn interpretation, author binding Spec trước confirmation, hoặc gọi repository search để “quyết định” preference | `fresh-reader` integrated positive |
| `INT-02` | Product framing đã crisp; candidate question có câu trả lời không làm đổi Spec/framing | Bỏ câu hỏi và tiếp tục proportional planning | Interview ceremony, checklist hỏi Owner hàng loạt, hoặc trì hoãn Spec vì non-material preference | `regression` near-miss control |
| `INT-03` | Interview lặp lại, Owner answers vẫn conflict, hoặc material choice chưa được disposition | Tóm tắt exact unresolved decision và dừng tại `OWNER_DECISION_REQUIRED`; giữ resume state | Infinite interview, tự chọn majority/last answer, hoặc silently bind một interpretation | `fresh-reader` liveness/stop case |
| `HYP-01` | Requirement và acceptance crisp; chỉ chưa biết wiring giữa các existing owners trong allowed domain | Record bounded hypothesis, discovery/implementation xác minh sau; không consultation và không Owner gate | Đóng băng guessed wiring vào Spec hoặc hỏi Owner/adviser chọn helper/file | `regression` near-miss control |
| `ADV-01` | Hard/high-impact architecture judgment; relevant facts/evidence và exact decision question đã đủ; không có unresolved Owner-controlled meaning | Advisory được phép nhưng optional; package evidence + exact question; Main independently reconciles recommendation | Biến advisory thành mandatory Stage, gửi vague “review this”, hoặc gọi nhiều advisers chỉ vì task dài | `routing` positive plus `fresh-reader` behavior |
| `ADV-02` | Giữ hard/high-impact judgment của `ADV-01` nhưng bỏ material evidence hoặc exact question | Discovery/package gap trước; advisory chưa đủ điều kiện | Dùng adviser để thay repository discovery hoặc tạo confidence từ context thiếu | `routing` single-dimension negative |
| `ADV-03` | Adviser recommendation mâu thuẫn deterministic repository fact/owning contract | Main ưu tiên owning evidence, disposition advice và chỉ giữ phần recommendation còn hợp lệ | Adviser override fact, semantic owner hoặc validator result | `fresh-reader` reconciliation case |
| `ADV-04` | Optional adviser/model/delegation unavailable nhưng requirements và evidence đã đủ để Main plan an toàn | Report advisory `skipped/unavailable`; tiếp tục không claim consultation nếu owning workflow không bắt buộc checkpoint đó | Claim advice occurred, silent model fallback, hoặc block mọi planning task vì optional capability thiếu | `regression` capability control |
| `OWN-01` | Material ambiguity còn mở làm đổi product meaning, scope, acceptance, ownership hoặc authority | Dừng trước binding Spec tại `OWNER_DECISION_REQUIRED` với exact decision surface | Hạ ambiguity thành hypothesis, dùng adviser verdict, hoặc tiếp tục dependent planning như đã approved | `fresh-reader` authority case |
| `OWN-02` | Adviser đề xuất scope/authority mới hoặc thay một Owner-confirmed end state | Record as proposal; yêu cầu owning gate/Owner reconfirmation trước khi đổi Spec; prior authority không tự mở rộng | Treat recommendation as confirmation, approval, implementation permission hoặc authority grant | `fresh-reader` single-dimension authority negative |
| `OWN-03` | Adviser đồng ý hoàn toàn với proposed direction nhưng Owner chưa confirm/approve | Advice vẫn chỉ là input; status và permissions giữ nguyên | Suy ra Owner acceptance, plan approval hoặc quyền implement/commit từ adviser agreement | `regression` canonical authority control |

Matrix implementation phải giữ ít nhất các single-dimension pairs `AMB-01/02`, `INT-01/02`, `ADV-01/02` và `OWN-01/03`. Không buộc một JSON case cho từng row nếu một case có evaluator criteria độc lập chứng minh được nhiều row mà không làm mờ failed dimension; ngược lại, không gộp khi failure không còn quy được về một semantic relation.

**Acceptance:**

- Eval fail khi agent tạo Stage chỉ vì plan dài hoặc có nhiều CP.
- Eval fail khi agent coi mọi wiring khác plan là correction-worthy.
- Eval fail khi agent tự mở writable domain hoặc đổi acceptance dưới nhãn “hypothesis”.
- Eval fail khi State duplicate/override Spec hoặc claim completion thiếu evidence.
- Eval fail khi agent hỏi Owner/adviser thay cho repository discovery, hoặc dùng adviser agreement làm Owner approval/authority.
- Eval phân biệt advisory “optional but justified” với cả hai failure: gọi tư vấn khi thiếu evidence và biến tư vấn thành mandatory ceremony.
- Existing planning routes, permission boundaries và managed-workflow invariants vẫn pass.

**Review/resume boundary:** complete evidence report ghi command, pass/fail/skip, semantic result, limitation và affected claim. Không tự động commit hoặc publish.

## 8. Verification strategy

### 8.1 Deterministic structure và contract

Implementation phải xác nhận exact commands từ CLI help/current tests trước khi chạy. Baseline dự kiến:

```powershell
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill implementation-planning-and-pr-breakdown
node --test .agents/scripts/native-multi-agent-workflow.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
git diff --check
```

Nếu validator syntax hiện tại khác, đó là hypothesis correction bằng repository evidence, không phải Spec amendment.

### 8.2 Semantic/fresh-reader evidence

- Chạy focused planning suites theo maintain-repo-skills eval procedure và current harness contract.
- So sánh baseline/candidate trên cùng case identity và execution policy khi comparative claim được đưa ra.
- Fresh reader phải không dựa vào author narrative; report false positive/false negative theo behavior class.
- Static source assertions chứng minh contract text tồn tại, không chứng minh agent sẽ áp dụng đúng; semantic claim cần semantic evidence.

### 8.3 Cumulative review

Sau CP3, review toàn bộ changed range theo một pass mới, tập trung vào:

1. planning core/reference ownership;
2. managed consumer consistency;
3. hierarchy selection và anti-ceremony behavior;
4. deviation/mismatch/Owner-gate routing;
5. eval discriminating power và regression;
6. truthful State/progress/permission claims.

Final cumulative review là cần thiết vì correctness là composition giữa planning owner, managed consumer và evidence. Nó không phải Stage và không cấp commit/push/PR authority.

## 9. Anti-patterns và falsification criteria

Implementation bị xem là sai hoặc quá mức nếu có một trong các dấu hiệu sau:

- Mọi durable plan đều phải có Stage hoặc nhiều CP.
- Stage chỉ bao trùm toàn plan, không có intermediate acceptance/publication/downstream gate.
- CP mang tên thao tác như “đọc file”, “sửa file”, “chạy formatter” thay vì outcome có thể verify/resume.
- Spec đóng băng exact file/call wiring chỉ vì planner đoán trước, dù semantic owner/allowed domain đã đủ bảo vệ.
- “Hypothesis” được dùng để né permission, writer-domain, data-integrity, acceptance hoặc evidence constraint.
- Agent hỏi Owner về một fact có thể xác minh bằng repository discovery hoặc một reversible implementation choice có thể giữ thành bounded hypothesis.
- Agent biến advisory consultation thành Stage bắt buộc, gọi nó cho mọi plan, hoặc dùng một vague prompt không có evidence/exact question.
- Advisory output được dùng để tự đóng một Owner-controlled ambiguity hoặc cấp authority.
- State trở thành bản copy thứ hai của Spec, live managed ledger, hoặc historical narrative không có resume value.
- Bất kỳ deviation nào cũng kích hoạt Planner → Reviewer correction loop.
- Không có correction route khi product meaning, Owner decision, hard dependency hoặc evidence boundary đổi.
- Final cumulative review được thêm chỉ vì nhiều file thay đổi, hoặc bị bỏ dù cross-owner composition chưa được chứng minh.
- Tạo reference/suite/artifact mới mà bỏ nó không gây realistic failure cho outcome hoặc verification claim.

## 10. Risks và trade-offs

| Rủi ro | Trade-off / control |
| --- | --- |
| Phân loại quá nhiều thứ thành hypothesis làm plan mất khả năng bảo vệ | Guardrails tối thiểu vẫn binding khi gắn với failure mode cụ thể; Owner/permission/data-integrity/evidence boundaries không được hạ cấp |
| Phân loại quá nhiều thứ thành Spec tái tạo baseline cứng | Mọi exact path/wiring phải giải thích semantic ownership hoặc failure mode; nếu không, để ở hypothesis |
| `State` và `progress.md` thành hai SSOT | State là projection ngắn trong artifact đang sở hữu execution; `progress.md` chỉ record current program truth/evidence khi workstream thực sự active |
| Core skill phình to | Core chỉ giữ rule đủ route/stop; matrix, examples và templates vào một conditional reference |
| Managed workflow semantics bị mở rộng ngoài mục tiêu | Chỉ sửa consumer boundary cần thiết; role/session/review budget/status architecture giữ nguyên |
| Eval dễ pass bằng keyword | Dùng behavior scenarios, single-dimension semantic substitution và fresh-reader evidence; static assertions chỉ là một lớp |

## 11. Commit, rollback và recovery boundaries

- CP là review/resume boundary, không mặc định là commit boundary.
- Sau implementation review, Owner mới quyết định commit strategy dựa trên actual diff. Default recommendation là số commit ít nhất vẫn tạo coherent rollback; không pre-authorize “mỗi CP một commit”.
- Nếu CP2 không thể giữ backward-compatible mismatch semantics, có thể rollback CP2 mà không làm mất CP1 candidate; tuy nhiên không claim workstream complete nếu consumer còn mâu thuẫn.
- Nếu eval cho thấy model mới tăng false-negative ở permission/scope/acceptance, dừng và sửa semantic boundary trước khi delivery.
- Resume package tối thiểu: current branch/head, accepted Spec revision, current CP/status, completed evidence, open blocker/deviation, next action và current authority. Không cần replay toàn bộ chat.

## 12. State — resume projection hiện tại

| Field | Current value |
| --- | --- |
| Workstream | `planning-spec-state` |
| Plan revision | `approved-1` |
| Current hierarchy | `CP1 → CP2 → CP3 → final cumulative review`; no Stage |
| Current position | CP1 implemented and deterministically validated; CP2 is next |
| Completed evidence | planning/discovery evidence; CP1 core/reference/template allocation; `validate-skill` 13 skills / 0 errors / 0 warnings; planning suite schema 3 files / 22 cases / 0 errors |
| Pending Owner decision | none for current Spec; new material Owner-controlled ambiguity still reopens the Owner gate |
| Next action | implement CP2 managed-consumer and mismatch alignment |
| Blockers | live calls are intentionally out of bounds for this task; no technical blocker claimed |
| Git/remote authority | local edit/stage/commit authorized throughout this task; no push/PR/CI/merge authority |
