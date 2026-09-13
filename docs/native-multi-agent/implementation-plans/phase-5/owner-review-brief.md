# Phase 5 — Owner review brief

Brief này là durable Owner decision/approval/action-authority interpretation surface cho [Phase 5 plan](./plan.md). Nó không phải dispatched Owner Source Package, inclusion/exclusion record, live lifecycle ledger, review journal hoặc future admission source. Main phải project exact current package trước mỗi managed-role dispatch.

## Candidate source identity

- Workflow/phase/episode: `nma-001-phase-5` / `Phase 5 — NMA-WS7` / `detailed-plan`.
- Candidate revision: `phase-5-plan-r2`.
- Candidate consumed Owner-record revision `2`, exact ordered refs `[owner-1, owner-2]`. Identity này chỉ giúp diễn giải current plan candidate/review; later role không dùng nó để infer package membership, current authority hoặc admission state.
- Brief không sở hữu role/session, review round/counter, expected artifact, candidate bytes, current transition hoặc future Owner package.

## Exact Owner decision evidence

### owner-1 — verbatim

> fetch remote, sync main, tạo nhánh mới sau đó thực hiện phase 5 của native multi agent plan, có thể commit

Recorded effects only:

- Main đã fetch/sync và tạo `feat/native-multi-agent-phase-5` từ exact `main == origin/main == 61f3e5f146fb8328136452da018e3c5a78f78cf3` trước Planner dispatch.
- Owner yêu cầu thực hiện approved Phase 5 / `NMA-WS7`; local planning, implementation, managed review và proportional local verification thuộc exact bounded Phase 5 scope.
- Owner cho phép local commit sau khi final managed review gates đạt. Grant bao phủ reviewed Phase 5 implementation commit và stable progress-only closure commit, nhưng không hồi tố cho pre-review state.
- Entry không cấp push, PR create/update, CI watch/fix, merge, deploy, database/production/remote mutation, destructive action, history rewrite, force-push hoặc branch deletion.
- Entry không tự phê duyệt controlled adoption. Master Plan giữ adoption/rollback decision ở Owner sau khi evidence package sẵn sàng.

### owner-2 — verbatim

> tiếp tục, nếu gặp cảnh báo hết quota thì có thể retry 2 lần

Recorded effects only:

- Owner cho phép retry tối đa hai lần khi gặp đúng cảnh báo hết quota; quota blocker không tự tiêu thụ detailed-plan correction round.
- Entry này chỉ đổi execution-recovery authority. Nó không đổi GOAL, Master Plan/Phase 5 scope, candidate semantics, writer paths, correction-round budget, Git/remote authority hoặc adoption boundary.

## Material interpretation for Owner review

1. Smallest confirmed Phase 5 implementation edits đúng bốn paths: `docs/agent-workflow/plan.md`, `.agents/skills/code-review-and-quality/references/specialist-review.md`, `implementation-plans/README.md` và `progress.md`; plan/brief là hai Planner-owned candidate paths.
2. Contextual scan đã classify mọi `reviewer` occurrence trong đúng hai active terminology owners: `17` total, gồm `11` active Specialist-context replacements, `1` canonical lifecycle Reviewer, `4` generic reviewer/human-feedback và `1` explicitly historical occurrence. Implementor chỉ thay exact `11` inventory items trong plan; không mechanical rename `6` preserve-class occurrences và không đổi behavior.
3. `progress.md` phải reconcile Phase 3/4 merged truth từ Git, sau đó ghi Phase 5 evidence/status mà không persist live package/session/review state hoặc preclaim final verdict.
4. Compatibility closure covers `NORMAL`, Master Plan Only, E2E, Owner gate, Reviewer/Specialist distinction, exact artifact/handoff and legacy skill-eval separation.
5. Prior live evidence is reused per claim only when its exact consumed contract/config remains current. Because Specialist semantic wording changes, Phase 2 live semantic observation is `historical_only`; current unchanged profile/config gives structural callability evidence, while corrected sources/current review/post-correction fresh reader cover semantics. Another mode cannot substitute.
6. One bounded fresh-reader governance observation is mandatory after complete `11`-replacement correction. Reader gets both corrected owners and must recover an unambiguous Reviewer/Specialist distinction; it does not get this candidate, expected answer, author conclusion or earlier output. Instruction-bounded access is not filesystem isolation.
7. Existing review artifacts are exhaustively inventoried by exact path plus embedded identity. Current/open Phase 5 identity or any ignore/tracked/staged violation blocks; unknown deviations also block. Four known pre-Phase-5 naming/relocation families are reported as historical limitations, excluded from verdict selection/admission and never rewritten/deleted.
8. Phase 5 may become technically ready and locally committed while `adoption approval` remains pending Owner. No custom runtime, harness, validator, evidence store, provenance layer or rollout service is added.

