# Phase 3 — Detailed implementation plan

## Trạng thái và authority

- Execution-contract state: Plan Reviewer round `1` đã historically `PASS`; cumulative implementation review sau đó phát hiện hai plan-owned gaps. Current status/evidence chỉ do [`progress.md`](../../progress.md) sở hữu.
- Correction lineage metadata, không phải current-status owner: `workflow_id=nma-001-phase-3`, `episode_id=detailed-plan`, `candidate_revision=phase-3-plan-r2`; Main đã preassign later same-Reviewer artifact `docs/native-multi-agent/reviews/nma-001-phase-3/detailed-plan/phase-3-plan-r2-review-r2.md`.
- Projected Owner Source Package consumed from Owner-record revision `14`: exact ordered refs `[owner-2, owner-3, owner-9, owner-10, owner-11, owner-12, owner-13, owner-14]`. Đây chỉ là correction candidate/review identity, không phải durable dispatch package hoặc future admission source; Main phải project lại package trước mỗi later dispatch.
- Branch: `feat/native-multi-agent-phase-3`.
- Historical planning baseline do Main xác minh tại initial dispatch: `HEAD == origin/main == e26e874d01f3b757fdf6dcf84dbd58f59f63babe`; working tree/index khi đó sạch và hai Phase 3 candidates chưa tồn tại. Current repository/lifecycle state phải đọc từ `progress.md` cùng fresh Main audit.
- Owner-9 yêu cầu thực hiện Phase 3. Theo current authority snapshot, implementation permission bao phủ đúng approved `NMA-WS5`, correction owner-package projection/admission mà owner-10 yêu cầu và các verification/review action nội tại được nêu trong plan này khi không phát sinh material decision mới.
- Không có authority cho stage, commit, push, PR, CI watch/fix, merge, deploy, database/production/remote mutation, destructive action, history rewrite, force-push hoặc branch deletion.
- Không có Specialist authority riêng. Quyết định cho Phase 3 là `0 specialist`.

Đọc file này cùng:

- [Master Plan](../../plan.md), đặc biệt `NMA-WS5`, GOAL/lineage, Master Plan Review protocol và plan-mismatch route;
- [progress owner](../../progress.md), [implementation-plan convention](../README.md) và [owner-review-brief.md](./owner-review-brief.md);
- [`AGENTS.md`](../../../../AGENTS.md), [`docs/agent-loops.md`](../../../agent-loops.md);
- `native-multi-agent-workflow`, `implementation-planning-and-pr-breakdown`, `maintain-repo-skills`, `test-quality-strategy`, và `code-commenting-and-maintainability` khi structured test header thay đổi.

Nếu repository reality challenge material Master Plan contract, Planner/Implementor phải dừng với `MASTER_PLAN_CONTRACT_MISMATCH`/`PLAN_CONTRACT_MISMATCH`; không tự sửa semantic root.

## Mục tiêu

Hoàn tất Phase 3 / `NMA-WS5` bằng smallest coherent change để `MULTI_AGENT_MASTER_PLAN` trở thành lifecycle vận hành được qua planning owner hiện hữu:

1. Master Planner có một conditionally routed procedure/template để derive GOAL từ exact dispatch package, lập ownership/lineage/workstream/phase gate và kết thúc ở reviewed plan, không implementation;
2. Master Plan Reviewer dùng contract Stage R-A/R-B, six dimensions, verdict/finding bar và exact local-only review artifact đã thuộc `native-multi-agent-workflow`, không tạo competing review owner;
3. closed Master Plan mismatch đi qua read-only Master Plan Correction recommendation rồi Owner gate;
4. owner-10 được operationalize tại canonical Owner-package projection/admission owner: append-only Owner record khác dispatch package, membership là explicit ordered included refs, và revision không suy ra contiguous refs;
5. deterministic cases và một bounded non-mutating native rehearsal chứng minh contract trong intended repository context trước khi Phase 4 được mở;
6. current status owner chỉ ghi observed evidence, không tự cấp commit/remote authority.

## Sự thật đã xác nhận

