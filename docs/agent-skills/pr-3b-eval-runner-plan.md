# Kế hoạch PR 3B — Synthetic packaging, provenance và deterministic report

## 1. Trạng thái, thẩm quyền và dependency

| Trường | Giá trị |
| --- | --- |
| Material decision status | Owner-approved cho planning contract và Design B implementation semantics ngày 2026-07-26 |
| Planning status | Planning checkpoint đã giao; CP1–CP4 implementation đã được cấp quyền riêng |
| Behavior implementation | CP1–CP4 đã implement và đang ở cumulative verification/delivery checkpoint |
| Branch | `feat/agent-skills-eval-runner` |
| Verified base | synchronized `main == origin/main` tại `46dd08b81f064f23b6c1bffc81d98a1496bc0041` |
| PR 3A dependency | PR #54 đã merge tại `9bc37722943ca02720ae37a38c935e8b98417614`; merge commit này nằm trong ancestry của verified base |
| Delivery boundary hiện tại | PR #62 đang mở. Owner đã cấp correction implementation/test/commit/push và CI-watch permission cho current review findings; merge vẫn không được phép |
| PR shape | Một PR 3B với internal checkpoints; không tách PR nếu scope và risk signal không thay đổi |

Dependency authoritative:

```text
PR 2 → PR 3A → PR 3B → future consumer discovery
```

PR 3B sở hữu synthetic packaging, provenance và deterministic report. PR 3A sở hữu suite-definition schema v1, `validate --skill|--all` và eval-design authority boundary. Chỉ sau khi PR 3B merge thì PR 3 foundation mới complete; việc đó vẫn không tự cấp quyền tạo real suite, chọn consumer hoặc chạy model.

Owner instruction ngày 2026-07-26 là source of truth chi tiết cho PR 3B. Nó cụ thể hóa hai điểm mà master plan cũ còn ở mức đề xuất:

- structurally valid report có missing observation trả exit `0`, không dùng generic incomplete-evidence exit `1`;
- missing observation buộc semantic và comparison status thành `null`, không được suy ra `not_run`.

Planning scope ban đầu không sửa master plan. Owner instruction implementation ngày 2026-07-26 đã mở rộng scope để reconcile `eval-design.md` và stale master-plan exit proposal cùng checkpoint đầu tiên phụ thuộc vào Design B.

Owner correction instruction ngày 2026-07-28 supersede absolute hostile-concurrency interpretation của path-safety wording: runner giả định trusted local/CI workspace và primarily sequential commands; link/reparse refusal là best-effort tại thời điểm kiểm tra, không phải atomic defense trước hostile process đã có quyền thay parent concurrently. Cùng instruction yêu cầu một immutable suite/context capture cho mỗi `prepare`, reconcile live PR status và cho phép thêm dedicated runner suite vào existing Node.js 20 CI job khi bounded.

## 2. Outcome và exact implementation scope

Outcome quan sát được của PR 3B:

1. `prepare` đọc một configured PR 3A suite, snapshot candidate và optional baseline mà không checkout hoặc sửa source repository.
2. Runner tạo workspace mới dưới fixed OS temporary root, với canonical manifests, SHA-256 provenance, blind executor packages và evaluator-only material tách biệt.
3. `report` validate artifact/version/hash/identity consistency, phân biệt missing evidence với malformed evidence và tạo canonical deterministic report.
4. Runner không execute agent, model hoặc subagent; không semantic-grade và không claim enforcement mà nó không quan sát.

Implementation được giới hạn vào:

```text
.agents/scripts/run-skill-evals.mjs
.agents/scripts/run-skill-evals.test.mjs
.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs
.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs
.agents/skills/maintain-repo-skills/references/eval-design.md
docs/agent-skills/plan.md
docs/agent-skills/pr-3b-eval-runner-plan.md
docs/agent-skills/progress.md
```

Review-correction checkpoint giữ tám file trên là original implementation/authority scope và được phép thêm `.github/workflows/ci.yml` cho dedicated Node.js 20 runner-suite gate. Planning delivery trước implementation còn sửa `docs/agent-skills/pr-3a-eval-schema-plan.md`; vì vậy pre-correction PR range có chín file và post-correction range có mười file khi CI correction được giao.

Hai module mới chỉ được tạo khi implementation thực sự cần boundary tương ứng:

- `artifact-schema-v1.mjs`: schema/version/canonical JSON/cross-artifact validation;
- `synthetic-workspace-v1.mjs`: fixed Git reads, current-tree/ref snapshot, manifest/hash và workspace containment.

Nếu CP1 không tạo được state độc lập có observable verification, CP1 và CP2 phải dùng chung một coherent commit thay vì commit dead scaffolding. Không thêm helper khác nếu chưa có duplicate responsibility rõ ràng.

Planning checkpoint hiện tại chỉ sửa:

```text
docs/agent-skills/pr-3b-eval-runner-plan.md
docs/agent-skills/progress.md
docs/agent-skills/pr-3a-eval-schema-plan.md
```

## 3. Audit-only sources và ownership boundary

Các source sau là audit-only trong future PR 3B, trừ hai authority corrections được owner mở rộng scope ngày 2026-07-26:

