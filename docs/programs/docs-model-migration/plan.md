# DOCS-MIG detail plan — documentation model, evergreen homes and checker migration

Revision: r1, 2026-10-28. Owner approval: approved on 2026-10-28, including P1–P5 and the ID compatibility exception P3, after independent gpt-6.1-sol/high read-only review PASS. The Owner authorized the plan commit, implementation and local commits during implementation; push/PR/merge and additional model/hosted/browser execution remain separate. Master plan/charter: none; this is a single-unit delivery program with sequential checkpoints, not an evergreen capability.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the documentation model adopted prospectively by AR3 becomes usable and checked in VocaSpace. Five evergreen programs own continuing engineering capabilities; existing delivery contracts and evidence retain their meaning and protected paths. This migration does not perform the work described by the documents it moves.

| ID | Observable result |
| --- | --- |
| AC1 | A reader can distinguish delivery programs from evergreen programs in the Programs index. Kind and lifecycle are separate: delivery/evergreen versus active/closed/legacy. An evergreen has a charter, not a competing root master plan; its State lives only in progress.md. |
| AC2 | Agent workflow, security, performance, UI/UX design, and infrastructure/reliability each have one charter defining the boundaries in section 1.5, a progress file and a problems file. No fabricated initiative is opened merely to populate a table. An idle evergreen stays active with no initiative in progress. |
| AC3 | Every source in the migration table has a final disposition. Every moved decision, guardrail, acceptance condition, residual, evidence limit and dependency survives. A move never upgrades Deferred/Accepted/unverified work to Done. |
| AC4 | A moved entry has one live owner. Its former location retains a short Moved to pointer and its original anchor where needed. Product delivery programs retain their product scope; cross-cutting evergreen ownership does not turn into ownership of every feature in that domain. |
| AC5 | Frozen delivery plans, accepted designs, published-migration citations and the open topic-builder branch's protected paths remain resolvable. Historical evidence is dated and linked; it is not restated as freshly observed runtime or hosted evidence. |
| AC6 | The checker accepts supported single-unit delivery, multi-unit delivery, evergreen, backlog and entry-plan shapes; rejects the malformed cases in section 4; and retains existing State, milestone, problems, banner, index, ADR and redirect checks. Exact mechanically enforced versus manually reviewed rules are documented. |
| AC7 | Authoritative feature declarations have globally unique IDs after the approved compatibility mapping. Historical aliases and Moved to pointers remain references, not competing declarations. Existing prefixed IDs such as TFEAT-002 and BFEAT-001 remain stable. |
| AC8 | Plans linked from a new evergreen charter have a matching initiative row and a link to that program's progress. A new ID-prefixed delivery entry plan links to its exact owning problem/feature entry without requiring a fake Units row; existing accepted plan paths/links retain the compatibility described in section 3. At most one initiative per evergreen is open; semantic initiative status is reviewed against progress, not inferred from a filename. |
| AC9 | Existing documents outside the migration table keep their current roles and paths. Closed historical programs are not reopened or moved wholesale. The old agent and UI program histories remain discoverable from the new charters. |
| AC10 | The final candidate passes relevant deterministic tests, skill validation, docs checks and diff hygiene, plus a source-to-destination meaning/anchor audit. Independent plan and implementation reviews remain separate required gates under the lifecycle and need actual execution authority. |

### 1.2 Scope and non-goals

In scope after plan approval and implementation authorization:

- `scripts/docs/check-structure.mjs`, its tests, and the existing docs link checker/tests only if the migration exposes a directly necessary parser or compatibility defect; retain current CLI exit and diagnostic contracts.
- The `repo-docs-system` core, migration reference and affected templates; the existing docs-system ADR and Programs index. Other skills/configuration receive pointer corrections only if a migrated live reference requires them.
- New evergreen homes under `docs/programs/{agent-workflow,security,performance,ui-ux-design,infrastructure}/`, and the exact entry/source dispositions in section 1.6.
- Narrow State reconciliation for a migrated owner, using repository/Git evidence and explicit evidence limits. Add or update backlog entries rather than inventing additional evergreen programs.

