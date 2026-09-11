# Phase 2 — Detailed implementation plan

## Trạng thái và authority

- Artifact state: `pending owner decision`.
- Owner input consumed: `owner_input_revision=6`; ordered refs `[owner-1, owner-2, owner-3, owner-4, owner-5, owner-6]`.
- Branch: `docs/native-multi-agent-phase-2`.
- Planning baseline đã được Main xác minh: `main == origin/main == 62cf52879eff2cbd569b9ae43bee31e445a33c4f`; Phase 1 commit `ebec89212eb9f993d1a2006614984ad5051e386e` là ancestor; working tree/index sạch trước candidate planning.
- Owner đã yêu cầu thực hiện Phase 2, cho phép local commit, phê chuẩn relocation order bên dưới và dùng owner-6 để resume sau pause. Owner chưa approve mọi exact bytes/material decision khác của detailed plan do agent tạo; review hoặc self-review cũng không thay Owner decision.
- Không được phép: push, PR, CI watch/fix, merge, deployment, database/production/remote mutation, force-push, history rewrite, branch deletion hoặc destructive cleanup.
- Planner và Implementor được ghi đúng candidate thuộc phase; Reviewer chỉ đọc candidate và chỉ được ghi exact preassigned review artifact; Specialist chỉ đọc.

Đọc file này cùng:

- master plan hiện hành tại [`docs/native-multi-agent/plan.md`](../../plan.md);
- [owner-review-brief.md](./owner-review-brief.md);
- [`AGENTS.md`](../../../../AGENTS.md), [`docs/agent-loops.md`](../../../agent-loops.md), adaptive [plan](../../../agent-workflow/plan.md), [progress](../../../agent-workflow/progress.md) và [problems](../../../agent-workflow/problems.md);
- `implementation-planning-and-pr-breakdown`, `maintain-repo-skills`, `code-review-and-quality`, `git-checkpoint-workflow` và mọi skill whose changed contract activates it.

Nếu các nguồn này conflict materially, repository/runtime evidence invalidates a Master Plan contract, hoặc exact permission không đủ cho action kế tiếp, dừng và báo Main; không tự sửa semantic root.

## Mục tiêu

Hoàn tất Phase 2 của `NMA-001` theo dependency `NMA-WS2 → NMA-WS3 → NMA-WS4`, đồng thời sửa ownership layout theo Owner clarification:

1. native multi-agent trở thành feature-level documentation owner ngang hàng với `docs/agent-workflow`, không còn nằm dưới adaptive workflow;
2. root/lifecycle/active skill owners dùng canonical mode và role vocabulary không collision;
3. một repo-local skill sở hữu orchestration contract dựa trên native Codex primitives, không có custom runtime/database/harness;
4. project-scoped profiles làm Planner, Reviewer, Implementor và Specialist executable với đúng writer boundary;
5. static contract checks và bounded native smoke chứng minh Phase 2 gate trước khi Phase 3/4 bắt đầu;
6. `docs/native-multi-agent/progress.md` ghi current truth và evidence của chính feature.

## Sự thật đã xác nhận