- `AGENTS.md` và `docs/agent-loops.md`: lifecycle, permission và checkpoint routing;
- [plan.md](./plan.md): intended program, dependency và approved foundation boundary; được sửa đúng stale exit proposal;
- [pr-3a-eval-schema-plan.md](./pr-3a-eval-schema-plan.md): merged PR 3A contract và historical evidence;
- `.agents/skills/maintain-repo-skills/SKILL.md`: governance audit-only; `references/eval-design.md` được sửa đúng absent-vs-invalid evidence authority;
- `.agents/scripts/lib/skill-evals/suite-schema-v1.mjs`: PR 3A suite-definition owner;
- `.agents/scripts/validate-skill.mjs` và `.agents/scripts/validate-skill.test.mjs`: structural-validator regression owner;
- planning, review, Git checkpoint, GitHub PR/CI, test-quality, maintainability và skill-maintenance contracts đã route cho task;
- product, database, deployment và CI files: exact-scope audit only.

Ownership rules:

- PR 3B không duplicate hoặc relax suite-definition validation của PR 3A.
- `prepare` phải gọi/reuse current PR 3A validation behavior trước khi packaging; schema ownership không được fork sang workspace module.
- Eval-design reference sở hữu semantic/evidence authority. Runner chỉ kiểm tra structure, completeness, provenance và consistency.
- Progress tracker sở hữu current program status; Git/GitHub vẫn authoritative cho ref, commit, PR và merge facts.
- Source repository là input read-only. Runner-owned OS-temp workspace là output duy nhất.

## 4. Explicit non-goals

PR 3B không:

- tạo real suite hoặc committed `.agents/evals/<skill>/**` data;
- chọn consumer, pilot, existing-skill migration hoặc new skill;
- invoke model, native model routing, subagent, specialist hoặc fresh-reader;
- chứng minh native routing, automatic skill activation hoặc model independence;
- semantic-grade response, chọn winner, tự tạo human proposal hoặc sửa candidate;
- enforce hay claim filesystem, process, tool, network, credential, remote hoặc model isolation;
- hỗ trợ mutation-capable evaluation;
- fetch, checkout, switch, worktree, reset, rebase, update ref, stage, commit, push, PR, merge hoặc deploy;
- nhận arbitrary output path, workspace path hoặc cleanup command;
- overwrite workspace hoặc artifact đã tồn tại;
- thêm dependency, package script hoặc Vitest routing; original CP1–CP4 không sửa CI, còn review correction chỉ thêm dedicated runner command vào existing Node.js 20 job theo owner instruction ngày 2026-07-28;
- thay product, database, migration, RLS, RPC, deployment hoặc production behavior;
- gọi line/byte reduction là token saving hoặc gọi static fixture assertion là benchmark quality.

## 5. Public CLI contract

Public grammar sau PR 3B:

```text
prepare --skill <skill> --isolation synthetic \
  (--candidate-current-tree | --candidate-ref <ref>) \
  (--baseline-ref <ref> | --no-baseline)

report --workspace <workspace-id>
```

Invocation đầy đủ tiếp tục là:

```text
node .agents/scripts/run-skill-evals.mjs <command> ...
```

### 5.1 Parsing và validation

- Flags có thể đổi thứ tự nhưng mỗi flag chỉ xuất hiện đúng một lần theo grammar.
- `--skill` dùng PR 3A kebab-case identity và target phải có complete, valid configured suite trio.
- `--isolation` chỉ nhận literal `synthetic`; literal này mô tả requested packaging policy, không mô tả enforced isolation.
- Candidate selector là XOR giữa `--candidate-current-tree` và `--candidate-ref <ref>`.
- Baseline mode là XOR giữa `--baseline-ref <ref>` và `--no-baseline`.
- Candidate-only bắt buộc `--no-baseline`; comparison bắt buộc explicit `--baseline-ref`.
- Không có implicit `HEAD`, implicit baseline, implicit working tree, default branch hoặc remote fetch.
- Ref là một non-empty bounded string, không chứa NUL/control character và không bắt đầu bằng `-`. Runner resolve ref thành commit bằng fixed non-shell Git argv; không nội suy shell.
- Unknown, duplicate, missing hoặc contradictory flag bị từ chối trước mọi workspace write.
- `prepare` yêu cầu current working directory là exact Git worktree root; không có `--root`, implicit parent search hoặc alternate repository path. `report` chỉ resolve opaque workspace dưới fixed root và không đọc source repository.
- `workspace-id` là opaque token theo runner grammar; caller không được cung cấp separator, `.`/`..`, drive, UNC, absolute path, percent-decoded path hoặc alternate data stream.
- `validate --skill|--all` và exit semantics của PR 3A không đổi.

### 5.2 Output

- Success output là một JSON artifact duy nhất trên stdout, UTF-8, canonical ordering và final LF.
- `prepare` trả `prepare_result` gồm version, `workspace_id`, mode, skill, opaque variant set, workspace input hash và artifact summary; không trả absolute temp path.
- `report` trả exact canonical bytes của `generated_report` đã ghi vào workspace.
- Expected usage diagnostics đi stderr; structured command failure không leak absolute repository/temp path, credential, environment dump hoặc Git remote URL.
- `--help` document đủ ba command và nói rõ runner không execute model hay enforce isolation.

