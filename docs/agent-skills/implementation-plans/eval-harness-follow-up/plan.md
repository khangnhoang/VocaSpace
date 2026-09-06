# Harness follow-up — exact reader donor reuse và reader configuration

## Trạng thái, base và quyền

- Ngày: `2026-09-06`; detailed plan `frozen implementation contract / owner-approved` theo instruction hiện tại.
- Owner đã yêu cầu planning cho đúng hai outcome: explicit cross-run reader donor reuse và configurable reader model/effort. Default reader giữ `gpt-5.6-sol / medium`; evaluator giữ nguyên `gpt-5.6-sol / medium`.
- Quyền hiện tại: local source implementation và local checkpoint commits theo đúng thứ tự/điều kiện trong plan đã được authorize bởi instruction hiện tại. **Không authorize live model call, egress, calibration, push, PR hoặc merge.**
- Sau authorized fetch, `main == origin/main == 2be02df11e279b5c88f37d2fd609069a54c235ed`, ahead/behind `0/0`, tree/index sạch. Branch `codex/harness-follow-up-plan` tạo từ base đó, không stacked; CP0 planning diff hiện tại là task-owned. Worktree discovery `codex/harness-follow-up` ở cùng base được giữ nguyên.
- [Owner brief](./owner-review-brief.md) ghi decision; [progress](../../progress.md) sở hữu actual status. Frozen contract này không cấp live hoặc remote authority.
- Không dùng forecast `17 baseline + 17 candidate + 17 evaluator = 51` làm actual donor verification. PR6 store không có trên host discovery; exact donor availability/hashes chưa được kiểm tra.

## Mục tiêu và giới hạn

Khi lifetime attempt budget buộc tạo fresh run, operator có thể dùng exact-valid reader evidence từ một donor run rõ ràng, giữ producing provenance và không tạo local attempt giả. Reader model/effort có thể cấu hình khi tạo run, được freeze và dùng nhất quán từ compiler tới worker; evaluator độc lập và vẫn Sol Medium. Historical plans/evidence tiếp tục đọc và thực thi theo settings đã freeze.

Preliminary size `medium`; final size `large/high-risk` ở contract reuse/restart/compatibility, không phải product architecture. Chỉ một CLI backend và một local coordinator; cần durable plan cùng integration review vì state, publication, dependency và report cùng thay đổi. `0 specialist`; không có grant delegation hoặc residual uncertainty cần specialist trong planning này.

Ngoài phạm vi: evaluator cross-run cache, global cache/index scan, multi-donor merge, transitive donor chains, arbitrary artifact import, App Server/CP9 changes, provider-envelope certification, distributed/multi-writer store, retention/cleanup subsystem, API transport mới, model router/per-case fallback, tự đổi default sang Luna, suite/rubric/skill/context/product/DB changes, full calibration/fanout. Không sửa `.agents/skills/**` hoặc `AGENTS.md` trong workstream này.

## Nguồn và hành vi đã xác nhận

Áp dụng `AGENTS.md`, [agent loops](../../../agent-loops.md), skills `implementation-planning-and-pr-breakdown` (tracked-program và handoff), `git-checkpoint-workflow`, `test-quality-strategy` (mocking/regression), `code-commenting-and-maintainability` khi viết comments/test headers. Implementation checkpoint phải đọc thêm `code-review-and-quality`; không cần domain DB/frontend vì SQL/app files chỉ là frozen eval inputs, không được sửa hoặc chạy.

| Nguồn | Contract cần giữ |
| --- | --- |
| [CLI master](../eval-harness-cli-first/plan.md), [Stage 1](../eval-harness-cli-first/stage-1-cli-runner.md) | Fresh `codex exec`, embedded exact input, logical key không chứa run/workspace/variant locator; process success không phải semantic pass |
| [Stage 2](../eval-harness-cli-first/stage-2-cli-prepare.md) | Static prepare barrier, exact descriptor/materializer, `run.json`-last, zero dispatch trong prepare |
| [Stage 3](../eval-harness-cli-first/stage-3-cli-reuse.md) | Two-anchor evidence, lifetime per-unit budget, recovery/unknown, exact versus mixed mode |
| [Stage 4](../eval-harness-cli-first/stage-4-cli-evaluator-report.md) | Reader dependency waves, evaluator reuse trong cùng run, advisory/read-only report |
| [Operator guide](../../eval-design.md) | Current command/exit semantics; `patch-check` không retry unchanged/failed/unknown units |
| [Historical hardening](../eval-harness-hardening/plan.md) | App Server opaque-envelope cross-run reuse bị cấm; không đưa certification subsystem đó sang CLI |

Discovery source anchors, dưới `.agents/scripts/`:

- `lib/skill-evals/cli-run-state-v1.mjs`: `assertCliUnitState`, `assertAttemptSequence`, `resolveAcceptedAttemptEvidence` bind accepted success vào local summaries/run; `rebaseUnitState` hiện suy pending từ zero summaries.
- `lib/skill-evals/cli-impact-v1.mjs`: reader reuse đã so exact logical membership và producing/current behavior fingerprint, không cần run identity trong semantic key.
- `run-skill-eval-cli.test.mjs`: test `accepted reader evidence traverses producer state, impact, and compiler without rewriting observation bytes` đã resolve bằng producer run rồi compile cho descriptor ở run khác; đây chưa phải durable cross-run support.
- `lib/skill-evals/codex-cli-runner-v1.mjs`: global `cliBehaviorOptions`, reader compiler và worker argv cố định Sol/medium; worker chưa consume prepared options làm execution SSOT.
- `lib/skill-evals/cli-execution-plan-v1.mjs`: plan/descriptor validation so options với global constant. `cli-evaluator-proposal-v1.mjs` đã có bounded normalized options seam.
- `lib/skill-evals/cli-evaluation-report-v1.mjs`: report chưa có producer run và so producer revision với recipient revision.

Baseline/candidate cùng comparison phải equivalent model/settings. Exact reuse còn phụ thuộc exact bundle/prompt/context/policy/schema bytes: baseline Git ref không đổi chưa đủ; shared `AGENTS.md` hoặc context đổi vẫn invalidate. Full bundle change ảnh hưởng mọi reader dùng bundle đó. `succeeded` chỉ nghĩa process/output-contract success; không lọc donor theo rubric pass hoặc chọn output vì có verdict tốt.

CLI master delivered Stage 1–4 không có cross-run reuse. Frozen follow-up này chỉ supersede đúng hai exclusion/settings decisions cần thiết sau khi CP1/CP2 implementation pass; không rewrite historical stage evidence, quyền cũ hoặc CP9 guarantees.

## A. Explicit reader donor reuse

### Command và lựa chọn donor

Command contract duy nhất: `prepare ... --reuse-readers-from <run-id>`, optional, chỉ khi tạo run mới, tối đa một lần. Không dùng cùng `--run`; donor phải khác recipient và nằm dưới existing fixed CLI run root. Không nhận arbitrary path, reader output JSON, external store, evaluator selection hoặc glob.

Không có flag thì flow cũ giữ nguyên. Có flag thì trước khi publish target:

1. Validate target static packages/plan và donor authoritative marker/plan/unit inventory qua existing store validators. Donor thiếu, corrupt, unknown schema hoặc unpublished là command error; không âm thầm bỏ donor.
2. Xét reader intersection theo exact logical key/unit ID, bao gồm skill, suite, case và semantic source role. Scope donor không cần bằng toàn bộ recipient scope.
3. Chỉ nhận donor unit đang `succeeded`, có local worker-backed accepted attempt hợp lệ. Không nhận failed/unknown/running/integrity-blocked unit, recovery-only result, currently invalidated historical success hoặc success đã import từ run khác. Các trạng thái không đủ điều kiện là declared non-match, không phải permission để repair donor. Unrelated failed/unknown/evaluator units không ngăn một valid reader donor.
4. Revalidate full attempt/result/output/producing-plan chain; compare exact producer/current behavior fingerprint. Valid behavior mismatch hoặc thiếu logical member là non-match, target reader vẫn pending. Corrupt evidence của reader được xét nhận là command error, không cache miss.
5. Giữ deterministic target reader order. Mỗi matching reader nhận đúng accepted attempt đã chỉ định bởi donor state; không search historical outputs theo semantic verdict. Một run không có match vẫn prepare thành công với imported count `0` được báo rõ.

Donor luôn read-only. `prepare` không gọi Codex preflight/model; reuse không tiêu thụ budget và không cấp live authority cho pending work.

### Persisted contract tối thiểu

Các tên/version dưới đây là **frozen wire contract**; chúng chưa tồn tại trong source trước CP1/CP2.

