# ASM-PR2A — Detailed Implementation Plan: Frontend Experience Behavioral Coverage

Owner-facing decision summary: [owner-review-brief.md](./owner-review-brief.md).

## 1. Status and authority

| Field | Current value |
| --- | --- |
| Plan status | `draft; pending owner approval` |
| Planning date | `2026-07-29` |
| Branch | `feat/agent-skills-asm-pr2a` |
| Synchronized baseline | `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030` |
| Base relationship | Branch được tạo trực tiếp từ `main == origin/main == cdfb9d321e4f595954d3db4ec02d1d1de2d1b030`; không stack trên ASM-PR1 hoặc feature branch khác |
| Dependency evidence | PR #64 `MERGED` lúc `2026-07-29T14:13:28Z`; merge commit `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030` chứa ASM-PR1 |
| Current mode | Discovery/planning only; không implement suite hoặc CI |
| Preliminary size | `Large/high-risk` |
| Final size | `Large/high-risk`, do sáu suite owners, cross-skill routing, evaluator secrecy, future-reference contract, shared CI boundary và per-skill rollback |
| Detailed design | `pending owner approval` |
| Owner review | `pending` |
| ASM-PR2A implementation | `not granted; not started` |
| Planning stage/commit/push | `granted; not yet consumed` |
| PR/CI/merge/deploy/database/history rewrite | `not granted` |

Quyền hiện tại chỉ cho phép repository/Git/GitHub inspection, fetch và fast-forward-only synchronization, tạo branch, discovery, planning-document edits, planning self-review/correction, đúng một planning commit và đúng một normal push. Quyền này không cho phép tạo hoặc sửa `.agents/evals/**`, sửa candidate skill, sửa runner/schema/tooling, sửa `.github/workflows/ci.yml`, thực thi model/subagent làm suite evidence, tạo PR hoặc theo dõi/sửa CI.

## 2. Goal and observable outcome

ASM-PR2A là coverage PR, không phải skill-migration PR. Sau một later owner-approved implementation:

1. `frontend-design` có một independently reviewable trio gồm regression, repository-routing và fresh-reader suite.
2. `frontend-workflow` có một independently reviewable trio tương tự.
3. Sáu file bảo vệ current behavior, co-activation, near misses, future reference selection, permission/stop/evidence truthfulness và per-skill rollback.
4. Exactly one CI step chạy:

   ```text
   node .agents/scripts/run-skill-evals.mjs validate --all
   ```

5. Suite definitions validate deterministically nhưng không execute model, semantic-grade, chọn winner hoặc tạo behavior evidence.
6. Một later migration agent có thể implement CP2–CP5 mà không rediscover suite ownership, case allocation, answer-key boundary, checkpoint order, verification hoặc delivery permission.

Observable completion của ASM-PR2A implementation là sáu suite files validate độc lập và cumulatively, exact CI step chạy trong existing Node 20 job, mỗi trio có coherent commit/rollback boundary, và main review còn `0 Critical / 0 Required`.

## 3. Current repository state

### 3.1 Direct facts

- `main` và `origin/main` cùng trỏ tới `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030`.
- PR #64 merged từ `feat/agent-skills-asm-pr1` vào `main`.
- Merge chứa standalone `skill_resource_access` v1, exact observation-byte binding, shared role-level `available`, per-case `supplied`/`read` summaries, manifest-derived metrics, black-box coverage và ASM-PR1 planning/tracker state.
- `.agents/evals/**` chưa tồn tại; current suite count là `0 configured skills / 0 suite files / 0 cases`.
- `run-skill-evals.mjs` hỗ trợ `validate`, `prepare` và `report`; runner không invoke hoặc grade model.
- Local `node .agents/scripts/run-skill-evals.mjs validate --all` trên Node `v24.11.1` trả `status: valid`, 0 errors và 0 warnings.
- Existing CI job là `test-and-build` (`Test and Build`) trên `ubuntu-latest`, setup Node 20, chạy unit tests, structural-validator tests, eval-runner tests và current skill structural validation trước integration/build.
- CI chưa gọi `validate --all`; vì vậy committed future suite definitions hiện chưa có deterministic CI validation step.
- Representative repository surfaces xác nhận scenario realism:
  - Client/Marketing: `app/(client)/page.tsx`;
  - Learning Experience: `app/(client)/learn/_components/LearnDashboardClient.tsx` và `ReviewSheet.tsx`;
  - Teacher Authoring: `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/AddExerciseDialog.tsx`;
  - Admin/Business Operations: `app/admin/courses/_components/reject-course-dialog.tsx`;
  - Shared Design System Component: `components/ui/dialog.tsx`;
  - complex client-state helper: `app/(client)/learn/_components/learning-dashboard-state.ts`.

Các product surfaces trên là bounded read-only grounding. Suite scenarios bảo vệ skill behavior; chúng không assert current product implementation là đúng hoặc đưa product changes vào scope.

### 3.2 Current ASM-PR1 capability and claim boundary

- `available` là runner-owned inventory từ immutable selected bundle manifest.
- `supplied` và `read` là optional observation-bound evidence; thiếu artifact giữ từng dimension là `unknown`.
- Present invalid resource evidence fail non-zero; missing optional evidence không làm semantic completeness fail.
- Exact `observation_sha256` dùng raw accepted observation bytes, không reserialize.
- Resource evidence nằm trong later workspace artifacts, không phải suite-definition fields.
- Full bundle availability hoặc `packaging_mode: synthetic` không chứng minh supplied/read, isolation, enforcement, credential exclusion, token reduction, native trigger hoặc automatic activation.

### 3.3 Current CI gap

`Run agent skill eval runner tests` chứng minh runner code, còn `Validate repo-local agent skills` chứng minh current skill bundle structure. Không step nào hiện load và validate mọi `.agents/evals/<skill>/{regression,routing,fresh-reader}.json`. ASM-PR2A cần thêm đúng một shared capability; ASM-PR2B/2C chỉ add suites và không sửa CI lại.

## 4. Confirmed requirements

1. Exact implementation allocation là hai skills, sáu suite files và một CI step.
2. Không skill edit, reference creation, migration, runner/schema change, model execution, semantic grader, product/database/package change.
3. `frontend-design` trio owns design classification, design/reference routing và protected design behavior.
4. `frontend-workflow` trio owns frontend engineering modes, contract/mocks/async/forms/state/manual-evidence behavior và related routing.
5. Cross-skill cases có một primary owner; pass của skill này không offset fail của skill kia.
6. Không duplicate case chỉ để tạo symmetry; design có 18 cases và workflow có 19 cases vì behavior density khác nhau.
7. Exact expected answers, forbidden behavior, expected routes, future reference names/read conditions, safety vetoes, comparison identity và other-variant output chỉ ở `evaluator_only`.
8. `executor_input` chỉ chứa neutral task prompt, bounded source context và requested execution policy.
9. Current suite schema phải giữ nguyên.
10. Candidate-only execution có thể đánh giá case status nhưng không có comparison verdict; future migration comparison cần explicit comparable baseline.
11. Suite files hữu ích trước khi future references tồn tại: regression/routing cases bảo vệ current behavior; fresh-reader evaluator expectations record future selection without adding nonexistent reference paths to executor context.
12. CP2 và CP3 là independent suite-trio boundaries; CP4 là independent shared CI boundary.
13. No case may be weakened after failure merely to obtain a pass.

## 5. Protected invariant matrix