### 5.3 Exit semantics

| Exit | Ý nghĩa PR 3B |
| ---: | --- |
| `0` | Command hoàn tất với structurally valid output; gồm `generated_report` có `evidence_status: incomplete` vì missing observation |
| `1` | Input artifact/suite/schema/content invalid, unsupported artifact relationship hoặc malformed evidence |
| `2` | CLI usage invalid hoặc unsupported schema/artifact version |
| `3` | Unsafe workspace/path/Git state, integrity mismatch, source changed during snapshot hoặc operational refusal |

`report` không tạo report hợp lệ từ malformed artifact. Missing observation là absence có cấu trúc trong một workspace còn hợp lệ; malformed observation, wrong version, wrong identity, invalid enum, hash mismatch hoặc cross-artifact inconsistency là command-level failure và non-zero.

## 6. Artifact roles, versioning và consistency

Mọi standalone JSON artifact có:

```text
schema_version: 1
artifact_type: exact owned literal
workspace_id: matching opaque identifier when workspace-scoped
```

Artifact roles:

| Artifact | Vị trí/visibility | Trách nhiệm |
| --- | --- | --- |
| `prepare_result` | stdout | Tóm tắt prepare; không chứa identity mapping hoặc hidden criteria |
| `workspace_manifest` | evaluator-owned workspace root | Mode, skill, source provenance, variant mapping, artifact inventory và top-level hashes |
| `bundle_manifest` | một bản trong mỗi executor variant package | File path, bytes, per-file SHA-256, line metadata khi xác định được và full bundle aggregate; chỉ thấy `A`/`B` |
| `execution_context_manifest` | executor variant/case package | Exact prompt, supplied context, requested execution policy và execution-context aggregate |
| `observation_template` | executor package | Versioned neutral instructions keyed bằng opaque variant/case; không phải execution evidence |
| `baseline_observation` | evaluator-only observation area | Raw baseline response, explicit execution status và observed-access metadata |
| `candidate_observation` | evaluator-only observation area | Raw candidate response, explicit execution status và observed-access metadata |
| `human_evaluation` | evaluator-only | Human-authored semantic/comparison proposal và rationale; runner không tạo proposal |
| `generated_report` | report area và stdout | Deterministic aggregation của valid artifacts; không semantic-grade |

Version `1` là strict: unknown field, missing required field, wrong literal hoặc unsupported integer version bị từ chối. Artifact versioning độc lập với suite-definition schema v1 nhưng reference tới suite/case phải khớp exact `skill`, suite name và case ID.

Cross-artifact consistency bắt buộc:

- cùng `workspace_id`, `skill`, mode và variant set;
- candidate-only chỉ có candidate source role và một opaque executor variant;
- comparison có đúng hai source role và đúng hai opaque variants;
- evaluator mapping là nơi duy nhất nối `A`/`B` với candidate/baseline;
- bundle/context hashes trong child artifact khớp workspace manifest;
- observation khớp expected role, variant, suite, case và context hash;
- human proposal chỉ tham chiếu observation tồn tại, hợp lệ;
- report inventory và summary counts được tính lại, không tin cached count;
- mọi artifact path nằm trong allowlisted layout và không qua link/reparse point.

## 7. Canonical manifests và SHA-256 provenance

Canonical JSON dùng UTF-8 không BOM, recursively sorted object keys, schema-defined array order, LF và một final newline. Collection có semantic-set behavior phải sort bằng normalized identity; response text và ordered prompt/context arrays giữ nguyên semantic order.

Mỗi file manifest entry dùng:

```json
{
  "path": "normalized/repo-relative/path",
  "byte_count": 123,
  "sha256": "lowercase-64-hex"
}
```

Rules:

- hash raw bytes bằng Node `crypto` SHA-256;
- path dùng `/`, không absolute, drive, UNC, empty segment, `.`/`..`, backslash, control character hoặc normalization collision;
- entries sort lexicographically theo normalized path;
- aggregate hash là SHA-256 của canonical manifest envelope không chứa chính aggregate field;
- `full_skill_bundle_hash`, `execution_context_hash` và routing/context aggregate là distinct identities;
- byte/line counts không được gọi là tokens; line count chỉ được ghi cho valid UTF-8 text, còn binary là `null`;
- source ref luôn lưu requested ref và resolved full commit SHA; report dùng resolved SHA làm provenance fact;
- không lưu absolute source path, absolute temp path, remote URL hoặc environment dump.

## 8. Candidate source behavior

`prepare` có hai source layer không được trộn:

- evaluation control plane luôn đến từ current working tree: configured PR 3A suite trio, hidden criteria và exact repository/routing context mà suite chọn;
- variant source selector chỉ chọn full `.agents/skills/<skill>/` bundle cho candidate, và `--baseline-ref` chỉ chọn baseline skill bundle.