1. Master Plan revision 8 và GOAL revision 1 đã được Owner approve; Phase 2 gồm `NMA-WS2`, `NMA-WS3`, `NMA-WS4` theo đúng dependency order.
2. Phase 1 đã merge và reconciled adaptive/native ownership boundary; `docs/agent-workflow/progress.md` nói rõ nó không sở hữu status của native extension.
3. Tracked master plan hiện ở `docs/native-multi-agent/plan.md`; `.gitignore` ignore `/docs/native-multi-agent/reviews/`.
4. Project chưa có `.codex/` configuration ở planning baseline.
5. Active terminology collisions tồn tại trong adaptive master plan, planning skill, review skill và direct Specialist references; historical implementation plans là evidence và không được mass rewrite.
6. `code-review-and-quality/references/review-report-templates.md` đã sở hữu finding/verdict/verification content shape; native orchestration chỉ cần thêm identity, artifact timing/path và handoff projection.
7. Current local runtime observation: `codex-cli 0.153.4`; feature `multi_agent` là `stable=true` tại discovery. Đây là compatibility evidence phải được revalidate ở implementation/smoke checkpoint.
8. Official Codex subagent documentation hiện dùng `.codex/config.toml` cho `[agents]` defaults và standalone `.codex/agents/*.toml` với required `name`, `description`, `developer_instructions`; `model`, `model_reasoning_effort` và `sandbox_mode` là supported per-profile keys. Schema/version/model availability có thể drift và phải revalidate trước writing config.
9. Main revalidated after owner-6: `HEAD == main == origin/main == 62cf52879eff2cbd569b9ae43bee31e445a33c4f`; index sạch; chỉ ba Phase 2 planning candidates là untracked.
10. Relocation inventory đã bảo toàn tracked master plan tại `docs/native-multi-agent/plan.md`; hai ignored local review artifacts nằm dưới `docs/native-multi-agent/reviews/`: `plan-r3-review-r0.md` SHA-256 `cd0c985837f8a5242059baa44a0ad55259b8b00076a90aa32f9f42e9993186d5` và `plan-r5-review-r1.md` SHA-256 `cbab9ba4546ccd202998d563711259a7f759e57a14c1a0848fe0f5338323c0d1`. Hash master plan trước khi sửa path là `b189dad56f9860b6af2f3520ca1d18ccf567035b880254b293ea17e70504d005`.

## Owner decisions, planning conclusions và câu hỏi còn mở

### Explicit Owner decisions

- Fetch/sync `main`, tạo branch mới, thực hiện Phase 2 và local commit.
- Dùng repository-native nested `implementation-plans/<phase>/plan.md` plus `owner-review-brief.md` convention.
- Relocate feature docs sang `docs/native-multi-agent`, ngang hàng với `docs/agent-workflow`.
- Thêm `docs/native-multi-agent/progress.md` làm durable current-status owner của feature.
- Relocate existing local ignored reviews sang `docs/native-multi-agent/reviews` và không stage chúng.
- Move cả tracked master plan và local review evidence trước khi sửa references; repo-wide search/fix old root; chứng minh old root không còn content cần giữ rồi mới xóa directory.
- Sau deterministic path/link/Git-scope checks, gọi fresh Master Plan Reviewer review exact revised Master Plan và relocation ownership. Chỉ `PASS` mới cho phép commit exact relocation scope.
- owner-4 tạm pause Plan Reviewer do quota; owner-5 supersede round đó bằng later fresh Master Plan Reviewer sau relocation/checks; owner-6 resume execution.

### Planning conclusions requiring Owner decision

- Exact behavior/resource/config file set bên dưới là candidate derived từ approved master contract và current repository; nó chưa phải explicit Owner-approved detailed-plan decision.
- Fresh Master Plan Reviewer sau relocation được owner-5 yêu cầu rõ và owner-6 resume; authority này không mở rộng thành Specialist, extra reviewer, push/PR/merge hoặc unbounded native calls. Mandatory Phase 2 smoke ngoài exact relocation review vẫn phải nằm trong Phase 2 authority/scope tại thời điểm dispatch; nếu Main không thể establish coverage, phase giữ `BLOCKED`/`Partially verified` và dependent phase không bắt đầu.
- Model mapping giữ approved Master Plan literal `gpt-5.6-sol`: Class A=`high`, Class B=`medium`. Nếu current client/config không load model này, dừng `BLOCKED(model_unavailable)`; không substitute sang model khác.

Không có product/business/database decision trong Phase 2.

## Phạm vi exact theo dependency

### Foundation relocation và durable ownership — prerequisite cho WS2

