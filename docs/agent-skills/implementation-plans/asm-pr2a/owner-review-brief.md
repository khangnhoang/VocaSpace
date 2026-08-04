# ASM-PR2A — Bản tóm tắt để owner duyệt

Status: historical ASM-PR2A implementation/delivery complete; PR #65 `MERGED` at `3cdbb440d7068c5280750f650cf0680a1992f3e0`; final head `7e63d94087a93bd0f79e2d484ff747903d3cab7a` passed CI run `30542888052`.

Detailed specification: [plan.md](./plan.md).

Brief này hiện là historical owner decision surface. Owner đã approve exact detailed design; CP2–CP5 và exact four-file correction implementation/delivery authority đều đã consumed trước khi PR #65 merge. Cumulative-correction transition bắt đầu từ local final-audit state trên branch audit; exactly one commit, normal initial push, non-draft PR creation và initial CI watch chỉ được kích hoạt nếu gate đạt `0 Critical / 0 Required`. One `branch-caused-small-safe` CI fix attempt cần failed logs trước khi được dùng. Successful delivery consumes authority này, còn exact delivered SHA/PR/run do Git/GitHub/PR body/final report sở hữu; merge/auto-merge và mọi database, deployment, destructive, force-push, history-rewrite hoặc scope-expansion action vẫn không được cấp.

## ASM-PR2A đã hoàn thành gì

ASM-PR2A là coverage PR cho frontend experience. Completed implementation:

- commit một regression, routing và fresh-reader suite cho `frontend-design`;
- commit một regression, routing và fresh-reader suite cho `frontend-workflow`;
- thêm đúng một CI step:

  ```text
  node .agents/scripts/run-skill-evals.mjs validate --all
  ```

- giữ hai suite trios và shared CI capability thành independent correction/rollback boundaries.

Không skill hoặc product behavior nào được migrate/chỉnh sửa trong ASM-PR2A.

## Dependency và baseline

- Synchronized baseline: `cdfb9d321e4f595954d3db4ec02d1d1de2d1b030`.
- Branch: `feat/agent-skills-asm-pr2a`.
- PR #64 merged tại chính baseline trên.
- ASM-PR1 dependency hiện cung cấp `skill_resource_access`, exact observation-byte binding, shared role-level `available` inventory và per-case supplied/read summaries.
- Current suite state: 6 suite files, 37 cases; `frontend-design 6/8/4 = 18`, `frontend-workflow 8/7/4 = 19`.

ASM-PR1 phải merge trước vì later suite execution/comparison cần dùng một shared resource-evidence contract, không tự phát minh evidence semantics theo từng skill.

Original CP1 planning delivery đã hoàn tất:

- commit `f6dae70d7c8faadfe83b7a29109cbc4708620724`;
- normal-push lên `origin/feat/agent-skills-asm-pr2a`;
- local/upstream synchronized trước correction hiện tại;
- previous planning edit/commit/push authority đã consumed và không tạo standing authority.

Planning correction grant đã consumed qua commit `152519eb210f3219e2471f51dd7d988454f1f275` và normal push. CP2–CP5 implementation/delivery grant cũng đã consumed. Pre-correction final-state head là `cb3099ed1030e610ba2e93986d7e600d26ede3e5`; current exact correction grant consumed upon successful correction push và không để lại standing authority.

## Approved suite allocation

| Candidate | Regression | Routing | Fresh-reader | Total |
| --- | ---: | ---: | ---: | ---: |
| `frontend-design` | 6 | 8 | 4 | 18 |
| `frontend-workflow` | 8 | 7 | 4 | 19 |
| Total | 14 | 15 | 8 | 37 |

Không dùng symmetric counts chỉ để đẹp bảng. Workflow cần thêm một behavior case vì mode/permission, contract discovery, mock/no-fake-success, async/optimistic, dynamic forms, complex state, manual evidence và hard-stop/reporting là các guarantee riêng.

### `frontend-design` major groups

- five screen classifications;
- Admin + Shared overlap;
- Client/Learning/Teacher/Admin/Shared future reference selection;
- local screen versus global primitive;
- responsive/accessibility;
- dialog/form/copy/state/motion;
- output truthfulness;
- design-only, both-skills và non-frontend near misses.

### `frontend-workflow` major groups

- Discovery/Implementation permission;
- repository/contract discovery;
- mock boundary và no fake production success;
- async/optimistic rollback;
- form/dynamic-field recovery;
- loading/empty/success/error/stale/partial/denied/retry state design;
- input preservation và duplicate-submit prevention;
- fixture readiness và truthful browser/manual evidence;
- hard stops/final reporting;
- design-only, workflow-only, both-skills và neither-route discrimination.

## Cross-skill strategy

Non-trivial product-facing frontend implementation phải route cả `frontend-design` và `frontend-workflow`.

Mỗi case có một primary owner:

