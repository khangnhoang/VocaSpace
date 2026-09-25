# Master Plan: VocaSpace UI Design System and Rendered UI Review

## Status and authority

| Field | Value |
| --- | --- |
| Plan status | Candidate for Owner review; no design standard or implementation is approved by this document |
| Planning baseline | `main` and `origin/main` at `2074279ed3cbae7a9376195ce3056de3847adef7` on 2026-09-26 |
| Workstream branch | `feat/ui-design-system-and-review` |
| Current delivery state | [progress.md](./progress.md) |
| Scope of this checkpoint | This Master Plan and progress source only |

This plan owns program intent, source ownership, dependencies, phase gates, and acceptance criteria. Future approved design artifacts own their design decisions; future phase plans own exact implementation scope. `progress.md` owns current delivery evidence. An agent-authored plan, self-review, or commit does not approve its own material design decisions or authorize later implementation, push, PR, merge, or deployment.

## Goal

Establish a reusable, Owner-approved UI design direction for VocaSpace and a distinct browser-based UI review process. Future agents should discover and reuse accepted product, screen-type, component, and surface decisions before designing or implementing a screen. The system must permit expressive learning interactions and a more fluid teacher authoring experience while keeping behavior, accessibility, and permission contracts intact.

Success is observable when a later agent can identify the accepted design sources for a chosen surface, implement against them without inventing a new visual system, and run a rendered UI review that reports both contract mismatches and evidenced user-facing design judgments.

## Owner direction established for planning

- Learning Experience (LE) and Teacher Authoring (TA) should both allow **medium-to-high** design latitude. Their emphasis differs: LE spends expressiveness on interaction, feedback, progress, accomplishment, and motivation; TA spends it on information architecture, authoring workflow, builders, useful visualization, and reduced interaction cost.
- LE may use purposeful animation and celebratory feedback, including confetti where appropriate. Such effects must not delay repeated practice, obscure learning feedback, or disregard reduced-motion preferences.
- TA should support a continuous primary creation journey while retaining direct, convenient editing of an individual content item. Persistence structure must not dictate the number of UI steps or navigation transitions. A continuous journey does not require a single page or erase the course/chapter/topic mental model.
- Shared controls should feel more comfortable than the current compact default in primary actions, with softly rounded corners inspired by Windows 11 rather than pill-heavy shapes. The exact button heights, radii, and exceptions remain future Owner decisions after a usage audit.
- A product-wide visual language, accepted screen-type designs, shared component standards, and meaningful surface specifications should be reusable across sessions. Agents may propose changes; only an explicit Owner decision makes a material design revision accepted.
- A separate UI review skill should inspect the running interface in a browser after the implementation is stable enough to assess. It must compare accepted designs with rendered states and make user-facing aesthetic and interaction judgments, not merely scan source code or check literals.
- New shadcn components are considered only after inspecting repository components and composition options, then checking the current official registry for a genuinely missing need. Installing or running the shadcn CLI requires the Owner's explicit permission for the specific proposed addition.

These statements define program direction, not an approved palette, a numeric button size, an animation recipe, a route redesign, or approval of every proposed artifact below.

## Confirmed repository baseline

