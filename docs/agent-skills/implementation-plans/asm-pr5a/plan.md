# ASM-PR5A — Detailed Implementation Plan: Planning and Review Governance Structural Migration

Plan này là durable execution specification đã được owner duyệt và thực thi trên `feat/agent-skills-asm-pr5a`. CP1–CP9 implementation/evidence/review/delivery đã complete; CP9 delivery checkpoint `adabf38adcedd0bb475b2c651bb1072f5bf74710` đã được normal-push và quyền push tương ứng đã consumed. Post-delivery RQ1/RQ2 corrections tồn tại dưới hai local commit riêng `fa7bd54bf2940f207450e4f9a1b1cdf2953c2912` và `910e7862050f31c39d03e8b5c86d268bdeeb8ccf`; quyền edit/stage/commit đã tạo hai commit này đã consumed. Không còn standing local correction hoặc remote authority. Mọi edit, stage, commit, push, PR, CI, merge, deploy, force-push, history rewrite hoặc scope expansion tiếp theo đều cần owner authorization mới.

## 1. Trạng thái và authority

| Trường | Giá trị hiện tại |
| --- | --- |
| Plan status | `approved; CP1–CP9 delivery complete; RQ1 accepted; RQ2 reconciled` |
| Planning date | `2026-08-08` |
| Planning và later-implementation branch | `feat/agent-skills-asm-pr5a` |
| Branch base | synchronized `main == origin/main == 461269b70d8b5a9623f30ec43005f2d085958f43` |
| Dependency | ASM-PR4 merged through PR #71 at `461269b`; dependency gate satisfied |
| Immutable behavioral baseline | `461269b70d8b5a9623f30ec43005f2d085958f43` |
| Discovery | `complete` |
| Final size | `Large/high-risk` for governance: two authority-owning skills, 44 current cases across six suites, mandatory comparative/fresh-reader evidence, cross-skill integration and distinct migration/RQ1 rollback boundaries |
| Planning permission | historical planning and planning-correction grants are consumed |
| Implementation permission | `consumed`; historical CP6–CP9 implementation/delivery grant và RQ1/RQ2 local edit/stage/commit grants đã hoàn tất qua `fa7bd54bf2940f207450e4f9a1b1cdf2953c2912` và `910e7862050f31c39d03e8b5c86d268bdeeb8ccf`; no standing local correction authority remains |
| Program fresh-reader authority | mandatory migration executions complete; evidence is recorded below |
| Planning specialist decision | `0`; direct repository, history, contract and frozen-suite evidence resolved the planning questions |
| Not granted | any further edit, stage or commit; further suite edits; validator/runner/schema/test changes; other tooling/CI/package/product/DB changes; push; PR creation/update; CI watch/fix; merge; deploy; force-push; destructive/history action; unrelated implementation or remote action |

Permission remains action-specific. Plan approval, implementation, stage/commit, push, PR, CI, merge and deployment are separate gates. A review status, verdict, confidence statement or successful test never grants an action.

Current-state precedence: section 1 and the post-delivery RQ1/RQ2 record in section 9 own the superseding state. Original baseline, discovery, execution, acceptance, rollback and review records remain below as historical checkpoint evidence; their `18/20`, `38`, `177` and six-byte-identical-suite facts must not be read as current after `fa7bd54`.

## 2. Goal and observable outcome

ASM-PR5A will structurally migrate exactly these two governance skills, sequentially:

```text
implementation-planning-and-pr-breakdown
→ code-review-and-quality
→ cumulative cross-skill final review
```

Each monolithic `SKILL.md` becomes a concise core plus exactly four directly routed references. The result must preserve behavior, ownership, permission boundaries, status/verdict semantics, stop conditions and reporting truthfulness while reducing default-load size. Every candidate must be independently reviewable and revertible. Success requires all frozen comparisons and deterministic gates to pass with `0 Critical / 0 Required`.

This is structural migration, not redesign. No rule may be weakened merely to reduce core length or improve an eval result.

## 3. Sources of truth and reader routing

- Repository instructions and lifecycle: [`../../../../AGENTS.md`](../../../../AGENTS.md) and [`../../../agent-loops.md`](../../../agent-loops.md).
- Program intent and immutable order: [`../../plan.md`](../../plan.md) and [`../../structural-migration-roadmap.md`](../../structural-migration-roadmap.md).
- Current program state: [`../../progress.md`](../../progress.md).
- Planning artifact convention: [`../README.md`](../README.md).
- Governance procedure: [`../../../../.agents/skills/maintain-repo-skills/SKILL.md`](../../../../.agents/skills/maintain-repo-skills/SKILL.md), plus its progressive-disclosure, fresh-reader and eval-design references.
- Planning owner: [`../../../../.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`](../../../../.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md).
- Review owner: [`../../../../.agents/skills/code-review-and-quality/SKILL.md`](../../../../.agents/skills/code-review-and-quality/SKILL.md).
- Git checkpoint owner: [`../../../../.agents/skills/git-checkpoint-workflow/SKILL.md`](../../../../.agents/skills/git-checkpoint-workflow/SKILL.md).
- Predecessor evidence and conventions: [`../asm-pr4/plan.md`](../asm-pr4/plan.md) and [`../asm-pr4/owner-review-brief.md`](../asm-pr4/owner-review-brief.md).
- Frozen suite design authority: [`../../pr-3a-eval-schema-plan.md`](../../pr-3a-eval-schema-plan.md), [`../../pr-3b-eval-runner-plan.md`](../../pr-3b-eval-runner-plan.md) and the ASM-PR2C audit recorded in [`../../progress.md`](../../progress.md).

The roadmap owns candidate allocation, target bundle, dependency, exclusions, completion and rollback. This plan owns exact ASM-PR5A execution. The owner brief summarizes material decisions and cannot override this plan silently. Any material owner change must be reconciled into both artifacts and re-reviewed before implementation.

