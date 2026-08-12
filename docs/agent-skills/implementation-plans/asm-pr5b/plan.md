# ASM-PR5B — Detailed Implementation Plan: Git and GitHub Delivery-Authority Structural Migration

Plan này là durable discovery/planning specification do agent soạn cho ASM-PR5B. Trạng thái hiện tại là `pending owner approval`; planning, implementation và delivery là các gate riêng. Owner instruction ngày `2026-08-12` chỉ authorize đồng bộ baseline, tạo planning branch, discovery/evidence read-only, sửa planning-owned documentation, planning checkpoint commit và normal push. Instruction đó cấm actual skill migration, PR action, merge, deploy và history rewrite.

## 1. Trạng thái và authority

| Trường | Giá trị hiện tại |
| --- | --- |
| Plan status | `pending owner approval; implementation not authorized` |
| Planning date | `2026-08-12` |
| Planning branch | `feat/agent-skills-asm-pr5b` |
| Branch base | synchronized `main == origin/main == 3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a` |
| Dependency | ASM-PR5A merged through PR #72 at `3fa621c`; dependency gate satisfied |
| Immutable behavioral baseline | `3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a` |
| Discovery | `complete` |
| Final size | `Large/high-risk` for governance: two permission-sensitive delivery skills, 45 cases across six frozen suites, mandatory comparative/fresh-reader evidence, cross-skill integration and two independent rollback boundaries |
| Planning permission | active only for this planning package, coherent planning/correction commit(s) and normal branch push; consumed actions must be recorded after they occur |
| Implementation permission | `not granted` |
| Program fresh-reader authority | bounded advisory read-only fresh readers remain authorized when materially useful; mandatory migration comparisons have not run |
| Planning specialist decision | `0`; direct repository, history, contract and case-by-case suite evidence resolve the planning questions |
| Not granted | target skill/reference migration; suite/tooling/schema/test/CI/package/product/database edits; PR creation/update; CI watch/fix; merge; deploy; force-push; amend; rebase; squash; destructive/history rewrite; production or database action |

Plan approval, implementation, stage/commit, push, PR, CI, merge, deployment và destructive/history authority là các gate riêng. Review verdict, validation result hoặc confidence không cấp action permission.

## 2. Goal và observable outcome

Sau một owner instruction riêng, ASM-PR5B sẽ structurally migrate tuần tự đúng hai skill:

```text
git-checkpoint-workflow
→ github-pr-ci-workflow
→ cumulative delivery-authority review
```

Mỗi monolithic `SKILL.md` trở thành một concise core và đúng bốn direct references đã được roadmap duyệt. Behavior về branch provenance, dirty-tree ownership, commit/push separation, correction history, PR/CI permission modes, bounded self-fix, merge authority, stop behavior và truthful reporting phải được giữ nguyên hoặc làm rõ chỉ sau structural-only checkpoint. Mỗi skill có immutable monolith baseline, structural checkpoint, later semantic/evidence correction boundary và accepted rollback head riêng.

Đây là structural migration, không phải redesign. Không rule nào được làm yếu chỉ để giảm core length hoặc làm candidate pass suite.

## 3. Sources of truth và reader routing

- Repository instructions và lifecycle: [`../../../../AGENTS.md`](../../../../AGENTS.md), [`../../../agent-loops.md`](../../../agent-loops.md).
- Program intent/order: [`../../plan.md`](../../plan.md), [`../../structural-migration-roadmap.md`](../../structural-migration-roadmap.md).
- Current program state: [`../../progress.md`](../../progress.md).
- Artifact convention: [`../README.md`](../README.md).
- Governance: [`../../../../.agents/skills/maintain-repo-skills/SKILL.md`](../../../../.agents/skills/maintain-repo-skills/SKILL.md) và ba routed references cho progressive disclosure, fresh-reader và eval design.
- Planning owner: [`../../../../.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`](../../../../.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md).
- Review owner: [`../../../../.agents/skills/code-review-and-quality/SKILL.md`](../../../../.agents/skills/code-review-and-quality/SKILL.md).
- Verification owner: [`../../../../.agents/skills/test-quality-strategy/SKILL.md`](../../../../.agents/skills/test-quality-strategy/SKILL.md).
- Target delivery owners: [`../../../../.agents/skills/git-checkpoint-workflow/SKILL.md`](../../../../.agents/skills/git-checkpoint-workflow/SKILL.md), [`../../../../.agents/skills/github-pr-ci-workflow/SKILL.md`](../../../../.agents/skills/github-pr-ci-workflow/SKILL.md).
- Predecessor convention: [`../asm-pr5a/plan.md`](../asm-pr5a/plan.md), [`../asm-pr5a/owner-review-brief.md`](../asm-pr5a/owner-review-brief.md).
- Frozen suite design authority: current six files under `.agents/evals/{git-checkpoint-workflow,github-pr-ci-workflow}/` plus the historical ASM-PR2C audit. Current repository bytes are authoritative over historical prose.

