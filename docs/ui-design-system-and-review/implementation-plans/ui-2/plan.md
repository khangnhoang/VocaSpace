# UI-2 Detail Plan: Product Language and LE/TA Common Designs

## Status and authority

| Field | Value |
| --- | --- |
| Plan status | Owner-accepted on 2026-09-27 for the exact candidate identified by SHA-256 `5EB3BEB0B471A4AA5E2E31A67B172DED06CF18FC2891E1CD65D6DE0B0819E156`; this acceptance and status reconciliation do not start Stage 0 or approve design authoring or implementation |
| Review history | An independent Plan Reviewer previously returned `PASS`; this remains historical planning evidence, not an execution-mode selection or a prerequisite for `NORMAL` execution |
| Branch | `feat/ui-product-language-and-screen-types` |
| Local baseline | `081ad1ce73197a70b414e508bcc8236d9db8d21a`, the locally cached `origin/main` merge of UI-1 PR #104, on 2026-09-26 |
| Remote freshness | Not refreshed in this planning task; no `fetch`, `pull`, push, or other remote action was authorized or run |
| Upstream contract | [UI Design System and Rendered UI Review Master Plan](../../plan.md), workstream `UI-2` |
| Current delivery truth | [Program progress](../../progress.md), where `UI-2` remains `Not started` until accepted design artifacts actually exist |

Branch `feat/ui-product-language-and-screen-types` and this plan's existence are repository-visible facts. The historical independent `PASS` does not select the execution mode, admit a future candidate, or grant action authority. None of these facts accepts any palette, typography scale, geometry, motion language, Learning Experience (LE) design, or Teacher Authoring (TA) design, and none authorizes authoring those design candidates, editing runtime UI, creating commits, pushing, opening a pull request, running model evaluations, or deploying anything.

The Master Plan owns the program goal and dependency graph. This plan proposes the bounded execution contract for `UI-2` only. Future Owner-accepted design artifacts own reusable design decisions; `progress.md` owns current delivery evidence. Current CSS and rendered screens are evidence of runtime behavior, not approved standards.

## Goal and completion claim

Create one Owner-accepted VocaSpace product language, then separately create and obtain Owner acceptance for common LE and TA screen-type designs that inherit that product language without duplicating its values.

`UI-2` is complete only when:

1. the product language contains concrete, accepted values for color, typography, surfaces, geometry, elevation, motion, and semantic token intent;
2. the LE and TA designs each contain accepted, type-specific hierarchy, interaction, feedback, density, responsive, accessibility, and motion rules;
3. all three artifacts distinguish inherited decisions from owned exceptions and map their decisions to current or explicitly proposed semantic tokens/components;
4. a discoverable index routes only to accepted artifacts;
5. repository checks establish that the checkpoint changes design documentation and progress only, with no runtime, dependency, route, API, database, or permission change; and
6. `progress.md` records the actual accepted state and evidence without claiming runtime implementation or browser validation.

Completion means the reusable design contract exists. It does not mean `app/globals.css`, shared components, LE/TA pages, or the UI-4 pilot match the new language. Any such mismatch becomes explicit implementation drift for UI-3/UI-4 or a later bounded surface task; it is not silently corrected in UI-2.

## Routing, mode, and size

- Execution mode and role routing: owned by Main under `docs/agent-loops.md`, not by this document. This durable plan neither hardcodes a mode nor imports live role/session/admission state. Under `NORMAL`, Main can execute the Stage/CP lifecycle directly with the reviews and Owner gates defined here. If Main later selects a managed mode, its additional role, review-artifact, admission, and correction-round requirements apply conditionally through `native-multi-agent-workflow` without rewriting this plan.
- Preliminary size: large planning/design work because it creates three durable semantic owners and requires three material Owner decisions.
- Final size after discovery: large but documentation-only. The dependency chain and acceptance gates require a durable plan, while runtime/security/data risk remains out of scope.
- Specialist decision: `0 specialist`. No unresolved hard-risk signal survives repository discovery. Visual preference requires Owner judgment, not a specialist substitute. A later concrete candidate may expose a specific accessibility or interaction uncertainty, which must be assessed then under the normal gates rather than pre-authorized here.

Applicable instructions and skills:

- `AGENTS.md` and `docs/agent-loops.md` for scope, authority, lifecycle, and truthful evidence;
- `native-multi-agent-workflow` when this work is selected, run, changed, or reviewed under a managed mode (`MULTI_AGENT_MASTER_PLAN` or `MULTI_AGENT_E2E`), or when a managed role handoff, review artifact, correction round, Owner steer, or managed-workflow blocker is handled. It owns mode/role semantics, role and session identity, review artifacts and rounds, correction budgets, admission, blockers, and Main-only transitions. That live orchestration state belongs to Main's ephemeral ledger, not to this durable candidate, and this plan does not restate its lifecycle state machine;
- `implementation-planning-and-pr-breakdown` for tracked-program reconciliation, dependencies, acceptance, and this durable handoff, including `references/multi-agent-e2e-workflow.md` when this candidate is a managed E2E detailed plan;
- `frontend-design`, including `common-design-authoring.md`, `learning-experience.md`, and `teacher-authoring.md`, for artifact authoring and design decisions;
- `frontend-workflow` for repository-grounded UI context and future manual-validation boundaries;
- `test-quality-strategy` for proportionate evidence classification; and
- `git-checkpoint-workflow` for the existing branch state and any future separately authorized checkpoint.

`playwright-cli` is not activated by this planning checkpoint because no browser automation is requested or required to verify a documentation-only plan. It becomes applicable only if a later authorized candidate-review or runtime audit requires browser driving.

## Confirmed repository state

### Program and source ownership

| Source | Confirmed fact and implication |
| --- | --- |
| `docs/ui-design-system-and-review/plan.md` | Defines `UI-1 → UI-2 → UI-4 → UI-5` and `UI-2 → UI-3`. `UI-2` must produce an accepted product language followed by separately accepted LE/TA type designs. |
| `docs/ui-design-system-and-review/progress.md` | UI-1 is implemented with bounded verification; UI-2 is `Not started` and requires concrete visual decisions plus explicit Owner acceptance. |
| `.agents/skills/frontend-design/SKILL.md` | Now routes every relevant task to accepted product/type/component/surface sources, rejects current CSS as approval, and requires the smallest missing decision when a material design contract does not exist. |
| `common-design-authoring.md` | Requires a concrete candidate, exact inheritance/exception boundaries, token/component mapping, and explicit Owner acceptance tied to an identifiable candidate. |
| LE and TA references | Both allow medium-to-high latitude, but LE spends expression on practice, feedback, progress, accomplishment, and motivation while TA spends it on information architecture, authoring flow, builders, useful data-backed visualization, and reduced interaction cost. |
| Design artifact directory | No `index.md`, `product-language.md`, `screen-types/learning-experience.md`, or `screen-types/teacher-authoring.md` exists at this baseline. No accepted visual standard can therefore be inferred. |

