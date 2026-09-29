# UI-3 Detail Plan: Shared Button Contract

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Checkpoint 1 complete — Button contract accepted and published; Checkpoint 2 not authorized` |
| Accepted contract identity | `BUTTON-CONTRACT-CANDIDATE-1`; Owner-accepted through `BUTTON-ACCEPT`, pre-publication SHA-256 `B30406CCA97AC4B5537D71986F0889B0A0E0FFF8ED0C4FD9E913B96D6CDC8D3F`, on 2026-09-29 |
| Program owner | [UI Design System and Rendered UI Review Master Plan](../../plan.md), workstream `UI-3` |
| Accepted design inputs | [Product Language](../../product-language.md), [Learning Experience](../../screen-types/learning-experience.md), and [Teacher Authoring](../../screen-types/teacher-authoring.md) |
| Planning baseline | `main` and `origin/main` at `2c446d08fad87d2b951ff4f874a9543fad3caf37`, the PR #106 merge commit |
| Planning branch | `feat/ui-3-button-contract` |
| Execution mode | `NORMAL` — one coherent shared-component outcome with one semantic owner; no managed workflow or delegated role is justified |
| Final size | `Large/high-risk` for later implementation because a global primitive has broad cross-surface consumers and material geometry decisions, despite one coherent outcome |
| Current authority | Accepted Button contract publication and planning/progress reconciliation only. No production runtime, token, consumer, product-test, commit, push, PR, merge, UI-4, or UI-5 authority. |

This plan records the UI-3 lifecycle but is not itself the accepted component source. The Owner inspected the ephemeral rendered comparison, accepted the reconciled contract through `BUTTON-ACCEPT`, and selected the ordinary Control rounded rectangle `r12` instead of circle geometry for fine-pointer icon-only hover. The durable authority is now [Button](../../components/button.md). This publication does not authorize production implementation, and the accepted-source index routes only to the accepted contract rather than this plan or its review aid.

## Accepted Button Spec record

### Outcome and acceptance

UI-3 establishes one reusable Button contract that maps the accepted Product Language action hierarchy into a small, explicit runtime vocabulary without taking ownership of route composition.

The outcome is accepted only when:

1. an Owner-accepted Button contract defines semantic emphasis, geometry, interaction states, icon behavior, accessibility, motion, and usage constraints;
2. emphasis and geometry remain separate axes;
3. the contract preserves LE and TA specializations without creating LE-only or TA-only Button variants;
4. runtime implementation maps the accepted roles into the shared component without silently changing unrelated components or product behavior;
5. affected shared consumers and representative LE/TA uses are audited and focused verification passes; and
6. implementation, browser evidence, Git actions, and UI-4/UI-5 remain separately authorized and truthfully reported.

### Inherited binding decisions from UI-2

UI-3 implements these decisions; it does not reopen them:

- The preferred local CTA hierarchy is one Action Blue `#2B6CED` filled primary action plus one subordinate Route Blue `#2563EB` text action. An outlined secondary is allowed only when a real competing action needs stronger affordance.
- Ordinary controls use the Control `12px` rounded-rectangle intent. A primary action is not a capsule.
- Geometry and emphasis are independent. A small role-based set must not multiply every shape and emphasis combination into variants.
- Full-width or stretch behavior is surface/layout composition. Button only guarantees that stretch composition remains safe.
- Route Blue owns current/selected/focus semantics; Action Blue owns the filled primary CTA. Success, warning, and progress colors do not become generic action colors.
- Hover is perceptible and position-stable. Focus is visible and separated from the component boundary. Pressed response must not cause layout shift. Reduced motion preserves the same meaning and action.
- Pending state keeps geometry stable, exposes progress, prevents repeat action, and uses a progressive verb. Disabled state remains legible and has a nearby reason when the block is not obvious.
- LE creates no Button geometry or color variant. It requires repeated actions to remain comfortable, stable, and free of motion delay; that experience requirement does not by itself imply a distinct height.
- TA creates no Button geometry or color variant. It requires compact labeled local controls where useful and at least `44 × 44px` touch targets for critical actions at narrow widths.
- Icon-only controls require a complete accessible name. Color, icon, hover, or tooltip alone cannot name an action.

### Proposed Button emphasis roles

The accepted contract exposes this small set. Runtime prop names may preserve current aliases when compatibility requires it, but the semantic roles and visual outcomes are binding.

| Semantic role | Proposed runtime mapping | Required treatment | Explicit exclusion |
| --- | --- | --- | --- |
| Primary | current `default` may remain the compatibility name | Action Blue fill, white action label, one dominant action per local decision area | Not success-green, progress-cyan, or Route Blue filled by default |
| Strong secondary | `outline` | Neutral light surface, readable ink, standard boundary; Route Blue may appear in text/focus, not as an equal filled CTA | Not the default companion when a text action is sufficient |
| Quiet/local | `ghost` | No resting fill; restrained hover surface; used near the object it affects when that call site is genuinely local/contextual | Not a blanket mapping for every action named Edit, nor a substitute for an inaccessible icon-only action |
| Subordinate text | `link` or a compatibility-preserving text role | Route Blue label, intrinsic width, clear focus, underline or equivalent text affordance | Not a global full-width action |
| Destructive confirmation | `destructive` | Strong Correction Red confirmation treatment only where consequence is explicit | Not for ordinary removal entry points |
| Quiet destructive entry | proposed `destructive-quiet` | Quiet red text/tint for a contextual entry into a destructive flow, leading to an explicit confirmation when required | Not a blanket mapping for every action named Delete and not a success/error status indicator |

