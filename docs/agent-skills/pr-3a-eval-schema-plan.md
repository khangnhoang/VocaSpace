# Kế hoạch PR 3A — Eval suite schema và deterministic validation

## 1. Trạng thái và thẩm quyền

| Trường | Giá trị |
| --- | --- |
| Material decision status | Owner-approved qua final PR 3A implementation brief ngày 2026-07-16 |
| Execution status | Implemented và targeted-verified local; three Required review findings corrected; self-review còn 0 Critical, 0 Required |
| Git delivery status | Implementation commit `7860383ee3128479feda84a6fe8115bfd9ad60c6` đã push lên `origin/feat/agent-skill-governance-pr3a`; follow-up correction committed local nhưng chưa push; PR open: no; merged: no |
| Branch | `feat/agent-skill-governance-pr3a` |
| Base | synchronized `main == origin/main` tại `37599ee600656e3fb519ef4fd14452c404c4e80d` |
| Dependency | PR 2 đã merge qua PR #53 tại base trên |
| Completion boundary | PR 3A là foundation slice đầu; PR 3 chỉ complete sau PR 3B merge |

Dependency được duyệt:

```text
PR 2 → PR 3A → PR 3B → future consumer discovery
```

Owner instruction hiện tại cho phép implementation, local correction và targeted verification của PR 3A. Nó không cho phép stage, commit, amend, push, pull request, merge, deploy, PR 3B, real suite hoặc skill creation/migration.

## 2. Outcome và scope được duyệt

PR 3A tạo một contract versioned cho `regression`, `routing` và `fresh-reader`, một CLI read-only để validate contract đó, black-box `node:test` coverage, reference thiết kế eval có exact read condition, và documentation reconciliation.

PR 3A không phải complete eval infrastructure, không execute hoặc grade agent, và không mở khóa consumer pilot. Future suite data chỉ được đặt tại:

```text
.agents/evals/<skill>/
├── regression.json
├── routing.json
└── fresh-reader.json
```

PR này không tạo `.agents/evals` hoặc real suite data.

## 3. File ownership

```text
.agents/scripts/
├── run-skill-evals.mjs
├── run-skill-evals.test.mjs
└── lib/skill-evals/
    └── suite-schema-v1.mjs

.agents/skills/maintain-repo-skills/
├── SKILL.md
└── references/eval-design.md

docs/agent-skills/
├── plan.md
├── progress.md
├── pr-2-structural-validator-plan.md
└── pr-3a-eval-schema-plan.md
```

Executable schema/tooling thuộc `.agents/scripts`; committed suite definitions của future consumer mới thuộc `.agents/evals`. Không có speculative helper khác.

## 4. Technical contract

### Runtime

```text
Node/MJS
Node.js 20 compatibility target
standard library first
node:test
node:assert/strict
```

Không thêm dependency, general JSON Schema engine, package script, Vitest routing hoặc CI change. CLI dùng current working directory làm repository root; không có `--root`, `--output` hoặc `--schema-path`.

### Suite discovery

Một skill configured khi `.agents/evals/<skill>` tồn tại. Configured directory phải chứa chính xác ba regular JSON files nêu trên, không extra entry, và `.agents/skills/<skill>/SKILL.md` phải tồn tại. Filename, directory, `skill` và `suite` identity phải khớp.

Skill tồn tại nhưng chưa configured trả `not_configured`, exit `0`. `validate --all` với zero configured suite trả `valid`, `configured_skills: 0`, exit `0`; nonexistent skill là `invalid`, exit `1`.

### Suite schema v1

Mọi suite là standalone JSON artifact:

```json
{
  "schema_version": 1,
  "artifact_type": "suite_definition",
  "skill": "example-skill",
  "suite": "regression",
  "description": "Non-empty suite description.",
  "cases": []
}
```

