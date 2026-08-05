# Tiến độ chương trình quản trị agent skill của VocaSpace

## Chương trình

Lập durable plan và rollout theo từng giai đoạn cho repo-local agent-skill governance, progressive disclosure, deterministic structural validation, synthetic evaluation và evidence-gated pilot.

Master plan: [plan.md](./plan.md).

## Trạng thái hiện tại

**ASM-PR1 và ASM-PR2A–ASM-PR2C đã merge. ASM-PR3 implementation CP2–CP8 và final review đã hoàn tất tại `0 Critical / 0 Required`, normal-pushed và mở PR #70; initial checks pass trên reviewed head `43392a3`. Owner chọn CP9 `continue` ngày `2026-08-05`, chấp thuận pilot outcome, và separately authorize bounded durable-status correction commit + normal push này. PR #70 vẫn open; merge và ASM-PR4 implementation chưa được cấp, và ASM-PR4 còn dependency-blocked tới khi PR #70 merge.**

File này là current-status source của chương trình. Master plan sở hữu intended scope, dependency và decision status đã được label approved/proposed. Repository và Git evidence luôn authoritative hơn tracker này.

## Current ASM-PR3 implementation-branch setup checkpoint

- Current branch/base: `feat/agent-skills-asm-pr3` từ synchronized `main == origin/main == 9a44f5082242a982e487eb7d0c4e03068cf5af93`; pre-correction `HEAD` và merge-base đều bằng branch baseline này.
- Historical planning delivery: `docs/agent-skills-asm-pr3-planning` commit `684b821` đã merge qua PR #69 tại `9a44f50`; remote planning branch đã được prune.
- Immutable behavioral baseline: ASM-PR2C merge `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb` theo roadmap.
- Baseline reconciliation: `frontend-design` core và suite trio có cùng exact Git blob tại `81f6c32`, `06d8d5b` và `9a44f50`; PR #68 và planning PR #69 không đổi bốn artifact này.
- Discovery: complete cho master/roadmap/progress/index, current `frontend-design` bundle, frozen `6/8/4 = 18` suite cases, runner/validator contract, target five-reference bundle, baseline/evidence/rollback và permission gates.
- Starting verification: Node `v24.11.1`; focused `frontend-design` validation `3 files / 18 cases / 0 diagnostics`; cumulative `9 skills / 27 files / 177 cases / 0 diagnostics`; structural validator `11 skills / 0 errors / 4` existing warnings.
- Planning verification/review: focused `1/3/18/0`, cumulative `9/27/177/0`, structural validator `11/0/4`; link/UTF-8/no-BOM/newline/fence/exact-18-case/five-reference/scope/secret/conflict-marker/`git diff --check` audits pass. Main plan review corrected two `Required` authority/current-status findings and one exact-inventory `Suggestion`; final re-review `0 Critical / 0 Required`, specialist `0`, fresh-reader `not_run`.
- Detailed plan: [ASM-PR3 plan](./implementation-plans/asm-pr3/plan.md), planning artifact merged; local implementation CP2–CP8 `complete`, CP9 owner pilot decision `continue`, PR #70 merge `pending`.
- Owner decision: [owner-review-brief.md](./implementation-plans/asm-pr3/owner-review-brief.md), local implementation/checkpoint/fresh-reader/final-push boundaries explicitly granted.
- Current action state: CP2–CP8 implementation, original final push, PR #70 creation and initial CI watch are complete. Current owner instruction authorizes this bounded CP9 durable-status correction, correction commit and normal push; after delivery no standing Git/remote authority remains.
- Ungranted: merge, ASM-PR4 implementation, frozen suite correction, tooling/CI/package/product/DB scope, further PR metadata/CI-fix action, deployment, database/production, destructive and history action.
- Specialist: `0`; direct evidence resolved planning uncertainties, and mandatory implementation fresh-reader completed in CP7.
- CP1: complete; owner implementation/checkpoint/fresh-reader/final-push instruction recorded without expanding PR/CI/merge scope.
- CP2: complete; clean base `9a44f50`, local `main == origin/main` divergence `0/0`, protected skill/suite blobs unchanged through planning merge, focused `1/3/18/0`, cumulative `9/27/177/0`, structural `11/0/4`, 18 cases / 54 context entries present, zero future-reference leak, frozen skill/suite diff empty; self-review `0 Critical / 0 Required`.
- CP3: complete; the immutable monolith baseline produced 18 valid bounded read-only observations, all human-evaluated as passing with no safety veto. One incomplete operator-packaging attempt was excluded and independently rerun; raw evidence remains transient. Self-review `0 Critical / 0 Required`.
- CP4: complete; `frontend-design` is one core plus the exact five approved direct references. Reference bodies are byte-equivalent to the moved monolith sections after heading removal; core retains mandatory routing, cross-cutting safety and reporting behavior. Self-review `0 Critical / 0 Required`.
- CP5: complete; validator `37/37`, runner `130/130`, structural `11/0/4`, focused `1/3/18/0`, cumulative `9/27/177/0`, bundle/link/UTF-8/newline/fence/reparse/scope/frozen-blob and `git diff --check` audits pass. Self-review `0 Critical / 0 Required`.
- CP6: complete; formal immutable comparison has 18/18 candidate passed, 18/18 equivalent, 18/18 evidence complete, no veto, and idempotent report SHA-256 `fcd7c7e1fcf473903d36c3583993d1bad3a9e5610a9299e857027f01227640f6`. A first Teacher-local pair remains disclosed as operator-ambiguity variance; identically clarified replacement readers passed. Self-review `0 Critical / 0 Required`.
- CP7: complete; all four mandatory fresh-reader cases pass. Learning selected core+Learning (`-99` lines / `-1,300` bytes vs monolith), Admin+Shared selected exactly core+Admin+Shared (`-90` / `-950`), Teacher-local selected core+Teacher and skipped Shared (`-96` / `-1,416`), non-UI selected core and no reference (`-135` / `-2,366`). Evidence is executor self-report and does not prove token savings, native routing or isolation. Self-review `0 Critical / 0 Required`.
- CP8: complete; final nine-file branch diff matches approved ownership, frozen and excluded scopes are empty, transient evidence is removed, final deterministic rerun remains `37/37`, `130/130`, `11/0/4`, `1/3/18/0`, `9/27/177/0`, and main review ends `0 Critical / 0 Required`. No correction was required.
- CP9: owner decision `continue` recorded on `2026-08-05`; pilot outcome approved. PR #70 remains open and merge is pending; this decision does not authorize merge or ASM-PR4 implementation.
- Skill implementation: ASM-PR3 complete through the owner pilot decision; delivery dependency remains PR #70 merge. ASM-PR4 remains blocked on that merge and separate implementation/Git/remote permission.

## Historical cumulative correction checkpoint before PR #68 merge

- Branch/base: `audit/agent-skills-pr2abc-eval-contracts` từ synchronized `main == origin/main == 81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb`.
- Owner permission: exact correction plus conditional delivery only after `0 Critical / 0 Required` and passing verification; one commit, normal push, non-draft PR, initial CI watch, and at most one logged `branch-caused-small-safe` fix attempt. Successful delivery consumes the grant. Merge/auto-merge, deployment, database/model, destructive, force-push, history-rewrite and scope-expansion actions remain ungranted.
- Affected semantic cases: exactly 20; frozen identity remains 177/177 IDs and prompts, exact per-skill counts, routes and future-reference ownership.
- Durable status: ASM-PR2A/2B/2C historical grants consumed; PR #65/#66/#67 merged; old `OPEN`, pre-delivery và unconsumed-authority wording không còn là current state.
- Evidence boundary: synthetic preparation is not enforced isolation; the runner does not execute or grade a model. Fresh-reader for the corrected 20-case artifact is `not_run`; readers from the preceding audit supplied finding claims but are not relabeled as post-correction evidence.
- Final gate: refreshed deterministic verification and full main integration review must reach `0 Critical / 0 Required`; this document does not predict that verdict or the delivery identifiers it may enable.

## Historical ASM-PR2B status trước PR #66 merge

**ASM-PR2B SSM executor-observability correction đã được implement, deterministically verified, committed và normal-pushed tại `bbf0d79d7fd2a5d198f179a77a537720544b9b7c` trên `feat/agent-skills-asm-pr2b`. Audit đủ 22 SSM cases phân loại `2 confirmed / 6 partially confirmed / 14 rejected`; 8 affected cases nhận smallest neutral SQL source contexts, catalog tăng `39 → 42`, frozen 57-case contract giữ nguyên. Focused SSM validation `22/22`, runner `130/130`, structural validator `37/37`, cumulative validation 5 skills/15 files/94 cases/0 diagnostics. Local/upstream/actual remote đồng bộ `0/0`; semantic correction authority consumed. Không CI edit, PR/CI operation, model/DB action hoặc history rewrite.**

## Trạng thái phê duyệt

