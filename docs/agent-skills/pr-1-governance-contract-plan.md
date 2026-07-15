---
title: "PR 1 — Governance contract cho repo-local agent skill"
status: "Reviewed execution contract; implementation decision: proceed"
implementation_branch: feat/agent-skill-governance-pr1
base: "main và origin/main @ e11137a921e6ae14ec40605244af896c36e49740"
depends_on: "Planning checkpoint b83dd539336167657d705c401414838a3e7f89c9 đã merge qua PR #51"
parent: ./plan.md
progress: ./progress.md
---

# Kế hoạch chi tiết PR 1 — Governance contract

## 1. Trạng thái và thẩm quyền tài liệu

Tài liệu này là durable implementation contract chi tiết cho riêng PR 1. Owner instruction ngày 2026-07-14 là authoritative cho các decision được liệt kê tại mục 6 và cho phép local implementation nếu plan đã review, PR 1 đạt đủ tiêu chí small-enough và không xuất hiện conflict material mới.

Plan do agent viết không tự phê duyệt decision mới. Nếu implementation cần thay đổi materially business decision, architecture, ownership, permission, scope, acceptance criterion hoặc verification guarantee ngoài owner brief, phần thay đổi đó trở lại draft và agent phải dừng. Tài liệu này không cấp quyền commit, push, mở hoặc sửa pull request, merge, deploy, remote mutation, production action hay destructive action.

[plan.md](./plan.md) tiếp tục sở hữu intended program scope, dependency graph và proposed later-program structure. [progress.md](./progress.md) tiếp tục là current-status source duy nhất. Tài liệu này sở hữu execution contract của PR 1, không sở hữu current Git status sau thời điểm evidence được ghi.

## 2. Branch, base và dependency evidence

Evidence được reconcile với Git ngày 2026-07-14:

| Evidence | Giá trị |
| --- | --- |
| Branch trước task | `docs/agent-skill-governance-plan` tại `b83dd539336167657d705c401414838a3e7f89c9` |
| Planning checkpoint | `b83dd539336167657d705c401414838a3e7f89c9` |
| Planning merge | PR #51, merge commit `e11137a921e6ae14ec40605244af896c36e49740` |
| Synchronized local `main` | `e11137a921e6ae14ec40605244af896c36e49740` |
| `origin/main` sau fetch | `e11137a921e6ae14ec40605244af896c36e49740` |
| Implementation branch | `feat/agent-skill-governance-pr1` |
| Branch base và current HEAD khi tạo | `e11137a921e6ae14ec40605244af896c36e49740` |
| Relationship | Independent từ synchronized `main`; không stacked trên unmerged branch |
| Unrelated commit carried | Không; `main...HEAD` là `0 0` ngay sau khi tạo branch |

Planning documents đã merge vào `main`; chúng không còn chỉ tồn tại trên planning branch, không còn uncommitted và không tạo stacked dependency. Remote evidence chỉ đúng tại thời điểm fetch; Git phải được kiểm tra lại trước later Git action.

## 3. Mục tiêu và observable outcome

Thêm một portable repo-local governance contract tên `maintain-repo-skills` để agent biết khi nào và bằng quyền nào được tạo, sửa, review, progressive-disclose, document và evaluate repo-local skill mà không phụ thuộc system hoặc external `skill-creator`.

Outcome quan sát được:

1. `AGENTS.md` route đúng các task tạo, sửa, review hoặc tổ chức repo-local skill sang bundle mới mà không trigger trên ordinary product implementation.
2. Core skill tự chứa authority, permission, safety, documentation ownership, evaluation boundary, related-skill routing và stop condition bắt buộc.
3. Mọi reference được tạo có consumer rõ, exact read condition và relative path hợp lệ.
4. Agent đọc contract có thể phân biệt plan approval, implementation permission, review permission và từng Git/remote/production permission.
5. Program documents mô tả đúng current evidence mà không biến requirement riêng của chương trình thành universal plan gate.

## 4. Repository findings

### Skill structure và metadata

