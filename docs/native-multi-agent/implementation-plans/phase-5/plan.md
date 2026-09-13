# Phase 5 — Detailed implementation plan

## Trạng thái contract và authority

- Đây là detailed-plan candidate cho Phase 5 / `NMA-WS7`; current status/evidence vẫn do [`progress.md`](../../progress.md) sở hữu.
- Candidate/source identity tối thiểu: `workflow_id=nma-001-phase-5`, `episode_id=detailed-plan`, `candidate_revision=phase-5-plan-r2`; candidate đã consume `owner_input_revision=2` với exact ordered refs `[owner-1, owner-2]`. Identity này không thay thế future Owner Source Package hoặc Main ledger.
- Exact Owner sources, ordered: owner-1 — `fetch remote, sync main, tạo nhánh mới sau đó thực hiện phase 5 của native multi agent plan, có thể commit`; owner-2 — `tiếp tục, nếu gặp cảnh báo hết quota thì có thể retry 2 lần`.
- Branch/base do Main xác minh trước dispatch: `feat/native-multi-agent-phase-5`; `HEAD == main == origin/main == 61f3e5f146fb8328136452da018e3c5a78f78cf3`; working tree/index sạch; Phase 4 dependency đã merge qua PR #92.
- Owner cho phép thực hiện exact Phase 5 scope, proportional local verification và local commit sau khi managed review gates đạt. Commit grant không phải push grant và không làm `PASS` thành rollout/adoption approval.
- Owner-2 cho phép tối đa hai retry khi gặp đúng cảnh báo hết quota; đây không phải authority để lặp semantic review/correction, nới scope hoặc bypass automatic round budget.
- Không có authority cho push, PR create/update, CI watch/fix, merge, deploy, database/production/remote mutation, destructive action, history rewrite, force-push hoặc branch deletion.
- Specialist decision: `0`; current repository evidence không để lại một bounded specialist-only uncertainty và Planner không được delegate/spawn.

Đọc file này cùng:

- [Master Plan](../../plan.md), đặc biệt GOAL Revision `1`, `NMA-WS7`, migration/compatibility và rollout gate;
- [progress owner](../../progress.md), [implementation-plan convention](../README.md) và [owner-review-brief](./owner-review-brief.md);
- [`AGENTS.md`](../../../../AGENTS.md), [`docs/agent-loops.md`](../../../agent-loops.md);
- `native-multi-agent-workflow`, `implementation-planning-and-pr-breakdown`, `maintain-repo-skills`, `test-quality-strategy`, `git-checkpoint-workflow`, và `code-review-and-quality` cho managed review.

Nếu repository reality buộc đổi Master Plan, GOAL, `NMA-WS7` completion boundary hoặc authority, role phải dừng với exact mismatch/Owner route; không tự sửa semantic root.

## Mục tiêu và observable outcome

Hoàn tất approved Phase 5 / `NMA-WS7` bằng smallest coherent integration-closure change để Owner nhận một repository-ready evidence package cho quyết định controlled adoption:

1. current active owners chứng minh `NORMAL`, `MULTI_AGENT_MASTER_PLAN`, `MULTI_AGENT_E2E` và `OWNER_DECISION_REQUIRED` vẫn tương thích với adaptive workflow và existing skill ecosystem;
2. lifecycle Reviewer vẫn mandatory trong managed review, còn Specialist vẫn optional, bounded, advisory và caller-owned;
3. local review artifacts được inventory theo exact logical identity và vẫn ignored/untracked/unstaged;
4. một valid fresh reader có thể recover mode choice, Reviewer/Specialist boundary, exact handoff và Owner gates từ current repository owners mà không nhận expected answer hoặc candidate content;
5. prior Phase 2–4 live evidence chỉ được reuse ở claim boundary có current consumed contracts/config; changed input không được che bằng historical pass;
6. implementation-plan navigation và `progress.md` phản ánh exact merged/current state, verification, limitations và adoption boundary;
7. Owner vẫn quyết định adoption/rollback. Technical `PASS` hoặc local commit không tự đổi trạng thái thành `adopted` và không cấp remote authority.

Không tạo runtime, validator, eval suite, evidence store, fingerprint/provenance registry hoặc generalized rollout mechanism mới.

## Sự thật repository đã xác nhận