1. Master Plan Revision `8`, GOAL Revision `1` và Phase 3 `NMA-WS5` đã được Owner approve; dependencies là `NMA-WS3`, `NMA-WS4`.
2. `docs/native-multi-agent/progress.md` ghi Phase 2 đã implemented, verified và committed; Phase 3 row vẫn phản ánh pre-owner-9 state `Implementation permission=no`. Exact later Owner source owner-9/current Main authority snapshot mới là authority hiện hành; tracker phải được cập nhật từ observed Phase 3 state, không dùng plan để rewrite history.
3. Planning core đã sở hữu durable plans, facts/assumptions/conflicts, scope, dependencies, acceptance, verification và handoff, nhưng chưa có conditionally routed Master Plan Only authoring/correction procedure hoặc template.
4. `native-multi-agent-workflow` đã sở hữu Main-only transitions, generic exact review artifacts, correction budget và status semantics, nhưng cumulative review xác nhận active bundle chưa sở hữu Stage R-A/R-B, independent baseline, six Master Plan dimensions, contamination blocker và Master Plan verdict/finding bar. Phase 3 phải bổ sung các conditional semantics này vào existing review/reconciliation owner, không tạo state machine/resource mới.
5. `implementation-planning-and-pr-breakdown/references/tracked-program-and-durable-plan.md` phục vụ mọi tracked program; nhồi toàn bộ Master Plan Only procedure vào đó sẽ buộc unrelated tracked work đọc ceremony không áp dụng.
6. Một new conditional reference có current consumer và một meaningful skip group: ordinary discovery, durable per-PR plan và transferable implementation brief không chạy `MULTI_AGENT_MASTER_PLAN` có thể bỏ qua.
7. Current Owner-source reference đã yêu cầu forward complete relevant entries và cho phép bỏ input chứng minh không liên quan, nhưng chưa nêu đủ ba invariant của owner-10: Owner record khác dispatch package; record revision không xác định membership; admission phải validate exact declared included set thay vì contiguous range.
8. `.agents/scripts/native-multi-agent-workflow.test.mjs` là static contract test owner hiện hữu; baseline hiện tại đạt `4/4`. `node .agents/scripts/validate-skill.mjs` đạt `12 skills / 0 errors / 0 warnings`; validator regression đạt `37/37`.
9. Review root `docs/native-multi-agent/reviews/` là local ignored evidence boundary. Review artifacts không được tracked, staged, committed hoặc dùng `latest`/glob/mtime để chọn.
10. Product, UI, API, Supabase/database, browser, deployment và application-runtime behavior không thuộc Phase 3.

## Owner decisions, assumptions, conflicts và câu hỏi mở

### Exact Owner decisions đang áp dụng

- owner-2 giữ nested implementation-plan convention và `native-multi-agent/reviews` layout.
- owner-3 giữ `docs/native-multi-agent` là feature-level owner và `progress.md` là durable current-status owner.
- owner-9 cấp Phase 3 execution/implementation authority trong approved Master Plan scope.
- owner-10 yêu cầu Main chiếu dispatch package từ append-only record bằng `applies_to`, current scope và authority; chỉ included entries phải whole-entry; membership là explicit ordered refs; record revision không suy ra contiguous range; inclusion/exclusion record chỉ ephemeral.
- owner-11 và owner-12 tiếp tục bounded Phase 3 work; không đổi GOAL hoặc cấp Git/remote/Phase 4 authority.
- owner-13 yêu cầu kiểm tra exact saved role/session IDs và native resume trước khi kết luận session unavailable. Main đã resume thành công exact original Planner/Plan Reviewer sessions; prior `BLOCKED(session_unavailable)` conclusion bị rút lại, không đổi GOAL hoặc authority boundary.
- owner-14 tiếp tục exact correction round `2` sau quota blocker; không đổi GOAL, findings, writer paths, correction budget hoặc cấp Git/remote/Phase 4 authority.

### Assumptions cần revalidate trước implementation

- Phase 2 skill/config/profile contracts và required model vẫn load được trên current client; drift làm native rehearsal `BLOCKED`, không cho phép fallback.
- Existing Node test/validator commands vẫn khả dụng và không cần CI/package/tooling change.
- Native Master Planner candidate có thể là exact native-task output được Main giữ nguyên trong ephemeral ledger; candidate không cần một durable rehearsal file. Candidate ref phải là exact native task/session result observed at dispatch, không phải invented path hoặc `latest` lookup.
- Một concise core route cộng một new reference là đủ; nếu Implementor chứng minh mandatory permission/stop rule sẽ bị ẩn, giữ invariant đó trong core và report scope impact trước edit.

### Conflicts đã reconcile