## Exact action permissions

| Action | Current interpretation |
| --- | --- |
| Correct these two Phase 5 planning candidates | Granted by Main writer package |
| Deterministic author-side checks | Granted within bounded planning |
| Retry after exact quota warning | Up to `2`; does not consume or enlarge semantic correction rounds |
| Fresh-reader action | Main may run one bounded zero-history, one-turn, instruction-bounded read-only observation as mandatory Phase 5 local verification; not a Specialist/lifecycle Reviewer and no delegation by Planner |
| Local Phase 5 implementation after admitted Plan Reviewer `PASS` | Granted for exact accepted four Implementor paths and only the complete `11` replacements frozen in the plan across the two active owners |
| Managed implementation review/correction | Granted within exact Phase 5 workflow and bounded rounds |
| Local commit | Granted only after final admitted Implementation Reviewer `PASS`; exact reviewed implementation then stable progress-only closure |
| Controlled adoption / rollback decision | Pending Owner after evidence package; not granted by review or commit |
| Push / PR / CI watch-fix / merge / deploy / remote mutation | Not granted |
| Database/production mutation / destructive action / history rewrite / force-push / branch deletion | Not granted |
| Specialist consultation | `0`; no delegation/spawn by Planner |

## Durable ownership boundary

- [Master Plan](../../plan.md) owns GOAL Revision `1`, `NMA-WS7`, compatibility/adoption contract and Phase 5 gate.
- [Phase 5 plan](./plan.md) owns stable scope, task-local lineage, currentness/fresh-reader/inventory procedure, acceptance, verification and stop/rollback contract.
- File này owns only owner-1/owner-2 decision/approval/action-authority interpretation plus minimum candidate/source identity.
- [README](../README.md) owns implementation-artifact navigation only.
- [Progress](../../progress.md) owns concise current implementation/verification/delivery/adoption truth.
- Main's ephemeral workflow context owns future Owner package membership, reader/role session IDs, review rounds/counters, candidate snapshots, exact artifact admission and transitions.
- Ignored Reviewer artifacts own detailed findings/verdicts; raw fresh-reader observation stays in actual native/session evidence and only its concise claim-limited status enters progress.

## Decision boundary

No material GOAL, Master Plan or Phase 5 semantic-root change is introduced. Correction round 2 keeps `P5PR0-002=RESOLVED` and closes the remaining `P5PR0-001` causal family by retaining the exact two active owners/six-path boundary while replacing the incomplete exact-three freeze with all `17` contextual classifications and complete `11`-replacement inventory. Main must admit Plan Reviewer `PASS` for exact `phase-5-plan-r2` before implementation. Final admitted six-path Implementation Reviewer `PASS` plus current mandatory fresh-reader, compatibility, two-tier artifact inventory, evidence-currentness and deterministic checks are required before local commit authority is usable.

Local commit closes only the reviewed repository checkpoint. Owner must separately decide controlled adoption/rollback and any push/PR/CI/merge action. Missing/non-passing fresh-reader evidence, stale mandatory evidence, any unclassified/ambiguous Reviewer-for-Specialist manifestation, a replacement outside the frozen `11`, any current/open or unknown artifact identity deviation, or any review-artifact Git violation keeps Phase 5 blocked and does not authorize a broader fix. Known pre-Phase-5 limitations remain visible but do not select/admit a current verdict and are not rewritten/deleted. Vì round `2/2` là automatic correction cuối, unresolved finding sau rereview routes `OWNER_DECISION_REQUIRED`.