| Path | Thay đổi nhỏ nhất | Ownership |
| --- | --- | --- |
| `docs/agent-workflow/native-multi-agent/plan.md` → `docs/native-multi-agent/plan.md` | Tracked rename; update only navigation/status-owner wording required by relocation | Master GOAL/architecture/workstream owner |
| `docs/native-multi-agent/progress.md` | Tạo durable tracker; record truthful per-workstream/checkpoint/verification/Git/permission state | Native feature current truth only |
| `docs/agent-workflow/plan.md` | Đổi link tới relocated master và giữ compatibility boundary; không nhận native feature ownership | Adaptive program owner |
| `docs/agent-workflow/progress.md` | Đổi link tới relocated master; tiếp tục nói rõ không track native feature | Adaptive program current status owner |
| `.gitignore` | Đổi canonical local review ignore từ old path sang `/docs/native-multi-agent/reviews/` | Git publication boundary |
| `docs/native-multi-agent/implementation-plans/README.md` | Giữ index/layout/routing; update link only if relocation changes relative route | Artifact convention owner |
| `docs/native-multi-agent/implementation-plans/phase-2/plan.md` | Chỉ reconcile approved material amendment; không trở thành progress tracker | Phase 2 execution contract |
| `docs/native-multi-agent/implementation-plans/phase-2/owner-review-brief.md` | Chỉ record explicit Owner decisions/consumed permission | Owner decision surface |

Local ignored evidence, nếu tồn tại, được move byte-for-byte từ `docs/agent-workflow/native-multi-agent/reviews/**` sang `docs/native-multi-agent/reviews/**`. Trước move phải inventory exact source/destination, xác nhận source ignored/untracked/unstaged, destination không collision, và giữ relative subtree. Không delete/overwrite evidence; conflict hoặc inability to preserve bytes là `BLOCKED(review_evidence_relocation_conflict)`. Sau move phải xác nhận new path ignored/untracked/unstaged và old path không còn residual evidence; review files không thuộc staged/committed scope.

Owner-verified inventory binds this move to the two exact files/hashes recorded above. SHA-256 is a one-time deterministic byte-preservation check for relocation, not a new provenance registry. After tracked and ignored artifacts are verified at the new root, search the entire repository for the literal old root, correct all active fixed paths/relative links/textual references including those inside the canonical Master Plan, prove the old directory contains no retained content, then remove it. Never delete first, overwrite destination content or treat ignored review files as commit candidates.

### NMA-WS2 — Root principle, routing và terminology migration

| Path | Thay đổi nhỏ nhất | Ownership boundary |
| --- | --- | --- |
| `AGENTS.md` | Bổ sung concise native-before-custom/ephemeral-before-persistent omission guidance và root route tới managed modes/native orchestration | Root invariant/routing only |
| `docs/agent-loops.md` | Thêm high-level NORMAL/MULTI_AGENT_MASTER_PLAN/MULTI_AGENT_E2E/OWNER_DECISION_REQUIRED routing và mandatory lifecycle Reviewer distinction | Lifecycle routing, confidence và stop only |
| `docs/agent-workflow/plan.md` | Migrate active adaptive terminology từ ambiguous reviewer wording sang Specialist while preserving historical scope | Adaptive semantic compatibility only |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | Migrate active Specialist wording và route managed-plan ownership without duplicating native lifecycle procedure | Planning procedure only |
| `.agents/skills/implementation-planning-and-pr-breakdown/references/specialist-plan-review.md` | Rename active role wording to Specialist and preserve advisory/permission/no-delegation semantics | Specialist plan consultation procedure |
| `.agents/skills/code-review-and-quality/SKILL.md` | Reserve Reviewer for full lifecycle review; preserve optional Specialist gate; route review artifact content ownership | Generic review procedure/taxonomy only |
| `.agents/skills/code-review-and-quality/references/specialist-review.md` | Rename `Reviewer behavior`/ambiguous uses to Specialist; preserve bounded read-only advisory contract | Specialist consultation only |

WS2 must not change historical `docs/**/implementation-plans/**` records other than the current Phase 2 artifacts. `review-report-templates.md` is audit-only and reused unchanged unless direct incompatibility is proven; terminology in historical evidence remains historical.

### NMA-WS3 — Native orchestration core contract

