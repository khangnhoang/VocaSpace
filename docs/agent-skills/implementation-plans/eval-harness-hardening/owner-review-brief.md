# Agent Skill Eval Harness hardening — owner review brief

## Decision state

- Material architecture baseline: owner-decided in the `2026-08-20` task.
- Detailed implementation plan: [plan.md](./plan.md).
- Delivery state: Stage 1 (`CP1–CP4`) is completed and delivered. Final delivered Stage 1 HEAD is `54453746b2ea796558ef229831a569a69c4ed3f4`; exact latest delivery state belongs to Git evidence. Terminal review is `0 Critical / 0 Required / 1 Advisory`; full Node-on-POSIX remains `not_run` because local WSL2 lacks Node.
- No standing Stage 1 or Stage 2 implementation/commit/push authority remains. Stage 2 CP5–CP7 is completed with terminal cumulative review `0 Critical / 0 Required` using deterministic/fake adapters only.
- Stage 3 CP8A is completed at `f9c821323ae5e8aa277d2cd68d4b416d80cf553e` with terminal correction review `0 Critical / 0 Required`; certification used deterministic mocked App Server transport and live model/helper/evaluator/provider calls `0`.
- The bounded [CP8B contract](./plan.md#cp8b-pre-code-contract-freeze--owner-approved) closed at `19cd324b7a0fd1509bddf441a2572360013e72f5` with `CP8B_CLOSURE_ACCEPTED` and `0 Critical / 0 Required / 0 Advisory`.
- CP9 admission/measurement design, bounded live transport, production-owned preparation, bounded R1–R4 correction and R4 regression-semantics follow-up are complete. The exact `config_sha256=349a383d4d348c48288cea738b61f2dbcebb0bb32ba5cc1c55150aa38934b60d` is enforced before first preparation materialization; complete invocation/readiness closure is revalidated before authority issuance; and resolved authority is cross-bound to the preparation-owned grant before mutation. Focused CP9 is `24/24`: independently valid donor invocation/readiness substitutions fail at `CP9_PREPARATION_STALE`, preparation uses an observable fake App Server method ledger, and bad authorities leave the complete target-run tree unchanged. No new production defect was found. Bounded self-review is `0 Critical / 0 Required`. CP8B's unrelated expired fixed-clock fixtures remain `20/24` and a truthful Advisory verification gap; all other requested gates pass. The pilot remains `not_run` and requires separate live authorization after independent re-audit; push, PR/CI/merge/deploy, history rewrite and CP10 remain unauthorized.

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
8. CP8A implements/certifies `codex_chatgpt_app_server` at the exact harness → App Server boundary under `runtime_mediated`, with deterministic mocked transport and zero live calls; CP8B adds canonical/runtime-index retention, App Server shadow-thread cleanup, v1 compatibility, CI and operator docs.
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
- Immutable `task_manifest` records creation; append-only lifecycle events own only `active → closed | abandoned`, with no reopen. An exact task-bound successful PR merge may close automatically; unrelated/external merge, branch deletion, generic Git/GitHub state, TTL, implementation/review/commit/push or PR state cannot. External merge requires explicit owner reconciliation, and abandon requires explicit owner authority.
- Durable `open_review | open_pr | expected_correction` holds independently block every destructive canonical/shadow action until an exact attributable release. Holds are never inferred from ad hoc Git/GitHub state.
- Cleanup is retain-first and classifies exact candidates as `retain | quarantine | purge_eligible`. Dry-run is default; apply binds one exact reviewed plan hash and owner authority; purge is separately authorized after quarantine. Stale lifecycle/hold/journal/root/reachability state fails before mutation, and global reachability preserves any shared CAS object referenced by any retained graph.
- App Server shadow history remains separate and non-authoritative. CP8B certification uses a deterministic/mock cleanup adapter only; exact acknowledged harness-created task/run/attempt/thread identity, terminal certainty, closed/abandoned lifecycle, no holds and exact-plan membership are all required. Unknown/fuzzy/ambiguous state never authorizes deletion or a success claim.
- TTL may provide age/review hints and local orphan quarantine eligibility only. It cannot create lifecycle/certainty, release holds, override a plan or automatically delete stale threads.
- V1 artifacts remain readable but are never auto-promoted to accepted v2 evidence.
- All reader/evaluator/user-derived review content is untrusted display text. It may never become raw Markdown/HTML, executable JavaScript/CSS, an event handler, unsafe URL or remote resource load; renderer/security failure blocks review readiness and acceptance.
- Canonical aggregate counts are derived from exact bound memberships and declared count units/scopes. Duplicate, incomplete, cross-unit or contradictory arithmetic fails validation; missing evidence is never relabeled as `not_run` or `inconclusive`.
- For `codex_chatgpt_app_server`, “exact” means exact harness-controlled input and exact newline-delimited JSON App Server request written to the local boundary; App Server wire messages omit the `jsonrpc` header. It never means exact upstream provider request bytes/IDs, provider-side idempotency, every built-in/model-visible instruction or reproducible output.
- Immutable `run_manifest.intent` owns why a run exists and records the external authority basis/scope without granting authority. Before every `turn/start`, the harness must atomically persist and validate the human-readable input, canonical request, runtime attestation and derived index; failure or drift guarantees zero `turn/start` writes.
- App Server thread history is a runtime-owned shadow store, not canonical evidence or reuse authority. A durable pre-write `thread_start_write_intent` owns the crash window before acknowledgement; an unknown resulting ID is `shadow_thread_outcome_unknown`, never guessed. CP8B owns inventory/quarantine and terminal cleanup. `active`, open-review/open-PR/expected-correction, `outcome_unknown` and unresolved shadow-thread state cannot lose canonical evidence or authorize deletion.
- The opaque provider envelope is an `unknown` cross-run equivalence dimension. This adapter may resume valid completed evidence only within the same run; cross-run reader/evaluator semantic reuse is disabled until a separately certified capability closes that dimension.

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

## CP8B owner decision surface

- Lifecycle authority: immutable creation plus contiguous hash-bound/CAS `task_lifecycle_event` sequence; exact basis is `task_bound_pr_merge | owner_reconciled_close | owner_abandoned`.
- Retention authority: durable `cleanup_plan` records exact lifecycle/holds/roots/classifications/reasons/shared reachability/shadow actions and canonical plan hash. Independently verified owner issuance writes an immutable canonical cleanup-authority record; destructive callers provide only its exact task/id/authority-hash/record-hash reference, and apply/purge resolve plus revalidate that record and `issued_at <= operation_time <= expires_at`. `retention apply` cannot mint/recompute/exceed authority; `retention purge` requires a separately issued exact authority.
- Retained minimum: creation/lifecycle/holds, run/journal, why/intent, compiled/readiness/runtime certainty, semantic evidence/summary/decision/report identities, cleanup history and tombstones remain sufficient to reconstruct authority and reason.
- Review authority: canonical summary/decision remains source of truth. Durable representation metadata binds canonical hash, renderer/security-policy versions, representation hashes and freshness identity; stale/corrupt views rebuild or quarantine without changing semantics.
- Legacy authority: `legacy inventory` is read-only catalog/reference. “Import” never promotes v1 into v2 task, readiness, runtime, reuse, evaluator, acceptance, report or cleanup authority.
- CI/operator boundary: deterministic local v2/CP8A/CP8B tests and repository validation only; no network, credentials, database, browser, live model or real App Server cleanup.
- Explicitly excluded: generic workflow platform, distributed GC/consensus, background daemon, branch-deletion automation, TTL authority, fuzzy shadow ownership, provider-transparent claims, CP9/CP10 and any live call.

The full artifact fields, seven semantic relationship chains, 18 minimum regressions, source/test map and stop conditions are authoritative in the CP8B freeze. CP8B implementation must end at `0 Critical / 0 Required` before CP9 can be considered.

## Real-model gate

CP1–CP8B make zero live model calls. CP8A must first certify `codex_chatgpt_app_server` through deterministic mocked-App-Server transport tests, including ChatGPT-only auth, exact pre-dispatch snapshots, runtime lineage and call-certainty semantics. CP9 then needs new explicit authority for exact ChatGPT-subscription reader/evaluator/helper call limits, runtime/model/effort and rate-limit boundary, reviewer and retention. API-key fallback and separate OpenAI API billing remain forbidden. CP9 covers only:

- `gcw-reg-commit-versus-push`
- `gcw-route-push-remote`
- `gcw-fresh-dirty-secret-stop`
- `ghci-reg-explicit-fix-exact-actions`
- `ghci-route-db-risk-stop`
- `ghci-fresh-self-fix-cycle`

Historical v1 observations cannot seed accepted pilot evidence because they lack the new compiled-invocation readiness attestation. CP9 evidence may claim only the observed local App Server/runtime boundary and six-case semantic results; it cannot claim provider-envelope transparency or API cost.

The selected Tier 1 design is one staged ASM-PR5B run: baseline `3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a`, phase 1 `41de1e627479b1feb6bd60eec1073bdd1591d490`, phase 2 `c3a2534b8a0c21a9276e5a6fba34f755daaf8e9e`. It has 12 reader units, expects exactly three phase-2 affected GHCI candidate units and nine same-run resumed units, then 12 evaluator units because the current stage contract requires one exact evaluator mapping per reader unit. The final hard ceilings for any separately authorized pilot are at most `15 reader / 12 evaluator / 0 helper / 0 automatic retry / 27 total`, `gpt-5.6-sol`, effort `high`, ChatGPT subscription only, reviewer `local_named_reviewer: "khang"`, and retention through CP10 under an `open_review` hold. Canary-before-fanout and stop-on-failure remain mandatory. Tier 2 is not needed.

Historical baselines remain separate: ASM-PR3 full-fanout is `61` reader calls (`reconstructed`), while semantic-substitution dogfood is `62 reader / 0 helper / 0 evaluator` (`exact_observed`) with `34` pre-final/abandoned, `19` primary, `5` bounded retry and `4` one-unit correction calls. These are historical context, not a live A/B. Historical tokens, wall-clock and complete model-visible input/output bytes are `unavailable`; exact CP9 token usage also remains `unavailable` unless later live App Server responses expose trustworthy usage that the certified transport retains. See the detailed CP9 admission section for claim labels and measurement boundaries.

## Owner review surface

Current decisions and remaining gates stay separate:

1. Stage 1 CP1–CP4 implementation and delivery are complete at final delivered HEAD `54453746b2ea796558ef229831a569a69c4ed3f4`; exact latest delivery state belongs to Git evidence.
2. No standing Stage 1 or Stage 2 implementation/commit/push authority remains. Stage 2 CP5–CP7 and its cumulative integration review are complete at `0 Critical / 0 Required`; exact latest delivery state belongs to Git evidence.
3. CP8A implementation/correction is complete at `f9c821323ae5e8aa277d2cd68d4b416d80cf553e`, terminal `0 Critical / 0 Required`, deterministic mocked transport only and live calls `0`.
4. CP8B closed at `19cd324b7a0fd1509bddf441a2572360013e72f5` with `CP8B_CLOSURE_ACCEPTED` and `0 Critical / 0 Required / 0 Advisory`.
5. The authorized CP9 Tier 1 attempt stopped before `reader-canary`; no authority record or model turn was created. Production preparation and R1–R4 corrections are completed with exact runtime fingerprint enforcement, closure validation and preparation-owned authority joining; the R4 regression-semantics follow-up raises focused CP9 to `24/24` without a production change, bounded self-review is `0 Critical / 0 Required`, and calls remain `0`. CP9 remains `not_run`; independent re-audit and a later separate exact live authorization remain mandatory before pilot execution.
6. Push/PR/CI/merge action after later checkpoints remains pending.

Approval of Stage 1 does not imply any later implementation, live-call, PR, merge or deployment gate.