- New donor-enabled run dùng `cli_run` v3: giữ v2 fields/semantics và thêm `reader_reuse_manifest: { path: "reader-reuse.json", sha256 }`. Các non-donor runs tiếp tục đọc/ghi theo compatible existing shapes; không migrate toàn bộ store.
- `reader-reuse.json` là create-once immutable receipt, `schema_version: 1`, `artifact_type: "cli_reader_reuse_manifest"`, `run_id`, `donor_run_id`, `imports`. Mỗi entry gồm `unit_id`, `attempt_id`, `producer_revision`, `attempt_record_path`, `attempt_record_sha256`, `producing_plan_sha256`. Entries unique, ordered theo target reader inventory; empty imports hợp lệ.
- `unit_state` v2 giữ existing fields và thêm `accepted_reader_reuse: null | { reuse_manifest_sha256 }`. Unit ID của state chọn đúng một manifest entry. Donor-enabled run dùng v2 states cho inventory thống nhất; evaluator field này luôn null.
- Reader `succeeded` yêu cầu đúng một trong `accepted_attempt` local hoặc `accepted_reader_reuse` external. Hai trường không đồng thời non-null. Other statuses không giữ current acceptance. Imported reader bắt đầu với `active_attempt = null`, `accepted_attempt = null`, `attempt_summaries = []`, `attempt_count = 0`; fingerprint vẫn derive từ current target descriptor.
- Receipt tồn tại suốt run kể cả external acceptance đã bị invalidation, để mixed historical report có thể tìm lại bounded reader reference. Receipt không phải attempt, không nằm dưới `attempts/`, không đổi donor IDs hoặc tạo fake local result.
- Không đổi `cli_attempt_record` v1, worker `ExecutionResult`, observation v1 hoặc evaluator proposal v1.

Pin producing plan hash trong receipt là cần thiết để recipient tiếp tục bind exact descriptor đã nhận. Existing record đã pin result/output hashes; không duplicate output bytes hoặc trusted producer fingerprint vào mutable state. Receipt là one-writer enrollment record, không phải signed proof hay chống adversarial whole-store rewrite.

### Resolver và runtime claim

Tách bounded immutable attempt-chain reader từ existing resolver, nhận explicit producer root/run/unit/attempt reference; cả local acceptance và external receipt đều gọi cùng validator. Không tạo target-shaped synthetic unit state để lách local-summary constraints.

Mỗi use/restart/report phải kiểm tra:

- recipient marker → exact receipt bytes/hash → đúng target unit entry;
- regular contained donor run, authoritative readable marker/plan/inventory; producing run identity nguyên gốc;
- pinned attempt còn trong donor unit's successful local summaries với matching record hash/status/revision; không yêu cầu nó vẫn là latest accepted pointer sau khi donor tiến revision;
- immutable attempt → worker result → canonical observation bytes/hash; IDs, terminal status, nullability và contained paths exact;
- pinned producing plan hash, producing revision/member/serialized descriptor; derive producer locator/fingerprint, validate observation với producer locator;
- current target logical key và fingerprint exact-match trước khi coi external evidence là current;
- referenced donor unit bị integrity quarantine hoặc có contradictory late evidence phải reject. Donor có revision mới hợp lệ hoặc đổi current accepted pointer không được retarget receipt.

Missing/corrupt previously enrolled evidence là fail-closed command error, không fallback dispatch hoặc auto-repair. Không cần original source workspace còn tồn tại: immutable producing plan chứa exact invocation/schema/projection và locator đủ cho existing two-anchor contract. Symlink/path escape dưới donor và receipt paths phải reject.

Guarantee chỉ là exact harness-controlled input/options và valid recorded evidence theo CLI-first contract. CLI version hiện là audit metadata, chưa chứng minh hidden provider envelope hoặc stable server model snapshot. Không tự thêm attestation subsystem. Nếu owner đòi stronger provider/runtime equivalence, dừng phần đó để review scope. Calibration/live sau này phải pin cùng observed executable/version cho hai arms; historical PR6 `0.149.1` không mặc định equivalent host discovery `0.153.4`.

### Publication, restart và invalidation

Prepare donor graph hoàn toàn trong memory trước authoritative target publication. Materialize all target readers, write/re-read plan và immutable receipt, write/re-read initial unit states, cuối cùng mới exclusive-publish v3 `run.json`. Không publish v1 marker rồi nâng cấp donor run ở một cửa sổ khác. Partial root không marker vẫn unpublished; không scan/auto-adopt nó. Invalid donor không tạo authoritative target, local attempt hoặc model dispatch.

Subsequent revisions dùng existing `run.json`-last transition/recovery, mở rộng validators cho v3 marker/v2 state. Receipt không đổi. Sửa `rebaseUnitState` để zero local summaries không biến valid imported success thành pending. Khi behavior đổi, clear current external acceptance và mark pending; mọi local attempt đã có vẫn giữ ordinal/budget. Lần execute local đầu tiên là ordinal 1; invalidation tiếp theo tiếp tục ordinal 2, không reset.

Không tự re-import trên `run`, `resume`, `retry`, `patch-check` hoặc `prepare --run`. Receipt đã invalidated không tự thành accepted lại khi input quay về fingerprint cũ; giữ semantics current acceptance của existing run. Full fresh run mới có thể enroll donor rõ ràng lần nữa.