### Runtime visual baseline

| Source | Confirmed runtime fact | Planning implication |
| --- | --- | --- |
| `app/globals.css` | Light/dark shadcn semantic variables are predominantly neutral; chart tokens are blue; `--radius` is `0.625rem`; sidebar styling separately uses navy/cyan literals. | The product candidate must classify current values as reuse, remap, or drift. It must not copy all current literals into the standard by default. |
| `app/layout.tsx` | The app loads Geist, Geist Mono, and Plus Jakarta Sans; the body currently renders with Plus Jakarta Sans while semantic font-variable wiring is not a complete approved typography contract. | UI-2 may define roles using installed fonts but must not install or switch fonts in runtime code. |
| `components/ui/button.tsx` | Shared defaults are compact (`h-8`, `h-9` for `lg`) with rounded geometry, while feature screens frequently override to 44–48px controls. | UI-2 can define semantic intent and comfort/touch principles, but exact shared `Button` variants and migration belong to UI-3 after a usage audit. |
| LE routes and components | `/learn`, `/learn/[course-slug]`, and `/learn/[course-slug]/[topic-slug]` use slate/blue broadly, emerald for parts of active practice, large rounded cards, strong progress/feedback treatment, and many explicit minimum touch heights. | These screens provide real examples and drift evidence. They do not approve blue/emerald or 24px radii as the product language. |
| TA routes and components | Course overview, structure workspace, and topic builder preserve the course/chapter/topic mental model and mix blue/slate literals, large rounded forms/cards, explicit status/issue feedback, sheets/dialogs, and direct edit controls. | The TA type design must preserve the established route/permission model and distinguish common authoring principles from UI-4's future surface composition. |
| `docs/adr/refactor-teacher-workflow-plan.md` and `lib/course-authoring/routes.ts` | The overview → structure → topic-builder architecture, direct topic editing, readiness/issues, and explicit accessible ordering are established behavior. Analytics remains conditional on trustworthy data. | A type design cannot collapse routes, invent data, add decorative analytics, or redefine authoring business states. |

The observed source uses many direct Tailwind color and geometry values. That fragmentation is evidence that a reusable language is needed, not permission for UI-2 to perform a global token migration. UI-2 documents accepted intent and current mapping; UI-3 and later runtime work own implementation.

## Assumptions, conflicts, and open evidence

Assumptions still affecting this plan, each with the condition that invalidates it:

- No writer other than the active author edits the UI-2 artifacts in the working tree between two sessions. Invalidation: an unexplained artifact change, or a competing writer touching the same path, which stops dependent work and returns to `CP0.1`.
- Owner review of each design candidate happens in the conversation and is tied to an identifiable candidate revision. Invalidation: an acceptance that names no identifiable candidate, which keeps the artifact a candidate as described in rule 3 of "Candidate lifecycle and Owner gates".
- The UI-1 routing merged into the recorded local baseline remains present and unchanged. Invalidation: a changed `frontend-design` core or screen reference that alters accepted-source discovery.
- No newer Owner decision changes UI-2 scope, dependency, or acceptance before authoring begins. Invalidation: any later Owner steer with that effect, which requires this plan to be revised and self-reviewed before dependent work continues.
- The already-installed fonts (`Geist`, `Geist Mono`, `Plus Jakarta Sans`) are sufficient for the proposed type roles. Invalidation: a candidate that cannot express a role without a new font dependency, which is an out-of-scope addition requiring Owner authority.
- Acceptance identity is durably readable from repository state plus the recorded Owner decision; the three Owner gates stay separate. Invalidation: an acceptance that cannot be distinguished from general plan approval.

Reconciled conflicts:

- The current runtime literals and the emerging candidate standard disagree by design. Ownership is unambiguous: CSS and components are runtime evidence, the accepted artifacts are the standard; the audit classifies each value instead of averaging the two sources.
- An earlier planning-session authorization sentence was not reconstructable from durable repository evidence. It has been reduced to repository-visible facts and carries no future action authority; the historical independent `PASS` is retained separately only as planning evidence.

Open evidence, unavailable until its later checkpoint:

- the concrete Owner acceptances (`PL-ACCEPT`, `LE-ACCEPT`, `TA-ACCEPT`) themselves;
- remote freshness, which this plan records as unrefreshed rather than assumed current;
- any browser or runtime-rendered evidence, which is `not_run` for a documentation-only workstream.

## Task-local lineage delta

This is the task-local delta only; the Master Plan owns the program graph and this table does not restate it.

| ID | owner | depends_on | consumes | produces | evidence / invalidation | disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `UI2-L0` | Owner + Master Plan `UI-2` row | — | Exact Owner decisions, program contract, this plan | Bounded UI-2 outcome and three Owner gates | Master Plan row plus Owner decisions tied to identifiable candidates; invalidated by a later Owner scope/authority steer | `affected` |
| `UI2-L1` | Runtime sources (`app/globals.css`, `app/layout.tsx`, `components/ui/*`, LE/TA routes) | `UI2-L0` | Current tokens, components, rendered patterns | Classified reuse / drift / type-specific / deferred / out-of-scope evidence | `CP0.2` audit against exact current files; invalidated by runtime drift after the audit | `affected` |
| `UI2-L2` | `frontend-design` core and LE/TA references | `UI2-L0` | Accepted-source discovery and screen-type latitude | Discovery routing and authoring procedure for UI-2 | UI-1 evidence already recorded in `progress.md`; no UI-2 edit is planned; invalidated by a later routing change | `unaffected` |
| `UI2-L3` | `docs/ui-design-system-and-review/product-language.md` | `UI2-L1`, `UI2-L2` | Audit classification, `PL-ACCEPT` | Accepted product language | Absent at baseline; `CP1.1`–`CP1.4`; invalidated while the artifact remains a candidate | `affected` |
| `UI2-L4A` | `docs/ui-design-system-and-review/screen-types/learning-experience.md` | `UI2-L3` | Accepted product language, LE evidence, `LE-ACCEPT` | Accepted LE specialization | Absent at baseline; `CP2A.1`–`CP2A.3`; invalidated by an unaccepted or changed product base | `affected` |
| `UI2-L4B` | `docs/ui-design-system-and-review/screen-types/teacher-authoring.md` | `UI2-L3` | Accepted product language, TA evidence and ADR, `TA-ACCEPT` | Accepted TA specialization | Absent at baseline; `CP2B.1`–`CP2B.3`; invalidated by an unaccepted or changed product base | `affected` |
| `UI2-L5` | `docs/ui-design-system-and-review/index.md` | `UI2-L3` | First real acceptance | Discovery route to accepted artifacts only | Absent at baseline by design; created at first acceptance; invalidated by any draft route | `affected` |
| `UI2-L6` | `docs/ui-design-system-and-review/progress.md` | `UI2-L5` | Actual acceptance and verification evidence | Truthful partial then complete UI-2 status | Currently `Not started`; serialized with `UI2-L5`; invalidated by an unchanged-state completion claim | `affected` |
| `UI2-L7` | This plan | `UI2-L0` | Master Plan row, current repository state | Stable UI-2 execution contract | Revalidated by `CP0.1` step 3; invalidated by a material Owner contract change | `affected` |