`cases` là array và có thể empty; schema không áp minimum hoặc maximum tùy ý. Khi có case, common case tách `executor_input`, `evaluator_only` và `suite_config`; unknown field ở mọi level bị reject. Identity dùng kebab-case; case, context, criterion và safety-veto ID unique trong owning collection. File phải valid UTF-8 và có final newline.

Repository context hỗ trợ `repository_file` với normalized repo-relative `/` path và `inline_text` với content nguyên văn. Repository path không được absolute, drive-qualified, UNC, glob, backslash, control character, empty segment, `.` hoặc `..`; target phải là regular file và không đi qua symbolic link, junction hoặc detectable reparse point.

Suite-specific fields:

- regression: kebab-case `behavior_area`; `protected_invariants` non-empty, unique;
- routing: `routing_mode: repository`; unique non-empty `candidate_skills`; expected/forbidden routes nằm trong `evaluator_only`; `expected_routes` có thể empty để biểu diễn không route repo-local skill nào; `native-trigger` bị reject;
- fresh-reader: mode là `documentation-comprehension`, `skill-comprehension` hoặc `behavior-execution`, cùng `independence_required: true`.

Execution policy chỉ biểu diễn requested policy:

```text
packaging_mode: synthetic
fresh_context_required: boolean
variant_identity: visible | blind
filesystem: none | package_read_only
tools: none | allowlisted
network: disabled
credentials: excluded
remote: disabled
mutation: none
```

`allowed_tools` phải empty khi `tools: none` và non-empty khi `tools: allowlisted`. PR 3A không tuyên bố enforcement hoặc isolation evidence.

### CLI

Public surface chỉ gồm:

```text
node .agents/scripts/run-skill-evals.mjs --help
node .agents/scripts/run-skill-evals.mjs validate --skill <skill>
node .agents/scripts/run-skill-evals.mjs validate --all
```

Không có stub `prepare` hoặc `report`. Mọi `validation_result`, gồm `operational_error`, dùng chung envelope có `schema_version`, `artifact_type`, command/scope, top-level status, deterministic summary và sorted normalized diagnostics. Status/exit contract:

| Status | Exit | Nghĩa |
| --- | ---: | --- |
| `valid` | 0 | Configured scope hợp lệ, gồm zero-suite foundation state |
| `not_configured` | 0 | Skill tồn tại nhưng chưa có eval directory |
| `invalid` | 1 | Suite set hoặc schema v1 không hợp lệ |
| `unsupported_schema` | 2 | Integer schema version chưa được hỗ trợ |
| usage error | 2 | Command/argument ngoài public surface |
| `operational_error` | 3 | Read/path-safety refusal hoặc repository state không đọc an toàn được |

Diagnostic không chứa absolute machine path. Validation không sửa source repository.

## 5. Mandatory safety invariants

Các invariant sau là trách nhiệm tooling, không cần owner chọn lại:

- strict allowlist cho command, flag, JSON field và literal;
- containment và normalized relative path;
- no symlink/junction/reparse following;
- repository context phải là regular file;
- deterministic ordering và no absolute path leakage;
- fail loud bằng exit/status riêng cho unsupported version và operational refusal;
- không dependency, Git subprocess, model/subagent execution, semantic grading, candidate correction hoặc repository mutation;
- executor-visible input và evaluator-only answer/rubric không trộn namespace;
- mandatory permission, safety, owner authority và stop invariant tiếp tục ở core governance skill.

## 6. Test matrix

Black-box CLI tests spawn `process.execPath` với `shell: false`, deterministic temporary repositories và assert observable exit code/JSON output. Matrix gồm:

- help và usage refusal cho deferred/unknown command hoặc flag;
- zero configured suites, existing unconfigured skill, nonexistent skill;
- complete trio, partial trio, extra entry, missing corresponding skill;
- invalid UTF-8, invalid JSON, missing final newline;
- strict unknown/missing fields và suite/directory/file identity mismatch;
- unsupported schema version;
- duplicate case/context/criterion/veto IDs;
- regression/routing/fresh-reader suite-specific validation, gồm native-trigger refusal và no-route near-miss case với `expected_routes: []`;
- requested policy literal/access validation;
- POSIX absolute, Windows drive, UNC, backslash, glob, dot/dot-dot, missing file và non-regular context path;
- symlink/junction refusal khi OS cho phép fixture;
- deterministic diagnostic ordering và no absolute fixture path leakage.