Non-goals:

- Product implementation, vulnerability fixes, a security scan, benchmarking, visual redesign, dependency updates, CI workflow changes, new test infrastructure, database/hosted/browser/model calls, deployment or production QA.
- Moving all documents into five folders, rewriting accepted plans or designs, changing product decisions, declaring historical work complete, or restoring retired managed agent machinery.
- Changing `AGENTS.md`, `docs/agent-loops.md`, Claude imports, skill symlinks or unrelated skill bodies; repairing unrelated stale tracker entries is outside this migration.
- Commit, push, PR, merge or branch deletion without separate authority. Proposed checkpoints are not commit grants.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Establish exclusive ownership for each edited source; recheck HEAD, dirty state and the topic-builder protected paths before each source group. | A migration overwrites a concurrent writer or leaves another branch with incompatible contracts. |
| G2. Before changing a source, record its exact baseline and a meaning checklist: decision numbers, IDs, invariants, gates, rollout order, open residuals and evidence limits. Store the concise checklist in this plan's mapping or review evidence, not a new permanent registry. | Formatting hides a lost decision or unresolved follow-up. |
| G3. Keep frozen plan/design bodies and published migrations unchanged; preserve required old paths and anchors with explicit pointers where ownership moves. | Historical contracts or SQL citations break. |
| G4. Move a canonical entry, its surviving follow-ups and its incoming active links together; old copies become pointers. Preserve historical scoped ID aliases under the exact approved exception below. | Two owners diverge, or references silently resolve to a different feature. |
| G5. Change instruction, template, checker, fixtures and current consumers as one integrated candidate. Do not deliver an unsupported new shape or weaken checks to make it pass. | Future agents follow a model the installed tools reject, or existing guarantees disappear. |
| G6. Reconcile only facts supported by local source/Git. Keep unknown hosted state, audible screen-reader evidence and unresolved model observations explicitly unknown. Old grants are historical and cannot be carried forward as current authority. | A document move becomes a false verification claim or renewed execution grant. |
| G7. Stop for a new semantic owner, unlisted source move, changed acceptance, unresolved ID collision or concurrent writer; amend/review the plan before the dependent move. | Implementation invents material decisions downstream. |

### 1.4 Owner decisions and proposed compatibility decisions

Confirmed Owner direction:

- D1 (2026-10-28). Perform the documentation/checker follow-up deferred by AR3 on a new branch; branch `chore/docs-model-migration` was created from synchronized main at `ae2145d7`.
- D2 (2026-10-28). Use five evergreen capabilities: agent workflow, security, performance, UI/UX design, and infrastructure/reliability. Product features remain delivery work rather than extra evergreen homes.
- D3 (2026-10-28). Plan the substantial migration with explicit dependency order before implementing it. The present checkpoint is planning only.

The following proposals were approved with this exact plan on 2026-10-28:

- P1. Deliver one integrated PR with the checkpoints below. Checker/model and migrated consumers are coupled; an atomic rollback is safer than landing unsupported shapes or a long-lived compatibility mode. Local checkpoints may be used under an explicit commit grant, but no intermediate invalid candidate is deliverable.
- P2. Add a Kind column to the existing index; retain active/closed/legacy lifecycle values and existing format exemptions. Classify existing indexed programs as delivery. New evergreen programs use evergreen/active; keep their current initiative status only in progress. No new lifecycle value or format registry is introduced.
- P3. Resolve the baseline bare FEAT-ID collision group by retaining existing student-user-flow-route IDs in the FEAT-001..012 range as-is (do not fill the unused FEAT-010 slot) and assigning auth-onboarding FEAT-001..005 canonical IDs FEAT-013..017 respectively. Preserve the old fully scoped identity and old heading anchor as aliases/pointers, plus all original dates and meaning. This is an explicit migration exception to the current keep-IDs rule, not implicit renumbering permission. Update the skill/template contract in the same candidate. Keep TFEAT and BFEAT IDs; allow existing uppercase prefixed IDs in the feature grammar. Allocate new IDs to previously unnumbered directions only after checking the whole repository. Do not allocate IDs by file order.
- P4. Keep accepted UI design files at `docs/ui-design-system-and-review/`; the new charter owns capability/initiatives, while the existing design index and accepted artifacts continue owning design decisions. Move only future direction ownership and add reciprocal navigation. Do not duplicate accepted design bodies.
- P5. Move cross-cutting open entries, not completed implementation plans. Existing delivery programs remain open whenever units, rollout or unresolved product obligations remain. This migration does not claim their closure just because selected engineering follow-ups moved.

