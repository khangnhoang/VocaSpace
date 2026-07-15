# Kế hoạch PR 2 — Structural validator

## 1. Trạng thái và thẩm quyền

| Trường | Giá trị |
| --- | --- |
| Material decision status | Owner-approved through existing PR 2 decision bundle |
| Execution status | Final re-review correction đã được implement và verified local |
| Git delivery status | Initial checkpoint `bac967d093ea34bef31a0769494693fa28e6f5cf` đã push; follow-up correction commit và normal push được owner authorize; exact correction delivery state do Git và final checkpoint report sở hữu; pull request chưa được authorize |
| Owner instruction | Ngày 2026-07-15: discovery PR2, lập plan, self-review plan, đánh giá small-enough gate và implement local nếu gate pass |
| Authoritative program scope | [plan.md](./plan.md) |
| Current-status source | [progress.md](./progress.md) |
| Branch | `feat/agent-skill-governance-pr2` |
| Base | synchronized `main` và `origin/main` tại `31b681dbbfaee017fc6078fd2d165d19d862f1ac` |
| Dependency | PR 1 đã merge qua PR #52 tại base trên |

Owner instruction hiện tại cấp conditional local implementation permission cho đúng PR 2 proposal nếu reviewed plan có `Implementation decision: proceed`. Gate này không tự cấp quyền: commit, push, mở/cập nhật PR, merge, deploy, remote mutation, production mutation, destructive action hoặc history rewrite.

Plan này không thay đổi materially PR 2 proposal trong master plan. Nó cụ thể hóa contract Node/MJS, VocaSpace frontmatter v1 và deterministic structural validation đã được đề xuất. Nếu self-review cần thay đổi material architecture, scope, permission, acceptance hoặc verification guarantee, phần thay đổi phải dừng ở draft thay vì dùng gate để tự cấp quyền.

## 2. Mục tiêu

Thêm một CLI deterministic phát hiện cấu trúc repo-local skill không hợp lệ trong `.agents/skills` và explicit skill route hỏng trong `AGENTS.md`, mà không đưa ra semantic judgment về nội dung skill, trigger quality hoặc agent behavior.

Outcome quan sát được:

- repository hiện tại validate thành công với warning đã biết được report rõ;
- fixture không hợp lệ tạo diagnostic có code ổn định và exit code đúng category;
- output chỉ chứa path tương đối chuẩn hóa, được sort ổn định và không phụ thuộc machine path;
- validator không sửa file, không invoke model, không chạy Git/CI và không tự diễn giải semantic truth.

## 3. Confirmed facts

- Repository dùng custom script Node/MJS và CI dùng Node.js 20.
- `package.json` chưa có script riêng cho agent-skill validation.
- Chưa có `.agents/scripts` hoặc test Node `node:test` trong repository.
- Có 11 repo-local skill directory; mỗi directory hiện có `SKILL.md` với đúng `name` và `description`.
- `frontend-workflow` dùng JSON-compatible double-quoted description; các skill còn lại dùng unquoted safe scalar.
- `maintain-repo-skills` hiện có hai bundled reference và standardized `Resource routing` table.
- Mọi repo-local skill hiện được explicit route từ `AGENTS.md`.
- `nextjs-server-action-zod` và `test-quality-strategy` vượt non-blocking signal 500 dòng; đây là warning, không phải validation error.
- PR 1 đã merge; local `main` đã fetch và fast-forward khớp `origin/main` trước khi tạo branch PR 2.

## 4. Assumptions và conflict reconciliation

### Assumptions

- “Implement PR2 nếu đủ nhỏ” áp dụng cho đúng PR 2 proposal hiện có, không cho phép thêm eval runner, CI hoặc migrate skill.
- CLI chạy với repository root là current working directory; test có thể chạy cùng script với temporary fixture repository làm `cwd` mà không cần public `--root` option.
- JSON là stable structured output phù hợp nhất cho deterministic tooling và later runner consumption.

### Conflict đã reconcile

