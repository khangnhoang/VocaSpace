# Agent Skill Eval Harness CLI-first — master implementation plan

## Trạng thái và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Planning branch: `feat/agent-skill-eval-cli-first`.
- Synchronized base: `origin/main` tại `16bf80babd129fb42572603c7204e7c368aa3e67` ngày `2026-08-30`.
- Document status: `reviewed / implementation_pending`; terminal staged review `0 Critical / 0 Required`.
- Implementation status: `not_started`.
- Quyền hiện tại chỉ gồm lập plan, review, commit và push tài liệu plan. Không checkpoint implementation hoặc live model/evaluator call nào được cấp quyền bởi tài liệu này.

Tài liệu này là master implementation plan của CLI-first program: nó sở hữu stage/branch order, checkpoint boundaries, acceptance criteria và verification. [Owner review brief](./owner-review-brief.md) là decision surface rút gọn; [program master plan](../../plan.md) sở hữu higher-level intent; [progress](../../progress.md) sở hữu current status.

## Mục tiêu gốc phải đạt trước tiên

Harness phải **chạy được bằng Codex CLI** và giải quyết đúng hai nguồn lãng phí đã tạo ra nhu cầu ban đầu:

1. `prepare` hoàn tất validation của toàn bộ selected static scope và đóng gói đủ prompt, context, skill/reference documents, output schema cùng model/runtime options cho mọi reader **trước reader call đầu tiên**; downstream evaluator package phải được finalize từ validated reader results và pass cùng nguyên tắc trước evaluator call tương ứng;
2. sau một failure hoặc một thay đổi bounded, harness giữ nguyên kết quả tốt, chỉ chạy lại unit bị ảnh hưởng và các dependent downstream của unit đó, thay vì mặc định chạy lại full run.

Luồng program target:

```text
validate all selected static inputs + prepare all reader units
  → immutable prepared unit packages
  → fresh ephemeral `codex exec` per reader unit
  → validated per-unit result
  → finalize + validate evaluator unit when reader dependencies are ready
  → fresh ephemeral `codex exec` per evaluator unit
  → status/report

failure/change
  → classify affected unit(s)
  → preserve completed independent units
  → rerun affected unit(s) + downstream dependents only
```

Thành công không phải là “có thêm adapter CLI” trên giấy. Thành công nghĩa là một operator có thể dùng command surface thực tế để:

- prepare một selected run mà không gọi model;
- chạy reader/evaluator bằng installed Codex CLI;
- thấy status theo unit;
- resume sau harness process interruption;
- retry một unit local failure mà không dispatch lại independent successes;
- thay một case input/evaluator input và chỉ invalidated unit cộng dependency closure;
- chạy tối đa một số CLI process có giới hạn;
- tạo report phản ánh rõ current, reused, failed, blocked và patch-check units.

## Lập trường kiến trúc

Chọn **CLI-only program**:

- runtime duy nhất trong workstream này là fresh/ephemeral `codex exec` subprocess;
- reuse deterministic `validate → prepare → report` foundation hiện có, đặc biệt synthetic per-case packages;
- thêm một CLI runner nhỏ, state theo unit và dependency graph tối thiểu;
- không làm App Server backend, native Codex subagent backend hoặc generic multi-backend abstraction trong program này;
- không xóa đường mở rộng: runtime invocation nằm sau một bounded internal function/interface, nhưng không tạo plugin registry, capability matrix hoặc backend-neutral schema khi chưa có backend thứ hai;
- không tiếp tục mở rộng App Server-oriented v2 harness để làm CLI path.

Lý do: mục tiêu hiện tại là operational throughput và bounded rerun. Mang lại toàn bộ attestation, authority, retention và transport certainty của hardening v2 sẽ lặp lại độ phức tạp đã làm lệch mục tiêu, trong khi CLI không expose đủ dữ liệu để chứng minh các guarantee đó.

## Program delivery shape

Không dồn toàn bộ implementation vào một long-lived branch. Current branch chỉ giao master plan; mỗi stage sau dùng một independent branch/PR tạo từ refreshed `main` sau khi stage trước merge:

| Stage | Planned branch | Outcome bắt buộc |
| --- | --- | --- |
| Stage 0 | `feat/agent-skill-eval-cli-first` | Master plan only; no runner implementation |
| Stage 1 | `feat/agent-skill-eval-cli-runner` | CLI runner chạy bounded parallel theo production shape trên existing prepared workspace |
| Stage 2 | `feat/agent-skill-eval-cli-prepare` | Prepare-all static barrier, execution plan và concurrency estimate |
| Stage 3 | `feat/agent-skill-eval-cli-reuse` | Exact reuse, resume, unit-local retry và affected/dependency-only rerun |
| Stage 4 | `feat/agent-skill-eval-cli-evaluator-report` | Evaluator scheduling, report/CI/docs và bounded migration pilot |