- `progress.md` pre-owner-9 permission row khác current authority. Đây là time-of-record drift được exact later Owner source giải quyết, không phải Master Plan semantic conflict.
- owner-10 không đổi GOAL hoặc architecture. Nó làm rõ membership/admission trong protected Owner-source invariant đã có; correction thuộc current Phase 3 prerequisite, không cần GOAL Revision hoặc Master Plan amendment.
- Current whole-entry wording không buộc contiguous record, nhưng thiếu explicit negative rule. Smallest correction nằm ở Owner-source procedure, verification scenario và static test; không tạo manifest/registry/provenance artifact.

### Open questions

Không có material question cần Owner quyết định trước Plan Review. Runtime/model/session availability chỉ có thể xác nhận tại native rehearsal và có exact `BLOCKED(...)` route.

## Sizing và dependency

- Preliminary size: large/high-risk vì thay đổi planning governance và phải chứng minh live staged review semantics.
- Final size: bounded large, một coherent workstream với stable owners; không có product/data/remote risk nhưng có cross-owner skill, verification và review-artifact boundaries.
- Dependency order:

```text
CP0 exact source/base/authority revalidation
  → CP1 owner-10 projection/admission correction
    → CP2 Master Plan Only planning route/reference/template
      → CP3 deterministic contract closure
        → CP4 bounded native rehearsal r0 → correction → r1
          → CP5 cumulative Implementation Reviewer
            → local no-commit checkpoint / Owner gate for durable Git closure
```

Shared skill/test/status owners are sequential. Không chạy concurrent candidate writers.

## Exact implementation scope

### Expected implementation paths

| Path | Smallest change | Semantic owner |
| --- | --- | --- |
| `.agents/skills/native-multi-agent-workflow/references/owner-source-and-steering.md` | Phân biệt append-only Owner record với phase-local dispatch package; define explicit included ordered set, reasoned ephemeral exclusion record, non-contiguous revision semantics và exact admission set | Owner-package projection/admission procedure |
| `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md` | Bổ sung conditional Master Plan Review procedure: Stage R-A/R-B, baseline content, six dimensions, contamination blocker, verdict/finding bar và planning-only boundary; giữ generic artifact/reconciliation contract hiện hữu | Operational Master Plan Review owner |
| `.agents/skills/native-multi-agent-workflow/references/verification-scenarios.md` | Thêm deterministic positive/negative cases cho explicit non-contiguous membership, ended `applies_to`, whole included entries và no durable membership registry | Native workflow scenario matrix |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | Thêm concise activation/resource route và core approval/mismatch boundary cần cho `MULTI_AGENT_MASTER_PLAN`; không copy lifecycle state machine | Planning core/routing |
| `.agents/skills/implementation-planning-and-pr-breakdown/references/master-plan-workflow.md` | New conditional authoring/correction procedure, GOAL/lineage/workstream/phase template, acceptance and handoff boundary | Detailed Master Plan Only planning procedure |
| `.agents/scripts/native-multi-agent-workflow.test.mjs` | Mở rộng static contract assertions cho owner-10 và NMA-WS5 cases; cập nhật accurate Vietnamese test-plan header | Deterministic source-contract test |
| `docs/native-multi-agent/implementation-plans/README.md` | Thêm Phase 3 current artifact links; không nhận scope/status authority | Artifact index only |
| `docs/native-multi-agent/progress.md` | Ghi actual Phase 3 permission, implementation, checks, native rehearsal/review evidence và no-commit/no-remote state tại checkpoint phù hợp | Durable current status only |

Planning candidates `phase-3/plan.md` và `phase-3/owner-review-brief.md` do Planner sở hữu. Implementor chỉ đọc; chỉ same Planner correction hoặc later exact Owner steer mới được sửa hai path này.

### Audit-only direct owners

- `docs/native-multi-agent/plan.md` — approved semantic owner; không sửa nếu owner-10 remains clarification.
- `.agents/skills/native-multi-agent-workflow/SKILL.md` — audit-only core owner; existing resource read condition đã route review opening/admission nên không cần core edit nếu `review-artifact-and-reconciliation.md` chứa đủ conditional Master Plan semantics.
- `.agents/skills/implementation-planning-and-pr-breakdown/references/tracked-program-and-durable-plan.md` và `pr-breakdown-and-handoff.md` — reuse existing generic contracts; không duplicate Master Plan-specific procedure.
- `.agents/skills/maintain-repo-skills/references/progressive-disclosure.md` và `fresh-reader-testing.md` — implementation/review checklist only.
- `.agents/skills/code-review-and-quality/**`, `.codex/**`, `AGENTS.md`, `docs/agent-loops.md`, `.gitignore`, validator implementation/test — no planned edit.