- Master plan ghi Node/MJS và frontmatter v1 cần owner duyệt trước PR 2; owner instruction hiện tại cho phép implement đúng PR2 proposal nếu gate pass. Vì plan không đổi proposal material, conditional instruction là action authority; self-review chỉ xác nhận điều kiện, không tự phê duyệt governance change.
- `test-quality-strategy` đặt unit test mặc định trong `__tests__/utils`, nhưng master plan yêu cầu focused Node `node:test` cho tooling. Test đặt cạnh `.agents/scripts` để chạy trực tiếp bằng Node 20, không đưa test tooling vào Vitest/application suite.

Không có open product, security, database, permission hoặc remote decision.

## 5. Scope

### Trong scope

- `.agents/scripts/validate-skill.mjs`.
- `.agents/scripts/validate-skill.test.mjs` dùng `node:test`, `node:assert/strict` và temporary fixture repository.
- Stable JSON schema v1 cho kết quả, diagnostic code và exit code.
- Validate toàn bộ immediate skill directory trong `.agents/skills` và explicit `.agents/skills/<name>/SKILL.md` path trong root `AGENTS.md`.
- Cập nhật per-PR plan và current progress bằng evidence thực tế.
- Reconcile master-plan decision status tối thiểu nếu implementation thực sự bắt đầu theo owner instruction.

### Ngoài scope

- Semantic duplication/conflict, description quality, trigger quality hoặc correctness của instruction.
- General YAML parser, third-party package hoặc Python/PyYAML.
- Eval schema, `run-skill-evals.mjs`, model/subagent execution hoặc semantic grader.
- Auto-fix, file mutation, Git subprocess, CI workflow hoặc package script.
- Existing-skill migration, core/reference split hoặc routing rewrite.
- Product code, application test/build, browser, Supabase, database, production hoặc deployment.

## 6. Proposed file tree

```text
.agents/
└── scripts/
    ├── validate-skill.mjs
    └── validate-skill.test.mjs

docs/agent-skills/
├── plan.md
├── pr-2-structural-validator-plan.md
└── progress.md
```

Không thêm fixture directory committed. Test tạo fixture tối thiểu trong OS temporary directory và cleanup bằng test lifecycle.

## 7. CLI contract

### Invocation

```text
node .agents/scripts/validate-skill.mjs
node .agents/scripts/validate-skill.mjs --help
```

CLI không nhận arbitrary root, output path, shell string hoặc mutation option. Validation root là `process.cwd()`; skills root cố định là `.agents/skills`; route source cố định là `AGENTS.md`.

### Output

Normal validation ghi đúng một JSON document vào stdout:

```json
{
  "schema_version": 1,
  "tool": "validate-skill",
  "status": "valid",
  "summary": {
    "skills": 1,
    "errors": 0,
    "warnings": 0
  },
  "diagnostics": []
}
```

`status` là `valid` khi không có error và `invalid` khi có ít nhất một deterministic validation error. Diagnostic có shape:

```json
{
  "severity": "error",
  "code": "RESOURCE_PATH_ESCAPE",
  "path": ".agents/skills/example/SKILL.md",
  "message": "..."
}
```

`skill` chỉ xuất hiện khi diagnostic gắn được với một skill. Path dùng `/`, relative từ repository root và không chứa absolute temporary path. Diagnostics sort theo `severity`, `path`, `code`, `skill`, `message` để cùng input cho cùng output.

Operational failure vẫn ghi một JSON document ổn định vào stdout với `status: "operational_error"` và một `error` object `{ "code", "message" }`; nó không giả làm validation diagnostic hoặc cộng vào validation summary. Message không chứa absolute repository/fixture path. CLI usage error là ngoại lệ: nó ghi concise usage error vào stderr vì validation chưa bắt đầu.

### Exit codes

| Code | Ý nghĩa |
| ---: | --- |
| `0` | Validation hoàn tất, không có error; warning được phép |
| `1` | Validation hoàn tất và phát hiện invalid skill/repository structure |
| `2` | CLI usage không hợp lệ |
| `3` | Operational refusal/failure, ví dụ không đọc được required root |