| Source | Current fact and implication |
| --- | --- |
| `.agents/skills/frontend-design/SKILL.md` and its references | Five routing rows already exist. LE currently says `medium`; TA says `medium-to-low`. The core asks for a 4–6-color direction when color is in scope. Once a product language is accepted, routine tasks must reuse it rather than generate another palette. |
| `.agents/skills/frontend-workflow/SKILL.md` | Owns frontend discovery, implementation, state, and manual validation coordination. It does not own accepted visual identity. |
| `.agents/skills/code-review-and-quality/SKILL.md` | Owns code review coordination and final readiness verdict. Its frontend dimensions do not constitute a separate rendered, design-focused UI review procedure. |
| `.agents/skills/frontend-workflow/references/manual-ui-validation.md`, `.agents/skills/test-quality-strategy/SKILL.md`, and `.agents/skills/playwright-cli/SKILL.md` | Already own browser readiness, fixture/evidence boundaries, and browser-driving mechanics respectively. A UI review skill must route to them instead of copying their procedures. |
| `app/globals.css` and `components/ui/button.tsx` | Runtime tokens and button variants exist. The default button uses `h-8`, and `lg` uses `h-9`; feature call sites also override styling. A revised global button standard requires usage inspection and explicit acceptance. |
| `components.json`, `components/ui/*`, and `package.json` | The repository is configured for shadcn and already contains shared UI components. Registry availability does not by itself justify installation or a new global primitive. |
| `docs/adr/refactor-teacher-workflow-plan.md`, `lib/course-authoring/routes.ts`, and student-flow documentation | Current Teacher overview, structure workspace, and topic builder routes are intentional. Existing plans own their historical decisions. New authoring direction is prospective and does not silently rewrite route contracts or old plan evidence. Analytics remains gated by a trustworthy data contract. |
| `.agents/evals/frontend-design/*` and `.agents/evals/frontend-workflow/*` | Existing evaluation suites protect current skill routing and behavior. Material routing/behavior changes require proportionate suite updates and semantic checks under the skill-governance workflow. |

No approved product-wide design-language document, screen-type visual specification, or current surface design index exists under `docs/ui-design-system-and-review/` at this baseline.

## Contract ownership and resolution

| Source | Owns | Must not own |
| --- | --- | --- |
| `AGENTS.md` | Activation routes for repository skills | Palette, page layout, or browser commands |
| `frontend-design` core and screen references | Design decision process, source discovery, screen philosophy, and exact read conditions | A second copy of every approved palette or page specification |
| Product design language (future accepted design artifact) | Shared visual identity and semantic token intent across product surfaces | Screen-specific workflow or values independently redefined from runtime CSS |
| Screen-type design (future accepted design artifact) | How LE, TA, Client/Marketing, or Admin expresses that identity for its user goal | A duplicated product palette, page layout, or shared primitive implementation |
| Shared component contract and implementation | Reusable semantics, variants, states, geometry, accessibility, and runtime token mapping | One page's business behavior or arbitrary per-screen restyling |
| Surface specification (future accepted design artifact) | One meaningful page, workspace, builder, or major flow: journey, composition, component selection, states, and justified local signature | A duplicate implementation plan, changelog, or copy of global component values |
| `frontend-workflow` | Frontend engineering and implementation integration | Product design approval |
| New `frontend-ui-review` | Rendered design review procedure, evidence, findings, and domain result | New design rules, browser-driver mechanics, code review's final readiness verdict |
| `code-review-and-quality` | Code review and integrated final readiness | A duplicate visual-language contract |

The existing Shared Design System Component routing row is a cross-cutting change category, not a fifth product screen needing its own screen-type visual design. A task may match both a product screen and a shared-component change.

The candidate artifact layout is `docs/ui-design-system-and-review/product-language.md`, `docs/ui-design-system-and-review/screen-types/<type>.md`, and `docs/ui-design-system-and-review/surfaces/<area>/<surface>.md`, with an index only when accepted designs exist to route to. These are future paths, not files to create in this checkpoint or a requirement to document every screen. `frontend-design` should own the conditional common-design authoring procedure and permanent discovery rule; the accepted design content should have one durable owner in `docs/ui-design-system-and-review/`. The eventual `frontend-ui-review` skill needs an explicit `AGENTS.md` activation route and a narrow handoff to the existing code-review lifecycle; any `docs/agent-loops.md` change must clarify that handoff without duplicating its verdict taxonomy.

