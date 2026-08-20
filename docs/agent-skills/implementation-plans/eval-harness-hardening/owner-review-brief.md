# Agent Skill Eval Harness hardening — owner review brief

## Decision state

- Material architecture baseline: owner-decided in the `2026-08-20` task.
- Detailed implementation plan: [plan.md](./plan.md).
- Delivery state: Stage 1 (`CP1–CP4`) was implemented and initially pushed at `118fefbd6b35576ac62f266874d9a5b9864b76bc` on `2026-08-20`; Stage 2+ remains unauthorized.
- The bounded correction authority was limited to Stage 1 verification/correction, deterministic verification, coherent normal correction commits and exactly one final normal correction push. It never permits CP5+, live model/helper/evaluator/provider calls, PR creation/update, CI watch/fix, merge, deployment or history rewrite.

## Proposed delivery shape

Ten numbered dependency checkpoints; CP8 has two mandatory sequential rollback subcheckpoints:

- Stage 1 — Foundation & Correctness: CP1–CP4.
- Stage 2 — Eval Workflow: CP5–CP7.
- Stage 3 — Integration & Delivery: CP8A–CP10.

These stages are organizational authorization/delivery groups only. Existing CP ownership, dependency order, acceptance gates and rollback boundaries remain unchanged.

1. CP1 freezes v1 compatibility and defines strict v2 artifacts.
2. CP2 establishes reader/evaluator/acceptance identities and conservative impact.
3. CP3 adds durable task/run state, immutable attempts and resume.
4. CP4 compiles the exact invocation and enforces P0 before any call.
5. CP5 adds sequential reader execution, validation, reuse and resume.
6. CP6 adds advisory evaluator proposals, one canonical aggregate review summary, deterministic Markdown/HTML views, human review and accepted evidence.
7. CP7 adds progress/cancel/timeout/retry and then bounded concurrency, and feeds those actual durable outcomes into CP6's existing operational-aggregate contract.
8. CP8A implements/certifies the owner-selected concrete provider adapter with deterministic mocked transport and zero live calls; CP8B adds lifecycle cleanup, v1 compatibility, CI and operator docs.
9. CP9 is a separately authorized real-model pilot on exactly six named cases.
10. CP10 performs cumulative review and a separate delivery decision.

Every implementation checkpoint requires its own passing deterministic gates and `0 Critical / 0 Required` review before the next checkpoint.

## Non-negotiable safety/authority decisions

- A correct package policy is insufficient: the exact compiled reader invocation must expose it and the adapter must satisfy enforcement. Failure before dispatch guarantees reader call count `0`.
- Readiness permits at most two rounds and one ephemeral run-config correction; never a third round or automatic durable-contract edit.
- `run_manifest.runtime_config_sha256` binds the initial durable Round 1 runtime configuration. An allowed Round 2 keeps that manifest immutable and binds its exact dispatch runtime through the audited `before_sha256 → after_sha256` correction plus compiled-invocation/readiness hashes.
- Verification helper calls default to `0`; when one genuine uncertainty cluster requires them and exact external-call authority exists, at most `2` read-only helper calls are allowed in Round 1. Helpers are not readers/evaluators or accepted evidence; unresolved uncertainty after Round 2 causes bounded conservative rerun/invalidation or STOP.
- Evaluator static config is checked in run readiness; after valid reader evidence exists, the exact evaluator invocation set must pass a separate binding/integrity guard before any evaluator call. Failure guarantees evaluator call count `0` and preserves valid reader evidence without creating round 3.
- Model evaluator output is only `evaluator_proposal`. Deterministic code creates authoritative `human_evaluation` only after a bound human/authorized-reviewer decision.
- Reuse keys logical inputs, not HEAD/ref. Reader, evaluator and acceptance invalidation are separate.
- Evaluator reuse hashes exact behavior-relevant evaluator-visible evidence projections plus runtime/protocol identity. Full validated artifacts remain integrity/provenance-bound, but attempt IDs, timestamps, storage paths and unrelated audit metadata do not invalidate reuse unless they are actually evaluator-visible or behavior-relevant.
- `reader_input_id` binds pre-dispatch attested execution conditions, not post-run observed access. Runtime-observed access is output evidence; contradiction invalidates the observation.
- Unknown impact is not unaffected. Rerun a bounded dependency-closed group when analysis is uncertain.
- Attempts and valid artifacts are immutable and resumable. Ambiguous remote-call outcome is not blindly retried.
- Task lifecycle is `active → closed | abandoned`; implementation/review/commit/push/PR/merge states do not auto-close it. Active/open-review/open-PR/expected-correction state is retained; cleanup handles only explicit closed/abandoned heavy data; TTL is fallback.
- V1 artifacts remain readable but are never auto-promoted to accepted v2 evidence.
- All reader/evaluator/user-derived review content is untrusted display text. It may never become raw Markdown/HTML, executable JavaScript/CSS, an event handler, unsafe URL or remote resource load; renderer/security failure blocks review readiness and acceptance.
- Canonical aggregate counts are derived from exact bound memberships and declared count units/scopes. Duplicate, incomplete, cross-unit or contradictory arithmetic fails validation; missing evidence is never relabeled as `not_run` or `inconclusive`.