`--help` ghi usage text, exit `0` và không chạy validation. Unknown argument exit `2` và ghi concise error vào stderr.

## 8. VocaSpace frontmatter v1

`SKILL.md` phải bắt đầu bằng frontmatter có đúng hai field `name` và `description`, mỗi field xuất hiện một lần.

- `name`: unquoted kebab-case `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `description`: một non-empty unquoted safe scalar hoặc JSON-compatible double-quoted string parse bằng `JSON.parse` thành non-empty string.
- Unquoted safe scalar phải non-empty, bằng chính nó sau `trim()`, không bắt đầu bằng một ký tự trong tập ``-?:,[]{}#&*!|>'"%@` ``, và không chứa `: ` hoặc ` #`.
- Single quote, multiline scalar, arbitrary escape, inline comment và extra field là unsupported VocaSpace frontmatter v1, không được report như general YAML judgment.
- Metadata `name` phải khớp folder name; repo-local metadata name không được trùng.

Parser chấp nhận LF hoặc CRLF, nhưng `SKILL.md` phải là UTF-8 hợp lệ và kết thúc bằng LF byte. PR 2 chỉ kiểm tra existence, containment, reparse point và routing đối với bundled resource; nó không áp UTF-8/newline rule lên binary asset chưa có text-file contract.

## 9. Structural validation boundary

### Error diagnostics

- `SKILL_FILE_MISSING`
- `FRONTMATTER_UNSUPPORTED`
- `FRONTMATTER_FIELD_MISSING`
- `FRONTMATTER_FIELD_DUPLICATE`
- `FRONTMATTER_FIELD_UNSUPPORTED`
- `SKILL_NAME_INVALID`
- `SKILL_NAME_MISMATCH`
- `SKILL_NAME_DUPLICATE`
- `FILE_ENCODING_INVALID`
- `FINAL_NEWLINE_MISSING`
- `RESOURCE_ROUTING_ENTRY_INVALID`
- `RESOURCE_PATH_ESCAPE`
- `RESOURCE_MISSING`
- `PATH_REPARSE_POINT`
- `EXPLICIT_ROUTE_MISSING`

### Warning diagnostics

- `SKILL_NOT_EXPLICITLY_ROUTED`
- `RESOURCE_NOT_ROUTED`
- `CORE_LENGTH_SIGNAL`

Core length threshold là `500` dòng và chỉ là warning. Không có diagnostic “semantic invalid”, “bad trigger”, “duplicated meaning” hoặc tương đương.

### Resource rules

- Parse standardized `## Resource routing` section đến heading cùng/cao hơn tiếp theo.
- Data row phải có Markdown link path ở cell đầu và non-empty condition ở cell thứ hai.
- Local Markdown resource target trong `SKILL.md` phải resolve bên trong skill directory và tồn tại.
- Bundled file ngoài `SKILL.md` không có standardized route tạo warning.
- Absolute path, path escape hoặc target qua symlink/junction/reparse point bị reject.
- URL, mailto và same-document anchor không được coi là bundled resource.

### Repository route rules

- Parse explicit slash hoặc Windows-backslash `.agents/skills/<name>/SKILL.md` occurrence trong root `AGENTS.md`.
- Explicit route target không tồn tại tạo error.
- Skill không được explicit route tạo warning.
- Validator không quyết định route có đúng activation scope hoặc native trigger behavior hay không.

## 10. Test strategy

Test layer: black-box Node unit/CLI test. Mỗi case spawn CLI với `shell: false`, deterministic temporary repository và assert exit code + parsed JSON diagnostic thay vì assert private helper.

Nhóm case:

1. `--help`, unknown argument và missing required repository root.
2. Valid unquoted description, valid JSON-quoted description, LF/CRLF và current repository baseline.
3. Missing `SKILL.md`, missing/duplicate/extra field, unsupported v1 syntax, invalid/mismatched/duplicate name.
4. Invalid UTF-8 và missing final newline.
5. Valid routed resource, malformed routing row, missing/escaped/unrouted resource.
6. Slash/backslash explicit route, missing explicit route target và unrouted skill warning.
7. Length warning remains non-blocking.
8. Symlink/junction fixture reject khi environment cho phép tạo; nếu OS policy từ chối fixture setup, test ghi skip chính xác thay vì claim pass.
9. Stable ordering/output không leak absolute fixture path.

Test file có concise Vietnamese test-plan header và cập nhật exact verification command sau khi run.

## 11. Verification plan

```text
node --version
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs --help
node .agents/scripts/validate-skill.mjs
git diff --check
```

Node.js 20 compatibility chỉ được claim nếu `node --version` thực tế là major 20. Nếu local major khác, functional tests vẫn được report nhưng compatibility là `not verified` thay vì suy diễn từ syntax.

Không chạy application Vitest, lint, typecheck, build, browser, Supabase hoặc E2E vì diff không chạm application boundary.

## 12. Documentation and progress

- `plan.md`: chỉ đổi decision/status wording mà source này sở hữu nếu PR2 gate pass và implementation bắt đầu; không copy per-PR detail.
- File này: sở hữu approved execution contract, self-review record, small-enough gate và implementation/review checkpoint của PR2.
- `progress.md`: cập nhật current branch/base, approval/permission, implementation state, exact verification và current Git/remote state.
- Git/final checkpoint report vẫn authoritative cho staged/committed/pushed/PR state.

Fresh-reader không bắt buộc nếu implementation không đổi required governance comprehension behavior. Self-review không bao giờ được label fresh-reader evidence.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Hand-written parser vô tình thành incomplete YAML parser | False compatibility | Strict two-field v1 grammar, unsupported diagnostic và negative tests |
| Path traversal hoặc link escape | Đọc ngoài skill bundle | Lexical containment, realpath/reparse inspection và hostile fixtures |
| Machine-specific output | Evidence không reproducible | Repo-relative `/` paths, stable sort, không include absolute root |
| Warning bị dùng như quality authority | False semantic gate | Warning category rõ, exit `0`, length signal explicitly non-blocking |
| Test chỉ bảo vệ helper internals | Refactor-fragile evidence | Spawn CLI và assert observable exit/output |
| Windows behavior khác POSIX | Fixture/path regression | Backslash route case, CRLF case và conditional junction/symlink case |
| PR mở rộng sang runner/CI | Khó review/revert | Explicit exclusion và diff audit theo path |

## 14. Acceptance criteria

1. Current repository trả `status: valid`, exit `0`; warning baseline được report chứ không bị nâng thành error.
2. CLI output theo schema v1, deterministic và không leak absolute path.
3. Frontmatter v1 chấp nhận hai current supported description forms và reject unsupported syntax bằng đúng boundary wording.
4. Invalid name, folder mismatch và duplicate repo-local name được test.
5. Invalid UTF-8 và missing final newline được test.
6. Missing resource, path escape, malformed resource-routing row và unlisted resource được phân loại đúng.
7. Explicit missing AGENTS route target là error; skill không explicit route là warning; slash và backslash path đều được hiểu.
8. Symlink/junction/reparse traversal bị reject khi fixture environment hỗ trợ; limitation được report trung thực nếu không hỗ trợ.
9. Unknown CLI usage, validation error và operational failure có exit code riêng.
10. Validator không sửa file, không dùng package ngoài standard library, không chạy shell/Git/model/CI và không claim semantic truth.
11. Focused tests, help invocation, current-repo invocation và `git diff --check` pass hoặc exact blocker được report.
12. Plan/progress phản ánh đúng implemented/verified/committed/pushed/PR-open/merged state.

## 15. Implementation prompt

Một prompt coherent:

1. Implement CLI contract và black-box test matrix trong `.agents/scripts`.
2. Chạy focused verification; sửa chỉ finding thuộc approved scope.
3. Reconcile authoritative status docs bằng evidence thực tế.
4. Self-review toàn diff theo correctness, path safety, deterministic evidence, scope và documentation truthfulness.