- Historical foundation PR 1 decision bundle: owner đã duyệt trong instruction ngày 2026-07-14.
- PR 2 Node/MJS + frontmatter v1 decision bundle: owner instruction ngày 2026-07-15 cho phép implement đúng proposal nếu reviewed small-enough gate pass; [PR 2 plan](./pr-2-structural-validator-plan.md) ghi `Implementation decision: proceed`.
- PR 2 local implementation: đã được cho phép và đã thực hiện; self-review gate không tự cấp action permission mà chỉ thỏa điều kiện owner đặt trước.
- Historical foundation PR 3A/3B decision bundle: owner đã duyệt; dependency là `historical foundation PR 2 → PR 3A → PR 3B → future consumer discovery`, và historical foundation PR 3 chỉ complete sau PR 3B merge.
- PR 3A implementation, review-correction, push, PR và merge permissions là historical và đã consumed; branch/pre-PR state cũ không còn là current delivery state.
- Historical instruction ngày 2026-07-26 authorize PR 3B CP1–CP4 implementation trong exact eight-file scope, deterministic local verification, coherent checkpoint commits và normal push.
- PR creation/initial CI-watch permission đã được cấp và consumed khi PR #62 được mở và initial checks được theo dõi.
- Owner correction instruction ngày 2026-07-28 đã được consumed qua hai correction commits `52230f771bb6232c2952937a28f21f2c021c0501` và `0aceabad1eeb69ea8d43bcff2312b5461aebf254`, normal pushes và correction-head CI watch. PR #62 sau đó đã merge; các delivery permission này là historical và không cấp quyền cho phase mới.
- Owner đã duyệt structural-migration program gồm ASM-PR1, ASM-PR2A, ASM-PR2B, ASM-PR2C, ASM-PR3, ASM-PR4, ASM-PR5A, ASM-PR5B và ASM-PR6 theo exact sequential dependency.
- Historical ASM-PR3 planning instruction ngày `2026-08-05` authorize sync local `main`, tạo discovery/planning branch, investigate và lập detailed plan; planning commit `684b821` sau đó merge qua PR #69 tại `9a44f50`.
- ASM-PR3 setup/correction instruction đã tạo branch và delivery commit `d58d8b9289580463175af65593e2b5d2223d3cac`; local/upstream synchronized `0/0` trước implementation.
- Current ASM-PR3 implementation instruction authorize CP2–CP8, self-review mỗi CP, coherent checkpoint commits, bounded read-only fresh readers và một final normal push. Nó không authorize frozen-suite correction, tooling/CI/package/product/DB scope, push trước final review, PR/CI/merge, deployment, database/production, destructive hoặc history action.
- Owner đã duyệt candidate allocation, `frontend-design` pilot, 6/9/12 suite-file split, CI `validate --all` chỉ ở ASM-PR2A, separate ASM-PR5A/ASM-PR5B và isolated final Supabase migration.
- Owner đã cấp program-level default cho bounded advisory read-only fresh readers khi materially useful; mandatory cho mọi migration PR. Default này không cấp implementation hoặc bất kỳ Git/remote/CI/database action nào.
- ASM-PR1 implementation/delivery permissions đã consumed; PR #64 merged. Merge evidence là dependency, không tạo standing authority cho ASM-PR2A.
- Original ASM-PR2A planning instruction đã được consumed qua commit `f6dae70d7c8faadfe83b7a29109cbc4708620724` và normal push; local/upstream synchronized trước correction hiện tại và không còn standing authority từ grant đó.
- Historical ASM-PR2A planning correction grant đã consumed qua commit `152519eb210f3219e2471f51dd7d988454f1f275`; CP2–CP5 implementation/delivery và later exact four-file review-correction grants cũng đã consumed. Không có standing ASM-PR2A authority.
- PR #65 / ASM-PR2A merged tại `3cdbb440d7068c5280750f650cf0680a1992f3e0`. Mọi ASM-PR2A branch/implementation/correction/commit/push authority là historical và consumed; merge evidence chỉ thỏa dependency, không cấp standing authority cho ASM-PR2B.
- Historical ASM-PR2B instruction cấp CP0 sync/branch, exact four-file discovery/planning/self-review, một coherent planning commit và một normal push; bounded recovery instruction cấp exact planning correction, tối đa một correction commit và một normal push. Cả hai grant đã consumed. Không có standing authority; suite implementation, skill/reference/runner/schema/test/CI/package/product/migration/database edit, model execution, PR/CI watch-fix, merge, deploy, production/DB action và history rewrite đều chưa được cấp.
- Historical ASM-PR2B CP2–CP5 instruction đã duyệt frozen 57-case plan và authorize suite implementation, truthful plan/brief/progress reconciliation, coherent checkpoint commits và một final normal push. Grant này đã consumed qua các checkpoints kết thúc tại CP5 `7dec9a1`; không cấp standing PR/CI watch-fix, merge, deploy, model/DB action hoặc history rewrite authority.
- Historical SSM executor-observability instruction đã authorize investigation trên đủ 22 SSM cases, smallest confirmed context correction trong sáu exact writable paths, truthful durable-state update, một coherent correction commit và một normal push. Grant đã consumed tại `bbf0d79`; không authorize case/route/criterion/veto/variant/reference redesign, skill/reference/runner/schema/test/CI/product/migration/database edit, model/DB execution, PR/CI/merge/deploy hoặc history rewrite.

- ASM-PR2B / PR #66 đã merge vào `main` tại `d61d64124ce8adb8f57b835ef4f8d95d787679ea`, với merged head `367653d7ec768683bdd73864d4701e309a726dfc`. Mọi ASM-PR2B planning, implementation, correction, commit và push grant là historical và đã consumed; merge evidence chỉ thỏa dependency ASM-PR2C.
- Historical ASM-PR2C planning instruction authorized safe sync, branch creation, discovery, planning delivery, one commit and one normal push. Grant đó đã consumed và không tạo standing authority.
- Historical ASM-PR2C external-finding correction instruction đã được consumed qua commit `c95c4caba92d7de601e4e4d325402d41f885aeee` và normal push; không tạo standing authority.
- Historical ASM-PR2C remaining-finding correction instruction đã được consumed qua commit `37d45d9466dd511c2dc34e313ddee9378ade869b` và normal push. Grant không authorize suite implementation, allocation/ID/primary-owner/reference-ownership redesign, PR/CI operation, model execution, database/deployment/destructive/history action và không tạo standing authority.
- Historical owner instruction ngày 2026-08-01 approved exact 83-case ASM-PR2C plan và authorized CP2–CP6 implementation trong exact twelve-suite plus three-document reconciliation scope, coherent checkpoint commits, normal pushes, và supported checkpoint corrections. Grant đã consumed through `fe4c1e1eed121a1a90447164940961da5d22cb05` và không tạo standing authority.
- Historical PR creation/initial CI-watch instruction đã được consumed khi PR #67 được tạo và checks của head `fe4c1e1eed121a1a90447164940961da5d22cb05` được theo dõi tới terminal passing. Single authorized CI fix attempt không được dùng; merge không được cấp.
- Historical semantic-audit correction instruction đã consumed qua commit `5185b8da0988377a417dba9803ac99fa86fdb4eb` và normal push; pre-finalization local/upstream/actual remote synchronized `0/0`, clean.
- Historical finalization instruction authorized đúng ba durable docs, one docs-only commit/push, final-head CI watch, PR-body update và final re-review. Chuỗi đó đã hoàn tất trước khi PR #67 merge và grant đã consumed.

## Historical ASM-PR2C branch

```text
feat/agent-skills-asm-pr2c
```

Branch này được tạo trực tiếp từ synchronized `main == origin/main == d61d64124ce8adb8f57b835ef4f8d95d787679ea` sau `git fetch origin`, `git switch main` và `git pull --ff-only origin main` ngày 2026-08-01. Branch bắt đầu đúng tại merge commit PR #66, không stack trên unmerged feature branch.

## Historical ASM-PR2C discovery and planning evidence

| Evidence | Giá trị |
| --- | --- |
| Ngày sync | `2026-08-01` |
| Pre-sync branch/HEAD | `feat/agent-skills-asm-pr2b` at `367653d7ec768683bdd73864d4701e309a726dfc`; worktree/index/untracked set clean |
| Local main trước/sau sync | `3cdbb440d7068c5280750f650cf0680a1992f3e0` → `d61d64124ce8adb8f57b835ef4f8d95d787679ea` |
| Pre-sync tracking/actual remote main | Both `d61d64124ce8adb8f57b835ef4f8d95d787679ea`; local `main` divergence `0/10` |
| Main update | `git fetch origin`; `git switch main`; `git pull --ff-only origin main`; final local/tracking divergence `0/0` |
| Post-sync remote agreement | Local `main`, refreshed `origin/main`, and actual remote `main` all `d61d64124ce8adb8f57b835ef4f8d95d787679ea` |
| Existing ASM-PR2C state before branch | No local branch, remote branch, tracked plan directory, staged/unstaged/untracked planning state, or other worktree |
| Planning branch | `feat/agent-skills-asm-pr2c`, created directly from synchronized local `main`; initial merge-base and HEAD equal baseline |
| PR #66 dependency | GitHub `MERGED`; base `main`; head `367653d7ec768683bdd73864d4701e309a726dfc`; merge `d61d64124ce8adb8f57b835ef4f8d95d787679ea` |
| Starting suite baseline | `node .agents/scripts/run-skill-evals.mjs validate --all`: `valid`; 5 configured skills, 15 suite files, 94 cases, 0 diagnostics |
| Candidates | `implementation-planning-and-pr-breakdown`, `code-review-and-quality`, `git-checkpoint-workflow`, `github-pr-ci-workflow` |
| Proposed allocation | Planning `8/6/4 = 18`; review `9/6/5 = 20`; local Git `10/6/5 = 21`; GitHub/CI `11/7/6 = 24`; total `83` |
| Corrected executor contract | `83/83` case IDs map exactly once to unchanged frozen, sufficient, neutral `executor_input.prompt` values; prompt-string uniqueness is not required, and duplicates are valid only when the rest of the executor-visible package genuinely differentiates the cases |
| Corrected planning-reference contract | Full 18-row audit changed only `ippb-reg-durable-plan-owner-gate` and `ippb-fresh-tracked-pending-stop` to `P-TRACKED`; both skip `P-HANDOFF,P-QA,P-SPECIALIST`; the other seven `P-HANDOFF` selections remain justified by slicing, PR breakdown, acceptance in a transferable brief, or transferable handoff work |
| Corrected CI taxonomy package | `db-risk`, `secret-env-config`, `infra-flaky`, `unrelated-main`, `branch-caused-large-risky`, `unclear` each have separate neutral failed-log evidence and must stop before edit/validation-as-fix/commit/push/PR mutation/post-fix re-watch/merge/other self-fix; only `branch-caused-small-safe` remains eligible |
| Implementation write contract | CP2–CP5 trio labels cover only the active suite implementation boundary; truthful `plan.md` / `owner-review-brief.md` / `progress.md` reconciliation is allowed by exact current permission, no other candidate trio changes, each checkpoint is independently revertible, and implementation-plan `README.md` remains audit-only; CP6 is limited to the accumulated exact 12 suites plus those 3 docs |
| Discovery | `complete`: master/roadmap/progress, all four candidates, 16 approved future references/read/skip conditions, suite schema/runner/validator/CI, and ASM-PR2A/2B precedents inspected |
| Detailed plan | [ASM-PR2C plan](./implementation-plans/asm-pr2c/plan.md), `owner approved` |
| Owner review | [owner-review-brief.md](./implementation-plans/asm-pr2c/owner-review-brief.md), approval recorded |
| Suite implementation | `complete`; exact 12 files/83 cases through CP2–CP5, CP6 cumulative verification/review complete |
| Fresh-reader / specialist | `not_run` / `0`; direct evidence and main review resolved all material ambiguity; no model execution |
| Conditional runner/validator tests | `not_run`: suite implementation exposed and depended on no unestablished tooling behavior |
| Planning verification | Node `v24.11.1`; cumulative validation `valid` for 5 skills/15 files/94 cases/0 diagnostics; correction audit: 83/83 IDs have exactly one unchanged prompt mapping, 12/12 lexical suite groups, 25/25 routing classifications, 83/83 physical ownership, 47/47 exact packages used, 9/9 context paths, 16/16 roadmap references, full 18-row planning-reference audit, six/six CI stop states and forbidden-action contract; link/table/heading/fence/UTF-8/newline/whitespace/conflict/zero-width/secret/absolute-path/raw-evidence/exact-three-file scope and `git diff --check` pass |
| Planning review | Initial first pass `0 Critical / 11 Required`, re-review `0/0`; external-finding correction review `0 Critical / 4 Required / 1 Nit`, final re-review `0/0`; remaining-finding correction review `0 Critical / 3 Required / 1 Suggestion`, Claims A–D all `correct in scope`, final re-review `0 Critical / 0 Required`; verdict ready for owner decision only |
| Planning correction delivery checkpoint | Complete at `37d45d9466dd511c2dc34e313ddee9378ade869b`; local/upstream/actual remote synchronized before CP2 started |
| Historical permission | Exact ordered docs-only reconciliation commit/push, final-head CI watch, PR-body update và final re-review; consumed before PR #67 merge |

## ASM-PR2C CP2–CP6 implementation checkpoint