1. Master Plan là Plan Revision `8`, GOAL Revision `1`; `NMA-WS7` phụ thuộc `NMA-WS5` và `NMA-WS6`.
2. Current Git ancestry có Phase 3 qua PR #91 / merge commit `86bbb450c7e0f80551c9537c3c5a5b8d75278526` và Phase 4 qua PR #92 / merge commit `61f3e5f146fb8328136452da018e3c5a78f78cf3`.
3. [`progress.md`](../../progress.md) đang stale so với Git: Phase 3/4 rows và current gate vẫn mô tả local pre-push/pre-merge state, còn Phase 5 ghi `chưa mở`. Correcting this concise current-truth owner is Phase-5-owned integration closure, không phải historical rewrite.
4. [`implementation-plans/README.md`](../README.md) indexes Phase 2–4 nhưng chưa có Phase 5; Phase 5 plan/brief có current consumer nên README phải thêm đúng một row sau khi candidate được accepted.
5. Contextual scan của mọi `reviewer` occurrence trong đúng hai active semantic owners xác nhận `17` occurrences: `11` active Specialist-context usages cần behavior-preserving replacement, `1` canonical lifecycle Reviewer occurrence, `4` generic reviewer/human-feedback occurrences và `1` explicitly historical occurrence. Exact inventory ở CP1 là byte allowlist; không được mechanical rename nhóm canonical/generic/historical.
6. `AGENTS.md`, `docs/agent-loops.md`, `.codex/config.toml`, bốn project profiles và các native/core review owners ngoài complete `11`-replacement set không đổi từ các integration tương ứng. Master-Plan-specific core/reference contracts không có later semantic edit, còn Phase 4 chỉ bổ sung E2E-specific planning/reconciliation/review contracts.
7. Phase 4 final cumulative review trên current Phase-4 bytes ghi `PASS`, `0 Critical`, `0 Required`; native workflow tests `28/28`, skill validator `12 skills / 0 errors / 0 warnings`, validator regression `37/37`, direct links `38/0`, real same-session Plan correction và real running-Implementor authority synchronization all passed at the recorded boundary.
8. Baseline trước Phase 5 review có `21` exact local artifacts trong `10` workflow/episode groups. Root bị ignore bởi `.gitignore:20`; `git ls-files` và staged audit cho review root hiện rỗng. Inventory còn xác nhận bốn known pre-Phase-5 relocation/naming deviations được liệt kê tại CP2; chúng là historical limitations, không phải current verdict candidates và không được tự rewrite/delete.
9. Current structural owner `.agents/scripts/native-multi-agent-workflow.test.mjs` đã kiểm tra root-to-managed routing, mandatory Reviewer, separate correction episodes, Owner-change composition, evidence truth và ordinary workflow preservation. Static checks không phải live behavior hoặc fresh-reader evidence.
10. `docs/agent-workflow/plan.md` tiếp tục sở hữu Normal/adaptive scope; its progress owner records current adaptive merged state, và both known adaptive problems are `resolved/completed`. Không có adaptive problem record cần Phase 5 sửa.
11. Product/UI/API/Supabase/database/browser/deployment behavior không đổi trong intended Phase 5 diff.

## Owner decisions, assumptions, conflicts và open evidence

### Exact Owner decision đang áp dụng

- owner-1 yêu cầu sync repository, tạo Phase 5 branch, thực hiện approved Phase 5 và cho phép local commit.
- owner-2 cho phép retry tối đa hai lần khi gặp đúng cảnh báo hết quota. Đây là authority-only execution recovery grant; nó không đổi GOAL, scope, candidate semantics, Git/remote authority hoặc correction-round counter. Một blocker quota không tự tiêu thụ semantic correction round.
- Main đã hoàn tất sync/branch setup trước Planner dispatch. Planner không thực hiện lại Git mutation.
- “có thể commit” được hiểu là local commit authority cho exact reviewed Phase 5 scope sau final admitted Implementation Reviewer `PASS`, gồm stable progress-only closure; không bao gồm push/PR/merge hoặc adoption decision.

### Assumptions phải revalidate trước dependent work

- `HEAD`, base/remote equality, clean ownership và Phase 3/4 ancestry vẫn đúng; drift hoặc unrelated dirty state phải được reported, không bị ghi đè.
- Current role config/profile and exact evidence-owner sections used for any reuse remain unchanged; equality phải được kiểm tra trên actual base trước khi reuse.
- One instruction-bounded zero-history reader can be dispatched by Main for the exact one-turn fresh-reader check. Nếu executor/authority không có, Phase 5 giữ `BLOCKED`; self-review hoặc lifecycle Reviewer không thay thế.
- A four-document Implementor diff vẫn là smallest confirmed scope: complete `11` behavior-preserving replacements trên hai active semantic owners, cộng `README.md` và `progress.md`. Một active owner khác, một unclassified/ambiguous occurrence, hoặc thay đổi ngoài frozen contextual inventory routes plan mismatch thay vì silently widening scope.

### Conflicts đã reconcile

- Tracker wording conflicts with current Git history, nhưng ownership rõ: Git proves merged ancestry; `progress.md` owns present status and may be corrected prospectively in Phase 5.
- Historical raw evidence không tự become current after a consumed contract changes. Phase 5 uses a per-claim currentness matrix and combines only still-current observation with current deterministic/source review; it never labels historical observation as a new run.
- Master Plan requires controlled adoption but explicitly reserves rollout approval for Owner. Therefore Phase 5 can reach repository-ready/verified/committed while `adoption decision=pending Owner`.

### Open evidence, không phải material design question

- Fresh-reader result, final inventory after Phase 5 review artifacts exist, and final implementation verdict are unavailable until their bounded later checkpoints run.
- Remote CI is ungranted and local docs-only scope does not make it mandatory; report `not_run`, not pass.

Không có material Owner ambiguity hoặc Master Plan conflict trước Plan Review.

## Sizing và dependency

- Preliminary size: large/high-risk because Phase 5 closes a tracked governance program across multiple semantic owners and must prevent stale-evidence/adoption overclaim.
- Final size: bounded medium implementation với high-governance review depth. Bốn implementation owners cần exact surgical edits; compatibility, native evidence và fresh-reader checks làm managed E2E review cần thiết.
- Dependency order:

```text
CP0 source/base/authority revalidation
  → CP1 compatibility + active terminology audit
    → CP2 prior-evidence currentness + exact review-artifact inventory
      → CP3 complete contextual Specialist-wording correction set
        → CP4 one bounded fresh-reader governance observation
          → CP5 README/progress implementation + deterministic/author closure
            → CP6 cumulative Implementation Reviewer
              → CP7 local implementation commit → stable progress-only closure commit
                → Owner adoption decision remains separate
```

All candidate writers are serialized. Audit/fresh-reader activity must not mutate the implementation candidate.