- Repository hiện có đúng 10 repo-local skill dưới `.agents/skills/`.
- Mỗi skill hiện chỉ có một `SKILL.md`; chưa có repo-local `references/`, `scripts/`, `assets/` hoặc `agents/openai.yaml` convention.
- Frontmatter thực tế bắt đầu và kết thúc bằng `---`, chỉ có `name` và `description`; `name` là unquoted kebab-case và folder name khớp metadata name.
- `description` hiện dùng cả safe unquoted scalar và JSON-compatible double-quoted scalar.
- `maintain-repo-skills` chưa collision với folder, metadata name, explicit route hoặc Git branch đã fetch.
- External `skill-creator` có trong current Codex environment nhưng đề xuất thêm `agents/openai.yaml`, initialization script và generic validation không phải repo convention và không thuộc PR 1.

### Routing, precedence và lifecycle

- Root `AGENTS.md` sở hữu explicit repository routing bằng path cụ thể tới từng skill.
- `docs/agent-loops.md` là lifecycle routing overlay; domain skill cụ thể hơn được ưu tiên, còn rule an toàn hoặc quyền hạn chế hơn thắng khi có conflict.
- `implementation-planning-and-pr-breakdown` sở hữu discovery, scope, dependency, acceptance criteria và durable planning.
- `code-review-and-quality` sở hữu review/readiness; review mặc định read-only và approval không cấp push hoặc merge permission.
- `git-checkpoint-workflow` sở hữu branch, dirty-tree, staging, commit và local/remote boundary.
- `github-pr-ci-workflow` sở hữu GitHub PR/CI procedure và narrow bounded CI exception; exception đó không được mở rộng vào PR 1.
- Không có native platform auto-trigger contract trong repository; PR 1 chỉ sở hữu explicit routing mà repository có thể enforce bằng instruction.

### Markdown, link và path convention

- Repo dùng relative Markdown link giữa durable documents, ví dụ `[progress.md](./progress.md)`.
- Detailed plan có thể dùng YAML frontmatter cho status, branch, base, dependency và parent/progress link.
- Tracked Markdown normalize về LF trong Git; Windows working tree hiện checkout CRLF theo attributes.
- Bundled resource mới phải nằm một level dưới `SKILL.md`, link trực tiếp từ core và không tạo nested reference chain.

### Staleness và conflict audit

- Sau planning merge, `origin/main` chỉ thêm planning checkpoint và merge commit so với old planning base; không có implementation change làm stale approved PR 1 scope.
- `progress.md` còn ghi plan/PR 1 chưa được duyệt và implementation chưa được cho phép; trạng thái này đã stale sau owner instruction hiện tại và phải được reconcile.
- Master plan vẫn gọi các PR 1 decision là proposal; phần authority/status cần reconcile tối thiểu, nhưng later PR 2+ decision chưa được owner duyệt trong task này.
- Không phát hiện material repository conflict với owner decision. Nếu conflict mới xuất hiện, implementation phải dừng thay vì sửa decision.

## 5. Ownership và behavior phải bảo vệ

| Concern | Behavior bắt buộc |
| --- | --- |
| Agent-authored plan | Vẫn là draft cho đến khi owner duyệt material decision do agent đề xuất hoặc sửa |
| Plan approval | Không tự cấp implementation permission, trừ khi cùng instruction nói rõ |
| Implementation permission | Không tự cấp stage, commit, push, PR, merge, deploy, destructive hoặc production action |
| Review | Read-only mặc định; chỉ sửa khi owner hoặc approved workflow cấp quyền rõ |
| Self-governance | Governance skill không tự phê duyệt thay đổi của chính nó |
| Mandatory core | Authority, permission, safety, routing và stop invariant không được chuyển sang optional reference |
| Git ownership | Git procedure route sang `git-checkpoint-workflow` và `github-pr-ci-workflow`; không copy toàn bộ procedure |
| Durable docs | Requirement của program này, không phải universal repository-wide plan gate |
| Source ownership | Chỉ cập nhật source sở hữu thông tin đã thực sự thay đổi |
| Evidence | Historical evidence phải label; không trình bày như current fact |
| Evaluation | Safety, permission, routing, correctness hoặc verification regression phủ quyết context benefit |

## 6. Owner-approved decision áp dụng cho PR 1