Proposed new IDs for currently unnumbered directions: FEAT-018 theme, FEAT-019 homepage hero, FEAT-020 floating sheet, FEAT-021 animation preference, FEAT-022 learning streak, FEAT-023 local CI gate, and FEAT-024 admin lesson try-out. These labels preserve existing directions; they do not approve new product work. Recheck availability at CP0; a collision requires an explicit mapping correction before transfer.

### 1.5 Evergreen boundaries

| Home | Capability | Boundary and related owner |
| --- | --- | --- |
| `docs/programs/agent-workflow/` | Shared instructions, skill governance/evaluation, planning/review method and the documentation system | Does not own CI execution infrastructure or product features. Existing AGENTS/lifecycle/skill files remain their rule owners; the charter does not duplicate policy. |
| `docs/programs/security/` | Cross-cutting authorization, protection of user data, security residuals and hardening | Does not reopen settled auth/product policy or grant scans/hosted actions. Product implementation still follows its accepted delivery contract. |
| `docs/programs/performance/` | Measurement contracts, latency/resource budgets and evidence-backed optimization across frontend/API/DB | Does not reopen accepted latency or own all DB changes. Historical LF2/LF3/LF8 results remain historical, with their original units and fixtures. |
| `docs/programs/ui-ux-design/` | Design language, reusable components/screen types, accessibility design requirements and rendered review | Existing accepted artifacts stay authoritative at their current paths. Product workflows, data models and feature implementation do not become design-program scope. |
| `docs/programs/infrastructure/` | Dependency maintenance, local/test environments, CI/CD execution and tooling reliability | Agent workflow owns agent permission/procedure rules; security owns safety requirements; this home owns operational mechanics. No dependency or CI behavior changes occur here. |

### 1.6 Source-to-destination dispositions

Paths below are relative to `docs/`. A row is the bounded transfer set, not permission to modify a whole source tree. Before CP3, expand each row to exact entry/section boundaries against the execution baseline; any newly discovered material move returns to plan review.