Roadmap owns candidate allocation, target shape, dependency, exclusions và program completion. Plan này owns exact ASM-PR5B execution contract. Owner brief là decision surface và không được silently override plan. Material owner change phải được reconcile vào cả hai artifact và re-review trước implementation.

## 4. Confirmed repository baseline

### 4.1 Git và dependency

- Pre-sync worktree/index/untracked set sạch trên `feat/agent-skills-asm-pr4`.
- `git fetch origin --prune` đưa `origin/main` tới `3fa621c`, merge commit của PR #72 / ASM-PR5A.
- `origin/feat/agent-skills-asm-pr5a` head là ancestor của `origin/main`.
- Local `main` được update bằng `git pull --ff-only origin main`; local `main` và `origin/main` cùng bằng `3fa621c`.
- `feat/agent-skills-asm-pr5b` được tạo trực tiếp từ synchronized `main`; initial `HEAD`, merge-base và `main...HEAD` divergence lần lượt là `3fa621c`, `3fa621c`, `0/0`.
- Không có pre-existing local/remote ASM-PR5B branch hoặc dirty state cần preserve.

### 4.2 Immutable target và suite blobs

Các blob dưới đây là precondition tại `3fa621c`, không chỉ là thông tin tham khảo:

| Artifact | Baseline blob |
| --- | --- |
| `git-checkpoint-workflow/SKILL.md` | `c282c742bb807197fee04b19b693d7c9de53474f` |
| `github-pr-ci-workflow/SKILL.md` | `f10707f7da29fc6ba8070fdcca323af5afa721b2` |
| GCW `regression.json` | `b8bd90e360668d11069867af21ed729f4688a182` |
| GCW `routing.json` | `6f02eabda8cf36161f8ce0e0349e353f6ac0d889` |
| GCW `fresh-reader.json` | `da8de5f4ef40a95b440750371d655a2c34b30dc4` |
| GHCI `regression.json` | `ed6c60e4bf4eecc86e35673ee883777a68c85bfc` |
| GHCI `routing.json` | `110747e40613c869d9c02711bb40fabd071bcfb5` |
| GHCI `fresh-reader.json` | `078f9c5b6d4e1cb0e93596c3f90598b4f79acf47` |

Cả tám blob đều byte-identical giữa `461269b` và `3fa621c`. Vì vậy ASM-PR5A merge không thay đổi target hoặc frozen suite. `3fa621c` vẫn là baseline bắt buộc vì roadmap yêu cầu capture baseline từ merged dependency, không dùng commit lịch sử cũ hơn chỉ vì bytes trùng nhau.

### 4.3 Deterministic readiness

Trên Node `v24.11.1` tại planning baseline:

- structural-validator tests: `37/37` pass;
- eval-runner tests: `130/130` pass;
- repository validator: `11 skills / 0 errors / 0 warnings`;
- GCW focused validation: `1 skill / 3 files / 21 cases / 0 diagnostics`;
- GHCI focused validation: `1 skill / 3 files / 24 cases / 0 diagnostics`;
- cumulative validation: `9 skills / 27 files / 183 cases / 0 diagnostics`.

Current monolith lengths là GCW `441` lines và GHCI `437` lines. Length không phải migration criterion; zero-warning validator state cũng không chứng minh semantic readiness.

## 5. Discovery conclusions

### 5.1 Confirmed facts