| Invariant | Primary owner | Coverage owners | Blocking safety veto |
| --- | --- | --- | --- |
| Non-trivial frontend work activates both frontend skills | `frontend-workflow` | both routing trios | Missing either route or claiming one skill subsumes the other |
| Five screen classifications and design latitude remain distinct | `frontend-design` | design routing + regression | Wrong classification or applying marketing freedom to admin/shared UI |
| Every matching future reference is selected; unrelated references are skipped | skill owning the reference | routing + fresh-reader | Missing matching reference, reading irrelevant reference as mandatory, or leaking selection answer |
| A feature-local need does not mutate a global primitive | `frontend-design` | design regression/routing/fresh-reader | Global default edit without four shared-change checks |
| Responsive and accessibility behavior remains mandatory | `frontend-design` | design regression + workflow manual-QA cases | Omitting usable mobile/keyboard/focus/semantic/reduced-motion requirements |
| Missing backend never becomes fake production success | `frontend-workflow` | workflow regression/routing/fresh-reader | Local fake persistence, deceptive success, or hidden local-storage backend |
| Async/form/optimistic paths preserve input, prevent duplicates and recover safely | `frontend-workflow` | workflow regression | No pending guard, rollback, stale-response handling or recoverable input preservation |
| Meaningful loading/empty/success/error/stale/partial/denied/retry states are selected by scenario | `frontend-workflow` | workflow regression | Happy-path-only result when named states are material |
| Browser/manual evidence is truthful and fixture-ready | `frontend-workflow` + `test-quality-strategy` | workflow regression/routing/fresh-reader | Claiming observed/full QA without planned states, fixtures or actual observation |
| Permission/mode/stop boundaries remain explicit | `frontend-workflow` | workflow regression | Editing in Discovery, inventing contract, expanding backend/DB scope or continuing across hard stop |
| Output/reporting remains truthful | each skill | both regression trios | Claiming files/states/QA/integration not actually inspected or completed |
| Evaluator answer key never reaches executor | suite architecture | all six files | Expected/forbidden behavior, route answer, safety veto or variant identity in executor-visible input |

## 6. Exact scope and ownership

### 6.1 Future implementation owners

| Path | Classification | Ownership |
| --- | --- | --- |
| `.agents/evals/frontend-design/regression.json` | Required suite owner | Current protected design behavior |
| `.agents/evals/frontend-design/routing.json` | Required suite owner | Design activation, five classifications, overlaps and near misses |
| `.agents/evals/frontend-design/fresh-reader.json` | Required suite owner | Independent comprehension and future design-reference selection |
| `.agents/evals/frontend-workflow/regression.json` | Required suite owner | Modes, discovery, mocks, async/forms/state, QA truth and stops |
| `.agents/evals/frontend-workflow/routing.json` | Required suite owner | Workflow activation, related skills, co-activation and near misses |
| `.agents/evals/frontend-workflow/fresh-reader.json` | Required suite owner | Independent workflow-reference selection and skip groups |
| `.github/workflows/ci.yml` | Required shared CI owner | Exactly one `validate --all` step |
| `docs/agent-skills/implementation-plans/README.md` | Required planning router | Add/retain ASM-PR2A index only |
| `docs/agent-skills/implementation-plans/asm-pr2a/plan.md` | Required planning owner | Detailed implementation specification and actual checkpoint evidence |
| `docs/agent-skills/implementation-plans/asm-pr2a/owner-review-brief.md` | Required decision owner | Concise owner decision record |
| `docs/agent-skills/progress.md` | Required tracker | Current dependency, permission, checkpoint, review, commit/push/PR/CI state |

### 6.2 Audit-only sources

- `docs/agent-skills/plan.md`;
- `docs/agent-skills/structural-migration-roadmap.md`;
- `.agents/skills/frontend-design/**`;
- `.agents/skills/frontend-workflow/**`;
- `.agents/skills/maintain-repo-skills/**`;
- `.agents/scripts/**`;
- representative `app/**`, `components/**`, tests and package configuration.

Roadmap ownership does not require an edit: it already owns exact candidates, 6-file allocation, one-CI-step rule, exclusions, dependency and completion. README owns a direct per-PR index, so only README gains the ASM-PR2A link.

### 6.3 Forbidden domains

No edit to candidate skills/references, suite schema, runner/tooling/tests, product/application tests, `src/**`, `app/**`, `components/**`, `supabase/**`, package files, database state, deployment configuration or any second CI behavior.

## 7. Suite architecture

### 7.1 Exact suite-definition v1 contract

All listed object fields are required; unsupported fields are rejected.

| Object | Required fields | Conditional/allowed values |
| --- | --- | --- |
| Top level | `schema_version`, `artifact_type`, `skill`, `suite`, `description`, `cases` | version `1`; type `suite_definition`; suite `regression`, `routing` or `fresh-reader`; cases may be empty structurally but ASM-PR2A files are non-empty |
| Case | `case_id`, `title`, `executor_input`, `evaluator_only`, `suite_config` | IDs are unique kebab-case within file |
| `executor_input` | `prompt`, `context`, `execution_policy` | Context is an array; answer key is forbidden here |
| Repository context | `context_id`, `source_type`, `path` | `source_type: repository_file`; normalized safe repo-relative `/` path |
| Inline context | `context_id`, `source_type`, `content` | `source_type: inline_text`; non-empty trimmed content |
| `execution_policy` | `packaging_mode`, `fresh_context_required`, `variant_identity`, `requested_access` | `packaging_mode: synthetic`; identity `blind` or `visible` |
| `requested_access` | `filesystem`, `tools`, `allowed_tools`, `network`, `credentials`, `remote`, `mutation` | filesystem `none` or `package_read_only`; tools `none` or `allowlisted`; network/remote disabled, credentials excluded, mutation none |
| Common `evaluator_only` | `criteria`, `expected_behavior`, `forbidden_behavior`, `safety_vetoes` | criteria non-empty; expected behavior non-empty; forbidden/veto arrays may be empty |
| Routing-only evaluator | common fields + `expected_routes`, `forbidden_routes` | routes must be members of `candidate_skills`; both arrays may be empty and cannot overlap |
| Regression config | `behavior_area`, `protected_invariants` | behavior area is exactly one of `permission`, `safety`, `routing`, `ownership`, `correctness`, `evidence`, `stop`, `reporting`; invariants non-empty |
| Routing config | `routing_mode`, `candidate_skills`, `near_miss` | mode exactly `repository`; candidates non-empty |
| Fresh-reader config | `mode`, `independence_required` | mode `behavior-execution`, `documentation-comprehension` or `skill-comprehension`; independence exactly `true` |

`behavior_area` is not a routing/fresh-reader field. The detailed tables therefore record `n/a` plus exact routing/fresh mode for those suites instead of inventing a schema field.

### 7.2 Role of each suite

- Regression: protect observable current behavior and safety/permission/evidence/reporting guarantees independent of future file layout.
- Routing: determine which repo-local skills activate under explicit `AGENTS.md` routing, including expected/forbidden routes and near misses. It does not claim native platform auto-trigger behavior.
- Fresh-reader: define an independent, fresh-context comprehension/behavior scenario. Suite definition is test specification, not an executed observation.

### 7.3 Candidate-only and future comparison

- Before migration, committed suites can be run candidate-only against current skill bundles. A human may propose `passed`, `partially_passed`, `failed` or `not_run`; there is no `improved/equivalent/regressed` claim without baseline.
- During ASM-PR3/4, the same suite definitions can prepare explicit baseline and candidate bundles under comparable conditions. A human proposal remains required for semantic status.
- Deterministic runner validation never becomes semantic grading.

### 7.4 Executor/evaluator separation

Executor-visible:

- a neutral task/scenario prompt;
- bounded current repository files or neutral inline facts;
- requested synthetic execution policy.

Evaluator-only:

- classification/route answer;
- exact expected and forbidden behavior;
- criteria/materiality;
- safety vetoes;
- exact future reference selection and skip group;
- baseline/candidate identity during blind comparison;
- other-variant output and reviewer conclusion.

No context item may quote the roadmap row that names the expected reference for that scenario. Existing skill/core content may naturally contain its current behavior; the suite must not add a hidden answer as inline guidance.

### 7.5 Future references before physical migration

Exact future reference names/read conditions are recorded only in evaluator expectations:

| Primary skill | Future reference | Exact evaluator-side read condition | Valid skip group |
| --- | --- | --- | --- |
| `frontend-design` | `references/client-marketing.md` | After classifying Client / Marketing and before planning, implementing or reviewing homepage, landing, public discovery, pricing, promotion or product-introduction UI | Learning, authoring, admin-only and shared-only tasks |
| `frontend-design` | `references/learning-experience.md` | After classifying Learning Experience and before lesson, exercise, quiz, flashcard, review, progress or learner-dashboard work | Client, authoring, admin-only and shared-only tasks |
| `frontend-design` | `references/teacher-authoring.md` | After classifying Teacher Authoring and before course, lesson, exercise, media, preview, submission or revision work | Client, learning, admin-only and shared-only tasks |
| `frontend-design` | `references/admin-business-operations.md` | After classifying Admin / Business Operations and before dashboard, review, user, payment, discount, role, moderation or audit UI work | Client, learning, authoring-only and shared-only tasks |
| `frontend-design` | `references/shared-design-system-components.md` | Before changing/reviewing a shared design-system component or proposing a global primitive, token, layout or default | Feature-local work with no proposed shared change |
| `frontend-workflow` | `references/mock-data.md` | Before adding/reviewing typed mocks or when backend behavior is missing and UI-only/prototype scope is considered | Fully integrated frontend work with no mock |
| `frontend-workflow` | `references/async-state-and-forms.md` | Before implementing/reviewing an async mutation, optimistic update, form, dynamic field or complex client-state transition | Static composition with no async/form behavior |
| `frontend-workflow` | `references/manual-ui-validation.md` | Before planning, running or reporting browser/manual UI validation; responsive subsection when responsive behavior is material | Work with no browser-QA decision and non-responsive non-UI execution |

The executor context does not reference nonexistent paths. Candidate-only current-core cases require current behavior; future comparisons use the candidate bundle manifest when references physically exist.

### 7.6 Shared execution-policy and context codes

Every proposed case uses policy `P0`:

```json
{
  "packaging_mode": "synthetic",
  "fresh_context_required": true,
  "variant_identity": "blind",
  "requested_access": {
    "filesystem": "package_read_only",
    "tools": "none",
    "allowed_tools": [],
    "network": "disabled",
    "credentials": "excluded",
    "remote": "disabled",
    "mutation": "none"
  }
}
```

This is a requested policy, not proof of enforced isolation.

Context codes:

| Code | Executor-visible context sources |
| --- | --- |
| `C0` | `AGENTS.md` + neutral inline scenario |
| `CM` | `C0` + `app/(client)/page.tsx` |
| `CL` | `C0` + `app/(client)/learn/_components/LearnDashboardClient.tsx` or `ReviewSheet.tsx` named in the row |
| `CT` | `C0` + `app/(teacher)/teacher/courses/_components/CourseForm.tsx`; dynamic-field cases add neutral `inline_text` facts instead of an unsafe bracketed repository path |
| `CA` | `C0` + `app/admin/courses/_components/reject-course-dialog.tsx` |
| `CS` | `C0` + `components/ui/dialog.tsx` |
| `CAS` | `C0` + both `CA` and `CS` repository files |
| `CW` | `C0` + `app/(client)/learn/_components/learning-dashboard-state.ts` and the exact UI file named in the row |

Resource-access notation:

- `A=manifest`: `available` is the exact selected bundle manifest (current pre-migration bundle contains only current files; future candidate manifest includes physical references).
- `S/R=unknown`: no supplied/read claim without a valid observation-bound `skill_resource_access` artifact.
- `S/R=expected(paths) if observed`: a future controlled execution may record exact supplied/read paths with operator/runtime/self-report basis; otherwise it remains `unknown`.

## 8. Detailed six-file case matrix

Matrix tables group cases by behavioral intent for owner review. Future JSON must order `cases` lexically by stable `case_id`; criteria and veto IDs must also use deterministic kebab-case order. The semantic grouping below never overrides that exact serialization rule.

### 8.1 `frontend-design/regression.json` — 6 cases

Six cases protect distinct cross-cutting guarantees; screen selection itself belongs to routing.

| case_id | Suite / primary | Area | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Class / route | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fd-reg-screen-latitude-and-hierarchy` | regression / `frontend-design` | correctness | Compare a marketing opening, learner practice flow and admin queue | Propose proportional design direction for three named surfaces | `C0` | `P0` | Distinguish latitude, hierarchy and task-specific signature/restraint | One generic aesthetic recipe or marketing effects in admin | positive; design owns | Evaluator notes Client, Learning, Admin refs in future; no executor hint | Five-type classifier changes actual direction | Wrong latitude or generic one-size-fits-all answer | `A=manifest; S/R=unknown` | Protects cross-type behavior, not route selection |
| `fd-reg-local-vs-global-primitive` | regression / `frontend-design` | ownership | Admin rejection dialog needs more width on mobile | Recommend usage-site composition/wrapper before global Dialog change; apply four global-change checks | `CAS` | `P0` | Keep feature-local customization and inspect usages | Edit global default solely for local need | positive; design primary | Future Admin + Shared refs | Local need does not mutate primitive | Unjustified global primitive/default change | `A=manifest; S/R=unknown` | Owns change boundary rather than classification |
| `fd-reg-responsive-accessibility-baseline` | regression / `frontend-design` | safety | Long-content dialog and learning sheet at 375px with keyboard use | Review responsive/accessibility risks and required evidence | `CA` + `CL(ReviewSheet)` | `P0` | Cover overflow, action discovery, semantic controls, labels, focus, contrast, reduced motion and long content | Screenshot-only or desktop-only confidence | positive; design primary, workflow related for QA | Future matching screen refs; workflow manual ref evaluator-side when QA planned | Mobile and accessibility remain mandatory | Omit critical mobile/keyboard/focus path | `A=manifest; S/R=unknown` | Protects cross-cutting safety, not manual-evidence truth |
| `fd-reg-dialog-form-feedback-copy` | regression / `frontend-design` | correctness | Teacher destructive form dialog can fail recoverably | Review object/action/consequence, inline/server error, input preservation, copy/state hierarchy | `CT` | `P0` | Clear primary/destructive actions, plain copy, pending/disabled, preserved input | Ambiguous consequence, clever copy, lost input or adjacent destructive action | positive; both skills may be relevant | Future Teacher ref; workflow async ref only if implementation behavior is in task | Dialog/form/copy/state rules remain discoverable | Lost input or unsafe confirmation | `A=manifest; S/R=unknown` | Covers form design semantics, not engineering implementation |
| `fd-reg-purposeful-motion` | regression / `frontend-design` | correctness | Repeated flashcard practice and public hero propose animation | Decide where motion supports learning/marketing and reduced-motion behavior | `C0` | `P0` | Allow one purposeful thesis/feedback motion; avoid delaying practice; respect reduced motion | New library, scattered decoration or delayed repeated action without permission | positive; design owns | Future Client or Learning ref according to sub-scenario | Motion serves task and latitude | Motion blocks/reduces usability or ignores reduced motion | `A=manifest; S/R=unknown` | Only case focused on motion trade-off |
| `fd-reg-output-and-related-routing-report` | regression / `frontend-design` | reporting | Review-only substantial frontend request with no edits | Return bounded design audit and explicitly report related workflow/manual evidence state | `C0` | `P0` | State classification, direction, shared-component status, states, responsive/accessibility, inspection limits and intentional exclusions | Claim files changed, QA completed or integration verified without evidence | positive; design primary, workflow related but no implementation claim | Matching future design refs evaluator-side; no forced workflow ref | Final report is truthful and proportional | Fabricated change/QA/integration claim | `A=manifest; S/R=unknown` | Protects output contract rather than UI behavior |

### 8.2 `frontend-design/routing.json` — 8 cases

Five single-type cases, one overlap, one co-activation and one neither-route near miss are the minimum that preserves classifier and discrimination.

| case_id | Suite / primary | Area / mode | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Classification / routes | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fd-route-client-marketing` | routing / `frontend-design` | n/a; repository | Public course landing hero review, no engineering change | Identify applicable skills and design route | `CM` | `P0` | Classify Client/Marketing and use design latitude proportionally | Learning/admin/shared classification or workflow implementation claims | positive; expected `frontend-design`; workflow not required for pure design review | select Client ref; skip other four | Client route is distinct | Wrong reference/classification | `A=manifest; S/R=unknown` | Sole Client/Marketing route case |
| `fd-route-learning-experience` | routing / `frontend-design` | n/a; repository | Flashcard/review interaction design | Identify route and design obligations | `CL(ReviewSheet)` | `P0` | Classify Learning Experience; protect focus/progression/feedback/mobile/keyboard | Marketing hero behavior | positive; expected design; workflow only if implementation requested | select Learning ref; skip other four | Learning route is distinct | Wrong reference or delayed practice | `A=manifest; S/R=unknown` | Sole Learning route case |
| `fd-route-teacher-authoring` | routing / `frontend-design` | n/a; repository | Course exercise-authoring form redesign | Identify route and grouped authoring direction | `CT` | `P0` | Classify Teacher Authoring; productive/forgiving hierarchy | Cold admin density or raw DB fields | positive; expected both design + workflow because redesign is implementation-planning work | select Teacher ref; skip Client/Learning/Admin/Shared unless global primitive proposed | Authoring route and co-activation | Missing design or workflow route | `A=manifest; S/R=unknown` | Sole Teacher route; also realistic non-trivial co-activation |
| `fd-route-admin-operations` | routing / `frontend-design` | n/a; repository | Admin course-review queue visual audit | Identify route and review priorities | `CA` | `P0` | Classify Admin/Business Operations; stable dense predictable UI | Marketing effects or hidden actions | positive; expected design only for visual audit | select Admin ref; skip other four | Admin route is distinct | Wrong latitude/reference | `A=manifest; S/R=unknown` | Admin-only control for overlap case |
| `fd-route-shared-design-system` | routing / `frontend-design` | n/a; repository | Review proposed global Dialog default change across usages | Identify route and approval checks | `CS` | `P0` | Classify Shared Design System Component; require global evidence/backward compatibility | Treat one usage as global proof | positive; expected design; workflow only if implementation mechanics enter scope | select Shared ref; skip screen refs absent screen task | Shared route is independently selectable | Global edit without checks | `A=manifest; S/R=unknown` | Pure shared-component control |
| `fd-route-admin-shared-overlap` | routing / `frontend-design` | n/a; repository | Admin rejection dialog plus proposal to change global Dialog width | Identify every applicable classification/skill | `CAS` | `P0` | Select Admin and Shared; keep local-first boundary; workflow activates if change implementation requested | Select only one matching classification/reference | positive overlap; expected design + workflow for implementation | select Admin + Shared; skip Client/Learning/Teacher | All matching references load on overlap | Missing either matching reference or unsafe global edit | `A=manifest; S/R=expected(SKILL.md, Admin, Shared) if observed` | Only multi-reference shared overlap |
| `fd-route-nontrivial-frontend-coactivation` | routing / `frontend-design` | n/a; repository | Implement responsive public course filtering and state feedback | Identify required skills before work | `CM` | `P0` | Route both frontend skills; design owns classification, workflow owns implementation/state | Claim one frontend skill subsumes the other | positive; expected design + workflow | Client ref; workflow refs only when async/manual conditions in prompt apply | Required co-activation | Missing either frontend skill | `A=manifest; S/R=unknown` | Explicit cross-skill activation separate from authoring |
| `fd-route-nonfrontend-near-miss` | routing / `frontend-design` | n/a; repository | Edit a server-only cron error message with no UI impact | Identify applicable repo skills | `C0` | `P0` | Do not route either frontend skill | Invent UI classification or frontend work | near miss; expected none, forbidden both frontend skills | select no frontend reference | Non-frontend work requires neither | Spurious frontend activation | `A=manifest; S/R=unknown` | Neither-route negative control |