1. Tên repo-local governance skill là `maintain-repo-skills`.
2. Repo-local governance contract authoritative cho lifecycle, safety, documentation, evaluation boundary, permission invariant và stop condition của thay đổi repo-local skill.
3. System hoặc external `skill-creator` chỉ là optional generic guidance, không phải dependency bắt buộc và không được ghi đè VocaSpace rule.
4. Git procedure tiếp tục thuộc `git-checkpoint-workflow` và `github-pr-ci-workflow`.
5. Core `SKILL.md` giữ mandatory authority, permission, safety, routing và stop invariant.
6. Reference chỉ giữ procedure, matrix, template, example hoặc guidance có exact read condition.
7. Không tạo universal rule buộc mọi implementation task có plan file mới.
8. `plan.md` sở hữu intended program scope, dependency và proposed program structure; `progress.md` sở hữu current actual status và verification evidence.
9. PR 1 không implement validator, eval runner, eval schema, CI hoặc migration existing skill.

Owner brief không duyệt thay PR 2+ contract hoặc later pilot decision. Những phần đó vẫn deferred theo master plan.

## 7. Ownership map

| Source/skill | Sở hữu | Không sở hữu trong PR 1 |
| --- | --- | --- |
| `maintain-repo-skills` | Contract thay đổi repo-local skill; authority, permission invariant, safety veto, documentation/evaluation boundary, resource routing, stop/reporting | Git command procedure, product/domain behavior, validator/runner implementation |
| `git-checkpoint-workflow` | Local Git state, branch, staging, commit, correction và push boundary | Skill-governance decision |
| `github-pr-ci-workflow` | PR/CI inspection, remote PR action và narrow authorized CI loop | Generic local implementation permission hoặc governance approval |
| `implementation-planning-and-pr-breakdown` | Discovery, facts/assumptions/conflicts, dependency, scope, acceptance criteria, verification plan | Owner approval hoặc Git permission |
| `code-review-and-quality` | Read-only review, findings, evidence assessment và readiness verdict | Implementation permission, commit, push hoặc merge |
| `AGENTS.md` | Explicit trigger/routing path và lifecycle/domain precedence entry point | Full governance contract hoặc native auto-trigger claim |
| `docs/agent-skills/plan.md` | Intended program scope, dependency và proposed program structure | Current execution status |
| Per-PR plan này | Detailed approved execution contract PR 1 | Current status sau evidence snapshot |
| `docs/agent-skills/progress.md` | Current actual status và verification evidence | Intended future work hoặc full contract |

## 8. Proposed file tree

```text
.agents/skills/maintain-repo-skills/
├── SKILL.md
└── references/
    ├── fresh-reader-testing.md
    └── progressive-disclosure.md

AGENTS.md
docs/agent-skills/
├── pr-1-governance-contract-plan.md
└── progress.md
```

`docs/agent-skills/plan.md` vẫn là read-only intended-program source trong PR 1 vì owner decision hiện tại không thay đổi materially intended program scope, dependency graph hoặc proposed later-program structure. Không tạo `eval-design.md` trong PR 1 vì evaluation boundary bắt buộc có thể nằm trong core và manual pre-PR-3 evidence procedure đã có consumer cụ thể trong `fresh-reader-testing.md`. Không tạo `agents/openai.yaml`, script, asset, validator, eval case hoặc empty placeholder.

## 9. File-by-file change plan

### `.agents/skills/maintain-repo-skills/SKILL.md`

- Thêm frontmatter chỉ gồm `name` và `description`, khớp repo convention.
- Định nghĩa activation, ownership, authority hierarchy và safety veto.
- Phân biệt approval, implementation, review và later action permission.
- Định nghĩa documentation source ownership và historical evidence rule.
- Giữ evaluation boundary ở contract level, không implement schema/runner/case.
- Route planning, review và Git procedure sang skill hiện có.
- Thêm standardized resource-routing table với exact read condition.
- Thêm stop condition và required output/reporting contract.

### `.agents/skills/maintain-repo-skills/references/progressive-disclosure.md`

- Chứa procedure để inventory content, giữ mandatory core, chứng minh consumer và viết exact resource condition.
- Chứa checklist về path containment, no nested chain, no placeholder và scope containment.
- Không chứa permission invariant bắt buộc hoặc Git procedure.

### `.agents/skills/maintain-repo-skills/references/fresh-reader-testing.md`

