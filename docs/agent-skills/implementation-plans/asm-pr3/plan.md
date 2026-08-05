# ASM-PR3 — Detailed Implementation Plan: Controlled `frontend-design` Structural Pilot

Plan này là execution contract đã delivery qua PR #69 cho ASM-PR3. Việc merge planning artifact không tự cấp skill/reference implementation, model execution hoặc bất kỳ Git/GitHub/CI/merge/remote action nào ngoài instruction hiện tại.

## 1. Trạng thái và authority

| Trường | Giá trị hiện tại |
| --- | --- |
| Plan status | `CP4 structural migration complete; CP5 pending` |
| Planning date | `2026-08-05` |
| Historical discovery branch | `docs/agent-skills-asm-pr3-planning` |
| Historical discovery branch base | `06d8d5bae3c9e857767c2d988fd45c57449b1d4f` |
| Planning delivery | commit `684b821150c9e20a067a2e83dd8ad8514008dbfa`; PR #69 merged at `9a44f5082242a982e487eb7d0c4e03068cf5af93` |
| Current implementation branch/base | `feat/agent-skills-asm-pr3` từ synchronized `main == origin/main == 9a44f5082242a982e487eb7d0c4e03068cf5af93` |
| Immutable behavioral baseline | `81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb` — merge commit của ASM-PR2C / PR #67 |
| Baseline reconciliation | `frontend-design` core và ba committed suite có cùng Git blob tại `81f6c32`, `06d8d5b` và `9a44f50`; PR #68 và planning PR #69 không thay bốn artifact này |
| Dependency | ASM-PR2C / PR #67, cumulative eval-contract correction / PR #68 và ASM-PR3 planning / PR #69 đều đã merge vào current `main` |
| Starting eval baseline | focused `1 skill / 3 suite files / 18 cases / 0 diagnostics`; cumulative `9 skills / 27 suite files / 177 cases / 0 diagnostics` |
| Discovery | `complete` |
| Preliminary size | `Medium` theo roadmap: một candidate, structural-only, rollback cục bộ |
| Final size | `Large/high-risk` cho execution planning: ordered immutable baseline, semantic comparison, mandatory fresh-reader evidence, transient evidence integrity và explicit rollout gate |
| Current permission | implement CP2–CP8 trong approved scope; self-review mỗi CP; tạo coherent checkpoint commits khi cần; gọi bounded read-only fresh readers; normal-push đúng một lần sau final review |
| Program fresh-reader authority | bounded advisory read-only fresh readers đã được owner cấp ở program level; `not_run` trong planning vì direct evidence đã đủ, nhưng vẫn là mandatory future pilot gate |
| Not granted | frozen suite correction, tooling/CI/package/product/DB scope, push trước final review, PR creation/update, CI watch/fix, merge, deploy, DB/production, destructive hoặc history action |
| Specialist | `0`; direct repository evidence đã đủ để lập plan, không còn hard-risk cluster cần specialist review |

## 2. Mục tiêu và outcome quan sát được

ASM-PR3 phải chứng minh một migration progressive-disclosure end to end cho `frontend-design` mà không đổi behavior:

1. giữ mọi mandatory cross-cutting rule và routing decision trong core;
2. chuyển nguyên nghĩa năm screen-type section hiện có sang năm reference có demonstrated consumer;
3. khiến core tự chọn tất cả và chỉ những reference khớp task, kể cả overlap `Admin + Shared`;
4. chứng minh monolithic baseline và migrated candidate giữ behavior tương đương trên committed 18-case suite;
5. có exact resource-access evidence và mandatory fresh-reader comparison;
6. dừng ở explicit owner `continue / revise / stop` gate trước ASM-PR4.

Success không được suy ra từ core ngắn hơn. Bất kỳ regression về routing, safety, accessibility, responsive behavior, ownership boundary, verification truthfulness hoặc reporting đều phủ quyết lợi ích structural/context.

## 3. Nguồn authoritative và sự thật đã xác nhận

### 3.1 Source ownership

- [`../../structural-migration-roadmap.md`](../../structural-migration-roadmap.md) sở hữu approved candidate, order, target bundle, exclusions, pilot gate và rollback boundary.
- [`../../progress.md`](../../progress.md) sở hữu current actual planning, implementation, verification và delivery status.
- [`../README.md`](../README.md) sở hữu per-PR artifact layout và pending owner-decision rule.
- File này sở hữu detailed ASM-PR3 execution contract sau khi owner duyệt.
- [`owner-review-brief.md`](./owner-review-brief.md) là decision surface; nó không thay thế plan này.
- `.agents/skills/frontend-design/**` sở hữu operational behavior sau implementation.
- `.agents/evals/frontend-design/{regression,routing,fresh-reader}.json` là frozen test specification, audit-only trong ASM-PR3.

### 3.2 Git, dependency và baseline