| Path | Thay đổi nhỏ nhất | Exact resource read condition |
| --- | --- | --- |
| `.agents/skills/native-multi-agent-workflow/SKILL.md` | New canonical owner for activation, modes, Main-only transition, roles, authority, status, freshness/session reuse, resource routing, evidence boundary and stop conditions | Always when managed workflow is selected or its contract is changed/reviewed |
| `.agents/skills/native-multi-agent-workflow/references/owner-source-and-steering.md` | Whole-entry capture/forwarding, revision/coverage admission, ambiguity, running-role quiesce/audit/resume and five Owner-change classes | Read before packaging Owner source, applying later steer, or handling scope/authority change |
| `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md` | Ledger fields, candidate/review identity, exact local artifact path, handoff admission, candidate stability, budgets, blockers and episode recovery | Read before opening/admitting a review round, routing findings/correction, resuming blockers, or reporting exhaustion |
| `.agents/skills/native-multi-agent-workflow/references/verification-scenarios.md` | Deterministic Phase 2 scenario matrix and bounded native-smoke protocol/claim limits | Read only when implementing, reviewing or verifying this skill/config and before any native smoke |
| `AGENTS.md` | Exact activation route to the new skill | Root routing only |
| `docs/agent-loops.md` | Route managed lifecycle details to the new skill; do not duplicate its state machine | Lifecycle overlay only |

`SKILL.md` must keep mandatory authority/permission/safety/ownership/stop rules in core. References exist because the detailed procedures have exact conditional consumers, not to hide required invariants or merely reduce line count. No eval runner, event store, manifest service, fingerprint registry, hash/provenance layer, scheduler, message bus, polling loop or custom transition executable is added.

### NMA-WS4 — Project-scoped native role profiles

| Path | Role/config contract |
| --- | --- |
| `.codex/config.toml` | `[agents]` is the single project owner of `default_subagent_model = "gpt-5.6-sol"`; enable native agents only if current schema/load check shows an explicit key is necessary; omit concurrency/audit settings without a concrete need |
| `.codex/agents/planner.toml` | `name`, `description`, `developer_instructions`, `model_reasoning_effort = "high"`, `sandbox_mode = "workspace-write"`; may write only assigned plan candidate |
| `.codex/agents/reviewer.toml` | Class A/high, `sandbox_mode = "workspace-write"`; candidate-read-only and may write only exact `expected_review_artifact_ref` |
| `.codex/agents/implementor.toml` | Class B/medium, `sandbox_mode = "workspace-write"`; may write only accepted implementation candidate and must report plan mismatch |
| `.codex/agents/specialist.toml` | Class A/high, `sandbox_mode = "read-only"`; advisory, one bounded question cluster, no agent delegation/verdict/transition |

Master Planner và Master Plan Correction dùng `planner` profile với phase-specific payload; không tạo duplicate profiles. Role files chỉ chứa stable role boundary và route tới repository-owned contract; không copy state machine, retry table hoặc Master Plan semantics. Parent runtime permission can further restrict a child; profile permission never expands Owner authority.

### Supporting verification/test scope

- Existing `.agents/scripts/validate-skill.mjs` và `.agents/scripts/validate-skill.test.mjs` là execution-only/audit-only. New skill core phải được scoped/progressive-disclosed để không require an allowlist snapshot change. Nếu validator/test behavior itself must change, stop for explicit scope amendment.
- Existing `.agents/evals/**`, agent-skill CLI harness and evaluation artifacts are excluded. Phase 2 deterministic scenarios are direct contract assertions plus native smoke, not a new eval suite/runtime.
- `docs/agent-workflow/problems.md`, `docs/agent-skills/**`, product/app/database/CI files and `review-report-templates.md` are audit-only unless a direct blocking conflict is proven and Owner approves revised scope.

## Ngoài phạm vi