- Chứa lightweight manual fresh-reader procedure dùng trước PR 3 hoặc khi chưa có formal runner.
- Xác định bounded prompt, exact supplied context, observation và status vocabulary.
- Cấm claim runner-produced, strictly isolated, baseline-equivalent hoặc formal A/B nếu evidence không có.
- Không thêm eval schema, committed cases, runner hoặc model invocation.

### `AGENTS.md`

- Thêm một targeted route cho task tạo, sửa, review, split/progressive-disclose hoặc thay đổi routing/resource/evidence contract của repo-local skill.
- Không route ordinary product implementation sang governance skill.
- Không copy contract; giữ lifecycle/domain precedence hiện có.
- Chỉ claim explicit repository routing, không claim native platform auto-trigger.

### `docs/agent-skills/plan.md`

- Không sửa trong PR 1: intended program scope, dependency graph và proposed later-program structure không thay đổi materially.
- Dùng file này làm read-only parent plan; ghi owner approval/current execution status trong per-PR plan và `progress.md` theo đúng ownership.

### `docs/agent-skills/progress.md`

- Ghi branch/base thực tế, owner decision, discovery, per-PR plan/review, implementation decision, implementation/verification thực tế.
- Phân biệt branch created, implemented, verified, committed, pushed, PR open và merged.
- Ghi `fresh-reader: not_run` nếu không có independent bounded-context executor.
- Không giữ stale claim rằng PR 1 chưa được cho phép.

## 10. Core-versus-reference boundary

Core bắt buộc tự chứa:

- activation và ownership;
- authority/precedence;
- approval và implementation boundary;
- read-only review boundary;
- commit, push, PR, merge, deploy, remote, production và destructive boundary;
- safety veto;
- documentation/source-of-truth ownership;
- related-skill routing;
- resource-routing table;
- stop conditions;
- output/reporting contract.

Reference chỉ chứa procedure/checklist dài cho progressive disclosure và manual fresh-reader evidence. Agent không cần đọc reference để biết mình có quyền hành động hay phải dừng.

## 11. Exact resource-routing conditions

| Resource | Exact condition trong core | Consumer |
| --- | --- | --- |
| `references/progressive-disclosure.md` | Đọc trước khi task thêm, xóa, đổi tên hoặc di chuyển bundled resource; chuyển nội dung giữa core và reference; hoặc review một proposed core/reference split của repo-local skill. | Implementer/reviewer cần procedure split và path checklist |
| `references/fresh-reader-testing.md` | Đọc trước khi thiết kế, chạy hoặc báo cáo fresh-reader check; và khi changed skill text thêm, xóa hoặc đổi required behavior về ownership, approval, permission, resource routing, source-of-truth hierarchy, durable handoff hoặc lifecycle/status interpretation. | Implementer/reviewer cần manual pre-PR-3 evidence procedure và claim boundary |

Hai reference được link trực tiếp từ core, không link sang reference thứ ba và không escape bundle.

## 12. Activation/routing change trong `AGENTS.md`

Proposed route phải nêu rõ:

```text
Use .agents/skills/maintain-repo-skills/SKILL.md when creating, changing,
reviewing, splitting, or routing repo-local agent skills or their bundled
resources/evaluation/documentation contracts.
```

Route này không áp dụng chỉ vì task dùng một repo-local skill để sửa product code. Khi skill change cũng chạm domain, planning, review hoặc Git, agent phải đọc thêm skill tương ứng; `maintain-repo-skills` không thay thế chúng.

## 13. Permission và safety boundary

- Owner-approved scope/decision không tự động cấp action ngoài instruction hiện tại.
- Plan approval và implementation permission là hai boundary riêng, nhưng cùng instruction có thể cấp cả hai khi nói rõ.
- Review/readiness mặc định read-only.
- Implementation permission không cấp stage, commit, push, PR, merge, deploy, remote mutation, production action hoặc destructive action.
- Branch/fetch/sync procedure thuộc Git skill và chỉ chạy khi task cấp quyền tương ứng.
- Không force/reset/clean/stash/rebase/rewrite history để hoàn thành PR 1.
- Không thay product, package, database, Supabase, migration, RLS, RPC, CI hoặc deployment.
- Governance skill không được dùng review verdict hoặc confidence label để tự phê duyệt chính nó.
- Khi safety/permission/correctness/routing/verification regress, dừng dù context ngắn hơn.

## 14. Scope

### Trong scope