Source resolution is by ownership, not a simple five-level override chain. Accepted product identity and shared-component contracts constrain local designs; a screen-type design specializes experience goals; a surface specification composes them. The current code and CSS show actual runtime behavior, not proof that a conflicting design is approved. When sources disagree, identify the owner and whether the cause is stale documentation, implementation drift, or a proposed design change. Stop dependent implementation until the material discrepancy is resolved; do not silently override a higher-scope contract or treat an agent draft as approved.

## Design artifact lifecycle

1. Discover current accepted sources, nearby UI, code tokens/components, and relevant product/permission contracts before proposing a design.
2. Draft a product, screen-type, or surface design only when the task calls for that level of change. A dedicated conditional `frontend-design` reference should be read only when the Owner asks to create or revise a screen philosophy, product language, or common screen-type design; routine implementation should not load it merely to reuse an already accepted design. The core skill always routes agents to existing accepted designs.
3. Mark a material draft as accepted only after an explicit Owner decision tied to an identifiable candidate. Acceptance of a design does not authorize implementation or Git/remote actions.
4. During implementation, read the accepted sources through a discoverable index and cite the applicable decisions. If a required design is absent, propose the smallest missing design and stop before guessing a material visual or workflow decision. A focused fix may preserve established UI without creating a full new specification.
5. When an intentional UI change alters an accepted surface contract, update the owning surface specification in the same authorized work. A bug fix that restores the existing contract does not require a design-spec edit. Keep the specification about the current accepted design; Git retains history.
6. Record implementation and browser-review status separately from design approval. A successful review does not retroactively approve a different design.

Future design artifacts should use semantic tokens and existing component/variant names for inherited choices. Record exact colors, dimensions, and custom treatment only where the decision is genuinely owned at that level. An accepted design must be traceable to the implementation tokens/components it expects; document and resolve drift rather than maintaining competing values.

## Workstreams and dependency order

| ID | Outcome and owner | Depends on | Acceptance gate |
| --- | --- | --- | --- |
| UI-1 | Update LE/TA philosophy and `frontend-design` source-discovery/conditional-authoring rules; route affected skill evaluations through `maintain-repo-skills`. | Owner acceptance of this plan's material architecture | LE/TA latitude and distinct emphasis are unambiguous; ordinary tasks reuse accepted sources; authoring guidance triggers only for design creation/change; no current safety or permission rule regresses. |
| UI-2 | Draft a product visual language and accepted LE/TA screen-type designs, starting from current tokens and real screens. Other types follow only when needed. | UI-1 routing and Owner decisions on actual visual samples | The Owner explicitly accepts the material palette, typography, surface, radius, motion, and type-specific direction; code/token mapping and intended exceptions are clear. No agent freezes values from adjectives alone. |
| UI-3 | Define and implement the smallest justified shared-component standard, starting with `Button` if usage audit confirms it as the first global need. | UI-2 relevant visual decisions | Existing uses and responsive/accessibility impact are inspected; approved semantics and dimensions map to code; focused verification passes. Additional component contracts require a demonstrated consumer. |
| UI-4 | Create an accepted specification and implement one meaningful Teacher surface pilot, preserving current route/permission contracts unless a separate Owner decision changes them. | UI-2; UI-3 only for shared variants the pilot actually needs | A primary creation journey and direct edit path are observable; required states and component choices are explicit; implementation and targeted checks match the approved surface design. |
| UI-5 | Add and route `frontend-ui-review`, then use it for the pilot after code/browser readiness. Route browser mechanics and QA evidence to existing owners. | Accepted design sources and a runnable pilot from UI-2/UI-4 | `AGENTS.md` selects the skill for matching UI reviews; review observes real rendered states, interactions, and viewports; reports contract mismatches and evidenced aesthetic/interaction findings separately; final code-review readiness incorporates pending or blocking UI results. |

The workstreams are dependency guidance, not permission to implement them or a fixed PR count. Each later phase or PR requires a bounded implementation plan, exact Owner authority, proportional verification, and a coherent rollback boundary. Do not create all screen specifications or component-contract files up front. If pilot evidence changes the proposed contract, correct the owning draft and obtain the appropriate Owner decision before dependent work continues.