All scheduling/status/selection paths dùng normalized current success; external exact reader làm ready evaluator nhưng không allocate reader attempt. `retry` vẫn chỉ failed local units; unknown không retry. `patch-check` unchanged success vẫn ineligible, selected closure/budget all-or-nothing và mixed latch vẫn giữ. `status`/`report` không bootstrap, reconcile-write, Codex preflight hoặc dispatch.

### Dependency và report

Resolver trả thêm producer run attribution bên cạnh existing normalized evidence. Pure evaluator compiler giữ donor provenance trong `source_locator.accepted_results`; model-visible reader projection/rubric/output schema không đổi. Dependency equality vẫn exact array `{ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }`; không thêm run/path/revision vào semantic fingerprint. Không import evaluator evidence; evaluator reuse trong chính recipient run vẫn giữ existing rules.

Donor-enabled report dùng `cli_evaluation_report` v2: mỗi result có nullable `producer_run_id`, non-null cùng evidence, local evaluator dùng recipient ID. Validate producer revision trong đúng producer run, không so donor revision với recipient revision. Không dùng `attempt_id` đơn lẻ để đồng nhất evidence vì ID có thể trùng giữa runs.

Exact donor evidence có relation `current` khi fingerprint khớp, nhưng attribution phải thể hiện external producer và local attempt count 0. Đó không phải `retained_reference` chỉ vì khác run. Mixed-mode historical graph lookup bổ sung receipt entries bên cạnh local reader summaries, chỉ nhận semantic projection match với producing evaluator input; không giả exact original reader attempt từ output equality. Existing incomplete/unknown/quarantine precedence không thay đổi.

Keep static plan counts là raw graph/no-reuse upper estimate như hiện tại. Donor-enabled prepare result dùng version mới, báo riêng `imported_reader_unit_ids`, `imported_reader_count`, `expected_new_calls_without_retry = total_units - imported_reader_count`; không ghi đè historical `expected_calls_without_retry` semantics. Status/execution output phân biệt external reused IDs với local executed/attempt count; donor calls không cộng vào recipient dispatch. Không trình bày concurrency/time estimate cũ như đã tính donor savings; history/time có thể vẫn unknown.

## B. Configurable reader model/effort

Đề xuất `prepare ... --reader-model <id> --reader-effort <effort>`, mỗi flag optional một lần, chỉ new run. Omitted values resolve explicit `gpt-5.6-sol` và `medium`; đổi model nhưng omit effort vẫn medium. `prepare --run` từ chối override flags và kế thừa settings đã freeze, kể cả không dùng default hiện tại. Muốn đổi reader configuration tạo new run.

New configurable plan dùng `cli_execution_plan` v3, revision positive, giữ existing fields và thêm `reader_cli_behavior_options`. Existing `cli_behavior_options` tiếp tục sở hữu evaluator options và freeze Sol/medium. Reader/evaluator đều giữ read-only, ephemeral, ignore-user-config, ignore-rules. Không expose evaluator config, arbitrary `-c`, profiles, sandbox/permission/provider override hoặc service-tier controls.

Historical plan v1/v2 được validate với exact legacy Sol/medium literal, rồi project effective reader/evaluator options trong memory; không rewrite/hash-normalize artifacts. New v3 reader descriptors phải khớp `reader_cli_behavior_options` toàn run; baseline/candidate không có per-side override. Evaluator descriptors phải khớp evaluator options. Không để global default mới điều khiển historical validation.

Reader model là explicit non-empty safe identifier (ASCII letters/digits và `.`, `_`, `-`; không whitespace, slash, control characters, leading hyphen hoặc arbitrary config). Effort nhận enum `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`; đây là syntax contract, không claim mọi pair được provider hỗ trợ. Không hardcode model capability matrix, alias resolution hoặc fallback. Unsupported runtime/model/effort là truthful failure dưới existing result/budget semantics, không silent downgrade. `ultra` không thuộc frozen effort surface của workstream này.

Compiler resolve normalized effective options một lần; worker validate rồi dùng chính `prepared_unit.invocation.cli_options` để build argv model/effort/sandbox. Dùng argument array và canonical TOML string serialization, không shell interpolation. Evaluator output/input validation cũng dùng đúng prepared evaluator options. Low-level `execute-prepared` giữ default Sol/medium, không thêm public config surface thứ hai.

Plan v3 reader options tồn tại cả trong top-level freeze và exact descriptor projection nhưng phải được cross-validate; không tạo divergent SSOT. Model/effort đổi làm fingerprint đổi, donor Sol không thể satisfy Luna reader. Với default Sol, giữ exact reader/evaluator input/options fingerprints của legacy behavior khi bytes giống nhau.

## Checkpoint và file ownership