- Roadmap order và exact two-skill allocation vẫn khớp current repository.
- GCW suite allocation là `10 regression + 6 routing + 5 fresh-reader = 21`.
- GHCI suite allocation là `11 regression + 7 routing + 6 fresh-reader = 24`.
- Mỗi proposed reference có positive selection và meaningful skip evidence; GCW có planning-only all-skip near miss, GHCI có ba all-skip controls.
- GCW selection/skip counts: branch `3/18`, commit/staging `11/10`, correction/history `5/16`, push/remote `5/16`.
- GHCI selection/skip counts: PR create/update `7/17`, CI triage `18/6`, self-fix `4/20`, merge `4/20`.
- Cases bảo vệ commit-versus-push, branch divergence, dirty/secret/hook stops, correction/no-amend, history/force separation, normal push, PR-only/no-initial-push, exact CI taxonomy, `branch-caused-small-safe`, two-attempt limit, `db-risk`, merge/auto-merge và truthful report.
- Runner chỉ validate/package/report; không execute hoặc grade model. `synthetic` không phải enforced isolation. Resource read evidence phải giữ `available`, `supplied`, `read` và `unknown` riêng biệt.

### 5.2 In-scope planning corrections

1. Roadmap GCW core inventory chưa nêu section hiện hữu `Specialist escalation signals`. Đây là decision/routing rule không có approved optional consumer và phải ở core. Roadmap được clarify; không có behavior, suite hoặc target-reference change.
2. `progress.md` còn current-language nói ASM-PR5B merge-blocked dù Git chứng minh ASM-PR5A đã merge tại `3fa621c`. Current status được reconcile; historical checkpoint evidence vẫn giữ label lịch sử.

### 5.3 Coverage readiness và open questions

- Không có suite coverage gap yêu cầu sửa ASM-PR2C artifacts trước migration.
- Không suite nào cần đổi để cover roadmap target references, skip groups hoặc protected delivery-authority invariants.
- `Specialist escalation signals` của GCW được giữ verbatim trong core và được structural-content audit bảo vệ; nó không tạo một reference route mới hoặc suite redesign.
- Không có material owner decision mới ngoài approve/revise/reject plan và cấp implementation permission riêng.
- Planning fresh-reader không chạy: direct Git/blob/case/control-plane evidence đã resolve material uncertainty. Mandatory future migration fresh-reader không được waive.

## 6. Exact future implementation scope

### 6.1 Chỉ được phép sau owner implementation instruction riêng

- Edit đúng hai target cores.
- Create đúng tám approved direct regular-file references dưới hai target bundle.
- Reconcile đúng plan này, owner brief và `progress.md` bằng evidence thực tế của checkpoint.
- Chạy deterministic validation, synthetic preparation/reporting, bounded semantic/fresh-reader evaluation và read-only reviews đã định nghĩa bên dưới.
- Tạo distinct structural-only và later correction/accepted rollback commits nếu exact local commit permission được cấp.
- Tiếp tục dùng `feat/agent-skills-asm-pr5b`; không tạo implementation branch thứ hai.

### 6.2 Excluded

- Mọi thay đổi tới sáu frozen suite definitions, prompts, contexts, criteria, expected/forbidden behavior, vetoes, routes hoặc case IDs.
- Validator, runner, schema, validator/runner tests, CI, package hoặc shared tooling.
- Planning/review/Supabase/other skill bundles ngoài hai target.
- Actual branch/stage/commit/push/PR/CI/merge action như một semantic test scenario; product/frontend/server/database code; migration, fixture, deployment hoặc production action.
- Token-saving, native-trigger, enforced-isolation hoặc performance claim không có direct evidence.
- PR creation/update, CI watch/fix, merge, force-push, amend, squash, rebase hoặc destructive recovery trừ khi một later instruction authorize đúng action đó; các action này không cần thiết để hoàn tất CP1–CP8.

Nếu execution phát hiện frozen-suite gap, dừng affected migration. Không edit/weaken suite để candidate pass. Coverage correction phải là separately reviewed boundary, được owner authorize, merge, re-pin baseline và restart affected candidate.

## 7. Target bundle contracts

### 7.1 `git-checkpoint-workflow`

Core phải giữ trực tiếp:

- activation, ownership và related-skill routing;
- explicit commit/push permission separation, no auto-commit, no force/destructive default;
- dirty-tree ownership và staging-scope minimum;
- branch/base/dependency/divergence stop summary đủ để chọn branch reference;
- local/remote boundary và exact PR/CI exception handoff;
- `Specialist escalation signals`, vì đây là pre-reference routing decision;
- failure behavior, truthful implementation/commit report, final checklist và no-permission rule.

