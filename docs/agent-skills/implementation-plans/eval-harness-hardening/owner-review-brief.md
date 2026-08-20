# Agent Skill Eval Harness hardening — owner review brief

## Decision state

- Material architecture baseline: owner-decided in the `2026-08-20` task.
- Detailed implementation plan: [plan.md](./plan.md).
- Implementation permission: `pending`.
- Current task permits planning commits and exactly one normal push only; it does not permit harness implementation, model execution, PR creation, CI watch/fix, merge or deployment.

## Proposed delivery shape

Ten dependency-ordered checkpoints:

1. CP1 freezes v1 compatibility and defines strict v2 artifacts.
2. CP2 establishes reader/evaluator/acceptance identities and conservative impact.
3. CP3 adds durable task/run state, immutable attempts and resume.
4. CP4 compiles the exact invocation and enforces P0 before any call.
5. CP5 adds sequential reader execution, validation, reuse and resume.
6. CP6 adds advisory evaluator proposals, human review and accepted evidence.
7. CP7 adds progress/cancel/timeout/retry and then bounded concurrency.
8. CP8 adds lifecycle cleanup, v1 compatibility, CI and operator docs.
9. CP9 is a separately authorized real-model pilot on exactly six named cases.
10. CP10 performs cumulative review and a separate delivery decision.

Every implementation checkpoint requires its own passing deterministic gates and `0 Critical / 0 Required` review before the next checkpoint.

## Non-negotiable safety/authority decisions

- A correct package policy is insufficient: the exact compiled reader invocation must expose it and the adapter must satisfy enforcement. Failure before dispatch guarantees reader call count `0`.
- Readiness permits at most two rounds and one ephemeral run-config correction; never a third round or automatic durable-contract edit.
- Model evaluator output is only `evaluator_proposal`. Deterministic code creates authoritative `human_evaluation` only after a bound human/authorized-reviewer decision.
- Reuse keys logical inputs, not HEAD/ref. Reader, evaluator and acceptance invalidation are separate.
- Unknown impact is not unaffected. Rerun a bounded dependency-closed group when analysis is uncertain.
- Attempts and valid artifacts are immutable and resumable. Ambiguous remote-call outcome is not blindly retried.
- Active task state is retained; lifecycle cleanup owns completed/abandoned heavy data; TTL is fallback.
- V1 artifacts remain readable but are never auto-promoted to accepted v2 evidence.

## Real-model gate

CP1–CP8 use deterministic fake adapters and make zero model calls. CP9 needs new explicit authority for model/provider/cost/enforcement/reviewer/retention and covers only:

- `gcw-reg-commit-versus-push`
- `gcw-route-push-remote`
- `gcw-fresh-dirty-secret-stop`
- `ghci-reg-explicit-fix-exact-actions`
- `ghci-route-db-risk-stop`
- `ghci-fresh-self-fix-cycle`

Historical v1 observations cannot seed accepted pilot evidence because they lack the new compiled-invocation readiness attestation.

## Owner review surface

Please decide separately:

1. whether CP1 implementation may begin after this planning package is accepted;
2. whether checkpoint commits are allowed and whether any intermediate push is allowed;
3. later, whether CP9 model use is approved with an exact provider/cost/adapter boundary;
4. later, whether PR/CI/merge action is authorized after CP10.

Approval of one item does not imply another. Until explicit implementation approval, status remains `pending`.