The current neutral filled `secondary` variant has no discovered application consumer. It is not an accepted product action role. Later implementation may remove it, retain it as a temporary compatibility alias, or map a demonstrated non-product consumer, but it must not become a competing product CTA without a new accepted decision.

No general `success`, `warning`, `pill`, `fullWidth`, or selected/tab Button variant is proposed:

- confirmed success belongs to result/state presentation; the legal next action normally remains Action Blue;
- warning belongs to attention context, not an amber generic action;
- pills remain status/filter/avatar/progress geometry, with bounded existing icon/carousel uses handled locally;
- width remains composition-owned; and
- mutually exclusive selection belongs to Tabs, Toggle, choice-group, or surface semantics rather than a generic CTA variant.

### Accepted geometry

The Owner accepted the role names, exact values, radii, padding, icon dimensions, gaps, and compatibility intent after inspecting the rendered comparison. Concrete runtime prop aliases and migration mechanics remain CP2 implementation hypotheses.

| Geometry role | Labeled control | Icon-only counterpart | Intended use | Guardrail |
| --- | --- | --- | --- | --- |
| Nested extra-small | `24px` high, `8px` radius, `8px` horizontal padding, `14px` icon | `24 × 24px` | Restricted composite control such as a calendar cell helper or tightly bounded input group where the parent owns context | Explicit exception to the ordinary `12px` Control radius; not a standalone LE/TA action; must preserve minimum-target spacing and a complete accessible name |
| Compact | `32px` high, `12px` radius, `12px` horizontal padding, `16px` icon | `32 × 32px` | Dense desktop/local actions close to their object | Must not be the only critical touch action on narrow/coarse-pointer layouts |
| Standard | `36px` high, `12px` radius, `14px` horizontal padding, `18px` icon | `36 × 36px` | Ordinary product action and shared default, including repeated actions unless the surface proves a larger target need | Surface must select Comfortable when its explicit narrow/touch target contract requires `44px` |
| Comfortable | `44px` high, `12px` radius, `20px` horizontal padding, `20px` icon | `44 × 44px` | Explicit larger/touch-heavy target required by an owning surface | Does not follow merely from repetition, dominance, full width, or heavier display typography |

All labeled roles use the accepted action role `14/20`, weight `600`, unless a screen-owned learning object is not actually a Button. Long Vietnamese labels may wrap only when the surface deliberately allows a multiline action; default product buttons keep a stable one-line label and must not clip it.

Proposed compatibility mapping:

```text
xs / icon-xs   → Nested extra-small (restricted role)
sm / icon-sm   → Compact
default / icon → Standard
lg / icon-lg   → Comfortable
```

The current runtime `default` is `32px`; the accepted contract makes `36px` the semantic default, retains repeated actions at Standard unless a surface explicitly requires Comfortable, and directs genuinely dense consumers toward Compact rather than another permanent legacy size. Exact alias preservation and consumer migration remain CP2 implementation decisions and are not authorized by acceptance.

### State semantics and accepted interaction treatment

| State | Accepted shared obligation | Consumer-owned composition or implementation hypothesis |
| --- | --- | --- |
| Default | Treatment matches the chosen semantic role; label remains legible and geometry stable | Dimensions, padding, icon size, and gap follow the accepted geometry; action count, placement, width, copy, and business availability remain surface-owned |
| Hover | Accepted `120ms` Immediate response is perceptible, restrained, and position-stable | Exact theme-token/CSS wiring remains an implementation hypothesis; fine-pointer icon-only hover uses Control rounded rectangle `r12`, not circle geometry |
| Focus-visible | Native keyboard `:focus-visible` shows a Route Blue ring at least `2px`, visibly separated from the boundary, and retains it while keyboard focus remains; native focus order is preserved | Pointer focus need not show the same ring. The aid uses white separation plus a `2px` Route Blue outer ring; its forced specimen is illustrative only, while the live lab demonstrates keyboard versus pointer behavior. Focus destination after route/dialog/state transitions remains consumer-owned |
| Active/pressed | Response is perceptible without layout shift | Use tone and/or inset response without translation; exact theme-token/CSS wiring remains an implementation hypothesis |
| Disabled | Native `disabled` where a native button is used; readable reduced emphasis; no pointer activation | Exact opacity wiring remains an implementation hypothesis; the reason and whether the action should instead be absent remain consumer-owned |
| Pending/loading | Same geometry, unavailable to repeat, visible progress, progressive verb, `aria-busy` when appropriate | Spinner size/gap are hypotheses; async state, exact verb, result announcement, retry, and persistence truth remain consumer-owned |
| Invalid/error-related | Focus remains Route Blue; Correction Red supplements the affected context rather than replacing focus | Field/action error association and recovery message remain consumer-owned |
| Reduced motion | Remove transform; expose the same meaning and settled action immediately or through the accepted short opacity/color response | No user-facing motion setting is created; the aid toggle is review-only |