### Forbidden paths/domains

- Product/application source, UI, API, Supabase/database/schema/RLS/RPC, fixtures, browser/E2E, deployment và production.
- `.agents/evals/**`, skill-eval CLI/harness/runtime, new orchestration runtime/database/log/scheduler/manifest/fingerprint/provenance layer.
- `.codex/config.toml` và profiles trừ khi revalidation finds a blocker; blocker không cấp quyền sửa config.
- `.github/**`, package scripts/dependencies, validator behavior/threshold/snapshot, unrelated skill bundles, historical implementation records.
- Canonical Master Plan semantic revision, Phase 4/5 implementation, review-artifact deletion/publication.

Nếu smallest correct implementation cần path ngoài expected set, dừng và báo exact cause. Không biến audit-only path thành writable vì tiện lợi.

## Implementation contract

### CP0 — Revalidation

1. Consume và echo exact Owner Source Package mà Main vừa project/declare cho dispatch đó trước substantive work. Current correction identity dùng revision `14` và `[owner-2, owner-3, owner-9, owner-10, owner-11, owner-12, owner-13, owner-14]`, nhưng later role không được lấy durable plan này thay cho Main re-projection.
2. Xác nhận branch/head/base, index/working tree và ownership của mọi pre-existing change.
3. Đọc current plan/brief, Master Plan/progress, exact changed owners và routed skills/resources.
4. Xác nhận review destinations bị ignore, không tracked/staged; record exact implementation candidate start scope.
5. Reclassify owner-10: nếu current sources đã đầy đủ thì không tạo redundant edit; nếu correction cần đổi GOAL/architecture, trả `MASTER_PLAN_CONTRACT_MISMATCH`.

### CP1 — Owner-package projection/admission correction

Correction phải giữ các invariant sau trong canonical procedure:

- append-only Owner record là source history, không phải dispatch package;
- trước mỗi managed dispatch, Main resolve `included_refs` theo `applies_to`, current workflow/phase scope và current authority, đồng thời record concise exclusion reasons trong ephemeral ledger;
- only included entries được forward whole và đúng original order; supersession một mình không đủ để exclude entry còn cần để hiểu amendment/authority/semantic constraint;
- `owner_input_revision` định danh record revision đã project, không suy ra `owner-1..N` membership;
- role admission exact-compares echoed ordered refs với declared `included_refs`; excluded entries không phải missing input;
- inclusion/exclusion record không được persist thành manifest, registry, database hoặc provenance service.

Không rewrite Owner history, không thêm hash và không đổi Main-only transition.

### CP2 — Master Plan Only authoring và operational review ownership

Planning core giữ các mandatory invariant cần biết trước khi act:

- when to activate `MULTI_AGENT_MASTER_PLAN` and read the new reference;
- exact Owner source and Owner approval/implementation/Git permission separation;
- Planner derives GOAL; Main does not semantic-translate it;
- material ambiguity/mismatch stop routes;
- `PASS` ends reviewed planning only and does not grant implementation.

New planning `references/master-plan-workflow.md` chứa conditional authoring/correction procedure mà ordinary planning có thể skip:

1. exact source/repository discovery và facts/assumptions/conflicts/open questions;
2. GOAL schema: `GOAL ID`, `GOAL Revision`, `Desired Outcome`, `Success Boundaries`, `Protected Invariants`, `Scope Boundary`;
3. ownership map và lineage table `ID | owns | depends_on | consumes | produces | assumes`, including evidence/invalidation condition;
4. workstream/phase decomposition, bidirectional traceability, acceptance, verification gate, no-implementation completion boundary;
5. plan revision versus Owner-only GOAL revision;
6. author handoff trực tiếp tới `native-multi-agent-workflow/references/review-artifact-and-reconciliation.md` là active operational owner;
7. author correction/rereview and closed Master Plan mismatch recommendation/Owner gate;
8. compact Master Plan template and self-review checklist.

Exact read condition: read before creating, materially correcting, or producing a transferable handoff for a `MULTI_AGENT_MASTER_PLAN` candidate, and before a closed Master Plan Correction recommendation. Valid skip group: ordinary bounded plan/PR breakdown and tracked-program reconciliation that does not select either action.