## Task-local lineage delta và blast radius

| ID | owner | depends_on | consumes | produces | evidence / invalidation | disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `P5-L0` | Owner + Master Plan `NMA-WS7` | `NMA-WS5`, `NMA-WS6` | owner-1, owner-2 authority-only quota retry, GOAL Revision `1`, Phase 5 gate | Bounded Phase 5 authority/outcome | Exact ordered Owner package and Master Plan; invalidated by later Owner semantic/authority steer | `affected` |
| `P5-L1` | `AGENTS.md` + `docs/agent-loops.md` | `P5-L0` | adaptive preflight/mode routing | Root-reachable Normal/managed choice | Positive current source/search confirms canonical routing; fresh reader rechecks comprehension | `unaffected` |
| `P5-L2` | native workflow skill/references + `.codex/**` | `P5-L1` | role, Owner source, handoff, artifact, correction, blocker semantics | Operable managed lifecycle/profile boundary | Current hashes/history, structural tests and bounded historical/native evidence; invalidated by any changed consumed contract/config | `needs_review` |
| `P5-L3A` | `docs/agent-workflow/plan.md` | `P5-L1` | Normal/adaptive scope and Specialist routing | Canonical Specialist terminology without changing mode/threshold behavior | All `15` current `reviewer` occurrences context-classified: `9` Specialist replacements, `1` canonical lifecycle, `4` generic, `1` historical | `affected` |
| `P5-L3B` | `.agents/skills/code-review-and-quality/references/specialist-review.md` | `P5-L2` | Specialist package ownership | Canonical Specialist wording while preserving caller-owned advisory contract | Both current `reviewer` occurrences are Specialist-context replacements; filename/heading/behavior remain unchanged | `affected` |
| `P5-L3C` | planning + review + test + Git owners outside `P5-L3A/B` | `P5-L1`, `P5-L2` | detailed planning, mandatory review, evidence and action gates | Compatible ecosystem without duplicate owner | Positive current-owner inspection and same-family scan; invalidated by newly discovered semantic collision | `unaffected` |
| `P5-L4` | Phase 2–4 evidence owners + current source audit | `P5-L2`, `P5-L3A`, `P5-L3B`, `P5-L3C` | exact historical observations and current consumed-owner identities | Per-claim `current`, `historical_only`, `affected_rerun_required`, or `not_applicable` disposition | Exact source/config comparison; missing equality or unclear dependency stays `needs_review` | `affected` |
| `P5-L5` | ignored review artifacts + `.gitignore` | `P5-L2` | explicit artifact paths and embedded Review Identity | Two-tier exact identity/Git-boundary inventory | Current/open or unknown deviation and every Git-boundary violation block; enumerated known historical limitations are reported but excluded from verdict selection/admission | `affected` |
| `P5-L6` | Main-owned fresh-reader observation | `P5-L1`, `P5-L2`, `P5-L3A`, `P5-L3B`, `P5-L3C` | fixed corrected canonical-source package, hidden criteria | Current governance-comprehension evidence | One valid zero-history observation after CP3; invalidated by prompt leakage, contaminated context, mutation or missing criterion | `affected` |
| `P5-L7` | `implementation-plans/README.md` | `P5-L0` | accepted Phase 5 candidate paths | Current Phase 5 navigation | Exact relative links; invalidated if candidate rejected/moved | `affected` |
| `P5-L8` | `progress.md` | `P5-L4`, `P5-L5`, `P5-L6`, `P5-L7` | Git ancestry and observed verification/review state | Concise current truth and stable evidence | Git/current checks and final admitted review; invalidated by later edit/action | `affected` |
| `P5-L9` | Owner | `P5-L8` | repository-ready evidence package | Adopt / defer / rollback decision | No current approval entry exists; only Owner can change | `unaffected` — remains pending |

No missing edge is treated as evidence of `unaffected`. Any newly discovered active owner starts `needs_review` and cannot enter the writable set without same-Planner plan correction and same-Plan-Reviewer admission.

## Exact implementation scope

### Planner-owned candidate paths

- `docs/native-multi-agent/implementation-plans/phase-5/plan.md`
- `docs/native-multi-agent/implementation-plans/phase-5/owner-review-brief.md`

Only the same Planner may correct these paths during detailed-plan reconciliation. Implementor and lifecycle Reviewers keep them read-only. They are included in the final cumulative Phase 5 candidate and implementation commit only after admitted reviews.

### Expected Implementor paths

| Path | Smallest change | Semantic owner |
| --- | --- | --- |
| `docs/agent-workflow/plan.md` | Apply only the `9` frozen Specialist-context replacements in CP1; preserve the `6` classified canonical/generic/historical occurrences, all routing, thresholds and behavior | Normal/adaptive scope and Specialist-routing owner |
| `.agents/skills/code-review-and-quality/references/specialist-review.md` | Apply only the `2` frozen Specialist-context replacements in CP1; preserve filename, section structure and caller-owned advisory semantics | Specialist package/detail owner |
| `docs/native-multi-agent/implementation-plans/README.md` | Add exactly one Phase 5 row linking accepted `plan.md` and `owner-review-brief.md`; do not add status/authority semantics | Artifact navigation/index only |
| `docs/native-multi-agent/progress.md` | Reconcile Phase 3/4 merged truth; record only observed Phase 5 audit/currentness/inventory/fresh-reader/deterministic state and exact adoption/action boundary | Durable concise current truth only |

The cumulative implementation-review candidate is exactly six paths: the two Planner-owned candidates plus these four Implementor paths. Progress-only closure after admitted `PASS` may change only `progress.md` with stable verdict/implementation hash and no ephemeral state.