Implementation should transition only the properties the contract uses, not `transition-all`. A shared `loading` prop is not required by this Spec. It may be proposed later only if implementation discovery proves that a behavior-only contract cannot keep pending semantics consistent without duplicating unsafe wiring.

### Icon and label behavior

- Lucide remains the interface icon source. The Button contract owns consistent icon size, gap, and inline placement for each accepted geometry role: `14/16/18/20px` icons and `4/6/8/8px` gaps across Nested extra-small, Compact, Standard, and Comfortable.
- Icon plus label uses explicit start/end placement metadata or an equivalent shared mechanism; consumers must not need repeated margin utilities for ordinary spacing.
- Decorative icons and spinners are `aria-hidden`; the Button label or an explicit accessible name carries the action.
- Icon-only Button requires `aria-label` or equivalent screen-reader text at the usage site. Tooltip may explain but does not replace the accessible name.
- A spinner does not replace the progressive verb when the action result matters. Loading width must not jump enough to disturb adjacent action layout.
- `asChild` remains supported for link-like composition. The child retains correct link semantics; native `disabled` must not be forwarded as though an anchor supported it.

### Composition boundary

UI-3 Button owns reusable roles, geometry, state visuals, semantic attributes it can safely forward, and compatibility constraints. It does not own:

- whether a concrete LE/TA action is primary, secondary, full-width, sticky, or placed beside another action;
- route layout, mobile stacking, dialog footer order, learning response flow, authoring workflow, copy, permission, or async business state;
- Tabs/Toggle/choice-group behavior or selected-state composition;
- a universal migration of every native `<button>` merely because it exists; or
- UI-4 surface specifications and UI-5 rendered product review.

Surface code may use `className` for width, alignment, responsive order, and a proven local exception. It must not redefine accepted Button color, radius, height, focus, or motion merely to restyle the shared role.

### Necessary execution guardrails

1. **Broad-consumer guardrail:** before changing a default, implementation must regenerate the Button consumer inventory and inspect shared primitives plus representative LE and TA flows. Omitting this can silently break compact controls, dialogs, calendars, or narrow layouts.
2. **Semantic-token guardrail:** Action Blue and Route Blue must remain theme-addressable and must not be embedded as feature-owned literals. Omitting this would make the accepted light reference structurally hostile to future theme work.
3. **No global-token collateral guardrail:** implementation must not repurpose global `--primary` or `--ring` without proving every consumer of those tokens accepts the new meaning. Omitting this can change Tabs, calendars, inputs, and unrelated primitives outside Button scope.
4. **Accessibility guardrail:** direct Button migrations must preserve native semantics, complete names, keyboard focus, disabled/pending truth, and at least the accepted narrow touch target. Omitting this would standardize appearance while retaining known usability defects.
5. **Compatibility guardrail:** the runtime change must either preserve current prop aliases or migrate every affected consumer in the same authorized checkpoint. A partial breaking rename is not acceptable.
6. **Scope guardrail:** Tabs and consuming primitives are regression surfaces only. A material change to their independent contract requires a separately reviewed UI-3 candidate.
7. **Evidence guardrail:** source inspection and component tests cannot claim geometry or interaction quality. Exact geometry, focus, hover, pressed, pending, long-label, and reduced-motion behavior needs focused rendered evidence before runtime completion.

## Discovery findings

### Shared implementation and ownership

- `components/ui/button.tsx` is a local shadcn `radix-nova` recipe, confirmed by `components.json`. It uses CVA for local variants and `Slot.Root` from `radix-ui` only for `asChild` composition.
- Radix does not own a Button state machine here. The normal control is a native `<button>`; local repository code owns variants, dimensions, colors, focus, active, disabled, invalid, and icon rules.
- Current variants are `default`, `outline`, `secondary`, `ghost`, `destructive`, and `link`.
- Current labeled heights are `24`, `28`, `32`, and `36px`; icon sizes mirror them. The base radius is `rounded-lg`, currently derived from `--radius: 0.625rem`.
- Current base states include variant-specific hover, a `3px` ring plus border focus treatment, global `1px` active translation except popup triggers, `disabled:pointer-events-none`, `disabled:opacity-50`, `aria-invalid`, and `transition-all`.
- There is no shared loading API, no explicit `aria-busy` behavior, no selected/toggle contract, and no reduced-motion rule in Button.

### Deterministic usage audit

The AST audit scanned `266` TypeScript/TSX files under `app`, `components`, and `__tests__`:

| Evidence | Count |
| --- | ---: |
| Shared `<Button>` instances | `217` in `60` files |
| Teacher | `133` |
| Learner | `35` |
| Shared UI primitives | `16` |
| Public course | `14` |
| Other client | `12` |
| Admin | `7` |
| Native `<button>` instances | `46` in `25` files |

Shared usage by literal/default emphasis is led by `outline` (`77`), current default (`68`), and `ghost` (`57`). Geometry is mostly implicit default (`134`), followed by `sm` (`33`), `icon` (`27`), and `lg` (`12`).

Local overrides are not edge noise:

| Override signal | Shared Button instances |
| --- | ---: |
| Explicit height/size | `107` |
| Color/boundary role | `114` |
| Radius | `95` |
| Padding | `80` |
| Width | `43` |
| Motion/active behavior | `21` |

Learner uses concentrate around `44–48px` minimum heights and `12–16px` radii for repeated actions. Teacher uses a much wider `24–56px` range, with both `8px` and `12px` radii and many compact icon controls. This supports a role-based geometry set; it does not support one enlarged global size without call-site classification.

Only one discovered icon-plus-label use supplies the shared recipe's `data-icon` placement metadata. Loading is composed ad hoc with disabled state, changing verbs, and spinners. A source-level screen identified several Teacher icon-only actions with no direct `aria-label` or visible/screen-reader text; wrappers such as Dialog and Sheet do provide `sr-only` names, so each call site must be assessed rather than bulk-labelled defective.

### Notable duplicated/local patterns

- LE practice controls in `FlashcardStage.tsx` and `LearningWorkspace.tsx` build large rounded, colored, full-width or responsive actions through local classes. Several encode learning response states that must remain surface-owned rather than become generic Button variants.
- TA authoring files such as `ExerciseTab.tsx`, `AddExerciseDialog.tsx`, `TopicManagementSheet.tsx`, and `SettingsTab.tsx` repeatedly recreate compact icon actions, `44–48px` save actions, destructive color treatments, icon spacing, and pending spinners.
- Public payment and Admin surfaces contain native button systems with their own geometry and dark-theme direction. They are evidence of fragmentation but are outside this first LE/TA Button migration unless shared runtime changes directly affect them or a correctness issue is required for compatibility.
- Dialog, Sheet, Calendar, Carousel, Sidebar, InputGroup, and ConfirmDialog consume shared Button. They require regression inspection but do not justify separate component contracts in this candidate.

### Tests, stories, and review surfaces

- No Storybook configuration, Button story, or Button-specific component-contract test was found.
- Component tests already exercise accessible names, disabled states, pending behavior, review actions, retry actions, and button-driven LE/TA interactions in files such as `learning-workspace.test.tsx`, `review-sheet.test.tsx`, `topic-management-navigation.test.tsx`, and `topic-workflow-panel.test.tsx`.
- Existing smoke E2E covers learning workspace, enrolled-course overview, course structure, and exercise authoring. These prove product behavior only for the scenarios they run; they do not prove the new shared geometry.
- A focused non-authoritative rendered Button matrix is justified for the Owner's exact geometry/interaction decision and later implementation evidence. It should not become Storybook, a permanent product route, or a substitute for UI-5.

## Binding ownership split

| Decision | Owner |
| --- | --- |
| Product identity, colors, action hierarchy, radius intent, motion roles | Accepted Product Language |
| LE learning focus, repeated-action priority, feedback and narrow composition constraints | Accepted Learning Experience |
| TA local/primary/destructive hierarchy, dense-authoring and narrow touch constraints | Accepted Teacher Authoring |
| Exact Button emphasis roles, dimensions, shared states, icon rules, accessibility and usage constraints | UI-3 Button contract after Owner acceptance |
| Which role a route uses, placement, width, stacking, sticky behavior, copy and business state | UI-4 or later owning surface/runtime work |
| Concrete files, helper names, token identifiers, CVA arrangement and migration sequence | Later implementation discovery within this Spec's guardrails |

## Owner dispositions recorded by BUTTON-ACCEPT

1. **Geometry:** accepted `24 restricted / 32 compact / 36 standard / 44 comfortable-on-explicit-surface-need`, with the `8px` radius restricted to Nested extra-small and ordinary controls using `12px`.
2. **Default rollout:** accepted Standard `36px` as the semantic default; repeated actions remain Standard unless the surface proves a Comfortable need, and genuinely dense consumers select Compact explicitly.
3. **Destructive presentation:** accepted quiet destructive entry versus strong destructive confirmation as contextual roles. Dialog shell, object identity, consequence copy, cancel placement, action order, and confirmation flow remain surface-owned.
4. **Icon/gap/interaction treatment:** accepted the `14/16/18/20px` icon and `4/6/8/8px` gap ladder, keyboard focus-visible behavior, no-translation pressed treatment, disabled/pending stability, reduced-motion equivalence, capability-responsive affordance, and Control rounded rectangle `r12` for fine-pointer icon-only hover. Circle hover geometry is excluded.