## 4. Confirmed repository baseline

### Git and dependency

- Initial unrelated branch was clean; no staged, unstaged or untracked work required preservation.
- `git fetch origin --prune` refreshed remote state.
- ASM-PR4 branch head is an ancestor of `origin/main`; PR #71 merge commit is `461269b`.
- Local `main` was synchronized by the repository-approved `git pull --ff-only origin main` workflow.
- `feat/agent-skills-asm-pr5a` was created directly from synchronized `main`; initial `HEAD`, `main`, `origin/main` and merge-base all equal `461269b`.
- The same branch is reserved for this planning checkpoint and any later separately authorized implementation. No second implementation branch is planned.

### Immutable target and suite blobs

All hashes below are Git blobs at `461269b`. They are the implementation precondition, not merely informational snapshots.

| Artifact | Baseline blob |
| --- | --- |
| `implementation-planning-and-pr-breakdown/SKILL.md` | `5cb23dd06559e11dda5d39b647a406684e383f1d` |
| `code-review-and-quality/SKILL.md` | `cbf21a8d238ba08cedbdcfe2b63052caaeecc8da` |
| IPPB `regression.json` | `5847f848acf3dd2c5f43f957286c1ba5f9d1bc5b` |
| IPPB `routing.json` | `85894d7f594841d3836442943e69627b7f8ec2b6` |
| IPPB `fresh-reader.json` | `fa35dc3688995cb04480cff57cb029cfa3ad5bbd` |
| CRQ `regression.json` | `d32a480498f20d56cf3b684ff6f7a79fd5d2de4c` |
| CRQ `routing.json` | `f7110125e00a18b265c4a36f1e524a012bbb28a9` |
| CRQ `fresh-reader.json` | `e92655411c59b4e0cba148f1e5e9a7e252a06ffe` |

Both cores and all six suites are unchanged across the ASM-PR4 range from `c8e4245` to `461269b`. If any core or suite blob differs before implementation, stop, reconcile the new upstream fact and re-review the affected plan boundary before editing.

### Deterministic readiness

On Node `v20.19.0` at planning baseline:

- structural-validator tests: `37/37` pass;
- eval-runner tests: `130/130` pass on the conclusive escalated run (`211724.6899 ms`);
- repository validator: `11 skills / 0 errors / 2 warnings`; both warnings are expected `CORE_LENGTH_SIGNAL` for the two target monoliths (`606` and `575` lines);
- IPPB focused validation: `1 skill / 3 files / 18 cases / 0 diagnostics`;
- CRQ focused validation: `1 skill / 3 files / 20 cases / 0 diagnostics`;
- cumulative validation: `9 skills / 27 files / 177 cases / 0 diagnostics`.

The eval-runner unit test first failed inside the filesystem sandbox with `EPERM` while resolving the user-profile parent; an escalated rerun removed that error class but exceeded the initial 180-second timeout. A final escalated run with a sufficient bounded timeout completed `130/130` pass. The earlier attempts are environment/tooling noise, not repository failures; only the conclusive run is pass evidence.

## 5. Discovery conclusions

### Confirmed facts

- Roadmap order, two candidates, exact four-reference allocation per skill, frozen-suite policy and independent rollback requirements remain current.
- ASM-PR2C already approved and audited the exact target suites. The current six files contain `38` cases: IPPB `8 regression + 6 routing + 4 fresh-reader = 18`; CRQ `9 + 6 + 5 = 20`.
- Every proposed reference has positive selection coverage and meaningful negative skip coverage. Both skills include all-skip controls.
- Current runner is deterministic orchestration only. It validates, packages and reports; it does not execute or grade a model. `synthetic` packaging is not isolation.
- Resource access evidence must distinguish availability, supply and read. `operator_observation`, `executor_self_report`, `unknown` and `not_run` must not be upgraded into stronger claims.
- The current monoliths are the immutable behavioral baseline. A later partially migrated working tree must never replace `461269b` as another candidate's baseline.

### Resolved assumptions

- The frozen suites are sufficient for ASM-PR5A execution. The case-by-case audit covers the approved references, skip groups, ownership, permission, read-only, status/verdict, stop and reporting invariants. No correction to ASM-PR2C is required now.
- Bug-fix and refactor cases provide positive coverage for the `special-review-cases` route; the preserved structural-content audit protects dead-code and dependency procedures even though those variants are not separate frozen case IDs.
- The current `CORE_LENGTH_SIGNAL` warnings are readiness signals, not success criteria. A smaller core is acceptable only after semantic evidence; warning removal alone proves nothing.
- No planning specialist is materially useful. Direct evidence resolves scope, routing and control-plane contracts. This decision does not waive mandatory migration fresh-reader evidence.
- Finding 1 is `correct in scope`: the proposed specialist-reference rows moved the decision trigger too far out of core, while the roadmap and progressive-disclosure contract require core to decide whether the reference is needed. Frozen specialist/default-zero cases support the corrected boundary and do not require suite edits.
- Finding 2 is `correct in scope`: the five-checkpoint plan combined structural split, candidate evaluation and behavioral correction inside one per-skill checkpoint, contrary to the roadmap's structural-only first-migration rule and ASM-PR4's baseline/structural/evidence precedent.

### Conflicts and open questions

- The two confirmed planning-contract conflicts are resolved by the corrected target bundle and nine-checkpoint sequence below; no implementation artifact has changed.
- No material design question remains for owner selection beyond approve/revise/reject and separately granting implementation.
- No readiness gap remains after the conclusive `130/130` runner-test pass.

## 6. Exact future implementation scope

### Allowed only after separate owner implementation permission