Existing native `references/review-artifact-and-reconciliation.md` phải bổ sung đúng conditional Master Plan Review detail mà generic review không cần:

1. Stage R-A nhận complete projected Owner Source Package nhưng chưa disclose candidate content/ref, xác nhận admission và ghi frozen independent baseline trong same exact review artifact trước `BASELINE_READY`;
2. baseline bắt buộc reconstruct Owner outcome, protected invariants, exclusions, authority, material ambiguity, expected ownership/lifecycle properties và relevant repository conflicts;
3. candidate đã model-visible/inspected trước baseline trả `BLOCKED(review_baseline_contaminated)`; không claim strict filesystem isolation;
4. Stage R-B trong same Reviewer session mới nhận exact candidate/revision và disposition đủ sáu dimensions: Owner-intent fidelity; repository reality/ownership; bidirectional traceability/necessity; lifecycle integrity; correctness/liveness/boundedness; implementability/phase verification/simplicity;
5. `PASS` chỉ khi mọi dimension complete, không `Critical`/`Required`, không material ambiguity hoặc verdict-changing limitation; candidate defect dùng `BLOCKING_FINDINGS`, external evidence gap dùng `BLOCKED`, ambiguity route Main-owned Owner gate;
6. blocking finding phải có violated contract → scenario → failed transition/claim → impact → why existing mechanism fails → smallest sufficient correction → affected workstream/gate; preference/reversible detail/out-of-scope threat/audit luxury không blocking;
7. `PASS` kết thúc reviewed planning only, không phải Owner approval hoặc implementation/Git/remote authority.

Không copy generic round/artifact state machine sang planning reference và không tạo resource thứ tư.

### CP3 — Deterministic case coverage

Extend the existing Node static contract test; do not create another runner. Preserve the four existing refinement tests and add one clear assertion group per case:

| Case | Expected disposition/contract |
| --- | --- |
| Clearly synthetic non-contiguous package `[fixture-owner-2, fixture-owner-5]` at synthetic record revision `7` | admission uses declared set; excluded ended entries are not required |
| Included entry truncated/reordered/missing | `BLOCKED(owner_input_unavailable)` |
| Exclusion based only on supersession while entry remains interpretively relevant | reject projection; Main must retain entry |
| Vague GOAL or implementation mechanism placed inside GOAL | author correction / `BLOCKING_FINDINGS`; no vague acceptance or implementation leakage |
| Missing lineage edge | `BLOCKING_FINDINGS`; trace affected workstream/phase gate |
| `unaffected` without positive evidence | reject; use `needs_review` |
| GOAL semantic change without Owner decision | `OWNER_DECISION_REQUIRED`; only Owner increments GOAL Revision |
| Materially ambiguous Owner input | `BLOCKED(ambiguous_owner_intent)` then Main-owned Owner gate |
| Closed Master Plan mismatch | lower workflow pauses; fresh read-only Master Plan Correction recommends; Owner decides disposition |
| Master Plan Reviewer `PASS` | six dimensions complete, no verdict-changing limitation; reviewed plan only, not Owner approval or implementation authority |

Tests phải assert Stage R-A/R-B, baseline content, six dimensions, `BLOCKED(review_baseline_contaminated)`, verdict/finding bar và planning-only boundary trong actual native review/reconciliation owner; không chỉ assert delegating sentence ở planning reference. Chúng vẫn chỉ chứng minh exact contract text/routing, không chứng minh model behavior, live orchestration hoặc semantic quality. Structured header phải reflect actual cases và latest command result; không prewrite `passed` trước execution.

### CP4 — Bounded non-mutating native rehearsal

#### Fixed identity and bounds

- Rehearsal workflow: `workflow_id=nma-001-phase-3-rehearsal`.
- Phase/episode: `Phase 3 / NMA-WS5`, `episode_id=master-plan-only-lifecycle`.
- Roles: exactly `1` fresh Master Planner plus `1` fresh Master Plan Reviewer; both use current project profiles with phase-specific payload. Maximum `6` child turns total.
- Specialist: `0`; no consultation/delegation.
- Owner package: ngay trước rehearsal, Main project package từ current Owner record theo `applies_to`, current scope và authority, rồi record exact revision/membership cùng concise inclusion/exclusion reasons chỉ trong ephemeral ledger. Master Planner và Reviewer echo exact runtime-declared set; plan không hard-code current candidate membership thành future rehearsal source.
- Candidate is non-durable exact native Master Planner output. Main records the observed native task/session ref, exact candidate text bytes and logical revisions `rehearsal-plan-r0` then `rehearsal-plan-r1` in the ephemeral ledger; no rehearsal candidate file is added to Git scope.
- Review artifacts:
  - `docs/native-multi-agent/reviews/nma-001-phase-3-rehearsal/master-plan-only-lifecycle/rehearsal-plan-r0-review-r0.md`
  - `docs/native-multi-agent/reviews/nma-001-phase-3-rehearsal/master-plan-only-lifecycle/rehearsal-plan-r1-review-r1.md`