Prompt không được stage/commit/push/open PR sau completion.

## 16. Plan review record

Review type: `self-review` read-only trên draft plan, đối chiếu master plan, current repository, relevant skills, owner instruction và Git/base evidence.

| Severity | Finding | Resolution |
| --- | --- | --- |
| Required | JSON example ghi `warnings: 2` nhưng `diagnostics` rỗng, làm schema example tự mâu thuẫn. | Đổi example thành một valid zero-warning result; current-repository warning baseline vẫn thuộc acceptance/test. |
| Required | Cụm “không bắt đầu bằng YAML indicator” chưa phải exact deterministic grammar. | Ghi exact disallowed first-character set, trim rule và disallowed inline sequences cho unquoted scalar. |
| Required | Exit code `3` đã có nhưng output contract cho operational failure chưa rõ, có thể làm later consumer phải parse stderr không ổn định hoặc nhầm operational failure thành invalid skill. | Thêm `operational_error` JSON shape riêng; usage error vẫn ở stderr vì validation chưa bắt đầu. |

Re-review sau correction:

- Scope khớp đúng PR 2 proposal; không có runner, CI, auto-fix, package, product hoặc remote expansion.
- Frontmatter, output, exit code, path/resource và warning boundary đủ exact để implement và test observable behavior.
- Owner instruction là conditional action authority; self-review không được dùng làm self-approval của governance change.
- Không còn known `Critical` hoặc `Required` finding. Một non-blocking limitation còn lại: arbitrary Windows reparse type ngoài symlink/junction chỉ có thể được verify theo API/environment thực tế và phải report đúng evidence.

## 17. Small-enough gate

```text
Implementation decision: proceed
```

| Criterion | Kết quả và evidence |
| --- | --- |
| Một coherent outcome | Pass: một read-only structural validator, test và status reconciliation phục vụ cùng contract. |
| Material decision | Pass: plan cụ thể hóa đúng Node/MJS + frontmatter v1 proposal; không đổi architecture/scope material. |
| Base/dependency | Pass: branch từ synchronized `main @ 31b681d`; PR 1 đã merge qua PR #52. |
| Bounded domains | Pass: `.agents/scripts` và đúng program docs; không chạm skill content hoặc application. |
| Verification | Pass: Node CLI/test và diff checks deterministic, chạy local, không cần service. |
| External risk | Pass: standard library only; không package, DB, browser, network, production hoặc remote mutation. |
| Safety/permission | Pass: read-only path-bounded tool; current instruction cho phép local implementation khi gate pass. |
| Review status | Pass: 3 Required finding đã sửa; re-review còn 0 Critical và 0 Required. |
| Reviewability/revertability | Pass: một tooling slice độc lập, không CI enforcement hoặc consumer migration. |

PR2 đủ nhỏ theo semantic risk và dependency để implement trong một prompt. Line count không phải hard gate; implementation phải dừng nếu actual diff cần general YAML, external package, CI, runner, skill migration hoặc permission ngoài scope.

## 18. Implementation checkpoint

Implemented local trên `feat/agent-skill-governance-pr2`:

- `.agents/scripts/validate-skill.mjs`: read-only CLI, strict frontmatter v1, resource/path/route checks, stable JSON schema v1, deterministic diagnostic ordering và exit code `0/1/2/3`.
- `.agents/scripts/validate-skill.test.mjs`: black-box temporary-repository suite hiện report 37 tests, gồm hostile route/resource/dedupe, intermediate-file và Windows junction coverage.
- `docs/agent-skills/plan.md`: reconcile PR 2 decision status; không approve PR 3 runner.
- File này: giữ reviewed implementation contract, gate, evidence và review record.
- `docs/agent-skills/progress.md`: ghi current branch/base, implemented/verified state và exact Git/remote boundary.

Verification evidence ngày 2026-07-15:

