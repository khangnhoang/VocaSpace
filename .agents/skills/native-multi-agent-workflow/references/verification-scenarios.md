# Verification Scenarios

Read this matrix when implementing, changing, reviewing, or verifying the native workflow skill or project role configuration. Read it again before any native smoke.

## Deterministic contract matrix

| Scenario | Expected disposition |
| --- | --- |
| One coherent bounded task | `NORMAL`; no managed role ceremony |
| Broad initiative needs decomposition only | `MULTI_AGENT_MASTER_PLAN`; reviewed plan, no implementation |
| Bounded cross-owner deliverable benefits from independent phases | `MULTI_AGENT_E2E`; serialized Planner → Reviewer → Implementor → Reviewer |
| Material GOAL/scope/ownership/permission conflict | `OWNER_DECISION_REQUIRED` |
| Reviewer versus Specialist | Reviewer is mandatory/full/verdict-owning; Specialist is optional/advisory/caller-owned |
| Synthetic record revision `7` declares non-contiguous `[fixture-owner-2, fixture-owner-5]` | Admission exact-compares the declared ordered set; excluded ended entries are not required |
| Projection excludes an ended or unrelated entry by `applies_to`, current scope, and authority | Record a concise exclusion reason only in the ephemeral ledger; forward only included entries whole and in original order |
| Projection excludes an interpretively relevant entry only because it was superseded | Reject the projection; retain the entry needed to understand the amendment, authority change, or semantic constraint |
| `owner_input_revision` is greater than the count or highest ordinal of included refs | Treat revision as Owner-record identity, never as contiguous package membership |
| Owner package complete | Role echoes exact revision and ordered refs before substantive work |
| Declared included entry missing, truncated, reordered, unreadable, or coverage-incomplete | `BLOCKED(owner_input_unavailable)`; an explicitly excluded entry is not missing input |
| Proposed durable inclusion/exclusion manifest, registry, database, or provenance service | Reject; package projection and its reasons remain workflow-ephemeral |
| Owner input permits materially different semantic interpretations | `BLOCKED(ambiguous_owner_intent)`; Main opens the Owner gate |
| Clarification | Increment Owner and logical candidate revision; same author/reviewer path |
| Detailed-plan change | Supersede affected plan candidate and reopen same Planner |
| Authority-only change | Refresh authority snapshot without semantic GOAL revision |
| GOAL/invariant/scope change | Preserve work and stop for Owner GOAL revision/disposition |
| Prior-work disposition | Record exact retain/rework/supersede/revert/abandon decision before resume |
| Established deterministic expectations pass before initial review | Reviewer round `0` may open |
| Encoding/EOL/newline, exact literal/revision, changed-path, or artifact Git-scope closure fails | Return to the owning writer before Reviewer dispatch; no review/correction round consumed |
| Initial review | `review_round=0`; correction count `0` |
| Defect materially affects authority, route/state, source ownership, candidate identity, acceptance/verification, or completion truth | `Required`; include the causal path |
| Cosmetic or historical wording has no material causal path | Non-blocking `Suggestion`, `Nit`, or `FYI` |
| Several findings share one causal family | Correct the governing invariant and scan the full candidate for every same-family manifestation |
| Correction keeps Owner revision, scope, authority, semantics, and affected boundary stable | Same Reviewer uses focused dispositions/diff/evidence plus a narrow regression scan; full candidate remains available |
| Correction materially changes Owner revision, scope, authority, semantics, or affected boundary | Repeat the full review package |
| Completed correction/rereview 1 or 2 | Same author and same Reviewer session; increment completed count only after rereview |
| Blocker before rereview completes | Resume same round/session; correction count unchanged |
| Blocking findings after round 2 | `OWNER_DECISION_REQUIRED`; no automatic round 3 |
| Candidate path/existence/bytes changed during review | `BLOCKED(candidate_moved)`; verdict not admitted |
| Reviewer writes outside exact artifact | `BLOCKED(reviewer_scope_violation)` |
| Review artifact tracked or staged | `BLOCKED(review_artifact_git_scope_violation)` |
| Crossed workflow/phase/episode/revision/artifact identity | `BLOCKED(stale_handoff)` |
| Running authority-sensitive steer without quiescence/audit/resume | `BLOCKED(owner_steer_not_synchronized)` |
| Required model/session/config unavailable | Exact `BLOCKED(...)`; no substitution |
| Admitted `PASS` needs durable completion recording | Commit reviewed implementation, then progress-only commit records stable facts and implementation hash; never its own hash or `pending this checkpoint` |
| Proposed database/runtime/log/scheduler/fingerprint/manifest/polling mechanism | Reject unless a separately approved established need proves native/ephemeral mechanisms insufficient |

Static verification must assert root → lifecycle → skill routing, resource containment/read conditions, mandatory core invariants, deterministic pre-review closure, artifact-neutral materiality, root-cause correction plus focused/full rereview boundary, stable progress closure, absence of forbidden custom mechanisms, project profile boundaries, exact model/effort/sandbox mapping, review ignore/tracked/staged state, Markdown links, UTF-8/EOL hygiene, and `git diff --check`.

## Bounded native smoke protocol

Native smoke requires explicit current permission. Before dispatch, Main fixes exact roles/questions/actions, maximum roles/turns, candidate paths, expected artifact, starting Git/path snapshot, Owner package, authority, and stop conditions. Use only project-native profiles and native session/message/follow-up/interrupt/wait primitives; do not substitute `codex exec`, an eval CLI, custom scripts, another backend, or a database.

Exercise only the approved cases: zero-history initial role, native identity/status, same-session follow-up, interrupt/quiesce plus actual-state audit plus same-session resume, exact Owner steer propagation, same Reviewer rereview, exact artifact-only write, candidate stability for tracked/already-dirty/untracked paths, and one-level Reviewer-to-Specialist consultation whose result returns to Reviewer for an independent full verdict.

Stop immediately on out-of-scope mutation, candidate movement, Git-scoped review artifact, stale identity, unavailable required model/profile/session, unsynchronized steer, unbounded retry, or unexpected native semantics. Do not retry without an observed state change and authority.

## Claim limits

Deterministic checks do not prove live orchestration. A smoke observation applies only to the exact repository, config, client, model, sessions, access, and time exercised. Do not claim strict isolation, malicious-agent resistance, automatic routing in every client, cross-workspace retention, future behavior, or production readiness. If smoke is not authorized or unavailable, record `not_run` or `BLOCKED`; do not weaken the Phase gate or introduce a custom fallback.