Mỗi `prepare` capture từng suite và repository-context input đúng một lần: suite được parse/validate từ chính captured bytes, context package và provenance dùng cùng captured graph, và packaging không reread source path. Final fingerprint reread chỉ để từ chối khi relevant disk input thay đổi sau capture; nó không trở thành nguồn package bytes thứ hai. Một invocation sau luôn capture trạng thái source mới tại invocation đó. Runner cấp cùng prompt/context/requested policy từ immutable per-run capture cho mọi variant. Vì vậy baseline ref không cần chứa future suite definitions, và candidate/baseline không nhận context khác nhau chỉ vì repository file ở hai commits khác nhau. `workspace_manifest` phải giữ riêng `control_plane_provenance`, candidate bundle provenance và optional baseline bundle provenance.

### 8.1 `--candidate-current-tree`

Candidate bytes là working-tree bytes tại snapshot time, không phải index bytes. Provenance phải ghi:

- resolved current `HEAD` commit;
- truthful repository state `clean` hoặc `dirty`;
- relevant index/worktree status theo stable path order;
- mọi relevant present tracked và untracked input với byte count và per-file SHA-256;
- relevant tracked deletion như state metadata với `present: false`, không giả tạo byte/hash;
- canonical aggregates của exact bytes đã package;
- start/end source fingerprint để phát hiện concurrent change.

Relevant current-tree input set:

1. mọi tracked và untracked non-ignored regular file dưới `.agents/skills/<skill>/` khi candidate selector là `--candidate-current-tree`; ignored file chỉ được include khi exact validated context graph reference nó;
2. mọi entry dưới `.agents/evals/<skill>/`, vì extra/missing entry ảnh hưởng PR 3A validation;
3. exact `repository_file` context được valid suite reference;
4. exact routing/governance file được suite context chọn; không tự thu thập toàn repository;
5. required parent metadata chỉ khi current schema/runner thực sự đọc nó.

Inventory/status/hash/race rules của current-tree control plane áp dụng trong mọi candidate mode. Chỉ skill-bundle item (1) phụ thuộc `--candidate-current-tree`; khi dùng `--candidate-ref`, candidate bundle provenance đến từ resolved commit còn suite/context current-tree provenance vẫn được ghi đầy đủ.

Untracked file ngoài set trên không được package và không làm candidate provenance dirty cho selected input graph. Untracked non-ignored file trong skill/eval root hoặc được exact context reference phải được include và label `untracked`; runner không được silently dùng only Git-tracked inventory. Ignored file được include chỉ khi exact validated context graph reference nó và phải label `ignored_explicit`; ignored file khác dưới relevant skill/eval root bị deterministic refusal hoặc explicit exclusion-reason evidence, không được silent package.

Nếu relevant path đổi, xuất hiện hoặc biến mất giữa initial inventory/read và final fingerprint, `prepare` dừng exit `3`. Runner không stage, stash, checkout, clean hoặc sửa source bytes.

### 8.2 `--candidate-ref <ref>` và `--baseline-ref <ref>`

- Resolve local ref thành full commit SHA; không fetch.
- Đọc commit tree/blob bằng fixed allowlisted non-shell Git argv; không checkout, worktree hoặc temporary index.
- Chỉ regular blob mode được package. Symlink, submodule, directory mismatch hoặc unsupported mode bị từ chối.
- Ref snapshot có `working_tree_state: not_applicable`; current working-tree dirt không thay đổi ref bytes.
- Baseline và candidate skill bundle được package bằng cùng bundle selection, platform logic và canonicalization; cả hai nhận cùng control-plane prompt/context bytes từ current tree.
- Candidate-ref không đọc suite definitions hoặc evaluator criteria từ candidate commit; baseline-ref cũng không đọc chúng từ baseline commit.
- Same resolved commit không tự tạo `equivalent`; report vẫn cần complete observations và human proposal.

## 9. Fixed workspace và safety contract

Fixed runner root:

```text
<os.tmpdir>/vocaspace-agent-skill-evals/v1/
```

Workspace layout:

```text
<fixed-root>/<workspace-id>/
├── workspace-manifest.json
├── executor/
│   ├── A/
│   │   ├── bundle/
│   │   ├── bundle-manifest.json
│   │   └── cases/<suite>/<case-id>/
│   │       ├── execution-context-manifest.json
│   │       ├── prompt.txt
│   │       ├── context/
│   │       └── observation-template.json
│   └── B/                         # comparison only
├── evaluator/
│   ├── suite-definitions/
│   ├── observations/
│   │   ├── baseline/<suite>/<case-id>.json
│   │   └── candidate/<suite>/<case-id>.json
│   └── human-evaluations/<suite>/<case-id>.json
└── report/
    └── generated-report.json
```

`workspace-id` là collision-resistant opaque identifier do runner tạo và chỉ được resolve bằng exact child lookup dưới fixed root. Nó không mang source/ref/role semantics và không tham gia content/provenance hashes. Caller phải coi nó là opaque. Không có public output-root override.

Safety rules:

- threat model là trusted local/CI workspace với một main agent và primarily sequential commands; runner không claim bảo vệ tuyệt đối trước hostile process đã có quyền thay parent concurrently;
- resolve lexical containment trước, rồi verify real-path containment trên mọi existing component;
- `lstat` từng component và từ chối symbolic link, junction hoặc detectable reparse point ở source, fixed root, workspace và artifact path tại thời điểm check;
- pathname check và later pathname operation không atomic; best-effort refusal này không được trình bày như protection trước concurrent hostile parent replacement;
- create workspace bằng exclusive operations; refuse nếu exact workspace hoặc output artifact đã tồn tại;
- `report` trả valid incomplete report trên stdout nhưng không persist khi required observation hoặc human evaluation vắng mặt; chỉ complete report mới tạo `generated-report.json`; nếu complete file đã tồn tại và exact canonical bytes giống nhau thì return idempotently, nếu khác thì refuse;
- trong expected trusted/sequential workflow, từ chối detectable link trước enumerate/copy/read/write và chỉ target new runner-owned workspace;
- không có cleanup/delete command.

Mọi source read/hash/validation hoàn tất trước workspace creation khi khả thi. Nếu operational failure xảy ra sau khi directory mới được tạo, runner để lại explicit incomplete marker và refuse reuse; nó không xóa hoặc overwrite evidence một cách im lặng.

## 10. Blind package và access-claim boundary

Candidate-only dùng opaque variant `A`. Comparison dùng `A` và `B`; assignment candidate/baseline được derive deterministically từ canonical source hashes và chỉ ghi trong evaluator-owned `workspace_manifest`.

Executor package không chứa:

- literal candidate/baseline, old/new hoặc branch/ref/commit mapping;
- expected answer, forbidden behavior, criteria, safety veto hoặc reviewer conclusion;
- output của variant khác;
- evaluator-only suite fields;
- source repository path hoặc Git remote.

Package scanning test phải tìm cả exact secret fixture literals và semantic identity fields, không chỉ filename.

Requested execution policy và actual observed access là hai record khác nhau:

- `execution_context_manifest` giữ requested policy từ suite;
- observation giữ raw response, `execution_status` và observed access cho filesystem, process, tools, network, credentials, remote, mutation và model/runtime;
- neutral observed-access values phân biệt `observed`, `not_observed` và `unknown`; `not_observed` không có nghĩa là blocked hoặc enforced;
- enforcement chỉ được ghi khi observation có explicit basis; synthetic packaging tự nó không phải basis.

Generated report luôn mô tả `synthetic` là packaging mode. Nó không được dùng từ ngữ khẳng định sandbox, isolation, read-only executor, tool denial, network denial, credential exclusion, model independence, native routing hoặc automatic activation nếu evidence không trực tiếp chứng minh.

## 11. Observation, semantic proposal và report semantics

Observation `execution_status` chỉ được ghi explicit bởi operator:

```text
completed
not_run
```

`not_run` cần non-empty reason. Missing file không phải observation `not_run`.

Human proposal enums:

```text
case_status: passed | partially_passed | failed | not_run
comparison_status: improved | equivalent | regressed | inconclusive
```

Rules:

1. Runner không tạo, sửa, upgrade hoặc infer human proposal.
2. Candidate-only report không có comparison proposal/status.
3. Comparative claim cần explicit baseline, complete consistent observations và structurally valid human comparison proposal.
4. Safety veto semantics do human evaluator áp dụng; runner chỉ carry-through valid proposal.
5. Missing required observation tạo:

```text
evidence_status: incomplete
case_status: null
comparison_status: null
```

6. Missing observation không được suy ra pass, fail, equivalent, improved, regressed, inconclusive hoặc `not_run`.
7. Structurally valid incomplete report là command success exit `0`.
8. Khi required human proposal vắng mặt, report cũng có `evidence_status: incomplete`; semantic/comparison status là `null`. Runner không invent proposal và structurally valid incomplete report vẫn exit `0`.
9. Malformed observation/proposal, integrity mismatch hoặc wrong identity không phải incomplete success; command fail theo exit table.
10. Incomplete report chỉ return stdout và không finalize `report/generated-report.json`; complete report mới được persist immutable.
11. Report order là suite `regression`, `routing`, `fresh-reader`, rồi case ID và variant ID theo lexical order.

`generated_report` phải tách:

- provenance/structure facts do runner chứng minh;
- requested policy;
- actual observed access và basis;
- raw execution status;
- human-authored semantic proposal;
- runner-computed evidence completeness;
- comparison status chỉ khi hợp lệ;
- explicit `claim_boundaries` cho điều chưa được chạy/chứng minh.

## 12. Source immutability, determinism và reproducibility

Runner chỉ dùng fixed read-only Git commands, `shell: false`, explicit argv và không nhận arbitrary Git command. Không dùng Git config mutation, environment-secret expansion hoặc remote operation.

Determinism requirements:

- same source bytes, suite bytes và versioned options tạo cùng workspace input hash, variant assignment, file manifests, package payload bytes và reproducibility hash;
- opaque `workspace_id` có thể khác giữa hai independently prepared workspace; exact report bytes phải stable khi chạy lại trên cùng immutable workspace, còn cross-workspace comparison dùng reproducibility hash không chứa workspace ID;
- ngoài explicit opaque `workspace_id`, timestamp, absolute path, PID, random value, locale-dependent sort và filesystem enumeration order không đi vào canonical hashes/report;
- source ref luôn pin full commit SHA trước read;
- current-tree snapshot fail nếu input graph thay đổi trong lúc đọc;
- JSON output stable giữa hai fresh temp roots;
- source repository recursive byte manifest và `git status --porcelain` trước/sau command phải giống nhau.