Main prechecks both exact destinations as path-safe, ignored, untracked and unstaged. Round `0` Stage R-A and R-B update the same r0 artifact; rereview uses only the exact r1 artifact. Không chọn bằng scan/glob/mtime/latest.

#### Current repository question and pre-recorded acceptance

Bounded question: “Trong repository hiện tại, Master Plan Only lifecycle để làm một governance program như `NMA-WS5` operable phải giữ GOAL, lineage, review và completion boundaries nào?”

Before dispatch, Main records expected acceptance outside Reviewer payload:

1. Master Planner uses exact Owner package/current repository and returns a no-write candidate with a rehearsal-only seeded omission of one required upstream lineage edge; this deliberate fixture measures finding/correction routing, not author quality.
2. Reviewer initial Stage R-A receives a deliberately incomplete declared package once and must return `BLOCKED(owner_input_unavailable)` into the exact r0 artifact. After the observed package-completeness change, same Reviewer session receives the complete declared set, echoes coverage, freezes independent baseline and returns only `BASELINE_READY`.
3. Candidate content/ref remains outside model-visible Stage R-A payload. Candidate contamination before baseline must be `BLOCKED(review_baseline_contaminated)`; this branch may be covered deterministically rather than destroying the live Reviewer session.
4. Stage R-B discloses exact `rehearsal-plan-r0`; same Reviewer dispositions all six dimensions, detects the seeded missing edge, emits a causal `Required` finding and `BLOCKING_FINDINGS`, and does not treat `PASS`/finding as Owner approval.
5. Same Master Planner session reads detailed Findings, independently dispositions the finding, restores the governing lineage invariant, scans same-family manifestations and returns exact `rehearsal-plan-r1`.
6. Same Reviewer session performs round `1` rereview against exact r1 artifact and returns `PASS` only if the finding, bidirectional trace, lifecycle paths and all six dimensions close with no verdict-changing limitation.
7. Main exact-compares candidate text/scope before each admission, validates handoff/artifact identity, increments completed correction count only after rereview, and alone records the transition. Expected final count is `1/2`.

The rehearsal writes no candidate, implementation, canonical Master Plan or progress file. Only its two ignored review artifacts may be written. No retry occurs without an observed state change; required profile/model/session/config absence uses exact `BLOCKED(...)` and no fallback/custom runner.

Claim limit: this is prompt-bounded native observation for the exact repository/client/profiles/sessions/time exercised. It does not prove filesystem isolation, malicious-agent resistance, every client, future behavior, cross-workspace retention or production readiness. CLI success/prompt order alone is not semantic PASS evidence.

### CP5 — Cumulative review and progress boundary

After implementation/static/rehearsal closure, Main freezes the exact changed-path candidate and opens fresh Implementation Reviewer round `0` with this preassigned artifact:

`docs/native-multi-agent/reviews/nma-001-phase-3/implementation-review/phase-3-candidate-r0-review-r0.md`

Main records this exact literal in the ledger before dispatch and owns admission. Reviewer is candidate-read-only, writes only that artifact, checks owner-10 projection, Master Plan authoring/GOAL/lineage/correction contract, deterministic evidence, rehearsal evidence/limits, expected/forbidden paths and truthful status claims. Candidate movement, extra writes or Git-scoped artifact block admission.

`BLOCKING_FINDINGS` returns to the same Implementor and same Reviewer under rounds `1`/`2`; only completed correction+rereview consumes the `2`-round budget. A material Master Plan change stops as mismatch; no automatic round `3`.

`progress.md` may be updated only with facts observed before the reviewed candidate freeze. Do not preclaim Reviewer `PASS`, future commit hash or a self-referential checkpoint. Because current authority excludes commit, Phase 3 may reach an admitted local implementation-review `PASS` but durable Git closure must stop for Owner authority. Recommended route after PASS:

1. report exact uncommitted candidate, verification, review artifact exclusion and `commit/push/PR/merge=no`;
2. request/await separate commit authority;
3. if granted later, keep reviewed implementation stable, commit it first, then use a progress-only update/commit for stable implementation hash and observed completion facts under separately granted authority;
4. never record progress-only commit's own hash.

Without commit authority, do not fake Phase 3 `committed`/`merged` or open Phase 4 merely from planned steps. Main reports the exact local checkpoint and smallest missing authority.

## Acceptance criteria

1. Planning core routes Master Plan authoring/correction to one contained direct reference and keeps mandatory permission/stop rules in core.
2. New planning reference gives a fresh Master Planner enough exact GOAL, lineage, phase, verification and no-implementation contract, while the existing native review/reconciliation reference is the active operational owner for Master Plan Review.
3. Whole included Owner entries, explicit non-contiguous membership, revision semantics and ephemeral inclusion/exclusion are unambiguous; ended excluded refs are not falsely required.
4. A future unrelated `MULTI_AGENT_MASTER_PLAN` role can reach Stage R-A/R-B, required baseline, six dimensions, contamination blocker, finding/verdict bars, exact artifact ownership and planning-only boundary through active skill routes without reading this feature Master Plan; no competing taxonomy/state machine is created.
5. Closed Master Plan mismatch cannot be silently corrected by lower roles and reaches Owner decision after read-only recommendation.
6. All ten deterministic cases plus direct assertions against the actual native Master Plan Review owner pass through the existing static test owner; validator remains structurally valid with no unexplained warning delta.
7. Native rehearsal completes exact package blocker/resume, `BASELINE_READY`, r0 finding, same-author correction, same-Reviewer r1 `PASS`, exact two-artifact boundary and Main-only transition with `1/2` completed correction rounds.
8. Review artifacts remain ignored, untracked, unstaged; candidate text remains stable at every admission; no canonical or product implementation occurs during rehearsal.
9. Current plan/progress/index links resolve, UTF-8/EOL/final newline and `git diff --check` pass; actual diff contains only expected paths plus these two Planner-owned planning artifacts.
10. Phase 3 completion claims distinguish deterministic structure, native observation, Reviewer verdict, Owner approval, implementation permission and Git/remote state.

## Verification strategy

Run targeted checks after the source changes and again only when affected bytes change:

1. `node --test .agents/scripts/native-multi-agent-workflow.test.mjs` — existing `4/4` plus all added NMA-WS5/owner-10 assertions; report actual final count.
2. `node .agents/scripts/validate-skill.mjs` — expected `valid`, `12 skills`, `0 errors`; any warning delta must be explained and corrected within scope, not hidden.
3. `node --test .agents/scripts/validate-skill.test.mjs` — structural regression, expected current baseline `37/37` unless exact test inventory legitimately changes outside this scope, which is a stop.
4. Focused static audit for GOAL fields, lineage columns, explicit included membership/non-contiguous revision, planning-to-native operational handoff, Stage R-A/R-B, required baseline, six dimensions, contamination blocker, verdict/finding bar, mismatch route, no implementation on Master Plan completion and forbidden custom mechanism absence.
5. Relative Markdown link resolution for changed Markdown; new reference containment/direct-route audit.
6. Strict UTF-8/no BOM, consistent EOL per file, final newline, trailing whitespace, fence/table balance, conflict/zero-width/secret-oriented scan.
7. `git check-ignore -v` plus `git ls-files`/cached audit for exact rehearsal and review paths; verify untracked/unstaged local evidence.
8. `git status --short --branch`, `git diff --name-status`, `git diff --cached --name-status`, exact expected/forbidden changed-path audit and `git diff --check`.
9. Bounded native rehearsal above and fresh cumulative Implementation Reviewer; report each separately from static evidence.

Application tests/build, browser/manual product QA, Supabase/database, CI and deployment are `not applicable` because approved diff does not touch those domains. If actual diff does, stop rather than silently broaden verification.

## Risks và stop conditions