- Preflight bắt đầu từ clean `audit/agent-skills-pr2abc-eval-contracts` tại `10268ef8199dc07d89e2710b9c0380d8d1e8ced4`.
- `git fetch origin` cập nhật `origin/main` từ `81f6c32` lên `06d8d5b`.
- Local `main` fast-forward-only từ `81f6c32` lên `06d8d5b`; sau sync local `main == origin/main`, divergence `0/0`.
- Discovery branch được tạo trực tiếp từ synchronized `main`, không stack trên feature branch cũ.
- Discovery branch `HEAD` và merge-base với `main` đều là `06d8d5b` trước planning edits.
- PR #68 merge tại `06d8d5b` sửa một số suite của PR2A/PR2B/PR2C và durable docs, nhưng không sửa `frontend-design` core hoặc suite trio.
- Planning commit `684b821` đã merge qua PR #69 tại `9a44f50`; sau fetch và fast-forward-only, local `main == origin/main == 9a44f50`, divergence `0/0`.
- Current `feat/agent-skills-asm-pr3` được tạo trực tiếp từ `9a44f50`; pre-correction `HEAD` và merge-base với `main` đều là `9a44f50`.
- Git blob equality giữa `81f6c32`, `06d8d5b` và `9a44f50` đã được xác nhận cho:
  - `.agents/skills/frontend-design/SKILL.md` → `d5f1a8307c2069fbe3ba9a6477f6c83f2f23f48d`;
  - `.agents/evals/frontend-design/regression.json` → `5f97e1cf6e451640dfd06f8231dc60d1fc6f060f`;
  - `.agents/evals/frontend-design/routing.json` → `0313890afba0ecefe9a8a9fdb4894c6f29532a99`;
  - `.agents/evals/frontend-design/fresh-reader.json` → `9538ae4ea9770aa930a3ed384c376e68aacf7664`.

Vì vậy:

- current implementation branch baseline là synchronized `main` sau planning delivery tại `9a44f50`;
- behavioral comparison baseline vẫn pin exact ASM-PR2C merge `81f6c32` theo roadmap;
- nếu bất kỳ artifact frozen nào đổi trước baseline capture, phải re-run reconciliation và dừng nếu thay đổi là material.

### 3.3 Current bundle và suite

- Current `frontend-design` bundle chỉ có một `SKILL.md`, 458 lines, không có reference.
- Năm screen-type section nằm tại current headings:
  - Client / Marketing: lines 56–80;
  - Learning Experience: lines 81–117;
  - Teacher Authoring: lines 118–157;
  - Admin / Business Operations: lines 158–191;
  - Shared Design System Components: lines 192–204.
- Cross-cutting core bắt đầu lại tại `## Subject grounding` line 205 và tiếp tục qua output contract line 458.
- Committed suite allocation là `6 regression / 8 routing / 4 fresh-reader = 18`.
- Suite đã mã hóa future exact reference paths và phân biệt monolithic baseline khỏi migrated candidate; baseline không có nghĩa vụ chọn future path chưa tồn tại.
- `node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design` hiện `valid`, `3 files / 18 cases / 0 diagnostics`.
- `node .agents/scripts/run-skill-evals.mjs validate --all` hiện `valid`, `9 skills / 27 files / 177 cases / 0 diagnostics`.
- `node .agents/scripts/validate-skill.mjs` hiện `valid`, `11 skills / 0 errors / 4` existing non-blocking `CORE_LENGTH_SIGNAL` warnings; không warning nào thuộc `frontend-design`.
- Runner chỉ validate, prepare synthetic package và aggregate report; nó không execute hoặc semantic-grade model. Synthetic packaging không chứng minh isolation.

## 4. Confirmed decisions, assumptions, conflicts và open questions

### Confirmed decisions

- Candidate duy nhất là `frontend-design`.
- Migration đầu tiên là structural-only: move existing content, thêm exact resource routing, không cleanup/rewrite behavior.
- Core phải yêu cầu đọc mọi matching reference khi task overlap.
- Five proposed references và exact read conditions đã được roadmap owner-approve.
- Committed ASM-PR2A suites là audit-only; suite gap không được sửa trong migration diff.
- Fresh-reader base-versus-candidate là mandatory.
- Pilot phải pass explicit owner continue gate trước ASM-PR4.
- Owner instruction sau branch setup đã cấp exact local implementation CP2–CP8, self-review mỗi CP, coherent checkpoint commits, bounded fresh-reader execution và một final normal push; không cấp PR hoặc CI action.

### Assumptions

- Same model class và equivalent execution conditions có thể được cung cấp cho baseline/candidate semantic runs. Nếu không, comparison phải ghi variance và có thể trở thành blocking `inconclusive`.
- Exact read evidence có thể được ghi bằng observation-bound `skill_resource_access`; nếu chỉ có executor self-report thì phải label đúng và không claim runtime enforcement.

### Conflict đã hòa giải

- Roadmap pin ASM-PR2C merge `81f6c32` làm behavioral baseline, trong khi current `main` sau planning delivery là `9a44f50`. Bốn artifact thuộc pilot có exact blob equality tại `81f6c32`, `06d8d5b` và `9a44f50`, nên dùng `81f6c32` cho behavior comparison và `9a44f50` cho implementation-branch provenance không tạo suite/core variance.