| Source | Destination / disposition | What must survive or stay put |
| --- | --- | --- |
| `programs/agent-rules/future-features.md`: unnumbered local CI gate direction | Agent-workflow FEAT-023; old source becomes an anchored pointer | Preserve unsettled scope, suite-case prerequisite, CI-command ownership and stop/ask behavior; this does not introduce the gate. |
| `programs/agent-rules/progress.md`: AR3 transition | Reconcile its own State using the local merge history; new agent charter links AR1/AR2/AR3 as historical delivery work | PR 180 merge is repository evidence; pending independent/live-Claude evidence is not silently closed. Do not copy old delivery grants to the new charter. |
| `agent-skills/`, `agent-workflow/`, `native-multi-agent/`, `programs/doc-system-optimization/`, `agent-self-review-plan.md` | Keep paths, closed index rows and historical contents; link from the agent charter | Retired orchestration and unresolved historical eval observations are not current workflow instructions. Do not convert every historical plan into a new initiative. |
| `programs/auth-onboarding/problems.md`: AUTH-006, AUTH-008, AUTH-009, AUTH-022, AUTH-023 | Security problems, preserving IDs; old entries become one-line anchored transfer pointers | Preserve accepted residuals and conditional triggers. AUTH-022's hosted hook behavior remains unobserved; do not remove the marker or claim the exit condition freshly met. |
| `programs/auth-onboarding/problems.md`: AUTH-012 | UI/UX problems, same ID and old-anchor pointer | Preserve 3:1 enabled input/focus requirement, accepted deferral, right-aligned forgot-password direction and required rendered acceptance. AUTH-005 stays with the original delivery history. |
| `programs/auth-onboarding/future-features.md`: old FEAT-001 and FEAT-005 | Security FEAT-013 (password-change notice); UI/UX FEAT-017 (email-template design), subject to P3 | Preserve Auth API scope for the notice; preserve admin-created-account wording and separate redesign authority. |
| Same source: closed domain rollout FEAT-004 | Canonical FEAT-016 closed line in the same tracker, with old anchor; freeze its existing runbook at `programs/auth-onboarding/sources/domain-rollout-20261007.md` | Preserve the original runbook body, dates, authority limits, rollout order and evidence links unchanged apart from relative-link repair. This is a consumed historical source, not an editable duplicate or a new rollout. |
| `programs/auth-onboarding/future-features.md`: old FEAT-002 and FEAT-003 | Backlog FEAT-014 (global discounts) and FEAT-015 (paid-course removal policy), subject to P3 | These are product decisions, not security work. Preserve per-course-code workaround, access/terms tradeoff and the historical A4b decision. |
| `programs/student-user-flow-route/problems.md`: STUDENT-003 | UI/UX problems with original ID and anchor pointer | D8's semantic-color acceptance did not close hierarchy/density/responsive work. |
| `programs/student-user-flow-route/problems.md`: ACTION-QUEUE-001 and E2E-DEV-001 | Infrastructure problems, original IDs; old anchored pointers | Preserve framework-version evidence as historical, CI skips, BFEAT-001 and topic-builder replacement dependencies. No upgrades, unskips or test reruns. Reconcile protected branch references first. |
| `programs/student-user-flow-route/problems.md`: FUTURE-OWNERSHIP-001, FUTURE-PUBLISH-001, FUTURE-PAYMENT-001, PAYMENT-LATE-001 | Retain in delivery program | Product ownership, publication/versioning and payment obligations remain there. Mixed publication residuals are not split across trackers by guesswork; evergreen charters may link to them as related work. |
| `programs/student-user-flow-route/future-features.md` | Retain IDs, product ownership and current source; normalize declaration/closure grammar only where global checker enforcement requires it | Keep outcomes, dates and accepted limits; closed entries remain historical, FEAT-008 is not closed merely because its routing text mentions a merged unit. Do not change product status without exit evidence. |
| `programs/teacher-workflow/future-features.md`: TFEAT-001..004; topic-builder plan and master-plan additions on `feat/topic-builder-redesign` | Retain paths and current ownership for this migration | The other branch changes this feature file and student master plan. No plan relocation, branch merge or cherry-pick is authorized here. Future-feature grammar must accept these stable IDs without touching the protected file. |
| `programs/admin-console/problems.md`, `future-features.md`, remaining AD plans | Retain delivery ownership; number the existing unnumbered lesson try-out direction FEAT-024 in its current tracker; new UI charter links ADMIN-005 as a related consumer | AD4 body acceptance is distinct from shell/list redesign; unfinished header search stays visible. Do not split the same admin redesign into two live owners or change the try-out scope. |
| `ui-design-system-and-review/future-features.md`: theme, homepage hero, floating sheet, animation preference | UI/UX FEAT-018..021 respectively; keep heading anchors and source pointers | Preserve all Owner directions, defaults, reduced-motion rule, gradient exception still needing acceptance, shared-sheet scope and every unmade persistence/precedence decision. A new ID labels the existing direction and grants no work. |
| Same source: learning streak | Backlog FEAT-022; old section becomes a pointer; UI charter links the presentation dependency | Streak needs truthful data, day/timezone/activity/reset/privacy contracts; design must not invent proxy data. |
| `ui-design-system-and-review/{index.md,product-language.md,screen-types/,components/,surfaces/,candidates/,implementation-plans/,plan.md,progress.md}` | Keep existing paths and accepted/frozen bodies; charter links the existing design index and history | Repair navigation only where directly necessary. Existing closed delivery history is not an active competing charter. Verify actual file inventory before editing a navigation pointer. |
| `backlog/future-features.md`: BFEAT-001 | Infrastructure future-features with unchanged ID; old backlog entry becomes a pointer | Preserve update policy, waiting Next trial evidence and explicit untested/compatibility costs as dated evidence; no new package recommendation or update. |
| LF2/LF3/LF8 plans, related performance records, SOPs and published-migration-cited plans | Keep paths; performance charter links evidence, infrastructure charter links operational SOPs | Accepted latency is not reopened; preserve function-call versus API-call versus elapsed-time units. SOPs remain at `sop/`. |