- design owns classification, latitude, local/global boundary, responsive/accessibility expectations và product-facing feedback semantics;
- workflow owns mode/permission, contracts, mocks, async/forms/state, manual evidence timing và hard stops.

Không copy exact prompt/answer sang cả hai trios. Complementary cases có thể dùng cùng realistic surface nhưng bảo vệ guarantee khác. Pass của skill này không offset fail của skill kia.

Near misses phân biệt:

| Task | Expected frontend route |
| --- | --- |
| Pure product visual-direction critique; không repository integration audit, state/async/form/dataflow, implementation planning, automated verification planning, manual/browser QA planning hoặc execution, performance review hay contract review | `frontend-design` only |
| Focused async-mechanics audit, no UI decision | `frontend-workflow` + test skill |
| Non-trivial product frontend implementation | both frontend skills |
| Non-frontend server/docs/SQL work | neither frontend skill |

## Future reference-selection strategy

Exact future names được ghi evaluator-side:

- design: `client-marketing.md`, `learning-experience.md`, `teacher-authoring.md`, `admin-business-operations.md`, `shared-design-system-components.md`;
- workflow: `mock-data.md`, `async-state-and-forms.md`, `manual-ui-validation.md`.

Executor-visible prompt không nhận expected reference, skip group, safety veto hoặc route answer.

Variant-applicability contract:

- shared protected behavior áp dụng như nhau cho unsplit baseline và migrated candidate; migration không được làm yếu behavior, forbidden behavior hoặc safety veto;
- unsplit baseline chứng minh behavior từ monolithic `SKILL.md`, không phải name/select/supply/read future references, không nhận nonexistent path và không fail vì các file đó chưa tồn tại;
- migrated candidate phải giữ cùng behavior, chọn mọi physical reference phù hợp, skip mọi reference không liên quan và chọn tất cả matches trong overlap;
- future-reference cells trong matrix là candidate-only routing expectations, không phải impossible baseline expectations;
- comparison đánh giá baseline behavior preservation rồi candidate behavior + routing; không tạo baseline failure giả và không hạ candidate bar.

`available` đến từ exact manifest. `supplied`/`read` mặc định `unknown` nếu không có valid observation-bound `skill_resource_access` artifact; full bundle packaging không chứng minh hai dimension này.

## Executor/evaluator separation

Executor-visible:

- neutral scenario;
- bounded repository files/inline facts;
- requested synthetic read-only/no-network/no-mutation policy.

Evaluator-only:

- expected/forbidden behavior;
- criteria/materiality;
- expected/forbidden routes;
- safety vetoes;
- future reference selection;
- blind variant identity, other output và reviewer conclusion.

`packaging_mode: synthetic` là requested packaging policy, không phải isolation/enforcement proof.

## CI decision

Job owner: `.github/workflows/ci.yml` → `jobs.test-and-build`.

Implemented exact step:

```yaml
      - name: Validate agent skill evaluation suites
        run: node .agents/scripts/run-skill-evals.mjs validate --all
```

Implemented placement: immediately after `Validate repo-local agent skills` và before `Determine integration requirement`.

Lý do:

- runner tests và structural skill validation đã chạy trước;
- failure xuất hiện sớm;
- không phụ thuộc build, integration gating, Supabase hoặc database;
- ASM-PR2B/2C tự được discover qua `--all`, không sửa CI lần nữa.

## Checkpoints và rollback

1. CP0 — synchronized baseline/dependency/branch/authority: complete.
2. CP1 — detailed plan/brief/tracker, 37-case matrix, CI design, adversarial self-review: commits `f6dae70d7c8faadfe83b7a29109cbc4708620724` và `152519eb210f3219e2471f51dd7d988454f1f275` đã pushed.
3. CP2 — design trio implementation/review committed and normal-pushed at `7dfa8f0`.
4. CP3 — workflow trio implementation/cross-skill review committed and normal-pushed at `5049e5d`.
5. CP4 — exact one-step CI implementation/review committed and normal-pushed at `cd210f0`.
6. CP5 — cumulative validation/integration review and reconciliation committed and normal-pushed at `813deea`.

CP1 owner approval đã được ghi nhận trước CP2. Correction của một trio không yêu cầu revert trio kia; CI step vẫn còn khi chỉ một trio được sửa.

## Verification

Planning checkpoint:

```text
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/validate-skill.mjs
git diff --check
```

Implementation verification thêm:

```text
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-workflow
```

Node 20 chỉ được claim sau actual Node 20 CI run. Deterministic suite validation không phải semantic behavior pass.

## Planning review

Main adversarial self-review đã sửa các Required findings về:

- `behavior_area` chỉ thuộc regression;
- future-reference leakage;
- duplicate cross-skill cases;
- `available` versus supplied/read;
- responsive/accessibility versus manual-evidence authority;
- exact CI order;
- independent suite-trio commit/rollback.
- schema-safe context paths;
- exact routing candidate/expected/forbidden arrays.
- exact future-reference read conditions/skip groups;
- deterministic lexical case order.
- explicit baseline-versus-candidate applicability;
- stale CP1 delivery/authority state;
- exact workflow-owned exclusions của design-only near miss.