### Open questions

- Không có open question blocking nội dung plan.
- Không còn owner decision chặn việc bắt đầu CP2–CP8. Exact executor/runtime/access của từng fresh-reader run vẫn phải được ghi theo evidence thực tế; nếu không thể tạo comparable observations thì comparison là blocking `inconclusive`.
- PR, CI, merge, deployment và mọi remote action ngoài đúng một final normal push vẫn là gate riêng.

## 5. Target bundle và progressive-disclosure contract

### 5.1 Nội dung bắt buộc giữ trong core

`.agents/skills/frontend-design/SKILL.md` phải giữ:

- frontmatter, activation, ownership và proportional process selection;
- five-type classifier và rule chọn mọi matching type khi overlap;
- related-skill routing;
- repository/product guardrails;
- direct resource-routing table và minimum decision rule để chọn/skip reference;
- subject grounding và two-pass design process;
- cross-cutting visual system, layout/action hierarchy, dialogs/feedback, forms, copy, UI states, motion, responsive và accessibility rules;
- implementation boundaries, final critique và output expectations.

Không chuyển mandatory routing, cross-cutting safety, responsive/accessibility, no-fake-success, implementation boundary hoặc truthful output rule vào optional reference.

### 5.2 Reference catalog

| Reference | Exact read condition | Content move | Valid skip group |
| --- | --- | --- | --- |
| `references/client-marketing.md` | Read after classifying Client / Marketing and before planning, implementing, or reviewing homepage, landing, public discovery, pricing, promotion, or product-introduction UI | Existing Client / Marketing direction, priorities và avoid list | Learning, authoring, admin-only, shared-only |
| `references/learning-experience.md` | Read after classifying Learning Experience and before lesson, exercise, quiz, flashcard, review, progress, or learner-dashboard work | Existing Learning direction, four learner questions, priorities và avoid list | Client, authoring, admin-only, shared-only |
| `references/teacher-authoring.md` | Read after classifying Teacher Authoring and before course, lesson, exercise, media, preview, submission, or revision work | Existing Teacher Authoring direction, meaningful grouping, priorities và avoid list | Client, learning, admin-only, shared-only |
| `references/admin-business-operations.md` | Read after classifying Admin / Business Operations and before dashboard, review, user, payment, discount, role, moderation, or audit UI work | Existing Admin direction, important-confirmation rules, priorities và avoid list | Client, learning, authoring-only, shared-only |
| `references/shared-design-system-components.md` | Read before changing/reviewing a shared design-system component or proposing a global primitive, token, layout, or default | Existing four global-change checks và global-default prohibitions | Feature-local work không đề xuất shared change |

Rules:

- Core link trực tiếp tới cả năm reference; không nested discovery chain.
- Path phải relative, contained trong `.agents/skills/frontend-design/` và không dùng symlink/junction/reparse indirection.
- Một task có thể match nhiều reference; core phải yêu cầu đọc tất cả matching reference.
- Mere use của shared primitive không kích hoạt Shared reference; chỉ change/review shared component hoặc global proposal mới kích hoạt.
- Move content giữ nguyên nghĩa và established wording; heading/link adaptation tối thiểu được phép để file độc lập đọc được.
- Không tạo script, asset, metadata, example hoặc reference thứ sáu.

## 6. Protected invariants và frozen suite coverage

| Invariant | Coverage chính | Blocking condition |
| --- | --- | --- |
| Screen classification thay đổi design latitude/hierarchy đúng surface | regression + routing | one-size-fits-all aesthetic hoặc wrong classification |
| Teacher destructive form giữ context, action hierarchy, pending/disabled và input recovery | regression | unsafe confirmation hoặc recoverable input loss |
| Feature-local need không tự đổi global primitive | regression + routing + fresh-reader | unjustified shared default change |
| Design audit report phân biệt fact/recommendation/not-run | regression | fabricated edit, QA hoặc integration claim |
| Motion phục vụ task và giữ reduced-motion path | regression | motion cản repeated practice hoặc bỏ reduced motion |
| Responsive/accessibility cross-cutting rules luôn discoverable | regression | bỏ mobile overflow, keyboard, focus hoặc semantic path |
| Design-only review không tự kích hoạt engineering workflow | routing | spurious `frontend-workflow` route |
| Non-trivial frontend implementation co-activate design + workflow | routing + fresh-reader | một owning frontend skill bị bỏ |
| Non-UI near miss không route frontend skill/reference | routing + fresh-reader | spurious frontend activation |
| Candidate chọn đúng exact reference và skip irrelevant reference | mọi suite, đặc biệt fresh-reader | missing match, load-all hoặc unnecessary Shared reference |

Frozen suite contract:

- Không đổi 18 case IDs, prompts, contexts, criteria, expected/forbidden behavior, safety vetoes, routes hoặc configs trong ASM-PR3.
- Nếu gap được phát hiện trước baseline capture: dừng, lập separately reviewed coverage correction, merge correction, re-pin baseline rồi restart.
- Nếu failure xuất hiện sau baseline: không weaken suite; classify candidate regression, environment variance hoặc genuine suite defect và dừng ở đúng gate.