```text
.agents/skills/maintain-repo-skills/**
AGENTS.md
docs/agent-skills/pr-1-governance-contract-plan.md
docs/agent-skills/progress.md          # current actual status/evidence
```

Không mặc định mọi file đều phải đổi; chỉ sửa source sở hữu thông tin.

### Ngoài scope

- `.agents/scripts/validate-skill.mjs`.
- `.agents/scripts/run-skill-evals.mjs`.
- Eval schema, committed eval cases hoặc formal A/B package.
- Refactor/migration `code-review-and-quality` hoặc bất kỳ existing skill nào.
- CI, product code, tests, package hoặc dependency.
- Database, Supabase, migration, RLS, RPC, production hoặc deployment.
- Native platform trigger automation.
- Generic cleanup hoặc unrelated docs rewrite.

## 15. Acceptance criteria

1. Folder và frontmatter name đều là `maintain-repo-skills`; không trùng repo-local skill.
2. Description và `AGENTS.md` route kích hoạt skill change nhưng không over-trigger ordinary product task.
3. Core tự đủ để quyết định authority, approval, read-only, implementation và later-action permission.
4. Mandatory safety/permission/routing/stop invariant không chỉ tồn tại trong optional reference.
5. Git command procedure không bị duplicate; core route đúng hai Git skill.
6. Program-specific durable documentation không trở thành universal implementation gate.
7. Mỗi reference có exact non-empty read condition, valid relative path, consumer rõ và không nested chain.
8. Fresh-reader guidance không claim runner, schema, isolation hoặc baseline equivalence chưa tồn tại.
9. `AGENTS.md`, lifecycle overlay và existing skill precedence không conflict.
10. Master plan/per-PR plan/progress ownership rõ; current status chỉ nằm trong progress.
11. Diff chỉ chứa PR 1 scope; không có PR 2+ artifact hoặc existing-skill migration.
12. Strict UTF-8, final newline, Markdown/link/path/frontmatter, whitespace và Git checks đều pass.
13. Implementation review không còn Critical hoặc Required finding.
14. Commit/push/PR/merge/deploy vẫn chưa xảy ra trong task này.

## 16. Verification plan

### Deterministic/local inspection

- Strict UTF-8 decode cho mọi file mới/sửa bằng `UTF8Encoding(false, true)`.
- Kiểm tra final newline và trailing whitespace.
- Parse/inspect frontmatter theo convention thực tế: delimiter, đúng hai field, kebab-case name, folder/name match.
- Resolve mọi relative Markdown link; resource path phải tồn tại, nằm trong bundle và không escape.
- Kiểm tra heading order, duplicate heading và balanced fenced code block.
- Search repo-local name/path để xác nhận không collision và targeted routing chỉ xuất hiện nơi dự kiến.
- Search/diff để xác nhận không sửa hoặc migrate existing skill.
- `git diff --check`.
- `git diff --stat`, `git diff --name-only`, full diff và final `git status --short --branch`.

Không chạy application build, browser, Supabase, integration hoặc E2E vì diff chỉ là governance/docs và repository không yêu cầu các check đó.

### Manual inspection

- Đọc core mà không đọc reference để xác nhận mandatory permission/safety/stop behavior vẫn đầy đủ.
- Đối chiếu từng reference với exact routing row và consumer.
- Dùng near-miss prompt ordinary product task để kiểm tra `AGENTS.md` route không over-trigger.

## 17. Manual fresh-reader strategy trước PR 3

Nếu có independent bounded-context executor, cung cấp đúng:

1. Bounded prompt yêu cầu xác định authority, permission và required resources cho một repo-local skill-change scenario.
2. Exact context: root `AGENTS.md`, new `SKILL.md`, chỉ reference mà routing condition yêu cầu và scenario prompt; không cung cấp author conclusion, expected answer hoặc toàn session transcript.
3. Record raw observation, supplied file list, executor/environment limitation và status `passed`, `partially_passed`, `failed` hoặc `not_run`.

Nếu không có executor với context độc lập hợp lệ, ghi:

```text
fresh-reader: not_run
reason: không có independent bounded-context executor; self-review không phải fresh-reader evidence
```

Không gọi observation manual là runner-produced, strictly isolated, baseline-equivalent, formal A/B hoặc versioned-suite evidence. PR 3 mới sở hữu schema/runner contract.