## UI review contract to develop in UI-5

The new skill should activate for an explicit rendered UI review and for substantial new-page, major-redesign, or shared-visual-change checkpoints when an accepted design and a runnable target exist. It should not turn every small copy or cosmetic fix into a full browser review.

Its review begins with the exact target revision, accepted design sources, role/data fixtures, required states, viewport matrix, and a stable running environment. After the code review establishes a usable candidate, inspect the UI in a browser and perform the relevant user journey. A functional browser observation can still inform code review; the distinct UI review focuses on design fidelity and experienced interaction quality.

Report two kinds of observations: (1) an accepted-contract or usability/accessibility mismatch with a reproducible state and correction direction; (2) a design recommendation supported by observed hierarchy, rhythm, density, legibility, motivation, interaction cost, or coherence. A subjective preference without an accepted contract or demonstrable user impact is advisory for the Owner, not an invented blocking rule. Include actual screenshots/observations when available, and label unobserved states as pending or `not_run`. The UI skill returns a domain result; `code-review-and-quality` retains the integrated readiness verdict.

## Scope and exclusions

This planning checkpoint changes only `docs/ui-design-system-and-review/plan.md` and `docs/ui-design-system-and-review/progress.md`. It does not approve or create the product language, page specifications, component contract, UI review skill, evaluation cases, CSS, application UI, or browser fixtures.

The future program excludes automatic redesign of every route, silent replacement of the approved Teacher route architecture, decorative charts without trustworthy data, unconditional confetti, new animation dependencies without approval, automatic shadcn installation, wholesale component standardization, and a requirement that every small UI element have its own durable specification. It also excludes DB/RLS/API/product-state changes unless a later bounded task proves they are necessary and separately authorizes them.

## Verification, risks, and decisions still required

For this checkpoint, verify links and paths against the repository, compare every Owner direction above with the conversation, inspect the actual two-file diff, run `git diff --check`, and apply the shared author self-review methodology. Product tests and browser QA are not evidence for a documentation-only candidate and are not run here.

Later skill changes need structural validation and affected routing/regression/fresh-reader evidence. Product/component changes need targeted code tests and manual/browser checks at the states and viewports selected by `test-quality-strategy`; `playwright-cli` owns browser driving when activated. UI review cannot claim design fidelity when an accepted design, runnable target, fixture, or required state is missing.

| Risk or open decision | Earliest gate and treatment |
| --- | --- |
| Generic product adjectives are mistaken for an approved palette or exact Windows/Fluent geometry. | UI-2: show concrete alternatives and token mapping; Owner accepts actual values before they become standards. Windows 11 softness is a direction, not a requirement to copy Fluent. |
| A global `Button` change harms compact controls or mobile layouts. | UI-3: inspect variants and call sites; distinguish visual size from interactive target; approve exact geometry and verify affected uses. |
| Screen-type and page artifacts duplicate values and drift. | UI-1/UI-2: exact ownership and source routing; UI-4: pilot checks inherited tokens and update lifecycle. |
| A smooth TA journey is mistaken for an unapproved single-page or route rewrite. | UI-4: test user transitions, context preservation, and direct edit paths within the current route contract first. |
| Browser review is treated as a screenshot-only or automated-test substitute. | UI-5: define fixtures, state/viewport/interaction checks, evidence limits, and distinct functional versus design findings. |
| A new design-review skill duplicates final review authority. | UI-5: the UI skill returns domain evidence and findings; existing code review owns final integrated readiness. |

## Completion boundary

This Master Plan checkpoint is complete when its two documents accurately express the agreed direction, separate confirmed facts from future Owner decisions, pass self-review and document checks, and are committed locally under the Owner's current commit permission. The design system and UI review capability are **not** complete at that checkpoint. The program is complete only after the approved artifacts, pilot implementation, rendered UI review, and truthful verification described above are delivered under later permissions.