- Edit exactly two target cores.
- Create exactly eight approved direct regular-file references under the respective `references/` directories.
- Reconcile this plan, its owner brief and current `progress.md` with actual checkpoint evidence.
- Run validator, runner, bounded model/fresh-reader evidence and read-only review needed by the nine checkpoints.
- Create coherent local rollback commits only if exact commit permission is granted.
- Use the same `feat/agent-skills-asm-pr5a` branch.

### Excluded

- Changes to any of the six frozen suite definitions, prompts, contexts, criteria, expected/forbidden behavior, vetoes, routes or case identities.
- Validator runtime, thresholds, diagnostic semantics, runner, schemas, runner tests, validator tests, CI, packages or shared tooling.
- `git-checkpoint-workflow`, `github-pr-ci-workflow`, other skills or other references.
- Actual Git/GitHub action as migration behavior, PR/CI automation, product/frontend/server/database/Supabase code, migrations, fixtures, deployment or production action.
- Token-reduction, native-triggering, isolation or performance claims not supported by direct evidence.

If a frozen-suite gap is discovered, stop the affected migration. Do not edit a suite to make the candidate pass. Open a separately reviewed coverage correction, merge it, re-pin the baseline and restart the affected candidate.

## 7. Target bundle contracts

### `implementation-planning-and-pr-breakdown`

Core must retain, in directly readable form:

- activation scope and planning ownership;
- related-skill and resource routing;
- discovery/read-only behavior;
- separation of plan, implementation and Git/remote permission;
- main workflow fundamentals;
- confirmed fact, assumption, conflict and open-question taxonomy;
- two-pass sizing, dependency and slicing fundamentals;
- acceptance, verification, scope control, stop/red-flag, output and final-checklist rules;
- a concise post-self-review specialist gate that defaults to `0` and requires a concrete owning-skill hard-risk signal or explicit owner request, material residual uncertainty, insufficient main evidence, one bounded cluster/questions, expected benefit, current permission and main-agent reconciliation ownership.

| Reference | Exact read condition | Content moved | Required skip groups |
| --- | --- | --- | --- |
| `references/tracked-program-and-durable-plan.md` | Read when work belongs to a tracked multi-session/multi-PR program or needs durable plan/progress ownership | source routing, tracked reconciliation, durable document/status ownership | standalone small/medium work with no tracked program |
| `references/pr-breakdown-and-handoff.md` | Read when splitting work into PRs/phases/prompts or producing a transferable implementation brief | PR boundary, prompt/output templates and handoff procedures | discovery answer with no PR split or handoff artifact |
| `references/qa-fixture-readiness.md` | Read when a plan contains data-dependent manual QA or fixture/seed readiness decisions | QA fixture readiness procedure and template | no data-dependent manual QA |
| `references/specialist-plan-review.md` | Read after main plan self-review only when the concise core gate leaves a materially viable specialist candidate, and before deciding, packaging, executing, or reconciling that action | detailed plan-specific risk clustering, decision/source/exclusion/permission/quota record and feedback reconciliation; reusable package/reviewer/claim-label procedure remains routed to CRQ | default `0` plans and reviewed plans with no candidate passing the core gate |

Frozen selection audit across 18 cases:

- tracked: `11 selected / 7 skipped`;
- handoff: `7 / 11`;
- QA fixture: `2 / 16`;
- specialist plan review: `1 / 17`.

### `code-review-and-quality`

Core must retain, in directly readable form:

- activation scope and review ownership;
- read-only default and fix/re-review permission separation;
- approval standard and exact review-range requirement;
- main workflow and change-set audit fundamentals;
- `Critical`, `Required`, `Suggestion`, `Nit` and `FYI` meanings;
- verification status meanings, including truthful `not_run`/blocked handling;
- verdict meanings and the rule that approval/confidence/test/verdict never grants action;
- re-review and final-checklist rules;
- review levels and applicable main-review-depth/reclassification rules, including the small/low-risk specialist-decision skip;
- a concise post-main-review specialist gate that defaults to `0` and requires a concrete owning-domain hard-risk signal or explicit owner request, material residual uncertainty, insufficient main evidence, one bounded cluster/questions, expected benefit, current permission and main-reviewer reconciliation ownership.

| Reference | Exact read condition | Content moved | Required skip groups |
| --- | --- | --- | --- |
| `references/domain-review-dimensions.md` | Read when formal/integration review materially includes validation, DB/concurrency, frontend/UX, tests, security, performance, comments or Git | detailed domain review dimensions | small docs/metadata review with none of these boundaries |
| `references/special-review-cases.md` | Read when reviewing a bug fix, refactor, dead-code removal or dependency change | special-case review procedures | feature/checkpoint review without those change types |
| `references/specialist-review.md` | Read after the applicable main review only when the concise core gate leaves a materially viable specialist candidate, and before deciding, packaging, executing, or reconciling that action | detailed risk clustering, quota/deduplication, bounded package, reviewer behavior, reconciliation and claim labels | default main-only reviews and reviewed work with no candidate passing the core gate |
| `references/review-report-templates.md` | Read for a formal multi-finding report or specialist package needing the full template | finding format and verbose report template | small no-actionable-finding or compact-verdict review |

Frozen selection audit across 20 cases:

- domain dimensions: `10 selected / 10 skipped`;
- special cases: `2 / 18`;
- specialist review: `3 / 17`;
- report templates: `7 / 13`.

## 8. Cross-skill and invariant matrix