Branch names là planned names; implementation agent xác nhận conflict và refreshed base trước khi tạo. Branches không stacked mặc định. Không stage sau nào được inherit implementation, push, PR, live-call hoặc merge permission từ stage trước.

## Những gì CLI program không tuyên bố

Không implement hoặc claim:

- exact provider request/model-visible envelope ngoài input harness cấp cho `codex exec`;
- proof rằng model/provider call chắc chắn đã hoặc chưa xảy ra trong mọi crash window;
- runtime-enforced credential, network, filesystem hoặc tool isolation ngoài behavior mà Codex CLI công khai và process exit/output quan sát được;
- security hardening, signed evidence, append-only audit chain, cleanup authority, remote shadow-thread lifecycle hoặc forensic retention;
- App Server certification, native-subagent equivalence, distributed scheduler, multi-host store hoặc multiple harness writers;
- automatic semantic inference rằng một dòng đổi trong shared `SKILL.md` không thể ảnh hưởng case khác;
- token/cost accounting nếu Codex CLI không trả dữ liệu đáng tin cậy trong observable output;
- production-readiness hoặc security-readiness từ một pilot eval.

Các giới hạn này phải hiện trong `--help`/operator docs và report metadata ở mức ngắn gọn. Không dựng thêm subsystem chỉ để “chứng minh” điều CLI không quan sát được.

## Design-change escalation — không tự harden âm thầm

Nếu implementation phát hiện plan không khả thi, contract mâu thuẫn hoặc CLI không hỗ trợ assumption đã ghi, agent phải:

1. dừng affected checkpoint trước material design edit;
2. đọc lại exact source/tests/current CLI help và official docs liên quan;
3. báo owner evidence, impact, alternatives và recommendation;
4. chờ owner xác nhận nếu thay đổi runtime/backend, state/reuse semantics, command surface, stage/branch order, live-call boundary, report authority hoặc scope/exclusion;
5. update master plan + owner brief + progress và review lại trước implementation theo design mới.

Agent không được tự biến một gap thành attestation, security hardening, audit subsystem, generic abstraction hoặc App Server/native-subagent work mà owner không biết. Bounded bug fix giữ nguyên approved design có thể làm trong checkpoint đã authorize, nhưng phải được ghi trong checkpoint report; nếu không chắc đó là bug fix hay design change, treat as design change và báo owner.

## State tối thiểu vẫn bắt buộc

“Không hardening/evidence” không có nghĩa là bỏ manifest, hash hoặc dependency. Ba thứ này là functional state của chính mục tiêu resume/reuse:

- stable `unit_id` cho reader/evaluator;
- hash của exact prepared model input và execution options của unit;
- dependency edges reader → evaluator → report;
- per-unit state `pending | running | succeeded | failed | outcome_unknown | blocked`;
- bounded attempt list và accepted result path/hash;
- run-level selected scope và concurrency/retry settings.

State dùng local per-run files và one harness writer. Atomic temp-write/rename chỉ bảo vệ resume state khỏi partial local write; nó không được mô tả là security hoặc audit guarantee.

## Repository discovery đã xác nhận