No missing edge is treated as evidence of `unaffected`. A newly discovered material owner, dependency, or artifact starts `needs_review` and stops dependent work until this plan is revised and self-reviewed.

## Design problem and decision boundaries

The product language must answer which decisions every VocaSpace surface inherits. The type designs must answer how LE and TA express that language for different jobs. A surface specification must still answer how one concrete page or workflow composes those rules.

```text
Product language
├─ shared identity, semantic color, type roles, surfaces, geometry, elevation, motion
├─ Learning Experience type design
│  └─ interaction, feedback, progress, accomplishment, repeated practice
└─ Teacher Authoring type design
   └─ information architecture, creation journey, builders, validation, direct edit

Later surface specifications
└─ route-specific composition, exact states, content, and component selection
```

The following boundaries are mandatory:

- Product language does not own one page's layout or workflow.
- Screen-type designs inherit product values and do not repeat the palette, font stack, radius scale, or shadows as independent values.
- Screen-type designs may define a justified type-specific semantic role or exception, but must name why the product-level rule is insufficient and where the exception applies.
- UI-2 does not own shared component implementation or exact `Button` variant dimensions; UI-3 does.
- UI-2 does not own the Teacher pilot surface; UI-4 does.
- Current implementation drift is recorded as drift or a future mapping need, not edited or treated as an accepted exception.

## Explicit scope

### Expected design and tracking artifacts

| Path | Purpose and ownership |
| --- | --- |
| `docs/ui-design-system-and-review/product-language.md` | Candidate, then accepted SSOT for product-wide visual identity and semantic token intent |
| `docs/ui-design-system-and-review/screen-types/learning-experience.md` | Candidate, then accepted LE specialization |
| `docs/ui-design-system-and-review/screen-types/teacher-authoring.md` | Candidate, then accepted TA specialization |
| `docs/ui-design-system-and-review/index.md` | Discovery route to accepted artifacts only; created when the first artifact is accepted, not as a registry of drafts |
| `docs/ui-design-system-and-review/progress.md` | Concise partial state after each real acceptance, then final UI-2 evidence after cumulative verification |
| `docs/ui-design-system-and-review/implementation-plans/ui-2/plan.md` | Stable UI-2 execution contract; only material Owner decisions that alter this contract are reconciled here |

No separate owner-review brief is required by the current program convention. Explicit Owner decisions must be tied to an identifiable candidate revision in the conversation and reflected in the artifact's status/history as applicable. If later work requires a durable approval record beyond Git and conversation identity, that is a new evidenced need rather than a pre-emptive artifact.

### Out of scope

- `app/globals.css`, `app/layout.tsx`, `components/ui/*`, application routes, feature components, tests, schemas, actions, RPCs, migrations, RLS, generated types, dependencies, and build configuration;
- shared-component geometry or runtime variants, including changing `Button` defaults;
- a Teacher surface specification or runnable pilot;
- the rendered `frontend-ui-review` skill;
- redesigning every route or documenting every component;
- changing the established Teacher route/permission/content hierarchy;
- adding fonts, animation libraries, shadcn components, illustrations, mascots, or analytics;
- committing screenshots or generated preview artifacts as a second design source of truth; and
- browser QA claims about the current product or future implementation.

If an accepted design decision cannot be expressed without a runtime proof, UI-2 records the decision and an explicit validation dependency for UI-3/UI-4. It does not pull runtime implementation into this workstream.

## Candidate lifecycle and Owner gates

Each artifact follows the same state model:

```text
repository audit
→ identifiable candidate with exact values/examples
→ author self-review
→ Owner review
├─ changes requested → revise candidate → author self-review of affected decisions → Owner review
└─ accepted → publish acceptance identity/status → expose through index → reconcile partial progress
```

This is the mode-neutral lifecycle for the design artifacts themselves. In `NORMAL`, its CP self-reviews, Stage integration/closure reviews, Owner gates, and final cumulative review form the complete review path required by this plan. If Main selects a managed mode later, the independent lifecycle review required by that mode is additional and conditional; this diagram neither replaces nor universally requires it.

Rules:

1. A candidate must identify its status, upstream contract, exact scope, inheritance, owned decisions, non-goals, and current/proposed token mapping.
2. Draft paths must never appear under the index's accepted-design routes.
3. Owner acceptance must name the candidate revision or otherwise identify the exact current candidate unambiguously. General approval of this plan is not acceptance of any design values.
4. Product-language acceptance is a hard prerequisite for LE and TA acceptance. Type candidates may be explored in parallel for comparison only after the product candidate is stable, but neither can be accepted against an unaccepted or changing product base.
5. LE and TA require separate Owner decisions. Acceptance of one does not accept the other.
6. Each successful Owner gate must be materialized before dependent Stage work continues: mark the exact artifact `Accepted` with candidate/Owner-decision identity, add or update its accepted-source index row, and reconcile `progress.md` as partial while any UI-2 artifact remains pending. A commit is not required, but the working tree must durably and unambiguously represent the decision for resume.
7. Publication of product, LE, and TA acceptance is serialized because the artifacts are independent but `index.md` and `progress.md` are shared owners. Parallel candidate authoring must not create competing publication edits.
8. A visual review aid may be generated ephemerally from the exact candidate values when prose/Markdown cannot show color, type, geometry, or motion sufficiently. It must be labeled non-authoritative, must not contain values absent from the candidate, and must be deleted before the final checkpoint unless the Owner explicitly asks to retain it as an owned artifact.
9. Accepted artifacts remain current-state specifications, not append-only decision journals. Git preserves prior revisions.

## Detailed execution plan: Stages and checkpoints

The Stage/CP structure below follows actual semantic dependencies. A CP is complete only when its named invariant and evidence are current, its bounded self-review has no unresolved material finding, and any correction has been rechecked. A Stage is complete only when all of its CPs pass and an integration self-review confirms that their composition satisfies the Stage outcome.

A meaningful CP may become a local commit only after explicit commit permission and only when it provides a useful rollback/resume boundary. CP completion never implies a commit, and a commit never substitutes for CP or Stage evidence.

### Stage 0 — Baseline and decision-input audit

**Stage outcome:** candidate authoring begins from a current, bounded, correctly classified evidence set rather than from current CSS as implicit approval.

#### CP0.1 — Revalidate authority, baseline, and semantic owners

Actions:

1. Recheck branch, clean-tree ownership, exact HEAD, and whether upstream UI-1 routing contracts remain present.
2. Re-read the current Master Plan/progress and the four frontend-design sources selected by this work: core, common authoring, LE, and TA.
3. Confirm that no product language or LE/TA type artifact has appeared elsewhere and that no newer Owner decision changes UI-2 scope, dependency, or acceptance.
4. Reconcile the local baseline with available Git evidence. If remote freshness matters and has not been authorized, keep it explicitly unverified rather than assuming currency.

Invariant:

> UI-2 has one unambiguous upstream contract, one planned owner for each future artifact, and no conflicting accepted source or hidden action authority.

Evidence:

- exact branch/HEAD/status and ancestry;
- current Master Plan/progress rows;
- presence of UI-1 routing and absence/presence of the planned UI-2 artifacts; and
- explicit authority/exclusion record.

CP self-review challenges stale baseline, duplicate owner, unrecorded accepted source, and permission inflation. Correct within planning/design authority or stop on a material conflict.

#### CP0.2 — Build the bounded runtime and product-contract audit

Inspect only the representative runtime sources named below plus direct dependencies required to classify a value or behavior. Do not expand into a repository-wide UI audit.

- shared/runtime: `app/globals.css`, `app/layout.tsx`, `components/ui/button.tsx`, and the existing UI primitive inventory;
- LE: dashboard, enrolled-course overview, learning workspace, flashcard/exercise feedback, loading/error/empty/completion examples;
- TA: course overview, course structure workspace, topic builder tabs/forms, readiness/issue feedback, preview and destructive-dialog examples; and
- product contracts: Teacher route helpers and the approved teacher-workflow ADR.

Classify relevant observations as:

- `current reusable candidate` — a runtime value may be proposed for reuse but is not yet accepted;
- `current drift` — a runtime pattern conflicts with the emerging candidate or lacks semantic ownership;
- `type-specific evidence` — behavior belongs to LE or TA rather than the product language;
- `deferred implementation` — an accepted decision would require UI-3/UI-4 or later runtime work; or
- `out of scope` — unrelated Admin/Marketing or feature-specific behavior.

Invariant:

> Every material design input used by the candidate is classified by evidence and owner; no current literal, component, or rendered pattern is promoted to accepted standard merely because it exists.

Evidence is embedded only where it explains a decision in the candidate artifacts; do not create a standalone inventory that can drift.

CP self-review challenges over-broad discovery, missing representative states, current-versus-approved confusion, and accidental import of Admin/Marketing or feature-specific patterns.

#### Stage 0 integration self-review

Review CP0.1 and CP0.2 together. Confirm that every audited input is compatible with the established artifact ownership and that no discovered conflict changes the planned product/type boundary. If the audit reveals a material new owner, dependency, or runtime proof requirement, stop and revise the plan before Stage 1.

Recommended resume boundary: Stage 0 evidence may remain uncommitted because it is largely source-derived. A commit is justified only if a durable, task-owned audit artifact becomes necessary; this plan currently does not require one.

### Stage 1 — Product-language contract

**Entry gate:** Stage 0 passed.

**Stage outcome:** one coherent Product Language is accepted, durably marked `Accepted`, indexed, and reflected as partial UI-2 progress.

#### CP1.1 — Establish identity, inheritance, color, and typography

Author the first coherent section of `product-language.md` with:

1. **Subject grounding:** VocaSpace as a Vietnamese-first language-learning and course-authoring product; learner focus/reward and teacher confidence/productivity are both first-class, not separate brands.
2. **Design thesis:** one short, falsifiable direction explaining what makes the product recognizable without generic SaaS decoration.
3. **Inheritance model:** what every type inherits and what remains with screen-type, shared-component, and surface owners.
4. **Color system:** 4–6 named core colors with exact hex values and semantic roles; required neutral, focus, success, warning, and destructive behavior; light-surface intent; contrast/reduced-transparency constraints; and a rule for direct feature literals versus allowed data/state color.
5. **Typography:** installed font usage only; display, body, utility/data/caption roles with concrete weight/size/line-height/tracking guidance; Vietnamese diacritic readability; long-content behavior; and no new font dependency.

Invariant:

> Product identity, semantic color, and typography are exact enough to reuse and remain product-owned; they do not prescribe a page layout or smuggle in a new font/runtime change.

Evidence includes exact candidate values, current-runtime comparison, contrast/readability considerations, and product-specific rationale.

CP self-review challenges generic SaaS identity, decorative color without meaning, inaccessible pairings, duplicated type ownership, and values not supported by the candidate examples.

#### CP1.2 — Define surfaces, geometry, imagery, and interaction-state language

Extend the same candidate with:

1. **Surfaces and elevation:** background/card/popover/sidebar relationships, border and shadow roles, layering, and when elevation is unnecessary.
2. **Geometry and spacing:** a concrete radius family and spacing rhythm at semantic-intent level, including the softly rounded Windows 11-inspired direction without copying Fluent or freezing component dimensions that belong to UI-3.
3. **Iconography and imagery:** Lucide/local asset conventions, when imagery supports learning/context, and a prohibition on generic decorative icons/gradients/mascot infrastructure without a later accepted need.
4. **Interaction states:** visible focus, hover, active, selected, pending, disabled, error, success, and destructive semantics at product level.

Invariant:

> Surfaces, geometry, imagery, and states form one semantic system while keeping exact shared-component behavior and surface composition with their later owners.

Evidence includes representative state combinations, current token/literal comparison, and explicit UI-3/UI-4 deferrals.

CP self-review challenges arbitrary radius/shadow proliferation, missing focus/disabled/destructive semantics, pill-heavy drift, and accidental `Button` or surface implementation authority.

#### CP1.3 — Define motion, token mapping, concrete review examples, and critique

Complete the product candidate with:

1. **Motion:** duration/easing intent, allowed feedback/transitions, reduced-motion behavior, and a ban on motion that delays repeated practice or dense authoring.
2. **Token mapping:** classify each semantic decision as `maps to current token`, `proposed token/runtime change`, or `documentation-only rule`; every proposed runtime change is deferred to its owning future workstream.
3. **Concrete review examples:** a small side-by-side set sufficient to judge palette, typography, surfaces, radius, elevation, focus/states, and motion/reduced motion without becoming a page design.
4. **Uniqueness critique:** identify and correct any direction reusable almost unchanged for generic SaaS, fintech, or AI products.
5. **Status and exclusions:** keep the artifact an identifiable candidate until the exact Owner gate passes.

Invariant:

> Every product-level decision is visually judgeable, traceable to current/proposed runtime ownership, and bounded away from page/component implementation.

CP self-review challenges undocumented sample values, sample/spec divergence, unsupported runtime claims, motion without reduced-motion equivalence, and a generic visual thesis.

#### Stage 1 candidate integration self-review and Owner gate