| Invariant | Required implementation behavior |
| --- | --- |
| Planning ownership | IPPB owns discovery, dependency, slicing, durable plan and implementation brief; it routes, but does not perform implementation or Git action |
| Review ownership | CRQ owns review range, findings, verification status and verdict; it remains read-only unless exact fix permission exists |
| Specialist default | Both cores preserve default `0` and the complete minimum gate needed to decide read/skip; CRQ core also owns review-level selection and applicable-main-depth/reclassification rules; references contain only detailed bounded procedures after a candidate passes that gate |
| Planning specialist route | IPPB core owns the plan-specific candidate gate and reconciliation decision; its reference records detailed plan-risk procedure, while CRQ core/reference own the reusable review package, reviewer behavior and claim labels |
| Git/GitHub overlap | CRQ may inspect Git/PR evidence for review; Git and GitHub skills own mutations and remote workflow; a verdict grants neither |
| Data-dependent QA | IPPB plans readiness and routes frontend/test/Supabase owners as applicable; it must not invent fixtures or silently grant DB action |
| Validation/integration | Next.js/Zod, Supabase and test skills retain their domain ownership; CRQ integrates findings without taking over those implementation contracts |
| Status truth | `pending`, `complete`, `blocked`, verification statuses and review verdicts reflect observed evidence only and never imply permission |
| Stops | Missing range, missing evidence, unresolved dependency, changed baseline, suite gap, unsafe permission or material cross-skill conflict stops the affected checkpoint |

## 9. Nine sequential checkpoints

The checkpoint count follows real state boundaries, not ceremony. `461269b` is always the behavioral baseline. A separate full SHA named `<implementation-start-head>` is recorded at implementation start solely to define Git review ranges; it is the branch `HEAD` after the completed planning correction and before any target-skill edit.

### Checkpoint 1 — Baseline and readiness

Planning state: `complete`, subject to owner implementation approval and a fresh implementation-start recheck.

1. Reconfirm clean branch, `HEAD` ancestry, merge-base and dependency.
2. Record full `<implementation-start-head>` and require it to contain `461269b`.
3. Recheck two core and six suite blobs against `461269b`.
4. Run validator tests, eval-runner tests, repository validator, focused and cumulative suite validation.
5. Confirm exact scope, frozen-suite sufficiency and implementation/evidence/checkpoint permission.
6. Stop if runner tests, suite validation, baseline integrity, exact start SHA or permission are unresolved.

Implementation may begin only after owner approves the corrected material plan and explicitly authorizes the implementation/evidence/commit boundary.

### Checkpoint 2 — IPPB immutable monolith baseline

1. Reconfirm the IPPB core and suite trio match the eight-artifact table at `461269b`.
2. Prepare the candidate-only monolith workspace using the exact control-plane form in section 10 with `--candidate-ref 461269b... --no-baseline`.
3. Execute and assess all 18 baseline cases read-only; record case/resource evidence and limitations without a comparison or improvement claim.
4. Keep raw evidence transient. Stop on invalid provenance, suite/context drift, safety veto or a coverage gap.
5. No target skill/reference edit occurs in this checkpoint.

### Checkpoint 3 — IPPB structural-only migration

1. Split only the approved four references using verbatim-first moves and minimal heading/link adaptation.
2. Keep every concise mandatory core rule, including the complete specialist read/skip gate; do not add semantic clarification, behavior cleanup or example rewrite.
3. Audit moved-content equivalence, exact read conditions, positive/skip groups, direct links, containment, regular-file shape, UTF-8/no-BOM and final newlines.
4. Run structural validator and focused/all suite-definition validation only; do not execute candidate semantic/fresh-reader evaluation yet.
5. Review the structural worktree first and fix only structural-move defects. Under exact commit permission, create the distinct structural checkpoint and record its full SHA as `<ippb-structural-head>`.
6. Perform the final structural review over exactly `<implementation-start-head>..<ippb-structural-head>`. Any needed behavioral/routing clarification is deferred to Checkpoint 4 and must not amend/rewrite this checkpoint.

### Checkpoint 4 — IPPB semantic evidence, correction and accepted rollback boundary

1. Prepare the comparative workspace using `--candidate-current-tree --baseline-ref 461269b...`; the runner supplies one current-tree control plane to both opaque variants.
2. Execute both variants for all 18 cases under equivalent disclosed conditions, including all four mandatory fresh-reader cases. Default to a fresh baseline execution in this comparative workspace.
3. A Checkpoint 2 baseline response may be reused only after exact package/context/policy/bundle equality is mechanically established, the response bytes remain verbatim, the current workspace identity/provenance is recorded, and cross-workspace reuse is disclosed; otherwise rerun it.
4. Generate the immutable report only from complete schema-valid observations, resource evidence and human proposals. Require zero veto, regression, failed or materially inconclusive case.
5. Behavioral/routing clarification starts only here. Preserve every unfavorable result; invalidate and rerun all affected candidate evidence/report after each correction.
6. Formal accepted-skill review range is exactly `<implementation-start-head>..<ippb-accepted-head>` and includes the structural checkpoint plus any new correction/status commits. Never amend the structural commit.
7. Gate: deterministic pass, complete semantic/resource evidence and `0 Critical / 0 Required`.
8. If no file correction or status update is needed, do not create an empty acceptance commit; `<ippb-accepted-head>` may equal `<ippb-structural-head>`. Otherwise use new coherent correction commit(s).
9. Rollback boundary is the IPPB core, four references and truthful status reconciliation in the exact range above; CRQ has not started.

### Checkpoint 5 — CRQ immutable monolith baseline

1. Reconfirm the CRQ core and suite trio still match `461269b`; the accepted IPPB tree is not the CRQ behavioral baseline.
2. Prepare the candidate-only monolith workspace with `--candidate-ref 461269b... --no-baseline`.
3. Execute and assess all 20 baseline cases read-only with no comparison/improvement claim.
4. Keep raw evidence transient and stop on provenance, suite/context, veto or coverage failure.
5. No CRQ core/reference edit occurs in this checkpoint.

### Checkpoint 6 — CRQ structural-only migration

