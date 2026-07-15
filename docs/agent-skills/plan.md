# Master plan quản trị agent skill của VocaSpace

## Trạng thái tài liệu

| Trường | Giá trị |
| --- | --- |
| Trạng thái | Partially approved — PR 1 decision bundle đã được owner duyệt; PR 2+, runner và pilot vẫn là proposal |
| Trạng thái phê duyệt | Chỉ các quyết định được liệt kê trong mục `Owner-approved cho PR 1` là authoritative |
| Nhánh tạo bản planning ban đầu | `docs/agent-skill-governance-plan` |
| Base của bản planning ban đầu | `main` và `origin/main` tại `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| Repository HEAD dùng cho baseline discovery | `03ad1c59f08f7b3f26b430614f4b5c93fb6944ef` |
| Lần reconcile gần nhất | 2026-07-15 |
| Quyền thực thi hiện tại | Không do master plan sở hữu; xem owner instruction hiện hành và [progress.md](./progress.md) |
| Nguồn sở hữu trạng thái hiện tại | [progress.md](./progress.md) |

Tài liệu này là authoritative cho decision bundle PR 1 đã được owner phê duyệt rõ ràng. Các phần dành cho PR 2+, runner, pilot, later migration và CI vẫn là planning proposal cho đến khi owner duyệt decision tương ứng.

Việc owner duyệt plan chỉ có nghĩa là duyệt plan, trừ khi cùng instruction đó cũng cho phép implementation hoặc một Git action cụ thể. Quyền tạo hoặc đổi branch, sửa file, commit, push, tạo pull request, merge và deploy tiếp tục tuân theo instruction thực tế của owner và lifecycle của repository.

## Mục tiêu tổng quát

Xây dựng một hệ thống do repository sở hữu để tạo, sửa, kiểm tra, đánh giá và progressive-disclose các agent skill của VocaSpace mà không làm giảm correctness, ownership clarity, permission safety, scope control hoặc verification truthfulness.

Chương trình chỉ coi việc giảm context là thành công khi behavior giữ nguyên hoặc tốt hơn. Mọi regression về safety, permission, routing, correctness hoặc verification đều phủ quyết lợi ích context.

## Vấn đề cần giải quyết — baseline trước PR 1

Mục này ghi historical discovery snapshot tại ngày 2026-07-14, trước khi PR 1 được implement. Nó không mô tả repository hiện tại sau PR 1.

Tại baseline đó, VocaSpace có mười repo-local skill. Các skill này cung cấp nhiều rule quan trọng, nhưng một số file đang chứa chung core policy, permission semantics, procedure chi tiết, matrix, ví dụ và output template trong một `SKILL.md`.

### Danh sách skill đã xác nhận ngày 2026-07-14

| Skill | Số dòng | Nhận xét liên quan |
| --- | ---: | --- |
| `code-commenting-and-maintainability` | 170 | Khá tập trung và ngắn; hiện chưa có evidence để split. |
| `code-review-and-quality` | 463 | Chứa review authority cùng review dimensions, special cases, severity, verdict và output procedure. |
| `frontend-design` | 458 | Chứa product guardrail cùng screen taxonomy, visual guidance và critique procedure; overlap với `frontend-workflow`. |
| `frontend-workflow` | 420 | Điều phối frontend discovery, implementation, test, performance, manual validation và final audit. |
| `git-checkpoint-workflow` | 425 | Chứa permission-sensitive Git rule cùng staging, correction và branch procedure. |
| `github-pr-ci-workflow` | 416 | Chứa remote permission rule cùng PR và CI procedure. |
| `implementation-planning-and-pr-breakdown` | 474 | Sở hữu planning/handoff nhưng cũng chứa template và breakdown procedure dài. |
| `nextjs-server-action-zod` | 533 | Chứa trust-boundary invariant cùng placement, form, schema và test matrix chi tiết. |
| `supabase-safe-migration` | 373 | Ngắn hơn một số skill khác nhưng safety-dense và permission-sensitive. |
| `test-quality-strategy` | 524 | Chứa test ownership/evidence rule cùng taxonomy, matrix, fixture và verification procedure rộng. |

Line count chỉ là tín hiệu. Một skill chỉ là progressive-disclosure candidate khi inspection cho thấy một phần procedure không cần thiết cho nhiều invocation hợp lệ và có thể được route chính xác mà không đẩy mandatory rule khỏi core context.

### Khoảng trống tại baseline trước PR 1

- Chưa có repo-local lifecycle sở hữu việc tạo hoặc thay đổi skill.
- Chưa có deterministic structural validator cho metadata, path và bundled resource.
- Chưa có versioned regression evidence cho old/new skill behavior.
- Chưa formalize sự khác nhau giữa repository routing và native platform trigger.
- Chưa có fresh-reader contract chung cho ownership, approval, status và behavior comprehension.
- Có ownership overlap giữa planning, review, testing, frontend, Git, PR/CI, Next.js/Zod và Supabase workflow.
- Chưa có pilot chứng minh progressive disclosure giảm supplied context mà không làm behavior xấu đi.

## Sự thật baseline đã xác nhận từ repository

Các fact dưới đây được ghi tại baseline discovery ngày 2026-07-14. Những câu về số lượng skill, bundle layout và governance gap là historical evidence, không phải current repository fact sau PR 1.

- `AGENTS.md` sở hữu explicit repository skill routing.
- `docs/agent-loops.md` sở hữu lifecycle routing và stop rule.
- Domain skill cụ thể hơn lifecycle overlay và được ưu tiên khi áp dụng.
- Review mặc định là read-only.
- Plan approval, implementation, commit, push, pull request, merge, deploy và destructive/remote action có permission boundary riêng.
- Tại baseline, cả mười repo-local skill chỉ có một `SKILL.md`; chưa có repo-local `references`, `scripts` hoặc `assets`.
- Custom repository script hiện dùng Node/MJS.
- CI dùng Node.js 20.
- Python có trên máy local không đồng nghĩa repository đã adopt Python; repo không có PyYAML hoặc Python test convention.
- `npx tsc --noEmit --incremental false` đã chạy được và pass trong audit; đây không phải check cần chạy lại cho docs-only branch này.
- System `skill-creator` có trong Codex environment hiện tại, nhưng repository safety không được phụ thuộc vào việc skill đó luôn có ở runtime khác.

## Mục tiêu cụ thể

1. Thêm một portable repo-local skill-governance bundle.
2. Định nghĩa progressive disclosure bằng exact resource read condition.
3. Giữ approval, permission, read-only, Git, production, destructive-action, safety và stop invariant trong core khi applicable.
4. Thêm deterministic structural validation bằng tooling phù hợp repository.
5. Định nghĩa versioned regression, repository-routing và fresh-reader suite.
6. Thêm minimal deterministic runner cho validation, synthetic packaging, provenance, observation template và report aggregation.
7. So sánh explicit baseline/candidate trong điều kiện tương đương.
8. Tạo fresh-context evidence mà không leak expected answer hoặc variant identity cho executor.
9. Áp dụng safety veto trước khi công nhận lợi ích context hoặc clarity.
10. Chứng minh workflow bằng một pilot có phạm vi hẹp trước khi migrate rộng.
11. Giữ mỗi PR coherent, reviewable, reversible và independently verifiable.
12. Giữ owner control đối với approval và rollout decision.

## Ngoài phạm vi foundation

Các hạng mục sau bị loại khỏi foundation và chỉ được xem xét lại khi có evidence:

- Product implementation hoặc product behavior change.
- Migrate toàn bộ repo-local skill.
- Mutation-capable evaluation.
- Model runner hoặc model invocation.
- Semantic grader hoặc automatic winner selection.
- Native-trigger automation.
- HTML eval viewer.
- Automatic description optimizer.
- Automatic subagent swarm.
- Claude CLI hoặc `.claude/commands` integration.
- Python hoặc PyYAML adoption.
- Workspace cleanup command.
- Structural CI.
- `git_context` helper.
- Agent-doc semantic validator.
- Full quantitative benchmark laboratory.
- Database, migration, RLS, RPC, production hoặc deployment change.

Đây không phải permanent rejection. Mỗi hạng mục cần demonstrated consumer, repeated deterministic work hoặc validated failure mode trước khi được đưa vào plan.

## Trạng thái quyết định

### Owner-approved cho PR 1

1. Dùng tên `maintain-repo-skills` cho repository governance skill.
2. Repo-local governance contract là authoritative cho lifecycle, safety, documentation, evaluation boundary, permission invariant và stop condition của việc thay đổi repo-local skill; system/external `skill-creator` chỉ là optional generic guidance.
3. Git procedure tiếp tục thuộc `git-checkpoint-workflow` và `github-pr-ci-workflow`; governance skill không sao chép toàn bộ procedure đó.
4. Core `SKILL.md` giữ mandatory authority, permission, safety, routing và stop invariant; reference chỉ giữ procedure, matrix, template, example hoặc guidance có exact read condition.
5. Durable plan/progress requirement là contract riêng của chương trình này, không phải universal repository-wide plan gate.
6. [plan.md](./plan.md) sở hữu intended scope, dependency và program structure; [progress.md](./progress.md) sở hữu current actual status và verification evidence.
7. Agent-authored skill plan vẫn là draft cho tới khi owner duyệt material decision; plan approval không tự cấp implementation permission, và implementation permission không tự cấp commit, push, pull request, merge hoặc deploy.
8. Review mặc định read-only; governance skill không được tự phê duyệt thay đổi của chính nó; mandatory safety và permission invariant không được chuyển sang optional reference.
9. Chỉ cập nhật source sở hữu thông tin, và historical evidence không được trình bày như current fact.
10. PR 1 không implement validator, eval runner, eval schema, CI hoặc migration existing skill.

### Vẫn proposed hoặc pending cho PR 2+

1. Dùng Node/MJS, target Node.js 20 và ưu tiên standard library cho validator/runner.
2. Dùng VocaSpace frontmatter v1 nghiêm ngặt thay vì general YAML parser.
3. Tách repository routing evaluation khỏi optional native-trigger evaluation.
4. Foundation có minimal synthetic-only runner.
5. Dùng `code-review-and-quality` làm progressive-disclosure pilot đầu tiên.
6. Bắt buộc owner pilot gate trước khi migrate skill tiếp theo.
7. Chỉ cân nhắc structural CI sau khi validator, schema và ít nhất hai migration đã ổn định.

PR 1 approval không tự phê duyệt hoặc cấp implementation permission cho bất kỳ mục PR 2+ nào.

## Mô hình ownership cho repository skill

Bundle hiện tại của approved PR 1 contract:

```text
.agents/skills/maintain-repo-skills/
├── SKILL.md
└── references/
    ├── progressive-disclosure.md
    └── fresh-reader-testing.md