Review CP1.1–CP1.3 as one product system. Verify that color, typography, surfaces, geometry, state language, motion, and token mapping do not contradict each other; examples use only documented values; inherited versus deferred ownership is unambiguous; and the candidate remains usable by both LE and TA.

After candidate integration self-review passes, present the exact candidate for `PL-ACCEPT`. Explicit Owner acceptance must cover color values, type roles, surface/elevation model, geometry intent, motion language, and token mapping. Partial acceptance keeps Stage 1 open and the artifact unindexed. Apply requested corrections to the affected CPs, rerun those CP self-reviews, then rerun Stage 1 candidate integration self-review before returning to the Owner.

#### CP1.4 — Publish Product Language acceptance

Immediately after `PL-ACCEPT`:

1. verify that the accepted candidate identity still matches the current `product-language.md` content;
2. mark that exact artifact `Accepted` with the available Owner-decision identity/date;
3. create `index.md` if absent, or update it, with an accepted Product Language route only;
4. update `progress.md` to a truthful partial state: Product Language accepted and published; LE and TA pending; UI-2 not complete; and
5. recheck artifact status, index target, progress wording, links, and absence of draft leakage as one publication bundle.

Invariant:

> The repository durably exposes the exact accepted Product Language before LE/TA acceptance work consumes it, while progress remains explicitly partial.

CP self-review challenges stale acceptance identity, status/content mismatch, missing or over-broad index visibility, premature UI-2 completion, and a worktree that cannot support unambiguous resume.

#### Stage 1 closure self-review

Review CP1.1–CP1.4 together. Within the session that performed the acceptance, confirm that the published artifact is byte-for-byte the accepted candidate. Across a later session boundary, no persisted byte baseline exists, so the re-establishable check is the acceptance identity plus status, index route, and partial progress; the durable control against a changed artifact is the rule that any intentional change to an accepted artifact requires a new Owner decision. Also confirm that `index.md` routes only to that accepted source, `progress.md` names LE/TA as pending, and a new session can establish `PL-ACCEPT` from repository state plus the recorded Owner identity without relying on conversational memory alone. Do not add a hash registry or provenance layer to make the byte claim cross the session boundary.

Recommended resume boundary: the accepted and incrementally published Product Language is meaningful enough for a local commit only if the Owner separately authorizes one. Acceptance and durable publication remain required regardless of commit state.

### Stage 2A — Learning Experience common design

**Entry gate:** `PL-ACCEPT` passed, CP1.4 published the exact accepted artifact, and Stage 1 closure self-review passed.

**Stage outcome:** LE has one accepted and published specialization that inherits product decisions and covers the learning journey without becoming a route-specific surface specification.

#### CP2A.1 — Define LE hierarchy, signature, progress, and feedback language

Author the core of `screen-types/learning-experience.md` with:

1. learner audience and jobs across dashboard, course overview, active practice, feedback, review, and completion;
2. hierarchy rules that keep the current learning action obvious and progress visible without surrounding clutter;
3. a signature interaction/state language derived from recall, reveal, correction, progress, or completion rather than decoration;
4. semantic use of accepted product colors for correct, incorrect, warning, locked, current, completed, and next-action states; and
5. typography/density specialization for prompts, answers, explanations, progress, and course navigation without restating product values.

Invariant:

> A learner can identify the task, next action, result, and learning takeaway through one coherent hierarchy and feedback language that uses, rather than forks, the product system.

CP self-review challenges hidden feedback, equal-weight actions, duplicated product values, decorative signature, and assumptions about unsupported learning state.

#### CP2A.2 — Define LE motion, states, responsive/accessibility rules, and examples

Complete the LE candidate with:

1. motion and celebration rules, including when confetti is warranted, interruption limits, repeated-practice latency, and reduced-motion equivalents;
2. mobile/keyboard/touch rules for answer controls, flashcards, sidebars, progress, and next/previous actions;
3. loading, empty, error, partial/stale data, pending, disabled, completion, and retry behavior;
4. focus order, semantic answers, announced feedback, contrast, non-color cues, and long Vietnamese/foreign-language content;
5. representative `/learn`-family examples labeled as type-level applications, not accepted surface layouts; and
6. explicit non-goals: no route redesign, learning-state change, FSRS/business-rule change, new animation dependency, or runtime implementation.

Invariant:

> LE expression remains fast, repeatable, mobile/keyboard usable, understandable without color or motion alone, and bounded from surface/runtime ownership.

CP self-review challenges celebration that blocks practice, reduced-motion gaps, inaccessible answer controls, missing error/retry behavior, and examples that accidentally freeze page composition.

#### Stage 2A candidate integration self-review and Owner gate

Review CP2A.1 and CP2A.2 against the accepted product language and current LE evidence. Confirm the full learning loop is coherent from entry/progress through practice/feedback/completion, no product value is redefined, and representative examples remain type-level.

After candidate integration self-review passes, present the exact candidate for `LE-ACCEPT`. Acceptance must separately cover hierarchy, signature, feedback language, progress/celebration behavior, density, responsive rules, and accessibility. Corrections reopen only affected CPs but always require another Stage 2A candidate integration self-review before Owner re-review.

#### CP2A.3 — Publish LE acceptance

Immediately after `LE-ACCEPT`:

1. verify the accepted candidate identity against the current LE artifact;
2. mark that exact artifact `Accepted` with the available Owner-decision identity/date;
3. add or update only the LE accepted-source row in `index.md` while preserving Product Language routing;
4. update `progress.md` to list Product Language and LE as accepted/published, preserve TA as accepted/published if its serialized publication already occurred or otherwise mark TA pending, and keep UI-2 partial; and
5. verify that the LE index route resolves together with its accepted Product Language prerequisite.

Invariant:

> Repository truth exposes the exact accepted LE specialization and its Product Language prerequisite, preserves any already published TA truth, and keeps every remaining gate plus final UI-2 completion visibly pending.

CP self-review challenges stale identity, LE/product mismatch, shared index/progress edit loss, and premature completion.

#### Stage 2A closure self-review

Review CP2A.1–CP2A.3 with the published Product Language. Confirm the LE artifact is the accepted candidate, inherits the indexed product source, introduces no competing product values, and leaves a resumable partial progress state.

Recommended resume boundary: the accepted and incrementally published LE artifact may be committed separately only with explicit authority and only if doing so aids recovery; UI-2 remains incomplete until both type publications, Stage 3 cumulative integration, and final review pass.

### Stage 2B — Teacher Authoring common design

**Entry gate:** `PL-ACCEPT` passed, CP1.4 published the exact accepted artifact, and Stage 1 closure self-review passed.

**Stage outcome:** TA has one accepted and published specialization that supports productive continuous authoring and direct item editing without reopening route, permission, or business contracts.

#### CP2B.1 — Define TA journey, hierarchy, density, and action/state language

Author the core of `screen-types/teacher-authoring.md` with:

1. teacher audience and jobs across course overview, structure, topic editing, preview, readiness, submission, rejection/revision, and safe deletion;
2. the continuous primary creation journey with preserved context plus convenient direct editing of one item;
3. hierarchy and density rules for overview, structure trees, builders, long forms, dialogs/sheets, validation, and status/issue guidance;
4. a signature structural/state language derived from building and refining course content rather than ornamental dashboard styling;
5. action hierarchy for save, preview, submit, fix issue, reorder, direct edit, and destructive operations; and
6. truthful status/data visualization rules that exclude decorative analytics and unsupported learner insights.

Invariant:

> TA expresses one productive authoring journey and one legible action/status system while preserving established course/chapter/topic, route, permission, and data contracts.

CP self-review challenges route consolidation, decorative dashboard behavior, ambiguous save/submit/destructive priority, cold admin density, and invented analytics/state.

#### CP2B.2 — Define TA recovery, responsive/accessibility rules, and examples

Complete the TA candidate with:

1. validation, pending-save, failed-mutation, stale-state, permission/read-only, rejected-revision, and preserved-input behavior;
2. desktop productivity plus safe mobile/narrow-screen behavior, including critical-action discoverability, wrapping, overflow, touch targets, and known complexity limits without redefining route architecture;
3. keyboard ordering controls, tabs, forms, dialogs/sheets, focus return, labels, errors, and destructive confirmation;
4. representative overview/structure/topic-builder examples labeled as type-level applications, not UI-4 surface composition; and
5. explicit non-goals: no route consolidation, permission/state change, analytics contract, drag-and-drop requirement, shared-component migration, or runtime implementation.

Invariant:

> TA remains recoverable, truthful, keyboard/mobile safe, and directly editable across established authoring contexts without making unapproved component or surface decisions.

CP self-review challenges lost input, stale-success claims, hidden validation, inaccessible ordering/dialog behavior, unsafe narrow layouts, and examples that pre-decide UI-4.

#### Stage 2B candidate integration self-review and Owner gate

Review CP2B.1 and CP2B.2 against the accepted product language, Teacher ADR/routes, and current TA evidence. Confirm that continuous journey and direct editing coexist, action/status language remains coherent, and no type-level rule changes business behavior or shared primitives.

After candidate integration self-review passes, present the exact candidate for `TA-ACCEPT`. Acceptance must separately cover hierarchy, signature, density, authoring journey, direct-edit behavior, action/status language, responsive rules, and accessibility. Corrections reopen only affected CPs but always require another Stage 2B candidate integration self-review before Owner re-review.

#### CP2B.3 — Publish TA acceptance

Immediately after `TA-ACCEPT`:

1. verify the accepted candidate identity against the current TA artifact;
2. mark that exact artifact `Accepted` with the available Owner-decision identity/date;
3. add or update only the TA accepted-source row in `index.md` while preserving Product Language and any accepted LE routing;
4. update `progress.md` to list all actually accepted/published artifacts, preserve LE as accepted/published if its serialized publication already occurred or otherwise mark LE pending, and keep UI-2 partial until Stage 3 and final cumulative review pass; and
5. verify that the TA index route resolves together with its accepted Product Language prerequisite.

Invariant:

> Repository truth exposes the exact accepted TA specialization and its Product Language prerequisite, preserves any already published LE truth, and does not claim cumulative UI-2 completion before Stage 3 and final review.

CP self-review challenges stale identity, TA/product mismatch, shared index/progress edit loss, and premature completion.

#### Stage 2B closure self-review

Review CP2B.1–CP2B.3 with the published Product Language. Confirm the TA artifact is the accepted candidate, inherits the indexed product source, introduces no competing product values, and leaves a resumable partial progress state.

Recommended resume boundary: the accepted and incrementally published TA artifact may be committed separately only with explicit authority and only if useful for recovery; UI-2 remains incomplete until both type publications, Stage 3 cumulative integration, and final review pass.

Stages 2A and 2B have no semantic dependency on each other after published `PL-ACCEPT`. They may be authored in parallel only when file ownership is disjoint and current permission explicitly allows parallel work. Their acceptance-publication CPs are serialized because both update `index.md` and `progress.md`. Their final composition is still reviewed together in Stage 3.

### Stage 3 — Publication routing and program reconciliation

**Entry gate:** `PL-ACCEPT`, `LE-ACCEPT`, and `TA-ACCEPT` all passed and their publication CPs left exact current artifacts marked `Accepted`, indexed, and represented as partial progress.

**Stage outcome:** incrementally accepted sources are cumulatively discoverable and composition-safe, with progress truthfully ready for final cumulative review but not yet complete.

#### CP3.1 — Verify cumulative acceptance publication

1. Reconcile each artifact's recorded acceptance identity, `Accepted` status, index route, and partial progress state with the Owner decision that established it. A changed artifact is detected by that identity comparison and by the rule requiring a new Owner decision for an intentional change, not by a persisted byte baseline.
2. Verify `index.md` routes to all and only the three accepted UI-2 artifacts.
3. Verify `progress.md` records the same three accepted/published artifacts but still reports UI-2 as partial before cumulative composition passes.
4. Exclude drafts, planned surfaces, absent component contracts, and future work from accepted routes.
5. Verify all relative links and the core `frontend-design` discovery path.

Invariant:

> Acceptance identity, artifact status, index visibility, and partial progress agree for every UI-2 artifact before cumulative composition is evaluated.

CP self-review challenges stale candidate status, wrong acceptance identity, missing incremental publication, broken links, over-broad index claims, draft leakage, and premature completion.

#### CP3.2 — Prove cross-artifact composition and reconcile progress

1. Inspect the three artifacts together for duplicated values, circular inheritance, undefined tokens, conflicting exceptions, or accidental surface/component ownership.
2. Trace sample future tasks through the actual route:
   - a learner practice redesign resolves product + LE sources;
   - a Teacher builder redesign resolves product + TA sources;
   - a focused implementation with no surface spec preserves established local behavior while applying accepted common decisions; and
   - a shared `Button` change still routes to UI-3 rather than treating product geometry intent as code authorization.
3. After cumulative composition passes, update the UI-2 row with that evidence but retain a truthful partial or `final review pending` state; prepare the exact completion update for use only after final cumulative review passes.
4. Leave UI-3/UI-4/UI-5 statuses unchanged except for a factual next-gate clarification made necessary by the accepted outputs.

Invariant:

> Product, LE, and TA sources compose without competing ownership, downstream routing selects the minimum correct set, and progress remains non-complete until final cumulative review passes.

CP self-review challenges duplication, circular precedence, missing actual-path trace, premature downstream readiness, and overclaimed verification.

#### Stage 3 integration self-review