| Check | Result |
| --- | --- |
| `node --version` | `v24.11.1`; Node.js 20 runtime compatibility `not verified` |
| `node --check .agents/scripts/validate-skill.mjs` | Pass |
| `node --check .agents/scripts/validate-skill.test.mjs` | Pass |
| `node --test .agents/scripts/validate-skill.test.mjs` | Pass: 37 tests, 0 fail, 0 skipped sau final re-review correction |
| `node .agents/scripts/validate-skill.mjs --help` | Pass |
| `node .agents/scripts/validate-skill.mjs` | Pass: exit `0`, 11 skills, 0 errors, 2 non-blocking length warnings |
| Strict UTF-8/newline/trailing-whitespace + Markdown heading/fence/link audit | Pass cho 5 initial-checkpoint files và 4 final-correction files; invocation đầu có false positive vì regex PowerShell chứa literal `t`, corrected regex `[ \x09]+$` pass |
| `git diff --check` | Pass, không có whitespace error; local Git chỉ cảnh báo future LF-to-CRLF normalization ở later diff display |
| Application/browser/database checks | Not run; không thuộc affected boundary |

Fresh-reader status: `not_required`. PR 2 không đổi required governance behavior trong repo-local skill text; self-review không được trình bày như fresh-reader evidence.

## 19. Implementation review record

Review type: `self-review` read-only trên toàn bộ prompt-owned uncommitted/untracked change so với base `31b681dbbfaee017fc6078fd2d165d19d862f1ac`.

| Severity | Finding | Resolution |
| --- | --- | --- |
| Required | `SKILL.md` symlink check đứng sau `isFile()` nên symlink có thể bị report sai thành missing core. | Đưa reparse check lên trước file-kind check. |
| Required | Inline comment ở `name` có thể bị report là invalid kebab-case thay vì unsupported frontmatter v1. | Phân loại ` #` name syntax thành `FRONTMATTER_UNSUPPORTED` và thêm black-box case. |
| Required | Master-plan reconciliation vô tình mô tả Node/MJS approval cho cả validator/runner, mở rộng sang PR 3. | Thu hẹp approved wording về structural validator; runner contract vẫn pending PR 3 owner decision. |
| Required | Progress wording ngụ ý Node 20 compatibility từ source inspection dù runtime local là Node 24. | Đổi thành exact `not verified` limitation. |
| Suggestion | Một junction có thể tạo hai diagnostic cùng code/path do hai traversal phase dùng message khác nhau. | Dedupe theo severity/code/skill/path và thêm assertion chỉ có một `PATH_REPARSE_POINT`. |
| Suggestion | Missing nested resource ban đầu report component đầu tiên bị thiếu thay vì full expected target. | Diagnostic path dùng full normalized target. |

Re-review sau correction:

- 0 `Critical`, 0 `Required` còn lại.
- Scope audit: chỉ có validator, focused test và ba authoritative program docs; không có package, CI, runner, skill migration hoặc application change.
- Permission/safety audit: production CLI import read-only `node:fs` APIs; mutation APIs chỉ tồn tại trong OS-temp test fixture; không có shell, Git, model, network hoặc arbitrary output path.
- Evidence audit: local Node 24 được ghi đúng; Node 20 chưa chạy; warning không bị gọi là semantic pass/fail.
- Manual QA: not applicable cho deterministic CLI.
- Initial self-review verdict: `Approved`; owner review sau đó supersede verdict này bằng `Request changes` với 3 Required và 1 Suggestion finding.

## 20. Owner-review correction record

Owner review verdict: `Request changes` — 0 Critical, 3 Required, 1 Suggestion. Reviewer chạy historical 17-test suite trên Node `v22.16.0` và bổ sung hostile fixtures để chứng minh các defect; evidence đó không verify Node 20.