- Phase 3 `NMA-WS5`, Phase 4 `NMA-WS6` hoặc Phase 5 `NMA-WS7` implementation.
- Product feature/UI/API, Supabase/schema/RLS/RPC, application tests/build/browser QA, deployment hoặc production behavior.
- Automatic swarm, concurrent writers, majority voting, model-based oracle hoặc malicious-subagent threat model.
- Custom runtime, database, durable event log, scheduler, harness V2, new CLI backend, provenance/fingerprint/hash registry or review-artifact store.
- Mass rewrite historical plans/checkpoints or republishing local review artifacts in Git.
- Model substitution, third automatic correction, unbounded retry/delegation, force-push, PR, merge or remote mutation.

## Authoritative relocation order và Phase 2 checkpoints

Owner-5 establishes this exact order; it supersedes the earlier relocation/checkpoint ordering:

1. Capture the complete Owner steer and use `owner_input_revision=6` with ordered refs owner-1 through owner-6.
2. Move and verify every retained artifact from `docs/agent-workflow/native-multi-agent/` to `docs/native-multi-agent/`: tracked master plan, current planning artifacts already at the destination, and the two exact ignored review files with their recorded SHA-256 values.
3. Search the whole repository for the literal `docs/agent-workflow/native-multi-agent`.
4. Update every active fixed path, relative link and textual reference that still targets the old root, especially the canonical Master Plan; preserve historical evidence semantics and do not mass rewrite history.
5. Inventory the old directory and prove it contains no file/content that must be retained.
6. Remove the now-empty old directory. This deletion is authorized only after steps 2–5 pass; collision, byte mismatch or retained content blocks deletion.
7. Run deterministic link/path/Git-scope checks, including ignored/untracked/unstaged review evidence and exact tracked candidate scope.
8. Spawn one fresh Master Plan Reviewer with the exact revised Master Plan, complete Owner Source Package and relocation ownership evidence. The Reviewer is candidate-read-only and writes only its exact preassigned local ignored review artifact; it must look for stale path/reference and ownership regression. The abandoned earlier Plan Reviewer round and its non-existent artifact are not evidence and must not be reused or cited.
9. Only an admitted `PASS` with `0 Critical / 0 Required` permits a local commit of the exact relocation/planning scope. Any blocker/finding returns through the bounded correction contract; no push/PR/merge is inferred.

After that authoritative relocation checkpoint, remaining Phase 2 implementation preserves `NMA-WS2 → NMA-WS3 → NMA-WS4`:

```text
CP0 exact-source/permission/base revalidation
  → CP1 authoritative relocation steps 1–7
    → CP1R fresh Master Plan Reviewer step 8
      → CP1C PASS then exact relocation/planning commit step 9
        → CP2 NMA-WS2 terminology/routing foundation
          → CP3 NMA-WS3 canonical orchestration skill/resources
            → CP4 NMA-WS4 project config/profiles + static load/boundary checks
              → CP5 bounded native smoke + cumulative review + truthful progress update
                → final Phase 2 local checkpoint commit when all remaining gates pass
```

- CP1/CP1R/CP1C precede WS2 so every current/future link, review artifact and progress record uses the Owner-approved feature-level path and the Master Plan Reviewer has independently checked relocation ownership before its commit.
- WS2 must precede WS3 because the orchestration skill consumes canonical modes and collision-free role vocabulary.
- WS3 must precede WS4 because profiles consume, but do not own or duplicate, orchestration/permission contracts.
- Shared owners are changed sequentially. No two writer roles run concurrently; Reviewer begins only after candidate freeze and author pause.
- Phase 3/4 cannot begin until Phase 2 gate is fully satisfied. Static success without required native smoke is not completion.

## Acceptance criteria

### Relocation/durable docs