## 2. Repository facts

Baseline: `ae2145d7bc9e2b3c0f329021a29c5f1bbac70a29`, inspected 2026-10-28 on `chore/docs-model-migration`. These are local repository facts, not a production audit.

- [AR3 D9 and follow-up](../agent-rules/implementation-plans/ar3/plan.md) deferred existing-document reassignment, missing evergreen homes and new checker support. The [docs-system ADR amendment](../../adr/docs-system.md) records the same compatibility boundary.
- [Current checker](../../../scripts/docs/check-structure.mjs) discovers programs by progress.md, accepts active/closed/legacy, rejects an unbannered charter README as an unknown role and does not enforce feature-ID uniqueness. The current fixtures cover the old shapes.
- The [Programs index](../../README.md) has ten programs, including closed agent/UI histories; none is a declared evergreen. The old `docs/agent-workflow/` and proposed `docs/programs/agent-workflow/` are different homes and need explicit history navigation.
- Bare FEAT-001..005 are declared for different meanings in auth-onboarding and student-user-flow-route. TFEAT-001..004 and BFEAT-001 already use distinct prefixes. This is the concrete conflict behind P3.
- `git diff main..feat/topic-builder-redesign --name-only` identifies three protected paths: `docs/programs/student-user-flow-route/plan.md`, `docs/programs/student-user-flow-route/implementation-plans/tfeat4/plan.md`, and `docs/programs/teacher-workflow/future-features.md`. This is branch evidence, not proof that its writer stopped.
- Published migrations cite existing auth/student detail-plan paths both directly and through `docs/refactors/` redirects. Protect every citation found at the execution baseline, not just the older index's three redirect targets.
- Agent-rules State still describes PR 180 as pending while local Git contains its merge `ae2145d7`; several other trackers also contain historical pending delivery language. Only affected State reconciliation is in scope; do not infer hosted completion from a merge.
- `.github/workflows/ci.yml` runs docs checker tests and docs:check. Product/integration routing treats `scripts/docs/` differently from docs-only changes; local docs checks are not a prediction that product CI will be skipped.
- Baseline `npm run docs:check` passed: 0 structure violations, 0 broken links, 0 baseline exceptions. Preserve that baseline; do not add link-baseline exclusions to hide migration failures.

## 3. Bounded implementation hypotheses