1. Split only the approved four references with verbatim-first moves and minimal heading/link adaptation.
2. Keep read-only, severity, verification-status, verdict, no-permission, re-review and the complete specialist read/skip gate in core; make no semantic clarification or example rewrite.
3. Run moved-content, route/skip, link/containment/file/encoding audits plus structural and focused/all suite-definition validation; defer candidate semantic execution.
4. Review the structural worktree first and fix only structural-move defects. Under exact commit permission, create the distinct structural checkpoint and record its full SHA as `<crq-structural-head>`.
5. Perform the final structural review over exactly `<ippb-accepted-head>..<crq-structural-head>`. Behavioral/routing corrections belong to Checkpoint 7 and may not amend/rewrite it.

### Checkpoint 7 — CRQ semantic evidence, correction and accepted rollback boundary

1. Prepare the comparative workspace with `--candidate-current-tree --baseline-ref 461269b...` and execute both variants for all 20 cases, including all five mandatory fresh-reader cases.
2. Apply the same default-fresh-baseline and tightly disclosed reuse rule as Checkpoint 4.
3. Require complete immutable report evidence, truthful resource provenance and zero veto, regression, failed or materially inconclusive case.
4. Start any behavioral/routing clarification only here; preserve unfavorable results and rerun invalidated evidence/report after each correction.
5. Formal accepted-skill review range is exactly `<ippb-accepted-head>..<crq-accepted-head>` and contains the CRQ structural checkpoint plus any new correction/status commits.
6. Gate: deterministic pass, complete semantic/resource evidence and `0 Critical / 0 Required`.
7. Avoid an empty acceptance commit when `<crq-structural-head>` already represents the accepted state; otherwise create new correction commit(s), never amend the structural checkpoint.
8. Rollback CRQ through this exact range without reverting accepted IPPB work or weakening suites.

### Checkpoint 8 — Cumulative cross-skill final review

1. Review exactly `git diff <implementation-start-head>..<crq-accepted-head>` and `git log --oneline <implementation-start-head>..<crq-accepted-head>`; record both resolved full SHAs before verdict. Do not substitute `461269b` for this Git range.
2. Keep semantic comparison provenance separate: every base-versus-candidate report still uses immutable behavioral baseline `461269b`.
3. Re-audit the invariant matrix, exact 10-file target shape (`2 cores + 8 references`), cross-links, resource routing, permissions, statuses, verdicts, stop behavior and report truthfulness.
4. Re-run validator tests, runner tests, repository validator, both focused suites, cumulative validation and `git diff --check`.
5. Verify all six frozen suite blobs remain byte-identical to `461269b` and no excluded path changed.
6. Reconcile plan, brief and progress with observed evidence only.
7. Perform a final fresh-context review pass over the exact cumulative range after corrections. A same-agent pass must not be labeled an independent reviewer; only a genuinely separate executor may receive that claim label.
8. Gate: `0 Critical / 0 Required`; otherwise stop and correct within the affected skill boundary or escalate.

### Checkpoint 9 — Delivery state

1. Stop for owner delivery decision after implementation gate; a passing review does not imply push, PR or merge.
2. If owner later authorizes one final normal push, verify branch/upstream/divergence and push without force.
3. PR creation/update, CI watch/fix and merge require separate explicit authority.
4. Record actual delivery state and consumed permissions in plan, brief and progress.
5. ASM-PR5B remains dependency-blocked until ASM-PR5A is merged into `main`; an implementation commit or pushed branch is insufficient.

### CP6–CP9 execution record — `2026-08-09`

- Implementation start: `f30fbc5133a0978247ced2ad6fdec557de586f39`; immutable semantic baseline remains `461269b70d8b5a9623f30ec43005f2d085958f43`.
- Accepted IPPB rollback range: `f30fbc5133a0978247ced2ad6fdec557de586f39..b0423355330059d49592c9e07d8a403262bdd207`. Structural checkpoint `a32fb77f5fd9910bb3616e534aed3973c4167805`; correction checkpoint `b0423355330059d49592c9e07d8a403262bdd207`. Final comparative report: `18/18 passed`, `18 equivalent`, fresh-reader `4/4`, evidence complete, SHA-256 `85e8bf45cbd790822e220b8bf5b545c9509f8e63df6da1195a1debc3cbd1c336`.
- CP5 CRQ immutable-monolith baseline remained accepted at `19 passed / 1 partially_passed`; the partial was `crq-fresh-specialist-package` and was intentionally preserved through CP6.
- CP6 structural checkpoint: `11c30b143e0a4d1417fe0641b283846c988b7f96` (`refactor(agent-skills): split code review guidance`). It created exactly four CRQ references, preserved moved content and core invariants, and was not amended or rewritten.
- CP7 correction checkpoint and CRQ rollback head: `5c962b5dc0c770a57b9f39920dd3051983d5e298` (`fix(agent-skills): clarify code review resource routing`). Final report workspace input hash `38310e4b3c835704fe7d2184c27f48cb70d5cc0f61a7c79a6709768d118852b5`; report `20/20 passed`, `20 equivalent`, fresh-reader `5/5`, evidence complete, SHA-256 `24157bc27426152560b4ae5ec66eb22dab4498176e2a835a31d4e1f9310d8e11`. The prior specialist-package partial is corrected: the package uses one bounded specialist reviewer and explicitly avoids unsupported `fresh-reader` or `independent review` labels.
- CP8 reviewed exact range `f30fbc5133a0978247ced2ad6fdec557de586f39..5c962b5dc0c770a57b9f39920dd3051983d5e298`. Final shape is exactly `2 cores + 8 direct regular-file references`; six frozen suites match `461269b`; validator `37/37`; runner `130/130` on the conclusive unsandboxed fixture run; repository validator `11/0/0`; focused IPPB `18/0`; focused CRQ `20/0`; cumulative `9 skills / 27 suites / 177 cases / 0 diagnostics`; `git diff --check` passes. Main and separate fresh-context reviews both reached `0 Critical / 0 Required`; verdict `Approved` for the exact 10-file implementation range.
- CP9 delivery completed through `adabf38adcedd0bb475b2c651bb1072f5bf74710`, which was successfully normal-pushed to `origin/feat/agent-skills-asm-pr5a`. That exact push grant is consumed. PR creation/update, CI watch/fix, merge and deployment remain unauthorized. ASM-PR5B remains merge-blocked.