```

`references/eval-design.md` là resource deferred/conditional cho PR sau, chỉ được thêm khi có concrete consumer và exact read condition. Nó không thuộc bundle PR 1 hiện tại.

Ownership split:

```text
maintain-repo-skills
= authoritative VocaSpace contract cho lifecycle, safety, documentation,
  evaluation, evidence, rollout, permission invariant và lifecycle boundary
  áp dụng cho thay đổi repo-local skill

system/external skill-creator
= optional generic skill-authoring methodology khi available
```

`maintain-repo-skills` xác định khi nào thay đổi repository skill được phép tiến tới Git action và ranh giới nào vẫn phải dừng. Nó không lặp lại procedure tạo branch, stage, commit, push, pull request, theo dõi CI hoặc merge. Khi cần thực hiện các procedure đó, agent phải route sang `git-checkpoint-workflow` và `github-pr-ci-workflow` theo phạm vi áp dụng của từng skill.

Repository bundle phải self-contained. Mandatory VocaSpace behavior không được phụ thuộc vào việc system/plugin skill có được cài đặt, trigger hoặc đọc hay không.

Core `SKILL.md` sở hữu mandatory invariant, decision routing và stop condition. Repo-local reference có thể sở hữu procedure, matrix, template, example và questionnaire chi tiết. Core phải nói chính xác khi nào đọc từng reference.

Governance skill không được tự phê duyệt thay đổi của chính nó. Skill, eval hoặc materially revised governance plan do agent viết vẫn là draft cho đến khi owner duyệt phần quyết định đã thay đổi.

## Tài liệu bền vững và bàn giao implementation

Chương trình agent-skill governance gồm nhiều PR phụ thuộc nhau và nhiều session trong tương lai, nên trước broad rollout phải có durable repository source of truth cho intended scope, dependency, decision, current progress, verification evidence và deferred work.

Đây là continuity requirement riêng của chương trình này, không phải repository-wide rule bắt mọi implementation task phải tạo hoặc commit một plan file mới.

Một durable plan đã tồn tại cộng với explicit owner implementation instruction có thể đủ. Một owner-authored implementation brief đầy đủ cũng có thể đủ khi nó xác định rõ approved behavior, decision, scope, exclusion, implementation outcome, verification, known risk và documentation reconciliation cần thiết.

Agent-authored plan hoặc materially revised brief vẫn là draft cho đến khi owner duyệt decision mới hoặc phần đã thay đổi. Phần approved không bị ảnh hưởng chỉ được tiếp tục nếu độc lập, vẫn trong scope và không phụ thuộc vào revision chưa được duyệt.

Cùng một owner instruction có thể vừa duyệt plan vừa cho phép implementation hoặc later Git action nếu quyền đó được nói rõ. Agent không được phát minh thêm approval gate.

Không tạo plan, tracker, problem document, deferred-work file hoặc ADR mới khi một authoritative source đã sở hữu thông tin đó. Chỉ cập nhật đúng source sở hữu thông tin và đúng trạng thái có evidence.

### Phân loại implementation brief

#### Owner-authored implementation brief

Có thể authoritative cho scope và action được mô tả khi đủ rõ, đầy đủ, nhất quán với repository evidence và explicit về action được cho phép. Nó không tự cấp later Git hoặc remote permission không được nêu.

#### Agent-authored draft

Luôn là proposal cho đến khi owner duyệt. Agent không được dùng draft do mình viết để tự cấp implementation permission.

#### Materially revised brief

Nếu agent thay đổi business decision, architecture, scope, permission, acceptance criterion hoặc verification guarantee, phần thay đổi trở lại draft. Phần approved không bị ảnh hưởng chỉ được tiếp tục khi độc lập và không dựa vào revision chưa giải quyết.

## Ownership thông tin giữa các tài liệu

Information ownership không bắt buộc mỗi category phải có một file riêng.

| Thông tin | Source sở hữu |
| --- | --- |
| Intended scope, dependency, phase và completion criterion | Plan |
| Current actual status và verification evidence | Progress tracker |
| Active/resolved defect hoặc limitation | Problem tracker phù hợp, khi tồn tại |
| Valid work ngoài current scope | Deferred/future-work owner, khi cần |
| Durable architecture/business decision và rationale | ADR, khi đáng tạo |
| Contract cho execution hiện tại | Approved implementation brief |

Rules:

- Chỉ một source sở hữu current program status.
- ADR không sở hữu implementation status.
- Plan không trình bày intended work như completed work.
- Progress phân biệt `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged` theo evidence thực tế.
- Resolved finding không tiếp tục được trình bày như current blocker.
- Không tạo taxonomy file rỗng để dự phòng.
- Chỉ cập nhật tài liệu sở hữu thông tin đã thay đổi.
- Historical evidence phải có label và không được tự động coi là current fact.

Trong chương trình này, [plan.md](./plan.md) sở hữu intended scope cùng decision status đã được label là approved hoặc proposed; [progress.md](./progress.md) sở hữu current status và execution evidence.

## Contract progressive disclosure

Core giữ các nội dung sau khi applicable:

- Activation và ownership.
- Core invariant.
- Approval và permission boundary.
- Read-only boundary.
- Commit, push, pull request, merge, production và destructive boundary.
- Safety veto.
- Stop condition.
- Related-skill routing.
- Resource-routing rule.
- Output contract.

Reference có thể giữ:

- Procedure chi tiết.
- Matrix và checklist.
- Template.
- Example dài.
- Special case.
- Questionnaire.
- Eval-writing guidance.

Không bắt mọi skill phải có mọi section khi concept không áp dụng. Không split chỉ vì line count. Một reference phải đại diện cho nội dung không cần thiết trong một nhóm invocation hợp lệ có ý nghĩa.

Mọi bundled reference phải có standardized `Resource routing` entry trong core với valid relative path, non-empty read condition, không escape skill directory và không tạo nested reference chain không cần thiết.

Validator chỉ kiểm tra mechanical structure của entry. Human hoặc agent evaluation mới đánh giá read condition có đúng semantic hay không.

Regression về safety, permission, routing, correctness hoặc verification luôn phủ quyết context improvement.

## Contract runtime và frontmatter

Foundation dùng:

```text
Node/MJS
Node.js 20 compatibility target
standard library first
node:test
node:assert/strict
```

Script đề xuất:

```text
.agents/scripts/validate-skill.mjs
.agents/scripts/run-skill-evals.mjs
```

VocaSpace repository frontmatter v1 hỗ trợ:

```text
name:
- chỉ unquoted kebab-case