| Finding | Correction |
| --- | --- |
| Required 1 — explicit route parser bỏ route invalid-name và nhận `SKILL.md.backup` | Parse broad single-segment route token, kiểm tra start/end token boundary riêng, normalize slash/backslash sau capture; glob route pattern không bị coi là explicit route. |
| Required 2 — resource-routing target không có shared classification/canonicalization | Thêm shared parser phân loại local/external/same-document/absolute; standardized row chỉ nhận local relative target; fragment/query/leading `./` dùng cùng canonical identity. |
| Required 3 — per-PR status stale | Tách material decision, execution và Git delivery status ở đầu plan. |
| Suggestion 1 — dedupe collapse independent diagnostic | Thêm optional diagnostic identity vào dedupe key; name/description frontmatter violations có identity riêng; known reparse duplicate giữ cùng normalized message. |

Regression evidence added:

- invalid-name missing explicit route, gồm underscore và whitespace segment;
- `SKILL.md.backup` token rejection;
- canonical explicit route với Markdown punctuation;
- `https:`, `mailto:`, same-document anchor, POSIX absolute và Windows absolute routing target rejection;
- local resource target với fragment, query và leading `./`;
- hai independent `FRONTMATTER_UNSUPPORTED` diagnostics trên cùng file.

First correction self-review, sau đó bị owner final re-review supersede:

- Cả 3 Required findings đã resolve bằng observable regression coverage; Suggestion dedupe cũng đã áp dụng.
- Required command set pass trên local Node `v24.11.1`: syntax checks, 33-test suite, CLI help, current-repository validation và `git diff --check`.
- Current repository trả exit `0`, 11 skills, 0 errors và 2 expected non-blocking length warnings.
- Scope audit không có package, runner, CI, skill migration, application code hoặc remote action.
- Node.js 20 compatibility giữ `not verified`; reviewer historical Node `v22.16.0` và local Node `v24.11.1` không thay thế runtime major 20 evidence.
- Verdict: `Approved` cho corrected local implementation checkpoint; verdict không cấp stage/commit/push/PR/merge permission.

## 21. Final re-review correction record

Owner final re-review verdict: `Request changes` — 0 Critical, 2 Required, 1 Suggestion. Reviewer chứng minh Node `v22.16.0` trả `ENOTDIR` khi path con đi qua regular file; Node.js 20 compatibility vẫn không được verify bởi evidence này.

| Finding | Correction |
| --- | --- |
| Required 1 — `ENOTDIR` bị phân loại thành operational failure | `optionalStat()` coi cả `ENOENT` và `ENOTDIR` là structural absence; explicit route report `EXPLICIT_ROUTE_MISSING`, resource target report `RESOURCE_MISSING`, đều exit `1`. |
| Required 2 — current implementation checkpoint còn ghi 17 observable cases | Current checkpoint và verification evidence được reconcile thành 37 reported tests. |
| Suggestion 1 — internal dot segment chưa có canonical identity | Shared resource canonicalizer dùng POSIX normalization sau slash normalization; `references/./guide.md` và contained `references/../guide.md` so sánh đúng với bundle identity. |

Regression evidence added:

- explicit route có intermediate component là regular file;
- resource target có intermediate component là regular file;
- local routed resource có internal `.` hoặc contained `..` segment.

Correction re-review:

- Hai Required và Suggestion đã resolve bằng code path chung cùng black-box regression coverage.
- Local Node `v24.11.1` report 37 tests, 37 pass, 0 fail, 0 skipped; hai intermediate-file fixtures đều exit `1`. Runtime này không tái hiện `ENOTDIR` pre-fix, nên Node `v22.16.0` reviewer evidence vẫn là reproduction của error-code branch.
- Required command set pass: hai syntax checks, focused test suite, CLI help, current-repository validation và `git diff --check`.
- Scope chỉ gồm validator, focused tests, per-PR plan và progress; không có package, runner, CI, skill migration hoặc application code.
- Fresh-reader: `not_required`; không đổi required behavior trong repo-local skill text.
- Node.js 20 compatibility giữ `not verified`.
- Final self-review: 0 Critical, 0 Required còn lại; verdict `Approved` cho follow-up correction checkpoint. Verdict không authorize pull request, merge hoặc action ngoài normal push đã được owner cấp riêng.