These Owner-controlled decisions became binding only through `BUTTON-ACCEPT`. Repository inspection, Jev advice, and rendered correctness checks supplied evidence but did not grant acceptance.

## Component-scope audit

### Included

- Button contract and its direct semantic token/API/test/compatibility needs.
- Regression inspection of shared primitives that consume Button.
- Focused LE/TA call-site migration only where the accepted Button contract or a direct accessibility/correctness constraint requires it.
- One bounded, non-authoritative decision aid and later focused browser evidence if the Owner accepts that review route.

### Deferred, not required for this Button candidate

- **Tabs:** accepted Product Language gives Tabs an exact icon-plus-label and bottom-indicator grammar, and the repository has a shared Radix-backed Tabs primitive with one TA and one Admin consumer. That demonstrates a future UI-3 candidate, but Tabs is not a Button dependency and does not belong in this first contract.
- **Toggle/choice controls:** several native buttons use `aria-pressed`; their selected/correctness semantics remain with the owning choice or toggle contract.
- **Dialog/Sheet/Calendar/Carousel/Sidebar/InputGroup:** consumers and regression surfaces only unless implementation evidence reveals a genuine independent contract conflict.
- **Admin and public payment button systems:** separate product/surface direction; not migrated wholesale by this LE/TA-first contract.

No other component is required in the same UI-3 execution boundary. Adding one would widen semantic ownership and verification without a failure mode that blocks the Button outcome.

## Bounded implementation hypotheses

These paths and mechanisms are likely, not binding. Implementation may replace them with evidenced equivalents while preserving the Spec and guardrails.

| Hypothesis | Boundary |
| --- | --- |
| Publish the accepted contract at `docs/ui-design-system-and-review/components/button.md` and add it to `index.md` only after exact Owner acceptance | File name may change only if repository convention changes; accepted-source ownership must remain singular and discoverable |
| Update `components/ui/button.tsx` using CVA roles and compatibility aliases | CVA arrangement and prop names may change; semantic roles, geometry and state outcomes may not |
| Add theme-addressable Action Blue and Route Blue mappings in `app/globals.css` without repurposing unrelated global tokens | Exact token names are not binding; theme addressability and no collateral token change are |
| Add `__tests__/components/button.test.tsx` for semantics, aliases, accessible composition, disabled/pending attributes, and icon metadata | Test location may follow a closer established pattern; observable contract coverage is required |
| Use a temporary/ignored review aid rather than Storybook or a production route | Mechanism may change; it must remain non-authoritative and outside accepted routing/product bundles |
| Migrate affected call sites identified by a fresh AST audit, starting with shared primitives and representative LE/TA consumers | Exact file list is discovered at implementation time; no unrelated restyling or UI-4 composition change |

Likely direct evidence files include:

- `components/ui/button.tsx`
- `components.json`
- `app/globals.css`
- `components/ui/dialog.tsx`
- `components/ui/sheet.tsx`
- `components/ui/calendar.tsx`
- `components/ui/carousel.tsx`
- `components/ui/sidebar.tsx`
- `components/ui/input-group.tsx`
- `components/ui/confirm-dialog.tsx`
- `app/(client)/learn/[course-slug]/[topic-slug]/_components/FlashcardStage.tsx`
- `app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx`
- `app/(client)/learn/_components/ReviewSheet.tsx`
- `app/(teacher)/teacher/courses/[id]/_components/TopicManagementSheet.tsx`
- `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx`
- `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx`
- `__tests__/components/learning-workspace.test.tsx`
- `__tests__/components/review-sheet.test.tsx`
- `__tests__/components/topic-management-navigation.test.tsx`
- `__tests__/components/topic-workflow-panel.test.tsx`
- `e2e/smoke/learning-workspace.smoke.spec.ts`
- `e2e/smoke/course-structure.smoke.spec.ts`
- `e2e/smoke/exercise-authoring.smoke.spec.ts`

This list does not authorize edits and must not be treated as the final migration set.

## Dependency graph

```text
Accepted Product Language + LE + TA
→ deterministic Button usage and consumer audit
→ semantic/boundary candidate + ephemeral rendered visual hypotheses
→ Owner visual disposition of geometry/mapping/presentation
→ Owner disposition of exact UI-3 Button Spec (`BUTTON-ACCEPT` only after inspection)
→ publish accepted component contract
→ separately authorized runtime/token/API mapping
→ affected consumer migration + component/product tests
→ focused rendered component evidence
→ UI-3 closure
→ UI-4/UI-5 only when their chosen pilot consumes the changed contract
```

Hard dependencies are the accepted UI-2 sources, exact Owner disposition, and a fresh consumer audit before runtime changes. UI-4 and UI-5 do not block UI-3 planning, and UI-3 does not block a surface that does not consume its changed contract.

## Execution hierarchy — two Checkpoints, no Stage

A Stage is not justified: the two Checkpoints are sequential acceptance/implementation boundaries, but they do not form a separately publishable group that gates another internal Stage. Atomic actions remain Steps.

