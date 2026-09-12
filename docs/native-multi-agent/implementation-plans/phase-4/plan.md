# Phase 4 — Detailed implementation plan

## Trạng thái contract và authority

- File này là detailed execution-contract candidate cho Phase 4 / `NMA-WS6`; current implementation, review, commit và delivery state chỉ do [`progress.md`](../../progress.md) cùng exact Owner source hiện hành sở hữu.
- Planning baseline đã được Main xác minh: branch `feat/native-multi-agent-phase-4`; `HEAD == main == origin/main == merge-base == 86bbb450c7e0f80551c9537c3c5a5b8d75278526`; index và working tree sạch trước khi candidate này được tạo.
- Closed semantic source là [Master Plan Revision 8 / GOAL Revision 1](../../plan.md), đặc biệt `NMA-WS6`, Contracts 3–5, plan-drift route và Phase 4 gate. Plan này không sửa GOAL, Master Plan decomposition hoặc Phase 5.
- Exact Owner Source Package, role/session identity, logical candidate revision, review round, artifact identity và current authority snapshot là ephemeral workflow state. Chúng phải được Main cung cấp lại tại mỗi dispatch; không copy chúng vào file này như future admission source.
- Current Main snapshot cấp repository discovery, exact plan/brief candidate write, managed planning/review/correction và local Phase 4 implementation/review sau khi plan được admit. Owner-2 cấp local commit authority chỉ sau final admitted review `PASS`. Không cấp push, PR create/update, CI watch/fix, merge, deployment, database/production mutation, destructive action, history rewrite, force-push hoặc branch deletion.
- `Specialist` mặc định là `0`. Không có unresolved hard-risk cluster hay separate Specialist authority ở planning checkpoint này.

Đọc file này cùng:

- [Master Plan](../../plan.md), [progress owner](../../progress.md), [implementation-plan convention](../README.md) và [Owner review brief](./owner-review-brief.md);
- [`AGENTS.md`](../../../../AGENTS.md) và [`docs/agent-loops.md`](../../../agent-loops.md);
- `native-multi-agent-workflow`, `implementation-planning-and-pr-breakdown`, `maintain-repo-skills`, `code-review-and-quality`, `test-quality-strategy`, `git-checkpoint-workflow`; đọc `code-commenting-and-maintainability` khi structured test-plan header thay đổi;
- exact Owner Source Package và authority snapshot mà Main giao cho role hiện hành.

Nếu repository reality challenge Master Plan, accepted detailed plan, authority hoặc writer boundary, role phải dùng exact mismatch/blocker route; không silently repair owning contract.

## Mục tiêu

Làm cho contract `MULTI_AGENT_E2E` nhỏ nhất nhưng đầy đủ vận hành được bằng native roles và các semantic owner hiện hữu, để một repository task hữu hạn có thể đi qua:

```text
fresh Planner
  → fresh Plan Reviewer
    → fresh Implementor
      → fresh Implementation Reviewer
```

Workflow phải giữ exact Owner intent, serialized candidate ownership, mandatory lifecycle review, same-session correction/rereview, bounded correction episodes, plan-drift/Master Plan mismatch routing, running-Implementor authority synchronization và truthful verification/completion claims. Không tạo custom runtime, database, harness, scheduler, event log, fingerprint/provenance system hoặc review oracle.

## Sự thật repository đã xác nhận

1. `native-multi-agent-workflow` đã sở hữu mode/role identity, Main-only transition, Owner package admission, exact review artifact, candidate stability, handoff admission, blocker, two-round correction budget, same-session continuity và running-role steer boundary.
2. `implementation-planning-and-pr-breakdown` đã sở hữu generic detailed plans, scope/dependency/acceptance/verification, transferable handoff và closed Master Plan Correction, nhưng chưa có directly routed procedure cho `MULTI_AGENT_E2E` detailed-plan candidate, accepted-plan handoff hoặc active plan-drift reconciliation.
3. `code-review-and-quality` đã sở hữu formal/integration review, finding severity, verification taxonomy và human-facing verdicts. Nó chưa map those verdicts to managed lifecycle statuses hoặc define separate Plan Reviewer versus Implementation Reviewer dimensions.
4. `test-quality-strategy` đã yêu cầu smallest meaningful layer, observable evidence, accurate manual-QA status và structured header cho non-trivial multi-behavior test. Không cần competing test taxonomy.
5. `git-checkpoint-workflow` đã tách implementation completion khỏi stage/commit/remote authority. Managed implementation correction phải vẫn review được trên exact uncommitted candidate; generic correction-checkpoint wording không được dùng để ép một ungranted commit trước rereview.
6. `.agents/scripts/native-multi-agent-workflow.test.mjs` là existing deterministic contract-test owner và hiện ghi `18 tests` đã pass. Nó chứng minh source/routing literals, không chứng minh live native behavior hoặc semantic review quality.
7. Project profiles hiện có đủ distinct `Planner`, `Reviewer`, `Implementor`, `Specialist`; required model owner là `.codex/config.toml`. Profile/config presence không tự chứng minh runtime admission.
8. `docs/native-multi-agent/reviews/` bị ignore; existing review artifacts không tracked/staged. Exact artifact path vẫn phải được prechecked cho mỗi logical round.
9. Phase 3 / `NMA-WS5` cùng session-continuity correction đã merged vào current baseline. `progress.md` row còn ghi Phase 4 chưa mở và chưa có implementation authority; current exact Owner source/Main snapshot mới hơn row này và phải được phản ánh bằng observed status, không rewrite history.
10. Product/UI/API/Supabase/database/browser/deployment behavior không thuộc `NMA-WS6`.