### 6.1 Frozen 18-case inventory

Monolithic baseline luôn được chấm trên behavior hiện tại và không có future-path obligation. Migrated candidate phải thỏa exact expectation dưới đây.

| Suite / case | Candidate reference expectation | Repository route expectation |
| --- | --- | --- |
| regression / `fd-reg-dialog-form-feedback-copy` | `teacher-authoring.md`; không áp physical `frontend-workflow` reference vào bundle này | behavior giữ safe confirmation/recovery |
| regression / `fd-reg-local-vs-global-primitive` | `admin-business-operations.md` + `shared-design-system-components.md` | local-first shared boundary |
| regression / `fd-reg-output-and-related-routing-report` | chỉ matching Learning reference | truthful design-only report; unrun workflow/QA stays pending/not run/out of scope |
| regression / `fd-reg-purposeful-motion` | matching Client + Learning references | proportional motion latitude, reduced-motion safe |
| regression / `fd-reg-responsive-accessibility-baseline` | `learning-experience.md` + `admin-business-operations.md`; workflow manual-QA reference không thuộc physical ownership của suite này | responsive/accessibility evidence stays truthful |
| regression / `fd-reg-screen-latitude-and-hierarchy` | Client + Learning + Admin references | distinct latitude/hierarchy/signature |
| routing / `fd-route-admin-operations` | chỉ `admin-business-operations.md` | `frontend-design`; forbid `frontend-workflow` |
| routing / `fd-route-admin-shared-overlap` | Admin + Shared references | `frontend-design` + `frontend-workflow` |
| routing / `fd-route-client-marketing` | chỉ `client-marketing.md` | `frontend-design`; forbid `frontend-workflow` |
| routing / `fd-route-learning-experience` | chỉ `learning-experience.md` | `frontend-design`; forbid `frontend-workflow` |
| routing / `fd-route-nonfrontend-near-miss` | no design reference | forbid both frontend skills |
| routing / `fd-route-nontrivial-frontend-coactivation` | `client-marketing.md`; workflow references remain workflow-owned | `frontend-design` + `frontend-workflow` |
| routing / `fd-route-shared-design-system` | chỉ `shared-design-system-components.md` | `frontend-design`; forbid `frontend-workflow` |
| routing / `fd-route-teacher-authoring` | `teacher-authoring.md`; skip other four absent overlap | `frontend-design` + `frontend-workflow` |
| fresh-reader / `fd-fresh-admin-shared-overlap` | Admin + Shared; skip Client/Learning/Teacher | preserve usage-site-first boundary |
| fresh-reader / `fd-fresh-learning-single-reference` | Learning only | do not infer unrequested engineering workflow |
| fresh-reader / `fd-fresh-nonui-near-miss` | no design reference | neither frontend skill |
| fresh-reader / `fd-fresh-teacher-local-skip-shared` | Teacher only; explicitly skip Shared | both frontend skills for implementation, but feature-local boundary remains |

## 7. Exact scope và exclusions

### Planning checkpoint hiện tại

Được phép thay đúng các durable planning sources:

```text
docs/agent-skills/implementation-plans/asm-pr3/plan.md
docs/agent-skills/implementation-plans/asm-pr3/owner-review-brief.md
docs/agent-skills/implementation-plans/README.md
docs/agent-skills/progress.md
```

### Proposed future implementation scope

Sau explicit owner approval + implementation permission:

```text
.agents/skills/frontend-design/SKILL.md
.agents/skills/frontend-design/references/client-marketing.md
.agents/skills/frontend-design/references/learning-experience.md
.agents/skills/frontend-design/references/teacher-authoring.md
.agents/skills/frontend-design/references/admin-business-operations.md
.agents/skills/frontend-design/references/shared-design-system-components.md
docs/agent-skills/implementation-plans/asm-pr3/plan.md
docs/agent-skills/implementation-plans/asm-pr3/owner-review-brief.md
docs/agent-skills/progress.md
```

`docs/agent-skills/implementation-plans/README.md` trở thành audit-only sau registration hiện tại. Master plan và roadmap cũng audit-only trừ khi discovery sau approval tìm thấy material source conflict thật sự.

### Không được chạm trong ASM-PR3

- `.agents/evals/frontend-design/**` hoặc suite của skill khác;
- `.agents/scripts/**`, schema, runner, validator hoặc their tests;
- `AGENTS.md`, `.github/workflows/**`, `package.json`;
- `frontend-workflow` hoặc bất kỳ skill bundle khác;
- product UI/code, component, style, route, test, fixture, migration, seed hoặc database;
- raw runner workspace, bundle copy, observations, transcript, full environment dump hoặc absolute temp path trong Git.

## 8. Dependency graph và slicing strategy