### Post-delivery RQ1/RQ2 correction record — `2026-08-10`

- RQ1 coverage investigation proved that the prior suites could not distinguish explicit-prompt routing from evidence-discovered routing. Fresh-reader evidence confirmed one actual under-read: IPPB discovered a required multi-PR split but skipped `pr-breakdown-and-handoff.md` because the owner prompt had not named the split.
- The owner authorized a narrow exception to the earlier frozen-suite restriction. Commit `fa7bd54` (`fix(agent-skills): route evidence-discovered planning handoffs`) changes exactly IPPB `routing.json`, CRQ `routing.json` and the IPPB route condition. The routing suites add three cases each; no regression/fresh-reader suite, shared tooling, CI, product or database artifact changed.
- Current authoritative suite state is IPPB `21 cases / 0 diagnostics`, CRQ `23 cases / 0 diagnostics`, cumulative `9 skills / 27 files / 183 cases / 0 diagnostics`. Validator tests are `37/37`; runner tests are `130/130`; repository validator is `11 skills / 0 errors / 0 warnings`; RQ1 review is `0 Critical / 0 Required`.
- The IPPB and CRQ routing suites are no longer byte-identical to `461269b`. The four regression/fresh-reader suites remain byte-identical, and `461269b` remains the immutable behavioral baseline for the original migration comparisons and migrated-skill behavior where applicable. Historical `18/20`, `38` and `177` records below remain truthful for their original checkpoints but are not the current suite totals.
- RQ2 is confirmed: durable state incorrectly retained CP9 as pending and its normal-push permission as active after successful remote delivery. Commit `910e7862050f31c39d03e8b5c86d268bdeeb8ccf` records that correction separately from RQ1. The RQ1/RQ2 edit/stage/commit grants are consumed, no standing local correction or remote authority remains, and any further edit, stage, commit, push, PR, CI, merge, deployment, force-push or history rewrite requires new explicit owner authorization. The docs-only authority reconciliation that records this consumed state is single-use and leaves no standing authority after its local commit.

## 10. Evidence strategy

### Deterministic evidence

Required at each applicable checkpoint:

- `node --test .agents/scripts/validate-skill.test.mjs`;
- `node --test .agents/scripts/run-skill-evals.test.mjs`;
- `node .agents/scripts/validate-skill.mjs`;
- focused `run-skill-evals.mjs validate --skill <target>`;
- cumulative `run-skill-evals.mjs validate --all`;
- exact blob, regular-file, link, containment, encoding/newline, secret/debug/conflict-marker, scope and `git diff --check` audits.

### Semantic and fresh-reader evidence

- Candidate-only monolith baseline command per skill:

  ```text
  node .agents/scripts/run-skill-evals.mjs prepare --skill <skill> --isolation synthetic --candidate-ref 461269b70d8b5a9623f30ec43005f2d085958f43 --no-baseline
  ```

- Comparative candidate command per skill:

  ```text
  node .agents/scripts/run-skill-evals.mjs prepare --skill <skill> --isolation synthetic --candidate-current-tree --baseline-ref 461269b70d8b5a9623f30ec43005f2d085958f43
  ```

- Report only the opaque workspace returned by `prepare`:

  ```text
  node .agents/scripts/run-skill-evals.mjs report --workspace <workspace-id>
  ```

- The current-tree suite trio, hidden criteria and repository contexts form the single captured control plane for both variants; ref selectors choose only skill bundles. Every `prepare` must run from the exact Git worktree root with unchanged relevant inputs.
- Use the same model class and equivalent instruction/context class for baseline and candidate.
- Prepare blind packages from exact immutable baseline and current candidate; never expose which variant is expected to win.
- Execute every frozen case for its skill, not only the mandatory fresh-reader subset.
- Require all mandatory fresh-reader cases: IPPB `4/4`, CRQ `5/5`.
- Preserve unfavorable observations. Any material candidate correction invalidates affected candidate evidence and report; rerun them.
- Record availability, supply and read provenance separately. Do not infer a read from package availability.
- Generate the runner report only from complete, schema-valid artifacts. Keep raw workspaces/reports transient unless a later explicit contract says otherwise.
- Do not claim enforced isolation, runner-executed model work, native routing, token saving or semantic improvement without direct evidence.

Comparative veto per skill: stop on any safety veto, failed candidate, regression, materially inconclusive outcome, missing required resource evidence, changed frozen suite or unresolved provenance contradiction.

## 11. Historical migration acceptance criteria

These criteria describe the accepted CP8 migration snapshot. Items 5–6 were true at that checkpoint; the explicit post-delivery RQ1 coverage exception in section 9 supersedes only the current suite-byte/count state without rewriting CP8 history or changing `461269b` as the behavioral baseline.