### Audit-only direct owners

- `docs/native-multi-agent/plan.md`, `docs/agent-workflow/{progress,problems}.md`.
- `AGENTS.md`, `docs/agent-loops.md`, `.gitignore`.
- `.agents/skills/native-multi-agent-workflow/**`.
- `.agents/skills/implementation-planning-and-pr-breakdown/**`.
- `.agents/skills/code-review-and-quality/SKILL.md` và mọi reference khác ngoài exact writable `references/specialist-review.md`; `.agents/skills/maintain-repo-skills/**`, `.agents/skills/test-quality-strategy/**`, `.agents/skills/git-checkpoint-workflow/**`.
- `.agents/scripts/native-multi-agent-workflow.test.mjs`, `.agents/scripts/validate-skill.mjs`, `.agents/scripts/validate-skill.test.mjs`.
- `.codex/config.toml`, `.codex/agents/{planner,reviewer,implementor,specialist}.toml`.
- Exact existing `docs/native-multi-agent/reviews/**` artifacts are read-only workflow evidence; Phase 5 Reviewers may write only their Main-preassigned ignored artifact.

### Forbidden paths/domains

- Any audit-only owner above, và mọi byte ngoài complete `11` frozen replacements trong hai active-owner files, unless same-Planner correction proves an exact Master-Plan-compatible need and Plan Reviewer admits the revised allowlist. Với automatic correction budget đã ở round cuối, unresolved expansion routes `OWNER_DECISION_REQUIRED` thay vì tự mở thêm round.
- Product/application source, UI, API, Supabase/database/schema/RLS/RPC, fixtures, browser/E2E, deployment and production.
- `.agents/evals/**`, skill-eval harness/CLI/runtime, package/dependency/CI configuration, new test/validator script or generalized compatibility checker.
- New runtime, database, manifest, event log, scheduler, message bus, polling loop, fingerprint/provenance registry, review oracle or rollout service.
- Historical implementation plan/review wording cleanup, review artifact deletion/publication, Master Plan/GOAL revision.
- Stage/commit before final admitted implementation `PASS`; push/PR/CI/merge/deploy/remote/destructive/history rewrite/force-push/branch deletion.

## Implementation contract

### CP0 — Revalidate source, base, authority and candidate scope

1. Consume the exact current Owner Source Package from Main and echo revision/ordered refs before substantive work; this durable candidate is not the package.
2. Confirm exact branch, `HEAD/main/origin/main`, dependency ancestry, staged/unstaged/untracked ownership and six-path cumulative candidate scope.
3. Read accepted plan/brief, Master Plan/progress/current owners and every routed skill/resource.
4. Confirm Phase 5 review destinations are exact, ignored, absent-or-same-logical-resume, untracked and unstaged.
5. Stop with `PLAN_CONTRACT_MISMATCH` if another writable owner is necessary; return `MASTER_PLAN_CONTRACT_MISMATCH` if the conflict reaches GOAL/`NMA-WS7`.

### CP1 — Compatibility and active terminology audit

Audit current active sources, not historical evidence, against this matrix:

| Boundary | Required current result |
| --- | --- |
| `NORMAL` | One coherent bounded routine task remains one-agent by default; no managed role ceremony from file/skill count alone |
| `MULTI_AGENT_MASTER_PLAN` | Fresh Master Planner + Master Plan Reviewer; reviewed planning ends without implementation or implied action authority |
| `MULTI_AGENT_E2E` | Fresh serialized Planner → Plan Reviewer → Implementor → Implementation Reviewer; both lifecycle Reviewers mandatory regardless of Specialist |
| `OWNER_DECISION_REQUIRED` | Unresolved GOAL/scope/ownership/permission/acceptance/baseline/disposition/budget conflict stops for Owner |
| Reviewer / Specialist | Reviewer owns full phase review/artifact/verdict; Specialist stays optional/bounded/advisory/caller-owned/no-delegation |
| Review artifact / handoff | Exact Main-preassigned local artifact is detailed source; handoff is identity-preserving projection; no latest/glob/mtime selection |
| Adaptive / native ownership | Adaptive plan keeps Normal/preflight/sizing/Specialist; native plan/skill keeps managed lifecycle; no duplicate semantic owner |
| Skill-eval harness | Remains evaluation tooling only and is not imported as workflow runtime, state store or rollout mechanism |

Search the complete same-family surface in exactly the two admitted active owners, including capitalization and variants with/without article. Every current `reviewer` occurrence is context-classified before replacement:

| Owner / current base line | Context class | Disposition |
| --- | --- | --- |
| `docs/agent-workflow/plan.md:143` | Generic review actor in the out-of-scope ban on ceremony for every task | Preserve |
| `docs/agent-workflow/plan.md:198` | Generic reviewer-supplied dependency evidence | Preserve |
| `docs/agent-workflow/plan.md:294`, `:305` | Generic human/review feedback and evidence-based conflict resolution | Preserve both |
| `docs/agent-workflow/plan.md:470` | Canonical lifecycle Reviewer contract | Preserve |
| `docs/agent-workflow/plan.md:479`, `:583`, `:590`, `:600`, `:608`, `:646`, `:687`, `:689`, `:690` | Active optional Specialist routing/package/behavior/claim/risk semantics | Replace all `9` exactly as frozen below |
| `docs/agent-workflow/plan.md:743` | Explicitly historical, superseded second-reviewer guardrail | Preserve as history |
| `.agents/skills/code-review-and-quality/references/specialist-review.md:43`, `:61` | Active Specialist package behavior and evidence reconciliation | Replace both exactly as frozen below |