## Owner decisions, assumptions, conflicts và open evidence

### Owner decisions đang áp dụng

- Owner yêu cầu đồng bộ `main` rồi thực hiện Phase 4 của approved native multi-agent plan; Main đã hoàn tất fetch/prune, fast-forward và tạo branch/base nêu trên.
- Local Phase 4 implementation/review nằm trong current authority snapshot sau admitted plan. Owner-2 additionally grants local commit only after final admitted review `PASS`; grant này không có hiệu lực trước gate và không cấp push hoặc action remote/destructive nào.
- Closed Master Plan tiếp tục là semantic source; lower plan chỉ operationalize `NMA-WS6` và không được nới sang `NMA-WS7`.

### Assumptions phải revalidate trước dependent work

- Current `.codex` profiles, required model và native spawn/follow-up/interrupt/wait semantics vẫn khả dụng. Drift trả exact applicable status: `BLOCKED(model_unavailable)`, `BLOCKED(config_unavailable)`, `BLOCKED(session_unavailable)` hoặc `BLOCKED(owner_steer_not_synchronized)`; không fallback sang generic role, another backend hoặc custom runner.
- Sequential shared-tree ownership vẫn đủ. Nếu concurrent writers trở thành requirement, đây là `MASTER_PLAN_CONTRACT_MISMATCH`, không phải lý do thêm lock service.
- Existing Node test/validator commands vẫn chạy trên current toolchain; inventory/count thay đổi hợp lệ phải được chứng minh thay vì hard-code historical result.
- `owner-review-brief.md` tiếp tục chỉ giữ material Owner decision/approval/candidate identity tối thiểu. Nó không phải Owner Source Package, inclusion/exclusion record hoặc live ledger; future dispatch vẫn nhận package mới từ Main.

### Conflicts đã reconcile

- `progress.md` phản ánh pre-dispatch Phase 4 authority, còn current Owner/Main snapshot cấp local execution. Đây là status timing difference; progress phải cập nhật bằng facts thực tế, không phải Master Plan mismatch.
- Generic code-review re-review nói correction checkpoint nên có local commit, trong khi managed E2E correction có thể diễn ra trước final review gate. Managed lifecycle phải use exact logical candidate revision/diff/evidence; owner-2 chỉ mở local commit sau final admitted review `PASS`.
- Human-facing verdict `Implementation review passed; manual QA pending` không tương đương lifecycle `PASS`. Khi manual evidence là acceptance requirement, Implementation Reviewer returns `BLOCKED` with resolver/evidence needed; không admit phase completion.

### Open evidence, không phải material design question

- Chưa có later exact Owner authority grant/revocation arriving while Implementor is `RUNNING`. Main không được fabricate Owner source. Nếu event không xảy ra trong pilot, running-role synchronization remains deterministic-only/`not_run`, Phase 4 stays `Partially verified` and Phase 5 does not open.
- Một real same-session correction path chỉ được claim khi an actual Plan Reviewer/Implementation Reviewer finding or independent drift episode occurs and is completed. Không seed a known defect past author-side closure merely để tạo evidence. Nếu pilot passes without a real correction, correction behavior remains deterministically verified only and Phase 4 gate remains partial until an authorized real episode closes.
- Current `phase4-plan` Planner/Plan Reviewer episode là bootstrap evidence vì nó chạy trước CP2–CP5 và nhận phase-specific mechanics từ Main. Nó chỉ có thể chứng minh exact source/session/candidate/artifact mechanics; không được dùng làm post-contract prompt-independent Phase 4 pilot evidence.

## Sizing và dependency

- Preliminary size: large/high-risk vì cross-owner governance, authority ordering và live evidence gate.
- Final size: bounded large, một coherent workstream; ownership ổn định và candidate writers có thể tuần tự hóa, nhưng deterministic checks không thay được representative native pilot.

```text
CP0 current-source/base/authority revalidation
  → CP1 root lifecycle reachability audit
    → CP2 managed E2E detailed-plan owner
      → CP3 managed Plan/Implementation Review owner
        → CP4 episode, drift and Owner-change reconciliation
          → CP5 deterministic contract closure
            → CP6 serialized representative pilot
              → CP7 cumulative Implementation Reviewer and truthful progress closure
```

Không chạy song song hai writer trên cùng candidate. `CP6` chỉ bắt đầu sau deterministic closure của exact bytes mà pilot consumes.

## Task-local lineage delta và blast radius

Không copy toàn Master graph. Các stable local IDs dưới đây chỉ mô tả `NMA-WS6` và buộc exact scope/gate vào semantic dependency thực tế.