1. Only the two approved skills are migrated, in the approved order.
2. Final shape is exactly two concise cores plus eight approved direct references.
3. Every mandatory core rule and cross-skill invariant remains explicit and behaviorally preserved.
4. Every reference has an exact core route with a positive read condition and meaningful skip condition.
5. All six suites remain byte-identical to baseline and validate as `18` and `20` cases.
6. Baseline/candidate comparisons execute all 38 cases and mandatory fresh-reader subsets with zero veto, regression, failed or material inconclusive outcome.
7. Resource evidence and execution status are truthfully labeled.
8. Each skill has a distinct reviewed structural-only checkpoint before semantic execution; later behavioral/routing clarification uses a new correction boundary and never rewrites that checkpoint.
9. Each accepted per-skill range reaches `0 Critical / 0 Required` before the next skill starts.
10. Cumulative final review uses exact resolved `<implementation-start-head>..<crq-accepted-head>`, reaches `0 Critical / 0 Required` and passes deterministic gates.
11. No excluded path, behavior or remote action is included.
12. Durable docs reconcile actual status and permissions without stale current-state claims.
13. ASM-PR5A implementation does not begin from this planning instruction alone.

## 12. Risks and controls

| Risk | Control |
| --- | --- |
| Moving authority rules out of default context | Mandatory core-retention matrix plus regression/fresh-reader comparison |
| Over-reading references | Explicit skip groups, routing suites and resource read evidence |
| Under-reading specialist procedures | Positive specialist cases and core signal after main self-review |
| Circular specialist routing | Keep the complete minimum candidate gate in core; read the reference only after that gate yields a viable candidate and before detailed decision/package/reconciliation |
| Review verdict accidentally grants action | Keep no-permission rule in core and audit all status/verdict wording |
| Later candidate uses partial tree as baseline | Pin every comparison to `461269b` |
| Suite edited to fit candidate | Six blobs frozen; any diff stops migration |
| Cross-skill ownership drift | Cumulative invariant matrix review after both checkpoints |
| Evidence overclaim | Separate availability/supply/read and preserve `unknown`/`not_run` |
| Large coupled rollback | Per-skill checkpoint commits and bundle-level revert boundaries |
| Structural split mixed with behavior correction | Separate monolith baseline, structural-only commit, and later semantic/correction acceptance; correction never amends structural history |
| Upstream changes after planning | Re-fetch/reconcile and re-review if any protected blob changes |
| Windows sandbox/test variability | Record sandbox failures separately and require a conclusive escalated runner-test result before execution |

## 13. Stop conditions and rollback

Stop the affected checkpoint before further edits, evidence claims, commit or delivery when:

- ASM-PR4 merge ancestry or branch baseline no longer holds;
- implementation or required evidence permission is absent;
- any protected core/suite blob changes without reconciliation;
- a frozen-suite gap or contract conflict appears;
- a candidate produces a safety veto, regression, failure or material inconclusive result;
- resource provenance cannot support the claimed read/skip behavior;
- a Critical/Required finding remains;
- a requested correction crosses into suites, tooling, CI, product or DB scope;
- semantic clarification starts before the affected structural-only checkpoint is reviewed/recorded, or a correction would rewrite that checkpoint;
- deterministic control-plane tests remain inconclusive;
- the two durable artifacts disagree materially.

Rollback is bundle-level and independent:

- IPPB rollback = exact `<implementation-start-head>..<ippb-accepted-head>` bundle for its core, four references and truthful status reconciliation.
- CRQ rollback = exact `<ippb-accepted-head>..<crq-accepted-head>` bundle for its core, four references and truthful status reconciliation.
- Never weaken or delete frozen suites during rollback.
- If a shared/cumulative conflict cannot be isolated, stop the whole ASM-PR5A implementation and return to the last accepted checkpoint.

## 14. Initial planning review record

### Author self-review

Review range: complete ASM-PR5A planning diff against `461269b`.

Required checks:

- branch/dependency/baseline facts and eight protected blobs;
- exact target bundle/read/skip/core-retention contracts;
- frozen-suite count, coverage and sufficiency conclusion;
- permission, read-only, status/verdict and rollback invariants;
- the original five-checkpoint sequence, evidence invalidation and stop behavior; section 15 records the later correction to nine checkpoints and exact review ranges;
- source links, path existence, UTF-8, final newline, fences, stale/current language, secrets/conflict markers and `git diff --check`.

Initial complete-diff findings: `0 Critical / 1 Required`. ASM-PR4 top-level status had been reconciled to merged, but several nested labels in its plan/brief and two progress entries still described historical instructions as `Current`. That wording could falsely imply standing authority.

Correction: relabeled the material ASM-PR3/ASM-PR4 branch, permission, decision, baseline and instruction statements as historical; preserved the evidence and recorded all grants as consumed. Stale-state rescan found no remaining open-PR, current audit-correction or dependency-blocker claim.

Self-review recheck: eight protected blobs match `461269b`; suite IDs are unique `18/18` and `20/20`; all eight reference selection/skip counts match section 7; exact six-file planning scope, links, encoding/newlines and fences pass. Final self-review findings: `0 Critical / 0 Required`.

Planning specialist decision remains `0`; no unresolved hard-risk cluster requires a bounded specialist package. Planning fresh-reader/model eval is `not_run` because direct repository and deterministic evidence resolves the plan; mandatory execution fresh-reader requirements remain unchanged.

### Final separate-pass review

After author self-review corrections, reopen the complete diff from baseline and review it without relying on authoring notes. This is a fresh-context main-agent pass, not a claim of a separate independent reviewer. Record exact range, evidence, findings, corrections and final verdict. Planning commit/push is allowed only at `0 Critical / 0 Required`.

Initial final-pass findings: `0 Critical / 1 Required`. One ASM-PR4 heading and one authority-table row still used current/future wording around a historical consumed grant. They were relabeled as historical and explicitly non-standing.

First final re-review findings: `0 Critical / 1 Required`. The tooling-noise record retained a machine-specific absolute user-profile path. It was generalized while preserving the exact `EPERM` classification and conclusive `130/130` evidence.