- `.agents/scripts/run-skill-evals.mjs` hiện sở hữu `validate`, `prepare --isolation synthetic` và `report`.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` đã tạo deterministic workspace, per-case prompt/context, `execution-context-manifest.json`, skill/reference bundle và output templates.
- `.agents/scripts/run-skill-eval-harness.mjs` cùng v2 modules hiện tập trung vào App Server/CP9 contracts; CLI-first workstream không cần mở rộng contract đó để đạt mục tiêu gốc.
- CI hiện chạy v1 runner tests, v2 harness tests và repository/suite validation.
- Local Codex CLI `0.151.0-alpha.7.2` expose non-interactive `codex exec`, prompt từ stdin, `--ephemeral`, `--json`, `--output-schema`, `--output-last-message`, `--model`, `--sandbox`, `--cd` và `--ignore-user-config`.
- [Official Codex CLI reference](https://developers.openai.com/codex/cli/reference) mô tả `codex exec` là non-interactive command, có JSONL output, structured output schema và ephemeral mode. Exact available flags vẫn phải được preflight từ installed executable tại runtime; plan không pin alpha version làm product contract.

## Reuse và invalidation — ranh giới trung thực

### Automatic exact reuse

Một `succeeded` unit được reuse tự động chỉ khi exact prepared model input, output schema và behavior-relevant CLI options của unit không đổi. Downstream unit được reuse khi input riêng và hashes của mọi required dependency đều không đổi.

Ví dụ:

- typo chỉ trong context của case A → rerun reader A và evaluator A;
- evaluator rubric/schema đổi → giữ reader results, rerun affected evaluator units;
- reader A timeout hoặc malformed output → retry reader A; evaluator A đợi, case B–N tiếp tục;
- report rendering đổi → không rerun reader/evaluator.

### Shared skill change

Nếu full `SKILL.md` là model-visible input của mọi reader, một thay đổi trong file đó làm đổi exact input của mọi reader. Harness không được tự tuyên bố các reader khác “unaffected” bằng semantic guessing.

Để vòng chỉnh sửa 1–2 dòng không phải đốt full run ngay lập tức, Stage 3 có `patch-check`/affected-only operation:

- operator nêu explicit affected unit IDs;
- harness chạy các unit đó và dependency closure trên package mới;
- prior successes của unit khác được giữ làm historical reference, không bị xóa;
- status/report đánh dấu run là partial/mixed-revision patch check và không claim complete current-revision coverage.

Khi cần final exact-current report, mọi unit có changed exact input phải được chạy hoặc có exact-current success. Package slicing/declared section-to-case dependency có thể làm finer-grained exact reuse trong future workstream, nhưng không thuộc program này vì nó thay đổi model-visible evaluation contract.

## Command surface dự kiến

Exact spelling được freeze ở S1-CP1 sau khi đối chiếu conventions, nhưng program phải có các capability sau:

```text
prepare             # validate + create every selected unit package, zero model calls
run                 # run prepared pending units
status              # show per-unit and aggregate state
resume              # continue pending/failed-safe work without rerunning successes
retry --unit ...    # retry explicit failed unit(s), then downstream dependents
patch-check --unit ... # run explicit affected closure against changed shared input
report              # summarize exact-current or clearly partial/mixed state

common execution options:
  --concurrency <n>       # number of simultaneous fresh CLI processes
  --max-concurrency <n>   # owner/operator ceiling used by recommendation
  --target-minutes <n>    # optional wall-time target for planning