| ID | Owner | `depends_on` | `consumes` | `produces` | Assumption evidence / invalidation | Blast radius và gate |
| --- | --- | --- | --- | --- | --- | --- |
| `P4-L0` | Closed Master Plan `NMA-WS6` | `NMA-WS5` | Approved GOAL, E2E objective, Phase 4 gate | Bounded Phase 4 contract và exclusions | Master Plan Revision 8 plus baseline commit `86bbb45`; invalidated by approved upstream semantic revision | `unaffected`, audit CP0; any semantic drift is `MASTER_PLAN_CONTRACT_MISMATCH` |
| `P4-L1` | `AGENTS.md` + `docs/agent-loops.md` + native core | `P4-L0` | Managed-mode routing and four-role order | Root-to-owner reachability | Current exact route points to `native-multi-agent-workflow`; invalidated by route/core edit before implementation | `needs_review`, audit CP1; no write unless a reported plan mismatch is approved |
| `P4-L2` | Planning core + new E2E reference | `P4-L1` | Generic plan/handoff and native mismatch contracts | Prompt-independent managed detailed-plan procedure | Current planning bundle has no direct E2E reference; invalidated if discovery finds an existing canonical owner | `affected`, implement CP2 and verify CP5 |
| `P4-L3` | Review core + new managed-review reference | `P4-L2` | Existing severity/verdict/domain review plus native artifact/status | Plan/Implementation Reviewer dimensions and status mapping | Current review bundle lacks managed mapping; invalidated by competing owner or taxonomy change | `affected`, implement CP3 and verify CP5 |
| `P4-L4` | Native reconciliation + scenario matrix | `P4-L2`, `P4-L3` | Session/artifact/round/Owner-steer primitives | E2E plan, implementation and independent-drift episode composition | Generic primitives exist but E2E composition is not operationally routed; invalidated if core already owns exact composition | `affected`, implement CP4 and verify CP5 |
| `P4-L5` | Existing native static test | `P4-L2`, `P4-L3`, `P4-L4` | Canonical source contracts | Deterministic positive/negative evidence with accurate header | Existing owner has `18/18` baseline; invalidated by test ownership/tooling change | `affected`, implement/execute CP5 |
| `P4-L6` | `.codex` role/config owners | `P4-L2`–`P4-L5` | Project profiles and required model | Fresh role/session admission for pilot | Files exist but presence is not runtime admission; invalidated by model/config/client drift | `needs_review`, live CP6; audit-only, exact blocker on failure |
| `P4-L7` | Phase `owner-review-brief.md` | `P4-L0`, `P4-L2` | Exact material Owner decisions and minimum candidate/approval identity | Durable authority interpretation without live package/ledger state | Implementation-plan convention requires the brief; invalidated by later material Owner decision | `affected`, Planner writes before plan rereview; Implementor read-only |
| `P4-L8` | Implementation-plan `README.md` | `P4-L7` | Admitted Phase 4 plan/brief and current-consumer convention | Discoverable exact Phase 4 artifacts | README currently indexes only Phase 2/3; invalidated by artifact path/convention change | `affected`, reserved post-contract CP6 pilot write |
| `P4-L9` | `progress.md` | `P4-L5`, `P4-L6`, `P4-L8` | Observed implementation/check/pilot/review evidence | Concise current truth and stable completion evidence | Current row is pre-Phase-4; invalidated by later evidence or semantic status change | `affected`, post-contract CP6 pilot and CP7 closure; never store live ledger |
| `P4-L10` | `maintain-repo-skills`, `test-quality-strategy`, `git-checkpoint-workflow`, `.gitignore` | `P4-L2`–`P4-L9` | Skill split/test/Git/artifact boundaries | Governance checks without competing semantics | Current owners already contain required rules and review root is ignored; invalidated if implementation requires changing those contracts | `unaffected`, positive audit CP0/CP5; outside allowlist unless separately re-planned |

Unknown or invalidated assumptions remain `needs_review`; absence of an edge never proves `unaffected`.

## Exact implementation scope

### Expected implementation paths

| Path | Smallest required change | Semantic owner |
| --- | --- | --- |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | Add direct contained resource route and mandatory core boundaries for managed E2E detailed-plan/implementation handoff | Planning activation, authority and resource routing |
| `.agents/skills/implementation-planning-and-pr-breakdown/references/multi-agent-e2e-workflow.md` | New conditional detailed procedure/template for E2E plan candidate, task-local lineage, accepted-plan handoff and active plan drift | Managed detailed-plan execution contract |
| `.agents/skills/code-review-and-quality/SKILL.md` | Route mandatory Plan/Implementation Reviewer work to one contained managed-review reference; preserve default `0 Specialist` and ordinary review behavior | Review activation/resource routing |
| `.agents/skills/code-review-and-quality/references/managed-lifecycle-review.md` | New conditional Plan Reviewer/Implementation Reviewer dimensions, artifact content projection, verdict-to-status mapping and manual-evidence boundary | Managed review judgment contract |
| `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md` | Add bounded E2E episode identity/reconciliation and open/closed upstream mismatch handoff without duplicating planning/review semantics | Managed episode/admission/reconciliation owner |
| `.agents/skills/native-multi-agent-workflow/references/verification-scenarios.md` | Extend existing deterministic matrix with full E2E flow, separate episodes, drift, every Owner-change class, running Implementor grant/revocation and truthful PASS boundaries | Native workflow scenario matrix |
| `.agents/scripts/native-multi-agent-workflow.test.mjs` | Assert route/owner contracts at their canonical sources and keep accurate Vietnamese test-plan header/result | Existing deterministic source-contract test |
| `docs/native-multi-agent/implementation-plans/README.md` | Index Phase 4 plan/brief only after they have an admitted current implementation consumer; reserved for the post-contract pilot slice | Artifact convention/discovery owner |
| `docs/native-multi-agent/progress.md` | Record only observed Phase 4 implementation/check/pilot/review state; reserved for the post-contract pilot slice and stable closure | Durable concise current-truth owner |

Hai reference mới được chứng minh cần thiết bằng exact conditional consumer và nhóm invocation có thể bỏ qua chúng:

- ordinary `NORMAL`, `MULTI_AGENT_MASTER_PLAN`, standalone PR breakdown and generic transferable plans skip `multi-agent-e2e-workflow.md`;
- ordinary checkpoint/PR review, small docs review and Specialist consultation skip `managed-lifecycle-review.md`.

Cả hai reference phải được link trực tiếp từ `SKILL.md` cha, có exact read condition không rỗng áp dụng trước hành động, nằm trong bundle tương ứng và giữ authority/permission/stop/reporting invariants ở core.

### Audit-only owners

- `AGENTS.md`, `docs/agent-loops.md` and closed Master Plan. Root/lifecycle routing already reaches `native-multi-agent-workflow`; do not duplicate its four-role state machine.
- `owner-review-brief.md` is Planner-owned and part of this corrected planning candidate; Implementor must read but never edit it.
- `native-multi-agent-workflow/SKILL.md` and `owner-source-and-steering.md`: current core/change classes/running-role synchronization already own the required semantics; edit only if deterministic consumer→owner closure proves an exact missing mandatory core invariant, then stop and report scope impact before expansion.
- `implementation-planning-and-pr-breakdown/references/pr-breakdown-and-handoff.md`, `tracked-program-and-durable-plan.md`, `master-plan-workflow.md`: reuse generic handoff/durable/closed-plan owners; do not copy them into the new reference.
- `code-review-and-quality/references/domain-review-dimensions.md` and `review-report-templates.md`: reuse domain/finding/report shapes; do not fork taxonomy.
- `test-quality-strategy/**`, `git-checkpoint-workflow/**`, `maintain-repo-skills/**`, `.codex/**`, `.gitignore`, skill validator implementation/tests and package scripts.

If a required contract is absent from an audit-only owner, Implementor returns `PLAN_CONTRACT_MISMATCH` with exact evidence. It does not silently expand the allowlist.

### Forbidden paths/domains

- `docs/native-multi-agent/plan.md`, Phase 1–3 artifacts, Phase 5 plan/progress semantics, `phase-4/plan.md`, `phase-4/owner-review-brief.md` and historical review artifacts for Implementor writes.
- Product/application source, UI, API, Supabase/database/schema/RLS/RPC, fixtures, browser/E2E product tests, deployment and production.
- `.agents/evals/**`, `.agents/scripts/lib/skill-evals/**`, CLI/evaluation runner, package dependency/script, CI/GitHub workflow or validator behavior changes.
- New orchestration runtime, database, scheduler, message bus, polling loop, event store, manifest, fingerprint/hash registry, provenance service or review oracle.
- Stage hoặc commit trước final admitted review `PASS`; mọi push/PR/CI/merge/deploy/remote/destructive/history-rewrite/force-push/branch-deletion action. Owner-2 conditional local commit grant does not weaken these other exclusions.

## Implementation contract

### CP0 — Revalidate source, base, authority and scope

1. Echo exact `owner_input_revision` and ordered included refs from Main before substantive work; reject missing/truncated/reordered/ambiguous source with exact blocker.
2. Confirm branch, `HEAD`, `origin/main`, merge-base, index, tracked/unstaged/untracked state and ownership of every pre-existing change.
3. Read accepted Phase 4 plan and Owner brief, current Master Plan/progress/index convention and every routed skill/reference. Do not use this plan's historical baseline as current Git proof.
4. Confirm all prospective review destinations are path-safe, absent or exact blocker-resume artifacts, ignored, untracked and unstaged.
5. Record candidate start path/existence/bytes and exact implementation allowlist in Main's ephemeral ledger.
6. Stop on changed GOAL/Master Plan, unclear dirty-tree ownership, unavailable required profile/model/session, outside-allowlist necessity or missing implementation authority.

### CP1 — Root lifecycle reachability audit

Without editing the root/lifecycle owners, confirm a fresh routed reader can recover this dependency order from `AGENTS.md` → `docs/agent-loops.md` → `native-multi-agent-workflow` without carrying a phase prompt:

```text
Planner candidate + author-side closure
  → mandatory Plan Reviewer and admitted plan PASS
    → Implementor under exact accepted plan/current authority
      → mandatory Implementation Reviewer and admitted implementation PASS
```

Lifecycle overlay chỉ chọn mode và route tới related owners. `native-multi-agent-workflow` vẫn là source duy nhất cho exact four-role order, sessions, ledger, artifacts, rounds, admission và transitions. `PASS` không bao giờ tự cấp hành động kế tiếp; Main phải kiểm tra authority tách biệt trước dispatch. Nếu audit không đạt, dừng với `PLAN_CONTRACT_MISMATCH` thay vì tự biến audit-only path thành writable.

### CP2 — Managed detailed-plan owner

Planning core và `multi-agent-e2e-workflow.md` mới phải thiết lập:

1. Planner derives detailed GOAL/outcome and plan contract from exact Owner source plus closed Master Plan/current repository; Main routing summary is non-authoritative.
2. Candidate references Master Plan ID/workstream and records only task-local lineage delta: owner, dependency, consumed/produced contract, assumption evidence/invalidation and affected/unaffected/`needs_review` classification.
3. Candidate defines exact/forbidden paths, branch/base/dependencies, state transitions, acceptance, deterministic/native/manual evidence, progress owner, rollback/stop and permission state.
4. A fresh Implementor receives exact accepted candidate and source/authority package and must not invent or repair plan semantics.
5. `PLAN_CONTRACT_MISMATCH`: Implementor stops dependent mutation, preserves actual partial state, returns repository evidence; Main resumes exact original Planner; verified smallest goal-preserving correction returns to exact original Plan Reviewer before same Implementor resumes.
6. `MASTER_PLAN_CONTRACT_MISMATCH`: lower work pauses. Open upstream workflow reuses exact original Master Planner/Reviewer; closed upstream plan uses fresh read-only Master Plan Correction recommendation then `OWNER_DECISION_REQUIRED` and Owner disposition.
7. Resource does not restate artifact path, round counters, session recovery, finding taxonomy or Git procedure; it links their canonical owners.

Managed detailed-plan template phải bàn giao được và bao gồm goal, facts/Owner decisions/assumptions/conflicts, scope/exclusions, skills/owners, branch/base, task-local lineage, checkpoints, acceptance, verification/manual evidence, progress, mismatch/correction, rollback/stop và action permissions.

### CP3 — Managed review judgment owner

Code-review core và `managed-lifecycle-review.md` mới phải giữ mandatory Reviewer độc lập với optional Specialist, đồng thời định nghĩa hai review subject:

- Plan Reviewer: exact Owner/Master Plan fidelity, repository ownership, task-local lineage/dependencies, exact/forbidden scope, implementability, acceptance/evidence, permissions, drift/rollback/stop and prompt-leakage closure.
- Implementation Reviewer: exact accepted-plan fidelity, cumulative changed-path/range, observable behavior, test/manual/native evidence, candidate/artifact stability, progress truth, rollback/readiness and no scope/authority leakage. It uses formal/integration/domain dimensions only where the actual change requires them.

Each Reviewer writes only Main's exact artifact and returns lifecycle status. Keep human review verdict in the artifact, then map without weakening either taxonomy:

| Review result | Lifecycle status |
| --- | --- |
| All required dimensions/evidence complete; `0 Critical / 0 Required`; no mandatory manual QA pending | `PASS` |
| Material candidate defect within current author/plan authority | `BLOCKING_FINDINGS` |
| External evidence, permission, environment or mandatory manual QA unavailable/pending | `BLOCKED` with resolver and smallest state change |
| Material correction needs a different accepted plan/GOAL/authority | Reviewer records evidence; author returns applicable mismatch or Main opens Owner gate; no weakened `PASS` |

`Approved` may project to `PASS` only under the first row. `Changes required` projects to `BLOCKING_FINDINGS`. `Implementation review passed; manual QA pending` never projects to `PASS` in managed E2E. `Rejected approach` remains a detailed verdict and routes blocking correction/mismatch according to what owns the smallest valid fix.

For rereview of an uncommitted managed candidate, exact logical revision, correction diff, affected evidence and candidate stability replace the generic expectation that a commit must already exist. Commit is checked only when granted and part of the candidate contract.

### CP4 — Episodes, drift and Owner-change reconciliation

Add only E2E-specific episode composition to the existing native reconciliation owner:

| Episode | Initial round | Automatic budget | Continuity |
| --- | --- | --- | --- |
| Detailed plan | `review_round=0` | up to two completed correction+rereview rounds | same Planner + same Plan Reviewer |
| Implementation | `review_round=0` | independent up to two completed rounds | same Implementor + same Implementation Reviewer |
| Independent later plan drift | new episode at `review_round=0` only when a new causal issue family is evidenced | own up to two completed rounds | original Planner + original Plan Reviewer; same Implementor resumes after PASS |

`BLOCKED`, deterministic pre-review failure, stale handoff or candidate movement consumes no correction round. Same root cause cannot reset budget by renaming episode/finding. After round `2` still has blocking findings, Main alone sets `OWNER_DECISION_REQUIRED`; round `3+` needs exact Owner authorization and continues the count.

Every later Owner entry is preserved whole and classified with every applicable boundary:

| Change class | Required route |
| --- | --- |
| Clarification | Increment Owner revision; same author updates affected logical candidate; affected review repeats |
| Detailed-plan change | Supersede plan candidate; reopen same Planner; new plan revision/review episode before dependent implementation |
| Authority-only change | Refresh package/snapshot; no semantic candidate/GOAL revision; synchronize any affected running role |
| GOAL/invariant/scope change | Preserve current work; `OWNER_DECISION_REQUIRED`; Owner owns GOAL revision and disposition |
| Prior-work disposition | Record exact retain/rework/supersede/revert/abandon before resume; never discard implicitly |

An entry spanning classes uses all routes and the most restrictive stop. A Master Plan contract change or broad multi-capability expansion pauses E2E and follows open/closed Master Plan route rather than being appended to a detailed plan.

For authority-sensitive input while Implementor is `RUNNING`, Main must establish:

```text
exact later Owner entry captured
  → interrupt/quiesce exact Implementor session
    → audit completed, in-flight, partial and unacknowledged repository/external state
      → refresh package + authority snapshot
        → same-session resume
          → Implementor echoes refreshed revision/refs and reconciles actual state
            → only still-authorized next action proceeds
```

Chỉ riêng việc message/follow-up được gửi thành công không phải evidence. Grant không có hiệu lực hồi tố; revocation không hoàn tác action đã dispatch/hoàn tất. Nếu quiescence/audit/resume không đạt, trả `BLOCKED(owner_steer_not_synchronized)`.

### CP5 — Deterministic contract closure