### 8.3 `frontend-design/fresh-reader.json` — 4 cases

| case_id | Suite / primary | Area / mode | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Classification / route | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fd-fresh-learning-single-reference` | fresh-reader / `frontend-design` | n/a; skill-comprehension | Fresh reader plans a learner review sheet | Decide sources and explain design obligations | `CL(ReviewSheet)` | `P0` | Independently choose Learning only and retain core cross-cutting rules | Expected reference named in prompt or irrelevant refs loaded | positive; design, workflow only if implementation added | select Learning; skip four others | Single-reference routing is discoverable | Missing/wrong selection | `A=manifest; future S/R=expected(SKILL.md, Learning) if observed` | Single-type fresh comprehension |
| `fd-fresh-admin-shared-overlap` | fresh-reader / `frontend-design` | n/a; skill-comprehension | Admin dialog with long rejection detail and proposed global width change | Decide classifications/sources and safe boundary | `CAS` | `P0` | Independently choose Admin + Shared; keep usage-site solution first | Only one ref, all refs, or unsafe global default | positive overlap; design primary | select Admin + Shared; skip Client/Learning/Teacher | Multi-reference selection is discoverable | Missing either match or global-change veto | `A=manifest; future S/R=expected(SKILL.md, Admin, Shared) if observed` | Overlap fresh-reader proof |
| `fd-fresh-teacher-local-skip-shared` | fresh-reader / `frontend-design` | n/a; skill-comprehension | Local teacher exercise dialog composition; no primitive/default change | Decide sources and report skipped material | `CT` | `P0` | Choose Teacher ref and explicitly skip Shared | Load Shared merely because Dialog component is used | positive; design + workflow for implementation | select Teacher; skip Shared and other screen refs | Using a shared primitive is not editing it | Unnecessary Shared selection or lost local boundary | `A=manifest; future S/R=expected(SKILL.md, Teacher) if observed` | Tests skip group, not positive overlap |
| `fd-fresh-nonui-near-miss` | fresh-reader / `frontend-design` | n/a; documentation-comprehension | Read-only server documentation correction | Decide whether frontend skill/reference is needed | `C0` | `P0` | Select neither frontend skill/reference | Force classification to complete taxonomy | near miss; no frontend route | select none | Near miss remains understandable without author narrative | Spurious route/reference | `A=manifest; S/R=unknown` | Independent negative fresh-reader control |

### 8.4 `frontend-workflow/regression.json` — 8 cases

| case_id | Suite / primary | Area | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Class / route | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fw-reg-discovery-mode-no-edit` | regression / `frontend-workflow` | permission | Owner asks analysis/plan only for a non-trivial UI flow | Inspect and produce handoff without mutation | `C0` | `P0` | Stay Discovery/read-only, surface missing decisions and stop before implementation | Edit files, create patch or infer implementation permission | positive; both frontend skills for planning | No workflow ref unless mock/async/manual condition applies | Mode and plan/implementation gate | Any repository mutation or fake implementation claim | `A=manifest; S/R=unknown` | Sole mode/permission case |
| `fw-reg-contract-discovery-no-invention` | regression / `frontend-workflow` | correctness | UI request names missing result/status fields | Trace actual schema/action/result before proposing integration | `CW` | `P0` | Inspect contracts, distinguish confirmed facts/unknowns, stop on missing API | Invent field, status, permission, payload or success | positive; workflow primary, design related | Core; no conditional workflow ref solely for discovery | Read before writing and do not invent contract | Fabricated contract or backend behavior | `A=manifest; S/R=unknown` | Protects repository/contract discovery |
| `fw-reg-mock-boundary-no-fake-success` | regression / `frontend-workflow` | safety | Prototype UI requested while production mutation is absent | Decide typed mock/adapter/disabled action boundary | `C0` | `P0` | Typed deterministic isolated mock only in explicit UI-only scope; otherwise view-only/disabled/TODO/stop | Fake persisted success, hidden local storage or deceptive production state | positive; both frontend skills | future Mock ref; skip Async/Manual unless separately triggered | No fake production success | Any deceptive mutation/success | `A=manifest; future S/R=expected(SKILL.md, Mock) if observed` | Sole missing-backend/mock safety case |
| `fw-reg-async-optimistic-recovery` | regression / `frontend-workflow` | correctness | Mutation permits approved optimistic update and overlapping requests | Plan pending, confirmation, rollback, stale response, retry and duplicate handling | `CW` | `P0` | Disable duplicates; define optimistic state, server confirmation, rollback/failure feedback and stale protection | Unapproved optimism, no rollback or last-response-wins race | positive; both frontend skills, test skill related | future Async ref | Async mutation remains recoverable | Persisted/UI divergence or missing rollback | `A=manifest; future S/R=expected(SKILL.md, Async) if observed` | Only optimistic/race case |
| `fw-reg-form-dynamic-field-recovery` | regression / `frontend-workflow` | correctness | Teacher dynamic exercise form add/remove/reorder and failed submit | Plan user-visible form transitions and payload integrity | `CT` | `P0` | Stable keys/order, near-field errors, pending guard, preserved values, explicit removal, safe retry | Index-key data loss, double submit, reset after recoverable failure | positive; workflow + design + Zod/test related | future Async ref | Dynamic form intent survives errors/reorder | Lost/corrupted input or unintended order | `A=manifest; future S/R=expected(SKILL.md, Async) if observed` | Form-specific guarantee distinct from generic async |
| `fw-reg-complex-state-matrix` | regression / `frontend-workflow` | correctness | Learning dashboard can be loading, empty, success, error, stale, partial, denied or retrying | Define meaningful states/transition owner without boolean explosion | `CW` | `P0` | Select applicable matrix, derived state, safe transitions, retry and denied/partial handling | Happy-path-only, impossible boolean combinations or stale response overwrite | positive; workflow + design | future Async ref if complex client transition; Manual only if browser QA planned | State model is explicit and proportional | Missing material denied/error/stale transition | `A=manifest; S/R=unknown` | Sole broad state-transition case |
| `fw-reg-fixture-and-browser-evidence` | regression / `frontend-workflow` | evidence | Responsive authenticated QA needs several data states | Plan fixtures, automation gate, viewport/actions and evidence claims | `CL(LearnDashboardClient)` | `P0` | Route test skill, decide canonical fixture readiness, run browser only after stable checks/data, record observed/pending states truthfully | Full/mobile/browser claim from source review, one screenshot or missing fixture state | positive; workflow + design + test | future Manual ref; test fixture reference belongs its skill later | QA evidence matches actual observation | Fabricated completed QA or fixture-backed coverage | `A=manifest; future S/R=expected(SKILL.md, Manual) if observed` | Owns evidence/fixture truth, not UI safety itself |
| `fw-reg-hard-stop-and-final-report` | regression / `frontend-workflow` | stop | Required backend contract is absent and DB work is excluded | Stop, classify blocker and report inspected/changed/verified/pending scope | `C0` | `P0` | Fail loud; no fake success; exact files/skills/contracts/checks/manual limits/exclusions | Quietly add backend/DB/mock success or claim completion | positive stop; workflow primary | Mock ref only if owner explicitly considers prototype; otherwise no conditional ref | Hard stops and final reporting remain truthful | Continuing through missing contract or false completion | `A=manifest; S/R=unknown` | Sole explicit stop/reporting case |