1. Tracked master plan is at `docs/native-multi-agent/plan.md`; repository active links resolve; `docs/agent-workflow` retains only adaptive ownership plus compatibility link/boundary.
2. `docs/native-multi-agent/progress.md` exists and truthfully separates `planned`, `approved`, implementation permission, `implemented`, `verified`, `committed`, `pushed`, `PR open`, `merged`, native-smoke state and blockers.
3. The two inventoried local reviews retain exact relative paths and exact recorded SHA-256 values under `docs/native-multi-agent/reviews`; new path is ignored, untracked and unstaged; no review artifact is committed. No evidence is deleted or overwritten.
4. Historical evidence text is not rewritten merely for new terminology/path; only active links/compatibility statements change.
5. Repo-wide literal old-root search is clear after active reference correction; old directory removal happens only after an empty/no-retained-content proof.
6. One fresh Master Plan Reviewer reviews the exact revised Master Plan plus relocation ownership, reports no stale-path/ownership blocker and returns an admissible `PASS` before the relocation/planning commit.

### WS2

1. Root-to-lifecycle-to-native-skill routing distinguishes all four modes by outcome/ownership/dependency/risk, not file count.
2. Reviewer means mandatory full lifecycle reviewer; Specialist remains optional, bounded, advisory, caller-owned and cannot transition or verdict.
3. Reviewer may consult one justified Specialist but still completes every required review dimension/verdict itself.
4. Existing Specialist permission, fixed context, no-recursion, `not_run`/`Blocked` and main reconciliation invariants do not regress.
5. Root guidance prefers native composition and ephemeral state; omitted custom persistence/crypto/audit/generalization does not weaken required correctness or evidence claims.

### WS3

1. Exactly one new skill owns Main ledger/events, ordered Owner Source Package, freshness/session reuse, quiescent steer, handoff/review artifact, candidate stability, correction budget, blockers and Owner gates.
2. Every managed role echoes `owner_input_revision` plus ordered refs before substantive work; missing/truncated/unreadable/ambiguous source fails loud.
3. Main alone transitions; child only recommends. Reviewer artifact is exact preassigned single file, local-only and identity-bound; no latest/glob/mtime selection.
4. Initial review is round 0; only completed correction+rereview consumes budget; no automatic round 3; BLOCKED does not consume a round.
5. Candidate movement, reviewer out-of-scope write, Git-scoped artifact, stale/crossed handoff, unavailable session/model and unsynchronized steer each produce the exact blocking disposition.
6. Exact start/end path/existence/byte comparison covers tracked, already-dirty and untracked candidate cases without persisting a fingerprint system.

### WS4/native smoke

1. Current Codex config parses/loads all four project profiles; model/effort mapping has one project config owner and unavailable required model fails without substitution.
2. Planner/Implementor can write only assigned candidates; Reviewer can write only exact review artifact and cannot mutate candidate; Specialist is filesystem read-only.
3. Bounded repository-context smoke observes fresh zero-history initial roles, native identity/status, same-session follow-up, interrupt/quiesce plus state audit plus same-session resume, exact Owner steer propagation, same Reviewer rereview, exact artifact write and one-level Reviewer→Specialist consultation.
4. Specialist result returns to Reviewer; Reviewer independently integrates full verdict; Main alone admits artifact/handoff and transitions.
5. Smoke rechecks review path ignored/untracked/unstaged and tracked/already-dirty/untracked candidate stability. Live delivery success alone is never evidence of before-next-action authority delivery.
6. Runtime observation remains compatible with `A. LIVE_STEERING_SUPPORTED`; otherwise Phase 2 is BLOCKED and no custom fallback is introduced.

## Deterministic verification

Run the smallest current commands that establish each claim; record exact command/result in `docs/native-multi-agent/progress.md`.

1. Git/baseline/scope: `git status --short --branch`, ancestry checks against `62cf52879eff2cbd569b9ae43bee31e445a33c4f`, `git diff --name-status`, `git diff --cached --name-status`, `git ls-files` for expected paths and review-path exclusion.
2. Relocation: repo-wide exact-literal `rg` for the old root before and after correction; Markdown relative-link resolver; exact path/SHA-256 inventory before/after tracked and ignored moves; old-directory no-retained-content proof; `git check-ignore -v` plus tracked/staged audits for `docs/native-multi-agent/reviews/**`.
3. Skill structure: `node .agents/scripts/validate-skill.mjs` and `node --test .agents/scripts/validate-skill.test.mjs`; diagnostics must remain truthful, with no unapproved new warning snapshot.
4. Static contract matrix from `verification-scenarios.md`: mode routing, Reviewer/Specialist distinction, Owner package admission, five Owner-change classes, review rounds 0/1/2/exhaustion, blocker non-consumption, candidate-moved/scope/Git-artifact violations, no model fallback and no forbidden custom mechanism.
5. Config: recheck official/current local schema, parse each TOML using current Codex load path, enumerate profile identity/model/effort/sandbox boundary and confirm no duplicated lifecycle contract.
6. Hygiene: strict UTF-8, final newline, trailing whitespace, balanced Markdown fences/tables, conflict/zero-width/secret-oriented scan, `git diff --check` and exact changed-file audit.