```

Không có arbitrary prompt command. Runner chỉ consume validated prepared packages owned by the workspace.

## Stage và checkpoint breakdown

### Stage 0 — Master plan only

Branch: `feat/agent-skill-eval-cli-first`.

- S0-CP1: confirm CLI/process, prepared-workspace and independent-branch feasibility.
- S0-CP2: freeze program stages, design escalation, concurrency sizing and permission boundaries.
- S0-CP3: validate docs/source-of-truth links, staged diff and formal review.

Acceptance: docs-only diff; validation pass; terminal review `0 Critical / 0 Required`; one English Conventional Commit and normal push. No runner source/workflow edit và model calls `0`.

### Stage 1 — Runnable bounded-parallel CLI runner

Branch: `feat/agent-skill-eval-cli-runner`, from refreshed `main` after Stage 0 delivery/merge decision.

Stage 1 consumes an existing validated workspace from `run-skill-evals prepare`; it does not rebuild prepare orchestration.

- S1-CP1: new small CLI entrypoint, installed-executable/flag preflight and bounded invocation function for fresh `codex exec --ephemeral` with stdin prompt, structured output schema and isolated per-unit outputs.
- S1-CP2: sequential vertical-slice test on the same branch proves one prepared unit can invoke, finish and validate correctly. Sequential is a diagnostic gate only, not target architecture or a separately mergeable delivery.
- S1-CP3: bounded worker pool on the same branch; default concurrency `4`, explicit operator cap, one fresh process per active unit, one coordinator, configured timeout and independent failure isolation.
- S1-CP4: parallel integration tests prove overlap, cap enforcement, per-unit output binding and local-failure survival. Stage 1 is not complete and its PR is not merge-ready if only the sequential slice passes.
- S1-CP5: after deterministic review, a separately authorized live gate runs exactly one reader unit sequentially, then exactly two **different** prepared reader units concurrently at concurrency `2`. Stop before parallel if the sequential canary fails. Stage 1 live ceiling is therefore `3 reader / 0 evaluator / 0 automatic retry`; no wider expansion belongs to this stage.

Acceptance:

- tests observe real overlap with `active_count > 1` and never exceed cap;
- one process start failure, nonzero exit, timeout or malformed output does not cancel independent units;
- same unit never has simultaneous attempts;
- exact argv/stdin/cwd/schema works with Windows/spaced paths;
- deterministic tests make zero real calls;
- sequential pass proves only that one CLI invocation works;
- Stage 1 cannot claim “harness works as intended” or close until bounded parallel behavior passes;
- actual-model CLI behavior remains unverified until the separately authorized sequential-then-parallel live gate passes.

Forbidden quota pattern: full or representative-large sequential batch followed by the same full parallel batch. Deterministic fake-process tests may use many units because they make zero model calls; live Stage 1 uses only the `1 + 2` canary above. Full migration is not authorized until later stages provide prepare, recovery/reuse and final execution planning.

Stop if installed CLI cannot consume a prepared package non-interactively or structured output cannot be bound to one invocation. Do not fall back silently to App Server.

### Stage 2 — Prepare barrier, execution plan and concurrency estimate

Branch: `feat/agent-skill-eval-cli-prepare`, from refreshed `main` after Stage 1 merge.

- S2-CP1: reuse v1 suite validation/synthetic packaging; compile exact reader units plus evaluator static plans/dependency skeletons.
- S2-CP2: validate all selected static inputs, required files, output schemas, CLI config and writable run root before first reader dispatch.
- S2-CP3: emit total reader/evaluator units, ready-set/dependency waves, expected calls and a concurrency recommendation.
- S2-CP4: finalize each evaluator input/hash only after required reader results exist and validate it before its evaluator call.

Concurrency sizing:

```text
total_work_seconds = sum(estimated duration of selected runnable units)
concurrency_for_target = ceil(total_work_seconds / target_wall_time_seconds)
recommended_concurrency = min(
  max(1, concurrency_for_target),
  owner_max_concurrency,
  local_process_cap,
  observed_rate_limit_cap
)
estimated_wall_time >= max(total_work_seconds / recommended_concurrency,
                           dependency_critical_path_seconds)