## 18. Risks và mitigations

| Risk | Tác động | Mitigation |
| --- | --- | --- |
| Route quá rộng | Mọi task bị load governance context | Target explicit repo-local skill artifact/change; add near-miss inspection |
| Mandatory rule bị đẩy sang reference | Agent không đọc rule trước khi hành động | Inventory mandatory core và review core độc lập |
| Duplicate Git procedure | Hai source drift và conflict | Chỉ giữ permission invariant; route command procedure sang Git skills |
| Generic `skill-creator` lấn repo contract | External convention thành hidden dependency | Không tạo external-only metadata/script; state optional/non-authoritative |
| Durable docs thành universal gate | Tạo approval gate không được owner yêu cầu | Scope rule riêng cho multi-PR governance program |
| Status duplication | Future agent dùng stale current fact | Current actual status chỉ trong `progress.md` |
| False eval claim | Evidence vượt quá check thực tế | Exact fresh-reader vocabulary và `not_run` khi thiếu executor |
| PR 2+ scope creep | PR khó review/revert | Không script/schema/case/CI/migration; diff audit by path |

## 19. Stop conditions

Dừng planning hoặc implementation khi:

- repository evidence conflict materially với owner decision;
- branch/base/dependency không còn xác định hoặc tree có unrelated work không thể tách;
- cần decision mới về business, architecture, ownership, permission, scope, acceptance hoặc verification guarantee;
- cần validator, runner, eval schema, CI hoặc existing-skill refactor để làm PR 1 đúng;
- mandatory invariant không thể giữ trong core;
- exact resource condition không thể viết rõ;
- phát hiện safety, permission, routing, correctness hoặc verification regression;
- cần package, browser, database, Supabase, production, remote mutation hoặc destructive action;
- cần commit, push, PR, merge, deploy hoặc quyền chưa được cấp;
- plan/implementation review còn Critical hoặc Required finding sau bounded correction pass.

## 20. Rollback và reversibility

- PR 1 là một coherent additive governance contract, không đổi product/runtime/database behavior.
- Bundle mới, targeted route và status reconciliation có thể revert cùng nhau mà không ảnh hưởng PR 2+ artifact vì các artifact đó chưa tồn tại.
- Không migrate existing skill nên rollback không cần reconstruct old skill bundle.
- Không amend/rebase/rewrite history; task này không commit.
- Nếu implementation bị dừng, giữ exact dirty-tree evidence cho owner review và không xóa unrelated work.

## 21. Documentation reconciliation

| Information | Source sở hữu | Update trong PR 1 |
| --- | --- | --- |
| Intended program scope/dependency/proposed later structure | `plan.md` | Không update; không có material intended-program change |
| Detailed PR 1 contract | File này | Full execution plan, acceptance, verification, stop/deferred scope |
| Current actual status/evidence | `progress.md` | Branch, discovery, review, implementation decision, actual checks và remote-action state |
| Governance behavior | New `maintain-repo-skills` bundle | Durable operational contract |
| Explicit trigger | `AGENTS.md` | Một targeted route |

Không copy full per-PR history vào master plan hoặc progress. Future action chỉ được ghi proposed/pending, không ghi completed.

## 22. Completion definition

PR 1 local implementation hoàn tất khi:

- reviewed plan có `Implementation decision: proceed` và không còn Critical/Required finding;
- governance bundle, targeted route và required documentation reconciliation đã implement;
- acceptance criteria 1–14 được kiểm chứng bằng actual evidence hoặc gap được đánh dấu blocking;
- implementation review toàn diff không còn Critical/Required finding;
- verification hiện hành pass;
- `progress.md` phản ánh đúng implementation, verification và action permission; actual commit/push/PR state được xác minh từ Git và final delivery report;
- final report cung cấp changed files, verification, gaps/risks và recommended English Conventional Commit message;
- commit, push, mở PR, merge hoặc deploy chỉ xảy ra khi owner cấp quyền riêng cho action đó; không có action nào được suy ra từ implementation completion.

## 23. Deferred sang PR 2+

### PR 2

- `validate-skill.mjs`.
- Frontmatter/resource structural parser và deterministic validation tests.
- Mechanical route/resource/path/newline/encoding enforcement.

### PR 3