Freeze this complete `11`-replacement byte set:

| Owner / current base line | Exact old text | Exact replacement |
| --- | --- | --- |
| adaptive `:479` | `cách route, gọi reviewer và reconcile kết quả` | `cách route, gọi Specialist và reconcile kết quả` |
| adaptive `:583` | `main agent có cách gọi specialist reviewer an toàn` | `main agent có cách gọi Specialist an toàn` |
| adaptive `:590` | `reviewer read-only/expansion/stop/output contract` | `Specialist read-only/expansion/stop/output contract` |
| adaptive `:600` | `small task không spawn reviewer` | `small task không call/spawn Specialist` |
| adaptive `:608` | `reviewer không tự implement hoặc broad-discover` | `Specialist không tự implement hoặc broad-discover` |
| adaptive `:646` | `nếu reviewer nhận review criteria hoặc authoring context` | `nếu Specialist nhận review criteria hoặc authoring context` |
| adaptive `:687` | `Reviewer nhận package quá rộng ngay khi spawn` | `Specialist nhận package quá rộng ngay khi spawn` |
| adaptive `:689` | `Nhiều reviewer được suy ra từ nhiều domain/file/symptom` | `Nhiều Specialist được suy ra từ nhiều domain/file/symptom` |
| adaptive `:690` | `Reviewer conflict` | `Specialist conflict` |
| specialist reference `:43` | `reviewer behavior` | `Specialist behavior` |
| specialist reference `:61` | `reviewer count or majority vote` | `Specialist count or majority vote` |

Canonical lifecycle Reviewer wording, generic human/review feedback and explicitly historical text remain unchanged. Quoted inventory literals in this candidate are not active semantic collisions; historical implementation plans/reviews remain excluded and must not be rewritten. An occurrence that does not fit the frozen classification, an ambiguous same-family manifestation, or a correction that would change behavior, headings, paths or ownership is `PLAN_CONTRACT_MISMATCH`; because this is automatic correction round `2/2`, unresolved scope routes Main to `OWNER_DECISION_REQUIRED` rather than a broader automatic edit.

### CP2 — Evidence-currentness matrix and exact review-artifact inventory

Build an in-turn evidence matrix before making a completion claim:

| Evidence group | Reuse boundary |
| --- | --- |
| Phase 2 config/profile and Specialist observations | Profile/config callability facts remain current only after exact equality check. Because CP3 changes Specialist wording consumed by semantic interpretation, the old live observation is `historical_only` for that semantic claim; it is not a new current invocation. Current semantics come from corrected owners, current static/review checks and the post-correction fresh reader. |
| Phase 3 Master Plan Only rehearsal | Reuse only staged-review/session/correction facts tied to unchanged Master-Plan-specific owners. Phase-4 E2E-only additions do not become a new Master Plan live observation; current structural/fresh-reader evidence must cover shared-source currentness. |
| Phase 4 E2E pilot | Reuse for exact current E2E correction, Reviewer and running-authority claims because current branch adds no consumed-owner/config edit after `d2cbbb8`; revalidate ancestry and source equality first. |
| Current deterministic/static checks | Rerun on exact Phase 5 candidate bytes; never label as live orchestration or fresh-reader evidence. |

For every claim record source/evidence identity, exact consumed owner/config, currentness check, result (`current`, `historical_only`, `affected_rerun_required`, `not_applicable`) and claim limit. If any mandatory mode claim is `affected_rerun_required`, run only that bounded authorized mode or keep Phase 5 `BLOCKED`; do not silently borrow another mode's evidence.

Inventory every exact review artifact path and compare directory workflow/episode/candidate/review-round components with embedded Review Identity. Record exact total and per-group counts, malformed/missing/crossed identities, and ignore/tracked/staged state. Enumeration is exhaustive only; no verdict/artifact is selected by latest, glob, mtime or directory order.

Disposition is two-tier and fail-loud:

- any current/open Phase 5 ledger/path/embedded-identity mismatch, any unknown deviation, or any review artifact that is not ignored, is tracked, or is staged blocks completion;
- the following known pre-Phase-5 relocation/naming deviations are reported as historical limitations, excluded from current verdict selection/admission, and never rewritten/deleted by Phase 5:
  - `docs/native-multi-agent/reviews/nma-001-phase-2/implementation-review/phase-2-candidate-r1-review-r1.md` embeds candidate revision `phase-2-candidate-r1-owner8`;
  - `docs/native-multi-agent/reviews/nma-001-phase-3/implementation-review/phase-3-candidate-r0-review-r0.md` embeds candidate revision `phase-3-impl-r1-evidence`;
  - `docs/native-multi-agent/reviews/nma-001-phase-3/implementation-review/phase-3-candidate-r1-review-r1.md` embeds candidate revision `phase-3-impl-r1-correction`;
  - `docs/native-multi-agent/reviews/nma-001-master-plan-review/initial-master-plan/plan-r3-review-r0.md` and `plan-r5-review-r1.md` retain historical absolute `review_artifact_ref`/`prior_review_artifact_ref` values under `docs/agent-workflow/native-multi-agent/reviews/...`.

The known list is closed: a new or unclear historical deviation remains blocking until the owning workflow classifies it. Historical limitation status never relaxes the current Git-boundary checks.

### CP3 — Implement the complete contextual Specialist-wording set