| Risk | Impact | Mitigation / stop |
| --- | --- | --- |
| Owner record revision bị hiểu thành contiguous package | Fresh role yêu cầu expired entries hoặc reject valid dispatch | Explicit membership/projection contract plus deterministic non-contiguous case |
| New reference duplicates native state machine | Hai semantic owners drift | Planning reference owns authoring/template only; native skill remains lifecycle/review owner |
| Master Plan Review semantics chỉ tồn tại ở feature Master Plan/Main payload | Future generic workflow phải tự phát minh review protocol | Existing native review/reconciliation reference becomes active conditional owner; static tests assert the target source |
| Vague GOAL or missing lineage survives | Implementor must invent material semantics | Static cases, Stage R-A baseline, six dimensions and causal finding bar |
| Seeded rehearsal defect bị mô tả như spontaneous quality evidence | Overclaim Reviewer/author quality | Record fixture before dispatch and limit claim to routing/detection/correction |
| Reviewer sees candidate before baseline | Independence claim invalid | `BLOCKED(review_baseline_contaminated)`; do not replace session silently |
| Review artifacts enter Git scope | Local evidence could be published | Ignore/tracked/staged audit before every admission; block without deleting evidence |
| No commit authority conflicts with durable completion | Tracker/phase claim becomes false or action exceeds authority | Stop at reviewed local checkpoint; separate Owner gate for commit/progress-only closure |
| Core-length/validator warning emerges | Skill split may hide required rule or structural quality regresses | Keep core delta concise; validator must remain valid; no threshold/test snapshot change |

Dừng và báo Main nếu exact Owner package/membership unreadable; branch/base/dirty ownership differs materially; required model/profile/session unavailable; any path outside expected scope is necessary; candidate/artifact moves; a required test is skipped/failed; review leaves `Critical`/`Required`; correction budget exhausts; or next action needs ungranted Git/remote/production/destructive authority.

## Implementation handoff

### Approved semantic source

- Master Plan Revision `8` / GOAL Revision `1`, `NMA-WS5`.
- Current correction candidate consumed projected Owner Source Package from Owner-record revision `14`, exact refs `[owner-2, owner-3, owner-9, owner-10, owner-11, owner-12, owner-13, owner-14]`; this records candidate identity only. Main re-projects every later dispatch package from then-current record/scope/authority.
- owner-9 supplies Phase 3 implementation authority; owner-10 supplies current package projection/admission correction.

### Writer boundaries

- Planner: only assigned `phase-3/plan.md` and `phase-3/owner-review-brief.md`.
- Implementor: only exact implementation paths listed above; no planning candidate edit.
- Reviewer: candidate-read-only; only exact preassigned ignored artifact.
- Master Planner rehearsal: no filesystem write; returns exact native candidate output.
- Specialist: `0`, no dispatch.
- Main: package projection, ledger, identity/admission and transition only; does not adjudicate detailed findings.

### Completion boundary

The execution contract remains the accepted Phase 3 plan plus this governing correction: add the active operational Master Plan Review owner and remove stale plan-owned status. Current implementation/review state is read only from `progress.md`; this plan does not preclaim Implementor correction, cumulative rereview `PASS`, commit or Phase 4. Phase 3 gate still requires admissible cumulative Reviewer `PASS`, `0 Critical / 0 Required`, exact local-only artifacts and current claim-limited evidence. Current authority then permits reporting a reviewed uncommitted checkpoint only; commit/remote closure remains a separate Owner gate.

Recommended commit message if Owner later grants local commit after PASS: `feat(native-multi-agent): operationalize master plan workflow`

## Main plan self-review

- Scope/ownership: eight implementation paths have direct owners; two planning candidates remain Planner-only; no product/runtime/config/CI expansion.
- Dependency: owner-10 admission correction precedes Master Plan lifecycle rehearsal; deterministic closure precedes native calls; cumulative review follows candidate freeze.
- Semantics: no new GOAL/architecture; new reference is justified by a concrete conditional consumer and meaningful skip group.
- Authority: implementation/native rehearsal, Specialist, commit and remote boundaries are separated; current plan grants none of the latter actions.
- Verification: static, native observation and Reviewer verdict have distinct claims; seeded defect and prompt-bounded access are disclosed.
- Progress: no future PASS/commit hash/self-reference is planned; no-commit state stops durable Git closure.
- `P3IR0-001` disposition: accepted; the plan now authorizes the existing native review/reconciliation reference as operational Master Plan Review owner and requires direct target assertions.
- `P3IR0-002` disposition: accepted; transient pre-admission/current-state wording is removed or historical-labeled, and `progress.md` exclusively owns current state.
- Planner handoff recommendation, không phải durable current-state claim: Main nên chạy deterministic closure rồi route `phase-3-plan-r2` tới same Plan Reviewer round `2`; recommendation này không phải verdict hoặc workflow transition.