- Eval schema và committed cases.
- `run-skill-evals.mjs`.
- Synthetic packaging, provenance/hash, observation/comparison artifact và report aggregation.
- Formal isolation/enforcement vocabulary và versioned suite.

### PR 4 hoặc later

- Refactor/migration `code-review-and-quality` pilot.
- Baseline/candidate comparison và owner pilot gate.
- Migration skill khác, native-trigger evaluation hoặc structural CI.

## 24. Plan review record

**Review type:** `self-review` read-only, adversarial pass riêng ngày 2026-07-14. Một reviewer read-only đã được gọi với bounded context nhưng không trả kết quả sau khi task được thu hẹp và bị dừng; vì vậy không claim independent review.

| Severity | Finding | Resolution | Remaining risk |
| --- | --- | --- | --- |
| Required | Draft plan dự kiến sửa `plan.md` chỉ để ghi current owner approval, trong khi owner yêu cầu master plan chỉ đổi khi intended scope/dependency materially thay đổi và `progress.md` sở hữu current status. | Bỏ `plan.md` khỏi expected changed tree/scope; ghi rõ file là read-only parent và current approval/status thuộc per-PR plan/progress. | Low: future material program change vẫn phải được đánh giá riêng. |
| Required | Fresh-reader resource condition dùng từ `materially ảnh hưởng` nhưng chưa định nghĩa observable trigger đủ rõ. | Thay bằng điều kiện changed skill text thêm, xóa hoặc đổi required behavior trong danh sách category cụ thể. | Low: human judgment vẫn cần xác định text có đổi required behavior hay chỉ formatting. |
| Suggestion | Generic `skill-creator` khuyến nghị init script và `agents/openai.yaml`, nhưng repository chưa có convention này và PR 1 không cần UI metadata. | Giữ external skill là optional/non-authoritative; không dùng init script hoặc thêm metadata ngoài repo convention. | None trong PR 1. |

Re-review phần đã sửa: plan ownership map, expected tree, file plan, exact routing condition, scope và reconciliation table hiện nhất quán; không còn Critical hoặc Required finding đã biết.

Fresh-reader evidence status: `not_run`. Self-review này và reviewer attempt không phải fresh-reader evidence; skill chưa implement và reviewer đã nhận owner decisions/review criteria.

## 25. Small-enough decision

```text
Implementation decision: proceed
```

| Criterion | Kết quả và evidence |
| --- | --- |
| 1. Một coherent governance-contract change | Pass: một bundle mới, một targeted route và current-status reconciliation phục vụ cùng contract. |
| 2. Không còn decision material unresolved | Pass: owner brief giải quyết name, authority, permission, ownership, core/reference và excluded scope; self-review không còn blocker. |
| 3. Base/dependency rõ | Pass: branch độc lập từ synchronized `main @ e11137a`; planning commit đã merge qua PR #51. |
| 4. Expected change đúng bounded domains | Pass: new bundle, `AGENTS.md`, per-PR plan và `progress.md`; master plan read-only. |
| 5. Không cần PR 2+ artifact | Pass: validator, runner, schema, CI và migration đều deferred và không cần để contract PR 1 đúng. |
| 6. Không cần external/package/DB/browser/production | Pass: Markdown-only repo-local change, no dependency/tooling mutation. |
| 7. Core/reference boundary rõ | Pass: mandatory inventory ở core; hai procedure reference có consumer và exact condition. |
| 8. Acceptance/verification khả thi local | Pass: UTF-8, newline, frontmatter, link/path, Markdown, search, diff và manual inspection đều deterministic/local. |
| 9. Không có safety regression | Pass tại plan gate: permissions thu hẹp/route rõ; implementation review phải kiểm tra lại actual diff. |
| 10. Plan review không còn blocker | Pass: hai Required finding đã sửa và re-review; không còn known Critical/Required. |
| 11. Dễ review/revert độc lập | Pass: additive docs/skill contract, không migrate existing skill hoặc đổi runtime behavior. |
| 12. Không cần quyền chưa cấp | Pass: local edit/review/verification đã được cấp; task cấm và implementation không cần commit/push/PR/merge/deploy. |

Decision này chỉ cho phép chuyển sang local implementation theo owner instruction hiện tại. Nó không cấp bất kỳ later Git, remote hoặc production action nào.