After CP1 freezes all `17` contextual classifications and the complete `11`-replacement set, and CP2 confirms evidence/artifact boundaries, the Implementor edits only the two active owners listed in scope. Preserve the `1` canonical lifecycle Reviewer, `4` generic reviewer/human-feedback and `1` explicitly historical occurrences; also preserve all routing, role thresholds, filenames/headings, mandatory lifecycle Reviewer behavior, optional/caller-owned Specialist behavior and surrounding prose.

Run a full same-family scan on both owners immediately after the edit. Required result: all `11` old Specialist-context forms are absent, all `11` exact replacement forms are present once at their intended context, the `6` preserve-class occurrences remain semantically unchanged, and zero active Reviewer-for-Specialist usage remains. Any ambiguous residual or unexpected changed byte blocks handoff; do not mechanically rename it.

These wording-only source edits intentionally precede the fresh-reader run so the reader consumes corrected current owners. They do not authorize a new runtime/profile change, generic/canonical/historical rename or broader terminology cleanup.

### CP4 — One bounded fresh-reader governance observation

Main dispatches at most one zero-history, one-turn, instruction-bounded read-only reader session that is not a lifecycle Reviewer or Specialist. An invalid, blocked or non-passing dispatch does not authorize an automatic replacement/rerun. The reader cannot edit, commit, call another agent or transition the workflow.

Fixed supplied context:

1. `AGENTS.md`;
2. `docs/agent-loops.md`;
3. `docs/agent-workflow/plan.md` after CP3;
4. `.agents/skills/native-multi-agent-workflow/SKILL.md`;
5. `.agents/skills/native-multi-agent-workflow/references/owner-source-and-steering.md`;
6. `.agents/skills/native-multi-agent-workflow/references/review-artifact-and-reconciliation.md`;
7. `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`;
8. `.agents/skills/implementation-planning-and-pr-breakdown/references/master-plan-workflow.md`;
9. `.agents/skills/implementation-planning-and-pr-breakdown/references/multi-agent-e2e-workflow.md`;
10. `.agents/skills/code-review-and-quality/SKILL.md`;
11. `.agents/skills/code-review-and-quality/references/managed-lifecycle-review.md`;
12. `.agents/skills/code-review-and-quality/references/specialist-review.md` after CP3;
13. `.agents/skills/git-checkpoint-workflow/SKILL.md`.

Do not supply this Phase 5 candidate/brief, expected answer, acceptance table, author conclusion, suspected defect, prior output or another variant. The scenario asks the reader to classify representative routine, broad-plan and bounded-cross-owner tasks; explain Reviewer versus Specialist; route exact review artifact/handoff; handle an authority revoke while Implementor is running; and identify which later actions remain Owner-gated.

Main freezes hidden material criteria before dispatch:

- routine coherent task → `NORMAL`, no managed roles for ceremony;
- broad unstable initiative → `MULTI_AGENT_MASTER_PLAN`, reviewed plan only;
- bounded cross-owner risk → `MULTI_AGENT_E2E`, serialized four roles and mandatory Reviewers;
- Specialist never substitutes for Reviewer or transitions;
- corrected active owners contain no Reviewer-for-Specialist usage, while canonical lifecycle Reviewer, generic feedback and explicit history remain intelligible in context;
- exact artifact/candidate/Owner identity and Main-only admission, no latest/mtime;
- running authority steer requires interrupt/quiesce, actual-state audit and same-session resume with refreshed exact source before protected action;
- `PASS`/review/commit permission does not grant implementation, adoption or remote actions beyond the exact current grant.

Record the observation separately from evaluation using the maintain-skill fields: evidence type/status/date/scenario/bounded prompt/supplied context/executor context/actual access and enforcement/observation/misses/variance/claim limits. Actual workspace/tool access must be disclosed; instruction-bounded is not filesystem isolation or proof of automatic platform routing.

`passed` requires every material criterion with no unsafe/misleading route, including an unambiguous Reviewer/Specialist distinction across both corrected owners. `partially_passed`, `failed` or `not_run` blocks Phase 5 final `PASS`. Reader noncompliance does not automatically justify a skill edit or rerun; an evidenced contract defect outside the frozen contextual set routes `PLAN_CONTRACT_MISMATCH`.

### CP5 — Implement navigation, truthful current status and author closure

After CP1–CP4 evidence exists:

1. Add one Phase 5 row to `implementation-plans/README.md`, linking the accepted plan/brief only.
2. Update `progress.md` to reconcile Phase 3 and Phase 4 as merged with their stable implementation/progress/merge evidence; remove stale branch/head/no-remote claims that no longer describe current truth.
3. Record Phase 5 as in progress/implemented and verification state strictly from actual checks. Before final review, say implementation review pending; do not preclaim `PASS`, commit, push, adoption or completion.
4. Include concise compatibility, two-tier inventory, evidence-reuse and fresh-reader results with claim limits. State current/open Phase 5 identity/Git-boundary result separately from known historical limitations; detailed rows, raw observation, review findings, session IDs, Owner package membership, counters and temporary hashes stay ephemeral/ignored.
5. Record `adoption approval: pending Owner`; distinguish local commit authority from rollout and every remote action.

Run on exact current candidate:

- `node --test .agents/scripts/native-multi-agent-workflow.test.mjs`;
- `node .agents/scripts/validate-skill.mjs`;
- `node --test .agents/scripts/validate-skill.test.mjs`;
- exact relative-link, UTF-8/no-BOM, internally consistent EOL, final-newline, trailing-whitespace, zero-width and conflict-marker audit for the six candidate paths;
- full same-family terminology/compatibility scan on both owners proving all `11` replacements, all `6` preserve-class occurrences and zero active Reviewer-for-Specialist usage;
- exact two-tier review inventory plus `git check-ignore`, tracked and staged audit, with current/open and known historical dispositions kept separate;
- `git diff --check` and exact cumulative six-path scope/status audit.