Reproducibility claim chỉ áp dụng cho deterministic packaging/report bytes của cùng inputs. Nó không áp dụng cho model output, executor behavior, semantic benchmark quality, remote behavior hoặc production.

## 13. Test fixtures và black-box matrix

Tests dùng `node:test`, `node:assert/strict`, `process.execPath`, `spawnSync`/`shell: false` và disposable temp repositories. Fixtures tạo programmatically trong test lifecycle; không commit real eval suite.

Minimum matrix:

- PR 3A `validate` regression và public help;
- exact valid CLI forms, flag order, XOR requirements, duplicate/unknown/missing flags và invalid ref/workspace ID;
- candidate-only/current-tree, candidate-only/ref và comparative current-tree/ref combinations;
- missing/unresolvable ref, non-commit ref target, no implicit fetch và current dirt không ảnh hưởng ref snapshot;
- clean tree, staged-only, unstaged, tracked deletion, relevant untracked/non-ignored, explicitly referenced ignored, refused unrelated ignored, irrelevant untracked và concurrent source change;
- stable path ordering, raw-byte hash, byte count, aggregate hash và line-count/null behavior;
- full bundle, exact execution context và distinct aggregate identities;
- same inputs ở two fresh temp roots tạo cùng provenance/reproducibility hashes và canonical-equivalent payloads sau khi bỏ opaque workspace identity;
- fixed-root containment, traversal/absolute/drive/UNC/ADS refusal;
- existing workspace/artifact overwrite refusal;
- source symlink, workspace symlink, Windows junction/reparse fixture khi environment hỗ trợ;
- regular-file/mode refusal cho commit-tree symlink/submodule;
- executor package scan không leak mapping, refs, criteria, veto, expected answer hoặc other output;
- requested policy khác actual observed access và không tạo false enforcement claim;
- missing baseline/candidate observation cho từng mode trả exit `0`, `evidence_status: incomplete`, semantic/comparison `null`;
- explicit `not_run` observation có reason, malformed `not_run`, complete observations nhưng thiếu human proposal tạo incomplete/null và valid human proposal carry-through;
- wrong workspace/case/variant/hash/version/type/mapping và tampered package fail non-zero;
- candidate-only không thể có comparison status; comparison không thể thiếu explicit baseline;
- report rerun exact-match idempotent và mismatching existing report bị từ chối;
- no absolute path/credential/environment/remote leak;
- source recursive byte hash, Git status và staging unchanged trước/sau prepare/report;
- current PR 3A runner suite và structural-validator suite vẫn pass.

Static assertions chỉ chứng minh schema/CLI/package behavior của fixture. Không claim model quality, native routing, automatic activation, real isolation, benchmark validity, consumer readiness hoặc production behavior.

## 14. Verification plan

Mỗi implementation checkpoint chạy subset targeted và CP4 chạy cumulative:

```text
node --version
node --check .agents/scripts/lib/skill-evals/suite-schema-v1.mjs
node --check .agents/scripts/lib/skill-evals/artifact-schema-v1.mjs
node --check .agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs
node --check .agents/scripts/run-skill-evals.mjs
node --check .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs --help
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/run-skill-evals.mjs validate --skill maintain-repo-skills
node .agents/scripts/validate-skill.mjs
git diff --check
```

Chỉ chạy syntax command cho file mới sau khi file tồn tại. Node.js 20 giữ `not verified` trừ khi command thực sự chạy dưới major 20. Current local Node khác major 20 không thể nâng claim.

Manual audits:

- exact in-scope diff và no CI/dependency/product/database/deployment change;
- strict UTF-8, final newline, trailing whitespace, Markdown headings/fences/tables/links;
- source immutability and fixed-root-only write evidence từ black-box fixtures;
- no false model/routing/activation/isolation/benchmark/remote/production claims;
- tracker phân biệt planned, implemented, verified, committed, pushed, PR open và merged.

## 15. Implementation checkpoints

### CP0 — Planning and dependency reconciliation

**Inputs và owners:** live Git/GitHub refs; master plan; merged PR 3A plan/schema/runner/eval-design; owner-approved PR 3B decisions.

**Exact files:** ba planning files được phép trong mục 2.

**Completion:** synchronized base và PR 3A merge được xác nhận; stale PR 3A/progress state được reconcile; exact scope, CLI, artifact, safety, evidence và checkpoint contract hoàn tất.

**Targeted verification:** planning command set do owner yêu cầu; exact three-file diff; Markdown/UTF-8/link/scope/ancestry audits.

**Self-review questions:** owner decision nào bị làm mờ; master-plan proposal nào mâu thuẫn; có pre-claim implementation/push/PR không; có false isolation/model evidence không.

**Valid intermediate state:** docs-only branch; PR 3B behavior vẫn hoàn toàn chưa implement; current PR 3A CLI vẫn chỉ expose `validate`.

**Expected commit boundary:** đúng một planning commit `docs(agent-skills): define PR3B execution contract`.

**Rollback value:** revert planning commit loại bỏ PR 3B detailed contract mà không đụng merged PR 3A behavior.

**Stop:** dependency/ownership/base invalid, branch/PR conflict, scope cần file thứ tư hoặc review còn Critical/Required.

