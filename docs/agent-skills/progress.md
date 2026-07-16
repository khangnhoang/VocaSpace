# Tiến độ chương trình quản trị agent skill của VocaSpace

## Chương trình

Lập durable plan và rollout theo từng giai đoạn cho repo-local agent-skill governance, progressive disclosure, deterministic structural validation, synthetic evaluation và evidence-gated pilot.

Master plan: [plan.md](./plan.md).

## Trạng thái hiện tại

**PR 1 đã merge qua PR #52. PR 2 đã merge qua PR #53 tại merge commit `37599ee600656e3fb519ef4fd14452c404c4e80d`. PR 3A implementation đã complete và verified; implementation commit `7860383ee3128479feda84a6fe8115bfd9ad60c6` đã push lên `origin/feat/agent-skill-governance-pr3a`. Ba Required review finding đã được correction và commit local trong follow-up checkpoint; correction chưa push, pull request chưa mở và PR 3A chưa merge.**

File này là current-status source của chương trình. Master plan sở hữu intended scope, dependency và decision status đã được label approved/proposed. Repository và Git evidence luôn authoritative hơn tracker này.

## Trạng thái phê duyệt

- PR 1 decision bundle: owner đã duyệt trong instruction ngày 2026-07-14.
- PR 2 Node/MJS + frontmatter v1 decision bundle: owner instruction ngày 2026-07-15 cho phép implement đúng proposal nếu reviewed small-enough gate pass; [PR 2 plan](./pr-2-structural-validator-plan.md) ghi `Implementation decision: proceed`.
- PR 2 local implementation: đã được cho phép và đã thực hiện; self-review gate không tự cấp action permission mà chỉ thỏa điều kiện owner đặt trước.
- PR 3A/3B foundation decision bundle: owner đã duyệt; dependency là `PR 2 → PR 3A → PR 3B → future consumer discovery`, và PR 3 chỉ complete sau PR 3B merge.
- Current instruction authorize ba review correction, targeted verification, self-review và một local correction commit; không authorize amend, push correction, pull request, merge, deploy hoặc PR 3B.
- Future consumer discovery chưa được duyệt. Không có existing-skill pilot được chọn; possible new Codex-reporting skill chỉ là ý tưởng.

## Nhánh hiện tại

```text
feat/agent-skill-governance-pr3a
```

Branch local này được tạo từ synchronized `main == origin/main` sau authorized fetch và fast-forward-only. Implementation commit đã push theo owner permission trước đó; correction hiện tại chỉ được phép commit local, không push hoặc mở pull request.

## Evidence về base và HEAD

| Evidence | Giá trị |
| --- | --- |
| Ngày sync | 2026-07-16 |
| Branch trước sync | `feat/agent-skill-governance-pr2` tại `cd426b82e78beee3ba73cc1679180fa6b98cfb08` |
| Pre-fetch local/remote | local `main` `31b681dbbfaee017fc6078fd2d165d19d862f1ac`; pre-fetch `origin/main` `37599ee600656e3fb519ef4fd14452c404c4e80d`; working tree clean |
| Remote refresh | Authorized read-only `git fetch origin --prune`; không remote mutation |
| Fast-forward | `git switch main` rồi `git merge --ff-only origin/main`; không reset, rebase hoặc merge commit mới |
| PR 2 dependency | PR #53 merge commit `37599ee600656e3fb519ef4fd14452c404c4e80d`; PR 2 head `cd426b82e78beee3ba73cc1679180fa6b98cfb08` nằm trong ancestry |
| Synchronized `main` và `origin/main` | `37599ee600656e3fb519ef4fd14452c404c4e80d`; ahead/behind `0/0` |
| PR 3A branch base | `37599ee600656e3fb519ef4fd14452c404c4e80d` |
| Branch relationship | Independent semantic branch từ synchronized `main`; không stacked và không mang unrelated commit |

Snapshot này không ngụ ý remote state sau thời điểm đã ghi.

## PR 3A local implementation checkpoint

