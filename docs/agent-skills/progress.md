# Tiến độ chương trình quản trị agent skill của VocaSpace

## Chương trình

Lập durable plan và rollout theo từng giai đoạn cho repo-local agent-skill governance, progressive disclosure, deterministic structural validation, synthetic evaluation và evidence-gated pilot.

Master plan: [plan.md](./plan.md).

## Trạng thái hiện tại

**PR 1 đã merge qua PR #52. PR 2 đã merge qua PR #53 tại `37599ee600656e3fb519ef4fd14452c404c4e80d`. Agent-skills PR 3A đã merge qua PR #54 tại `9bc37722943ca02720ae37a38c935e8b98417614`, và merge commit này nằm trong current `origin/main` `46dd08b81f064f23b6c1bffc81d98a1496bc0041`. PR 3B đang ở planning-only checkpoint; behavior chưa implement.**

File này là current-status source của chương trình. Master plan sở hữu intended scope, dependency và decision status đã được label approved/proposed. Repository và Git evidence luôn authoritative hơn tracker này.

## Trạng thái phê duyệt

- PR 1 decision bundle: owner đã duyệt trong instruction ngày 2026-07-14.
- PR 2 Node/MJS + frontmatter v1 decision bundle: owner instruction ngày 2026-07-15 cho phép implement đúng proposal nếu reviewed small-enough gate pass; [PR 2 plan](./pr-2-structural-validator-plan.md) ghi `Implementation decision: proceed`.
- PR 2 local implementation: đã được cho phép và đã thực hiện; self-review gate không tự cấp action permission mà chỉ thỏa điều kiện owner đặt trước.
- PR 3A/3B foundation decision bundle: owner đã duyệt; dependency là `PR 2 → PR 3A → PR 3B → future consumer discovery`, và PR 3 chỉ complete sau PR 3B merge.
- PR 3A implementation, review-correction, push, PR và merge permissions là historical và đã consumed; branch/pre-PR state cũ không còn là current delivery state.
- Current instruction ngày 2026-07-26 authorize đúng PR 3B planning scope, planning self-review, một planning commit và normal push của branch hiện tại. Nó không authorize runner implementation, specialist/fresh-reader, PR, CI watch/fix, merge, amend, force-push, deploy hoặc consumer work.
- Future consumer discovery chưa được duyệt. Không có existing-skill pilot được chọn; possible new Codex-reporting skill chỉ là ý tưởng.

## Nhánh hiện tại

```text
feat/agent-skills-eval-runner
```

Branch local này được tạo độc lập từ synchronized `main == origin/main` sau authorized fetch và fast-forward-only ngày 2026-07-26. Tại thời điểm bắt đầu planning delivery, không có local/remote branch hoặc pull request cùng tên; PR 3B behavior chưa implement, commit, push, mở PR hoặc merge.

## Evidence về base và HEAD

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

## PR 3B planning checkpoint

- Detailed plan: [pr-3b-eval-runner-plan.md](./pr-3b-eval-runner-plan.md).
- Goal: synthetic packaging, SHA-256 provenance, fixed runner-owned OS-temp workspace và deterministic report; không invoke hoặc grade model.
- Shape: một pull request với CP0–CP5; commit chỉ tồn tại khi checkpoint tạo coherent, independently reviewable và recoverable state.
- Planning scope: đúng detailed plan, progress tracker và PR 3A historical plan.
- Planning behavior state trước delivery: plan drafted/reviewed only; implementation: no; behavior commit: no; behavior push: no; PR open: no; merged: no.
- Planning delivery: current instruction cho phép đúng một commit `docs(agent-skills): define PR3B execution contract` và normal push `feat/agent-skills-eval-runner`. Exact post-action SHA/ref equality thuộc Git và final checkpoint report, không được tracker tự pre-claim.
- Implementation, specialist/fresh-reader, future checkpoint commits, PR, CI watch/fix và merge cần permission riêng.

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

## Boundary chưa bắt đầu

- Chưa sửa hoặc migrate existing skill.
- Chưa tạo real eval suite hoặc real/new skill.
- PR 3B planning đã bắt đầu; chưa implement `prepare`, provenance, workspace hoặc `report`.
- Chưa execute model/subagent hoặc semantic evaluation.
- Chưa execute synthetic hoặc mutation-capable evaluation.
- Chưa sửa product code, product test content, database, migration, RLS, RPC, production hoặc deployment behavior.