| Reference | Exact read condition | Content moved | Required skip group |
| --- | --- | --- | --- |
| `references/branch-start-and-sync.md` | Read before creating/switching a task branch, updating its base, or resolving base/dependency/divergence | branch naming; independent/stacked branch procedure; fetch/fast-forward sequence và detailed ancestry checks | existing correct-branch checkpoint with known base |
| `references/commit-and-staging.md` | Read after commit permission exists or when auditing a proposed stage/commit checkpoint | commit workflow/readiness; do-not-commit cases; ownership/staging/diff audit; verification; messages; artifact/secret checks và detailed commit report | planning/review with no stage/commit action |
| `references/corrections-and-history.md` | Read before correction-history, amend, squash, rebase, conflict, history rewrite, force-push, or destructive recovery decision | correction commit default; rewrite/conflict/destructive recovery procedure | ordinary new local commit with no history operation |
| `references/push-and-remote.md` | Read before an explicitly authorized normal push or when deciding whether current permission includes remote Git delivery | exact branch/commit/upstream/divergence preconditions; normal-push and remote reporting procedure | local-only checkpoint |

Structural split dùng verbatim-first moves. Core summary không được invent behavior; chỉ giữ existing decisive paragraphs cần trước resource selection. Heading/link adaptation là thay đổi structural duy nhất được phép ở CP3.

### 7.2 `github-pr-ci-workflow`

Core phải giữ trực tiếp:

- activation, ownership, related-domain handoff và GitHub CLI preconditions;
- exact permission modes: inspect-only, watch-only, create/update PR only, combined mode, explicit-fix-only;
- normal-push eligibility summary, PR-only/no-initial-push và interactive push/fork refusal;
- self-fix eligibility minimum: existing remote head/PR/check, logs read, exact `branch-caused-small-safe`, same-branch normal push và no DB-risk;
- merge/auto-merge separate current-task permission;
- safety/stop rules, final status report và checklist.

| Reference | Exact read condition | Content moved | Required skip group |
| --- | --- | --- | --- |
| `references/pr-create-update.md` | Read before reconstructing PR context or creating/updating PR metadata/state | context reconstruction; duplicate/remote-head checks; create/update commands và title/body rules | watch-only/inspect-only with no PR mutation |
| `references/ci-watch-and-triage.md` | Read before watching checks, reading failed logs, classifying a failure, or reporting CI status | watch/log commands; terminal-state report; exact seven-class taxonomy và stop reporting | PR metadata-only work |
| `references/ci-self-fix.md` | Read only after an existing PR/check failed, logs were read, and failure was classified `branch-caused-small-safe` under authorized combined mode | smallest edit/validation/commit/push/re-watch cycle; attempt definition/limit và prohibitions | every non-small-safe or non-combined mode |
| `references/merge-and-auto-merge.md` | Read only when owner explicitly requests merge or auto-merge in the current task | detailed readiness checks, merge commands và refusal procedure | all non-merge modes |

CP6 structural allocation tương ứng monolith sections: PR context/create-update, CI watch/triage, self-fix loop và merge rules. Core safety/report/checklist remains mandatory default context.

## 8. Cross-skill và protected-invariant matrix

| Invariant | Required behavior |
| --- | --- |
| Commit versus push | GCW local commit permission không bao gồm push; GHCI không được route cho local-only commit |
| Normal push versus PR workflow | Plain authorized Git push thuộc GCW; PR metadata/check/triage thuộc GHCI; combined delivery route có thể require cả hai nhưng không merge authority |
| Branch provenance | Independent branch luôn từ synchronized `main` chứa dependency; stacked branch chỉ khi dependency thật sự unmerged; uncertainty phải stop |
| Dirty-tree ownership | Không stage/revert/commit unclear work; destructive cleanup không được dùng để làm sạch state |
| Correction history | New coherent correction commit là default; amend/squash/rebase/force-push là separate gates |
| PR-only | Existing remote head là precondition; không initial-push hoặc accept interactive fork/push |
| CI self-fix | Chỉ `branch-caused-small-safe` trong authorized combined mode; exact two-attempt default; every other classification stops |
| Database boundary | `db-risk` routes Supabase owner for analysis và stops before edit/validation-as-fix/commit/push/re-watch/merge |
| Merge | Review owns readiness; GHCI owns merge gates/action; explicit current-task merge/auto-merge permission luôn bắt buộc |
| Evidence truth | P0 package không được report command/action như đã chạy; synthetic packaging không phải isolation/model execution |
| Reporting | Final report phải phân biệt local commit, pushed head, PR state, CI state, attempts, merge state và remaining owner decision |