- Extend the current line-based checker, shared file inventory and Node fixture tests rather than adding a Markdown framework, new registry, migration runner or background automation.
- Parse a Kind column and a canonical initiative Plan link column. Require new evergreen rows to link local initiative plans in their own home; empty tables are valid when none is open. Match link forms already supported by the checker, including used reference links; code examples are not declarations.
- Apply the new reciprocal entry-link check to the prospective `implementation-plans/<id>-<slug>/plan.md` convention, matching a complete known problem/feature ID prefix case-insensitively. Resolve the tracker entry anchor and check plan/progress ownership. Existing accepted directories such as feat3, feat6 and feat12 retain their paths and whole-tracker Source links; those plans predate this convention and are not retrofitted or bannered to satisfy it. Keep the existing general progress/State checks. Missing reciprocal links in a new ID-prefixed entry plan fail; no plan is required for an unscheduled tracker entry.
- Count canonical feature declarations in future-features files, including retained closed declarations; ignore aliases and transfer pointers only under an explicit, tested grammar. Whole-directory legacy exemptions must not hide a new duplicate declaration. P3 normalization and rule activation land together.
- Retained feature trackers keep their historical body/field grammar unless a listed transfer needs reshaping. Global identity checks still scan their declarations, including the protected TFEAT source. Required new-entry fields apply to the newly shaped entries; do not claim that all old feature prose has been converted to the new template.
- Preserve old anchors with short transfer sections or explicit anchors, whichever fits the owning grammar and actual incoming links. A transfer source is not a second State or editable copy. If existing parsers cannot represent this safely, make the narrow parser correction and test the exact consumer.
- Reuse immutable design/history references rather than physically moving them. No skill reference is added or moved merely to split a document by length.

## 4. Checkpoints and dependency order

One integrated implementation PR is proposed. The internal checkpoints are sequential; no intermediate unsupported shape may be published. No implementation starts until the exact plan is approved and the required plan review is complete under an execution grant.

| CP | Outcome | Hard dependency / gate | Verification |
| --- | --- | --- | --- |
| CP0 | Freeze execution baseline, writer ownership, exact entry inventory, protected paths and decision/meaning checklist; confirm P1–P5 acceptance | Approved plan; required independent plan review; actual implementation authority | Git status/ancestry and incoming-reference searches; compare source inventory with section 1.6; stop on drift affecting ownership or scope. |
| CP1 | Model/compatibility rules and checker fixtures agree before consumer migration; implement the support needed by CP2 | CP0 | Old regression fixtures remain; new allowed/denied fixtures below expose the unsupported shapes before the implementation. A temporary repository mismatch is reported, not delivered or suppressed. |
| CP2 | Five evergreen homes and index/ADR navigation express the approved boundaries, without moving source entries yet | CP1 shape support | New charters/progress/problems and empty initiatives pass the checker; no duplicate policy/design bodies, invented open initiative, or historical action grant. |
| CP3 | Transfer entries and repair active incoming references in order: agent → security → infrastructure → UI/UX → backlog; performance adds evidence navigation only | CP2; source-by-source writer clearance; P3 mapping applied atomically with its source/destination pointers | Compare every row against baseline meaning checklist; preserve old anchors and published citations; verify no two live owners. Protected topic-builder files stay untouched. |
| CP4 | Activate global feature-ID checks over the reconciled declarations; finish all checks and cumulative review | CP3; no unresolved scope/ID/ownership conflict | Commands below, manual meaning/anchor audit and required independent implementation review under actual authority. No Critical/Required finding remains before a delivery-ready claim. |

### Checker behavior matrix

| Contract | Accept | Reject / limitation |
| --- | --- | --- |
| Program index | Existing delivery rows with explicit Kind; new evergreen/active row with progress and charter | Unknown Kind, duplicate/missing row, dangling program, bannered active progress; lifecycle remains a separate field. |
| Evergreen root | README charter with required capability, decisions, invariants, initiatives and opening sections; no active initiative is valid | Missing charter, competing root plan.md, inline State; a historical file banner must not make an evergreen root plan valid. |
| Delivery shapes | Root single-unit detail plan, multi-unit master/detail plans, retained existing unit names | Root detail without its program progress pointer; duplicate inline State; no new folder-name rule applied retrospectively. |
| Initiatives | Every local initiative plan registered once by a used link in its charter and linked to its own progress | Orphan/duplicate/foreign initiative plan, unused link definition or code-fence example masquerading as registration. At-most-one-open remains a manual State/plan acceptance check unless explicit authoritative structured data supports enforcement; do not invent a second status owner. |
| Entry plans | New ID-prefixed entry directory: tracker links its plan, plan links the exact owning entry and its program progress. Retained feat3/feat6/feat12 plans may keep their old Source links | New convention rejects wrong ID/anchor, foreign progress and missing reciprocal reference. Preserve existing accepted layouts; no requirement that every deferred entry already has a plan. |
| Backlog | Problems/future features without plan, progress or Programs row | Backlog accidentally treated as a program; invalid entry grammar. |
| Feature identity | Unique canonical IDs, approved historical aliases and transfer pointers, stable TFEAT/BFEAT IDs | Duplicate live or closed canonical ID across programs/backlog, alias without a canonical target, copied full entry at a transfer source; code fences are ignored. |
| Compatibility | Existing closed/bannered delivery history, published redirects and valid reference links continue to work | Invalid banner placement still fails; banners cannot bypass evergreen root invariants. Whether a bannered document is genuinely frozen history is a manual meaning-review check; no new format/provenance registry or broad allowlist. |