Một follow-up workstream, hai vertical implementation checkpoints tuần tự vì cùng source/state owners; không cần hai architecture phases hoặc parallel agents. CP1 hữu ích độc lập với CP2. Branch base cho delivery là refreshed main đã ghi; trước implementation đọc lại Git/owner decision, không tự rebase/switch nếu có drift. Mỗi checkpoint là review boundary, **không phải automatic commit**; English Conventional Commit chỉ đề xuất khi có actual diff pass.

| Checkpoint | Source | Tests | Docs và verification |
| --- | --- | --- | --- |
| CP0 — planning hiện tại | Không sửa source | Không thêm tests | Plan + owner brief + artifact index + progress + link từ CLI master; kiểm tra links, EOL/UTF-8, permission/status consistency và diff |
| CP1 — donor reuse hoàn chỉnh | `cli-run-state-v1.mjs`, `cli-execution-plan-v1.mjs`, `cli-evaluator-proposal-v1.mjs`, `cli-evaluation-report-v1.mjs`, `run-skill-eval-cli.mjs`; chỉ sửa `cli-impact-v1.mjs` nếu normalized interface cần, không đổi fingerprint thuật toán | Existing `run-skill-eval-cli.test.mjs`: full donor lifecycle và compatibility matrix bên dưới | Operator guide mô tả flag/counts/retention/report; plan/brief/progress ghi actual checkpoint; targeted tests rồi full CLI suite và hygiene; main integration review phải hết Critical/Required |
| CP2 — configurable reader hoàn chỉnh | `codex-cli-runner-v1.mjs`, `cli-execution-plan-v1.mjs`, `cli-run-state-v1.mjs`, `cli-evaluator-proposal-v1.mjs` khi cần, `run-skill-eval-cli.mjs`; report chỉ nếu actual config attribution cần, không thêm report subsystem | Cùng test file: options → descriptor → argv, two-sided parity, historical replay, donor mismatch và restart | Operator guide/config examples, plan/brief/progress; targeted tests rồi cumulative CLI/v1/validator checks, main integration review; chưa live |
| CP3 — chuẩn bị canary sau implementation | Không sửa product/harness chỉ để đạt canary | Deterministic current-head checks và exact package inspection, không model probe | Finalize 3–4-case canary manifest/grant request sau CP1–2, ghi exact refs/bytes/schema/runtime/commands/destination/ceilings; xin live authority riêng |

Source paths trong bảng nằm dưới `.agents/scripts/lib/skill-evals/` trừ hai entrypoint/test paths nằm trực tiếp dưới `.agents/scripts/`. Không thêm package dependency hoặc shared schema framework. Nếu implementation chứng minh phải thêm source module mới, report lý do/scope trước khi mở rộng contract; không tự tạo generic abstraction.

Docs dự kiến được chỉnh: workstream `plan.md`, `owner-review-brief.md`; `docs/agent-skills/progress.md`, `docs/agent-skills/eval-design.md`, `docs/agent-skills/implementation-plans/README.md`, và CLI-first master chỉ phần follow-up routing/superseded contract. Historical Stage 1–4 plans/owner decisions không rewrite. Root governance master/roadmap và PR6 acceptance docs không cần đổi để deliver harness; không claim PR6 findings resolved.

Checkpoint messages sau verification:

- CP0: `docs(skill-evals): plan reader reuse and model configuration`
- CP1: `feat(skill-evals): reuse exact reader evidence from explicit donor runs`
- CP2: `feat(skill-evals): configure reader model independently of evaluator`

## Acceptance và regression matrix

Tests dùng real temp filesystem + existing fake CLI child/injected worker, không installed Codex/network/model. Mỗi forbidden substitution bắt đầu bằng hai valid graphs, đổi một relationship, assert fail ở owner và zero downstream mutation/dispatch. Không chỉ corrupt JSON hoặc mock resolver để chứng minh provenance.