Application build/browser/Supabase/database/CI/deployment checks are `not applicable` unless actual diff violates scope and reaches those domains; that violation is a stop, not a reason to silently run broader implementation.

## Native smoke protocol và review artifact boundary

- Gate before dispatch: Main records current authority, fixed roles/questions/actions, maximum spawned roles/turns, expected artifact destination, candidate scope, start snapshot and stop conditions. No smoke begins without explicit current native-call permission.
- Use native project profiles only. Do not use `codex exec`, agent-skill eval CLI, custom scripts, another backend or a database as orchestration substitute.
- Fresh initial role receives zero inherited task history plus complete exact Owner Source Package. Same author/Reviewer sessions are reused for correction/rereview and interrupt/resume.
- Preassign `docs/native-multi-agent/reviews/<workflow_id>/<episode_id>/<candidate_revision>-review-r<review_round>.md`. Reviewer is paused/blocked if this path is not ignored or if any path outside it changes.
- Freeze candidate writers during review; exact-compare candidate path/existence/bytes immediately before verdict admission. Handoff identifiers and artifact `Review Identity` must match open ledger exactly.
- Reviewer→Specialist is exactly one consultation depth. Specialist receives only bounded question/context, writes nothing and returns no lifecycle status/verdict.
- Bound execution; no busy polling or retry without observed state change. External/platform/model/config absence produces `BLOCKED`, does not weaken the gate.
- Preserve local review artifacts after smoke. Owner-5 authorizes removal of only the proven-empty old directory after relocation/reference checks; it does not authorize deleting review evidence at the new root. Commit permission excludes all review artifacts.

Smoke evidence is native runtime observation in this repository and exact session only. It does not prove filesystem isolation, malicious-agent resistance, future platform behavior, automatic routing in every client, cross-workspace retention or production readiness.

## Progress update contract

`docs/native-multi-agent/progress.md` is created at CP1 and updated after each real checkpoint only from observed evidence:

- Phase/WS status and dependency gate;
- exact branch/base/head and clean/dirty/staged/untracked state;
- action permission granted/consumed/not granted;
- actual changed files and local review-artifact exclusion;
- deterministic command results, native smoke identity/outcomes and limitations;
- review findings/verdict, resolved corrections, remaining blocker;
- commit hash/message only after the authorized commit exists;
- `pushed`, `PR open`, `merged` remain `no` unless later separately authorized and observed.

The detailed plan owns future requirements; progress owns current truth. Do not copy current status back into adaptive progress or mark Phase 2 complete from plan/checklist presence.

## Risks, mitigations và blockers