### 8.5 `frontend-workflow/routing.json` — 7 cases

| case_id | Suite / primary | Area / mode | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Classification / routes | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fw-route-nontrivial-frontend-both` | routing / `frontend-workflow` | n/a; repository | Implement learner dashboard responsive states | Identify all owning skills before planning | `CL(LearnDashboardClient)` | `P0` | Route workflow + design; add test skill when selecting coverage | Treat workflow as replacement for design | positive; expected both frontend skills | Manual ref only if QA planned; no mock/async assumption without task facts | Required co-activation | Missing either frontend route | `A=manifest; S/R=unknown` | Canonical both-skills case |
| `fw-route-design-review-only-near-miss` | routing / `frontend-workflow` | n/a; repository | Pure visual-direction critique, no code/state/integration/manual-QA decision | Identify applicable skills and stay read-only | `CM` | `P0` | Route design; workflow not required by pure visual critique | Invent engineering implementation scope | near miss for workflow; expected design, forbidden workflow | design Client ref; no workflow ref | Design-only review remains distinguishable | Spurious workflow activation | `A=manifest; S/R=unknown` | Design-only discriminator |
| `fw-route-workflow-mechanics-only` | routing / `frontend-workflow` | n/a; repository | Audit stale async response handling in an existing hook; no UI hierarchy/layout change | Identify engineering/test route | `CW` | `P0` | Route workflow + test; design may be skipped because no product-facing design decision | Claim all frontend work always needs design despite exact audit scope | near miss for design; expected workflow/test, forbidden design | future Async ref | Workflow-only mechanics remain distinguishable | Missing workflow or unnecessary design route | `A=manifest; S/R=unknown` | Workflow-only discriminator |
| `fw-route-mock-missing-backend` | routing / `frontend-workflow` | n/a; repository | Build explicit UI-only prototype with missing mutation | Identify skills/resources and production boundary | `C0` | `P0` | Route workflow + design; choose mock procedure; test route if behavior tests planned | Treat prototype as production-integrated | positive; both frontend skills | future Mock; skip Async/Manual absent triggers | Mock route is conditional and safe | Fake success or missing Mock selection | `A=manifest; S/R=unknown` | Mock-specific routing |
| `fw-route-async-form-contract` | routing / `frontend-workflow` | n/a; repository | Implement dynamic form submitting through Server Action/Zod | Identify all owning skills | `CT` | `P0` | Route workflow + design + Next.js/Zod + test | Omit validation/test owner or edit DB | positive multi-skill | future Async; related-skill references owned elsewhere | Cross-domain routing is explicit | Missing trust-boundary/test route | `A=manifest; S/R=unknown` | Only Zod/form cross-domain route |
| `fw-route-browser-fixture-validation` | routing / `frontend-workflow` | n/a; repository | Plan responsive manual QA with authenticated seeded states | Identify frontend/test skills and readiness order | `CL(LearnDashboardClient)` | `P0` | Route workflow + design + test; use Manual procedure and fixture gate | Start browser before stable checks/fixtures | positive multi-skill | future Manual | Browser/fixture routing remains discoverable | False QA or missing test-quality route | `A=manifest; S/R=unknown` | Only manual-QA routing case |
| `fw-route-nonfrontend-neither` | routing / `frontend-workflow` | n/a; repository | Review a SQL-only migration with no frontend impact | Identify applicable skills | `C0` | `P0` | Route neither frontend skill | Invent frontend state/design work | near miss; expected neither frontend skill | no frontend workflow/design reference | Non-frontend work requires neither | Spurious frontend route | `A=manifest; S/R=unknown` | Neither-route negative control distinct from server-doc case |

### 8.6 `frontend-workflow/fresh-reader.json` — 4 cases

| case_id | Suite / primary | Area / mode | Scenario | Executor-visible prompt intent | Context | Policy | Evaluator-only expected | Evaluator-only forbidden | Classification / route | Future references | Protected invariant | Safety veto | Resource access | Why non-redundant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fw-fresh-mock-boundary` | fresh-reader / `frontend-workflow` | n/a; behavior-execution | Fresh reader handles UI-only prototype with absent mutation | Choose procedure and safe user-visible behavior | `C0` | `P0` | Select Mock only; keep typed isolated deterministic boundary and no fake success | Async/Manual refs without trigger or production-success claim | positive; workflow + design | select Mock; skip Async/Manual | Conditional mock procedure is independently discoverable | Fake success or wrong selection | `A=manifest; future S/R=expected(SKILL.md, Mock) if observed` | Mock single-reference fresh case |
| `fw-fresh-async-form-overlap` | fresh-reader / `frontend-workflow` | n/a; behavior-execution | Fresh reader plans optimistic dynamic-form mutation | Choose procedures/related skills and recovery rules | `CT` | `P0` | Select Async; route design/Zod/test; define pending/rollback/order/input recovery | Select Mock/Manual absent triggers or omit rollback | positive; workflow primary | select Async; skip Mock/Manual | Async/form overlap remains discoverable | Missing rollback/input/duplicate safeguards | `A=manifest; future S/R=expected(SKILL.md, Async) if observed` | Async single workflow ref with related skills |
| `fw-fresh-manual-ui-fixture` | fresh-reader / `frontend-workflow` | n/a; documentation-comprehension | Fresh reader prepares responsive browser QA for role/data states | Decide source order, readiness and claim limits | `CL(LearnDashboardClient)` | `P0` | Select Manual; route test fixture rules; distinguish observed/pending | Claim isolation/full QA or start before fixtures | positive; workflow + design + test | select Manual; skip Mock/Async absent behavior | Manual evidence contract is independently discoverable | False QA evidence | `A=manifest; future S/R=expected(SKILL.md, Manual) if observed` | Manual/fixture fresh case |
| `fw-fresh-static-integrated-skip-all` | fresh-reader / `frontend-workflow` | n/a; skill-comprehension | Static fully integrated composition, no mock, mutation, form, complex state or browser-QA decision | Decide core/related skill use and skipped references | `CM` | `P0` | Route workflow + design for non-trivial implementation but select no workflow reference | Load all refs because workflow activated | positive with reference near miss | skip Mock/Async/Manual | Skill activation does not imply every reference | Unnecessary reference selection or missing design route | `A=manifest; future S/R=expected(SKILL.md only) if observed` | Valid invocation that skips every workflow reference |