| Nhóm | Observable verification bắt buộc |
| --- | --- |
| Donor positive | Recipient reuse exact B/C readers, execute chỉ missing readers/evaluators; donor byte-identical; different workspace/variant A/B/ref/provenance hợp lệ không false-invalidate |
| Selectivity | Missing member/changed bundle/prompt/context/policy/schema/model/effort không match; failed/unknown/running/imported donor không enroll; unrelated terminal failures không chặn valid matched reader |
| Provenance negatives | Wrong run/unit/role/attempt/record/result/producing plan/output; hash-rebound valid donor substitutions vẫn fail relationship; zero target authoritative publication trước enrollment failure |
| Paths/integrity | Missing file, symlink donor root hoặc artifact path, path escape, noncanonical bytes/hash, late-result contradiction; enrolled corruption không trigger fallback call |
| Restart/publication | Crash trước marker, sau marker, giữa next-revision unit writes; external success survives với local count 0; receipt immutable; pin giữ đúng attempt khi donor revision/accepted pointer tiến hợp lệ |
| Budget/invalidation | Reuse không allocate; reader đổi input clear acceptance rồi local ordinal 1; revisions kế tiếp không reset lifetime ceiling; retry/unknown/patch-check eligibility unchanged |
| Dependencies | Imported reader unlocks đúng evaluator, one cap, evaluator không đi trước dependency; same-run evaluator reuse vẫn exact behavior + full output binding |
| Reports/history | Producer run/revision đúng kể cả donor rev lớn hơn target; same attempt ID ở hai runs không bị ghép; exact versus mixed/incomplete truth; invalidated external receipt chỉ historical semantic match; report/status byte-identical toàn donor/recipient trees |
| Config | Omitted settings giữ Sol/medium; explicit Luna/max ở cả baseline/candidate; fake child quan sát đúng argv; evaluator vẫn Sol/medium; defaults không override frozen options |
| Bad config | Duplicate/unknown/malformed flags và same-run override fail trước materialization; invalid pair không silent fallback; no arbitrary TOML/config injection |
| Compatibility | Historical run v1/v2, plans v1/v2, unit v1, report v1 và legacy evaluator-schema readback vẫn pass; default fingerprints unchanged; unknown versions fail closed; new artifacts không được old binary silently misread |
| Scope/counts | Empty scope, zero donor matches, all readers imported; static versus expected-new counts và local attempt/dispatch counts truthful; no evaluator cross-run cache |

CP1 có thể dùng fixed Sol plans cũ với donor-enabled run v3. CP2 thêm plan v3 cho new runs, kể cả non-donor; matching/default behavior vẫn phải tương đương. Marker v1 zero-attempt projection không được nuốt donor state; donor-enabled run luôn v3. Validators phải test các valid combinations này và reject impossible version combinations.

## Lệnh verification và review gates

Trước mỗi future implementation checkpoint, chạy targeted tests được chọn theo new behavior bằng `node --test --test-name-pattern '<actual names>' .agents/scripts/run-skill-eval-cli.test.mjs`. Sau targeted pass chạy full CLI suite một lần ở mỗi completed source checkpoint vì shared state/worker contracts; không lặp lại nếu không có diff mới. Header cập nhật theo counts thực tế, không copy số historical.

Sau CP2 chạy cumulative deterministic gates:

```powershell
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Thêm `node --check` cho từng changed `.mjs` và targeted ESLint bằng dependency đã cài; không tự install để chạy lint. Full CLI đã chạy tại CP2 final source diff thì không chạy lại ngay dưới nhãn cumulative. Existing Ubuntu CI đã chạy CLI suite; không cần thêm job hoặc sửa workflow. Chưa có remote CI claim nếu chưa được authorize delivery. Không chạy app build, browser E2E, Supabase reset, DB tests, CP8/CP9 hoặc whole-app tests cho scoped CLI-only change.

Mỗi checkpoint report source/tests/docs thực tế, command/counts/exit, skipped/environment limits, manual/live pending, risks và suggested commit. Main review kiểm tra invariants xuyên publication → state → resolver → worker → evaluator/report, không chỉ từng helper. Không tiếp tục khi còn Critical/Required; fix trong granted scope và re-review. Gaps không được đổi thành pass để tiết kiệm quota.

Planning này kế thừa discovery evidence: 8 targeted fake-only tests pass, 83 skipped; `codex --version`/`exec --help` quan sát `0.153.4`, local cache có Luna/max. Không rerun model và không coi đó là new implementation verification. Fixture readiness cho DB/browser `not applicable`; canary dùng frozen synthetic files, không chạy SQL/remote actions.

## Canary Luna Max — chỉ finalize sau implementation

Owner thay đề xuất 6-case calibration bằng **canary comparison 3–4 cases trước**. Chọn 4 làm ceiling mặc định; nếu giảm còn 3 phải chốt exact membership trước grant, không tự thêm case sau dispatch.

| Case đề xuất | Lý do |
| --- | --- |
| `ssm-route-nondb-zod-near-miss` | Routing/skip có nhiều skill, tránh over-trigger SSM |
| `ssm-fresh-remote-push-core-stop` | Permission boundary và fresh-reader core-only comprehension |
| `ssm-reg-additive-constraint-existing-data` | Known PR6 hard case về reference selection và verification truth |
| `ssm-reg-seed-safety` | Task tương đối rõ, làm control cho workload lặp lại |

Hai independent arms: mỗi case có baseline + candidate cùng reader settings; arm S = Sol/medium, arm L = Luna/max. Mỗi arm có một Sol/medium evaluator cho mỗi pair. Evaluator rubrics/schema/instructions giống nhau; dependency responses khác do chính reader experiment. Main adjudication review raw responses theo rubric, ẩn model label nếu có thể; Sol output không là ground truth.

| Phạm vi | Reader calls | Evaluator calls | Tổng dispatch tối đa |
| --- | ---: | ---: | ---: |
| 3 cases, hai arms | 12 | 6 | 18 |
| 4 cases, hai arms — đề xuất | 16 | 8 | 24 |

Chỉ bắt đầu CP3 khi donor reuse và reader configuration đã pass deterministic checkpoint verification. Canary fresh ở cả hai arms, không donor reuse hoặc historical evaluator substitution để tránh làm lẫn model effect với reused sample. Hai separate runs, `max_attempts=1`, concurrency tối đa `2` trên toàn experiment, chạy arms tuần tự; `retry=0`, automatic retry `0`, no resume-after-stop/replacement dispatch. Execute từng case closure bằng một command, đọc settled result và adjudication trước khi issue closure kế tiếp. Khi có operational/unknown/integrity failure hoặc confirmed safety veto, không issue command tiếp; settle các worker đã started và giữ accounting thật. Không thêm fail-fast scheduler chỉ cho canary, không blind retry timeout.

CP3 phải finalize trước xin authority:

1. Pin immutable B/C refs và exact existing package snapshots cho mọi case/role; audit raw bytes/EOL, context inventory, reader stdin/output schema, evaluator rubric/config/schema. Historical B=`2be02df...`, C=`af732c2...` chỉ là lựa chọn có known findings, không final-acceptance mặc định; owner chọn exact pair trong final canary brief. Không dùng current-tree drift hoặc đổi packages/rubrics giữa arms.
2. Compile từ cùng validated workspace/package set, so reader content bytes/schema bằng nhau giữa arms, chỉ model/effort projection khác. Record exact unit IDs, plan/config hashes, executable/version và billing/auth mode mà không đọc/log credential secret. Không biến non-model help/cache thành provider readiness proof.
3. Prepare whole static scope theo current compiler nếu cần, nhưng command grant chỉ selected 3–4 case closures qua existing `patch-check --unit`, mỗi command chọn hai reader roles của đúng một case bằng existing reader-ID syntax; downstream evaluator thuộc computed closure. Không chạy toàn bộ `run`/`resume` rồi hy vọng dừng kịp. Freeze exact closure IDs và đọc expected calls trước dispatch. Whole-run report có thể mixed/incomplete với exit `1` vì các case ngoài canary còn pending: đánh giá completeness trên đúng selected graphs của hai arms, không chạy thêm case để ép whole-run report exit `0`.
4. Record evidence destination ngoài tracked source, allowed commands, two run IDs, role ceilings, stop behavior và separate live/egress authority. Chưa có các locator/hash này thì trạng thái `not_ready_for_live`, không invent placeholder grant hoặc xin blanket authority.
5. Sau grant mới chạy. Giữ raw events và parse trustworthy usage khi có; API reasoning tokens tính output cost, không đếm visible response words làm tổng tokens. Missing usage ghi unavailable; 24 là subprocess-dispatch ceiling, không claim provider-internal request count hoặc hard dollar/token cap mà CLI không enforce.

Điều kiện **chỉ để đề xuất mở rộng**, không đổi default: tất cả graph đủ trustworthy output; Luna không có confirmed safety/permission/verification-truth regression; từng material criterion không kém Sol sau adjudication với exact rubric/context; không làm comparison delta mất khả năng phát hiện known issue; schema/process reliability chấp nhận được và actual observed cost/latency có lợi. Nếu cả hai cùng sai material criterion, không gọi parity là đủ ổn. Uncertainty, incomplete hoặc regression => giữ Sol, report gap, không tự tăng effort/retry/fanout.

Nếu canary đạt, chỉ đề xuất calibration rộng hơn theo case classes chưa phủ (Storage/RPC/concurrency/long context) cùng ceiling và authority mới. Không tự chạy 6-case/full-22 fanout; 3–4 cases không chứng minh general default quality. Default reader vẫn Sol Medium cho tới quyết định riêng ngay cả khi canary đạt.

Official sources đã đọc trong discovery ngày `2026-09-06`: [Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [Codex model guidance](https://learn.chatgpt.com/docs/models), [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [non-interactive CLI](https://learn.chatgpt.com/docs/non-interactive-mode), [reasoning usage](https://developers.openai.com/api/docs/guides/reasoning), [eval best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Model page/local catalog có `max` nhưng config reference còn liệt kê tới `xhigh`; recheck trên intended runtime ở CP3. Không suy Luna fit từ benchmark tổng hợp hoặc đơn giá.

## ROI, rủi ro, rollback và handoff

Forecast PR6: nếu đủ 17 unchanged exact-valid baseline donors, `51 → 34` new dispatch, tiết kiệm 17/33.3%; 22-case full comparison có đủ baseline donors thì `66 → 44`. Không bảo đảm donor còn tồn tại trong OS temp. Luna config không giảm số dispatch; model/effort khác invalidate donor Sol. Actual quota/cost saving cần usage evidence riêng.

| Rủi ro | Giới hạn/xử lý |
| --- | --- |
| Donor temp files bị mất | Read-only fail closed; giữ donor tree khi recipient còn cần; không xây cleanup/retention service |
| Silent provenance hoặc attempt laundering | Immutable receipt, producer-root resolver, local count 0, full graph negatives |
| Crash tạo false success | Plan/receipt/states barrier và marker-last; test every publication window |
| Historical default drift | Version-dispatched legacy literals và prepared-options execution; no artifact rewrite |
| Mixed report ghép nhầm graph | Producer-qualified attribution, semantic match với producing evaluator input, không dùng attempt ID đơn lẻ |
| Luna rẻ nhưng yếu hoặc timeout ở max | Default giữ Sol, small paired canary với riêng grant, no automatic escalation |
| Scope mở sang certification/cache architecture | Stop affected work, report exact gap và xin scope decision; không tự implement workaround |

Rollback implementation bằng owner-approved correction/revert commit khi cần; không reset/delete donor/recipient evidence hoặc rewrite historical runs. Old binary chỉ vận hành old formats; new marker/plan/state/report versions phải fail loud nếu binary cũ không hiểu, không downgrade artifacts. Cross-run evidence là reuse một prior sample, không phải repeatability proof hoặc independent fresh sample mới.

Implementing agent đọc plan + owner brief + current progress + relevant skills, kiểm tra branch/base/diff, bắt đầu CP1 rồi CP2, report checkpoint trước commit. CP3 chỉ chuẩn bị/review canary sau implementation và không chạy live. Permission cho source implementation và từng local commit đến từ instruction hiện tại; live canary, push/PR/merge vẫn bị loại trừ.

## Main plan self-review

Đã đối chiếu requested scope với source/tests và Stage 1–4: giữ single writer, lifetime budget, current/mixed truth, advisory authority, exact legacy defaults và actual producer lineage. Design chọn immutable enrollment receipt vì restart/historical lookup cần stable source; không mở global index/retention backend. Đã tách default config khỏi legacy validator; donor-zero-attempt và producer-revision report pitfalls có explicit acceptance tests. `0 specialist`, không live/model call.

Plan decision là `frozen / owner-approved`; self-review xác nhận không có contract-level contradiction với branch/repo hiện tại. CP1 implementation và deterministic verification đã hoàn tất trong working tree sau khi tiếp quản partial diff; CP2/CP3 chưa bắt đầu. Live/model/evaluator, egress, push/PR/merge vẫn `not_run` và không được cấp. Confidence về phạm vi và discovery `High`; implementation safety của CP1 được xác lập sau tests, hygiene và main integration review đã liệt kê.

CP0 verification: 5 planning docs được kiểm tra UTF-8 không BOM, newline/fences/conflict markers; 87 relative links và 4 canary case IDs tồn tại. `git diff --check` pass; chỉ 5 planning docs là task-owned; HEAD/main/origin-main cùng base đã ghi, ahead/behind `0/0`. Tại CP0 source implementation chưa bắt đầu; không có live/model call.

## CP1 actual checkpoint — 2026-09-06

- Tiếp quản từ `d093b08`, đọc lại branch/worktree và reconstructed toàn bộ partial diff. Kết luận: diff sound/continuable, không có plan/contract conflict; không discard user-owned changes.
- Implemented đúng CP1 boundary: explicit `--reuse-readers-from`, donor-only local reader enrollment, immutable `reader-reuse.json`, `cli_run` v3 và unit state v2, shared producer-root attempt resolver, invalidation/rebase/counts, producer-run report attribution, mixed historical receipt lookup, và v3/unit-state compatibility guard. Không đổi fingerprint algorithm, evaluator cross-run reuse, hoặc thêm dependency.
- Verification: targeted CP1 `9/9`; full `.agents/scripts/run-skill-eval-cli.test.mjs` `105/105`; changed `.mjs` `node --check`; targeted ESLint `0 errors`; `git diff --check` pass. Fake child/local temp fixtures only; no live/model/provider/evaluator call.
- CP1 docs/operator guide đã reconcile trong `eval-design.md`, workstream plan/brief và `progress.md`. CP1 local checkpoint commit được thực hiện sau review này với frozen message; CP2/CP3, live canary, push/PR/merge vẫn chưa thực hiện.