### Checkpoint 1 — Button contract acceptance and publication

**Outcome:** one exact Owner-accepted Button contract becomes the durable shared-component authority.

Steps:

1. Complete deterministic discovery and reconcile UI-2 ownership. `Completed` for this candidate.
2. Preserve the well-supported semantic roles, ownership split, accessibility obligations, and UI-3/UI-4 boundary in `UI3-BUTTON-SPEC-CANDIDATE-3`. `Completed for review`.
3. Build and verify one focused non-authoritative rendered matrix for the four visual decision clusters, then revise it from Owner feedback without promoting any visual hypothesis. `Completed; revised ephemeral aid outside the repository`.
4. Owner inspects the rendered aid and accepts, revises, or rejects each visual hypothesis. `Completed`.
5. Reconcile the exact disposition into the candidate and obtain explicit `BUTTON-ACCEPT`. `Completed; final icon-only hover surface is Control rounded rectangle r12, not circle geometry`.
6. Freeze and record the exact Owner acceptance identity. `Completed; BUTTON-CONTRACT-CANDIDATE-1, pre-publication SHA-256 B30406CCA97AC4B5537D71986F0889B0A0E0FFF8ED0C4FD9E913B96D6CDC8D3F`.
7. Publish the accepted contract under the component owner and route the accepted-only index to it; update progress truth. `Completed`.

Checkpoint acceptance:

- exact Owner acceptance is tied to an identifiable candidate;
- inherited UI-2 values are referenced, not duplicated or changed;
- semantic roles, geometry, states, icon/accessibility, motion, width and surface boundaries are explicit;
- no runtime, UI-4, UI-5, or remote action is claimed; and
- the accepted-only index exposes only the accepted contract, never this candidate plan or review aid.

### Checkpoint 2 — Runtime mapping, focused migration, and evidence

**Outcome:** later-authorized shared runtime and directly affected consumers conform to the accepted Button contract without unrelated surface redesign.

Steps:

1. Re-audit exact consumers and classify them by accepted role and geometry.
2. Implement the smallest theme-addressable Button/token API that preserves compatibility or migrates every affected use coherently.
3. Correct direct accessibility/compatibility issues exposed by the migration; report unrelated local button debt separately.
4. Add focused component-contract tests and update directly affected product tests.
5. Run targeted TypeScript/lint/Vitest checks, then broader checks only because the shared primitive is cross-cutting and the observed diff justifies them.
6. Render the focused state/geometry matrix and inspect keyboard focus, hover, pressed, disabled, pending, long-label, intrinsic/stretch, narrow/coarse-pointer, and reduced-motion behavior.
7. Apply implementation self-review and report remaining call-site debt and UI-4/UI-5 boundaries.

Checkpoint acceptance:

- runtime roles and dimensions match the accepted contract;
- existing aliases are safe or all affected consumers are migrated in the same authorized checkpoint;
- no `transition-all` or uncontrolled motion remains in the shared Button contract;
- shared consumer primitives remain functional;
- direct icon-only actions touched by the migration have complete accessible names;
- focused automated checks pass and rendered evidence is recorded with unobserved states explicit; and
- no surface-specific composition, route behavior, permission, DB, analytics, UI-4, or UI-5 work is included.

Checkpoint 2 has no current implementation authority.

## Verification strategy

### Candidate planning and visual-review checkpoint

- verify branch/head and tracked-program sources deterministically;
- verify links and candidate paths;
- inspect only the planning-doc diff;
- run `git diff --check`;
- apply the shared plan self-review methodology; and
- use Jev only for bounded advisory judgments, then reconcile against repository evidence;
- render the ephemeral aid at desktop and narrow widths;
- verify actual `24/32/36/44px` dimensions, accessible names, retained keyboard `:focus-visible` versus pointer focus, interaction toggle behavior, reduced-motion behavior, and page overflow; and
- inspect screenshots for the exact Owner decision clusters without claiming production conformance.

Product tests are `not run` because production runtime is unchanged. Focused browser verification applies only to the ephemeral review aid and cannot establish product compatibility or Button runtime conformance.

### Later authorized runtime checkpoint

Minimum expected commands, subject to the actual diff and current scripts:

```text
npm run test:run -- __tests__/components/button.test.tsx
npm run test:run -- <directly affected LE/TA component tests>
npx eslint <changed TS/TSX files>
npx tsc --noEmit
git diff --check
```

Because Button is cross-cutting, a broader component suite or build may become justified after the actual consumer diff is known. Existing smoke E2E is selected only for flows whose rendered/interaction contract was directly changed; it is not automatic proof of Button geometry.

The focused rendered matrix requires no authenticated or database fixture. Product-flow E2E keeps its existing fixture readiness requirements and cannot be replaced by the matrix.

## Ephemeral review aid and browser evidence

One bounded aid is justified because exact geometry, focus separation, hover/pressed restraint, icon alignment, pending width stability, long Vietnamese labels, and reduced-motion equivalence are not reliably judgeable from class strings or prose.