```text
PR #67 merge / immutable behavioral baseline 81f6c32
  + PR #68 merge / current synchronized main 06d8d5b
  → PR #69 planning merge / implementation branch base 9a44f50
  → explicit owner local-implementation decision
  → frozen suite and pre-migration monolith snapshot
  → structural-only core/reference migration
  → deterministic validation
  → formal comparative workspace and equivalent execution
  → mandatory fresh-reader/resource-access evidence
  → main review and bounded correction
  → explicit owner continue/revise/stop gate
  → only after continue + merge: ASM-PR4
```

Slicing strategy là risk-first + one vertical pilot:

- Risk-first bằng frozen baseline/evidence trước structural edit.
- Một coherent migration slice gồm core + five references; không tách từng reference thành independent PR vì core routing và cross-reference overlap phải review cùng nhau.
- Eval suites không đi cùng write scope vì chúng là independent frozen oracle.
- Durable reconciliation chỉ ghi evidence thực tế sau từng gate.

Không có implementation stream nào an toàn để parallel: baseline, core routing, five references, evaluation và review phụ thuộc tuần tự vào cùng contract.

## 9. Ordered implementation checkpoints

### CP0 — Planning branch và discovery (`complete`)

- Sync local `main` bằng fetch + fast-forward-only.
- Tạo `docs/agent-skills-asm-pr3-planning` từ synchronized main.
- Reconcile master/roadmap/progress/README, affected skill, suite trio, runner/validator contract và prior dependencies.
- Lập plan + owner brief, review, commit/push và merge qua PR #69 tại `9a44f50`.

Completion evidence: branch/base facts, focused/cumulative validation hiện tại, target bundle mapping và self-review của plan.

### CP1 — Owner local-implementation decision và handoff (`complete`)

Owner đã grant exact local implementation CP2–CP8, self-review mỗi CP, coherent checkpoint commits khi cần, bounded read-only fresh readers và đúng một normal push sau final review. Owner không cấp PR creation/update, CI watch/fix, merge hoặc push trước final review.

### CP2 — Re-establish base, freeze suites và preconditions (`complete`)

- Dùng existing `feat/agent-skills-asm-pr3` tại base `9a44f50` chỉ sau exact local implementation permission; branch setup và stale-doc correction không tự bắt đầu CP2.
- Confirm clean tree, branch base, dependency ancestry, local/remote main equality và no unexpected ASM-PR3 branch conflict.
- Reconfirm blob/hash/semantic identity của frozen 18-case suite; suite diff phải rỗng.
- Run focused/all suite validation và structural validator trước migration.
- Audit 18 executor packages cho evaluator secrecy, current path existence và future reference expectations.

Stop nếu suite gap, stale baseline, dirty ownership, dependency conflict hoặc ungranted action xuất hiện.

Current evidence: clean branch base `9a44f50`; local `main == origin/main`, divergence `0/0`; four protected blobs identical at `81f6c32`, `06d8d5b` and `9a44f50`; focused `1/3/18/0`, cumulative `9/27/177/0`, structural validator `11/0/4`; 18 cases / 54 context entries exist; zero future-reference leak in executor input; frozen skill/suite diff empty. CP2 self-review: `0 Critical / 0 Required`.

### CP3 — Pre-migration monolith observation

- Prepare a candidate-only reference workspace pinned to `81f6c32`:

```text
node .agents/scripts/run-skill-evals.mjs prepare --skill frontend-design --isolation synthetic --candidate-ref 81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb --no-baseline
```

- Execute the 18 opaque cases read-only with evaluator-only material hidden.
- Record raw observation, actual access, limitations and observation-bound resource evidence in transient workspace.
- Human evaluator proposes candidate-only `case_status`; `comparison_status` remains `null`.
- Persist only a concise owner-approved summary if later authorized; do not commit raw evidence.

Đây là pre-migration monolith snapshot, không được gọi là comparative baseline artifact hoặc proof of isolation.

Current evidence: candidate-only synthetic workspace pinned to `81f6c32` packaged one opaque monolith variant for all 18 frozen cases. Eighteen valid bounded read-only observations passed human rubric review with no safety veto; exact disclosed access was limited to the monolith `SKILL.md` plus each case's prompt/context. One initial Learning attempt omitted its context because the operator instruction did not name the files; that attempt is excluded, and a new independent reader rerun with the complete package passed. Known non-blocking variances were failed exact-path probes, one reader enumerating case path names without reading their contents, terminal mojibake in displayed Vietnamese excerpts, and the Teacher scenario safely surfacing the supplied exercise/course-form scope mismatch. Raw observations remain transient. CP3 self-review: `0 Critical / 0 Required`.

### CP4 — Structural-only migration

- Move exactly five current screen-type sections into exact five references.
- Add direct resource-routing table và overlap rule to core.
- Preserve cross-cutting core, behavior, examples, prohibitions, related routes và output contract.
- Do not edit frozen suites, tooling, CI hoặc unrelated wording.
- Audit moved-content completeness and mandatory-core inventory before any semantic execution.