description:
- supported unquoted safe scalar; hoặc
- JSON-compatible double-quoted string được parse bằng JSON.parse
```

V1 không hỗ trợ single-quoted YAML, multiline scalar, anchor, inline comment, general YAML semantics hoặc arbitrary YAML escape.

Syntax hoặc field ngoài contract phải được báo là unsupported by VocaSpace frontmatter v1, không được gọi chung là invalid YAML. Validator chỉ áp dụng cho `.agents/skills`, không áp schema này cho system/plugin skill.

## Phạm vi quyền hạn của structural validator

Validator chỉ kiểm tra deterministic fact.

### Lỗi phải fail

- Thiếu `SKILL.md`.
- Không parse được supported frontmatter.
- Thiếu `name` hoặc `description`.
- Name không phải kebab-case.
- Folder name và metadata name không khớp.
- Trùng repo-local name.
- Referenced resource không tồn tại.
- Relative path escape skill directory.
- Encoding không phải UTF-8 hợp lệ.
- Thiếu final newline.
- Standardized `Resource routing` entry thiếu path hoặc non-empty condition.
- Explicit repo-skill path trong `AGENTS.md` trỏ tới skill không tồn tại.

### Cảnh báo

- Repo-local skill không được `AGENTS.md` reference trực tiếp.
- Bundled resource không xuất hiện trong standardized resource routing.
- Core vượt initial non-blocking length signal.
- Supported nhưng unusual structural state cần human review.

Initial length signal có thể là 500 dòng nhưng không phải quality gate và phải được điều chỉnh theo repository evidence.

### Ngoài quyền hạn của validator

Validator không phán duplicated/conflicting meaning, business semantics của condition, skill có nên trigger hay không, plan/status có đúng nội dung không, system/plugin skill nào authoritative hoặc skill change có cải thiện agent behavior không.

Filesystem access hoặc operational failure có structured result và exit code riêng, không được gọi là invalid skill.

## Kiến trúc eval

Foundation suite:

```text
regression
routing
fresh-reader
```

Optional later suite:

```text
native-trigger
```

Repository routing evaluation trả lời:

```text
prompt
+ AGENTS.md routing
+ repo-local metadata
+ competing repo skill
→ cần đọc repo skill nào?
```

Native-trigger evaluation kiểm tra một platform/model cụ thể có tự chọn skill từ runtime-exposed inventory hay không. Đây là behavior nondeterministic, platform-specific và nằm ngoài foundation. Raw plugin cache không phải active-skill inventory authoritative.

Schema version nằm ở suite level:

```json
{
  "schema_version": 1,
  "skill": "code-review-and-quality",
  "suite": "regression",
  "cases": []
}
```

Case count dựa trên protected invariant và diagnostic value, không dựa trên hard cap tùy ý.

Fresh-reader dùng một schema với ba mode:

```text
documentation-comprehension
skill-comprehension
behavior-execution
```

Fresh-reader testing là bắt buộc khi change ảnh hưởng material tới ownership, approval, permission, resource routing, source-of-truth hierarchy, durable handoff hoặc lifecycle/status interpretation. Typo và formatting-only change không cần test này.

### Bằng chứng trước và sau PR 3

Trước khi PR 3 merge, thay đổi governance có ảnh hưởng material vẫn phải được kiểm tra bằng một lightweight manual fresh-reader check. Check này dùng bounded prompt, tập context được cung cấp rõ ràng và observation được ghi lại; fresh reader không nhận toàn bộ authoring-session context. PR 1 và PR 2 có thể ghi manual verification và fresh-reader observation vào program progress source với label `manual` cùng trạng thái `passed`, `partially passed`, `failed` hoặc `not_run` kèm lý do.

PR 3 chuẩn hóa versioned suite schema, packaging, provenance, A/B package và reporting. Nó không phải prerequisite để chạy mọi manual comprehension check trước đó.

Bằng chứng manual trước PR 3 không được mô tả hồi tố là runner-produced, strictly isolated, baseline-equivalent, formal A/B comparison hoặc versioned-suite pass. Nếu executor vẫn có unrestricted host filesystem access, observation cũng không được gắn nhãn isolated chỉ vì context đã được giới hạn bằng instruction.

## Runner tối thiểu trong foundation

Foundation runner có ba command:

```text
validate
prepare --isolation synthetic
report
```

Runner là deterministic tool chủ yếu do agent chạy. Nó tự động hóa suite validation, explicit baseline resolution, skill-bundle copying, canonical manifest/hash, A/B packaging, observation template, incomplete-evidence detection và deterministic report aggregation.

Runner không execute prompt, invoke model, spawn subagent, grade semantic correctness, select winner, chạy native-trigger automation, clean/delete workspace, fetch, checkout, tạo worktree, update ref, stage, commit, push, tạo pull request, merge hoặc deploy.

`--baseline-ref` là bắt buộc khi muốn claim comparative improvement. `--no-baseline` chỉ tạo candidate-only evidence và không được tạo result `improved`.

Observation của từng variant và human-authored comparison verdict là hai artifact riêng. Missing observation làm report incomplete và không bao giờ tự trở thành pass.

Git subprocess chỉ dùng fixed read-only argv qua non-shell execution; runner không nhận arbitrary shell string.

Exit-code category đề xuất:

```text
0 = operation hoàn tất và structurally valid
1 = suite/evidence invalid hoặc incomplete
2 = CLI usage invalid hoặc unsupported schema
3 = safety, path, baseline, workspace hoặc operational refusal
```

## Eval workspace và ranh giới sandbox

```text
outside repository ≠ executor sandbox
```

Foundation v1 chỉ hỗ trợ synthetic evaluation.

Runner được tạo bounded artifact gồm workspace metadata, baseline/candidate bundle copy, case/context package, execution policy, observation template và report.

Default transient workspace root phải cố định bên dưới operating-system temporary directory. Runner v1 không nhận arbitrary output path, không overwrite existing workspace, không có cleanup command, không follow symlink hoặc Windows junction/reparse point và không write ngoài workspace.

Synthetic read-only evaluation có thể dùng transient workspace do runner chuẩn bị. Foundation v1 không hỗ trợ mutation-capable evaluation.

Runner chuẩn bị allowlisted synthetic context package. Fresh-context evidence chỉ được coi là isolated khi executor environment giới hạn tool/filesystem access vào package đó hoặc disable file tool. Runner không được claim rằng packaging một allowlist đồng nghĩa đã enforce filesystem isolation.

Mutation-capable evaluation trong tương lai chỉ được chạy trong environment-enforced disposable sandbox, với writable filesystem giới hạn vào eval workspace, source repository và host filesystem không được mount writable, credential không được cung cấp, network/remote action disabled mặc định.

Operating-system temp directory, đổi working directory, copy tree không có `.git` hoặc instruction yêu cầu executor chỉ làm trong workspace không tạo ra isolation này.

Nếu required enforcement không có, case phải được ghi `not_run`. Owner approval không thể biến unsafe host execution thành valid eval evidence.

Các restriction này chỉ áp dụng cho evaluation evidence, không cấm ordinary owner-authorized repository implementation theo lifecycle và permission rule bình thường của repo.

Runner chỉ enforce path, file-write, Git và artifact boundary của chính runner. Nó phải record actual executor filesystem/tool/network/remote enforcement, không được report requested policy như enforced policy.

## Điều kiện thực thi tương đương và fresh context

Baseline/candidate comparison cần cùng relevant prompt, supplied context, fixture, platform/model family, effort/reasoning setting, tool cần cho case, isolation mode, network/remote policy, evaluation criteria và fresh-context method.

Known variance phải được record. Unknown non-material metadata làm giảm confidence; variance có khả năng ảnh hưởng outcome làm comparison `inconclusive`.

Fresh context có thể là independent session mới, separate isolated invocation hoặc fresh chat chỉ được cấp approved case material. Executor không nhận expected answer, forbidden behavior, author conclusion, output của variant kia hoặc old/new mapping.

Blind A/B là optional cho lightweight objective case và được khuyến nghị cho judgment-heavy comparison.

## Nguồn gốc dữ liệu và cách đo lường

Phân biệt:

```text
full_skill_bundle_hash
execution_context_hash
routing_bundle_hash
```

Full bundle gồm mọi regular file trong skill directory, kể cả future metadata. Canonical manifest normalize relative path sang `/`, sort lexicographically, hash raw bytes và không silently follow symlink/reparse point.

Execution-context manifest ghi chính xác file thực sự được cấp cho case. Routing bundle ghi relevant `AGENTS.md` routing, target/competing metadata, prompt và external inventory provenance khi dùng.

Report gồm full bundle lines/bytes, core lines/bytes, reference thực sự được cấp, execution-context files/bytes, optional actual token usage khi runtime expose, behavior result và safety outcome.

Không gọi line/byte reduction là token saving.

Case status:

```text
passed
partially_passed
failed
not_run
```

Comparison status:

```text
improved
equivalent
regressed
inconclusive
```

Known safety regression luôn phủ quyết context improvement.

## Pilot `code-review-and-quality`

`code-review-and-quality` là pilot đề xuất vì skill này procedure-heavy, có ownership/permission boundary rõ, dễ tạo realistic routing/regression case và ít operational risk hơn việc bắt đầu bằng database hoặc remote Git workflow.

Protected invariant cluster tối thiểu:

- Review mặc định read-only.
- Fix cần explicit authorization.
- Review finding không tự cấp implementation permission.
- Approval không cấp push hoặc merge permission.
- Stale evidence phải revalidate.
- Required manual QA giới hạn verdict.
- Unrelated baseline issue nằm ngoài current scope.
- Relevant competing domain skill được route đúng.
- Trivial/near-miss task không load workflow không cần thiết.

Số case phải đủ phủ các cluster và chẩn đoán failure, không ép vào một con số tùy ý.

Migration sequence:

```text
inspect ownership và safety core
→ capture baseline provenance
→ define regression, routing và fresh-reader case
→ refactor core/reference
→ validate structure
→ execute equivalent fresh-context A/B case
→ apply safety veto
→ report behavior/context trade-off
→ owner gate
```

Owner gate có ba outcome:

```text
continue rollout
revise infrastructure
stop rollout
```

Không broad-migrate trước gate này.

## Đồ thị phụ thuộc

```text
Owner đã duyệt PR 1 governance decision bundle
  → PR 1 governance contract
    → PR 2 structural validator
      → PR 3 eval schema và minimal synthetic runner
        → PR 4 code-review pilot
          → owner pilot gate
            → evidence-based later migration
              → optional structural CI sau khi đủ stability evidence