- CP2 planning `8/6/4 = 18`: `ce5068e260a2a323f5936b0b4890fb59265f425a`.
- CP3 review `9/6/5 = 20`: `0ec7ea1e73dbad7ecd015422efb3df7b2d8b428d`.
- CP4 local Git `10/6/5 = 21`: `22240314d2177b7eda58d3740ae9f1d07e5105fd`.
- CP5 GitHub/CI `11/7/6 = 24`: `17d2b68839e0a8e0adeaae10612000180ab67d86`.
- Mỗi CP2–CP5 commit đã normal-push; local/upstream/actual remote synchronized `0/0`, worktree/index clean trước khi checkpoint sau bắt đầu.
- CP6 focused validation `18/20/21/24`; cumulative `validate --all` valid cho 9 skills/27 files/177 cases/0 diagnostics.
- Pre-semantic-correction CP6 frozen-contract audit pass: exact 12 files/83 cases, `38/25/20`, prompts/packages/reference applicability `83/83`, contexts `47/47`, routes `25/25`, physical ownership, evaluator secrecy, P0, lexical/global IDs, UTF-8/final-newline, exact scope, empty CI diff và `git diff --check`.
- CP6 review ban đầu `0 Critical / 1 Required` vì duplicate veto ID; correction đổi `crq-reg-approval-never-grants-action` sang veto ID `crq-approval-any-ungranted-action`; full rerun và final review `0 Critical / 0 Required`.
- Fresh-reader/model execution `not_run`; specialist `0`; runner/validator tests `not_run`; không có product/build/browser/database test hoặc action.
- Final CP6 reconciliation commit/push complete tại `fe4c1e1eed121a1a90447164940961da5d22cb05`; pre-correction local/upstream/actual remote agreement `0/0`, worktree/index clean.
- Historical initial PR state: PR #67 was `OPEN`; inspected head `fe4c1e1` checks terminal passing và `mergeStateStatus=CLEAN`. Local checkpoint runner/validator tests were `not_run`, nhưng GitHub Actions run `30704128692` pass các test steps; model/fresh-reader execution remained `not_run`.
- Semantic correction delivery: commit `5185b8da0988377a417dba9803ac99fa86fdb4eb` normal-pushed; 25 routing `forbidden_behavior` entries describe invalid outcomes; nine substantive packages receive six neutral facts; context catalog `53/53`; correction-head run `30876909878` terminal passing.
- Historical pre-merge correction verification: focused `18/20/21/24`, cumulative `9 skills / 27 files / 177 cases / 0 diagnostics`, skill validator `11 skills / 0 errors / 4` existing warnings, `git diff --check`, 14/14 semantic audits and exact ten-file scope passed for that head.
- Historical pre-merge adversarial review found and corrected one leaked “unrelated” label, then reached `0 Critical / 0 Required`; specialist `0`, model/fresh-reader `not_run`.

## Historical ASM-PR2B implementation evidence before PR #66 merge

| Evidence | Giá trị |
| --- | --- |
| Ngày sync | 2026-07-30 |
| Pre-fetch branch/HEAD | `feat/agent-skills-asm-pr2a` tại `7e63d94087a93bd0f79e2d484ff747903d3cab7a`; worktree và staging clean |
| Local main trước/sau sync | `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030` → `3cdbb440d7068c5280750f650cf0680a1992f3e0` |
| Remote refresh | `git fetch origin --prune`; `origin/main` advanced 10 commits và old ASM-PR2A remote branch pruned |
| Main update | `git switch main`; `git merge --ff-only origin/main`; final divergence `0/0` |
| Planning branch | `feat/agent-skills-asm-pr2b`, created directly from synchronized `main` |
| PR #65 dependency | Merge commit `3cdbb440d7068c5280750f650cf0680a1992f3e0`; message names PR #65 and `feat/agent-skills-asm-pr2a`; merge contains ASM-PR2A head `7e63d940...` |
| Starting suite/CI baseline | 2 configured skills, 6 suite files, 37 cases; exactly one `node .agents/scripts/run-skill-evals.mjs validate --all` step |
| Candidates | `test-quality-strategy`, `nextjs-server-action-zod`, `supabase-safe-migration` |
| Approved and implemented allocation | TQS `6/5/4 = 15`; NSAZ `8/7/5 = 20`; SSM `11/6/5 = 22`; total `57` |
| Discovery | `complete`; roadmap/master/progress/ASM-PR2A plan/brief, all three monolithic skills, six suites, schema/runner/tests/validator/CI and bounded test/action/schema/upload/webhook/payment/migration/RLS/RPC/trigger/concurrency/Storage/seed/E2E surfaces inspected |
| CP0 | `complete` |
| CP1 | `complete`; original planning plus bounded correction delivery complete; owner-approved frozen plan |
| Detailed plan | [ASM-PR2B plan](./implementation-plans/asm-pr2b/plan.md), `SSM observability correction implemented and verified` |
| Owner review | [owner-review-brief.md](./implementation-plans/asm-pr2b/owner-review-brief.md), `correction delivered at bbf0d79` |
| Planning review | Historical first pass: 3 `Required`, all corrected. Recovery review: 3 later `Required` findings on deterministic contexts, routing ownership/classification and SSM applicability, all corrected; recovery re-review `0 Critical / 0 Required`; specialist `0`; fresh-reader `not_run` |
| Executor contexts | 42 exact entries: 29 safe existing repository files + 13 exact neutral inline facts; all 57 rows resolve; 8 SSM cases now expose necessary neutral SQL implementation evidence; no future physical name/evaluator answer leaks |
| Planning verification | Node `v24.11.1`; runner rerun `130/130` after one 121-second timeout; structural validator tests `37/37`; repository validator valid with 11 skills, 0 errors and 4 existing `CORE_LENGTH_SIGNAL` warnings; eval validation valid for 2 skills/6 files/37 cases; strict context/routing/SSM/document/scope audits pass |
| Suite implementation | `complete`: 9 files/57 cases; CP2 `9d2251d`, CP3 `34bd4d3`, CP4 `fc26f94`, CP2 exact-path correction `1ea50dc` |
| CP5/correction verification | Runner `130/130`; structural validator `37/37`; repository validator valid with 11 skills/0 errors/4 existing warnings; focused SSM 3 files/22 cases; cumulative 5 skills/15 files/94 cases/0 diagnostics; exact-byte package and frozen-contract audits pass |
| Final review | SSM correction `0 Critical / 0 Required`; specialist `0`; một first-pass `Required` về incomplete RLS source đã được sửa; fresh-reader `not_run` vì deterministic evidence giải quyết hết material ambiguity |
| CI | Existing ASM-PR2A step audit-only; no ASM-PR2B CI edit |
| PR/CI/merge | No PR created; CI watch/fix and merge not granted |
| Database/model | No local/remote DB command; no model execution or semantic grading |
| Planning delivery | Complete at original planning commit `49691285df6f9ee6da119cd3bf98d746fef140b8` and planning-correction commit `b1e7aa352e59c2dd0c208eac6815d668eef4afa9` |
| Planning edit/commit/push authority | `consumed` |
| SSM correction delivery | Commit `bbf0d79d7fd2a5d198f179a77a537720544b9b7c` normal-pushed; local/upstream/actual remote synchronized, divergence `0/0`, clean worktree/index |
| Current delivery authority | SSM semantic-correction authority consumed at `bbf0d79`; no standing ASM-PR2B delivery authority remains |

## Historical ASM-PR2A implementation evidence

| Evidence | Giá trị |
| --- | --- |
| Ngày sync | 2026-07-29 |
| Pre-fetch branch/HEAD | `feat/agent-skills-asm-pr1` tại `7d172839d6166b8f78818550eb5d2a08491bd060`; worktree và staging clean |
| Local main trước/sau sync | `aa91278993d7bcad9e3cafb34405ac57a23a514a` → `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030` |
| Remote refresh | `git fetch origin --prune`; read-only remote inspection |
| Main update | `git switch main`; `git merge --ff-only origin/main` |
| Planning branch | `feat/agent-skills-asm-pr2a`, tạo từ updated `main` |
| PR #64 dependency | `MERGED` lúc `2026-07-29T14:13:28Z`; merge `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030` present trong `origin/main` |
| ASM-PR1 capability | `skill_resource_access`, exact observation-byte binding, shared role-level `available`, per-case supplied/read summaries và updated ASM-PR1 plan/tracker state present |
| Current suite state | CP2 + CP3 complete: `frontend-design 6/8/4 = 18`; `frontend-workflow 8/7/4 = 19`; cumulative 6 files/37 cases |
| Current CI state | CP4 complete and pushed: exact one `validate --all` step after structural skill validation and before integration gating |
| Current correction boundary | Exact four writable files: design regression suite, ASM-PR2A plan, owner brief and tracker; all other suites, CI, skills, runner/schema, package, product, database and deployment are audit-only or forbidden |
| Discovery | `complete`; direct roadmap/skills/schema/runner/tests/CI/history và bounded frontend-surface inspection |
| Detailed plan | [ASM-PR2A plan](./implementation-plans/asm-pr2a/plan.md), `approved` |
| Owner review | [owner-review-brief.md](./implementation-plans/asm-pr2a/owner-review-brief.md), `approved` |
| Approved case allocation | `frontend-design 6/8/4 = 18`; `frontend-workflow 8/7/4 = 19`; total `37` |
| Approved CI | Exactly one `validate --all` step after structural skill validation và before integration gating |
| Completed checkpoints | CP0 sync; CP1 plan; CP2 design trio; CP3 workflow trio; CP4 one CI step; CP5 cumulative review |
| CP2 | Complete at `7dfa8f086a6cf3301536ff552a29d478bd4eea2e` |
| CP3 | Complete at `5049e5d429d0844e2ca252850ce4f18c0e141ca2` |
| CP4 | Complete at `cd210f02526d92b7c6b38a15b7bfa5fb6c9eb325` |
| CP5 verification/reconciliation | Complete at `813deea84301cb284a1e3b17b9c1f5c8dd32dad7` |
| Review state | Historical plan review `0 Critical / 0 Required`; current two-finding correction review `0 Critical / 0 Required` |
| Specialist | `0`; no unresolved hard-risk evidence gap |
| Fresh-reader | `not_run`; no residual material case-discrimination ambiguity after direct evidence and main review |
| Current verification | Local Node `v24.11.1`: runner `130/130`, structural-validator tests `37/37`, both per-skill and all-suite validation valid with 6 files/37 cases/0 diagnostics, repository validator valid with 4 existing warnings; reporting-context, unchanged-ID/allocation, lexical-order, evaluator-secrecy, CI placement, exact-scope and document-integrity audits pass |
| Original planning delivery | Commit `f6dae70d7c8faadfe83b7a29109cbc4708620724` normal-pushed; local/upstream synchronized before correction; prior authority consumed |
| Pre-correction final-state head | `cb3099ed1030e610ba2e93986d7e600d26ede3e5` |
| Current correction authority | Consumed upon successful correction push; no standing edit/commit/push authority afterward |
| ASM-PR2A implementation | `complete; CP2–CP5 complete` |
| PR/CI watch/fix/merge | `not granted` |

## Historical ASM-PR2A CP1 planning checkpoint