### CP1 — Artifact and provenance foundation

**Inputs và owners:** PR 3A suite schema/validator; eval-design artifact roles; CP0 canonicalization/provenance contract.

**Exact files:** `artifact-schema-v1.mjs`, `synthetic-workspace-v1.mjs`, runner test, authority reconciliation trong `eval-design.md` và master plan; PR 3B plan/progress khi actual checkpoint evidence thay đổi.

**Completion:** strict artifact v1 validators, canonical serializer/manifests/hashes, ref resolution/current-tree provenance và cross-artifact identity checks có observable tests.

**Targeted verification:** syntax cho new modules/test, provenance/schema fixture subset, existing PR 3A test suite và `git diff --check`.

**Self-review questions:** hash có cover exact raw bytes; current-tree staged/untracked/deleted state truthful; ref pin commit chưa; path normalization collision; Git argv có thể mutate/inject không.

**Valid intermediate state:** PR 3A public CLI vẫn hoạt động; internal foundation có tests nhưng không expose partial unsafe `prepare`.

**Expected commit boundary:** chỉ commit riêng nếu foundation là coherent tested contract; nếu chỉ là dead scaffolding, gộp CP1+CP2.

**Rollback value:** bỏ artifact/provenance foundation mà không ảnh hưởng PR 3A validate.

**Stop:** cần dependency/CI/schema change ngoài scope; Git read không thể giữ source immutable; Node 20 stdlib không đủ safety guarantee.

### CP2 — Synthetic prepare workflow

**Inputs và owners:** CP1 artifacts/provenance; owner-approved CLI; fixed workspace và eval-design separation rules.

**Exact files:** runner CLI, runner test, hai PR 3B lib modules; PR 3B plan/progress chỉ khi checkpoint evidence thay đổi.

**Completion:** exact `prepare` grammar, candidate/current-tree/ref and optional baseline, blind packages, evaluator-only data, fixed-root no-overwrite workspace và source immutability pass.

**Targeted verification:** prepare CLI black-box subset, dirty/untracked/ref/hash fixtures, containment/link/reparse/overwrite fixtures, leak scan, source before/after audit và PR 3A regression.

**Self-review questions:** executor package có mapping/rubric leak; workspace ID có path authority; requested policy có bị gọi enforced; partial failure có overwrite/delete; any source byte/index mutation.

**Valid intermediate state:** `prepare` usable và deterministic; `report` vẫn unsupported hoặc chưa exposed cho tới khi CP3 complete; help phải mô tả đúng actual public surface.

**Expected commit boundary:** coherent prepare commit; có thể bao gồm CP1 khi CP1 không độc lập reviewable.

**Rollback value:** revert prepare slice trả về PR 3A validate-only CLI hoặc CP1 internal foundation.

**Stop:** workspace containment/reparse/no-overwrite không chứng minh được; package leakage; current-tree race; scope cần arbitrary output hoặc cleanup.

### CP3 — Deterministic report workflow

**Inputs và owners:** valid CP2 workspace; eval-design authority; owner-approved missing-observation and exit semantics.

**Exact files:** runner CLI, runner test, artifact-schema module; workspace module chỉ khi report path safety cần correction; PR 3B plan/progress khi evidence thay đổi.

**Completion:** observation ingestion, evidence completeness, explicit execution status, human proposal carry-through, candidate-only/comparative semantics và stable report output pass.

**Targeted verification:** report black-box subset, incomplete success, malformed/integrity failures, no-inference cases, candidate-only/comparison matrix, idempotent output, ordering and claim-boundary snapshots.

**Self-review questions:** missing có bị biến thành `not_run`; runner có semantic-grade; comparison có implicit baseline; complete evidence thiếu human proposal có bị invent; invalid artifact có bị hạ thành incomplete success.

**Valid intermediate state:** full public `validate`/`prepare`/`report` contract hoạt động; chưa có model execution, real suite, CI hoặc consumer.

**Expected commit boundary:** một coherent report commit sau targeted pass.

**Rollback value:** revert report slice giữ prepare artifacts cho manual inspection mà không tạo false verdict.

**Stop:** semantic authority bị duplicate; report cần read ngoài workspace; status/exit contract không deterministic.

### CP4 — Cumulative verification and adversarial implementation review

**Inputs và owners:** toàn branch diff từ verified base; CP0 contract; current root/lifecycle/domain skills.

**Exact files:** audit toàn exact implementation scope; chỉ sửa các file trong scope khi finding được owner contract support.

**Completion:** full matrix pass; PR 3A regression pass; exact scope/source immutability/evidence-claim audits pass; final review `0 Critical / 0 Required`.

**Targeted verification:** toàn bộ mục 14 và matrix mục 13; branch/base ancestry; diff/name/status; UTF-8/Markdown hygiene; source-tree byte/status proof từ fixtures.

**Self-review questions:** scope creep; ownership duplication; unsafe Git/path; provenance gap; information leakage; false isolation/model/benchmark claim; incomplete semantics; rollback order; permission/tracker truth.

**Valid intermediate state:** implementation review-ready locally, không staged nếu commit permission chưa được cấp; no PR/CI/merge claim.