Application build/browser/Supabase/database/model-eval/CI/deployment/manual product QA are `not applicable` unless actual diff crosses their owner; such crossing is a plan mismatch, not permission to run them.

Before handoff, close:

- **Consumer → owner:** every matrix row resolves to its canonical active owner; README/progress contain only navigation/current truth; adoption remains Owner-owned.
- **Acceptance → evidence:** compatibility claims map to current source/static/native/fresh-reader/inventory evidence at the correct layer; no delegation sentence or link is used as semantic proof.
- **Prompt leakage:** fresh roles can recover reusable behavior from repository-owned sources; Phase 5 prompt/candidate/hidden expected answer is excluded from the fresh-reader package.
- **Simplicity:** four Implementor files with the verified complete `11` behavior-preserving replacements across two active owners plus navigation/current-truth closure; no new runtime, script, suite, validator, tracker, manifest, registry or provenance layer.

### CP6 — Cumulative implementation review

Main freezes the exact six-path candidate and opens a fresh Implementation Reviewer round `0` with exact preassigned ignored artifact. Reviewer receives current Owner source/authority, accepted plan, full contextual-classification/`11`-replacement evidence, compatibility/currentness/two-tier-inventory/fresh-reader evidence and exact changed-path scope, then dispositions all managed implementation dimensions.

`PASS` requires `0 Critical`, `0 Required`, every mandatory current evidence complete, fresh-reader `passed`, artifacts ignored/untracked/unstaged, exact candidate stability and no adoption/remote overclaim. Missing mandatory evidence is `BLOCKED`; candidate defect is `BLOCKING_FINDINGS`; plan/Master mismatch routes to the exact owning session. Correction uses the same Implementor/Reviewer and bounded rounds `1/2`; no replacement or automatic round `3`.

### CP7 — Local Git and stable progress closure

After Main admits exact final implementation `PASS`:

1. Revalidate branch/base, exact six-path candidate, review-artifact Git boundary, current deterministic evidence and staged scope.
2. Use Owner-granted local commit authority to commit only the reviewed six-path implementation candidate. Suggested message: `docs(native-multi-agent): close phase 5 integration`.
3. Then update only `progress.md` with stable admitted verdict, implementation commit hash and current local-only delivery state; do not record the progress commit's own hash or `pending this checkpoint`.
4. Audit and create a separate local progress-only commit. Suggested message: `docs(native-multi-agent): record phase 5 readiness`.
5. Do not push/create PR/watch CI/merge or mark adoption approved. Report the local commits and present the evidence package to Owner for a separate adoption/rollback and any remote-delivery decision.

## Acceptance criteria and evidence mapping

| Criterion | Required evidence |
| --- | --- |
| A routine coherent task remains `NORMAL` without role ceremony | Current root/lifecycle/source audit + fresh-reader passed case |
| Master Plan Only ends after independently reviewed planning and never implies implementation | Unchanged specific-owner currentness + current static checks + fresh-reader passed case; bounded historical live evidence only within exact unchanged claim |
| E2E cannot bypass Plan/Implementation Reviewer or action gates | Current Phase 4 live evidence reuse after exact currentness audit + current static tests + fresh-reader case |
| Active terminology names Reviewer and Specialist without role collision | Full two-owner before/after scan: `17` occurrences classified, exact `11` replacements, `6` intentional preserves, zero active Reviewer-for-Specialist residual; positive inspection confirms unchanged behavior |
| Specialist stays optional/callable/advisory/no-delegation and cannot verdict/transition | Current unchanged profile/config structural evidence + corrected current source/review + post-correction fresh reader; Phase 2 live semantic observation is labeled `historical_only`, not presented as a new invocation |
| Old skill-eval harness is not workflow runtime | Current source/import/search audit; no new harness/runtime diff |
| Review evidence is exact and remains outside Git | Full two-tier inventory + current/open Phase 5 ledger/path/embedded-identity pass + ignore/tracked/staged audit; known pre-Phase-5 limitations reported but never selected/admitted or rewritten/deleted |
| Evidence reuse is truthful and minimal | Per-claim currentness matrix; only affected modes rerun; historical-only evidence labeled |
| Fresh reader recovers four governance boundaries without prompt leakage | One valid `passed` observation with fixed context, hidden criteria and actual-access limitations |
| Navigation/current truth is corrected | README exact links; progress matches Git ancestry, actual checks and current action/adoption state |
| Rollout remains Owner-controlled | Progress/brief state `pending Owner`; review/commit creates no adoption or remote claim |
| Final candidate is reviewable and locally committable | Exact six-path scope, hygiene/links/tests pass, final admitted Implementation Reviewer `PASS` |

## Progress ownership and truthful status rules

- Master Plan owns GOAL/workstream/Phase 5 gate and is read-only.
- This plan owns Phase 5 stable execution contract; brief owns owner-1/owner-2 decision and minimum approval/authority identity.
- README owns only phase artifact navigation.
- `progress.md` owns concise current implementation/verification/delivery/adoption truth. It does not store raw fresh-reader output, artifact inventory rows, session IDs, package membership or review counters.
- Ignored exact review artifacts own lifecycle findings/verdicts; Main thread/session owns raw fresh-reader and current orchestration evidence.
- Distinguish at least `implemented`, `verified`, `committed`, `pushed`, `PR open`, `merged`, and `adoption approved`. Never infer one from another.