- Plan: [pr-3a-eval-schema-plan.md](./pr-3a-eval-schema-plan.md).
- Implementation: completed — suite-definition schema v1, read-only `validate --skill|--all` CLI, black-box `node:test` fixtures, eval-design reference và documentation reconciliation.
- Review correction: cho phép routing case không chọn skill nào; thống nhất `operational_error` với `validation_result` envelope; reconcile current Git delivery evidence.
- Current runner boundary: không real suite, prepare/report, Git subprocess, provenance/workspace, model/subagent, semantic grading, skill creation/migration hoặc CI/package/Vitest change.
- Verification: required local command set pass trên Node `v24.11.1`; eval CLI suite 50/50 pass, structural-validator suite 37/37 pass, current eval state `valid` với zero configured suite và target skill `not_configured`.
- Self-review: 0 Critical, 0 Required còn lại sau follow-up correction; no-route routing và unified operational envelope có regression coverage.
- Git delivery: implementation commit `7860383ee3128479feda84a6fe8115bfd9ad60c6` committed và pushed; remote branch `origin/feat/agent-skill-governance-pr3a`; correction commit local, not pushed; PR open: no; merged: no.
- CI coverage: dedicated PR 3A runner test chưa được CI gọi; explicit local verification là evidence hiện tại.
- Fresh-reader: `not_run`; reason: no separate executor authorization.

## Historical PR 2 implementation checkpoint

- Plan: [pr-2-structural-validator-plan.md](./pr-2-structural-validator-plan.md).
- Implemented: `.agents/scripts/validate-skill.mjs` và `.agents/scripts/validate-skill.test.mjs`.
- Local CI correction: `vitest.config.ts` exclude Node suite; `.github/workflows/ci.yml` chạy focused Node suite và current-repository validator trước build trong existing Node 20 job.
- Contract: strict VocaSpace frontmatter v1, path/resource/route validation, stable JSON schema v1, exit code `0/1/2/3`, deterministic warnings và no semantic judgment.
- Focused tests sau final re-review correction: 37 passed, 0 failed, 0 skipped trên local Node `v24.11.1`.
- Node.js 20 evidence: failed PR run đã import và chạy 37 Node tests thành công dưới Node 20, nhưng dedicated step cùng standalone validator CLI chưa chạy; intentional CI coverage vẫn pending delivery/rerun.
- Current-repository CLI: exit `0`, `status: valid`, 11 skills, 0 errors, 2 approved non-blocking length warnings.
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
- Chưa bắt đầu PR 3B `prepare`, provenance, workspace hoặc `report`.
- Chưa execute model/subagent hoặc semantic evaluation.
- Chưa execute synthetic hoặc mutation-capable evaluation.
- Chưa sửa product code, product test content, database, migration, RLS, RPC, production hoặc deployment behavior.

## Xác minh đã chạy

PR 3A targeted verification ngày 2026-07-16:

| Check | Kết quả |
| --- | --- |
| `node --version` | `v24.11.1`; Node.js 20 compatibility `not verified` |
| Ba command `node --check` cho schema, CLI và test | Pass |
| `node --test .agents/scripts/run-skill-evals.test.mjs` | Pass: 50 tests, 0 fail, 0 skipped |
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

- Xác nhận detailed PR 3B implementation brief và cấp implementation permission riêng. Approved foundation behavior không tự cấp action permission cho later PR.

### Trước future consumer

- Duyệt concrete consumer, protected invariant set, suite cases, baseline và evidence procedure.
- Duyệt việc tạo real suite, tạo/migrate skill và consumer-specific continue/revise/stop gate.
- Duyệt riêng nếu possible new Codex-reporting skill được đưa từ ý tưởng thành planned consumer.

Technical safety invariant trong draft không phải yêu cầu owner phê duyệt unsafe alternative.

## Hành động tiếp theo

Correction checkpoint đã được commit local theo owner instruction. Hành động nhỏ nhất tiếp theo là owner review correction commit và cấp push riêng nếu muốn cập nhật remote branch; không mở pull request hoặc bắt đầu PR 3B.

## Git status

Current PR 3A local state:

```text
Branch: feat/agent-skill-governance-pr3a
Base: 37599ee600656e3fb519ef4fd14452c404c4e80d
Owned scope: .agents/scripts/run-skill-evals.mjs,
             .agents/scripts/run-skill-evals.test.mjs,
             .agents/scripts/lib/skill-evals/suite-schema-v1.mjs,
             .agents/skills/maintain-repo-skills/SKILL.md,
             .agents/skills/maintain-repo-skills/references/eval-design.md,
             docs/agent-skills/plan.md,
             docs/agent-skills/progress.md,
             docs/agent-skills/pr-2-structural-validator-plan.md,
             docs/agent-skills/pr-3a-eval-schema-plan.md
Working tree: clean after local correction checkpoint
Staged: no
Implementation commit: 7860383ee3128479feda84a6fe8115bfd9ad60c6
Committed: yes; implementation và follow-up correction là hai checkpoint riêng
Pushed: implementation commit yes; correction commit no
Remote branch: origin/feat/agent-skill-governance-pr3a
Pull request: not opened
Merged: no
PR 3B: not started
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