**Expected commit boundary:** không commit chỉ vì CP4 tồn tại. Chỉ tạo correction commit nếu review tìm và sửa một coherent substantive defect; nếu không, CP4 là verified evidence checkpoint.

**Rollback value:** correction commit có thể revert riêng; nếu không có commit, rollback theo CP2/CP3 boundaries.

**Stop:** còn Critical/Required; verification fail; cần out-of-scope owner decision; Node 20 bị claim mà không chạy.

### CP5 — Git and remote delivery

**Inputs và owners:** owner Git permission hiện hành, clean reviewed CP4 state và Git checkpoint/GitHub PR-CI contracts.

**Exact files:** không mặc định có source change; progress chỉ đổi khi cần ghi một delivery fact đã thực sự xảy ra.

**Completion:** coherent checkpoint commits đã được owner cho phép; cumulative branch review trước push/PR; local/remote ref evidence truthful.

**Targeted verification:** staged-name audit, `git diff --cached --check`, commit range review, ancestry, post-push ref equality và clean worktree/index.

**Self-review questions:** commit có coherent/recoverable; staging có đúng scope; permission có bao gồm push/PR/CI/merge; có force/rewrite/unrelated file không.

**Valid intermediate state:** local commits có thể tồn tại chưa push; pushed branch có thể tồn tại chưa PR. Mỗi trạng thái phải được report riêng.

**Expected commit boundary:** không ceremonial commit. Delivery-only docs commit chỉ hợp lệ nếu tracker cần ghi facts đã xảy ra và tạo independently reviewable state.

**Rollback value:** revert coherent code/docs checkpoint; không rewrite published history. PR/merge rollback cần owner action riêng.

**Stop:** dirty/unrelated staging, divergent upstream, non-fast-forward push, missing permission, failing cumulative review hoặc requested remote action vượt quyền.

## 16. Rollback order

Preferred rollback theo dependency:

1. revert CP4 correction nếu correction tạo regression;
2. revert CP3 report commit, giữ prepare/provenance;
3. revert CP2 prepare commit;
4. revert CP1 foundation nếu tồn tại độc lập;
5. revert CP0 planning commit chỉ khi owner hủy detailed contract.

Không amend, squash, rebase, reset, force-push hoặc delete branch để rollback. Transient workspace không được commit; runner không cung cấp cleanup.

## 17. Global stop conditions

Stop và report khi:

- live base không còn chứa merged PR 3A dependency;
- exact scope cần file/dependency/CI/consumer ngoài plan;
- source repository mutation hoặc remote Git operation trở thành cần thiết;
- fixed-root lexical containment, no-overwrite, point-in-time link/reparse refusal hoặc immutable current-tree capture không giữ được theo approved trusted/sequential threat model;
- artifact/schema owner mâu thuẫn chưa được owner giải quyết;
- executor package leak evaluator-only data hoặc identity mapping;
- requested policy bị trình bày như actual enforcement;
- runner phải invoke/grade model hoặc infer semantic status;
- missing observation không thể giữ `null` semantics và exit `0`;
- deterministic output/source immutability test fail;
- review còn `Critical` hoặc `Required`;
- cần specialist/fresh-reader mà chưa có explicit permission;
- Node.js 20 compatibility cần claim nhưng chưa được thực thi trên major 20.

## 18. Future permission boundaries

| Action | Permission cần |
| --- | --- |
| Planning artifact | Planning/edit/review + exact three-file commit/push permission hiện tại; consumed sau delivery |
| CP1–CP4 implementation | Explicit owner permission sửa exact implementation files, chạy local deterministic tests và tạo runner-owned disposable fixtures/workspaces |
| Specialist hoặc fresh-reader | Explicit separate permission cho model/agent invocation, bounded package và evidence use; không được suy ra từ implementation permission |
| Local stage/commit | Explicit Git checkpoint permission; có thể cấp theo từng coherent checkpoint hoặc một bounded instruction nêu rõ commit boundaries |
| Normal push | Explicit push permission cho exact branch và reviewed commits |
| PR create/update | Explicit PR permission và approved title/body/base |
| CI watch/fix | Explicit CI-watch permission; fix/push chỉ theo bounded GitHub workflow và branch-caused-small-safe rule nếu owner cấp |
| Merge | Explicit merge permission, method và post-merge boundary |
| Consumer/real suite/model run | Separate owner decision sau PR 3B; foundation permission không bao gồm |

## 19. Planning adversarial self-review

Self-review phải audit toàn three-file planning diff theo classification `Critical`, `Required`, `Suggestion`, reconcile finding với owner sources và sửa mọi supported in-scope Critical/Required trước commit.

Review minimum:

- scope completeness và unnecessary expansion;
- ownership duplication;
- unsafe path/Git behavior;
- CLI/provenance/current-tree/untracked ambiguity;
- executor/evaluator leakage;
- false isolation/model/routing/activation claim;
- incomplete-report and exit semantics;
- deterministic testability;
- checkpoint coherence/rollback;
- permission separation và tracker truth.

Final planning gate:

```text
0 Critical / 0 Required
0 specialist
0 fresh-reader
```

Suggestion không được silently biến thành scope mới. Actual findings và corrections của planning checkpoint phải được ghi vào [progress.md](./progress.md) và final delivery report.
