# ASM-PR2A — Bản tóm tắt để owner duyệt

Status: `pending`

Detailed specification: [plan.md](./plan.md).

Brief này là concise owner decision surface. Nó không thay thế detailed plan hoặc tự cấp implementation, stage/commit, push, PR, CI watch/fix, merge, deployment, database hoặc history permission. Một material owner decision phải được phản ánh vào `plan.md` và re-review trước implementation.

## ASM-PR2A sẽ hoàn thành gì

ASM-PR2A là coverage PR cho frontend experience. Later implementation được đề xuất sẽ:

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
- Current suite state: `0 configured skills / 0 suite files / 0 cases`.

ASM-PR1 phải merge trước vì later suite execution/comparison cần dùng một shared resource-evidence contract, không tự phát minh evidence semantics theo từng skill.

## Proposed suite allocation

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
| Pure design critique | `frontend-design` only |
| Focused async-mechanics audit, no UI decision | `frontend-workflow` + test skill |
| Non-trivial product frontend implementation | both frontend skills |
| Non-frontend server/docs/SQL work | neither frontend skill |

## Future reference-selection strategy

Exact future names được ghi evaluator-side:

- design: `client-marketing.md`, `learning-experience.md`, `teacher-authoring.md`, `admin-business-operations.md`, `shared-design-system-components.md`;
- workflow: `mock-data.md`, `async-state-and-forms.md`, `manual-ui-validation.md`.

Executor-visible prompt không nhận expected reference, skip group, safety veto hoặc route answer. Trước migration, suite vẫn bảo vệ current core behavior. Sau migration, explicit baseline/candidate comparison dùng cùng suite và candidate bundle manifest.

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

Proposed exact step:

```yaml
      - name: Validate agent skill evaluation suites
        run: node .agents/scripts/run-skill-evals.mjs validate --all
```

Proposed placement: immediately after `Validate repo-local agent skills` và before `Determine integration requirement`.

Lý do:

- runner tests và structural skill validation đã chạy trước;
- failure xuất hiện sớm;
- không phụ thuộc build, integration gating, Supabase hoặc database;
- ASM-PR2B/2C tự được discover qua `--all`, không sửa CI lần nữa.

## Checkpoints và rollback

1. CP0 — synchronized baseline/dependency/branch/authority: complete.
2. CP1 — detailed plan/brief/tracker, 37-case matrix, CI design, adversarial self-review: planning checkpoint.
3. CP2 — design trio implementation/review/commit, independently revertible.
4. CP3 — workflow trio implementation/cross-skill review/commit, independently revertible.
5. CP4 — exactly one CI step, independently revertible.
6. CP5 — cumulative validation/integration review/tracker reconciliation; không ceremonial commit.

CP1 phải được owner approve trước CP2. Correction của một trio không yêu cầu revert trio kia; CI step vẫn còn khi chỉ một trio được sửa.

## Verification

Planning checkpoint:

```text
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/validate-skill.mjs
git diff --check
```

Later implementation thêm:

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

Re-review:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
```

Fresh-reader không chạy vì direct evidence + main review không còn material case-discrimination ambiguity; chạy chỉ để tăng evidence volume là không cần thiết. Self-review không phải fresh-reader evidence.

Actual local CP1 checks trên Node `v24.11.1`: eval runner `130/130` pass; structural validator tests `37/37` pass; `validate --all` valid với 0 current suites; repository skill validation valid với 4 existing non-blocking length warnings. Đây không phải Node 20 evidence.

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

Planning task hiện tại còn nghiêm ngặt hơn: không tạo suite và không sửa CI.

## Owner decisions required

Owner cần approve hoặc revise:

1. exact counts `18 + 19 = 37`;
2. exact case allocation, expected/forbidden behavior, vetoes và reference expectations trong detailed plan;
3. exact CI placement;
4. CP2–CP5 implementation permission;
5. later stage/commit/push/PR/CI-watch permissions.

Current state:

| Gate | State |
| --- | --- |
| Program roadmap | `approved` |
| ASM-PR1 dependency | `merged` |
| ASM-PR2A detailed plan | `pending` |
| ASM-PR2A implementation | `not granted; not started` |
| Planning commit/push | `granted; not yet consumed` |
| Suite/CI implementation | `not granted` |
| PR/CI watch/fix/merge | `not granted` |
| Deploy/production/database/history rewrite | `not granted` |

## Hành động tiếp theo

Owner review [detailed plan](./plan.md), sau đó approve hoặc yêu cầu correction cho case matrix/CI placement. Không implementation nào bắt đầu từ status `pending`.