```

- If no trustworthy duration/rate-limit history exists, report those inputs as `unknown` and recommend `min(4, owner/local caps)` rather than inventing precision.
- For `30` independent units and concurrency `4`, show `ceil(30/4) = 8` scheduling waves; evaluator dependencies are calculated separately or through the DAG critical path.
- Concurrency changes wall time, not total quota. Expected calls remain unit count plus explicitly authorized retries.
- Duration calibration reuses timing from already-authorized canary/migration units; it does not run an extra full sequential benchmark.
- `429`, repeated transport failure or local resource pressure blocks fan-out increase; current program does not need an automatic adaptive controller.

Acceptance: invalid/missing selected static input yields reader dispatch count `0`; generated plan accounts for every unit/dependency; estimate exposes assumptions and caps; no unsupported rate-limit certainty claim.

### Stage 3 — Exact reuse, resume and affected-only rerun

Branch: `feat/agent-skill-eval-cli-reuse`, from refreshed `main` after Stage 2 merge.

- S3-CP1: stable unit IDs and exact reader/evaluator input/config hashes.
- S3-CP2: minimal one-writer per-run state and atomic local updates.
- S3-CP3: resume pending work, retain exact successes and explicit `retry --unit`; no automatic retry. Leftover `running` after process loss becomes `outcome_unknown` and needs explicit operator action.
- S3-CP4: dependency-bounded invalidation and explicitly selected `patch-check` with partial/mixed-revision labeling.

Acceptance:

- process restart does not rerun exact successes;
- case-local input change reruns that reader plus downstream evaluator only;
- evaluator-only change preserves reader results;
- local failure affects one unit and dependents while independent workers continue;
- shared `SKILL.md` change affects every exact input receiving it; patch-check never appears as complete exact-current report.

### Stage 4 — Evaluator, report and migration completion

Branch: `feat/agent-skill-eval-cli-evaluator-report`, from refreshed `main` after Stage 3 merge.

- S4-CP1: evaluator as an ordinary dependent CLI unit; model output remains advisory/draft and is not relabeled human-authored.
- S4-CP2: smallest truthful bridge to current v1 report, or a small CLI-first report shape if v1 human-evaluation semantics cannot be reused.
- S4-CP3: deterministic CI and operator docs covering prepare, estimate, run, failure, resume, retry, patch-check and report.
- S4-CP4: separately authorized pilot/migration batch using Stage 2 recommendation and explicit call/concurrency ceilings.

Acceptance: fake end-to-end prepare → parallel execute → one-unit failure → resume/retry affected closure → evaluator/report passes; cumulative review `0 Critical / 0 Required`; live result claims only observed CLI behavior.

## Expected source ownership by stage

Exact names may be adjusted at the owning checkpoint to match conventions, nhưng một stage không được prebuild files/abstractions của later stage:

| Stage | Expected source ownership |
| --- | --- |
| Stage 1 | new `.agents/scripts/run-skill-eval-cli.mjs`, focused test file và `codex-cli-runner-v1.mjs` process/worker-pool seam only |
| Stage 2 | `cli-execution-plan-v1.mjs` plus minimal reuse/extension of v1 suite/synthetic-workspace modules; no resume/reuse state |
| Stage 3 | `cli-run-state-v1.mjs`, `cli-impact-v1.mjs` and corresponding command/test extensions |
| Stage 4 | evaluator/report bridge, deterministic `.github/workflows/ci.yml` test step and bounded `docs/agent-skills/eval-design.md` operator docs |
| Every stage | exact status reconciliation in `docs/agent-skills/progress.md`; master plan changes only through the design-change protocol |

Prefer reuse of v1 schema/workspace modules. Do not edit App Server/CP9 modules unless a later repository fact proves a shared pure helper must move; such a change is material, requires owner notification, plan update and re-review first.

## Verification strategy

No live model is needed for deterministic implementation review. Stage 1 actual-CLI canary và Stage 4 pilot remain separately authorized live gates. Required deterministic layers:

- unit tests for identity, dependency closure, state transitions and command construction;
- integration-style fake child-process tests for success, local failure, malformed output, timeout/interruption, restart, retry and concurrency;
- existing v1 runner and repository/suite validators;
- syntax, targeted lint if applicable, `git diff --check`, added-line secret/conflict scan;
- per-checkpoint staged-diff review and cumulative branch review.

Tests assert observable behavior: dispatch counts by unit, persisted status, reuse/rerun sets, dependency blocking and report completeness label. They must not mock away the coordinator/store boundary being tested.

## Delivery and review gates

Every implementation checkpoint is an independent rollback/review boundary:

```text
implement one CP
  → focused deterministic verification
  → inspect working diff
  → stage explicit CP files
  → inspect staged diff
  → formal review
  → require 0 Critical / 0 Required
  → English Conventional Commit
```

Push, PR creation, CI watch/fix, merge and live model calls remain separate permissions unless the owner explicitly grants them for that checkpoint. No implementation begins merely because Stage 0 master plan is pushed.

## Risks và stop conditions

- If structured CLI output cannot be bound reliably to one invocation, stop before persistent success/reuse is implemented.
- If evaluator output cannot fit current v1 human-evaluation contract without false attribution, add a small CLI-first draft/report shape; do not mislabel model output as human evidence.
- If exact-current reuse and “one-line shared skill edit reruns only one case” conflict, preserve exact-current correctness and use patch-check. Do not hide mixed revisions.
- If bounded concurrency needs multiple writers or cross-process locks, keep single coordinator and lower concurrency; do not build a distributed store.
- If required work expands into App Server/native subagent/security hardening, stop and request a separate plan decision.

## Owner decisions đã chốt và gate còn lại

Owner direction trong task hiện tại đã chốt:

1. CLI-only program; App Server/native subagent/multi-backend nằm ngoài implementation scope và không block CLI path.
2. Master plan dùng Stage 0 planning branch rồi bốn independent implementation branches/PRs, merge tuần tự từ refreshed `main`.
3. Stage 1 phải chạy bounded parallel theo production shape; sequential-only runner không phải target architecture.
4. Stage 2 phải chuẩn bị/validate trước call và tính concurrency từ unit count, duration/target/caps; không invent rate-limit certainty.
5. Stage 3 sở hữu exact reuse/resume/affected rerun; Stage 4 sở hữu evaluator/report/pilot completion.
6. Không dựng hardening/attestation mà Codex CLI không hỗ trợ; vẫn giữ functional state tối thiểu cho resume/reuse.
7. Mọi material design conflict phải báo owner và update/review plan trước; không tự harden hoặc đổi architecture âm thầm.
8. Stage 0 chỉ lập, review, commit và push master plan; chưa implement runner.

Owner đã approve master-plan direction và yêu cầu review-pass delivery. Quyền bắt đầu Stage 1 implementation vẫn là gate riêng chưa được cấp.