Planned implementation checks, not results of the present planning checkpoint:

- `node --test scripts/docs/check-structure.test.mjs scripts/docs/check-links.test.mjs`.
- `npm run docs:check` and `node .agents/scripts/validate-skill.mjs`; validate affected eval definitions only if they change. Do not dispatch live skill evals.
- `git diff --check`, exact changed-file inventory, UTF-8/EOL/conflict-marker checks, incoming literal-path search in docs/skills/imports/configs and published-migration citations.
- Resolve preserved old anchor targets explicitly: the current link checker does not claim heading-fragment completeness. Compare frozen plan/design bodies to baseline, excluding only approved navigation/State-pointer changes.
- Manually review decision/meaning checklist, unique live owner per moved entry, accepted-versus-target design separation, historical evidence labels and at-most-one-open-initiative rule. Checks prove structure, not future agent behavior or product/hosted correctness.

## 5. Risks, rollout and rollback

| Risk | Mitigation / earliest gate |
| --- | --- |
| A five-home taxonomy becomes a product reorganization | Boundaries and row dispositions are fixed in sections 1.5–1.6; no new product evergreen. CP0/CP3 stop on unlisted reassignment. |
| ID normalization violates preservation or breaks old links | P3 needs explicit plan approval; aliases and old anchors survive; test duplicate versus reference grammar and audit every changed incoming reference in CP3/CP4. |
| Checker and consumers form a circular delivery dependency | One integrated PR, fixture-first development and no delivery of partial checkpoints; do not introduce a permanent mode switch to hide it. |
| Old UI/agent homes remain competing live owners | Old delivery contracts remain history; only new charters own capability/initiatives, existing design artifacts own accepted values, and moved entries become pointers. Verify in CP2/CP3. |
| Concurrent topic-builder work conflicts with entry transfer | Protect its three known paths; accept TFEAT grammar without rewriting its feature file. Any necessary change to those paths stops until ownership/dependency is explicitly reconciled. No automatic branch manipulation. |
| A stale tracker recreates a completed rollout or old grant | Git may reconcile repository delivery only; preserve pending hosted/manual/model observations and use no current authority in idle new homes. CP3. |
| Large mixed source entry is split incorrectly | Retain the existing product owner and link related engineering concerns; do not split FUTURE-PUBLISH-001 by interpretation. CP0/CP3. |

- Rollout: finish plan and author review; obtain independent plan-review execution authority and reconcile its findings; obtain approval of the exact contract and implementation; execute CP0→CP4; obtain the required implementation review; request only still-missing Git/delivery authority for the concrete candidate. No hosted steps or data fixtures are needed.
- Stop when: a protected citation/anchor cannot be retained, another writer owns an affected file, a material source fact changed, P3 remains undecided, meaning preservation fails, a check fails for a change-caused reason, or independent-review authority/evidence is missing at its required gate.
- Rollback before delivery: correct only task-owned changes on the branch under actual authority. After delivery, an authorized correction/revert must restore checker/contracts/consumer shapes together, preserve canonical/legacy identity links, and reconcile State to the current truth rather than resurrecting a historical grant. If another initiative has started using a new home, reconcile with its owner before rollback.

## 6. Progress

Current State and milestones: [progress.md](./progress.md).