The completed aid:

- render only the proposed Button roles and sizes against the accepted light reference;
- compare `24/32/36/44px` geometry, current/candidate mapping, and intrinsic/stretch composition;
- include icon-only, icon-start, icon-end, long label, disabled, pending, and destructive cases;
- include one explicitly surface-owned mobile Teacher composition showing main content followed by a stacked `44px` primary and `44px` outlined strong-secondary touch target;
- include one responsive experiment that compares circle versus Control-radius hover surfaces when the primary input supports hover and a fine pointer, uses `Subordinate text` for the second fine-pointer action, and retains visible `44 × 44px` bordered controls when touch/coarse input is primary;
- expose keyboard focus and default/reduced motion;
- use no production route, auth, DB fixture, new package, Storybook installation, or new shared component; and
- remains outside the repository under the task-local visualization directory and is not indexed as an accepted source.

It uses decision-first sections, side-by-side current/candidate mapping, a labelled state strip plus one live control, one neutral `375px` narrow target frame, one explicitly non-binding mobile Teacher context, and one responsive input-capability experiment added after Owner feedback. The responsive specimen now gates quiet icon-only and `Subordinate text` treatment only on `(hover: hover) and (pointer: fine)`, independent of viewport width; touch/coarse-primary input keeps the visible-control fallback with `44px` bordered actions. A separate `700px` layout threshold controls horizontal versus stacked composition without changing the treatment. These additions illustrate why a `44px` touch target may fit after main content and how input capability may change affordance without proposing an accepted route composition or shared contract.

Focused browser evidence currently establishes only the aid itself:

- actual labelled/icon dimensions render at `24/32/36/44px`, with `8px` radius restricted to Nested extra-small and `12px` on Compact, Standard, and Comfortable;
- `1600px`, `1024px`, `768px`, `390px`, `375px`, and `320px` viewports have no horizontal page overflow; the long-label stretch specimen is not clipped at `375px` or `320px`;
- a DOM name-source check found `0` unnamed controls among `52` rendered buttons, and the browser accessibility snapshot exposed named buttons for the inspected matrix;
- keyboard Tab focus produces and retains a white `2px` separation plus Route Blue `2px` outer ring while focus remains;
- pointer focus activates the live control without forcing the same focus-visible ring;
- the review-only reduced-motion toggle reduces transition duration to `0.01ms`;
- the neutral narrow critical action remains `44px` high;
- the mobile context example keeps both stacked primary/outlined-secondary actions at `44px`, no page overflow at `375px` or `320px`, and explicitly labels its content/layout/role selection as surface-owned and non-accepted; and
- fine-pointer desktop/laptop sessions at `1600px`, `1024px`, and `768px` retain the `36px` primary plus `Subordinate text` treatment and expose the two quiet icon-only shape hypotheses regardless of viewport width;
- touch-primary tablet sessions at the same `1024px` and `768px` widths hide the fine-pointer-only shape hypotheses and retain visible white/bordered `44px` primary, outlined-secondary, and icon targets; both tablet and laptop compose horizontally from `700px` without conflating layout width with input treatment; and
- touch-primary mobile sessions at `390px` and `320px` retain stacked `44px` actions with no horizontal overflow. Keyboard focus-visible remains a separate obligation; the Owner selected Control rounded rectangle `r12` and excluded circle hover geometry.

This is a component decision aid, not UI-5 rendered product review. It does not establish production compatibility, exact font loading across environments, runtime API behavior, or product-flow acceptance. Those remain CP2 evidence after separate authority.

## Risks, stop, recovery, and rollback

| Risk | Earliest exposure | Mitigation / stop rule |
| --- | --- | --- |
| Enlarged default breaks dense controls or wrapping | Consumer audit and matrix | Stop runtime work until affected uses are classified; use explicit Compact only where its role is valid |
| Global token change restyles unrelated primitives | Token diff | Do not repurpose broad tokens without a complete consumer proof; prefer Button-scoped semantic mapping |
| Local overrides continue to erase the contract | Migration diff | Remove only overrides that compete with accepted Button roles; retain width/order/layout composition |
| `asChild` produces invalid disabled link semantics | Component tests and consumer audit | Preserve correct child semantics; keep availability with the owning surface |
| Loading abstraction invents async behavior | API proposal | Keep pending as a behavior contract unless deterministic implementation evidence proves a shared prop is necessary |
| Compact icon controls remain unnamed | Source/component review | Correct direct affected cases and record unrelated debt; do not claim repository-wide accessibility closure |
| Button work expands into Tabs or UI-4 | Scope review | Stop and create a separate candidate or Owner gate |
| Browser matrix becomes a second design source | Review/publication | Keep it non-authoritative, unindexed, and temporary; accepted Markdown contract remains owner |

Rollback for later implementation is one coherent reversion of the Button runtime/token/test/migration checkpoint. Accepted design documentation is corrected through its own Owner gate; it is not silently rewritten to match a failed implementation.

## TypeSafe/Jev advisory use