## Owner-decided human review representations

CP6 must produce one canonical structured `run_review_summary`, serialized as `summary.json` or the final equivalent convention, and two required deterministic representations:

```text
canonical run review summary
        ↓
    summary.json
       ├── summary.md
       └── summary.html
```

- The canonical structured artifact is the source of truth for schema validation, semantic hashes, acceptance binding and deterministic report linkage.
- Markdown is the default no-browser view. Untrusted content is emitted only through a context-aware plain-text primitive, never raw Markdown/HTML/link/image/autolink syntax. HTML is static self-contained/offline-safe renderer-owned HTML/CSS with `<details>` only: no JavaScript, event handlers, forms, frames/objects, external network/CDN or remote-resource capability. A restrictive CSP is defense in depth, not a substitute for escaping.
- Evidence links are renderer-owned typed local artifact targets, canonicalized and contained under the task store. Model/user-derived, absolute/external/protocol-relative, traversal-escaping and unsafe-scheme URLs are rejected or displayed as inert text.
- A normal 21–24 case run must show selected suite/case counts; baseline and candidate `passed`/`partially_passed`/`failed`/`not_run`; comparison `improved`/`equivalent`/`regressed`/`inconclusive`; reader/evaluator reuse, new execution, retry and relevant timeout/cancel/blocked counts; readiness/P0/helper result; every exception with a concise reason; routing/resource anomalies; limitations; evaluator recommendation; and exact proposed human decision scope.
- Successful/equivalent cases remain aggregate-first with drill-down references. Owner review does not require opening every such case by default.
- Renderer failure or semantic drift blocks review readiness/acceptance. An old rendered file cannot accept changed canonical scope. Presentation-only rerender with unchanged canonical semantics does not invalidate accepted evidence.
- Baseline/candidate/comparison buckets must partition their exact declared assessed scope; explicit unassessed/incomplete partitions close selected scope without pretending missing evidence ran. Reused/newly-executed/blocked units exhaust their declared logical scope; initial/retry and terminal/nonterminal attempt partitions use separate exact denominators, expose `outcome_unknown`, and are rebuilt from durable state after resume.
- Accepted report totals are recomputed from the exact dependency-closed membership authorized by the human decision; partial acceptance cannot inherit full-run totals, and every report partition must match the canonical projection for that accepted scope.
- Human acceptance binds canonical summary/proposal/evidence scope, not incidental Markdown/HTML/CSS bytes. Renderer version, security-policy version and output hashes are retained separately for audit/freshness; obsolete or unsafe representations cannot remain the default decision surface.

These are generated runtime/task artifacts under the Git-common-dir task store, normalized as `runs/<run-id>/review/summary.{json,md,html}` in the current architecture. Stable `task_id` remains lifecycle identity and stable `run_id` remains run identity; timestamps/branch/PR are navigation/provenance metadata only. Review artifacts follow active/closed/abandoned retention and must never enter repository Git status/add/push scope. Shared/raw evidence remains content-addressed instead of duplicated into `review/`.

## Real-model gate

CP1–CP8B make zero live model calls. CP8A must first certify the owner-selected concrete provider adapter through deterministic mocked-transport tests. CP9 then needs new explicit authority for live model/provider cost, runtime enforcement, any optional real helpers, reviewer and retention, and covers only:

- `gcw-reg-commit-versus-push`
- `gcw-route-push-remote`
- `gcw-fresh-dirty-secret-stop`
- `ghci-reg-explicit-fix-exact-actions`
- `ghci-route-db-risk-stop`
- `ghci-fresh-self-fix-cycle`

Historical v1 observations cannot seed accepted pilot evidence because they lack the new compiled-invocation readiness attestation.

## Owner review surface

Current decisions and remaining gates stay separate:

1. Stage 1 CP1–CP4 implementation and initial delivery are complete; only the current bounded Stage 1 correction is authorized.
2. Coherent correction commits and exactly one final normal correction push are approved; no intermediate push.
3. Provider/runtime selection for CP8A remains pending and is outside Stage 1.
4. CP9 live model/helper use remains pending with exact cost/runtime/enforcement boundaries still required.
5. PR/CI/merge action after later checkpoints remains pending.

Approval of Stage 1 does not imply any later implementation, live-call, PR, merge or deployment gate.