## Mismatch, rollback and stop conditions

Rollback is logical and authority-aware:

- Before plan `PASS`, preserve both planning candidates and route findings to the same Planner; no implementation.
- Before implementation `PASS`, preserve the candidate/evidence and route exact findings or mismatch to owning same sessions; do not reset/revert.
- A failed fresh reader or stale mandatory evidence blocks completion; it does not erase prior Phase evidence or authorize a contract edit/rerun.
- Known pre-Phase-5 relocation/naming deviations remain reported historical limitations and are never rewritten/deleted or admitted as current verdict evidence. A current/open Phase 5 mismatch, an unknown deviation, or any ignore/tracked/staged violation remains blocking.
- After local commits, Owner may adopt, defer or request separately authorized goal-preserving correction/revert. `revert` and remote operations still require exact authority.

Stop and report exact state when Owner package is missing/ambiguous; branch/base/dependency/dirty ownership differs materially; another writable owner, unclassified occurrence or replacement outside the frozen `11`-item set is required; evidence currentness cannot be established; mandatory mode needs an ungranted rerun; fresh-reader is invalid/unavailable/non-passing; current/open artifact identity, unknown deviation or any Git boundary fails; candidate moves; Reviewer writes outside artifact; deterministic checks fail; correction budget exhausts at round `2/2`; or next action needs ungranted adoption/Git/remote/production/destructive authority.

## Accepted-plan implementation handoff

### Approved semantic source

- Master Plan Revision `8`, GOAL Revision `1`, `NMA-WS7`; dependencies `NMA-WS5` and `NMA-WS6` are ancestors of current base.
- Current exact Owner Source Package and authority snapshot must be supplied by Main; this file is not their replacement.

### Writer boundaries

- Planner: only the two exact Phase 5 plan/brief paths.
- Plan Reviewer: candidate-read-only; only exact preassigned ignored artifact.
- Implementor: only `docs/agent-workflow/plan.md`, `.agents/skills/code-review-and-quality/references/specialist-review.md`, `implementation-plans/README.md` and `progress.md`; within the first two, only the complete `11` replacements frozen in CP1 and no change to the `6` preserve-class occurrences; may later update only `progress.md` for stable post-PASS closure.
- Fresh reader: one fixed package, instruction-bounded read-only, one turn, no candidate/expected answer, no delegation/verdict/transition.
- Implementation Reviewer: six candidate paths read-only; only exact preassigned ignored artifact.
- Specialist: `0`; no consultation/delegation.
- Main: Owner package, ephemeral ledger, reader dispatch/record, candidate/artifact admission, transitions and Git actions within current authority; no finding adjudication or adoption decision.

### Completion boundary

Phase 5 technical closure requires exact cumulative six-path Implementation Reviewer `PASS`, current proportional deterministic/native/fresh-reader/two-tier-inventory evidence, accurate progress truth and ignored review artifacts outside Git. Owner-granted local commits may follow that gate. Controlled adoption, push, PR, CI, merge, deployment and every remote/destructive action remain separate Owner decisions.

## Correction round 2 dispositions

- `P5PR0-001` — `accepted/corrected` after round-1 partial resolution: the same exact two active owners and six-path boundary remain. All `17` current `reviewer` occurrences are context-classified; the complete `11` active Specialist-context replacements are frozen; the `6` canonical/generic/historical occurrences are preserved; CP1/CP3/CP5, fresh-reader, acceptance, brief and author closure require zero active Reviewer-for-Specialist residual without mechanical rename.
- `P5PR0-002` — remains `RESOLVED`: artifact inventory blocks current/open Phase 5 identity deviations, every unknown deviation and every ignore/tracked/staged violation. The four known pre-Phase-5 relocation/naming families are reported as historical limitations, excluded from current verdict selection/admission and never rewritten/deleted. CP2 and CP4–CP7, acceptance, progress, stop and rollback boundaries keep the admitted disposition.

## Author-side handoff closure

- **Consumer → owner:** exact checks confirmed Master Plan owns `NMA-WS7`; the adaptive plan owns its `9` affected Specialist-context phrases, `specialist-review.md` owns its `2` affected package/reconciliation phrases, and native/planning/review/test/Git/profile owners retain their established contracts; README/progress ownership remains non-overlapping.
- **Acceptance → evidence:** each acceptance criterion maps to a current source/static/native/fresh-reader/inventory/Git check. Static strings are never used as live orchestration or semantic fresh-reader proof.
- **Prompt leakage:** the reusable compatibility/currentness/fresh-reader/adoption semantics are in this repository-owned plan and canonical owners; future Implementor receives no hidden invention burden, while the actual reader package excludes this candidate and expected results.
- **Deterministic hygiene:** exact paths/links/status literals/branch/base/current Git/review-ignore boundary were checked during planning; final bytes still require CP5 rerun.
- **Simplicity:** contextual evidence bounds correction to `11` phrases in the same two active owners plus README/progress closure. Four Implementor files plus two planning artifacts are sufficient; no custom mechanism is justified.
- **Specialist decision:** `0`; no residual specialist-only risk cluster and no permission to delegate.

Planner recommendation only: Main should run deterministic pre-review closure, freeze both `phase-5-plan-r2` Planner candidate paths, preassign the exact correction-round-2 artifact and resume the same Plan Reviewer. This is automatic correction round `2/2`; Main alone admits verdicts and either transitions on `PASS` or routes unresolved findings to `OWNER_DECISION_REQUIRED`.