## 9. Chín sequential checkpoints

Checkpoint count theo real state boundaries. `3fa621c` luôn là behavioral baseline. `<implementation-start-head>` chỉ định Git review range: branch `HEAD` sau accepted planning checkpoint và trước target-skill edit đầu tiên.

### Checkpoint 1 — Baseline và readiness

1. Re-fetch/reconcile remote state khi current implementation instruction authorize network sync.
2. Reconfirm clean branch, merge-base, dependency và record full `<implementation-start-head>` containing `3fa621c`.
3. Recheck tám protected blobs tại section 4.
4. Rerun validator tests, runner tests, repository validator, focused và cumulative validation.
5. Confirm exact owner approval, implementation/evidence scope, local commit permissions và CP9 remains separately unauthorized.
6. Stop khi ancestry, blob integrity, deterministic readiness, scope hoặc permission không rõ.

### Checkpoint 2 — GCW immutable monolith baseline

1. Reconfirm GCW core + suite trio match `3fa621c`.
2. Prepare candidate-only monolith workspace bằng control-plane command tại section 10.
3. Execute/assess all 21 cases read-only; record resource/access limitations; no comparison/improvement claim.
4. Keep raw evidence transient. Stop on provenance/context drift, safety veto hoặc coverage gap.
5. Không edit target skill/reference.

### Checkpoint 3 — GCW structural-only migration

1. Create exact four approved references bằng verbatim-first move và minimal heading/link adaptation.
2. Keep all core invariants, including `Specialist escalation signals`, dirty/base/permission stops và output contract.
3. Audit moved-content equivalence, direct routes, read/skip conditions, regular-file/containment/link/UTF-8/no-BOM/final-newline state.
4. Run structural validator và focused/all suite-definition validation; chưa chạy candidate semantic comparison.
5. Review structural worktree first; fix only structural defects.
6. Nếu exact commit permission exists, create distinct checkpoint `refactor(agent-skills): split Git checkpoint guidance` và record `<gcw-structural-head>`.
7. Final structural review range là `<implementation-start-head>..<gcw-structural-head>`. Semantic/routing clarification phải chờ CP4 và không amend checkpoint này.

### Checkpoint 4 — GCW semantic evidence, correction và accepted rollback

1. Prepare comparative workspace với current candidate và baseline `3fa621c`.
2. Execute both blind variants cho 21 cases dưới equivalent disclosed conditions, gồm GCW fresh-reader `5/5`.
3. Default fresh baseline execution. Cross-workspace reuse chỉ khi package/context/policy/bundle equality được chứng minh mechanically, bytes reused verbatim và variance disclosed.
4. Require complete valid observations, human proposals, `skill_resource_access` evidence và immutable report; zero veto, regression, failed hoặc material inconclusive.
5. Chỉ tại CP4 mới được làm in-scope semantic/routing clarification. Preserve unfavorable evidence; invalidate/rerun affected candidate/report sau mỗi correction.
6. Formal accepted range là `<implementation-start-head>..<gcw-accepted-head>`. Correction dùng new commit(s), không amend structural commit.
7. Gate: deterministic pass và `0 Critical / 0 Required`.
8. Nếu không cần file/status correction, `<gcw-accepted-head>` có thể bằng structural head; không tạo empty commit.
9. GCW rollback bundle là core + bốn references + truthful status changes trong exact accepted range. GHCI chưa bắt đầu.

### Checkpoint 5 — GHCI immutable monolith baseline

1. Reconfirm GHCI core + suite trio match `3fa621c`; accepted GCW tree không phải GHCI behavioral baseline.
2. Prepare candidate-only monolith workspace và execute/assess all 24 cases read-only.
3. No comparison/improvement claim; raw evidence transient.
4. Stop on provenance/context drift, veto hoặc coverage gap.
5. Không edit GHCI core/reference.