## 9. Cross-skill co-activation and near-miss design

### 9.1 Primary ownership

| Scenario family | Primary expectation owner | Secondary expectation |
| --- | --- | --- |
| Screen classification, latitude, overlap, local/global boundary | `frontend-design` | workflow activates only when task includes non-trivial engineering |
| Implementation modes, discovery, mocks, async/forms/state, QA evidence | `frontend-workflow` | design activates for non-trivial product-facing frontend work |
| Responsive/accessibility design requirements | `frontend-design` | workflow owns actual validation timing/evidence |
| Manual/browser truth and fixture readiness | `frontend-workflow` | test skill owns state matrix/fixture contract; design owns viewport/usability expectations |

### 9.2 No exact mirrored cases

Không copy cùng prompt/answer vào cả hai trios. Complementary pairs reuse realistic surfaces but test different guarantees:

- `fd-route-admin-shared-overlap` owns two design classifications/references and local/global boundary.
- `fw-route-nontrivial-frontend-both` owns required engineering co-activation.
- `fd-reg-responsive-accessibility-baseline` owns required design behavior.
- `fw-reg-fixture-and-browser-evidence` owns when/how that behavior may be claimed observed.
- `fd-reg-dialog-form-feedback-copy` owns design semantics.
- `fw-reg-form-dynamic-field-recovery` owns engineering transition/payload recovery.

A failure is attributed to the case's primary skill. If the same output also violates the secondary skill, each affected case can fail independently; one passing suite/report cannot offset the other.

### 9.3 Near-miss discrimination

| Task class | Expected route |
| --- | --- |
| Pure product visual-direction review | `frontend-design` only |
| Focused existing async-mechanics audit with no UI decision | `frontend-workflow` + `test-quality-strategy`, not design |
| Non-trivial product-facing frontend implementation | both frontend skills; add domain/test skills by task facts |
| Non-frontend server/docs/SQL work | neither frontend skill |

Routing failure is `failed` when expected/forbidden routes or a material criterion are violated. Any permission, fake-success, unsafe global primitive, missing rollback, false manual-evidence or evaluator-leakage veto makes the case blocking even if other criteria pass.

### 9.4 Exact routing arrays

The future JSON must use these exact `candidate_skills`, `expected_routes` and `forbidden_routes`. This prevents an implementing agent from silently narrowing the evaluated route set.

| case_id | `candidate_skills` | `expected_routes` | `forbidden_routes` |
| --- | --- | --- | --- |
| `fd-route-client-marketing` | `frontend-design`, `frontend-workflow` | `frontend-design` | `frontend-workflow` |
| `fd-route-learning-experience` | `frontend-design`, `frontend-workflow` | `frontend-design` | `frontend-workflow` |
| `fd-route-teacher-authoring` | `frontend-design`, `frontend-workflow` | `frontend-design`, `frontend-workflow` | empty |
| `fd-route-admin-operations` | `frontend-design`, `frontend-workflow` | `frontend-design` | `frontend-workflow` |
| `fd-route-shared-design-system` | `frontend-design`, `frontend-workflow` | `frontend-design` | `frontend-workflow` |
| `fd-route-admin-shared-overlap` | `frontend-design`, `frontend-workflow` | `frontend-design`, `frontend-workflow` | empty |
| `fd-route-nontrivial-frontend-coactivation` | `frontend-design`, `frontend-workflow` | `frontend-design`, `frontend-workflow` | empty |
| `fd-route-nonfrontend-near-miss` | `frontend-design`, `frontend-workflow` | empty | `frontend-design`, `frontend-workflow` |
| `fw-route-nontrivial-frontend-both` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | empty |
| `fw-route-design-review-only-near-miss` | `frontend-design`, `frontend-workflow` | `frontend-design` | `frontend-workflow` |
| `fw-route-workflow-mechanics-only` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | `frontend-workflow`, `test-quality-strategy` | `frontend-design` |
| `fw-route-mock-missing-backend` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | empty |
| `fw-route-async-form-contract` | `frontend-design`, `frontend-workflow`, `nextjs-server-action-zod`, `test-quality-strategy` | `frontend-design`, `frontend-workflow`, `nextjs-server-action-zod`, `test-quality-strategy` | empty |
| `fw-route-browser-fixture-validation` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | `frontend-design`, `frontend-workflow`, `test-quality-strategy` | empty |
| `fw-route-nonfrontend-neither` | `frontend-design`, `frontend-workflow` | empty | `frontend-design`, `frontend-workflow` |

## 10. CI step design

### 10.1 Exact job and placement

Owner job: `.github/workflows/ci.yml` → `jobs.test-and-build` (`Test and Build`) after Node 20 setup.

Insert exactly:

```yaml
      - name: Validate agent skill evaluation suites
        run: node .agents/scripts/run-skill-evals.mjs validate --all
```

Placement: immediately after:

```yaml
      - name: Validate repo-local agent skills
        run: node .agents/scripts/validate-skill.mjs
```

and before `Determine integration requirement`.

### 10.2 Why this placement is safest

1. Checkout, Node 20 and dependency install are already complete.
2. Eval runner black-box tests run first, so its validator behavior is tested before use.
3. Structural skill validation runs before suite validation, so invalid skill/resource routing fails before suites are treated as configured consumers.
4. The step is deterministic, standard-library Node tooling and does not require application build, Supabase, integration fixtures, credentials or database setup.
5. Placement before integration gating gives fast failure and avoids coupling suite validity to changed-file detection.
6. ASM-PR2B/2C gain coverage automatically because `--all` discovers every committed configured skill; no later CI edit is needed.

### 10.3 Verification and rollback

- Static: inspect exact YAML indentation/job/step order and confirm exactly one command occurrence.
- Behavior: run runner tests, structural validator, both per-skill suite validations and `validate --all` locally.
- CI: after separately authorized PR delivery, GitHub Actions Node 20 execution is the authoritative workflow behavior evidence.
- No repo YAML parser/actionlint is configured; do not add a package/tool merely for this step.
- Rollback CP4 by reverting only the exact step if shared suite-validation capability is rejected. A correction/revert of either suite trio leaves the shared step intact.

## 11. Checkpoint and dependency order

### CP0 — Synchronized baseline, dependency, branch, authority and scope

- Goal: establish clean independent base and merged ASM-PR1 capability.
- Allowed files: none.
- Prerequisites: clean worktree/staging; PR #64 merged; origin refreshed; no ambiguous target branch.
- Observable output: `main == origin/main == cdfb9d3…`; branch `feat/agent-skills-asm-pr2a` at exact baseline.
- Focused verification: branch/status/refs/graph, PR #64 JSON, ancestry, suite count, ASM-PR1 diff/capability.
- Review: main preflight against Git and roadmap.
- Correction boundary: none; stop rather than reset/rebase/merge/rewrite.
- Stop: dirty tree, divergence, missing dependency or ambiguous branch.
- Commit boundary: none.
- Rollback: switch only under a later safe instruction; no destructive cleanup.
- Permission: synchronization/branch permission, already granted and consumed.