Review CP3.1 and CP3.2 as the cumulative publication/composition boundary. Confirm that acceptance identities, status labels, index routes, accepted artifacts, task traces, and pre-final-review `progress.md` all describe the same current truth. Stage 3 verifies already-incremental publication and cumulative composition; it does not first materialize earlier Owner decisions or mark UI-2 complete before final review. Any correction to an accepted material design decision reopens its owning earlier Stage and requires the applicable Owner decision plus publication CP again; cumulative routing/progress corrections remain in Stage 3.

Recommended resume boundary: Stage 3 plus all accepted artifacts form the coherent UI-2 rollback boundary and are the natural final local commit candidate, but only after explicit commit permission.

### Final cumulative UI-2 review

After every Stage passes, review the actual cumulative candidate against the original UI-2 goal rather than merely aggregating CP results:

1. re-anchor to the Master Plan, exact Owner acceptances, current branch/diff, and all accepted artifacts;
2. attempt to falsify the full system through wrong ownership, duplicated values, missing concrete decisions, inconsistent LE/TA inheritance, misleading index routes, runtime-implementation leakage, and evidence overclaim;
3. verify the strongest plausible remaining reason a later UI-3/UI-4 agent could not safely consume these sources;
4. run every deterministic/source check listed below on the final candidate;
5. confirm ephemeral review aids are removed or separately authorized;
6. after final review passes, apply the prepared `progress.md` transition from partial/final-review-pending to complete; and
7. report remaining runtime drift and future implementation dependencies without weakening the UI-2 completion claim.

Final review PASS is required for UI-2 completion but does not grant commit, push, PR, UI-3/UI-4 implementation, browser automation, or deployment authority.

## Dependency graph and delivery boundary

```text
UI-1 accepted-source routing (complete)
→ Stage 0: CP0.1 authority/owners → CP0.2 bounded audit → Stage 0 integration review
→ Stage 1: CP1.1 identity/color/type
           → CP1.2 surfaces/geometry/states
           → CP1.3 motion/mapping/examples
           → candidate integration review → PL-ACCEPT
           → CP1.4 publish Product Language → Stage 1 closure review
├─ Stage 2A: CP2A.1 LE hierarchy/feedback
│            → CP2A.2 LE motion/responsive/accessibility
│            → candidate integration review → LE-ACCEPT
│            → CP2A.3 publish LE → Stage 2A closure review
└─ Stage 2B: CP2B.1 TA journey/hierarchy/actions
             → CP2B.2 TA recovery/responsive/accessibility
             → candidate integration review → TA-ACCEPT
             → CP2B.3 publish TA → Stage 2B closure review
→ Stage 3: CP3.1 cumulative acceptance/publication verification
           → CP3.2 composition/final-review readiness
           → Stage 3 integration review
→ final cumulative UI-2 review → final progress = complete
→ UI-2 complete
├─ UI-3 shared-component decisions
└─ UI-4 Teacher pilot design/implementation
```

The work remains one UI-2 branch and one tracked workstream. The default delivery recommendation is one final pull request after Stage 3 because the artifacts form one inheritance contract and one program completion gate. This is not a fixed PR-count rule: an accepted Stage 1, 2A, or 2B output may become a separately authorized commit or pull request only when it is independently coherent, its downstream consumer and merge order are explicit, and `progress.md` preserves UI-2 as partial rather than complete.

Do not split merely because a Stage or CP exists. Conversely, do not hold an independently needed accepted product/type contract inside a larger PR when a real downstream dependency, rollback boundary, or review constraint justifies delivery. Any split must preserve product-before-type order, exact acceptance identity, incremental index visibility, partial progress, and the final Stage 3 integration review over cumulative repository state. The owning Stage's publication CP already establishes the truthful partial-delivery state; Stage 3 later re-verifies it cumulatively.

No implementation prompt split is needed beyond the Stage/CP ownership above. CPs provide correctness and resume boundaries inside one coherent documentation workstream; runtime implementation is intentionally deferred to later workstreams.

## Acceptance criteria

| Actor and condition | Observable required result |
| --- | --- |
| A later agent receives a product-facing UI task | It can use `index.md` to find only Owner-accepted common sources and distinguish them from plans, progress, drafts, runtime CSS, and absent surface/component contracts. |
| A product-wide visual decision is needed | `product-language.md` supplies concrete accepted values and semantic intent rather than adjectives alone. |
| An LE task needs design direction | The agent inherits product values and obtains LE-specific hierarchy, feedback, progress, motion, celebration, responsive, and accessibility rules without a second palette. |
| A TA task needs design direction | The agent inherits product values and obtains TA-specific authoring journey, density, builder, validation, status, direct-edit, responsive, and accessibility rules without reopening route/business contracts. |
| Current runtime differs from an accepted decision | The documents classify the mismatch as deferred implementation drift; UI-2 does not silently edit code or call the runtime pattern approved. |
| A shared component change is proposed | The artifacts express intent only and route exact component semantics/dimensions plus usage audit to UI-3. |
| A surface design is proposed | The common artifacts constrain it but do not pre-approve route-specific composition; UI-4/later surface ownership remains intact. |
| Any acceptance or verification is missing | The affected artifact/workstream remains candidate, partial, blocked, or `not_run`; progress does not report completion. |

## Verification strategy

### Deterministic and source-level checks

Run after the accepted artifact set is stable:

1. `git diff --check`. Its scope of validity is tracked change only: it proves nothing about a file that is still untracked, which is the expected state for new UI-2 artifacts when no commit is authorized. Report it as `not_run`/vacuous in that case rather than as passing hygiene evidence; when the artifacts are untracked, check 7's direct file search is the hygiene evidence.
2. Exact changed-path audit confirming only the planned UI-2 docs/progress paths changed.
3. Relative-link resolution for the plan, index, product language, type designs, and progress links.
4. Status/index audit proving every indexed design is accepted and no candidate/draft is presented as accepted.
5. Token-name audit against `app/globals.css` and shared component exports; proposed names must be clearly labeled and not claimed as runtime values.
6. Duplication/ownership audit across product, LE, and TA documents.
7. Search for accidental runtime/dependency edits, conflict markers, trailing whitespace, malformed Markdown, suspicious credentials, and committed temporary preview artifacts. This check runs against the actual files and therefore covers untracked artifacts too.
8. Actual diff review against this plan, the Master Plan, and current Owner decisions.

No product unit test, typecheck, lint, build, Supabase check, or browser E2E is required for a documentation-only UI-2 checkpoint unless the actual diff expands into the code or tooling those checks own. If scope expands, stop and obtain a revised plan/authority before selecting broader verification.

### Design review and visual evidence

Owner acceptance, not an automated test, decides the material visual candidate. Each candidate presentation must make the exact decisions judgeable:

- product language: rendered swatches, typography roles, surfaces/elevation, geometry, focus/states, and motion/reduced-motion pair;
- LE: representative dashboard/course/practice/feedback/progress/completion fragments at mobile and desktop composition widths; and
- TA: representative overview/structure/builder/form/status/destructive fragments at mobile/narrow and desktop widths.