Re-review:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
```

Fresh-reader không chạy vì direct evidence + main review không còn material case-discrimination ambiguity; chạy chỉ để tăng evidence volume là không cần thiết. Self-review không phải fresh-reader evidence.

Historical state at CP1 planning: local Node `v24.11.1`, eval runner `130/130` pass, structural validator tests `37/37` pass, `validate --all` valid với 0 configured suites, và repository skill validation valid với 4 existing non-blocking length warnings. Đây không phải current suite state hoặc Node 20 evidence.

Historical planning correction reran the same required commands on Node `v24.11.1` with the same `130/130`, `37/37`, valid zero-suite and 4-warning outcomes. Strict document/scope/link/table/UTF-8 audit and 37-unique-case-ID audit passed; `git diff --check` passed with only Windows LF→CRLF working-copy notices. The corrected audit command superseded one false-positive PowerShell regex invocation; no document defect was found. This is historical CP1 evidence, not current suite state.

## Exclusions

Không thuộc ASM-PR2A:

- edit/migrate either skill;
- create future references;
- runner/schema/tooling change;
- model/subagent execution, baseline/candidate observation hoặc semantic grader;
- native-trigger/automatic-activation claim;
- product/application test/database/package/deployment change;
- second CI step hoặc CI refactor;
- raw workspace/observation/report/transcript commit.

Historical checkpoint boundary: CP2 chỉ tạo design trio; CP3 sau đó tạo workflow trio và CP4 thêm CI step. Current implementation đã hoàn thành cả ba checkpoints.

## Current review correction

- Finding 1: `confirmed`. `fd-reg-output-and-related-routing-report` now receives `LearnDashboardClient.tsx` and a neutral learner-dashboard objective with explicit review-only, no-shared-change and no-manual-execution boundaries. Case ID, material reporting criterion, evaluator secrecy and allocation are unchanged.
- Finding 2: `confirmed`. Current sections now record six suites, 37 cases, completed CP2–CP5 checkpoints, exact one-step CI capability, consumed authority and the separate owner PR/CI decision. CP1 zero-suite and pre-implementation facts remain explicitly historical.
- Verification: both per-skill validations and `validate --all` are `valid`; runner tests `130/130`, structural-validator tests `37/37`; exact four-file and content audits pass.
- Formal review: `Critical: 0`, `Required: 0`; fresh-reader `not_run` because main review resolved the bounded scenario without residual ambiguity.

## Owner decision

Owner đã approve:

1. exact counts `18 + 19 = 37`;
2. exact case allocation, expected/forbidden behavior, vetoes và reference expectations trong detailed plan;
3. exact variant-applicability contract;
4. exact CI placement;
5. CP2–CP5 implementation, in-scope corrections, coherent checkpoint/correction commits và normal pushes tới existing feature branch.

Current state:

| Gate | State |
| --- | --- |
| Program roadmap | `approved` |
| ASM-PR1 dependency | `merged` |
| ASM-PR2A detailed plan | `approved` |
| ASM-PR2A implementation | `complete; CP2–CP5 complete` |
| CP2 | Complete at `7dfa8f086a6cf3301536ff552a29d478bd4eea2e` |
| CP3 | Complete at `5049e5d429d0844e2ca252850ce4f18c0e141ca2` |
| CP4 | Complete at `cd210f02526d92b7c6b38a15b7bfa5fb6c9eb325` |
| CP5 verification/reconciliation | Complete at `813deea84301cb284a1e3b17b9c1f5c8dd32dad7` |
| Original planning commit/push | `f6dae70d7c8faadfe83b7a29109cbc4708620724`; pushed and synchronized; authority consumed |
| Planning correction commit/push | Commit `152519eb210f3219e2471f51dd7d988454f1f275`; pushed and synchronized; authority consumed |
| Suite/CI implementation | `complete`; implementation/commit/push grant consumed |
| Pre-correction final-state head | `cb3099ed1030e610ba2e93986d7e600d26ede3e5` |
| Cumulative correction transition | Pre-delivery: local and under final audit; post-delivery exact SHA/PR/run evidence is Git/GitHub/PR-body owned and is not predicted here |
| Conditional delivery authority | One commit, normal push, non-draft PR and initial check watch only after `0 Critical / 0 Required`; at most one logged `branch-caused-small-safe` fix attempt; consumed after successful delivery |
| Still ungranted | Merge/auto-merge, deploy/production/database, destructive, force-push, history rewrite and scope expansion |

## Hành động tiếp theo

Historical PR creation/CI/merge sequence đã hoàn tất với PR #65 merged. Cumulative post-merge correction transition được theo dõi trong `docs/agent-skills/progress.md`; final delivery evidence phải lấy từ Git/GitHub/PR body, và successful delivery không tạo standing authority.