Terminal final re-review range: complete six-file staged planning diff against `461269b`. Exact scope `6/6`, protected blobs `8/8`, unstaged changes `0`; stale-authority, absolute-path, link, UTF-8/no-BOM, final-newline, fence and excluded-scope audits pass; `git diff --cached --check` passes. Refreshed validator is `37/37`, focused suites are `18/20`, cumulative validation is `9/27/177/0`, and the conclusive runner test remains `130/130`. Findings: `0 Critical / 0 Required`. Verdict: `Approved` for the owner-authorized planning checkpoint commit and normal push only.

This terminal pass is a separate fresh-context main-agent review over the cached diff. No separate executor was used, so the record does not claim formal independent-reviewer identity. Direct evidence is sufficient for the planning gate; this limitation does not weaken mandatory independent fresh-reader evidence during later migration execution.

## 15. Historical planning-correction review record

Correction range starts at planning checkpoint `28c66e813dacf3cdde51ac620dda274c41385d25` and includes only roadmap, ASM-PR5A plan/brief and current progress sources. Master plan, index, ASM-PR4 historical artifacts, target cores, frozen suites, runner/tooling, CI, product and DB remain excluded because their owned contracts do not require a correction.

Finding classification:

- Finding 1 — circular specialist-reference routing: `correct in scope`. Roadmap global rules require the minimum reference-selection decision in core and exact pre-decision conditions. The prior target rows omitted most of that gate from core while asking the reference to decide when specialist review was materially considered. Correction keeps the concise viable-candidate gate in each core and moves only detailed clustering/package/quota/reviewer/reconciliation procedure to references.
- Finding 2 — structural migration mixed with behavioral correction: `correct in scope`. The prior per-skill checkpoints combined baseline, split, semantic evidence and correction. Correction introduces distinct monolith-baseline, structural-only and semantic/correction/accepted-rollback states per skill, following roadmap and ASM-PR4 precedent.

At this historical planning-correction checkpoint, frozen suites remained authoritative and unchanged: their default-zero/all-skip cases and positive authorized-residual-risk specialist cases already discriminated the then-corrected boundary. No suite correction was justified at that time. The post-delivery RQ1 record in section 9 supersedes this statement for current routing-suite coverage only.

Correction self-review range: complete working-tree correction diff from `28c66e813dacf3cdde51ac620dda274c41385d25`, limited to the four owned sources in this section.

Initial self-review findings: `0 Critical / 2 Required`:

1. Current grant wording and the initial planning-review record had become historically inaccurate: the opening paragraph still described only the first instruction, while one initial-review checklist item had been changed retroactively from the original five checkpoints to nine. The correction now distinguishes both grants, labels section 14 as the initial record and preserves its original checkpoint fact while routing the superseding design here.
2. The structural worktree review and checkpoint-commit order was ambiguous. Checkpoints 3 and 6 now require structural worktree review/fixes first, an explicitly authorized distinct commit second, then final review over the exact resolved committed range. Semantic/routing clarification remains deferred and cannot amend/rewrite structural history.

Self-review recheck evidence: changed scope is exactly roadmap + detailed plan + owner brief + progress; protected blobs `8/8` match `461269b`; suite IDs are unique IPPB `18/18` and CRQ `20/20`; every reference has full selection/skip accounting (`18` or `20`); validator `37/37`, runner `130/130`, repository `11 skills / 0 errors / 2` expected baseline warnings, focused `18/18` and `20/20`, cumulative `177/177`; document/link/UTF-8/no-BOM/final-newline/fence/path/conflict audit and `git diff --check` pass. Recheck findings: `0 Critical / 0 Required`.

Initial fresh-context review findings: `0 Critical / 1 Required`. CRQ still assigned detailed review levels to `specialist-review.md`, although small/low-risk skip, applicable main-depth completion and hard-risk reclassification are prerequisites for deciding whether a specialist candidate exists. The corrected allocation keeps review-level selection and applicable main-depth/reclassification rules in CRQ core, removes that ownership from the specialist reference and leaves only detailed clustering/quota/package/reviewer/reconciliation/claim-label procedure there.

Terminal fresh-context review reopened the complete corrected diff from `28c66e813dacf3cdde51ac620dda274c41385d25` without relying on the authoring narrative. It rechecked source ownership, both core/reference boundaries, all nine checkpoint transitions, exact per-skill/cumulative ranges, runner control-plane and baseline separation, frozen-suite sufficiency, permission/read-only/status/verdict invariants, scope/exclusions, stops and rollback. Mechanical evidence remained conclusive and the post-correction document diff introduced no new diagnostic. Findings: `0 Critical / 0 Required`. At that historical checkpoint, the verdict was `Approved` for the authorized planning-correction commit and normal push only; target implementation was not yet approved.

This was a separate fresh-context main-agent pass, not a claim of a formally independent reviewer or execution fresh-reader. It is retained as historical planning evidence; the later implementation grant and CP6–CP8 completion are recorded above.

## 16. Historical transferable implementation brief

Implementation goal before the later owner approval was to structurally migrate IPPB then CRQ on the existing `feat/agent-skills-asm-pr5a` branch, using `461269b` as the immutable behavioral baseline and the exact nine-checkpoint contract above.

The implementation instruction required the agent to read this plan and owner brief, re-run Checkpoint 1, record `<implementation-start-head>`, verify permission, preserve six frozen suites, keep each structural-only checkpoint distinct from later correction history, execute all 38 cases with mandatory fresh-reader evidence, preserve two accepted rollback ranges, reconcile durable state and stop before delivery unless exact later Git/remote permission existed. CP1–CP8 now satisfy that contract.

Files and domains not to touch are the exclusions in section 6. The initial runner-test sandbox/timeout noise is resolved by the conclusive `130/130` pass recorded in section 4; it must be rechecked at implementation baseline because environment state may change.
