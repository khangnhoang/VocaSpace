# UI-1 Detail Plan: Frontend Design Philosophy and Source Routing

## Status and authority

| Field | Value |
| --- | --- |
| Plan status | Owner-accepted for UI-1 implementation; planning self-review alone did not approve implementation |
| Branch | `feat/ui-design-philosophy-routing` |
| Synchronized base | `main == origin/main == 3ba850ea95907914fabb524eda842ebfb62168f6` on 2026-09-26 |
| Upstream contract | [UI design system and review Master Plan](../../plan.md), `UI-1`; merged in PR #103 |
| Execution contract | This accepted detail plan; [program progress](../../progress.md) retains current delivery status |

At the planning checkpoint, the Owner authorized the branch, English detail plan, self-review, and local commit on `PASS`; that checkpoint did not authorize skill implementation, evaluation dispatch, push, PR, merge, or rollout. The Owner later accepted this detail plan and separately authorized UI-1 implementation as recorded in [program progress](../../progress.md). The approved Master Plan fixes program intent; this plan fixes the execution boundary for `UI-1` only. Design acceptance and implementation permission do not grant evaluation dispatch or Git/remote actions.

## Goal and completion claim

Make `frontend-design` give both Learning Experience (LE) and Teacher Authoring (TA) **medium-to-high** design latitude while directing that latitude toward their different user jobs. Every routine UI task should discover and reuse applicable Owner-accepted design sources when they exist. A missing future design artifact alone must not block a task that can preserve established UI without a new material design decision. A dedicated authoring reference should activate only for an Owner request to create or revise a screen philosophy, product language, or common screen-type design.

`UI-1` is complete only when the changed skill, its resource route, and affected evaluation evidence establish those behaviors without weakening existing accessibility, permission, safety, frontend-engineering, or approval boundaries. Completion does not mean a product language, screen-type artifact, surface design, shared component standard, or rendered UI review exists.

## Confirmed repository state and ownership

| Source | Confirmed fact and owner |
| --- | --- |
| `.agents/skills/frontend-design/SKILL.md` | Owns product-facing design process, five screen classifications, resource read conditions, guardrails, and the current 4–6-color exploration rule. It does not yet route to accepted design artifacts. |
| `references/learning-experience.md` and `references/teacher-authoring.md` | Own screen-specific guidance. LE currently says `medium`; TA says `medium-to-low`. Their focus, feedback, safety, and productivity rules remain useful. |
| `AGENTS.md` | Already activates `frontend-design` for product UI and `frontend-workflow` for non-trivial frontend engineering. A new top-level skill route is not needed for `UI-1`. |
| `.agents/skills/frontend-workflow/SKILL.md` | Owns engineering discovery, state, implementation, and manual validation; it must not become a second source of approved visual identity. |
| `docs/ui-design-system-and-review/` | Contains the Master Plan, progress, and this candidate UI-1 detail plan. None is an accepted product palette, screen-type visual specification, component contract, or surface design. |
| `.agents/evals/frontend-design/{routing,regression,fresh-reader}.json` | Existing cases cover LE/TA classification, purposeful motion, safety, and local-versus-global component changes. They do not directly establish accepted-source reuse, the conditional common-design authoring route, or local-component discovery before a shadcn proposal. |

The Master Plan owns the hierarchy and workstream gates. `frontend-design` owns how agents discover and apply accepted sources; later design artifacts own actual visual decisions. `maintain-repo-skills` owns skill-change validation and evidence claims. Git history and `progress.md` own delivery and current status respectively.

## Scope and implementation contract

One coherent implementation PR should change only the following owners, subject to rechecking the repository at implementation time:

1. **Core `frontend-design/SKILL.md`:** add an always-on, short discovery rule after screen classification. Locate applicable accepted product, screen-type, shared-component, and surface sources under `docs/ui-design-system-and-review/`, using an index when one exists. Reuse accepted decisions and semantic tokens; do not generate a fresh page palette merely because the current two-pass process asks for 4–6 colors. Keep that color exercise for a genuinely open visual direction. Distinguish accepted design from a draft and current CSS from approval. Resolve conflicting sources by semantic ownership. If no accepted artifact exists, ask whether the task requires a new material visual, interaction, or shared-component decision: a typo, local layout/responsive repair, focused cosmetic fix, or ordinary implementation with a clear local pattern may preserve established UI and continue; a material redesign, new palette/geometry, or changed shared interaction contract requires the smallest candidate decision and Owner acceptance before dependent implementation. Stop on a material source conflict under the same ownership rule. Search existing local components, wrappers, and composition patterns first and reuse a suitable solution. Only when none fits, check the current official shadcn registry; if proposing an addition, identify the exact component, reason, and impact, then obtain explicit Owner approval before any CLI/install action. Keep discovery, source resolution, and approval rules in core, not hidden in a conditional reference.
2. **LE reference:** change latitude to medium-to-high and direct expression toward interaction, feedback, visible progress, accomplishment, and motivation. Allow purposeful celebration, including confetti where warranted, without delaying repeated practice, obscuring learning feedback, or ignoring reduced-motion, keyboard, and mobile needs. Do not prescribe a specific animation or palette.
3. **TA reference:** change latitude to medium-to-high and direct expression toward information architecture, authoring flow, legible builders and useful visualization backed by trustworthy data, and fewer unnecessary steps. Require a continuous primary creation journey and convenient direct editing of an individual item without assuming a single page or changing the approved route and permission contracts. Do not prescribe decorative charts or component geometry.
4. **One conditional authoring reference:** add `references/common-design-authoring.md` directly to the core resource-routing table. Its exact read condition is an Owner request to create or revise a screen philosophy, product language, or common screen-type design. It should guide source inspection, a concrete candidate, inheritance and exception boundaries, Owner approval tied to the candidate, and subsequent reuse. Routine implementation, a focused cosmetic fix, and a surface-specific design that does not revise a common design must skip it. The reference is a procedure, not a second copy of visual standards or an authorization to approve a draft.
5. **Affected `frontend-design` evaluations:** add one positive common-design authoring and one missing-artifact decision near miss to `routing.json`, one differentiated LE/TA direction case and one local-first shadcn near miss to `regression.json`, and one independent accepted-source/authoring-boundary case to `fresh-reader.json`. The shadcn case should supply the existing `components/ui/tooltip.tsx` and a relevant simple informational usage as context while the task suggests adding shadcn Tooltip; it must require recognition and reuse of the local solution before any registry proposal, with no installation claim. This tests the recommendation/order visible in a bounded response, not a real tool-search trace. The missing-artifact case should contrast a focused fix that preserves established UI with a material redesign requiring a new decision; only the latter pauses dependent implementation for an Owner-accepted candidate. The positive authoring case separately covers an explicit common-design request and its Owner gate. Preserve unrelated existing cases and historical results; revise an existing case only if its frozen criterion contradicts the approved new contract. Keep expected/forbidden behavior in `evaluator_only`, never in executor-visible inputs.
6. **Program progress:** update the `UI-1` row when implementation and verification actually occur. Keep the detail plan as the stable execution contract; do not copy its steps into `progress.md`.

`AGENTS.md`, `frontend-workflow`, Client/Marketing and Admin references, shared-component defaults, CSS, application routes, the product design artifacts, `frontend-ui-review`, runner code, and CI configuration are outside this PR. A missing source-routing rule does not justify changing their owners silently. The current planning checkpoint creates no proposed runtime, package, database, or external dependency.

## Dependency and execution order

`UI-1` depends on the merged Master Plan, not on `UI-2` visual values or a pilot. Its output is a prerequisite for `UI-2` to author accepted product and type designs. No `UI-2` artifact is created in this PR.

For the future implementation, first verify the baseline and inspect existing references/evals. Then change the core discovery and exact resource route, add the conditional procedure, update LE/TA guidance, and revise affected eval definitions. Keep these edits and directly detecting evaluation cases in one PR because routing text without coverage, or coverage for an absent route, is an incoherent checkpoint. Reconcile `progress.md` after verification. No separate implementation prompts or PRs are justified by current evidence.

The rollback boundary is that one skill-and-suite PR: revert its core, reference, and evaluation changes together, then reconcile progress. No accepted design artifact or product runtime state is modified by `UI-1`.