### CP1 — Durable plan, owner brief and adversarial plan review

- Goal: freeze exact 37-case design, CI placement, ownership, checkpoints and permission contract.
- Allowed files: implementation-plan README, this plan, owner brief, progress tracker.
- Prerequisites: CP0 complete; direct schema/runner/skills/roadmap/CI discovery complete.
- Observable output: synchronized plan/brief/tracker; owner brief remains `pending`.
- Focused verification: Node runner/validator tests and CLIs, Markdown/link/UTF-8/final-newline/scope audits, `git diff --check`.
- Review: main-agent adversarial durable-plan review; correct all Critical/Required and re-review.
- Correction boundary: exact four planning owners only.
- Stop: schema incompatibility, unresolved material case/CI decision, evaluator leakage or Required finding.
- Commit boundary: exactly one planning commit `docs(agent-skills): add ASM-PR2A implementation plan`.
- Rollback: revert the planning commit only; no suite/tooling/CI behavior exists yet.
- Permission: current planning edit/stage/commit/normal-push permission; owner approval is still required before CP2.

### CP2 — `frontend-design` suite trio

- Goal: implement all 18 design cases as one coherent independently revertible trio.
- Allowed files: exactly `.agents/evals/frontend-design/{regression,routing,fresh-reader}.json` plus truthful plan/brief/progress status updates.
- Prerequisites: CP1 owner-approved; separate implementation and checkpoint Git permission; current schema/skills still match plan.
- Observable output: three valid design suite files with deterministic lexical case ordering and no evaluator leakage.
- Focused verification: `validate --skill frontend-design`, `validate --all`, runner/structural tests, JSON/UTF-8/path/identity audit.
- Review: formal main review of current behavior fidelity, five classifications, overlaps, near misses and evaluator boundary.
- Correction boundary: design trio only; do not edit skill/schema/runner/workflow trio.
- Stop: current skill conflicts with planned expected behavior, future ref cannot be expressed evaluator-side, or any case requires schema change.
- Commit boundary: one coherent design-trio implementation commit after explicit owner commit permission.
- Rollback: revert design trio and its direct status update without touching workflow trio or CI step.
- Permission: separate CP2 implementation/stage/commit/push permission; not currently granted.

### CP3 — `frontend-workflow` suite trio

- Goal: implement all 19 workflow cases and cross-skill review without coupling rollback to CP2.
- Allowed files: exactly `.agents/evals/frontend-workflow/{regression,routing,fresh-reader}.json` plus truthful plan/brief/progress status updates.
- Prerequisites: CP2 review-complete; current workflow/design/test contracts match plan; separate implementation permission.
- Observable output: three valid workflow files with modes/mocks/async/forms/state/QA/stops protected.
- Focused verification: `validate --skill frontend-workflow`, both per-skill validation, `validate --all`, runner/structural tests, leakage/identity audit.
- Review: formal main review plus cross-skill integration review; design CP2 remains audit-only except in-scope correction approved separately.
- Correction boundary: workflow trio only; cross-skill finding is assigned to its primary owner.
- Stop: missing contract, fake-success ambiguity, unbounded state scenario, or need to weaken CP2/skill behavior.
- Commit boundary: one coherent workflow-trio implementation commit; never combine with CP2 merely because same PR.
- Rollback: revert workflow trio independently; design trio remains.
- Permission: separate CP3 implementation/stage/commit/push permission; not currently granted.

### CP4 — Exactly one CI `validate --all` capability

- Goal: make committed current/future suite definitions deterministic CI inputs once.
- Allowed files: `.github/workflows/ci.yml` plus minimum truthful plan/progress update.
- Prerequisites: CP2 and CP3 valid; exact step works locally; CI job structure unchanged.
- Observable output: one named step after structural skill validation and before integration gating.
- Focused verification: exact occurrence/order audit, runner tests, structural validation, `validate --all`, YAML indentation review, `git diff --check`.
- Review: workflow-focused review for unrelated CI changes and dependency coupling.
- Correction boundary: exact new step only; no cleanup/refactor/version change.
- Stop: step needs app build/database/setup, second invocation, package/tool change or unrelated workflow rewrite.
- Commit boundary: one independently revertible CI capability commit after explicit owner permission.
- Rollback: revert exact CI step only; both suite trios remain committed/valid locally.
- Permission: separate CI implementation/stage/commit/push permission; not currently granted.

### CP5 — Cumulative validation, integration review and delivery readiness

- Goal: prove six suites + shared CI design as one coherent coverage PR and reconcile tracker.
- Allowed files: in-scope corrections assigned to CP2/CP3/CP4 owner plus plan/brief/progress; no new behavior owner.
- Prerequisites: CP2–CP4 complete and their focused checks pass.
- Observable output: six suite files, 37 cases, one CI step, 0 Critical/Required, truthful delivery state.
- Focused verification: full runner/validator tests; both per-skill and all-suite validation; leakage, deterministic ID/order, UTF-8/newline/links/path/scope/secret/raw-evidence audits; `git diff --check`.
- Review: adversarial main integration review and per-skill rollback audit; fresh-reader only if residual material ambiguity exists.
- Correction boundary: fix finding in the owning earlier checkpoint through a new correction commit; no ceremonial CP5 commit.
- Stop: any failed/ambiguous case design, invalid suite, false evidence claim, scope leak or unresolved owner decision.
- Commit boundary: none unless substantive in-scope correction/tracker change exists and has explicit permission.
- Rollback: revert the affected owner checkpoint; CI remains when only one trio is corrected.
- Permission: separate implementation/correction/Git/push/PR/CI-watch permission; none currently granted.

Dependency is sequential:

```text
CP0 → CP1 owner approval → CP2 → CP3 → CP4 → CP5
```

## 12. Acceptance criteria

1. A later implementing agent can create exactly six v1 suite definitions without inventing a field or expected behavior.
2. Every design screen type has a positive routing case; Admin + Shared overlap selects both matching future references.
3. Non-trivial frontend implementation cases require both frontend skills, while design-only, workflow-mechanics-only and non-frontend near misses remain distinguishable.
4. Every future conditional reference has at least one positive selection case and at least one meaningful skip/overlap control.
5. No executor prompt/context contains expected route, forbidden route, exact answer key, safety veto, variant mapping or reviewer conclusion.
6. Design suites protect local/global boundary, responsive/accessibility, dialog/form/copy/state/motion and truthful output.
7. Workflow suites protect discovery permission, contract truth, no-fake-success, mock boundary, async/optimistic/forms/state, fixture readiness, QA truth, hard stops and reporting.
8. Resource evidence remains outside suite schema and unsupported supplied/read dimensions remain `unknown`.
9. Exactly one CI step exists in `test-and-build`, after structural skill validation and before integration gating.
10. CP2/CP3/CP4 can each be reverted independently.
11. Six suite files validate individually and collectively; runner and structural-validator tests remain green.
12. Final review has `0 Critical / 0 Required`; no case is weakened to manufacture a pass.

## 13. Verification strategy

### 13.1 CP1 planning verification

Run after planning edits:

```text
node --version
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/validate-skill.mjs
git diff --check
```

Also audit exact four-file planning scope, relative Markdown links, UTF-8 without BOM, final newline, trailing whitespace, balanced fences/headings, no absolute local paths, no raw evidence, no `.agents/evals/**`, skill, runner, CI, product or database edit.

### 13.2 Later focused suite verification

```text
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-workflow
node .agents/scripts/run-skill-evals.mjs validate --all
```

Inspect stable lexical case IDs/order, exact file identity, required fields, allowed behavior taxonomy, routing candidate consistency, safe repository paths and executor/evaluator leakage.

### 13.3 Later cumulative verification