These are design examples, not claims that the production routes were changed or browser-QA passed. Any ephemeral render must be generated from the candidate's exact values and removed before completion unless separately retained by Owner decision.

Current runtime browser QA is optional discovery evidence only and cannot accept the new design. Future UI-3/UI-4 implementation must plan real automated checks, fixtures, browser interactions, and responsive viewports under `test-quality-strategy` and `playwright-cli` when applicable.

QA fixture readiness is not applicable to UI-2 because it changes no data-backed UI and makes no runtime manual-QA claim.

## Risks, mitigations, and earliest exposure

| Risk | Impact | Mitigation and earliest gate |
| --- | --- | --- |
| Adjectives are mistaken for a standard | Later agents still invent palettes and geometry. | Product candidate must include exact values and rendered examples before `PL-ACCEPT`. |
| Current CSS is promoted without judgment | Existing inconsistency becomes permanent design debt. | Audit table classifies reuse/proposal/drift; Owner accepts decisions, not inventory. |
| Product and type artifacts duplicate values | Sources drift and precedence becomes ambiguous. | Inheritance rules plus final cross-artifact duplication audit. |
| A type design becomes a hidden surface spec | UI-4 is pre-decided and route-specific decisions lose an owner. | Use representative applications only; prohibit fixed page composition and route-specific component selections. |
| Product geometry accidentally authorizes Button changes | UI-3 usage audit and accessibility risk are bypassed. | Document intent and mapping need only; exact shared variants remain UI-3. |
| LE expressiveness harms repetition/accessibility | Motion or celebration delays practice or hides feedback. | LE gate requires latency, reduced-motion, keyboard, non-color, and mobile rules. |
| TA expressiveness harms productivity | Decoration or density obscures authoring state and actions. | TA gate requires task hierarchy, scanability, preserved input, direct edit, truthful visualization, and safe destructive handling. |
| Visual examples become a second SSOT | Screenshots/prototypes drift from documents. | Examples are derived review aids; exact values stay in the owning artifact; ephemeral files are removed. |
| Acceptance is not durably published, or partial acceptance is reported as completion | A resumed session misses real authority or downstream work consumes an incomplete contract. | Each successful gate publishes exact identity/status/index plus partial progress immediately; Stage 3 verifies cumulative composition; only final cumulative review transitions progress to complete. |
| Remote baseline drift | Plan may omit newer repository changes. | This plan records that no fetch ran. Revalidate HEAD/upstream before candidate authoring; stop on material drift. |

## Stop conditions

Stop and return to the Owner when:

- design candidate authoring is requested while the Owner has not accepted this exact plan revision;
- this plan is accepted but the requested scope or its acceptance still cannot be determined from it;
- repository refresh shows a material UI-2 artifact, token owner, or design decision created elsewhere;
- product-language decisions cannot be separated from a shared-component implementation decision;
- LE or TA requires a new route, permission, business state, analytics contract, persistence behavior, dependency, or database change;
- one type needs a product-level exception that would materially change the already accepted product language;
- a candidate lacks enough concrete visual evidence for the Owner to judge it;
- acceptance identity is ambiguous or refers to an older candidate revision;
- a visual sample cannot be reproduced from the documented exact values;
- scope expands into runtime code, package installation, shadcn CLI, model evaluation, browser automation, remote actions, or deployment without exact authority; or
- required verification fails or remains unavailable.

## Rollback and deviation handling

With the default single final pull request, revert the index, product language, two type designs, and progress reconciliation together. If a separately authorized partial delivery exists, rollback follows dependency order: remove or correct dependent LE/TA sources before the product language they inherit, update the accepted-source index in the same rollback, and reconcile `progress.md` to the remaining accepted state. Never leave an indexed source whose accepted prerequisite has been removed. No runtime state, database state, dependency, or external system requires rollback.

A material Owner decision that changes artifact ownership, the three-gate sequence, completion criteria, or delivery boundary requires this plan to be revised and self-reviewed before dependent work continues. A value-level correction inside the still-current candidate is handled in that artifact's review loop and does not rewrite the stable plan unless it changes scope or ownership.

## Plan self-review and handoff gate

Before recommending this plan for Owner acceptance:

1. trace every UI-2 Master Plan requirement to a Stage/CP, acceptance criterion, or stop condition;
2. challenge the strongest plausible rejection: that the plan could produce attractive prose without concrete, judgeable values or could accidentally turn common design into runtime/component/surface authority;
3. verify branch/base facts, expected paths, representative runtime sources, and existing artifact absence against the current repository;
4. check scope, exclusions, dependencies, three separate Owner gates, evidence classes, and rollback boundary;
5. run `git diff --check` and inspect the full plan diff, noting that this check is vacuous while the plan itself is untracked, in which case the direct file hygiene search is the applicable evidence; and
6. change `Plan status` only after the Owner explicitly accepts the exact candidate, while preserving design-authoring and implementation authority as separate gates.

Every Stage/CP self-review, integration self-review, and closure self-review named in this plan is **author-side** evidence. In `NORMAL`, these reviews plus the Owner gates and final cumulative review are sufficient to traverse this plan, subject to current action authority and repository evidence. They do not become independent review merely because they pass. If Main later selects a managed mode, Main must additionally route the exact candidate through the reviewer phases and artifacts required by `native-multi-agent-workflow`; no self-review here substitutes for those conditional requirements.

After Owner acceptance, the implementation handoff is:

- **Approved goal:** author and obtain separate acceptance for product, LE, and TA common design contracts.
- **Required order:** audit → product candidate/acceptance/publication → LE and TA candidates/separate acceptance-publication closures → cumulative index/composition verification → final review/completion progress.
- **Allowed domains:** only the UI-2 design/tracking artifacts listed in this plan.
- **Forbidden domains:** all runtime, shared-component, route, state, API, database, dependency, and remote changes.
- **Verification:** documentation/source checks plus Owner judgment of exact visual candidates; no runtime test claim.
- **Known limitation:** current runtime remains potentially divergent until UI-3/UI-4/later implementation is separately planned and authorized.

Owner acceptance of this exact plan revision and current action authority are required before dependent authoring begins. The historical Plan Reviewer `PASS` is evidence about the reviewed planning candidate, not a standing execution prerequisite. Under `NORMAL`, Main proceeds through the Stage/CP path after confirming those two gates and current repository compatibility; no review artifact or managed admission is required. If Main later selects a managed mode, Main must additionally satisfy that mode's candidate identity, review-artifact, admission, and correction-round rules before the affected transition. Neither a durable plan nor any review verdict grants Git, remote, production, database, destructive, or deployment authority.

Recommended future final checkpoint commit message, only after explicit commit permission:

```text
docs(ui-design): establish product and screen-type language
```