The new reference has a real consumer: common-design authoring requested by the Owner. A routine UI task can skip it. Core remains sufficient to choose the source, authority, stop behavior, and reference without first loading the reference. If this split fails that test, revise the split before implementation rather than adding another resource.

## Acceptance and verification for the implementation PR

| Acceptance behavior | Required evidence |
| --- | --- |
| A routine LE or TA task with accepted design sources finds and reuses the relevant source instead of inventing a new palette or treating current CSS as approval. | Source-route inspection plus affected fresh-reader evaluation; the authoring reference remains unselected. |
| An explicit Owner request to create or revise common design selects the conditional reference, produces an identifiable candidate, and leaves material acceptance with the Owner. | Positive routing evaluation and a fresh-reader observation of the owner/approval boundary. |
| LE and TA both permit medium-to-high expression with their distinct learning and authoring emphasis, while preserving reduced motion, accessibility, current route/permission contracts, and truthful data. | Direct LE/TA regression evaluation and existing motion/safety cases. |
| With no accepted design artifact, a focused repair or implementation with a clear local pattern proceeds by preserving established UI; a task requiring a new material design decision proposes the smallest candidate and pauses dependent implementation until Owner acceptance. | Missing-artifact decision near miss with both branches, plus source/stop-rule inspection. The absent artifact alone is not a veto. |
| A task suggesting shadcn Tooltip discovers a suitable local component/composition before considering the registry; only an actual local gap can lead to a specific proposal, and CLI/install waits for explicit Owner approval. | One new regression near miss using the existing Tooltip source and usage, plus core-rule inspection. Synthetic no-tool evidence proves the stated decision, not actual search execution. |
| Existing Client/Marketing, Admin, shared-component, and `frontend-workflow` routing stays intact. | Existing affected suite cases and diff review; no unsupported native auto-trigger claim. |

Run `node .agents/scripts/validate-skill.mjs` and `node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design` for deterministic structure after implementation. Reuse CI's `validate --all` result only when it runs on the exact PR head. Freeze a small affected routing/regression/fresh-reader case set and claim limits before any separately authorized model or fresh-reader execution. Structural validation, a synthetic prepared package, or the author's self-review cannot substitute for semantic observation. Report `not_run` or incomplete evidence honestly; do not mark `UI-1` complete if required behavioral evidence remains absent or fails. No product tests or browser QA are required for a skill-only change unless the implementation expands into product UI, which would require a revised scope and Owner decision.

Because no accepted product design artifact exists yet, an evaluation case may supply a clearly identified hypothetical accepted source as bounded context. Such a case tests the routing and reuse decision, not real repository discovery of a live accepted artifact; `UI-2` must exercise the actual index and artifact path once those sources exist.

## Risks and stop conditions

- **Unapproved content becomes a standard:** core must route only to accepted design artifacts; an absent index today is not permission to invent one or infer acceptance from plan/progress.
- **Conditional guidance becomes always-on:** keep authority and route in core, with the authoring procedure behind an exact Owner-request condition; verify positive and near-miss cases.
- **Higher latitude overrides usability:** retain feedback, focus, reduced motion, keyboard/mobile, direct edit, and established permission/route constraints.
- **Evaluation overclaim:** suite definitions and structural checks are not semantic pass evidence. Preserve raw observations outside the committed PR and keep fresh-reader independence and actual access limits explicit.
- **Scope drift:** if correct source discovery requires a new `AGENTS.md` activation rule, product design artifact, component change, runner change, or live service, stop and return to the owning plan/Owner instead of broadening `UI-1`.

## Planning checkpoint review

The initial planning checkpoint changed this detail plan and the owning progress source; this correction changes only the detail plan because program status is unchanged. Verify the branch/base, links, source paths, scope against the Master Plan, current Git diff, and `git diff --check`; apply `docs/agent-self-review.md` plus the planning-specific ownership, dependency, exclusion, acceptance, and authority checks. Product tests, browser QA, and live skill evaluation are not run for this planning-only checkpoint.

Planning self-review status: **PASS (author review only)**. The candidate preserves Master Plan ownership and dependency, separates routine reuse from conditional authoring, keeps future visual values and implementation outside `UI-1`, and has no unresolved decision in this plan correction. This result is not independent review or Owner approval of the detail plan; the later implementation and behavioral-evidence gates remain open.