- Goal: freeze owner-reviewable 37-case suite design, exact executor/evaluator boundary, future reference expectations, one-step CI placement và CP0–CP5 rollback contract.
- Planning files: implementation-plan README, ASM-PR2A detailed plan, owner brief và tracker này.
- Detailed/owner state: `approved` / `approved`; CP2 permission was later granted and is now consumed.
- Design trio proposal: 6 regression, 8 routing, 4 fresh-reader cases.
- Workflow trio proposal: 8 regression, 7 routing, 4 fresh-reader cases.
- CI proposal: `Validate agent skill evaluation suites` immediately after `Validate repo-local agent skills`, before integration gating.
- Original main self-review: eleven Required findings corrected; re-review `0 Critical / 0 Required`.
- Historical planning-correction findings: explicit variant applicability, accurate CP1 delivery/authority state and workflow design-only near-miss exclusions were corrected in scope; exact case count remained `37`.
- Historical planning-correction re-review: all three Required findings resolved; `0 Critical / 0 Required`.
- Specialist: `0`.
- Fresh-reader: `not_run`; direct repository evidence and main review resolved the planning contract without residual material ambiguity.
- Verification: runner `130/130`, structural-validator tests `37/37`, both validator CLIs pass; strict planning-doc audits, 37-unique-case-ID audit and `git diff --check` pass on local Node `v24.11.1`. One initial custom audit regex falsely matched lines ending in `t`; corrected `[ \x09]+$` invocation passed and found no document defect.
- Original planning delivery: commit `f6dae70d7c8faadfe83b7a29109cbc4708620724` and normal push complete; local/upstream synchronized before current correction; previous authority consumed.
- Planning correction delivery: commit `152519eb210f3219e2471f51dd7d988454f1f275` and normal push complete; no amend/rebase/squash/history rewrite.
- CP2 verification: Node `v24.11.1`; design validation and `validate --all` valid for 3 files/18 cases with 0 errors/warnings; runner tests `130/130`; structural-validator tests `37/37`; repository validator valid with 4 existing non-blocking warnings; lexical-ID and executor-leakage audit pass.
- CP2 delivery: commit `7dfa8f0` normal-pushed to `origin/feat/agent-skills-asm-pr2a`.
- CP3 verification: workflow validation valid for 3 files/19 cases; cumulative validation valid for 6 files/37 cases/0 diagnostics; runner `130/130`, structural-validator tests `37/37`, exact routing arrays, lexical IDs and evaluator-leakage audit pass; formal cross-skill review `0 Critical / 0 Required`.
- CP3 delivery: commit `5049e5d` normal-pushed to `origin/feat/agent-skills-asm-pr2a`.
- CP4 verification: exact single-step occurrence/order pass; cumulative validation 6 files/37 cases/0 diagnostics; repository validator valid with 4 existing warnings; workflow-focused review `0 Critical / 0 Required`.
- CP4 delivery: commit `cd210f0` normal-pushed to `origin/feat/agent-skills-asm-pr2a`.
- CP5 cumulative verification: runner `130/130`, structural-validator tests `37/37`, both per-skill and `validate --all` valid, repository validator valid with 4 existing warnings, 37-case/lexical-ID/routing-array/evaluator-leakage/UTF-8/newline/scope/raw-artifact/secret/CI audits pass.
- CP5 review: `0 Critical / 0 Required`; fresh-reader `not_run` because no residual material ambiguity made the optional reader useful.
- CP5 reconciliation delivery: commit `813deea` normal-pushed; no PR, CI watch/fix, merge, deployment or database action performed.
- Current review finding 1: `confirmed`; `fd-reg-output-and-related-routing-report` now has bounded learner-dashboard context without changing its case ID, material criterion, reporting invariant or evaluator-only answer boundary.
- Current review finding 2: `confirmed`; current sections now describe completed ASM-PR2A while CP1 zero-suite/pre-implementation facts are explicitly historical.
- Current correction verification: both per-skill validations and `validate --all` valid for 6 files/37 cases; runner `130/130`; structural validator `37/37`; repository validator valid with 4 existing warnings; strict four-file/content audits pass.
- Current correction formal review: `0 Critical / 0 Required`; fresh-reader `not_run` because no residual material ambiguity remained after concrete context and main review.

## ASM-PR1 CP2 implementation checkpoint

- Artifact: standalone `skill_resource_access` v1 với exact workspace/skill/suite/case/variant/context/bundle identity và `sha256Bytes` binding tới exact accepted observation bytes.
- Workspace/report: deterministic non-artifact template, evaluator allowlist, shared role-level `available`, per-case supplied/read/unknown summaries, manifest-derived core/resource/total metrics và immutable enrichment refusal.
- Compatibility: suite schema, observation/human contracts, semantic completeness/status authority, public CLI, deterministic persistence và CI workflow không đổi.
- Focused verification: resource-access selection pass `18/18`.
- Full runner verification: `node --test .agents/scripts/run-skill-evals.test.mjs` pass `130/130`, 0 fail, 0 skipped.
- Syntax: bốn required `node --check` commands pass.
- CLI: `node .agents/scripts/run-skill-evals.mjs --help` pass; public grammar không đổi.
- Runtime: local Node `v24.11.1`; không claim Node 20 local evidence.
- Audits: strict UTF-8/final newline/trailing whitespace pass cho 8 current files; relative Markdown links pass; conflict marker, zero-width, scope, secret/raw-evidence/absolute-temp-path review và `git diff --check` pass. Search hits cho “secret” và OS temp root chỉ là existing hostile fixture hoặc runner-owned fixed-root contract, không phải leaked value/path.
- Formal main review: artifact schema, execution binding, submitted-versus-runner taxonomy, path/hash/identity safety, missing/invalid behavior, deterministic report shape, compatibility, claim truthfulness và scope đều pass; `0 Critical / 0 Required`.
- Delivery: CP2 commit `fcc23a9506ea4de1f22fa0b417a2caa60eec5823` (`feat(agent-skills): record skill resource access evidence`) đã normal-push tới `origin/feat/agent-skills-asm-pr1`.

## ASM-PR1 CP3 cumulative checkpoint

- `node --test .agents/scripts/run-skill-evals.test.mjs`: pass `130/130`, 0 fail, 0 skipped.
- `node --test .agents/scripts/validate-skill.test.mjs`: pass `37/37`, 0 fail, 0 skipped.
- `node .agents/scripts/run-skill-evals.mjs validate --all`: exit `0`, `status: valid`, 0 configured skills, 0 suite files, 0 cases, 0 errors, 0 warnings.
- `node .agents/scripts/validate-skill.mjs`: exit `0`, `status: valid`, 11 skills, 0 errors, 4 existing non-blocking `CORE_LENGTH_SIGNAL` warnings.
- `node --version`: `v24.11.1`; local Node 20 compatibility không được claim.
- `git diff --check`: pass.
- Exact cumulative branch scope từ baseline: 9 files gồm 5 implementation/authority files, 3 ASM-PR1 plan/tracker files và historical planning-routing `docs/agent-skills/implementation-plans/README.md`; không suite schema, validator implementation/test edit, CI, candidate skill, product, database hoặc deployment file.
- Branch relationship tại CP2 delivery: baseline `aa91278993d7bcad9e3cafb34405ac57a23a514a` là ancestor; CP2 head/upstream `fcc23a9506ea4de1f22fa0b417a2caa60eec5823`; khi đó branch 3 commits ahead, 0 baseline-side commits.
- Adversarial integration review: deterministic output/report compatibility/CLI-help/UTF-8/final newline/Markdown links/trailing whitespace/conflict markers/zero-width/temp-path/raw-evidence/secrets/forbidden-domain/scope audits complete; `0 Critical / 0 Required`.
- Fresh-reader: `not_run`; no concrete unresolved comprehension or claim-boundary ambiguity remained after main review, and self-review is not fresh-reader evidence.
- CP3 substantive defect correction: none; documentation closure records actual verification/delivery evidence and is not ceremonial.
- Initial CI: run `30456110172` completed `success` at final head `5a8ed0884169e5f34365e4934c4643655d6937fc`; `Test and Build` and `production-gate` succeeded.
- Node 20 path: `.github/workflows/ci.yml` selected `node-version: 20`; `Run agent skill validator tests`, `Run agent skill eval runner tests`, `Validate repo-local agent skills` và `Build application` đều `success`.
- CI-fix: `0` attempts; conditional permission was not used and creates no standing authority.

Các mục còn lại bên dưới giữ historical checkpoint evidence. Khi một dòng dùng từ `current` trong historical PR 1/2/3A/3B narrative, nó chỉ là current tại checkpoint được ghi trong chính mục đó; bảng trên và phần `Trạng thái hiện tại` là current-status authority ngày 2026-07-29.

## Historical PR 3B evidence về base và HEAD

| Evidence | Giá trị |
| --- | --- |
| Ngày sync | 2026-07-26 |
| Branch trước sync | merged Adaptive Workflow branch `feat/agent-workflow-aw-pr3b` tại `814cba15d6c706b2d4d37374c679203a0cd6e9e4` |
| Pre-fetch local/remote | local `main` `71f62365ef24eac75e31ff2bc4e3ad46682a11ee`; fetched `origin/main` `46dd08b81f064f23b6c1bffc81d98a1496bc0041`; worktree và staging clean |
| Remote refresh | Authorized read-only `git fetch origin --prune`; không remote mutation |
| Fast-forward | `git switch main` rồi `git merge --ff-only origin/main`; không reset, rebase hoặc merge commit mới |
| Adaptive Workflow separation | Previous branch HEAD là ancestor của `origin/main` qua PR #61; agent-skills PR 3B không kế thừa AW-PR3B lifecycle |
| PR 3A dependency | PR #54 head `af14511300cb0906199f88041f665a7d8a36fc3b` merge tại `9bc37722943ca02720ae37a38c935e8b98417614`; merge commit nằm trong `origin/main` |
| Synchronized `main` và `origin/main` | `46dd08b81f064f23b6c1bffc81d98a1496bc0041`; ahead/behind `0/0` khi tạo branch |
| PR 3B branch base | `46dd08b81f064f23b6c1bffc81d98a1496bc0041` |
| Branch relationship | Independent semantic branch từ synchronized `main`; không stacked và không mang unrelated commit |

Snapshot này không ngụ ý remote state sau thời điểm đã ghi.

## Historical PR 3A implementation and merge checkpoint

- Plan: [pr-3a-eval-schema-plan.md](./pr-3a-eval-schema-plan.md).
- Implementation: completed — suite-definition schema v1, read-only `validate --skill|--all` CLI, black-box `node:test` fixtures, eval-design reference và documentation reconciliation.
- First review correction: cho phép routing case không chọn skill nào; thống nhất `operational_error` với `validation_result` envelope; reconcile Git delivery evidence khi đó.
- Second review correction: giới hạn `behavior_area` về tám approved values; tách invalid eval-directory identity khỏi missing skill; giữ partial validation counts trong `operational_error`; reconcile first correction đã push.
- PR 3A runner boundary tại merge: không real suite, prepare/report, Git subprocess, provenance/workspace, model/subagent, semantic grading, skill creation/migration hoặc CI/package/Vitest change.
- Verification: required local command set pass trên Node `v24.11.1`; eval CLI suite 61/61 pass, structural-validator suite 37/37 pass, checkpoint eval state `valid` với zero configured suite và target skill `not_configured`.
- Self-review: 0 Critical, 0 Required còn lại; regression coverage mới đã pass cho behavior taxonomy, distinct skill-name diagnostics, partial operational summary và preservation của earlier diagnostics.
- Git delivery: implementation và review-correction checkpoints đã commit/push; final head `af14511300cb0906199f88041f665a7d8a36fc3b` đã merge qua PR #54 tại `9bc37722943ca02720ae37a38c935e8b98417614`. Historical remote branch và pre-PR states không còn là current state.
- CI coverage: PR 3A không sửa CI; current repository CI file vẫn không gọi dedicated PR 3A runner test, nên explicit local commands là evidence cho runner baseline.
- Fresh-reader: `not_run`; reason: no separate executor authorization.

