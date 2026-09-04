# ASM-PR6 — kế hoạch triển khai mỏng cho `supabase-safe-migration`

## Trạng thái và nguồn thẩm quyền

Owner instruction ngày `2026-09-04`: “thực hiện detail plan asm pr6” duyệt detailed plan hiện tại và cấp local implementation theo đúng checkpoints. CP0 hoàn tất; CP1 committed tại `C_struct = 871dabcb34ab6125ccb75a6d2f2ced523a748c54` sau owner đồng ý local commit. CP2 implemented/verified, chưa commit; CP3/CP4 chưa thực hiện. Grant commit CP1 đã consumed, không cấp commit CP2 hoặc live/model/egress/retry, push, PR, CI, merge và database actions. Những trạng thái cũ trong evidence planning/CP1 là lịch sử trước checkpoint hiện tại.

- [Master](../../plan.md) và [roadmap](../../structural-migration-roadmap.md) sở hữu program scope/order/invariants; [progress](../../progress.md) sở hữu actual status; [owner brief](./owner-review-brief.md) ghi quyết định PR6.
- [CLI master](../eval-harness-cli-first/plan.md), [Stage 3](../eval-harness-cli-first/stage-3-cli-reuse.md), [Stage 4](../eval-harness-cli-first/stage-4-cli-evaluator-report.md) và [operator guide](../../eval-design.md) sở hữu execution/reuse/report procedure hiện hành. PR6 không thiết kế lại harness.
- [Stage 4 closure/pilot evidence](../../progress.md#7-stage-4-tooling-closure-và-migration-handoff-2026-09-04) là migration handoff, không phải semantic acceptance.
- Đọc `AGENTS.md`, `docs/agent-loops.md`, các skill `implementation-planning-and-pr-breakdown`, `maintain-repo-skills`, `supabase-safe-migration`, `test-quality-strategy`, `git-checkpoint-workflow`; dùng `code-review-and-quality` cho checkpoint/correction/cumulative review. References đã áp dụng khi lập kế hoạch: planning tracked-program/handoff; governance progressive-disclosure/fresh-reader/eval-design; Git branch-start; review domain dimensions.

Sizing: preliminary `large/high-risk` do reconciliation nhiều owner; final là một PR có phạm vi skill hẹp nhưng acceptance nhạy cảm về DB/permission. Giữ một plan mỏng, checkpoints tuần tự, `0 specialist`; không có residual planning uncertainty cần delegation. Manual semantic review về sau là bắt buộc; không phải database QA.

## Baseline đã xác minh

`B = 2be02df11e279b5c88f37d2fd609069a54c235ed`, exact refreshed `main == origin/main`, PR #81 merge. Nhánh `refactor/agent-skills-asm-pr6-supabase` tạo từ B, không stacked. Preflight tree/index sạch; local main từ `69e7235` fast-forward 12 commits, ahead/behind `0/0`. Git xác nhận các ancestors:

- ASM-PR5B / PR #73: `effb5571955aa09b714e97b7162a6bb3bed0bca4`.
- Corrected DB coverage: `35cc5a115751412b43253cd100ba6a8df5503af0`.
- Stage 4 closure head: `721030d9d772ff190354d61afc02de29edf40a55`.

| Artifact tại B | Git blob/tree |
| --- | --- |
| `.agents/skills/supabase-safe-migration/SKILL.md` | `a2ae145d2e4cc77a66e5fa9bde898028ca02458f` |
| `.agents/evals/supabase-safe-migration/regression.json` | `34e4e566a0e06838ed56d0e1dca54ac266cde07c` |
| `.agents/evals/supabase-safe-migration/routing.json` | `a67bd579bb3853a11bd77f7a70cd8d7bc31d687d` |
| `.agents/evals/supabase-safe-migration/fresh-reader.json` | `36a2b40826becdb4e1542b309cf31b30d58ca4af` |
| `docs/adr/refactor-exercise-authoring.md` | `98c9cb3cc13bbec2defb245fcdc41d333a469b24` |
| `.agents/scripts` | tree `c8f0e97c57bbb743b80d39e9708792eefdc9aa55` |

Baseline **skill bytes** tại B giống ASM-PR5B merge; suite regression và ADR đã đổi. Dùng B làm immutable baseline source, không dùng old evaluator output hoặc pilot làm accepted baseline. Baseline được giữ để so sánh ngay cả khi có defect; không sửa B, không gọi baseline là semantic pass.

Control plane của mọi comparison có provenance từ đúng ba suites tại B, toàn bộ `executor_input.context`/inline text và `evaluator_only` trong chúng. Inventory là ba suite files cộng union các `repository_file` context được derive từ ba suite JSON tại B: hiện có `3 + 20 = 23` files, không chỉ ADR trong bảng. Không thêm related skill prose, planner narrative, expected answer hay reference hint vào reader package. `AGENTS.md` và các SQL/tests/actions/schema/config/seed được suite chọn chỉ là read-only context.

**Pinning gồm hai lớp, không thay thế nhau:**

1. **Provenance với B:** đọc Git blob bằng byte buffer; với từng suite/context, so nội dung sau phép chuẩn hóa duy nhất `CRLF → LF` ở cả working-tree bytes và blob bytes. Không trim whitespace, bỏ BOM, đổi Unicode hoặc parse/reserialize JSON để vượt kiểm tra này. Git blob IDs trong bảng là provenance, không phải SHA-256 của bytes được capture. CRLF/LF-only difference hợp lệ tại admission; mọi khác biệt khác phải dừng và reconcile.
2. **Exact evaluation bytes tại CP0:** sau provenance check, freeze một snapshot ngoài repo với exact sorted path inventory, Git blob ID tại B và SHA-256 + byte count của **raw working-tree bytes** cho đủ 23 files. Record snapshot location/hash trong CP0 evidence ledger để fresh session dùng lại; đây là operator evidence, không thêm harness schema/tool. Trước và sau mọi prepare, kể cả correction/same-ref revision, kiểm tra inventory và raw SHA-256/byte count khớp snapshot CP0. Không chuẩn hóa EOL ở bước này: đổi CRLF/LF sau freeze cũng là drift, phải dừng trước dispatch, không âm thầm re-freeze. Snapshot thiếu/mất thì chưa đủ admission/evidence cho continuation; không tạo hash thay thế từ Git blobs hoặc rehearsal cũ.

**Source detail và kiểm tra package:** `prepareSkillEvalWorkspace` đọc suites từ checkout đang chạy; `prepareSyntheticWorkspace` capture raw context bằng `readFileSync` cho cả hai variants. `--baseline-ref`/`--candidate-ref` chỉ pin skill bundles, không pin control-plane bytes. Sau prepare, đối chiếu exact inventory/path/SHA-256/byte count trong `workspace-manifest.json.control_plane.files` với snapshot CP0; đối chiếu từng copied repository context và `execution-context-manifest.json.context` entry của cả hai variants với hash nguồn tương ứng. Suite files dưới `evaluator/suite-definitions` được harness canonicalize: kiểm tra bytes bằng `canonicalJson` của parsed frozen suite và hash trong `artifact_inventory`, không yêu cầu raw suite copy giống CRLF nguồn. Prompt/inline context/policy/rubric phải derive từ cùng frozen suite; giữ existing compilation/validation, không đổi harness. Workspace/revision/provenance identities có thể đổi, nên không yêu cầu toàn bộ manifest hay `execution_context_hash` giống nhau giữa revisions. Fresh session trên checkout có EOL khác vẫn phải đáp ứng exact snapshot CP0 để tiếp tục cùng comparison; normalized provenance pass riêng lẻ không đủ.

## Reconcile roadmap và handoff

| Assumption cũ | Kết luận và procedure PR6 |
| --- | --- |
| Lấy baseline từ ASM-PR5B merge | Dependency vẫn đúng; execution snapshot đã stale. Pin B với corrected suite/ADR và current CLI; skill baseline không đổi bytes. |
| Runner chỉ prepare, cần manual execution ngoài runner | Chỉ đúng với v1 lịch sử. CLI-first hiện prepare → reader/evaluator waves → advisory report; không dùng App Server/CP9 hoặc Stage 1 `execute-prepared` làm workflow PR6. |
| First migration structural-only, đồng thời backlog yêu cầu thêm behavior | Giữ structural-only ở checkpoint CP1; CP2 riêng chứa đúng semantic addition đã ghi trong handoff. Không trộn rewrite vào verbatim move, không mô tả final candidate là pure equivalence. |
| Mỗi correction phải chạy lại toàn bộ baseline/candidate | Dùng same-run exact-success reuse theo fingerprint và dependency. Baseline success không đổi được giữ; bundle edit thường invalidate toàn bộ candidate readers. |
| Sửa 1–2 dòng chỉ ảnh hưởng vài case | Sai với full-bundle stdin hiện tại. `patch-check` là selected closure để chẩn đoán; retained evidence không chứng minh toàn revision hiện tại. |
| Report exit `0`, `succeeded` hoặc `current` là accepted migration | Sai. CLI chỉ xác nhận execution/coverage và advisory proposal; main review và owner acceptance là riêng. |
| Immutable comparative report/human writer của workflow cũ là bắt buộc phải chạy qua CLI | CLI `report` chỉ stdout JSON, không ghi v1 `human_evaluation`/`generated_report`, không có `accept` command. Lưu report snapshot/hash bên ngoài repo và ghi reviewer decision riêng; không tự làm bridge/tooling mới. |
| Exact resource-access evidence chứng minh giảm context sau split | CLI nhúng **mọi** bundle file. Có thể kiểm chứng supplied file/hash từ exact stdin, nhưng không có per-resource runtime-read instrumentation hoặc CLI `skill_resource_access` writer. `read=unknown` nếu không có observation đủ tin cậy; không claim supplied/read/token reduction. |
| Manual selected-reference fresh-reader methodology cũ còn là runtime procedure | Giữ independent blind behavioral comparison, matching/near-miss/overlap/stop criteria. Dùng 5 fresh-reader suite cases qua CLI đầy đủ bundle; kết quả chỉ chứng minh lựa chọn procedure trong response, không chứng minh chỉ các reference đó được load. |
| Program fresh-reader default cho phép mọi CLI model call | Default advisory/read-only vẫn thuộc roadmap; Stage 4 exact live grant/egress/budget áp dụng cho CLI. Grant pilot đã consumed; lượt planning này không gọi model. |
| Tooling pilot đã giải quyết semantic veto | Không. Corrected pilot `3 reader + 3 evaluator` chứng minh transport/reuse/rerun; latest corrected-input run `1 + 1` vẫn `partially_satisfied / triggered`. Không phải A/B hay phép đo model variance. |

Giữ nguyên: nine-PR/six-phase order; PR6 sau ASM-PR5B; chỉ migrate Supabase; ba references và core safety; suites audit-only; safety veto/material inconclusive blocking; independent rollback; không DB mutation; final nine-candidate/two-unsplit reconciliation. Không yêu cầu các wave đã merge chạy lại CLI chỉ để đồng nhất evidence lịch sử.

## Phạm vi và candidate contract

Expected files khi implementation được cấp: `.agents/skills/supabase-safe-migration/SKILL.md`, ba references dưới đây và docs sở hữu PR6/status/program reconciliation. Không sửa suites, ADR, SQL/published migrations, application/tests, skill khác, `AGENTS.md`, lifecycle, `.agents/scripts/**`, CI hoặc dependencies. Coverage/harness defect cần correction riêng được review/authorize trước khi tiếp tục PR6.

| Reference | Read condition giữ nguyên từ roadmap | Nội dung và nhóm được skip |
| --- | --- | --- |
| `references/migration-and-seed.md` | Read before adding/reviewing a migration, schema/table/column/index/constraint/backfill, or seed change | Migration safety, file placement, seed và matching verification; skip khi chỉ điều tra RLS/RPC/trigger/Storage không có migration/seed review/change. |
| `references/rls-and-storage.md` | Read before changing/reviewing RLS policies, permission helpers, bucket access, or Storage policies | RLS/helper và Storage procedure; skip schema-only/RPC-only/trigger-only. |
| `references/rpc-trigger-concurrency.md` | Read before changing/reviewing RPC, trigger, SQL helper, race-sensitive transition, lock, retry, or idempotency behavior | RPC/trigger/concurrency procedure; skip additive schema/index/seed không có các behavior đó. |

Core giữ activation/related routing; migration-as-source, published-history immutability, no RLS/constraint weakening; existing-data safety; remote/db-push permission; inspection và stop/conflict rules; minimum permission/`SECURITY DEFINER`/safe `search_path`/short-lock/no-external-call/idempotency rules; verification truth/reset requirement khi thực sự đổi migration; reporting/checklist/specialist gate. Nếu task overlap, đọc mọi matching reference; mọi link trực tiếp, contained, không nested discovery. CP1 phải lập section move map B → core/reference và chỉ thêm routing/heading glue cần thiết, không chỉnh examples hay lược invariant.

CP2 là semantic delta riêng theo roadmap backlog: thêm minimum rule trong core yêu cầu xác định active display order, deleted-state retention và restore conflict semantics trước ordered soft-delete backfill/constraint decision; kiểm chứng từ ADR/mutations/tests, không gộp các domain nếu product contract chưa cho phép. Chi tiết ở `migration-and-seed.md`: validate dữ liệu trước chọn correction; không tự chọn tie-break cho business order mơ hồ; dừng khi không suy ra được order; bảo toàn deleted metadata theo contract; restore là separately authorized reconciliation mutation với invalid/ambiguous-data/restore-conflict coverage phù hợp. Không hard-code `question_options`, index `0..n-1` hoặc product-specific SQL vào generic skill. Không thêm requirement chạy DB trong skill evaluation.

Candidate identities:

- `C_struct`: immutable checkpoint sau CP1; chỉ structural move, audit trực tiếp với B.
- `C_eval`: immutable checkpoint sau CP2; initial evaluated candidate gồm structural move + đúng semantic delta trên.
- `C_fix_n`: immutable correction checkpoint nếu review/evaluation phát hiện lỗi, luôn so với B và trace delta từ prior candidate.

Các hash candidate chưa tồn tại; implementing session phải record full 40-hex ref sau **separate authorized commit**, bundle manifest hash và exact diff trước prepare/live. Không dùng `HEAD` nổi hoặc giả định hash tương lai. Nếu chưa có commit authority thì dừng ở local checkpoint, không tự commit để tạo candidate. Không promote C_struct/C_eval thành baseline mới để che regression. Không cần một live run riêng trên C_struct: verbatim preservation được audit; final behavior so B/C_eval, intentional semantic delta được ghi rõ thay vì claim structural causality từ A/B.

## Checkpoints tuần tự

| CP | Outcome và điều kiện qua checkpoint |
| --- | --- |
| CP0 — admission | Đọc plan/brief/current owner grant; verify B ancestry/core inventory, normalized-EOL provenance và freeze snapshot raw bytes của đủ 23 suite/context files theo contract hai lớp ở trên; audit đủ 22 case, không đổi coverage. Reconcile latest pilot observations với rubric/context/raw evidence. Coverage gap hoặc new semantic decision ngoài CP2 → stop trước sửa skill. |
| CP1 — structural | Move nguyên văn vào ba references, giữ core minimums và exact routing; validator + diff/link/move audit; main review `0 Critical / 0 Required`; record C_struct khi commit được authorize. |
| CP2 — bounded semantic addition | Chỉ requirement tổng quát ở trên, diff riêng từ C_struct; audit không mang product rule/SQL vào skill; validator + main review; record C_eval khi commit được authorize. Đây là exception rõ ràng cho structural-only first checkpoint, không mở wording cleanup. |
| CP3 — comparative evaluation | Prepare toàn bộ B/C_eval, review package/counts/policy, exact live grant; canary và completion flow dưới đây; lưu immutable attempt/report evidence. Correction quay lại đúng CP1 hoặc CP2 owner, re-review và new revision, không sửa rubric sau khi thấy fail. |
| CP4 — acceptance và final reconciliation | Final full-current report; review 22 paired observations và mọi veto/difference; cumulative B..final candidate + structural/semantic/correction diffs; `0 Critical / 0 Required`; owner quyết định acceptance. Cập nhật statuses chín candidates/hai unsplit theo evidence; delivery vẫn theo quyền riêng. |

Mỗi checkpoint là review boundary, không mặc định một commit hay một model run. Corrections dùng commit mới khi được authorize; không amend/squash/rebase. Một lỗi đã xác nhận không được đi qua checkpoint chỉ vì validator xanh. Không tự triển khai production correction từ case response.

## Exact evaluation, reuse và correction flow

Command templates chạy từ checkout khớp exact raw-byte snapshot CP0, sau khi ghi full `C_eval` và có quyền tương ứng. Áp dụng pre/post-prepare snapshot và generated-manifest checks ở trên trước bất kỳ dispatch nào; templates không thay các checks này.

```powershell
$baselineRef = '2be02df11e279b5c88f37d2fd609069a54c235ed'
$candidateRef = '<full authorized C_eval commit>'
node .agents/scripts/run-skill-eval-cli.mjs prepare --skill supabase-safe-migration --isolation synthetic --candidate-ref $candidateRef --baseline-ref $baselineRef --concurrency 2 --max-concurrency 2 --max-attempts 2
# Lấy run_id và unit IDs từ execution plan thật; không tự dựng ID.
$runId = '<returned run_id>'
node .agents/scripts/run-skill-eval-cli.mjs status --run $runId
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run $runId --unit '<baseline reader ID for ssm-reg-additive-constraint-existing-data>' --unit '<candidate reader ID for that case>'
node .agents/scripts/run-skill-eval-cli.mjs report --run $runId
# Chỉ sau canary adjudication và khi remaining-scope grant còn hiệu lực:
node .agents/scripts/run-skill-eval-cli.mjs run --run $runId
```

- Freeze đủ `11 regression + 6 routing + 5 fresh-reader = 22` cases: exact case IDs từ ba suite blobs trên; không tạo case selector/giảm suite. Full comparison `44 readers + 22 evaluators = 66` initial dispatch. Canary `2 readers + 1 evaluator = 3` là subset của 66; remaining `42 readers + 21 evaluators = 63`. Canary chạy trước để lộ lại risk của pilot, không lặp hai-case tooling pilot.
- Process contract hiện hành: `gpt-5.6-sol / medium`, `read-only`, ephemeral, ignore user config/rules, timeout `120000 ms`; concurrency `2`, owner cap `2` và không vượt local cap. Trước live record actual CLI executable/version, exact prepared options/schema/input hashes và package disclosure. CLI không cung cấp model override flag cho plan này; runtime incompatibility thì stop, không đổi compiler/config.
- `max_attempts=2` lifetime mỗi unit qua mọi revision; theoretical prepare ceiling `132` **không phải grant**. Proposed initial live authority tối đa `44 reader / 22 evaluator / 66 total`, automatic retry `0`; cả egress exact packages tới Codex/OpenAI và commands/run phải được owner authorize. Chưa có live grant ở planning. Không có standing correction/retry calls.
- Canary `succeeded` vẫn cần main reviewer xét raw outputs và rubric. Candidate có confirmed veto, material omission hoặc inconclusive → dừng trước remaining 63; proposal false positive chỉ được bác bằng citation/explanation từ exact evidence. Baseline defect được ghi riêng, không bắt baseline phải pass và không dùng nó làm lý do hạ candidate standard.
- `run`/`resume` chỉ pending, không tự retry failed/unknown. Harness không tự dừng dựa trên semantic proposal: sau full wave phải review tất cả outputs; command-level failure/unknown/operational block dừng bước tiếp theo sau khi started workers settle, giữ independent success. Không hứa semantic stop tức thì giữa một wave.
- `retry --run $runId --unit <failed-ID>` chỉ khi có grant riêng, current dependencies hợp lệ và ordinal còn trong budget. `outcome_unknown`, integrity contradiction/quarantine, operational latch hoặc budget exhaustion → stop; không sửa state/attempt, không đoán no-call và không tự tạo replacement run. Usage exit `2`; command error exit `3`; trustworthy incomplete execution/report exit `1` theo scope, không đồng nhất với whole-run completion.

Sau skill correction đã review/commit, dùng cùng run, B và frozen control plane:

```powershell
$candidateRef = '<full authorized C_fix_n commit>'
node .agents/scripts/run-skill-eval-cli.mjs prepare --run $runId --skill supabase-safe-migration --isolation synthetic --candidate-ref $candidateRef --baseline-ref $baselineRef
node .agents/scripts/run-skill-eval-cli.mjs status --run $runId
# Chọn pending eligible closure từ plan/status và trong exact grant mới:
node .agents/scripts/run-skill-eval-cli.mjs patch-check --run $runId --unit '<affected pending candidate reader ID>'
node .agents/scripts/run-skill-eval-cli.mjs report --run $runId
```

`prepare --run` dispatch `0`, giữ settings/ordinals, publish next revision và reset `exact_current`; không truyền lại budget/concurrency. Exact accepted-success reuse cần attempt/result/output hash + producing descriptor + current fingerprint/dependencies hợp lệ. Không reuse theo file name, verdict, HEAD-only identity hay chép evidence từ pilot/run khác.

Vì mọi file bundle đi vào mọi reader, sửa bất kỳ core/reference byte nào thường invalidates **22 candidate readers và 22 evaluators**, còn 22 baseline readers đúng fingerprint được reuse. Một complete second candidate pass khi initial pass đủ 66 cần thêm `22 + 22 = 44` dispatch, tổng `110`; đây là forecast để xin exact correction grant sau impact inspection, không phải quyền đã cấp. Nếu chỉ một case đã chạy thì budget/remaining counts phải derive từ actual state; không áp máy móc 44. Failed units vẫn cần explicit retry; không dùng patch-check thay retry. Unit đã dùng ordinal 2 không thể chạy thêm trong run đó.

Partial patch-check giữ mixed mode. Unchanged successes có thể current; historical coherent graph có thể `retained_reference`; failed/unknown/budget làm case incomplete kể cả có retained output. `report` dispatch `0`, read-only stdout, không viết human artifact; `CLI_REPORT_COVERAGE_INVALID` exit `3` không phát report/không mutate. Không dùng mixed exit `0` làm full-current acceptance.

Trước CP4, complete mọi pending affected unit trong grant rồi chạy **same-ref prepare** lần cuối (cùng final candidate/B/control plane): expect exact reuse toàn bộ `66` units, dispatch `0`, no invalidation, không đổi accepted attempts/output hashes. Đọc report sau đó: `coverage_mode=exact_current`, counts `22 current / 0 retained_reference / 0 incomplete`, exit `0`. Nếu khác thì chưa đủ acceptance. Không chạy model lại chỉ để normalize report mode. Plan-only docs thay đổi không nằm trong frozen bundle/context không tự invalidates behavior.

## Review, evidence và acceptance

Latest pilot raw files đã đọc lại ngày `2026-09-04`; observation hash `e729aff901490b8f12edf4b79319542c942605cf918658d1298fd8c2724e00a6`, proposal hash `89548919d3af4979745cfdb053f93fc5dc4cd9f96b4734182c02df9b2a172230` khớp committed handoff. Response thật dùng `label/created_at/id` tie-break và thiếu explicit restore authorization/reconciliation; finding có căn cứ trong output. Không suy ra việc sửa skill chắc chắn chữa mọi response, không xác nhận production DB đang corrupt. Baseline/candidate evaluation mới vẫn phải được thực hiện.

Manual/main review ledger (transient, không tạo schema/tool mới) ghi mỗi case: run/revision, B/final candidate, reader/evaluator attempt IDs + output hashes, rubric/veto IDs, reviewer `case_status`/`comparison_status` theo governance eval-design, citations/rationale cho disagreement và disposition. Reviewer có thể đọc hidden rubric; reader không được nhận nó. CLI proposal dùng `assessment` và `comparison_findings`, không có human verdict/winner. Không ép advisory proposal thành `human_evaluation` hoặc rewrite raw outputs. Owner acceptance ghi trong owner brief, bind final ref/report hash + ledger/scope, không biến main review thành owner decision.

Acceptance phải đồng thời đạt:

1. Structural mapping đúng, core đọc riêng vẫn quyết định được permission/routing/stop/report; ba references có consumer/skip group thật, exact link, không mất invariant. CP2 chỉ chứa semantic delta đã duyệt.
2. Tất cả 22 **candidate** cases có đủ current paired evidence, mọi material criterion đạt qua reviewer adjudication, không confirmed safety veto, không `partially_passed`, `failed`, `not_run` hoặc material `inconclusive`. Baseline không có future-reference obligations. Existing baseline defect không cho phép candidate giữ defect đó.
3. Comparison không `regressed`; intentional semantic improvement được label riêng. Không claim final B/C_eval là bằng chứng causal cho riêng structural split. Advisory veto chưa giải quyết là blocker; không rerun cho tới pass hoặc sửa suite sau failure.
4. Main cumulative review `0 Critical / 0 Required`, không missing mandatory semantic/manual review. `Approved` chỉ là review verdict; owner phải chấp nhận migration riêng.
5. Final program table đối chiếu evidence của 9 candidates: `frontend-design`; `frontend-workflow`; `test-quality-strategy`; `nextjs-server-action-zod`; `implementation-planning-and-pr-breakdown`; `code-review-and-quality`; `git-checkpoint-workflow`; `github-pr-ci-workflow`; `supabase-safe-migration`. Hai unsplit decisions vẫn đúng: `code-commenting-and-maintainability` single-file, `maintain-repo-skills` giữ existing bundle. Phân biệt semantic acceptance, committed, pushed, PR open và merged; program delivery không complete trước actual PR6 merge.

Exact supplied evidence derive từ accepted producing `stdin.txt` và manifest path/hash; giữ `available`, `supplied`, `read`, `unknown` riêng. Whole bundle supplied nên không đặt context-reduction làm acceptance requirement của PR6. Không claim selective loading, runtime isolation/credential/network enforcement, native activation, token saving hoặc production readiness. Lưu immutable stdout snapshots với hashes ngoài repo; không ghi raw workspace/observations/transcripts/absolute temp paths vào Git. Temporary evidence không có durable-retention guarantee: nếu mất trước review/acceptance thì report gap và xin exact recovery/rerun authority, không giả lập artifacts.

## Kiểm tra, stop và rollback

Sau mỗi skill diff: `node .agents/scripts/validate-skill.mjs`, `node .agents/scripts/run-skill-evals.mjs validate --skill supabase-safe-migration`, `node .agents/scripts/run-skill-evals.mjs validate --all`, section-move/core/routing/link audit và `git diff --check`. Trước first live: chạy một lần `node --test .agents/scripts/run-skill-eval-cli.test.mjs` trên frozen harness; không chạy lại cho docs-only correction nếu source không đổi. Không lặp v1/structural unit suite, app build, lint toàn repo, Supabase reset/integration/E2E vì không đổi các implementation đó. Existing CI đã có CLI test; không sửa workflow.

Stop khi pins/control plane thay đổi, coverage thiếu/mơ hồ, unsupported runtime, missing action grant, safety/routing/permission/verification regression, unknown/corrupt evidence, budget hết, hoặc cần sửa ngoài skill/docs scope. Distinguish skill defect, coverage/context defect, tooling defect và evaluator disagreement trước chọn correction owner. Coverage/tooling correction phải được review riêng; giữ prior evidence, update plan/brief nếu material contract đổi. Không "giải quyết" bằng nới veto, nâng budget trong run hoặc relabel history.

Rollback chỉ skill core/ba references và owning status docs dưới quyền được cấp; giữ suites/harness/earlier waves/evidence. Revert semantic delta riêng nếu cần, không undo structural checkpoint vô cớ; bất kỳ rollback nào đổi candidate bytes đều cần revision/evidence currentness mới. Không xóa nhánh, reset history, sửa DB hoặc xóa raw evidence theo plan này.

## Bằng chứng planning và self-review

Phần này giữ lịch sử planning trước owner instruction triển khai; trạng thái hiện tại ở đầu tài liệu và checkpoint ledger dưới đây supersede các claim permission/completion cũ.

- Đã fetch/prune, sync main fast-forward và tạo nhánh; verified ancestry/Git blob provenance và control-plane consumer, CLI source/parser/report/reuse contracts, roadmap/master/progress/handoff và latest raw pilot hashes. Claim ban đầu “pins đã verified” chưa chứng minh working-tree bytes giống B hoặc hoàn thành CP0 raw-byte freeze; được correction bên dưới thay thế.
- Validate target đạt `1 / 3 / 22 / 0 / 0`; catalog `9 / 27 / 187 / 0 / 0`; structural `11 skills / 0 errors / 0 warnings`; CLI `--help` pass.
- Zero-dispatch rehearsal B/B: `run-775b3ee348614a52b90f689443f8cea0`, workspace `ws-6ecc1ad83c794d1cb3afa895eab2085e`, revision 1, `44 readers / 22 evaluators / 66 units`, max ceiling `132`, concurrency `2`, local cap `8`, `max_attempts=2`. Prepare exit `0`, dispatch `0/0/0`. Đây chỉ là static packaging proof, không chứng minh raw bytes khớp B, không baseline observation/semantic pass; không dùng run rehearsal cho CP3.
- Planning diff gồm 7 Markdown files, không source/skill/suite/SQL change; UTF-8/no-BOM/final-newline/fence/conflict/added-secret checks, `25` added/new relative links/anchors và `git diff --check` pass; index không có staged file.
- CLI `96/96`, v1 `130/130` ở Stage 4 là historical execution evidence; scripts/CI byte-identical từ `0e92e93` tới B, không gọi các kết quả đó là test rerun của planning. Không model/live/database operation hoặc implementation mới.
- Initial main plan self-review `0 Critical / 0 Required` bị subsequent pinning review supersede: independently confirmed `1 Required`. Kiểm tra ngày `2026-09-04` thấy `core.autocrlf=true`, `23/23` raw files khác B, `0/23` khác sau chuẩn hóa duy nhất CRLF/LF. Existing rehearsal manifest khớp raw hashes `23/23`; `144` copied contexts/manifest entries của hai variants khớp expected bytes. Correction tách Git provenance khỏi exact CP0 snapshot, thêm pre/post-prepare và generated-manifest checks, không sửa harness/suite. CP0 snapshot cho future actual comparison vẫn chưa được freeze; evidence kiểm tra này không được relabel thành CP0 completion.
- Bounded correction re-review: `0 Critical / 0 Required` còn mở. Specialist/fresh-reader mới `not_run`; không thay bằng self-review. Scope/contract confidence `High`; behavioral readiness `Not assessed` cho candidate chưa tồn tại. Owner decision của whole plan vẫn `pending`; user đã authorize verify-and-correct đúng finding pinning này, không cấp skill implementation hoặc Git/live authority.
- Correction verification: raw SHA-256/byte count và control-plane manifest `23/23`, canonical evaluator suite bytes/inventory `3/3`, context copies/manifest entries `144/144`; in-memory controls xác nhận EOL-only pass provenance nhưng fail exact snapshot, còn non-EOL change fail provenance. Target validation `22 cases / 0 errors / 0 warnings`; correction chỉ đổi plan/owner brief/progress, suite/context bytes giữ nguyên, `git diff --check` pass. Chỉ đọc existing rehearsal, không prepare/run/model/database mới.

## CP0–CP1 local checkpoint — 2026-09-04

Snapshot trước commit; actual commit và CP2 được record ở ledger kế tiếp.

- Current owner instruction phê duyệt plan và local implementation, không thay material contract. Branch/HEAD/local `main`/cached `origin/main` đều khớp B; ba dependency ancestors khớp. Không fetch mới trong lượt này. Entry tree có đúng bảy planning docs chưa commit; giữ nguyên phần việc đó, chỉ reconcile current PR6 status ở owning docs.
- CP0 provenance đạt `23/23` sau chuẩn hóa duy nhất CRLF/LF. Snapshot raw bytes đã freeze tại thư mục `vocaspace-asm-pr6-cp0-BIJ3IB` dưới OS temp root; `snapshot.json` SHA-256 `3b5caa7fe5b40beb3fb728759357052f4a0280e003e9b269d387aeae804294a1`. Snapshot chứa sorted inventory, B blob IDs, raw SHA-256/byte count, đủ 22 case IDs; `raw/` giữ exact source copies. Đây là transient operator evidence, không phải harness artifact/schema; không commit raw files. Fresh session phải kiểm tra đúng hash/location này trước continuation, không re-freeze nếu mất hoặc drift.
- Đã audit đủ `11 regression + 6 routing + 5 fresh-reader`: existing-data/history, privilege/denied paths, Storage, trigger, lock/retry/idempotency, seed, verification truth, overlap, near-miss và core-only remote stop đều có criterion/consumer. Không phát hiện coverage gap hoặc semantic decision mới ngoài CP2; không đổi suite/context. Latest pilot observation/proposal hashes khớp handoff; raw response thực sự chọn `label/created_at/id` tie-break và thiếu explicit restore authorization/reconciliation. Chỉ xác nhận omission trong observation theo rubric, không quy kết production DB hoặc chứng minh root cause chung của model behavior.
- CP1 chỉ tách cấu trúc. Core giữ nguyên toàn bộ `RPC rules` vì danh sách ngắn đan xen permission/`SECURITY DEFINER`/`search_path`/state/idempotency minimum; reference RPC chứa trigger/concurrency procedure và RPC verification. Không tạo bản sao các rules đó. Mapping dưới đây là section audit so với B; mọi nội dung cũ giữ nguyên câu chữ.

| Section tại B | Vị trí CP1 | Lý do |
| --- | --- | --- |
| Frontmatter, activation, related skills, core rules, specialist signals, required workflow | Core nguyên văn | Quyết định scope, authority, inspection và stop trước hành động |
| Migration safety, file placement, seed data | `references/migration-and-seed.md` | Consumer migration/schema/backfill/seed; existing-behavior RLS/RPC-only có thể skip |
| RLS and permission rules | Procedure/examples trong `references/rls-and-storage.md`; hai câu hard-delete/helper-approval giữ core | Không giấu approval boundary trong reference |
| RPC rules | Core nguyên văn | Giữ nguyên ordered list chứa các security minimum, tránh tách hoặc lặp rule |
| Trigger rules | Procedure/test effect trong `references/rpc-trigger-concurrency.md`; toàn bộ `Do not` block giữ core | Managed-schema/provisioning scope phải biết trước khi hành động |
| Race conditions and idempotency | `references/rpc-trigger-concurrency.md` | Atomic-update/serialization procedure và examples; short-lock/no-external-call/idempotency minimum đã ở core |
| Storage policies | Procedure trong `references/rls-and-storage.md`; câu cấm broaden access giữ core | Access boundary luôn trong required context |
| Verification matrix | Migration/schema và seed → migration reference; RLS → RLS reference; RPC/trigger/race → RPC reference | Matching verification theo task; command discovery/reset/E2E/evidence truth vẫn core |
| Database-specific comments, anti-patterns, final checklist | Core nguyên văn | Reporting, reset, permission và safety checklist không optional |

- Core routing dùng đúng ba roadmap read conditions; overlap đọc mọi matching resource, SQL evidence không tự kích hoạt migration review, remote-push-only dùng core stop. Mọi reference link trực tiếp/contained; không nested link hoặc placeholder. Core đọc riêng xác định được permission, mandatory safety, related/reference routing, conflict/stop và reporting. Chỉ thêm heading/routing glue; semantic addition CP2 chưa có.
- Deterministic preservation audit: đủ `234` non-empty content lines của B ngoài headings/fences/separators vẫn có nguyên văn với multiplicity không giảm; manual section/diff review xác nhận grouping và scope không đổi. Core `236` lines, references `69/55/54` lines; đây chỉ là structure metrics, không claim token/context saving hoặc behavior equivalence. Transient `cp1-bundle-audit.json` giữ raw hashes của bốn files; chưa có immutable candidate ref/bundle manifest từ prepare.
- Verification: `node .agents/scripts/validate-skill.mjs` đạt `11 skills / 0 errors / 0 warnings`; `node .agents/scripts/run-skill-evals.mjs validate --skill supabase-safe-migration` đạt `1 / 3 / 22 / 0 / 0`; `validate --all` đạt `9 / 27 / 187 / 0 / 0`; diff/link/encoding/fence/conflict audit và `git diff --check` pass. Post-edit raw snapshot vẫn khớp `23/23`. Không prepare/dispatch mới; CLI test gate dành trước first live chưa chạy; không app tests/build/lint, DB reset/integration hoặc E2E vì không đổi implementation tương ứng.
- Main-agent formal structural review: `0 Critical / 0 Required`, confidence `High` cho CP1 contract preservation; đây không phải comparative semantic acceptance. Specialist/fresh-reader `not_run`, không dùng self-review thay evidence CP3. `C_struct`/`C_eval` chưa tồn tại; checkpoint dừng trước stage/commit theo Git skill và candidate-identity contract. Sau commit `C_struct` được owner authorize mới tiếp tục CP2 với diff riêng; không push/PR/merge/live/database action.

## CP2 local checkpoint — 2026-09-04

- Owner trả lời “có” cho local commit CP1 và tiếp tục CP2. Đã stage/review đúng tám files của checkpoint, commit `871dabcb34ab6125ccb75a6d2f2ced523a748c54` — `refactor(agent-skills): split Supabase migration procedures`. Đây là immutable `C_struct`, parent B; chưa push. Ba pre-existing handoff/index docs (`eval-design.md`, implementation-plans `README.md`, CLI-first owner brief) giữ unstaged ngoài commit. Grant CP1 đã consumed; chưa có `C_eval` hoặc quyền commit CP2.
- CP2 thêm đúng một core rule và một section năm bước trong `references/migration-and-seed.md`: xác định ba domain theo ADR/mutation/tests; validate current rows trước chọn correction; không tự tie-break khi business order mơ hồ; bảo toàn relative order/deleted metadata theo product contract; tách restore reconciliation và restore-conflict coverage thành mutation được authorize riêng. Không hard-code entity, numeric indexing hoặc SQL; không đổi routing, suite, harness hay database. Các rule/content CP1 còn nguyên.
- Main review đối chiếu exact CP2 contract, corrected suite rubric, ADR, mutation/read paths và integration-test source. Existing product evidence minh họa vì sao generic skill phải lấy contract theo domain; không biến contract của một entity thành quy tắc chung. Core-only review xác định được stop trước correction mơ hồ; reference không mở rộng backfill-only scope sang restore. `0 Critical / 0 Required`, confidence `High` cho bounded implementation; không còn material decision ngoài scope được suy đoán. Behavioral/fresh-reader/comparative acceptance vẫn `not_run`, không thay bằng self-review.
- Verification mới: structural validator `11/0/0`, target suites `1/3/22/0/0`, all suites `9/27/187/0/0`; `git diff --check`, link/encoding/fence/conflict audit pass. Post-commit/post-CP2 control plane vẫn khớp raw snapshot `23/23`; chỉ hai bundle files có semantic delta so với `C_struct`, hai references còn lại unchanged. Không chạy CLI/app/database tests vì không đổi implementation tương ứng; CLI suite vẫn là gate trước first live. Prepare/dispatch mới `0`.
- Tiếp theo cần local commit CP2 được owner authorize để tạo full immutable `C_eval`; sau đó mới prepare B/C_eval, kiểm tra exact packages/counts/manifests theo CP0 và xin exact live grant. Không dùng working-tree bytes hoặc floating `HEAD` thay candidate ref, không dùng grant CP1 cho CP2.
