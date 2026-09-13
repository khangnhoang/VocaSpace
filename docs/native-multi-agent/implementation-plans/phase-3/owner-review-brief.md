# Phase 3 — Owner review brief

Brief này tóm tắt [plan.md](./plan.md), giữ Owner-facing material-decision evidence và current candidate source identity. Nó không phải dispatch package, inclusion/exclusion record hoặc future role-admission source; không biến append-only Owner record hay ephemeral projection thành durable manifest/registry/provenance system, không tự approve material decision và không cấp Git/remote authority.

## Owner decision evidence và current candidate source identity

- Current correction candidate consumed a projected Owner Source Package from Owner-record revision `14`, exact ordered refs `[owner-2, owner-3, owner-9, owner-10, owner-11, owner-12, owner-13, owner-14]`.
- Identity này chỉ bind `phase-3-plan-r2` và review lineage hiện tại. Main phải project package cho mọi later dispatch từ then-current Owner record, `applies_to`, scope và authority; future role không dùng brief này để reconstruct membership.
- Exact verbatim entries bên dưới là historical/current candidate decision evidence, không phải một durable copy của ephemeral inclusion/exclusion state.

### owner-2 — verbatim

> sai nữa rồi, tham khảo docs struct của chính repo ấy, ví dụ nè

Attachment evidence thuộc record: established nested implementation-plan convention và `native-multi-agent/reviews`.

Recorded effects only:

- Phase 3 planning artifacts tiếp tục dùng repository-native nested `implementation-plans/phase-3/{plan.md,owner-review-brief.md}` convention;
- lifecycle review evidence tiếp tục ở local ignored `docs/native-multi-agent/reviews` boundary;
- entry này không tự cấp Phase 3 implementation, commit hoặc remote authority.

### owner-3 — verbatim

> sau khi có plan, hãy tiến hành di chuyển vị trí của thư mục một xíu, hiện tại native-multi-agent đang nằm trong agent-workflow như thể là sub system của agent workflow nhưng thực tế không phải vậy, cụ thể path mới sẽ chuyển là docs/native-multi-agent tức là nằm ngang với agent workflow, native multi agent hiện cũng đang thiếu progress.md như là durable docs cho chính feature này

Recorded effects only:

- `docs/native-multi-agent` tiếp tục là feature-level documentation owner ngang hàng với `docs/agent-workflow`;
- `docs/native-multi-agent/progress.md` tiếp tục là durable current-status owner cho Phase 3;
- relocation action của entry này đã kết thúc; Phase 3 không được tái chạy relocation hoặc suy ra destructive authority.

### owner-9 — verbatim

> giờ thực hiện phase 3 của multi agent

Recorded effects only:

- Owner yêu cầu thực hiện Phase 3 / `NMA-WS5`;
- theo current authority snapshot do Main cung cấp, implementation permission bao phủ exact approved Master Plan scope và smallest plan projection/correction không có material decision mới;
- mandatory bounded non-mutating Master Planner/Master Plan Reviewer rehearsal thuộc Phase 3 verification scope; entry không cấp Specialist, stage, commit, push, PR, CI watch/fix, merge, deploy, database/production/remote mutation, destructive action, history rewrite, force-push hoặc branch deletion authority.

### owner-10 — verbatim

> **Owner record is not the dispatch package.** The append-only Owner record preserves captured Owner inputs across the managed program. Before each managed-role dispatch for which an Owner Source Package is constructed or reconstructed, Main MUST derive the current workflow/phase-local Owner Source Package from that record using `applies_to`, current scope, and current authority.
> Whole-entry preservation applies to included entries only; it does not require forwarding entries whose applicability to the current workflow/phase has ended, including unrelated or expired phase-local operational instructions. Supersession alone does not justify exclusion when the earlier entry remains relevant to interpreting a current amendment, authority change, or semantic constraint.
> `owner_input_revision` identifies the Owner-record revision from which the package was projected; it does not imply that every prior `source_entry_ref` is a member of the dispatched package. Package membership is defined exclusively by the explicit ordered set of included `source_entry_ref`s.
> Main MUST resolve and record inclusion/exclusion before dispatch. Role admission MUST validate the dispatched ref set against the declared package membership, not infer membership from the numeric revision or treat it as a contiguous `owner-1..N` range. The inclusion/exclusion record is workflow-ephemeral admission state and does not create a new durable manifest, registry, or provenance system.

Recorded effects only:

- append-only Owner record và dispatched Owner Source Package là hai đối tượng khác nhau;
- Main project exact workflow/phase-local package bằng `applies_to`, current scope và current authority trước dispatch;
- whole-entry/order preservation chỉ áp dụng cho included entries; supersession không đủ để exclude entry vẫn cần cho interpretation;
- `owner_input_revision` là record revision, không phải membership hoặc contiguous-range rule;
- admission validates exact declared ordered membership;
- inclusion/exclusion decision là ephemeral orchestration state, không phải durable artifact/service.

### owner-11 — verbatim

> tiếp tục

Recorded effect only: tiếp tục bounded Phase 3 work; không đổi GOAL hoặc cấp Git/remote/Phase 4 authority.

### owner-12 — verbatim

> tiếp tục

Recorded effect only: tiếp tục bounded Phase 3 work; không đổi GOAL hoặc cấp Git/remote/Phase 4 authority.

### owner-13 — verbatim