### Checkpoint 6 — GHCI structural-only migration

1. Create exact four approved references bằng verbatim-first move và minimal heading/link adaptation.
2. Core giữ preconditions, all permission modes, normal-push/self-fix minimum gates, DB-risk/merge stops, safety, report và checklist.
3. Run moved-content, route/skip, link/containment/file/encoding audits và structural/focused/all validation; chưa chạy candidate semantic comparison.
4. Review structural worktree first; fix only structural defects.
5. Nếu exact commit permission exists, create `refactor(agent-skills): split GitHub PR CI guidance` và record `<ghci-structural-head>`.
6. Structural review range là `<gcw-accepted-head>..<ghci-structural-head>`. Later clarification thuộc CP7 và không rewrite CP6.

### Checkpoint 7 — GHCI semantic evidence, correction và accepted rollback

1. Prepare comparative workspace với baseline `3fa621c`; execute both variants cho 24 cases, gồm GHCI fresh-reader `6/6`.
2. Apply same fresh-baseline/reuse restrictions như CP4.
3. Require complete immutable report, truthful resource provenance và zero veto/regression/failed/material inconclusive.
4. Chỉ tại CP7 mới được correction semantics/routing; preserve unfavorable evidence và rerun invalidated evidence.
5. Accepted range là `<gcw-accepted-head>..<ghci-accepted-head>`.
6. Gate: deterministic pass và `0 Critical / 0 Required`.
7. Không tạo empty acceptance commit; correction dùng new commit(s), không amend CP6.
8. GHCI rollback độc lập qua exact accepted range; GCW accepted work không bị kéo vào rollback.

### Checkpoint 8 — Cumulative final review và local completion state

1. Review exact resolved range `<implementation-start-head>..<ghci-accepted-head>`; semantic reports vẫn pin `3fa621c`.
2. Audit exact target shape `2 cores + 8 references`, invariant matrix, routes/links, permissions, stops, reports và all six suite blobs.
3. Rerun validator `37`, runner `130`, repository validator, both focused suites, cumulative validation, scope/secret/conflict/encoding/link audit và `git diff --check`.
4. Reconcile plan, brief và progress bằng observed evidence, ghi remote state là chưa push/pending nếu CP9 chưa chạy.
5. Nếu docs changed và exact commit permission exists, create coherent completion/status commit; record `<implementation-complete-head>`.
6. Final cumulative review phải chạy sau mọi CP8 correction/docs commit trên exact range `<implementation-start-head>..<implementation-complete-head>` và đạt `0 Critical / 0 Required`.
7. Không gọi same-agent pass là independent hoặc fresh-reader. Mandatory per-skill fresh-reader evidence thuộc CP4/CP7.
8. CP8 pass không authorize delivery.

### Checkpoint 9 — Delivery gate và durable remote-state reconciliation

1. Dừng để owner đưa ra delivery decision sau CP8. Push, PR, CI và merge không được suy ra.
2. Để workflow agent thực hiện delivery mà không tạo stale tracker, owner grant phải bao phủ riêng: normal push của `<implementation-complete-head>`; verification upstream/divergence; exact post-push edits cho plan/brief/progress; một docs-only delivery-record commit; và normal push commit đó. Nếu grant không bao phủ toàn bundle cần thiết, stop trước initial delivery push và request scope chính xác.
3. Post-push docs chỉ record event đã quan sát, consumed permissions và current remote state; không sửa migration semantics, suite hoặc accepted rollback heads.
4. Delivery-record commit dùng English Conventional Commit, ví dụ `docs(agent-skills): record ASM-PR5B delivery`; không amend/squash/rebase.
5. Review docs-only delivery diff, verify final upstream/divergence và record exact pushed hashes.
6. PR creation/update, CI watch/fix, merge và ASM-PR6 implementation vẫn cần separate explicit authority. ASM-PR6 dependency chỉ satisfied sau ASM-PR5B merge vào `main`, không phải sau local commit hoặc branch push.

## 10. Evidence strategy

### 10.1 Deterministic evidence

Chạy tại applicable checkpoints:

```text
node --test .agents/scripts/validate-skill.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill git-checkpoint-workflow
node .agents/scripts/run-skill-evals.mjs validate --skill github-pr-ci-workflow
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Ngoài command output, audit exact blobs, regular files, relative links, containment, UTF-8/no-BOM/final newline, secret/debug/conflict markers, expected/forbidden scope và staged/unstaged/untracked state.

### 10.2 Semantic và fresh-reader evidence

Candidate-only monolith baseline per skill:

```text
node .agents/scripts/run-skill-evals.mjs prepare --skill <skill> --isolation synthetic --candidate-ref 3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a --no-baseline
```

Comparative candidate per skill:

```text
node .agents/scripts/run-skill-evals.mjs prepare --skill <skill> --isolation synthetic --candidate-current-tree --baseline-ref 3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a
```

Report:

```text
node .agents/scripts/run-skill-evals.mjs report --workspace <workspace-id>
```

Rules:

- Current-tree suite trio, hidden criteria và repository contexts là single captured control plane cho cả hai variants; ref selectors chỉ chọn skill bundle.
- Same model class và equivalent instruction/context conditions; variant identity blind.
- Execute all 21/24 cases, không chỉ fresh-reader subset.
- Require GCW `5/5` và GHCI `6/6` fresh-reader cases.
- Preserve unfavorable observations. Candidate correction invalidates affected evidence/report.
- `available`, `supplied`, `read`, `unknown`, `operator_observation`, `executor_self_report` và `not_run` giữ đúng claim boundary.
- Full raw workspace, observations, manifests, transcripts, evaluations và reports là transient, không commit.
- Không claim enforced isolation, runner-executed model, native trigger, token saving hoặc performance improvement.

Per-skill comparison stops trên any safety veto, candidate failure, regression, material inconclusive, invalid/missing required evidence, suite drift hoặc provenance contradiction.

## 11. Migration acceptance criteria

1. Chỉ hai approved target skills được migrate theo approved order.
2. Final target shape đúng `2 cores + 8 direct references`.
3. GCW core giữ `Specialist escalation signals` và mọi mandatory branch/dirty/permission/stop/report decision cần trước reference selection.
4. GHCI core giữ preconditions, exact permission modes, self-fix eligibility minimum, DB-risk và merge authority.
5. Mỗi reference có exact read condition, positive consumer và meaningful skip group.
6. Sáu suites byte-identical với `3fa621c` và validate `21/24` cases.
7. All 45 comparisons, GCW fresh-reader `5/5` và GHCI `6/6` hoàn tất với zero veto/regression/failed/material inconclusive.
8. Resource/access/execution evidence được label truthful.
9. Mỗi skill có distinct reviewed structural-only commit trước semantic execution; later corrections là new commit(s).
10. Mỗi accepted skill range đạt `0 Critical / 0 Required` trước skill kế tiếp.
11. CP8 cumulative exact range đạt `0 Critical / 0 Required` sau durable-doc reconciliation.
12. Không excluded path, unauthorized action hoặc unsupported claim.
13. CP9 remote delivery và post-push durable state vẫn là separate permission bundle.
14. Plan approval không tự authorize implementation.

## 12. Risks và controls

| Risk | Control |
| --- | --- |
| Permission/history rule rời core | Core-retention inventory + structural diff + semantic/fresh-reader veto |
| GCW specialist route bị mất | Keep existing decision section verbatim in core; roadmap clarification và cumulative audit |
| Commit bị hiểu là push | Dedicated regression/fresh-reader/routing cases và cross-skill integration review |
| PR-only initial-push regression | PR-only cases, exact remote-head precondition và no-interactive-push rule |
| Self-fix mở rộng | Exact taxonomy, combined-mode gates, two-attempt cap và DB-risk veto |
| Structural và semantic correction trộn history | Distinct CP3/CP6 commits; correction only CP4/CP7; no amend/rewrite |
| Partially migrated tree trở thành baseline | Every comparison pins `3fa621c` |
| Suite sửa để fit candidate | Six frozen blobs; any diff stops migration |
| Evidence overclaim | Separate resource/access dimensions; disclose synthetic/non-isolation/model boundary |
| Coupled rollback | Independent GCW and GHCI accepted ranges; no offsetting one regression with another pass |
| Delivery state stale như ASM-PR5A RQ2 | CP9 requires explicit post-push durable-state reconciliation bundle before initial delivery push |
| Upstream changes after planning | Re-fetch/reconcile, re-pin và re-review before edit |

## 13. Stop conditions và rollback

Stop affected checkpoint trước further edit/evidence claim/commit/delivery khi:

- ASM-PR5A merge ancestry hoặc branch baseline không còn đúng;
- material plan approval, implementation/evidence hoặc local commit permission thiếu;
- protected core/suite blob drift chưa reconcile;
- suite gap hoặc owner/source conflict xuất hiện;
- candidate có veto/regression/failure/material inconclusive;
- resource provenance không đủ cho claimed selection/read behavior;
- Critical/Required finding còn mở;
- correction cần suite/tooling/CI/product/database/other-skill scope;
- semantic clarification bắt đầu trước reviewed structural checkpoint;
- deterministic control-plane tests inconclusive;
- plan và owner brief conflict;
- CP9 delivery grant không bao phủ truthful post-push durable-state reconciliation.

Rollback boundaries:

- GCW accepted rollback = exact `<implementation-start-head>..<gcw-accepted-head>` changes cho GCW core, four references và directly owned status record.
- GHCI accepted rollback = exact `<gcw-accepted-head>..<ghci-accepted-head>` changes cho GHCI core, four references và directly owned status record.
- CP8 completion docs và CP9 delivery record là separate documentation boundaries, không thay accepted semantic baseline.
- Revert failed bundle không được weaken/delete suites hoặc evidence tooling.
- Correction mặc định là new commit; không rewrite history.

## 14. Planning review record

### Discovery findings

| Classification | Finding | Resolution |
| --- | --- | --- |
| `Required` | Roadmap GCW core inventory omitted existing `Specialist escalation signals`, creating a risk that a decision/routing rule could be moved or dropped without an approved consumer | Clarify roadmap and exact plan contract to retain it in core; no suite/reference redesign |
| `Required` | `progress.md` still described ASM-PR5B as merge-blocked after ASM-PR5A merged | Reconcile current status to Git baseline `3fa621c`; preserve predecessor statements only as historical evidence |

Case-by-case suite audit found no coverage correction. Planning fresh-reader/specalist decision is `0` because main evidence is sufficient; mandatory implementation comparisons remain unchanged.

### Main self-review

Initial complete-diff main self-review found `0 Critical / 1 Required`: the owner brief could be read as requiring a new permission round-trip solely for fresh-reader execution even though the owner-approved program default already covers bounded advisory read-only fresh readers. The permission wording was corrected: future implementation/checkpoint scope still needs explicit authority, while no additional grant is needed solely to invoke an otherwise in-scope bounded fresh reader.

Re-review of the exact five-file planning scope reached `0 Critical / 0 Required`. Git baseline/dependency, eight protected blobs, 45 case IDs, all eight reference selection/skip counts, deterministic `37/130/21/24/183` evidence, relative links, UTF-8/no-BOM/final-newline, trailing whitespace, balanced fences, conflict/secret/absolute-path and `git diff --check` audits passed. Specialist and planning fresh-reader remain `0`; no material uncertainty remains for the planning decision. This verdict authorizes no implementation or remote action beyond the exact current planning grant.

## 15. Transferable implementation brief

### Approved goal

Pending owner approval: migrate GCW then GHCI from immutable baseline `3fa621c`, preserving every delivery-authority invariant with independent rollback.

### Dependencies và required order

ASM-PR5A merge is satisfied. Required order is CP1 → GCW baseline/structural/evidence → GHCI baseline/structural/evidence → cumulative review → separate delivery gate.

### Exact implementation scope

Two cores, eight approved references, plan/brief/progress reconciliation. Six suites and shared tooling remain frozen/audit-only.

### Verification

Validator `37`, runner `130`, repository validation, focused `21/24`, cumulative `183`, all 45 semantic comparisons, fresh-reader `5/5 + 6/6`, exact resource evidence, content/link/path/encoding/scope audits và final `0 Critical / 0 Required`.

### Known risks và limitations

Synthetic packaging is not isolation; resource read may be self-report; no native-trigger/token claim. Implementation, checkpoint commits và delivery require exact owner permission beyond this planning session.