Extend only `.agents/scripts/native-multi-agent-workflow.test.mjs`. Preserve existing tests and add behavior-focused groups that inspect canonical owners, not only delegating sentences:

1. Root → planning/review/native/test/Git reachability and serialized four-role order.
2. Fresh initial roles, same-session correction, distinct plan/implementation/drift episodes, round `0/1/2`, blocker non-consumption and exhausted-budget Owner gate.
3. Detailed plan contains exact/forbidden paths, task-local lineage, acceptance/evidence, permissions and mismatch route; Implementor cannot rewrite plan.
4. Plan Reviewer versus Implementation Reviewer dimensions and lifecycle status mapping.
5. `Implementation review passed; manual QA pending`, skipped/unavailable verification and stale evidence cannot produce `PASS`.
6. Open/closed Master Plan mismatch and fresh read-only Correction for closed plan.
7. All five Owner-change classes, multi-class restrictive route and prior-work disposition.
8. Running Implementor grant and revocation require interrupt/quiesce/state audit/same-session resume; live delivery alone fails.
9. Review artifact exact path/Git boundary, candidate movement/stale handoff, author finding dispositions and implementation candidate currentness.
10. Negative scan for custom runtime/database/harness/log/scheduler/manifest/fingerprint/provenance/polling/review-oracle ownership.

Update the test-plan header only after actual cases/results are known. Static checks must state their claim limit.

Then run:

1. `node --test .agents/scripts/native-multi-agent-workflow.test.mjs`.
2. `node .agents/scripts/validate-skill.mjs` — expected `12 skills`, `0 errors`; warning delta must be explained/resolved within scope.
3. `node --test .agents/scripts/validate-skill.test.mjs` — expected current inventory `37/37` unless an exact legitimate repository change explains a new count.
4. Focused source audit for routes, read conditions, status literals, episode boundaries, Owner classes, running sync, forbidden mechanism absence and no prompt-only semantic.
5. Relative-link/resource containment, UTF-8/no BOM, consistent EOL, final newline, whitespace/fence/table/conflict/zero-width checks for changed text files.
6. `git check-ignore -v`, `git ls-files`, cached audit for every exact review artifact; `git status --short --branch`, changed-path audit and `git diff --check`.

Không chạy application build/browser/Supabase/CI/deployment checks trừ khi actual diff chạm các owner đó; nếu có, dừng vì scope mismatch.

### CP6 — Post-contract serialized representative native pilot

Current `phase4-plan` author/review episode is explicitly `bootstrap-only`. It may establish Owner-package admission, same-session correction, candidate stability and exact artifact mechanics, but it must be excluded from evidence that CP2/CP3 routes work without phase-specific expected semantics.

#### Core implementation checkpoint before pilot

1. After this plan/brief receive same Plan Reviewer `PASS`, a fresh Implementor writes only the seven core paths from planning/review/native/test owners; `README.md` and `progress.md` remain untouched and reserved.
2. CP5 deterministic closure must pass on exact core bytes.
3. Main freezes the seven-path candidate and opens a fresh core Implementation Reviewer under `phase4-core-implementation`, candidate-read-only/artifact-write. The Reviewer must route from implemented repository owners; `PASS` is required before those contracts are used by the pilot.
4. Core review correction uses the same Implementor/Reviewer and its own rounds `1/2`; plan-owned mismatch returns to the exact original Planner/Plan Reviewer.

#### Real remaining Phase-4-owned pilot slice

After core review `PASS`, run a second fresh full E2E workflow slice within `nma-phase4-20260912`:

- Plan episode: `phase4-post-contract-pilot-plan`.
- Implementation episode: `phase4-post-contract-pilot-implementation`.
- Real outcome: make the now-current Phase 4 artifact discoverable by indexing exact `phase-4/{plan.md,owner-review-brief.md}` in `docs/native-multi-agent/implementation-plans/README.md`, and update `docs/native-multi-agent/progress.md` only with observed Phase 4 state/evidence available before final verdict.
- Fresh Planner returns an exact bounded plan candidate as immutable native output; no duplicate durable plan file is created. Fresh Plan Reviewer writes only Main's exact ignored artifact. After admitted plan `PASS`, fresh Implementor writes only README/progress. Fresh Implementation Reviewer writes only its exact ignored artifact and reviews both the two-path pilot implementation plus the cumulative nine-path Phase 4 integration range.
- Every initial role uses zero inherited task history. Main retains exact session identities through enclosing workflow terminal state; idle/finished/absent-from-list is not session-unavailability evidence.
- Payload contains exact Owner Source Package, current authority, repository entry routes, exact task outcome/scope, candidate/artifact identity and stop conditions. It must not contain expected answers, candidate-authored review dimensions, precomputed findings or a seeded defect. Planner/Reviewers must discover reusable semantics through implemented repository routes.
- Plan drift opens `phase4-plan-drift-<n>` only from an evidenced independent root cause and reuses the owning original Planner/Plan Reviewer; no episode rename may reset budget.

#### Evidence requirements

Pilot phải quan sát được, không chỉ ghi vào prompt:

1. exact Owner package echo/admission at every initial or refreshed dispatch;
2. correct four-role serialization, admitted pilot plan before mutation and Main-only transitions;
3. role recovery of detailed-plan and managed-review semantics from repository owners without expected answer/dimensions in payload;
4. exact local-only artifact and matching handoff for every review round;
5. candidate path/existence/bytes unchanged during review and no Reviewer write outside artifact;
6. README links resolve to exact plan/brief and progress records only current evidence without live ledger/package/session/round state;
7. detailed Findings independently verified/dispositioned by same author before same-Reviewer rereview when a real correction occurs;
8. at least one real same-session correction or independent drift episode before claiming complete correction-path live evidence;
9. a real later Owner authority grant/revocation while Implementor is `RUNNING`, including quiescence, actual-state audit, refreshed exact source echo and same-session resume, before claiming running-authority live evidence;
10. mandatory verification/manual evidence complete before final `PASS`.

Không cố tình đưa known defect qua author-side closure hoặc dựng Owner steer giả. Khi mục 8 hoặc 9 không xảy ra tự nhiên/explicit dưới current authority, record `not_run`/`Partially verified`; deterministic cases still pass but Phase 4 gate does not. Nếu không thể mở real two-path remaining slice hoặc current authority không bao phủ nó, return `BLOCKED` with exact resolver instead of substituting the bootstrap episode. Required profile/model/session/config/native semantics failure uses exact blocker and no fallback.

Specialist remains `0` unless a concrete hard-risk cluster, insufficient main evidence, bounded 1–3 questions, quota benefit and explicit current authority all exist. If no justified Specialist exists, reuse exact still-current Phase 2 consultation evidence only within its recorded claim boundary; do not call one for ceremony.

#### Pilot claim limits

Quan sát chỉ ràng buộc exact repository, branch, candidate bytes, config, client, model, sessions, Owner package/authority và thời điểm đã thực thi. Nó không chứng minh strict filesystem isolation, malicious-role resistance, cross-workspace retention, future platform behavior, automatic routing trên mọi client hoặc production readiness.

### CP7 — Cumulative review and progress closure

The fresh post-contract pilot Implementation Reviewer is the final cumulative Reviewer: it receives the admitted pilot plan, exact cumulative nine-path diff/range, current Owner package/authority, core review evidence, deterministic results and native observations. It writes only the exact preassigned pilot implementation artifact and returns `PASS`, `BLOCKING_FINDINGS` or `BLOCKED` under CP3. This avoids a redundant fifth lifecycle role while still performing cross-owner integration review.

Correction dùng same pilot Implementor/Reviewer và rounds `1/2`. Core-owned findings route to the still-retained core Implementor/Reviewer or exact original Planner/Plan Reviewer according to semantic ownership; after correction, final cumulative rereview remains with the same pilot Implementation Reviewer. Không có automatic round `3` hoặc replacement session để tìm verdict thuận lợi.

Trước review, `progress.md` chỉ được ghi facts đã quan sát, ví dụ `implemented`, exact deterministic result, pilot `Partially verified`/`Blocked` và `implementation review pending`. Không được preclaim future Reviewer `PASS`, commit hash, push/PR/merge hoặc Phase 5 opening.

Sau admitted `PASS`:

- owner-2's conditional local commit authority becomes usable for the exact reviewed Phase 4 scope; it still grants no push or remote action.
- Main revalidates exact candidate/artifact/Git scope, then commits the reviewed implementation locally through `git-checkpoint-workflow` without including ignored review artifacts.
- Stable progress closure follows the repository contract: commit reviewed implementation first, then update `progress.md` only with stable admitted verdict and implementation hash and create a local progress-only commit within the same conditional Phase 4 commit authority. Tracker never records the progress-only commit's own hash or `pending this checkpoint`. A semantic status/acceptance change would require review rather than this narrow closure.
- Phase 5 remains closed until all mandatory Phase 4 live/manual evidence is current. Deterministic PASS plus a blocked/not-run pilot branch is not Phase 4 completion.

## Acceptance criteria

1. A fresh reader starting at `AGENTS.md`/`docs/agent-loops.md` can route a bounded managed task through fresh Planner → Plan Reviewer → Implementor → Implementation Reviewer without phase-prompt-only semantics.
2. Detailed plan and managed review each have one directly routed canonical procedure with meaningful skip group; no mandatory authority/stop rule is hidden and no existing taxonomy/state machine is duplicated.
3. Plan Reviewer and Implementation Reviewer are mandatory regardless of Specialist; each owns exact artifact/full verdict while Main alone admits/transitions.
4. Implementation begins only after admitted plan `PASS` plus current implementation authority; Implementor cannot edit plan or silently resolve plan/Master Plan mismatch.
5. Plan, implementation and independent drift episodes have correct separate budgets/session continuity; blocker/stale/pre-review failures do not consume rounds; round-2 findings reach Owner gate.
6. Open/closed Master Plan mismatch, all Owner-change classes, multi-class restrictive route and prior-work disposition are executable without lower-layer semantic rewrite.
7. Running Implementor authority grant/revocation cannot affect protected action until exact interrupt/quiesce/audit/same-session-resume/source-echo boundary closes.
8. `PASS` requires current required evidence, `0 Critical / 0 Required` and no mandatory manual QA pending; blocked/skipped/stale/partial evidence stays visible.
9. Deterministic tests assert behavior at canonical owners; existing validator/regression checks stay green without new runner/harness/package/CI infrastructure.
10. Current `phase4-plan` episode is labeled bootstrap-only and excluded from post-contract prompt-independence claims; the fresh real README/progress pilot preserves exact package, writer/artifact/candidate/session identities and records real correction/running-steer evidence or remains explicitly partial/blocked.
11. All nine implementation paths stay inside their exact core-seven then pilot-two allowlists; review artifacts remain ignored/untracked/unstaged; UTF-8/EOL/newline/link/whitespace and `git diff --check` pass.
12. `owner-review-brief.md` preserves material Owner decisions and conditional commit interpretation without live package/ledger state; README indexes exact Phase 4 artifacts when they gain a current consumer.
13. `progress.md` records only observed current truth; implementation/review/commit/push/PR/merge/Phase 5 states remain distinct.