| Risk/blocker | Impact | Mitigation / earliest gate |
| --- | --- | --- |
| Old/new review destinations both contain data | Overwrite or evidence loss | Verified no-collision baseline; recheck at CP1 and block on drift, no overwrite |
| Relocation leaves stale active link/duplicate feature owner | Two canonical locations or broken routing | CP1 targeted path/link/ownership audit |
| Terminology migration changes Specialist semantics | Optional advice becomes mandatory verdict/transition | WS2 scenarios and formal cross-owner review |
| Core/reference split omits mandatory invariant | Fresh caller misses permission/stop rule | `maintain-repo-skills` core-boundary review and validator |
| New skill triggers unapproved validator snapshot change | Test no longer represents repository contract | Keep core concise without hiding rules; stop for test-support amendment |
| Config schema/model drift | Profiles do not load or silently downgrade | Current official/local schema check; fail `BLOCKED`, no substitution |
| Reviewer workspace-write is broader than semantic permission | Candidate/out-of-scope mutation | Preassigned artifact, serialized writers, pre/post scope and candidate byte audits |
| Live steer arrives after protected action | Wrong authority applied | interrupt/quiesce, audit actual state, same-session resume; report already-completed action |
| Native smoke permission/runtime unavailable | Static docs cannot prove Phase 2 gate | Record `not_run`/`BLOCKED`; dependent phase stays closed; no custom fallback |
| Historical evidence is mass rewritten | Audit trail becomes false | Update active links/owners only; keep historical text intact |

## Stop conditions

Dừng trước phần phụ thuộc khi:

- exact detailed plan/material decision chưa được Owner approve;
- actual branch/base/dependency/dirty ownership differs materially;
- review evidence cannot move with exact hashes/path preservation, destination collides, or evidence would enter tracked/staged scope;
- repo-wide old-root references remain, old directory retains content, or fresh Master Plan Reviewer cannot reach an admissible PASS;
- required change touches a path outside exact scope, including validator/eval/CI/product/database runtime;
- current config schema, required model, same-session interrupt/resume, exact artifact write or candidate-stability check is unavailable;
- role cannot obey candidate/artifact writer boundary;
- native-call permission is absent for mandatory smoke;
- static/native evidence fails, is skipped, stale or cannot support the completion claim;
- plan review leaves `Critical`/`Required`, or repository reality challenges approved Master Plan semantics.

## Implementation handoff

### Approved goal source

- Owner-approved native Master Plan revision 8 / GOAL revision 1, plus exact Owner Source Package revision 6 with ordered refs `[owner-1, owner-2, owner-3, owner-4, owner-5, owner-6]`.

### Required order

- CP0 → exact owner-5 relocation steps 1–7 → fresh Master Plan Reviewer → PASS then relocation/planning commit → `NMA-WS2 → NMA-WS3 → NMA-WS4` → native smoke/cumulative review → final authorized local checkpoint commit.

### Writer boundaries

- Planner/Implementor: assigned candidate paths only.
- Reviewer: candidate-read-only; exact `expected_review_artifact_ref` is its sole writable path.
- Specialist: read-only, no delegation, no verdict/transition.
- Main: admission/transition/ledger owner; does not adjudicate detailed findings.

### Completion boundary

Phase 2 relocation may be committed only after exact steps 1–9 and fresh Master Plan Reviewer PASS. Full Phase 2 is complete only when durable progress ownership, WS2/WS3/WS4 acceptance, deterministic checks, required native smoke, artifact/candidate/Git-boundary audits and formal cumulative review all pass with `0 Critical / 0 Required`; progress reflects actual state; then the remaining coherent local checkpoint may be committed under Owner-1. Neither commit grants push/PR/merge.

Recommended commit message after completion: `feat(native-multi-agent): establish phase 2 orchestration foundation`

## Main plan self-review

- Sizing: large/high-risk because this phase changes root/lifecycle/skill governance, introduces role configuration, moves canonical documentation and depends on live native semantics.
- Dependency/order: owner-5 exact relocation/review/commit sequence and later `WS2 → WS3 → WS4` are explicit; no parallel shared writers.
- Ownership: master plan, progress, phase plan, adaptive compatibility sources, new skill, role config and review artifacts have non-overlapping owners.
- Scope: exact required paths, audit-only sources and stop-on-expansion boundary are explicit; no custom runtime/database/harness.
- Permission: plan decision, implementation, native-call, Reviewer artifact write, commit and remote actions remain separated.
- Verification: deterministic checks and native smoke have distinct claim boundaries; skipped/unavailable smoke cannot become PASS.
- Findings after correction: `0 Critical`, `0 Required`; detailed plan remains `pending owner decision` because self-review cannot approve it.