Fixture cleanup thuộc test lifecycle; nó không phải runner cleanup command.

## 7. Deferred PR 3B work

PR 3B sở hữu `prepare --isolation synthetic`, provenance SHA-256, baseline/candidate resolution, fixed OS-temp workspace, manifests, observation/human-evaluation templates và deterministic `report`. Artifact types reserved cho PR 3B:

```text
workspace_manifest
bundle_manifest
execution_context_manifest
baseline_observation
candidate_observation
human_evaluation
generated_report
```

PR 3A không implement detailed schemas cho chúng, không dùng Git subprocess, không tạo temp evaluation workspace, không package bundle, không execute model/reviewer và không tạo comparison verdict.

## 8. Verification và acceptance criteria

Required commands:

```text
node --version
node --check .agents/scripts/lib/skill-evals/suite-schema-v1.mjs
node --check .agents/scripts/run-skill-evals.mjs
node --check .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/run-skill-evals.mjs --help
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/run-skill-evals.mjs validate --skill maintain-repo-skills
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs
git diff --check
```

Acceptance cần toàn bộ syntax/targeted tests/current-repository invocations pass, strict schema và exit contract có fixture evidence, structural validator regression vẫn pass, diff không leak PR 3B/real suite/skill migration/CI/package change, và documentation phản ánh đúng actual state. Node.js 20 compatibility chỉ được claim nếu command thực chạy trên major 20.

Current CI không gọi dedicated PR 3A tests vì PR này không sửa CI. Local command trên là verification source; broader CI routing cần owner decision sau khi foundation và consumer evidence ổn định.

Fresh-reader cần separate executor authorization. Khi không có authorization đó:

```text
fresh-reader: not_run
reason: no separate executor authorization
```

Main-agent self-review không thay thế fresh-reader evidence và không được gọi là isolated, runner-produced hoặc formal versioned-suite evidence.

## 9. Stop conditions và unresolved work

Dừng nếu cần dependency, CI/Vitest change, Git subprocess, temp workspace, schema behavior ngoài approved contract, path safety không thể enforce bằng Node 20 standard library, hoặc implementation không còn small/coherent. Không có additional owner decision được phát hiện trong implementation hiện tại.

Future consumer discovery vẫn chưa được duyệt. Không có existing skill pilot đã chọn; possible new Codex-reporting skill chỉ là ý tưởng cần discovery và owner approval riêng.

## 10. Implementation evidence

Implementation và review correction tồn tại trên branch/base ghi ở mục 1. Targeted suite report 50 tests pass, structural-validator regression suite report 37 tests pass, current repository trả zero configured eval suite và `maintain-repo-skills` trả `not_configured`. Local runtime là Node `v24.11.1`, vì vậy Node.js 20 compatibility vẫn `not verified`.

Self-review đã sửa bốn Required-level defect trước final rerun:

1. bỏ arbitrary one-case minimum để common approved envelope `cases: []` hợp lệ;
2. thay `import.meta.dirname` bằng `fileURLToPath` để không phụ thuộc Node API chỉ có ở later Node 20 minors;
3. tách unsafe path thành operational refusal exit `3`, đồng thời chặn Windows ADS/reserved/trailing-dot behavior;
4. enforce expected/forbidden routing identity nhất quán với `candidate_skills`.

Follow-up review correction xử lý thêm no-route routing, unified operational envelope và stale delivery tracker. Không còn Critical hoặc Required finding sau self-review và targeted rerun. Exact command evidence và working-tree state thuộc [progress.md](./progress.md). Implementation commit đã push; correction commit chỉ local, không amend; pull request chưa mở.