## Rollback và stop conditions

Rollback là logical và authority-aware, không phải destructive action:

- Before admitted plan PASS, preserve candidate/review evidence and return findings to same Planner.
- Before implementation PASS, preserve working tree and return exact findings/mismatch to owning same session; do not reset/revert automatically.
- Owner scope/GOAL/disposition change preserves partial work until exact retain/rework/supersede/revert/abandon decision. `revert` still requires explicit destructive/Git authority and owning procedure.
- A failed/blocked pilot does not roll back verified deterministic source changes; it prevents Phase 4 completion/Phase 5 transition until resolver/state change is observed.

Stop and report exact state when Owner package is incomplete/ambiguous; branch/base/dirty ownership differs materially; required profile/model/session/config is unavailable; an audit-only/forbidden path is necessary; candidate/artifact moves; Reviewer writes outside artifact; artifact enters Git scope; required deterministic/native/manual evidence fails or is unavailable; same-session continuity/synchronization cannot be established; correction budget exhausts; or next action needs ungranted Git/remote/production/destructive authority.

## Implementation handoff

### Approved semantic source

- Master Plan Revision `8`, GOAL Revision `1`, `NMA-WS6`; dependency `NMA-WS5` is present in current merged baseline.
- Current exact Owner Source Package and authority snapshot must be supplied by Main; this file is not their replacement.

### Writer boundaries

- Planner: only exact assigned Phase 4 plan/brief candidate paths; current `phase4-plan-r2` candidate scope is both `plan.md` and `owner-review-brief.md`.
- Plan Reviewer: candidate-read-only; only exact preassigned ignored artifact.
- Core Implementor: only the seven skill/reference/test paths listed above after plan admission and current authority revalidation.
- Post-contract pilot Implementor: only `implementation-plans/README.md` and `progress.md` after core review `PASS` and pilot plan admission. Total cumulative implementation allowlist is nine paths.
- Implementation Reviewer: candidate-read-only; only exact preassigned ignored artifact.
- Master Plan Correction: read-only recommendation; no canonical edit or workflow transition.
- Specialist: `0` unless every bounded gate and explicit authority is later satisfied; no delegation.
- Main: ephemeral package/ledger/session/admission/transition; no finding adjudication or semantic translation.

### Completion boundary

Phase 4 chỉ complete khi exact cumulative nine-path implementation candidate có admitted post-contract Implementation Reviewer `PASS`, deterministic checks còn current, required representative live/manual evidence đầy đủ, review artifacts vẫn ngoài Git scope và progress truth ổn định. Sau gate đó owner-2 cho phép local implementation/progress closure commits; Phase 5 và mọi remote action vẫn là các gate tách biệt.

Recommended commit message for owner-2-authorized local commit after final admitted PASS:

`feat(native-multi-agent): operationalize managed e2e workflow`

## Correction round 1 dispositions

- `P4PR0-001` — accepted and corrected at the governing evidence boundary: current plan/review is bootstrap-only; the post-contract pilot is a fresh full E2E run on the real README/progress closure slice, with no expected answers/review dimensions/seeded defect in payload and an explicit partial/block route when real evidence is absent.
- `P4PR0-002` — accepted and corrected at durable ownership: `owner-review-brief.md` is now the exact Planner-owned decision/authority surface; README is a later implementation path for current-consumer indexing; plan/brief/index/progress and live package/ledger owners are non-overlapping.
- `P4PR0-003` — accepted and corrected at lineage/scope: `P4-L0..P4-L10` record stable owners, dependencies, consumed/produced semantics, evidence/invalidation and positive `affected`/`unaffected`/`needs_review` dispositions tied to CP gates and exact allowlists.

## Author-side handoff closure

- Consumer → owner: every delegated semantic was checked against its current canonical owner. New references own only conditional managed planning/review procedure; native reconciliation retains sessions/artifacts/rounds; brief/README/progress own decision evidence, discovery and current truth separately; test/Git owners remain distinct.
- Acceptance → evidence: deterministic assertions target the actual planning, review and native owners; the bootstrap episode is excluded from prompt-independence evidence; the later fresh README/progress pilot separately owns post-contract live behavior evidence. Link presence or prompt success never counts as semantic PASS.
- Prompt leakage: all reusable role, path, lineage, episode, mismatch, Owner-change, authority-sync, evidence and stop semantics needed by fresh downstream roles are assigned to repository-owned sources. Pilot payload explicitly withholds expected answers/review dimensions; current package/session/revision values remain correctly ephemeral and must be re-supplied by Main.
- Simplicity: two new resources have exact consumers/skip groups; no new runtime, store, harness, parser, fingerprint or generalized framework is required.
- Specialist decision: `0`; current repository evidence resolves the planning questions without a remaining bounded expert uncertainty.

Planner recommendation only: Main should run candidate deterministic pre-review closure, freeze both candidate paths, preassign exact `phase4-plan-r2` round-1 artifact, and route the correction to the same Plan Reviewer session. Main alone may admit a verdict or transition.