Hai structural-validator warnings ghi trong PR 3A verification ngày 2026-07-16 là historical evidence đúng tại checkpoint đó. Current repository baseline ngày 2026-07-26 là 11 skills, 0 errors và 4 non-blocking warnings; không rewrite số historical thành bốn.

## Historical PR 3B implementation checkpoint

- Detailed plan: [pr-3b-eval-runner-plan.md](./pr-3b-eval-runner-plan.md).
- Goal: synthetic packaging, SHA-256 provenance, fixed runner-owned OS-temp workspace và deterministic report; không invoke hoặc grade model.
- Shape: một pull request với CP0–CP5; commit chỉ tồn tại khi checkpoint tạo coherent, independently reviewable và recoverable state.
- Planning delivery: commit `fb47225ff0c885567cd73bced89cd5985b8814b3` đã push trên `feat/agent-skills-eval-runner`.
- Original CP1–CP4 implementation/push permission, PR creation/initial CI-watch permission và review-correction implementation/test/commit/push/final-CI-watch permission đều đã consumed. Documentation/PR-body reconciliation hiện tại được authorize riêng; merge không được phép.
- Authority reconciliation: owner xác nhận Design B; missing observation hoặc human evaluation có thể tạo incomplete/null report exit `0`, còn present-but-invalid/inconsistent/integrity-failed artifact phải fail non-zero và không tạo valid report. `eval-design.md` và stale master-plan exit proposal đã được reconcile trong CP1/CP2 scope.
- CP1/CP2: artifact schema/canonical hash, current-tree/ref provenance, deterministic equal-hash variant tie-break, fixed runner-owned workspace, blind executor packaging, evaluator-only separation, ignored-input boundary và source immutability đã implement.
- CP1/CP2 verification trước commit: syntax pass; runner suite 68/68 pass; structural validator 37/37 pass; repository validator exit `0` với bốn historical non-blocking length warnings; `git diff --check` pass ngoài Windows normalization notices.
- CP1/CP2 self-review: `0 Critical / 0 Required` sau khi sửa một Required về explicitly referenced ignored context nằm trong skill bundle.
- CP3: `report --workspace` validate prepared inventory, manifests, observation/human proposal schema và cross-artifact identities; incomplete report chỉ return stdout, complete report mới persist immutable với exact-byte idempotent rerun.
- CP3 verification trước commit: runner suite 83/83 pass sau targeted report matrix; invalid/malformed/wrong-identity/unsupported/integrity/overwrite paths có observable exit coverage.
- CP3 self-review: `0 Critical / 0 Required` sau khi sửa một Required để refuse unexpected observation/human-evaluation file ngoài prepared case graph.
- Historical CP4 pre-correction verification: runner suite 93/93 pass; structural-validator suite 37/37 pass; current repository validator exit `0` với bốn non-blocking length warnings; Node.js 20 khi đó vẫn `not verified`.
- CP4 adversarial review đã sửa sáu Required về line metadata, staged/deleted/untracked Git provenance, control-plane HEAD/tree-state hashing, comparative `not_run` relationship, validation của deleted-entry `git_status` và refusal của ref-only unsafe materialization paths. Re-review cuối: `0 Critical / 0 Required`.
- CP4 historical implementation/authority scope có đúng tám file. Pre-correction cumulative PR range tại head `043e687a759bcdc0916ce0f4b5ba367ea025e553` có chín file vì planning delivery còn sửa `docs/agent-skills/pr-3a-eval-schema-plan.md`. PR #62 open: yes; merged: no.
- Review correction ngày 2026-07-28: owner chốt trusted local/CI, primarily sequential threat model với point-in-time best-effort link/reparse refusal; immutable per-`prepare` suite/context capture vẫn là blocking requirement; live tracker reconciliation là required. Dedicated runner suite trong existing Node.js 20 CI job được phép khi bounded.
- First correction commit `52230f771bb6232c2952937a28f21f2c021c0501` (`fix(agent-skills): preserve eval input capture`) pin suite/context packaging và provenance vào cùng immutable per-`prepare` capture, thêm synchronized source-race coverage và route dedicated runner suite trong existing Node.js 20 CI job.
- Second correction commit `0aceabad1eeb69ea8d43bcff2312b5461aebf254` (`fix(agent-skills): capture eval directory membership`) đưa toàn bộ relevant eval-directory membership vào captured/final fingerprint để phát hiện path xuất hiện, biến mất hoặc đổi loại trong snapshot window.
- Final correction local verification tại behavior head `0aceabad1eeb69ea8d43bcff2312b5461aebf254`: runner suite 97/97 pass, structural-validator suite 37/37 pass và repository validator exit `0` với bốn non-blocking length warnings trên Node `v24.11.1`.
- Final visible GitHub Actions run `30361926080` tại cùng behavior head chạy Node `v20.20.2`; dedicated runner suite 97 pass, 0 fail, 0 skipped, 0 todo. Visible checks `Test and Build`, `production-gate`, `Vercel` và `Vercel Preview Comments` đều terminal `SUCCESS`.
- Exact live PR diff `origin/main...0aceabad1eeb69ea8d43bcff2312b5461aebf254` có mười file: original implementation/authority scope tám file, thêm historical planning-reconciliation file `docs/agent-skills/pr-3a-eval-schema-plan.md` và correction file `.github/workflows/ci.yml`.
- Broader local app checks là environment-limited evidence: `npm.cmd run test:ci` chạy 36 files/352 tests pass nhưng exit `1` vì local dependency tree thiếu `jsdom`; `npm.cmd run build` exit `1` vì sandbox không fetch được ba Google Fonts. Không sửa dependency/product để che hai lỗi môi trường này; clean GitHub Actions `npm ci`/network run sở hữu final app-test/build evidence.

## Historical PR 2 implementation checkpoint

- Plan: [pr-2-structural-validator-plan.md](./pr-2-structural-validator-plan.md).
- Implemented: `.agents/scripts/validate-skill.mjs` và `.agents/scripts/validate-skill.test.mjs`.
- Local CI correction: `vitest.config.ts` exclude Node suite; `.github/workflows/ci.yml` chạy focused Node suite và current-repository validator trước build trong existing Node 20 job.
- Contract: strict VocaSpace frontmatter v1, path/resource/route validation, stable JSON schema v1, exit code `0/1/2/3`, deterministic warnings và no semantic judgment.
- Focused tests sau final re-review correction: 37 passed, 0 failed, 0 skipped trên local Node `v24.11.1`.
- Historical Node.js 20 evidence: failed PR run tại checkpoint đó đã import và chạy 37 Node tests thành công dưới Node 20, nhưng dedicated step cùng standalone validator CLI chưa chạy trong chính failed run đó. PR #53 sau đó đã merge; dòng này không phải current CI-status claim.
- Historical current-repository CLI tại PR 2 checkpoint: exit `0`, `status: valid`, 11 skills, 0 errors, 2 approved non-blocking length warnings.
- Git delivery: validator head `7f78f48eb4b10f2453a8f2f2b45078fc1217722f` và correction head `cd426b82e78beee3ba73cc1679180fa6b98cfb08` đã được PR #53 merge tại `37599ee600656e3fb519ef4fd14452c404c4e80d`; deploy không thuộc scope.

## Historical PR 1 implementation checkpoint

- Commit: `f9563a07a78dc5f192612a8a48de03eed60bf10a`
- Commit message: `feat(agent-skills): add repo skill governance contract`
- Remote branch: `origin/feat/agent-skill-governance-pr1`
- Pushed: yes
- Pull request: merged as PR #52
- Merge: `31b681dbbfaee017fc6078fd2d165d19d862f1ac`
- Deploy: no evidence and out of program scope

Checkpoint trên ghi immutable delivery evidence đã xác nhận ngày 2026-07-15; trạng thái pull request đến từ owner-supplied review fact trong task này. Nó không khẳng định post-checkpoint review correction chứa chính tracker này đã được commit hoặc push; exact current local/remote HEAD và current GitHub PR state luôn phải đọc từ hệ thống tương ứng.

## Historical work đã hoàn tất trên nhánh PR 1

- Fetch remote, xác nhận planning checkpoint đã merge, fast-forward local `main` an toàn và tạo `feat/agent-skill-governance-pr1` từ exact synchronized base.
- Hoàn tất repository/Git/ownership discovery và tạo [detailed PR 1 plan](./pr-1-governance-contract-plan.md).
- Thực hiện adversarial plan self-review; sửa hai Required finding về master-plan ownership và exact fresh-reader read condition.
- Ghi `Implementation decision: proceed` sau khi cả 12 small-enough criterion pass.
- Tạo `.agents/skills/maintain-repo-skills/SKILL.md` với mandatory authority, permission, safety, documentation, evaluation, routing, stop và reporting contract trong core.
- Tạo hai reference có consumer và exact read condition cho progressive disclosure và manual fresh-reader testing.
- Thêm targeted route trong `AGENTS.md` và giữ ordinary product task ngoài activation scope.
- Reconcile `docs/agent-skills/plan.md` thành partially approved, tách PR 1 decision đã duyệt khỏi PR 2+ proposal, đóng nhãn pre-PR-1 baseline fact và cập nhật current governance bundle tree.
- Thêm repo-local skill governance vào lifecycle ownership list trong `docs/agent-loops.md` để khớp targeted route authoritative ở `AGENTS.md`.
- Không sửa hoặc migrate existing skill; không tạo PR 2+ artifact.

## Boundary chưa bắt đầu tại structural-migration planning checkpoint

- Chưa sửa hoặc migrate existing skill.
- Chưa tạo real eval suite hoặc real/new skill.
- PR 3B CP1–CP4 và hai review corrections đã merge qua PR #62; đây là completed foundation evidence, không phải active work.
- Chưa execute runner-produced model/subagent semantic evaluation. Bốn bounded manual fresh readers đã được authorize và chạy chỉ cho planning evidence; chúng không phải formal runner A/B hoặc isolation claim.
- Chưa execute synthetic hoặc mutation-capable evaluation.
- Chưa sửa product code, product test content, database, migration, RLS, RPC, production hoặc deployment behavior.
- Chưa implement ASM-PR1, ASM-PR2A, ASM-PR2B, ASM-PR2C, ASM-PR3, ASM-PR4, ASM-PR5A, ASM-PR5B hoặc ASM-PR6; roadmap approval không tự đổi trạng thái implementation.

## Xác minh đã chạy

### Current ASM identifier-correction verification

Pre-commit correction checkpoint ngày 2026-07-29 trên branch `docs/agent-skills-structural-migration-roadmap`:

| Check | Kết quả |
| --- | --- |
| Identifier classification audit | Pass: mọi structural-migration action/dependency gate dùng exact `ASM-PR*`; unqualified identifiers còn lại trong four-file scope đều thuộc historical foundation context |
| Dependency và allocation audit | Pass: exact nine-node `ASM-PR1` → `ASM-PR6` graph; nine candidates, two unsplit decisions, 6/9/12 suite-file split và phase allocation không đổi |
| `node .agents/scripts/run-skill-evals.mjs validate --all` | Pass: `valid`; 0 configured skill, 0 suite file, 0 case, 0 error, 0 warning |
| `node .agents/scripts/validate-skill.mjs` | Pass: 11 skills, 0 errors, 4 non-blocking `CORE_LENGTH_SIGNAL` warnings |
| Strict docs audit | Pass: UTF-8 without BOM, final newline, balanced fences và resolved relative links cho exact four-file scope |
| `git diff --check` | Pass; chỉ local future LF-to-CRLF warnings |
| Fresh reader | Không chạy; deterministic identifier correction không có material uncertainty cần thêm advisory evidence |

### Current structural-migration planning verification

Planning checkpoint ngày 2026-07-28 trên branch `docs/agent-skills-structural-migration-roadmap`:

| Check | Kết quả |
| --- | --- |
| Git/GitHub reconciliation | local `main` fast-forward-only tới `d8a67a1b1e015d44ab52095e823cd8334bf1fead`; PR #62 merged |
| `node --test .agents/scripts/run-skill-evals.test.mjs` | Pass: 97 tests, 0 fail, 0 skipped |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped |
| `node .agents/scripts/run-skill-evals.mjs validate --all` | Pass: `valid`; 0 configured skill, 0 suite file, 0 case |
| `node .agents/scripts/validate-skill.mjs` | Pass: 11 skills, 0 errors, 4 non-blocking `CORE_LENGTH_SIGNAL` warnings |
| Strict docs audit | Pass: UTF-8, final newline, trailing whitespace, fences và relative links cho exact four-file scope |
| `git diff --check` | Pass; chỉ local future LF-to-CRLF warnings |
| Scope/staging | Chỉ 4 planning docs dưới `docs/agent-skills/**`; staging empty |
| Owner revision contract audit | Pass: 9 actual PR headings; no stale complete-program sáu-actual-PR wording; one CI workflow-path owner in ASM-PR2A; all 15 required self-review checks pass |
| Prior fresh-reader discovery evidence | 4 bounded readers; 2 paired manual comparisons; không material regression observed; không claim isolation/formal runner A/B/token saving |
| Fresh readers trong owner-decision revision này | Không chạy; revision là deterministic document reconciliation, không có material uncertainty cần thêm advisory evidence |

Plan self-review ban đầu có 3 Required finding về missing broader audit, stale status và exact resource-access claim boundary. Owner-decision revision thêm 2 Required finding về stale six-actual-PR grouping và missing program-level fresh-reader default. Tất cả đã sửa trong planning docs; re-review còn `0 Critical / 0 Required`. Không gọi specialist.

### Historical PR 3B planning verification

Planning checkpoint ngày 2026-07-26 trên branch `feat/agent-skills-eval-runner`:

| Check | Kết quả |
| --- | --- |
| `node --version` | `v24.11.1`; Node.js 20 compatibility vẫn `not verified` |
| `node --check .agents/scripts/run-skill-evals.mjs` | Pass |
| `node --test .agents/scripts/run-skill-evals.test.mjs` | Pass: 61 tests, 0 fail, 0 skipped; chỉ verify merged PR 3A baseline |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped |
| `node .agents/scripts/run-skill-evals.mjs --help` | Pass; actual CLI vẫn chỉ expose PR 3A `validate`, nên không claim PR 3B behavior |
| `node .agents/scripts/run-skill-evals.mjs validate --all` | Pass: exit `0`, `status: valid`, `configured_skills: 0` |
| `node .agents/scripts/run-skill-evals.mjs validate --skill maintain-repo-skills` | Pass: exit `0`, `status: not_configured` |
| `node .agents/scripts/validate-skill.mjs` | Pass: exit `0`, 11 skills, 0 errors, 4 non-blocking `CORE_LENGTH_SIGNAL` warnings |
| Strict UTF-8/final newline/trailing whitespace/headings/fences/tables/relative links | Pass cho exact three-file scope; first trailing-whitespace audit invocation false-positive vì PowerShell pattern chứa literal `t`, corrected regex audit pass |
| Exact scope/source audit | Pass: chỉ ba planning files thay đổi; `.agents/scripts/**`, CI, dependency, product, database và deployment không đổi |
| Base/ancestry/staging audit trước commit | Pass: branch base `46dd08b81f064f23b6c1bffc81d98a1496bc0041`; PR 3A merge là ancestor; staging clean |
| `git diff --check` | Pass, không whitespace error; chỉ có local future LF-to-CRLF normalization warnings |

Evidence limit tại planning checkpoint: các Node tests khi đó chỉ bảo vệ PR 3A. Current CP1–CP3 tests đã execute synthetic `prepare` và deterministic `report` trên disposable local Git fixtures; chúng không verify model behavior, native routing, automatic activation, enforced isolation, benchmark quality, remote hoặc production behavior.

### Historical PR 3B planning self-review

Adversarial self-review dùng root/lifecycle instructions, master plan, merged PR 3A contract, runner/schema sources, eval-design authority và planning/review/Git/test/skill-maintenance contracts. Không invoke specialist hoặc fresh-reader.

| Classification | Finding | Resolution |
| --- | --- | --- |
| Critical | 0 | Không có |
| Required | Evaluation control plane và ref-selected variant bundle ban đầu chưa tách đủ rõ, có thể làm baseline/candidate nhận khác context | Plan giờ pin suite/criteria/context từ current tree một lần; ref chỉ chọn skill bundle và mọi variant nhận cùng context bytes |
| Required | Deterministic content-derived workspace ID kết hợp no-overwrite/no-cleanup làm repeat prepare cùng input bị collision | Workspace ID đổi thành opaque collision-resistant identity; deterministic provenance/reproducibility hash tách khỏi ID |
| Required | Observation template có role nhưng chưa có exact versioned artifact literal | Ghi rõ `observation_template` là versioned executor-visible artifact |
| Required | Generic master-plan exit proposal có thể làm stale `incomplete → exit 1` hoặc suy ra `not_run` | Detailed plan ghi explicit owner decision; owner implementation instruction sau đó mở rộng scope và master plan đã được reconcile |
| Required | Complete observations nhưng thiếu required human proposal ban đầu được tách thành một completeness dimension chưa có owner contract | Owner implementation instruction xác nhận missing required human proposal cũng là `evidence_status: incomplete`, semantic/comparison `null`, exit `0` |
| Suggestion | CP1 có nguy cơ thành dead scaffolding nếu chưa có observable state | Plan yêu cầu gộp CP1+CP2 commit khi CP1 không independently reviewable; không tạo ceremonial commit |

Re-review sau correction:

```text
0 Critical / 0 Required
0 specialist
0 fresh-reader
```

PR 3A targeted verification ngày 2026-07-16:

| Check | Kết quả |
| --- | --- |
| `node --version` | `v24.11.1`; Node.js 20 compatibility `not verified` |
| Ba command `node --check` cho schema, CLI và test | Pass |
| `node --test .agents/scripts/run-skill-evals.test.mjs` | Pass: 61 tests, 0 fail, 0 skipped |
| `node .agents/scripts/run-skill-evals.mjs --help` | Pass; chỉ public `validate` surface được document |
| `node .agents/scripts/run-skill-evals.mjs validate --all` | Pass: exit `0`, `status: valid`, `configured_skills: 0` |
| `node .agents/scripts/run-skill-evals.mjs validate --skill maintain-repo-skills` | Pass: exit `0`, `status: not_configured` |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped |
| `node .agents/scripts/validate-skill.mjs` | Pass: exit `0`, 11 skills, 0 errors, 2 approved length warnings |
| `git diff --check` | Pass; only local future LF-to-CRLF normalization warnings |

Không chạy application Vitest, build, browser, integration, E2E hoặc Supabase checks vì actual diff không vượt approved Node tooling/docs boundary. Current CI không gọi PR 3A runner test và PR này không sửa CI.

### Historical PR 2 CI correction verification

PR #53 CI routing correction chạy local ngày 2026-07-16 trên Node `v24.11.1`:

| Check | Kết quả |
| --- | --- |
| `npm.cmd run test:ci` | Pass: 36 Vitest files, 348 tests; `.agents/scripts/validate-skill.test.mjs` không còn được discover |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped |
| `node .agents/scripts/validate-skill.mjs` | Pass: exit `0`, 11 skills, 0 errors, 2 `CORE_LENGTH_SIGNAL` warnings |
| `node --check` cho validator và test | Pass |
| `npm.cmd exec -- tsc --noEmit --incremental false` | Pass |
| Parse `.github/workflows/ci.yml` bằng installed `js-yaml` | Pass |
| Strict UTF-8/final-newline/trailing-whitespace audit | Pass cho 5 changed files |
| `git diff --check` | Pass, exit `0`; chỉ có local line-ending normalization warnings |

Không chạy integration, build hoặc E2E local vì correction chỉ thay test routing và thêm dedicated pre-build checks. Existing conditional integration routing giữ nguyên; E2E vẫn chỉ chạy qua explicit package script và không được thêm vào CI.

### Historical PR 2 validator verification

PR 2 focused verification chạy local ngày 2026-07-15:

| Check | Kết quả |
| --- | --- |
| `node --version` | `v24.11.1`; vì không phải major 20 nên Node.js 20 compatibility vẫn `not verified` |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped; hostile route/resource/dedupe, intermediate-file, internal dot-segment và Windows junction fixtures đều chạy |
| `node --check .agents/scripts/validate-skill.mjs` | Pass |
| `node --check .agents/scripts/validate-skill.test.mjs` | Pass |
| `node .agents/scripts/validate-skill.mjs --help` | Pass; usage text và read-only boundary hiển thị |
| `node .agents/scripts/validate-skill.mjs` | Pass; exit `0`, 11 skills, 0 errors, 2 `CORE_LENGTH_SIGNAL` warnings |
| Strict UTF-8/newline/trailing-whitespace + Markdown heading/fence/link audit | Pass cho 5 initial-checkpoint files và 4 final-correction files; invocation đầu false-positive vì PowerShell pattern chứa literal `t`, không phải file defect |
| `git diff --check` sau final reconciliation | Pass, không có whitespace error; later diff display chỉ cảnh báo future LF-to-CRLF normalization từ local Git config |

Không chạy application Vitest, lint, typecheck, build, browser, Supabase, integration hoặc E2E vì PR 2 chỉ thêm repository-owned Node tooling/docs và focused Node tests bảo vệ đúng boundary.

### Historical PR 1 verification

PR 1 final structural verification chạy ngày 2026-07-14:

| Check | Kết quả |
| --- | --- |
| Final audit invocation | Lần đầu dừng trước khi chạy check do PowerShell parse lỗi biến `"$file:"`; corrected invocation dùng `"${file}:"` và pass |
| Name-search invocation | Wildcard path `.agents/skills/*/SKILL.md` không hợp lệ với `rg` trên Windows; equivalent `--glob 'SKILL.md'` query pass và xác nhận một metadata name |
| PowerShell strict UTF-8 structural audit | Pass cho toàn bộ sáu file mới/sửa, gồm progress tracker này |
| Final newline và trailing whitespace | Pass cho cùng sáu file |
| Heading hierarchy, duplicate heading và fenced code | Không có duplicate/level jump; fence cân bằng |
| Relative Markdown link | Tất cả local target tồn tại |
| Frontmatter | Đúng hai field `name`, `description`; metadata/folder đều là `maintain-repo-skills` |
| Resource path | Hai target tồn tại, contained trong bundle và không phải reparse point |
| Core size signal | 162 dòng; chỉ là inspection signal, không phải quality gate |
| Name/search inspection | Chỉ một repo-local metadata name; route/path occurrences phù hợp với bundle và program docs |
| `git diff --check` | Pass, không có output |
| Branch | `feat/agent-skill-governance-pr1` |
| Pre-commit HEAD/base | `e11137a921e6ae14ec40605244af896c36e49740` |
| Implementation checkpoint | Commit `f9563a07a78dc5f192612a8a48de03eed60bf10a`; pushed lên `origin/feat/agent-skill-governance-pr1` |
| Pull request | Chưa được cho phép và chưa tạo |

Final structural audit và `git diff --check` đã được chạy lại sau khi file này được cập nhật. Không cần application test, build, browser, Supabase, integration hoặc E2E cho governance/Markdown-only diff này.

## Historical PR 1 plan và implementation review

Plan review type: `self-review`. Reviewer read-only được gọi với bounded context nhưng không trả kết quả và đã bị dừng; không claim independent review.

Implementation review type: `self-review` read-only trên toàn bộ final diff và untracked file content, theo thứ tự permission/safety, authority/ownership, routing, core/reference boundary, repository conflict, scope, evidence claim, path/frontmatter và maintainability.

| Review | Kết quả tại checkpoint gốc |
| --- | --- |
| Plan finding 1 — Required | Resolved: bỏ proposed master-plan edit không có material intended-program change |
| Plan finding 2 — Required | Resolved: đổi fresh-reader condition thành observable changed-behavior condition |
| Plan re-review | Không còn known Critical hoặc Required finding |
| Implementation finding — Required | Resolved trong một bounded correction pass: bỏ stale `implementation chưa bắt đầu` khỏi per-PR plan frontmatter sau khi local implementation đã hoàn tất |
| Implementation re-review | Pass: không còn Critical hoặc Required finding sau correction pass |
| Fresh-reader | `not_run`: không có independent bounded-context executor; reviewer attempt đã nhận owner decisions/review criteria và không trả observation |

Post-checkpoint owner review ngày 2026-07-15 đã xác định kết luận cũ ở `Plan finding 1` là không đúng vì master plan vẫn trình bày PR 1 decision và baseline fact như current proposal/current fact. Hai Required finding được xử lý bằng việc reconcile master plan và ghi exact commit/push checkpoint; Suggestion về lifecycle ownership cũng được áp dụng. Dòng review cũ ở bảng trên được giữ như historical evidence, không phải current verdict.

| Post-checkpoint finding | Resolution |
| --- | --- |
| Required 1 — master plan stale | Reconciled thành partially approved; tách approved/pending decision; đóng nhãn baseline; cập nhật bundle tree và deferred `eval-design.md`. |
| Required 2 — tracker thiếu commit/push | Ghi exact implementation commit, message, remote branch và pushed/PR/merge/deploy state. |
| Suggestion — lifecycle ownership thiếu governance skill | Thêm targeted ownership entry cho `maintain-repo-skills`. |

Self-review và reviewer attempt không phải fresh-reader evidence. Không có claim runner-produced, isolated, baseline-equivalent, formal A/B hoặc versioned-suite pass.

## Historical PR 1 post-checkpoint correction verification

Correction verification chạy local ngày 2026-07-15:

| Check | Actual result |
| --- | --- |
| Strict UTF-8 decode, final newline, trailing whitespace | Pass cho `plan.md`, `progress.md` và `agent-loops.md` |
| Heading hierarchy và fenced code | Pass; không có heading-level jump hoặc unbalanced fence |
| Relative Markdown links | Pass; mọi local target trong ba file resolve |
| Stale-claim search bằng `rg` | Pass; không còn các claim master plan là toàn bộ draft/unapproved, repository hiện có mười skill, bundle hiện tại chưa có reference, hoặc commit/push chỉ mới được cho phép |
| Current bundle path inspection | Pass; `SKILL.md`, `progressive-disclosure.md` và `fresh-reader-testing.md` đều tồn tại; `eval-design.md` chỉ được label deferred/conditional |
| Skill-name inspection | Pass; repository hiện có 11 skill directory và đúng một metadata name `maintain-repo-skills` |
| Routing/ownership inspection | Pass; `AGENTS.md` giữ targeted activation và `agent-loops.md` có ownership entry tương ứng |
| Diff scope | Pass; chỉ `plan.md`, `progress.md` và `agent-loops.md` thay đổi; không sửa skill bundle, `AGENTS.md` hoặc PR 2+ artifact |
| Git checkpoint evidence | Local HEAD, upstream và `refs/remotes/origin/feat/agent-skill-governance-pr1` cùng là `f9563a07a78dc5f192612a8a48de03eed60bf10a` |
| `git diff --check` | Pass, exit code 0; chỉ có line-ending normalization warning từ local Git config, không có whitespace error |
| Fresh-reader | `not_run`; correction self-review không được trình bày như independent fresh-reader evidence |

Correction re-review type: `self-review` read-only trên toàn bộ three-file diff sau correction. Kết quả: 0 Critical, 0 Required còn lại; không phát hiện permission expansion, current/proposed ownership conflict, routing over-trigger, PR 2+ scope creep hoặc false fresh-reader claim.

## Historical PR 2 plan và implementation review

- Plan self-review: 3 Required finding đã sửa về JSON example consistency, exact unquoted frontmatter grammar và operational JSON contract; re-review còn 0 Critical, 0 Required; small-enough gate `proceed`.
- Initial implementation self-review: 4 Required và 2 Suggestion đã sửa, nhưng verdict `Approved` sau đó bị owner review supersede.
- Owner review: `Request changes` — 0 Critical, 3 Required, 1 Suggestion về explicit route token, resource target canonicalization, stale per-PR status và diagnostic dedupe.
- Owner-review correction: implementation và 13 hostile fixtures đã thêm; focused suite tăng từ 17 lên 33 reported tests và pass trên local Node `v24.11.1`.
- Scope audit: validator + focused Node test + `plan.md`, per-PR plan và progress; không có runner, CI, package, skill migration hoặc application code.
- Fresh-reader: `not_required` vì không đổi required governance behavior trong skill text; self-review không phải fresh-reader evidence.
- First correction self-review: cả 3 Required và 1 Suggestion finding đã resolve; required command set pass; verdict `Approved` sau đó bị owner final re-review supersede.
- Owner final re-review: `Request changes` — 0 Critical, 2 Required, 1 Suggestion về `ENOTDIR`, stale current test count và internal dot-segment canonicalization.
- Final re-review correction: hai intermediate-file fixtures exit `1`; internal `.`/contained `..` routes không còn false warning; focused suite report 37/37 pass trên local Node `v24.11.1`.
- Final correction self-review: 0 Critical, 0 Required còn lại; required command set pass; verdict `Approved` cho follow-up correction checkpoint.
- Fresh-reader: `not_required`; không đổi required behavior trong repo-local skill text. Node 20 runtime compatibility vẫn `not verified`.
- PR #53 CI discovery: run `29484164066` fail vì Vitest report Node suite là file có 0 Vitest tests dù 37 Node tests pass; unit/component files còn lại pass, integration không tới step do unit failure, E2E không thuộc CI.
- CI routing correction: exclude Node suite khỏi Vitest, thêm dedicated Node test và CLI steps trước build; local required verification pass; follow-up commit/normal push đã được owner authorize.

## ASM-PR2B recovered planning-correction state

Lost-session recovery found State A:

```text
Initial branch: feat/agent-skills-asm-pr2b
Initial local HEAD: 49691285df6f9ee6da119cd3bf98d746fef140b8
Initial upstream: origin/feat/agent-skills-asm-pr2b at 49691285df6f9ee6da119cd3bf98d746fef140b8
Initial actual remote branch: 49691285df6f9ee6da119cd3bf98d746fef140b8
Initial divergence: 0/0
Initial worktree/index: clean
Existing correction commit: none
Existing partial correction: none
Unexpected PR: none
```

The bounded correction preserved all 57 case IDs/counts/allocation/material criteria/safety vetoes and CP0–CP5 structure while resolving:

- deterministic executor contexts: 39 exact catalog entries and exact context-code resolution for all 57 rows;
- TQS routing ownership: `code-commenting-and-maintainability` on every header-eligible routing task, TQS-only physical `T-HEADER` ownership and full classification of all 18 routing rows;
- SSM applicability: `S-MIGRATION` for local migration review, exact existing-behavior/no-migration facts, a narrowly core-only remote-push case and full trigger/overlap audit across all 22 SSM rows;
- durable authority truth: original planning plus correction delivery complete, planning edit/commit/push authority consumed and no standing authority.