> 1. còn giữ exact Planner/Plan Reviewer `subagent/thread IDs` không?&#x20;
> 2. &#x20;Hai ID đó là `closed` hay thật sự không retrieve được?&#x20;
> 3. &#x20;đã thử native **resume** đúng ID chưa?&#x20;
> 4. &#x20;Runtime trả lỗi gì?&#x20;
> 5. &#x20;Hay chỉ nhìn UI/“active agent tree”, không thấy nên tự kết luận unavailable?

Recorded effects only:

- Main phải kiểm tra exact saved role/session identity và thử native resume trước khi kết luận `BLOCKED(session_unavailable)`;
- Main đã xác minh và resume thành công exact original Planner `/root/phase3_planner` (thread `01a0913d-f0d8-79b0-a83f-5c8d4bb4095a`) và Plan Reviewer `/root/phase3_plan_reviewer` (thread `01a0914e-940e-7b62-991d-58e57a0f41b8`); cả hai trả `SESSION_RESUMED_NO_WRITE`, không runtime error, candidate/index không đổi;
- prior `BLOCKED(session_unavailable)` conclusion bị rút lại; entry không đổi GOAL hoặc cấp Git/remote/Phase 4 authority.

### owner-14 — verbatim

> tiếp tục

Recorded effect only: tiếp tục exact detailed-plan correction round `2` sau runtime quota blocker `You've hit your usage limit... try again at 4:59 AM`; không đổi GOAL, scope, findings, writer paths, correction budget hoặc cấp Git/remote/Phase 4 authority.

## Candidate lineage và current-status ownership

- Workflow/phase/episode: `nma-001-phase-3` / Phase 3 `NMA-WS5` / `detailed-plan`.
- Correction candidate revision: `phase-3-plan-r2`.
- Main-assigned later rereview artifact: `docs/native-multi-agent/reviews/nma-001-phase-3/detailed-plan/phase-3-plan-r2-review-r2.md`; candidate remains immutable while same Reviewer may write only this ignored path.
- Branch/baseline: `feat/native-multi-agent-phase-3`; `HEAD == origin/main == e26e874d01f3b757fdf6dcf84dbd58f59f63babe` tại dispatch/resume audit.
- Planning writer scope: chỉ `phase-3/plan.md` và file này.
- Historical lifecycle: `phase-3-plan-r1` received Plan Reviewer round `1` `PASS`; later cumulative implementation review found `P3IR0-001/002`, requiring this Planner-owned correction before dependent implementation correction.
- Current implementation/review/delivery truth is owned exclusively by `docs/native-multi-agent/progress.md`; this brief does not declare current completion, pending work or transition state.
- Phase 3 implementation authority remains bounded by owner-9/10/11/12 and current Main snapshot. Local commit and every remote/Phase 4 action remain not granted.

## Material plan projection for Owner review

1. Correct only the canonical Owner-source procedure, its scenario matrix and existing static test so non-contiguous package membership is explicit; reusable coverage uses clearly synthetic refs/revision, and no current projection/manifest/registry/runtime is persisted.
2. Add one directly routed `master-plan-workflow.md` reference under the existing planning skill; core retains mandatory permission/stop routing, reference owns conditional procedure/template.
3. Authorize existing `native-multi-agent-workflow/references/review-artifact-and-reconciliation.md` as the active operational owner for Stage R-A/R-B, independent baseline, six dimensions, contamination blocker, verdict/finding bar, artifact identity, correction budget and planning-only boundary; do not create a resource or duplicate state machine.
4. Deterministic coverage uses the existing `native-multi-agent-workflow.test.mjs` and asserts those semantics in the actual native owner, not only the delegating planning sentence; no new runner/eval suite/CI/package change.
5. Native rehearsal uses exactly two fresh roles, at most six child turns, zero Specialist, exact r0/r1 ignored review artifacts and one same-session correction/rereview.
6. Rehearsal candidate remains exact native-session output in Main's ephemeral ledger; it never becomes canonical Master Plan or Git candidate.
7. Current lifecycle/delivery status remains exclusively in `progress.md`. The plan does not preclaim implementation correction, cumulative rereview `PASS`, commit or Phase 4; no-commit authority still requires a separate Owner grant for Git closure.

## Exact action permissions

| Action | Evidence state |
| --- | --- |
| Write the two Phase 3 planning candidates | Granted by Main dispatch |
| Implement exact approved `NMA-WS5` paths after plan gates | Granted by owner-9/current authority snapshot |
| Apply owner-10 smallest goal-preserving package correction | Explicitly required by owner-10/current dispatch |
| Run targeted deterministic checks | Included in bounded local implementation verification |
| Run the exact two-role, six-turn, non-mutating rehearsal | Included in mandatory approved Phase 3 verification; `0 specialist` |
| Write exact preassigned ignored review artifacts | Allowed only for assigned Reviewer rounds; never Git scope |
| Stage / commit / push / PR / CI watch-fix / merge | Not granted |
| Deploy / DB-production-remote mutation / destructive / history rewrite / force-push / branch deletion | Not granted |

## Decision boundary

Không có material GOAL/architecture decision mới trong current candidate. `P3IR0-001` đổi classification lịch sử của một existing reference từ audit-only thành exact operational implementation owner; `P3IR0-002` trả current-state ownership hoàn toàn về `progress.md`. Exact entries ở brief này chỉ support Owner-facing decision evidence và correction candidate identity; Main không dùng chúng thay cho later ephemeral projection/admission. Same Plan Reviewer phải rereview r2 trước dependent implementation correction. Không được preclaim cumulative rereview `PASS`, commit hoặc Phase 4; mọi Git/remote action vẫn chưa được cấp.