A sanitized Jev `jev-1.13.0` batch evaluated independent bounded decisions over the same semantic state:

- Button-only scope: `1.00` probability, confidence `1.00`;
- exclude a general pill variant: `1.00`, confidence `1.00`;
- surface-owned width: `1.00`, confidence `1.00`;
- behavior-only pending/loading contract: `1.00`, confidence `1.00`;
- two Checkpoints without a Stage: `0.83`, confidence `0.78`; and
- focused rendered aid materially useful: Noul `0.88`.

A second sanitized self-review batch tested the current candidate rather than the discovery framing:

- UI-3/UI-4 boundary integrity: Noul `0.96`;
- four-role geometry is coherent but remains a material Owner choice: `0.99`, confidence `0.98`;
- proposed semantic-role scope is bounded: `0.91`, confidence `0.88`;
- two Checkpoints without a Stage remain proportionate: Noul `0.76`; and
- the most plausible independent-review rejection is unresolved geometry/default rollout: `0.50`, with low confidence `0.38` because destructive-role disposition and no remaining material defect were also plausible.

A third sanitized batch selected the smallest useful review-aid structure after the Owner required rendered inspection:

- decision-first sections: `0.99`, confidence `0.98`;
- side-by-side current/candidate mapping: `0.98`, confidence `0.96`;
- labelled simulated states plus one live control: `0.71`, confidence `0.61`; and
- one bounded narrow touch-target context: Noul `0.78`.

A fourth sanitized self-review batch checked the revised candidate and completed aid:

- binding semantics versus visual-hypothesis separation: Noul `0.95`;
- CP1 stops at Owner visual review without implying acceptance/runtime authority: Noul `0.97`;
- requested visual decision coverage is bounded and complete: `0.92`, confidence `0.89`; and
- the strongest remaining risk was uncertain among ordinary Owner preference (`0.39`), binding confusion (`0.32`), and runtime confusion (`0.26`), confidence `0.19`.

Because the last Choice was diffuse, it did not settle the Owner-controlled outcome. The later `BUTTON-ACCEPT` decision—not the advisory result—accepted the reconciled contract. The aid remains non-authoritative and does not establish production compatibility.

A fifth sanitized batch evaluated bounded micro-decisions raised by the Owner's first visual review over the revised semantic state:

- restricted Nested `8px` radius with ordinary `12px` Control radius was preferred over all-`12px`: `0.68`, confidence `0.58`;
- isolated destructive Button specimens were preferred over another mocked surface shell: `0.99`, confidence `0.98`;
- native live keyboard/pointer focus evidence plus a separately labelled forced illustration was preferred: `0.99`, confidence `0.98`; and
- contextual-role wording for Quiet/local and Quiet destructive entry was sufficiently clear: Noul `0.88`.

The moderate radius confidence was not acceptance. The later `BUTTON-ACCEPT` decision accepted the `8px` value only as a restricted nested exception and kept every ordinary geometry at the accepted `12px` Control-radius intent.

A sixth sanitized batch evaluated the input-capability correction requested during Owner review:

- primary-input capability without a viewport-width gate was preferred for Button treatment: `1.00`, confidence `1.00`; and
- separating layout width from interaction treatment was preferred over one coupled media query: `1.00`, confidence `1.00`.

The aid first applied this as a non-binding implementation hypothesis. Deterministic browser sessions at identical tablet/laptop widths established the actual media-query behavior, and the Owner later accepted the capability-based contract direction. Jev did not establish device facts or accept the contract.

These values are advisory. They do not establish repository facts, approve the Spec, authorize actions, or replace Owner review. Main retained the recommendations only where deterministic evidence and the accepted ownership model support them.

## State — current resume projection

```text
Current Spec revision: BUTTON-CONTRACT-CANDIDATE-1 accepted and published through BUTTON-ACCEPT
Current Checkpoint: Checkpoint 1 complete; Checkpoint 2 — Runtime mapping, focused migration, and evidence — not authorized
Status: Accepted Button contract published at docs/ui-design-system-and-review/components/button.md; production runtime has not begun
Completed evidence: latest main/PR #106 baseline verified; Master Plan/progress/UI-2 authorities reconciled; shared Button implementation and deterministic usage/test/review surfaces audited; six bounded Jev batches reconciled; revised fine-pointer/touch-primary aid render, exact geometry/radius, accessible-name, retained keyboard focus-visible versus pointer focus, same-width laptop/tablet differentiation, independent layout breakpoint, interaction, reduced-motion, and overflow checks passed; Owner accepted the reconciled contract and selected Control rounded rectangle r12 for icon-only hover
Accepted bounded deviations: none
Open blockers or Owner decisions: none for Checkpoint 1; Checkpoint 2 requires separate production implementation authority
Next action: stop at the accepted contract publication until the Owner separately authorizes Checkpoint 2
Current authority: accepted contract publication and planning/progress reconciliation only; no production implementation, token, consumer, product-test, commit, push, PR, merge, UI-4, or UI-5
```