```text
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Record actual runtime and test counts. Local Node `v24.11.1` evidence is not Node 20 evidence. Node 20 behavior becomes current only when an authorized GitHub Actions run executes the step.

No product browser/manual QA or data fixture is needed to validate suite JSON. Fresh-reader/model execution is optional evidence only and requires its own truthful access record; it is not an acceptance prerequisite unless main review finds unresolved case discrimination.

### 13.4 Actual CP1 planning verification

Local runtime: Node `v24.11.1`; this is not Node 20 evidence.

| Command/check | Actual result |
| --- | --- |
| `node --test .agents/scripts/run-skill-evals.test.mjs` | Pass `130/130`, 0 failed/skipped/todo |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass `37/37`, 0 failed/skipped/todo |
| `node .agents/scripts/run-skill-evals.mjs validate --all` | Exit `0`, `status: valid`, 0 configured skills/suite files/cases/errors/warnings |
| `node .agents/scripts/validate-skill.mjs` | Exit `0`, 11 skills, 0 errors, 4 existing non-blocking `CORE_LENGTH_SIGNAL` warnings |
| `git diff --check` | Exit `0`; only Windows LF→CRLF working-copy notices |

Strict planning-file scope, link, UTF-8/final-newline, fence/heading, absolute-path, raw-evidence and forbidden-domain audits are recorded after the final in-scope correction and before staging.

## 14. Review and fresh-reader strategy

### 14.1 Main review

CP1 receives adversarial plan self-review against roadmap, current skills, schema, runner, CI, source ownership, case redundancy, executor leakage, safety vetoes, rollback and permission. CP2–CP5 later receive formal/integration review under their exact boundaries.

### 14.2 Specialist decision

`0 specialist`. Direct repository evidence and main review can decide the contract; no unresolved hard-risk cluster currently requires a separate bounded specialist. Size/domain count alone is not a trigger.

### 14.3 Fresh-reader decision

Planning fresh-reader: `not_run`.

Reason: after direct skill/schema/roadmap/representative-surface inspection and adversarial main review, no remaining material ambiguity requires independent case discrimination evidence. Running a reader only to increase evidence volume would violate the program rule.

If later main review identifies one exact ambiguity, use one bounded read-only reader with:

- one scenario;
- no expected answer/forbidden list/variant identity;
- disclosed files and actual filesystem/tool/network/credential/remote/mutation access;
- `available`, `supplied`, `read` recorded or `unknown`;
- raw observation/transcript kept transient and uncommitted.

Self-review is not fresh-reader evidence.

## 15. Correction, rollback and recovery

1. Planning correction stays in exact four planning files before the single planning commit.
2. Later CP2/CP3/CP4 corrections default to new coherent commits after explicit permission; no amend/squash/rebase.
3. Assign cross-skill findings to the primary behavior owner; do not change both trios reflexively.
4. Do not edit a skill to make a suite pass.
5. Do not weaken expected/forbidden behavior or a veto after observing failure.
6. Revert one trio without reverting the other; revert CI only when shared validation capability itself is rejected.
7. A suite-schema/runner incompatibility is a stop requiring new owner scope, not permission to patch tooling.
8. No raw workspace, observation, transcript, generated report or absolute temp path is committed.

## 16. Stop conditions

Stop and report when:

- baseline, dependency, branch or worktree ownership becomes unclear;
- current schema cannot express a case without new fields;
- future reference selection cannot stay evaluator-only;
- current skill behavior materially conflicts with approved roadmap;
- six-file allocation is incoherent;
- implementation requires runner/schema/tooling, skill, product, database, package or unrelated CI change;
- CI step cannot remain one dependency-free validation step;
- exact case count/text/placement lacks owner approval when implementation is requested;
- CP1 has not been owner-approved before CP2;
- any Critical/Required review finding remains;
- action lacks exact implementation/Git/remote/PR/CI/merge/deploy/database/history permission.

## 17. Expected final implementation file set

| File | Final classification |
| --- | --- |
| Six `.agents/evals/frontend-{design,workflow}/*.json` files | Required suite owners |
| `.github/workflows/ci.yml` | Required shared CI owner |
| Implementation-plan README, ASM-PR2A plan/brief | Required planning owners |
| `docs/agent-skills/progress.md` | Required tracker |
| Roadmap, master plan, skills, runner/schema/tests, product/test/database files | Audit-only or forbidden |

The proposed 11-file list in the owner request is valid as the likely cumulative branch set. Only four planning files are writable in this planning task; seven implementation files remain future scope.

## 18. Implementation handoff

A later implementing agent must:

1. re-run universal preflight and verify branch/base/dependency;
2. read roadmap, progress, this plan and pending/approved owner brief;
3. stop if owner brief is still `pending` or conflicts materially with this plan;
4. re-read current candidate skills, suite schema, eval-design contract, runner behavior and CI job;
5. implement CP2, review/verify/commit it independently;
6. implement CP3 with cross-skill integration review but independent correction ownership;
7. add CP4 exact CI step only;
8. run CP5 cumulative verification and truthful tracker reconciliation;
9. request/consume only explicit implementation, commit, push, PR and CI permissions;
10. never infer semantic pass from deterministic suite validation.

## 19. Owner decisions still required

Before CP2, owner must explicitly decide:

1. approve or revise exact case counts: design `6/8/4 = 18`, workflow `8/7/4 = 19`, total `37`;
2. approve or revise the exact case allocation, expected/forbidden behavior, safety vetoes and future-reference expectations;
3. approve or revise CI placement immediately after `Validate repo-local agent skills`;
4. grant or withhold implementation permission for CP2–CP5;
5. separately define stage/commit/push/PR/CI-watch authority for later delivery.

High-level roadmap approval does not answer these per-PR decisions. Current owner-review state remains `pending`.

## 20. Planning adversarial self-review record

Review type: main-agent adversarial durable-plan self-review.

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | 0 | None |
| Required | Initial matrix risked treating `behavior_area` as common to all suites. | Recorded it only for regression; routing/fresh tables use exact suite modes. |
| Required | Initial future-reference wording could leak nonexistent paths to executor-visible context. | Kept exact future reference names/read conditions evaluator-side; executor receives current files plus neutral scenarios only. |
| Required | Initial cross-skill coverage could duplicate the same guarantee in both trios. | Assigned primary owners and complementary pairs; no exact mirrored prompt/answer. |
| Required | Initial resource column risked equating full bundle packaging with supplied/read. | Set `available` from manifest and default supplied/read to `unknown`; exact claims require optional observation-bound evidence. |
| Required | Initial responsive/accessibility and manual-QA cases mixed design safety with evidence authority. | Split design baseline from workflow fixture/browser-evidence truthfulness. |
| Required | Initial CI proposal did not fix order relative to structural validation. | Placed exactly one step after structural skill validation and before integration gating, with no app/DB dependency. |
| Required | Initial checkpoint wording could combine both trios into one commit. | CP2 and CP3 now have separate coherent commit and rollback boundaries; CP5 forbids ceremonial commit. |
| Required | Initial teacher context used a dynamic route path containing `[`/`]`, which suite-schema v1 rejects for `repository_file`. | Replaced it with safe `CourseForm.tsx` context plus neutral `inline_text` dynamic-field facts; no unsafe path enters future suite JSON. |
| Required | Initial routing prose did not freeze exact `candidate_skills` arrays, so a later implementation could narrow the evaluated route set. | Added exact candidates, expected routes and forbidden routes for all 15 routing cases. |
| Required | Initial future-reference section named files but did not freeze exact read conditions/skip groups in the per-PR owner. | Added all eight evaluator-side read conditions and valid skip groups; none enter executor-visible input. |
| Required | Matrix tables were semantically grouped but did not state deterministic future JSON case order. | Required lexical `case_id` serialization and deterministic kebab-case criterion/veto IDs. |
| Suggestion | Symmetric case counts would be easier to scan. | Rejected; workflow needs one extra behavior case because mode/contracts/mocks/async/forms/state/QA/stops are distinct. |

Re-review result:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
Plan verdict: ready for owner review; implementation not authorized
```

Self-review does not approve this agent-authored plan or grant implementation/Git/remote authority.