Recovery review:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
```

Fresh-reader was not run because exact repository/schema/routing evidence resolved all material ambiguity. No model execution or semantic grading occurred.

## ASM-PR2B CP2–CP5 implementation checkpoint

- Exact suites: 9 files under TQS, NSAZ and SSM; exact case allocation `6/5/4 + 8/7/5 + 11/6/5 = 57`.
- CP2: `9d2251d` added TQS 15 cases; `1ea50dc` later clarified four evaluator-only skip expectations with exact approved physical paths.
- CP3: `34bd4d3` added NSAZ 20 cases.
- CP4: `fc26f94` added SSM 22 cases; no database command executed.
- CP5 deterministic verification: runner `130/130`; structural-validator tests `37/37`; repository validator valid for 11 skills with 0 errors and 4 existing warnings; per-skill validation `15/20/22`; cumulative validation valid for 5 skills/15 files/94 cases/0 diagnostics.
- Frozen-design audit: 9/9 files, 57/57 unique lexical IDs, exact plan order/contexts/routes/criteria/vetoes/reference expectations/variants/physical ownership, 39/39 context catalog and 12/12 future references.
- Scope/CI/hygiene: only nine suites plus three authorized durable-state documents; CI diff empty; `git diff --check`, UTF-8/no-BOM/final-newline and forbidden-artifact audits pass.
- Formal final review: `0 Critical / 0 Required`; specialist `0`.
- Fresh-reader: `not_run`; deterministic evidence resolved the only concrete evaluator skip-path wording defect and left no material leakage/routing/ownership/trust-boundary/DB-stop ambiguity. No model executed.
- CP5 reconciliation is recorded by the checkpoint containing this tracker update. Exact final push result belongs to Git evidence and the final delivery report.

## ASM-PR2B SSM executor-observability correction

- Initial evidence gate: branch `feat/agent-skills-asm-pr2b`; local HEAD/upstream/actual remote đều `7dec9a1bf409af6d92b4530676f6b10b0966a07c`; divergence `0/0`; worktree/index sạch, không unexpected local/remote work.
- End-to-end contract: synthetic packager chỉ cung cấp exact declared `repository_file` bytes và inline facts; evaluator rubric tách biệt. Tests không thể tự chứng minh SQL implementation properties mà chúng không assert.
- Audit đủ 22 SSM cases: `confirmed` 2 (`ssm-reg-rpc-security-search-path`, `ssm-reg-trigger-safety`); `partially confirmed` 6 (`ssm-reg-concurrency-short-locks`, `ssm-reg-retry-idempotency`, `ssm-reg-rls-role-denied-paths`, `ssm-reg-storage-policy-boundary`, `ssm-fresh-rls-storage`, `ssm-fresh-rpc-trigger-concurrency`); `rejected` 14 và giữ nguyên.
- Context correction: thêm `ctx-course-rpc-source`, `ctx-rls-trigger-source`, `ctx-ordering-rpc-source`; reuse `ctx-schema-history` cho source duy nhất chứa `handle_payment_success` cùng complete course/collaborator RLS helpers/policies, và `ctx-storage-bucket-migration` cho focused bucket/policy SQL. Catalog hiện `42 = 29 repository_file + 13 inline_text`.
- Neutrality: raw SQL không nhúng rubric/conclusion/route/veto/variant/future-reference answer; inline fact chỉ làm rõ SQL source là read-only implementation evidence, không phải migration change hoặc migration-history review.
- Frozen contract: 57 cases, exact `15/20/22`, mọi ID/allocation/lexical order/route/criterion/veto/variant/reference expectation/physical ownership giữ nguyên; routing suite và 14 rejected SSM cases không đổi.
- Verification: focused SSM valid cho 3 files/22 cases/0 diagnostics; synthetic package 22 cases/165 files; 12/12 added context instances exact-byte match, `PACKAGE_ERRORS=0`; runner `130/130`; structural validator `37/37`; repository validator 11 skills/0 errors/4 existing warnings; cumulative 5 skills/15 files/94 cases/0 diagnostics.
- Formal review: first pass tìm một `Required` vì course RPC source không chứa complete course/collaborator `USING`/`WITH CHECK` structure; đổi đúng RLS case sang `ctx-schema-history`, re-review đạt `0 Critical / 0 Required`, specialist `0`.
- Fresh-reader: `not_run`; direct source/package/diff evidence đã giải quyết material ambiguity, không model execution hoặc semantic grading.
- Delivery: semantic correction commit `bbf0d79d7fd2a5d198f179a77a537720544b9b7c` đã normal-push; local/upstream/actual remote cùng SHA, divergence `0/0`, worktree/index sạch; correction authority consumed.

## Historical PR #68 delivery transition gates

- Historical ASM-PR2A/2B/2C delivery and PR #65/#66/#67 merge gates: complete; every historical implementation/commit/push/PR/CI/merge grant is consumed.
- Historical transition entry condition: before delivery, the exact 20-case correction remained local on `audit/agent-skills-pr2abc-eval-contracts` and had to complete refreshed verification plus final full-diff audit.
- Delivery gate: only `0 Critical / 0 Required` plus all required checks passing activates exactly one commit, normal initial push, non-draft PR creation and initial required-check watch.
- CI exception: at most one completed fix attempt, only after logs confirm `branch-caused-small-safe`; every other classification stops without a fix.
- Post-delivery ownership: Git/GitHub/PR body/final report own exact SHA, upstream, PR and run evidence. Successful delivery consumes the conditional grant and creates no standing permission.
- At that transition checkpoint, merge/auto-merge, deployment, model/database action, destructive action, force-push, history rewrite and scope expansion remained ungranted.
- ASM-PR3 merge dependency is satisfied by PR #67, but ASM-PR3 and every later migration phase still require their own exact plan/implementation permissions; this correction grants none.
- Final delivery outcome: correction head `10268ef8199dc07d89e2710b9c0380d8d1e8ced4` was merged by PR #68 at `06d8d5bae3c9e857767c2d988fd45c57449b1d4f`; the conditional correction delivery grant is consumed.

## Historical post-delivery decision boundary

Merge vẫn là một owner decision riêng; review hoặc CI success không tự cấp merge/auto-merge permission. PR #68 đã được merge sau historical delivery transition, nhưng không tạo standing permission cho ASM-PR3.

## Historical pre-delivery Git status for PR #68

```text
Branch: audit/agent-skills-pr2abc-eval-contracts
Pre-delivery base/HEAD/main/origin/main: 81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb
Dependencies: PR #65/#66/#67 merged; merge commits are ancestors of main
Scope: exactly 20 semantic cases plus truthful ASM-PR2A/B/C and progress reconciliation
Frozen totals: 9 skills / 27 suite files / 177 cases
Verification gate: refreshed focused/cumulative validators, runner 130/130, structural tests 37/37, repository validator, 20-case semantic invariants, candidate-only preparation, diff and hygiene checks
Fresh-reader: not_run for the corrected artifact; prior audit readers remain finding evidence only
Specialist: 0
Delivery transition: pre-gate local audit -> one conditional commit/normal push/non-draft PR/initial watch -> authority consumed after success
CI fix boundary: at most one completed attempt after logged branch-caused-small-safe classification
Exact post-delivery evidence: Git/GitHub/PR body/final report; not predicted in this block
Database/model/deployment: not granted; not run
Merge/auto-merge/history rewrite/destructive/force-push/scope expansion: not granted; not run
```

Historical final PR2C head `9ff1a16a6619a1d9bd69ac43aac6638be2471a20` passed run `30877858346` and merged at `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb`. The pre-delivery block above intentionally did not predict correction identifiers; Git now establishes correction head `10268ef`, PR #68 and merge commit `06d8d5b`.

## Historical ASM-PR2B remaining action gates

ASM-PR1 và ASM-PR2A đã merge. ASM-PR2B dependency gate được thỏa tại `3cdbb440d7068c5280750f650cf0680a1992f3e0`; detailed plan đã được owner duyệt và CP2–CP5 implementation complete.

Các action gate chưa được cấp:

- ASM-PR2B PR creation/update, CI watch/log/fix hoặc merge; semantic correction delivery đã complete và không tạo standing authority;
- later implementation permission cho ASM-PR2C, ASM-PR3, ASM-PR4, ASM-PR5A, ASM-PR5B và ASM-PR6 khi dependency tới lượt;
- merge/auto-merge, deployment, production/database mutation, force-push và history rewrite;
- bất kỳ CI mutation nào; ASM-PR2B contract yêu cầu CI diff rỗng.

Technical safety invariant trong approved plan không phải yêu cầu owner phê duyệt unsafe alternative.

## Historical ASM-PR2B hành động tiếp theo

Không còn ASM-PR2B semantic correction delivery action nào mở. Hành động owner tiếp theo, nếu muốn, là quyết định riêng về PR creation/update, CI observation hoặc phase sau; chưa có authority cho các action đó.

## Historical ASM-PR2B Git status

Current ASM-PR2B implementation record:

```text
Branch: feat/agent-skills-asm-pr2b
Base: 3cdbb440d7068c5280750f650cf0680a1992f3e0
Dependency: PR #65 / ASM-PR2A merged at base
CP0: complete
CP1 discovery/planning/review/correction delivery: complete / owner-approved
Implemented cases: test-quality-strategy 15; nextjs-server-action-zod 20; supabase-safe-migration 22; total 57
Executor context catalog: 42 entries (29 repository_file + 13 inline_text); all 57 rows resolved
ASM-PR2B implementation: complete; CP2-CP5 and SSM observability correction verified
Suite implementation: 9 files / 57 cases
Checkpoint commits: 9d2251d; 34bd4d3; fc26f94; correction 1ea50dc; CP5 7dec9a1; SSM correction bbf0d79
SSM observability classification: 2 confirmed; 6 partially confirmed; 14 rejected
Verification: focused SSM 22/22; exact-byte package 12/12 additions; runner 130/130; structural validator 37/37; repository validator 11 skills/0 errors/4 existing warnings; validate --all 5 skills/15 files/94 cases/0 diagnostics
Formal review: 0 Critical / 0 Required; specialist 0; fresh-reader not_run
CI edit: none
Planning delivery: complete at 49691285df6f9ee6da119cd3bf98d746fef140b8 and b1e7aa352e59c2dd0c208eac6815d668eef4afa9
Planning edit/commit/push authority: consumed
SSM correction delivery: bbf0d79 committed and normal-pushed; local/upstream/actual remote aligned 0/0; clean worktree/index
Current delivery authority: consumed at bbf0d79; no standing ASM-PR2B delivery authority
PR/CI watch/fix/merge: not granted
Database/model/deployment: not granted; not run
Next owner action: optional PR/CI decision or later phase authorization; no standing authority
```

Historical ASM-PR2A delivery:

```text
Branch: feat/agent-skills-asm-pr2a
Final feature head: 7e63d94087a93bd0f79e2d484ff747903d3cab7a
PR: #65
Merged: yes
Merge: 3cdbb440d7068c5280750f650cf0680a1992f3e0
Historical planning/implementation/correction/commit/push authority: consumed
```

Historical ASM-PR1 delivery:

```text
Branch: feat/agent-skills-asm-pr1
Final branch commit: 7d172839d6166b8f78818550eb5d2a08491bd060
PR: #64
Merged: yes
Merge: cdfb9d321e4f595954d3db4ec02d1d1de2d1b030
Historical implementation/PR/CI permissions: consumed
```

Historical PR 3B delivery:

```text
Branch: feat/agent-skills-eval-runner
Head: fe653a10fb5b0cfbb27f69aa4748ef3b1994ce8b
PR: #62
Merged: yes
Merge: d8a67a1b1e015d44ab52095e823cd8334bf1fead
```

Historical PR 3A delivery:

```text
Branch: feat/agent-skill-governance-pr3a
Base: 37599ee600656e3fb519ef4fd14452c404c4e80d
Final head: af14511300cb0906199f88041f665a7d8a36fc3b
PR #54 merge: 9bc37722943ca02720ae37a38c935e8b98417614
Merge commit present in current origin/main: yes
Historical implementation/review permissions: consumed
Historical branch/pre-PR states: not current
```

Historical PR 2 delivery:

```text
Branch: feat/agent-skill-governance-pr2
Base: 31b681dbbfaee017fc6078fd2d165d19d862f1ac
PR 2 head: cd426b82e78beee3ba73cc1679180fa6b98cfb08
PR #53 merge: 37599ee600656e3fb519ef4fd14452c404c4e80d
Initial commit: bac967d093ea34bef31a0769494693fa28e6f5cf (pushed)
Validator correction commit: 7f78f48eb4b10f2453a8f2f2b45078fc1217722f (pushed)
CI routing correction commit: cd426b82e78beee3ba73cc1679180fa6b98cfb08 (merged)
Pull request: #53 merged
Deploy: no evidence and out of scope
```

Exact current staging, commit, push và pull-request state phải được kiểm tra từ Git/final checkpoint report; tracker này không tự chứng minh rằng chính nó đã được checkpoint.

## Quy tắc cập nhật

1. Chỉ cập nhật current-status summary và checkpoint bị ảnh hưởng.
2. Ghi exact command và actual verification outcome.
3. Phân biệt `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`.
4. Giữ intended scope và dependency trong master plan.
5. Label historical evidence và không trình bày như current state.
6. Không đánh dấu decision approved nếu không có explicit owner evidence.
7. Không tạo problem, deferred-work hoặc ADR file nếu chưa có concrete item cần ownership riêng.
8. Dùng date dạng `YYYY-MM-DD`.
9. Không dùng tracker này thay Git history hoặc pull request state.