```

Các PR chạy tuần tự khi shared contract còn thay đổi. Later migration chỉ được parallel khi dependency, file, ownership, eval contract và integration order độc lập.

## Thứ tự PR đề xuất

### PR 1 — Governance contract

**Mục tiêu và outcome quan sát được:** thêm portable repository contract cho việc thay đổi repo-local skill mà không phụ thuộc external skill availability.

**Phụ thuộc:** đã được đáp ứng cho scope PR 1 — owner đã duyệt PR 1 decision bundle. Trạng thái implementation/delivery thực tế thuộc [progress.md](./progress.md), không thuộc master plan.

**Trong scope:** thêm `maintain-repo-skills` core, thêm đúng repo-local reference cần cho approved contract, thêm targeted `AGENTS.md` routing và thiết lập durable documentation/handoff rule.

**Ngoài scope:** validator, eval schema, runner, migration, CI, product code, remote action và refactor existing skill.

**Expected domain:** `.agents/skills/maintain-repo-skills/**`, `AGENTS.md` và hai program doc khi thông tin do chúng sở hữu thay đổi.

**Implementation approach:** giữ mandatory safety/authority trong core, route procedure bằng exact condition và bảo toàn lifecycle/domain-skill precedence hiện có.

**Acceptance criteria:** governance bundle dùng được khi system `skill-creator` không có; không collision repo-local name; approval/implementation/Git/remote/production/destructive boundary rõ; không tạo universal plan gate; ownership và stop condition không mơ hồ; progress ghi đúng status/evidence.

**Verification:** kiểm tra Markdown/link/frontmatter, targeted routing inspection, `git diff --check` và lightweight manual fresh-reader check với bounded prompt, explicit supplied context và recorded observation. Vì PR 3 chưa tồn tại, evidence này phải được label là manual và không được claim là runner-produced hoặc baseline-equivalent.

**Completion:** implementation review không còn blocking finding, required evidence được record và owner vẫn kiểm soát commit/later action.

### PR 2 — Structural validator

**Mục tiêu và outcome quan sát được:** phát hiện invalid local skill structure một cách deterministic mà không đưa ra semantic claim.

**Phụ thuộc:** PR 1 đã merge và frontmatter/resource-routing contract ổn định.

**Trong scope:** thêm `validate-skill.mjs`, Node `node:test` fixtures/tests, stable structured output/exit code và chỉ validate `.agents/skills` cùng explicit repo routing path.

**Ngoài scope:** semantic duplication, trigger quality, model execution, eval runner, auto-fix, application test và CI enforcement.

**Acceptance criteria:** valid current skill pass approved contract hoặc approved warning được baseline rõ; invalid name/path/resource/encoding/newline/explicit missing route có test; path traversal và symlink/junction/reparse-point fixture bị reject khi environment hỗ trợ; Node.js 20 compatibility được verify hoặc ghi đúng là chưa chạy; validator không report semantic truth.

**Verification:** focused Node tests, CLI `--help`, valid/invalid fixture, Windows path case và `git diff --check`. Manual verification và fresh-reader observation nếu contract comprehension thay đổi được ghi vào program progress source; chúng chưa phải formal PR 3 artifact.

**Completion:** deterministic contract/tests ổn định local; PR này chưa thêm CI.

### PR 3 — Eval schema và minimal synthetic runner

**Mục tiêu và outcome quan sát được:** chuẩn hóa reproducible synthetic old/new evidence mà không invoke hoặc grade model; PR này nâng manual pre-PR-3 practice thành versioned packaging/provenance/reporting contract nhưng không hồi tố nâng cấp evidence cũ.

**Phụ thuộc:** PR 2 đã merge; owner duyệt schema, status, isolation và evidence-retention decision bundle.

**Trong scope:** thêm versioned regression/routing/fresh-reader schema; thêm `run-skill-evals.mjs` với `validate`, synthetic `prepare`, `report`; tạo canonical bundle/context/routing manifest/hash; tạo A/B package, observation template, human-comparison template; enforce runner-owned workspace/Git boundary.

**Ngoài scope:** mutation-capable execution, model call, semantic grading, native trigger, cleanup, arbitrary output path, HTML, CI và benchmark.

**Acceptance criteria:** `validate --skill` và `validate --all` dùng một schema contract; comparative work cần explicit resolvable baseline; candidate-only work không report `improved`; missing/non-equivalent evidence là incomplete/inconclusive; runner write chỉ trong fixed transient workspace; runner không claim sandbox executor; không có destructive/remote Git command; observation/comparison tách artifact.

**Verification:** Node tests cho schema, collision, path traversal, baseline refusal, missing observation, report status, fixed Git argv allowlist, Windows path handling và `git diff --check`.

**Completion:** deterministic packaging/reporting hoạt động không cần model; unsupported isolation bị refuse hoặc ghi `not_run`.

### PR 4 — Pilot `code-review-and-quality`

**Mục tiêu và outcome quan sát được:** chứng minh một real skill có thể conditional-disclose procedure mà vẫn giữ review authority, permission safety, routing và verdict truthfulness.

**Phụ thuộc:** PR 3 đã merge; owner duyệt pilot case và gate criteria.

**Trong scope:** capture baseline/routing provenance; định nghĩa invariant-driven regression/routing/fresh-reader case; chỉ split procedure có evidence; chạy synthetic fresh-context A/B khi valid isolation có sẵn; report context/behavior/safety/inconclusive evidence; cập nhật program progress.

**Ngoài scope:** migrate skill khác, mutation eval, CI, auto-grading, product code và remote Git permission change.

**Acceptance criteria:** mọi safety/authority invariant vẫn trong core; reference có precise mechanical route và valid path; old/new execution equivalent hoặc marked inconclusive; forbidden behavior không regress; context improvement đo từ actual supplied manifest; owner nhận continue/revise/stop gate có evidence.

**Verification:** structural validator, runner validation/report, manual fresh-reader review, invariant-by-invariant comparison và `git diff --check`.

**Completion:** owner chọn continue, revise hoặc stop; không later migration nào tự động bắt đầu.

## Các skill cân nhắc sau pilot

Nếu owner chọn continue, reassess theo pilot evidence:

1. `implementation-planning-and-pr-breakdown`.
2. `test-quality-strategy`.
3. Reconcile ownership giữa `frontend-workflow` và `frontend-design`.
4. `nextjs-server-action-zod`.
5. `supabase-safe-migration`.
6. `git-checkpoint-workflow`.
7. `github-pr-ci-workflow`.

`code-commenting-and-maintainability` giữ nguyên nếu không có evidence mới. Supabase và Git skill nằm cuối vì permission-sensitive.

## Chiến lược CI

CI ở đây là deterministic GitHub Actions check, không phải model eval.

Chỉ cân nhắc CI sau khi pilot pass, ít nhất hai migration ổn định và validator/schema không còn material churn.

Potential CI gồm validate repo-local skill, validate committed eval suite, chạy Node agent-tooling test và kiểm tra mechanical reference/encoding/final newline.

CI không invoke model/subagent, chạy semantic fresh-reader/native-trigger eval, yêu cầu secret, chạy browser/Supabase/integration/E2E chỉ vì agent docs thay đổi, auto-fix, auto-optimize description hoặc duplicate/rename existing `production-gate`.

Required-check và path-filter behavior phải được review để skipped workflow không làm expected check pending.

## Giấy phép và ghi nhận nguồn

Phải phân biệt `inspired by`, `adapted from` và `copied from`.

Node/MJS tooling nên được viết theo VocaSpace convention. Nếu chỉ học generic methodology từ Anthropic `skill-creator`, có thể ghi inspired by và không được mô tả như direct code port.

Nếu adapt/copy code hoặc substantial text, phải kiểm tra license đúng source file/directory, giữ Apache 2.0 notice cần thiết, mark modification và record file nào inspired/adapted/copied. Không giả định toàn bộ external repository có cùng license.

## Quy tắc lưu trữ và evidence

Committed source dự kiến:

```text
.agents/evals/<skill>/regression.json
.agents/evals/<skill>/routing.json
.agents/evals/<skill>/fresh-reader.json
optional concise evidence summary cho major migration hoặc owner gate
```

Transient source dự kiến:

```text
runner workspace dưới fixed operating-system temporary root
baseline/candidate copy
raw observation
generated report
raw executor transcript nếu sau này được cho phép riêng
```

Không commit secret, environment dump, personal absolute path, duplicated full skill snapshot, large transcript hoặc disposable workspace.

Mọi committed schema có version. Evidence retention phải được duyệt trước PR 3. Foundation v1 không có cleanup command.

## Rủi ro và cách giảm thiểu

| Risk | Tác động | Mitigation và điểm phát hiện sớm nhất |
| --- | --- | --- |
| Draft wording ngụ ý permission | Unauthorized implementation hoặc Git action | Explicit status/authority wording và fresh-reader case; PR 1 |
| Core safety bị chuyển sang optional reference | Permission/destructive regression | Mandatory core inventory và safety veto; PR 1/pilot |
| Validator làm semantic judgment | False mechanical authority | Explicit authority boundary và tests; PR 2 |
| Frontmatter subset biến thành YAML parser | Complexity/compatibility defect | Strict v1 grammar; PR 2 |
| Runner biến thành hidden model workflow | Quota, nondeterminism, permission expansion | Synthetic-only `validate/prepare/report`; PR 3 |
| Baseline/candidate không equivalent | Invalid improvement claim | Provenance manifest và `inconclusive`; PR 3 |
| Requested policy bị report như enforced | False safety evidence | Record actual enforcement source; PR 3 |
| Allowlisted package bị hiểu là sandbox | Host/repo access vẫn có thể xảy ra | Explicit sandbox boundary và `not_run`; PR 3 |
| Context giảm nhưng behavior giảm | Unsafe rollout | Safety veto và invariant-driven pilot; PR 4 |
| Current status bị duplicate | Future agent dùng stale state | Plan/progress ownership; mọi PR |
| Pilot lan thành broad migration | Khó rollback, evidence trộn lẫn | One-skill pilot và owner gate; PR 4 |
| External methodology bị copy thiếu review | License/attribution risk | Per-file provenance và license check |

## Điều kiện phải dừng

Stop và report khi:

- Unresolved business, architecture, ownership hoặc permission decision ảnh hưởng scope.
- Repository state không còn khớp approved brief.
- Không xác định được required branch base hoặc dependency.
- Không resolve được explicit baseline.
- Không establish được equivalent execution.
- Case cần isolation/tool enforcement không available.
- Evidence incomplete hoặc stale.
- Material agent-authored revision chưa được owner duyệt.
- Change mở rộng foundation non-goals.
- Phát hiện safety regression.
- Công việc cần commit, push, PR, merge, deployment, remote, production hoặc destructive permission chưa có trong owner instruction.

## Chiến lược rollback

- Mỗi PR chỉ có một coherent outcome.
- Không migrate nhiều skill trong một PR.
- Giữ explicit baseline provenance cho từng migration.
- Có thể revert failed migration độc lập mà không loại bỏ unrelated foundation.
- Nếu pilot fail, chọn bounded infrastructure revision hoặc stop rollout; không làm yếu safety case để đạt pass.
- Không commit raw transient artifact.
- Correction work theo checkpoint/review workflow và mặc định không rewrite history.

## Tài liệu và theo dõi tiến độ

[progress.md](./progress.md) là current-status source duy nhất của chương trình. Cập nhật tại planning reconciliation, owner decision, implementation checkpoint của mỗi PR, verification/manual-eval completion, commit/push/PR-open/merge event khi thực sự xảy ra, pilot gate và material scope change.

Historical evidence phải có label. Không copy master plan vào progress. Không ghi future branch hoặc PR như đang tồn tại. Chỉ tạo problem tracker, deferred-work doc hoặc ADR khi có concrete item cần ownership riêng.

## Trạng thái các nhóm quyết định

### Đã được owner duyệt cho PR 1

- Governance skill name và ownership split.
- Durable documentation arrangement của chương trình.
- Approval, implementation-handoff và permission semantics của governance contract.
- Core/reference boundary và Git-skill routing.
- PR 1 scope exclusion cho validator, runner, eval schema, CI và existing-skill migration.

### Vẫn cần owner duyệt trước PR 2 hoặc PR 3

- Node/MJS tooling contract và frontmatter v1 trước khi implement validator.
- Repository-routing/native-trigger eval boundary, suite/status schema và runner contract trước khi implement eval tooling.
- PR sequence sau PR 1 nếu repository evidence hoặc dependency thay đổi materially.

### Trước PR 3

- Suite/status schema.
- Synthetic-only runner contract.
- Observation/comparison separation.
- Transient/committed evidence retention.
- Isolation và enforcement vocabulary.

### Trước pilot

- Pilot skill.
- Protected invariant set và cases.
- Khi nào cần blind A/B.
- Evidence và criteria cho continue/revise/stop.

Technical safety invariant không phải owner preference và không được hỏi lại như một unsafe option. Path containment, no-overwrite, refusal khi isolation unsupported, credential exclusion, fixed read-only Git command và không có destructive cleanup là trách nhiệm của tooling.

## Tiêu chí hoàn tất

Foundation program chỉ hoàn tất khi:

- Owner-approved repo governance portable và self-contained.
- Repo-local skill có activation và ownership rõ.
- Core/reference boundary được hỗ trợ bằng eval evidence.
- Mandatory permission/safety rule luôn có trong required context.
- Deterministic validator/schema được implement và test.
- Synthetic runner bounded và report đúng sự thật.
- Repository routing case có near miss và competing skill.
- Material handoff/authority change có fresh-reader evidence.
- Code-review pilot có old/new comparison và owner gate decision.
- Không có known regression về read-only review, implementation approval, commit, push, PR, merge, production, destructive hoặc verification semantics.
- Context hoặc clarity cải thiện mà correctness/safety không giảm.
- Later migration, CI hoặc runner expansion chỉ bắt đầu sau khi prerequisite và owner decision được đáp ứng.

Việc owner duyệt plan không tự đánh dấu bất kỳ implementation criterion nào là hoàn tất.