Current evidence: `frontend-design` now has one core plus the exact five approved references. A direct routing table requires every matching reference, excludes non-matching references, and distinguishes a global shared-primitive change from feature-local composition. UTF-8 byte-aware comparison confirms each reference body exactly matches its corresponding pre-migration section after removing only the numbered source heading; no screen-specific behavior was rewritten. Activation, five-type classifier, proportional process, related-skill routing, guardrails, subject grounding, cross-cutting design/interaction/safety rules, implementation boundaries, final critique and output contract remain in core. Each reference has a direct consumer and a meaningful skip group. CP4 self-review: `0 Critical / 0 Required`.

### CP5 — Deterministic candidate validation

Run:

```text
node --test .agents/scripts/validate-skill.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Additionally audit:

- exactly one core + five intended references;
- all five direct links resolve inside bundle;
- no nested reference chain, symlink/junction/reparse indirection hoặc unexpected artifact;
- frozen suite trio byte-identical and CI diff empty;
- Markdown headings/tables/fences, UTF-8/no-BOM, final newline and exact diff scope;
- current behavior text is neither lost nor duplicated into conflicting rules.

### CP6 — Formal base-versus-candidate comparison

- Prepare one comparative workspace from current tree and immutable baseline:

```text
node .agents/scripts/run-skill-evals.mjs prepare --skill frontend-design --isolation synthetic --candidate-current-tree --baseline-ref 81f6c32e45e41fb8cc4bd84d67806fa70f8f2cdb
```

- Execute both opaque variants for all 18 cases with equivalent prompt/context, same model class, same requested policy and disclosed actual access.
- Candidate and baseline must not see each other's output, evaluator criteria, expected answer hoặc role identity.
- Create exact observation-bound `skill_resource_access` artifacts for each executed role/case when evidence exists:
  - `available` from immutable bundle manifests;
  - `supplied` from actual operator/runtime observation;
  - `read` from runtime observation or explicitly labeled executor self-report;
  - `unknown` with `resources: null` when exact evidence does not exist.
- Human evaluator inspects hidden rubric/raw observations and proposes per-case `case_status` and `comparison_status`.
- `report --workspace <workspace-id>` must produce a complete, immutable comparative report; runner does not invent semantic verdict.
- Compare formal baseline-role observations with CP3 snapshot. Material unexplained drift is `inconclusive` and blocks the pilot.

### CP7 — Mandatory fresh-reader gate

Fresh-reader comparison must cover at least the committed four-case suite:

1. `fd-fresh-learning-single-reference` — one normal single-type consumer;
2. `fd-fresh-admin-shared-overlap` — overlapping Admin + Shared consumer;
3. `fd-fresh-nonui-near-miss` — non-UI route/reference skip;
4. `fd-fresh-teacher-local-skip-shared` — protected coactivation + feature-local Shared skip.

Evidence rules:

- bounded, read-only, blind package;
- no author conclusion, expected answer, other variant output hoặc future-path obligation supplied to baseline;
- candidate selects references from core routing + task evidence only;
- actual filesystem/tool/network/credential/remote/mutation access disclosed;
- no claim of enforced isolation, native auto-trigger hoặc token saving without exact evidence;
- all material criteria pass; any safety veto, material regression hoặc material `inconclusive` blocks.

Owner-requested skip-efficiency probe chạy cùng bounded fresh-reader methodology nhưng không sửa frozen suite:

1. task Learning-only phải đọc core + Learning reference và skip Client/Teacher/Admin/Shared;
2. task Teacher-local dùng shared primitive nhưng không đổi global primitive phải đọc core + Teacher và skip Shared;
3. non-UI task phải không route hoặc đọc frontend-design reference nào.

Với mỗi baseline/candidate pair, record exact resource `available`/`supplied`/`read` khi evidence hỗ trợ và compare exact selected file/line/byte metrics. Chỉ được kết luận candidate giảm supplied/read material khi evidence trực tiếp hỗ trợ; không gọi đó là token saving, native routing hoặc enforced isolation. Nếu candidate đọc irrelevant reference, classify đó là routing defect, sửa smallest core read condition/routing rule trong CP4 scope, rồi rerun affected probe và cumulative verification; không sửa/weaken frozen suite để làm kết quả pass.

### CP8 — Main review, correction và cumulative verification

- Read `code-review-and-quality` before formal implementation review.
- Review exact diff against owner-approved plan, source ownership, frozen suite, core inventory, resource consumers, read conditions, evidence boundaries and rollback.
- Classify findings; `Critical`/`Required` block.
- Correct only supported in-scope structural findings under explicit correction permission.
- Behavior rewrite, suite gap, tooling need hoặc new reference is scope expansion and stops.
- Re-run affected validation/evaluation after any correction that can invalidate evidence.
- Reconcile plan/brief/progress with actual results only.

### CP9 — Owner pilot gate và delivery boundary

Owner receives:

- exact diff/file ownership;
- deterministic command results;
- focused/cumulative counts;
- comparative + fresh-reader summary and claim limitations;
- resource selection/read evidence;
- findings and final `0 Critical / 0 Required` state;
- rollback boundary;
- explicit permission state.

Owner chooses `continue`, `revise`, or `stop`. `continue` approves pilot outcome only; it does not by itself authorize commit, push, PR, merge, ASM-PR4 implementation hoặc remote action unless stated explicitly.

## 10. Acceptance criteria

1. `frontend-design` bundle contains exactly one core and the five approved references; no extra artifact.
2. Core independently exposes activation, five-type classification, all-match overlap rule, related-skill routing, exact resource conditions, cross-cutting safety/accessibility/responsive rules, stop boundaries and output contract.
3. Each reference has a demonstrated consumer and a meaningful valid skip group; direct contained link resolves.
4. Existing screen-specific behavior is moved without material semantic rewrite, loss hoặc conflicting duplication.
5. A local Teacher task does not select Shared merely because it uses `Dialog`; an actual Admin global primitive proposal selects both Admin and Shared.
6. All frozen 18 cases remain byte-identical, structurally valid and evaluator-separated.
7. Focused validation remains `3 files / 18 cases / 0 diagnostics`; cumulative totals remain `9 / 27 / 177 / 0` unless an independently merged prerequisite legitimately changes them and plan is reconciled first.
8. Structural validator has `0 errors`; any warning delta is explained and no new `frontend-design` warning is accepted without review.
9. Runner and validator black-box tests pass; CI, package, product and DB diffs are empty.
10. Comparative evidence is complete; every candidate case is `passed`; no protected case is `regressed` or materially `inconclusive`; no safety veto fires.
11. All four mandatory fresh-reader cases pass under equivalent, disclosed conditions with exact reference selection/skip behavior.
12. Exact resource evidence distinguishes `available`, `supplied`, `read` and `unknown`; self-report is never upgraded to runtime enforcement.
13. No raw evaluation workspace/evidence, secret, credential, absolute temp path hoặc transcript is committed.
14. Main review ends at `0 Critical / 0 Required` after any authorized corrections.
15. Owner explicitly records pilot `continue / revise / stop`; ASM-PR4 remains blocked without `continue` and merged ASM-PR3.

## 11. Verification và evidence matrix

| Layer | Check | Required outcome |
| --- | --- | --- |
| Suite specification | `validate --skill frontend-design` | `valid`, 3 files, 18 cases, 0 diagnostics |
| Cumulative suite | `validate --all` | `valid`, expected current totals, 0 diagnostics |
| Bundle structure | `validate-skill.mjs` | valid, 0 errors, only explained warnings |
| Runner regression | `node --test .agents/scripts/run-skill-evals.test.mjs` | pass |
| Validator regression | `node --test .agents/scripts/validate-skill.test.mjs` | pass |
| Structural/hygiene | link/path/containment/UTF-8/newline/fence/table/diff audits | pass |
| Semantic behavior | complete comparative report for 18 cases | no failed/regressed/materially inconclusive protected case |
| Fresh reader | four mandatory cases | passed with exact selection/skip evidence |
| Source scope | suite/tooling/CI/product/DB diff | empty |
| Git hygiene | `git diff --check`, status and staged/unstaged/untracked audit | pass; exact owned scope only |

Không chạy product Vitest, build, browser, E2E, database reset hoặc remote DB: structural skill migration không thay product behavior và các check đó không chứng minh skill contract. Nếu implementation discovery tìm thấy cross-boundary change thật sự, đó là scope conflict và phải dừng thay vì tự mở rộng verification.

## 12. Risks, mitigations và earliest detection

| Risk | Tác động | Mitigation | Earliest gate |
| --- | --- | --- | --- |
| Mandatory core rule bị chuyển vào optional reference | safety/routing regression | mandatory-core inventory + candidate-without-reference review + safety veto | CP4/CP5 |
| Core không yêu cầu mọi matching reference | overlap behavior mất | explicit all-match rule + Admin/Shared cases | CP4/CP7 |
| Mere shared usage load Shared reference | context/routing overreach | exact shared-change condition + Teacher local skip case | CP4/CP7 |
| Suite bị sửa để làm candidate pass | invalid oracle | byte/hash freeze; suite diff empty; separate correction stop | CP2 onward |
| Baseline SHA stale sau PR #68 | incomparable evidence | blob equality proof; immutable `81f6c32`; current-main branch provenance separate | CP0/CP2 |
| Baseline/candidate executor conditions khác | false comparison | same model class/package/policy; disclose variance; material variance → inconclusive | CP6 |
| Synthetic package bị gọi là isolation | overclaim | actual-access record; claim boundary in report | CP3/CP6 |
| `supplied`/`read` bị suy ra từ `available` | false resource evidence | observation-bound artifact; unknown remains null | CP6/CP7 |
| Structural move vô tình cleanup/rewrite semantics | behavior drift | verbatim-first move, focused diff, full 18-case comparison | CP4/CP8 |
| Raw evidence được commit | secret/noise/provenance leak | transient fixed workspace; exact Git artifact audit | CP5/CP8 |
| Pilot pass bị hiểu là ASM-PR4 authority | unauthorized rollout | explicit owner continue gate + separate implementation/Git gates | CP9 |

## 13. Rollback và stop boundaries

- Trước commit: correct only exact candidate files under granted scope; do not use destructive Git recovery.
- Sau local checkpoint hoặc remote delivery: rollback bằng một explicit owner-authorized correction/revert boundary cho `frontend-design` core + five references only; suites/tooling remain intact.
- Không amend/squash/rebase/reset/force-push/delete branch nếu owner chưa cấp exact permission.
- Stop ngay khi có suite gap, material behavior regression, safety veto, material `inconclusive`, missing exact reference evidence, source conflict, dirty ownership, tooling/CI need hoặc scope expansion.
- `not_run` không phải pass. Nếu mandatory semantic/fresh-reader evidence không thể chạy hợp lệ, pilot status là `Blocked`, không phải `continue`.

## 14. Documentation và progress tracking

Update points:

- CP0: register plan/brief, current planning status và exact permission.
- CP1: record only explicit owner decision evidence; `pending` không tự thành approved.
- CP2–CP8: update only actual branch, command, evidence, finding và status facts after they occur.
- CP9: record exact owner gate decision and exact Git/remote state; do not predict commit/PR/run identifiers.

Status vocabulary:

```text
not started
in progress
blocked
implemented
automated checks passed
semantic comparison passed
manual/fresh-reader QA pending
owner gate pending
completed
```

Raw observations, manifests, bundle copies, workspace metadata, reports and transcripts remain transient. A concise evidence summary may be committed only when owner approves that retention boundary.

## 15. Plan self-review

Main-agent self-review phải xác nhận trước handoff:

- goal/scope/exclusions match current owner instruction and roadmap;
- baseline/current-main distinction is explicit and blob-backed;
- exact core/reference ownership matches approved target structure;
- frozen suites are audit-only and no evaluator answer leaks into executor input;
- checkpoints satisfy dependency order and do not infer action permission;
- acceptance criteria are observable and verification exists in repository;
- mandatory fresh-reader/resource evidence and claim limits are explicit;
- rollback does not rely on destructive commands;
- no hidden ASM-PR4, product, tooling, CI hoặc behavior rewrite scope exists.

Current specialist plan-review decision: `0`. No unresolved material uncertainty remains after main discovery/self-review; plan size and skill activation alone do not justify a specialist.

Planning self-review evidence ngày `2026-08-05`:

- Initial main pass phát hiện hai `Required`:
  - draft ban đầu ghi program fresh-reader như chưa được cấp, trái owner-approved program authority;
  - `progress.md` còn ba heading tự nhận là current cho pre-delivery PR #68 state, trái Git evidence `06d8d5b`.
- Initial pass cũng ghi một `Suggestion`: plan chỉ nêu tổng `6/8/4`, chưa freeze đủ 18 case IDs và exact candidate reference/route expectations.
- Corrections trong planning scope:
  - phân biệt existing bounded read-only fresh-reader authority (`not_run` trong planning) khỏi ungranted implementation/Git/remote/non-program model actions;
  - chuyển stale PR #68 sections thành historical và ghi exact correction head/merge;
  - thêm full 18-case inventory, không sửa suite.
- Final main re-review: `0 Critical / 0 Required`; specialist `0`; fresh-reader `not_run` vì direct evidence đủ cho plan review.
- Planning verification:
  - `node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design`: valid, `1/3/18/0`;
  - `node .agents/scripts/run-skill-evals.mjs validate --all`: valid, `9/27/177/0`;
  - `node .agents/scripts/validate-skill.mjs`: valid, `11 skills / 0 errors / 4` existing warnings;
  - Markdown link, UTF-8/no-BOM, final-newline, balanced-fence, exact 18-case ID, five-reference catalog, scope, secret/conflict-marker và `git diff --check` audits: pass.

## 16. Transferable implementation brief

### Approved implementation goal

Structurally migrate only `frontend-design` into one core + five approved screen-type references while preserving behavior under CP2–CP8 and the owner-granted evaluation/checkpoint boundaries.

### Confirmed behavior

- Five screen classifications and proportional design latitude remain.
- Cross-cutting design, safety, state, responsive, accessibility, implementation and reporting rules remain mandatory core.
- All matching references are required; irrelevant references are skipped.

### Dependencies and order

Approved plan → synchronized implementation branch → frozen suite/baseline snapshot → structural move → validation → comparative/fresh-reader evidence → main review → owner gate.

### Expected files

Only `frontend-design` core/five references plus exact ASM-PR3 plan/brief/progress reconciliation after implementation permission.

### Forbidden files/domains

Eval suites, runner/schema/validator/tests, AGENTS, CI/package, other skills, product UI/code/tests and database artifacts.

### Automated verification

Runner tests, validator tests, structural validator, focused/all suite validation, link/path/Markdown/hygiene audits and `git diff --check`.

### Semantic verification

Candidate-only pre-migration snapshot, formal 18-case comparison, four mandatory fresh-reader cases, observation-bound resource evidence and main review.

### Known limitations

Synthetic packaging is not isolation; exact resource reads may be self-reported; no token-saving/native-trigger claim; implementation and every Git/remote action remain separately permissioned.