## Xác minh đã chạy

### Current PR 3B planning verification

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

Evidence limit: các Node tests trên chỉ bảo vệ current PR 3A validator/schema behavior. PR 3B `prepare`, provenance, workspace và `report` chưa tồn tại, chưa execute và chưa được các tests này verify.

### Current PR 3B planning self-review

Adversarial self-review dùng root/lifecycle instructions, master plan, merged PR 3A contract, runner/schema sources, eval-design authority và planning/review/Git/test/skill-maintenance contracts. Không invoke specialist hoặc fresh-reader.

| Classification | Finding | Resolution |
| --- | --- | --- |
| Critical | 0 | Không có |
| Required | Evaluation control plane và ref-selected variant bundle ban đầu chưa tách đủ rõ, có thể làm baseline/candidate nhận khác context | Plan giờ pin suite/criteria/context từ current tree một lần; ref chỉ chọn skill bundle và mọi variant nhận cùng context bytes |
| Required | Deterministic content-derived workspace ID kết hợp no-overwrite/no-cleanup làm repeat prepare cùng input bị collision | Workspace ID đổi thành opaque collision-resistant identity; deterministic provenance/reproducibility hash tách khỏi ID |
| Required | Observation template có role nhưng chưa có exact versioned artifact literal | Ghi rõ `observation_template` là versioned executor-visible artifact |
| Required | Generic master-plan exit proposal có thể làm stale `incomplete → exit 1` hoặc suy ra `not_run` | Detailed plan ghi explicit owner decision là authority cho PR 3B: missing observation tạo incomplete/null và structurally valid report exit `0`; không sửa out-of-scope master plan |
| Required | Complete observations nhưng thiếu required human proposal ban đầu được tách thành một completeness dimension chưa có owner contract | Reconcile theo eval-design: missing required human proposal cũng là `evidence_status: incomplete`, semantic/comparison `null`, exit `0` |
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

## Quyết định còn chờ owner

### Trước PR 3B implementation

- Cấp implementation permission riêng cho CP1–CP4 và exact implementation files trong [PR 3B plan](./pr-3b-eval-runner-plan.md). Approved planning contract không tự cấp action permission.
- Cấp riêng permission cho mỗi local stage/commit boundary hoặc một bounded instruction nêu rõ coherent checkpoint commits.
- Cấp riêng normal push, PR, CI watch/fix và merge khi muốn đi qua từng remote boundary.
- Specialist/fresh-reader/model execution không cần cho deterministic runner implementation và chưa được phép; nếu sau này cần, phải có explicit bounded permission riêng.

### Trước future consumer

- Duyệt concrete consumer, protected invariant set, suite cases, baseline và evidence procedure.
- Duyệt việc tạo real suite, tạo/migrate skill và consumer-specific continue/revise/stop gate.
- Duyệt riêng nếu possible new Codex-reporting skill được đưa từ ý tưởng thành planned consumer.

Technical safety invariant trong draft không phải yêu cầu owner phê duyệt unsafe alternative.

## Hành động tiếp theo

Sau planning commit/push được phép trong checkpoint này, hành động nhỏ nhất tiếp theo là owner review detailed PR 3B contract và cấp implementation permission riêng cho CP1–CP4. Không implement runner, tạo pull request, watch/fix CI hoặc merge trong planning instruction hiện tại.

## Git status

Current PR 3B planning state:

```text
Branch: feat/agent-skills-eval-runner
Base: 46dd08b81f064f23b6c1bffc81d98a1496bc0041
Planning scope: docs/agent-skills/pr-3b-eval-runner-plan.md,
                docs/agent-skills/progress.md,
                docs/agent-skills/pr-3a-eval-schema-plan.md
Planning drafted/reviewed: current checkpoint
Planning commit/push: exact final state owned by Git/final checkpoint report
Behavior implemented: no
Behavior committed: no
Behavior pushed: no
Pull request: not opened
Merged: no
Specialist/fresh-reader: not invoked
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
