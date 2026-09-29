# Button Shared-Component Contract

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — published as the shared Button contract; not production runtime authority |
| Accepted candidate identity | `BUTTON-CONTRACT-CANDIDATE-1`; Owner-accepted through `BUTTON-ACCEPT`, pre-publication SHA-256 `B30406CCA97AC4B5537D71986F0889B0A0E0FFF8ED0C4FD9E913B96D6CDC8D3F`, on 2026-09-29 |
| Owner gate | `BUTTON-ACCEPT` confirmed after rendered comparison and final `r12` icon-hover disposition |
| Upstream authority | [Accepted Product Language](../product-language.md), [Learning Experience](../screen-types/learning-experience.md), [Teacher Authoring](../screen-types/teacher-authoring.md), and [UI-3 Detail Plan](../implementation-plans/ui-3/plan.md) |
| Scope | Reusable Button semantics, geometry, shared interaction treatment, icon behavior, accessibility, motion, and composition boundaries |
| Excludes | Production runtime implementation, route composition, action copy, permissions, async business state, UI-4 surfaces, UI-5 review, and Git or remote delivery |

This document is the durable shared-component authority. Existing runtime code remains comparison evidence until a separately authorized UI-3 implementation checkpoint proves conformance.

## 1. Inherited product decisions

Button implements these accepted decisions without reopening them:

- A local decision area prefers one Action Blue `#2B6CED` filled primary action and one subordinate Route Blue `#2563EB` text action. An outlined secondary is reserved for a genuinely competing action that needs stronger affordance.
- Ordinary controls use the Control `12px` rounded-rectangle intent. Primary actions are not capsules.
- Emphasis and geometry are independent axes.
- Route Blue owns current, selected, and focus semantics. Action Blue owns the filled primary CTA. Success, warning, and progress colors do not become generic action colors.
- Hover is perceptible and position-stable. Keyboard focus is visible and separated from the component boundary. Pressed response causes no layout shift. Reduced motion preserves meaning and action.
- Pending state keeps geometry stable, exposes progress, prevents repeat action, and uses a progressive verb. Disabled state remains legible and has a nearby reason when the block is not obvious.
- LE and TA do not create separate Button variants. Their repeated-action, dense-authoring, and touch-target requirements select from this shared contract or remain surface composition.

## 2. Semantic emphasis roles

| Role | Required treatment | Guardrail |
| --- | --- | --- |
| Primary | Action Blue fill, white action label, one dominant action per local decision area | Not success-green, progress-cyan, or Route Blue filled by default |
| Strong secondary | Neutral light surface, readable ink, visible standard boundary | Not the default companion when subordinate text is sufficient |
| Quiet/local | No resting fill; restrained contextual hover surface | Used only near the object it affects; not a blanket mapping for every Edit call site |
| Subordinate text | Route Blue label, intrinsic width, clear focus, underline or equivalent text affordance | Not a global full-width action and not suitable when touch-primary context needs a visible target |
| Destructive confirmation | Strong Correction Red treatment after the consequence is explicit | Not an ordinary removal entry point |
| Quiet destructive entry | Quiet red text/tint for contextual entry into a destructive flow | Not a blanket mapping for every Delete call site; leads to explicit confirmation when required |

The destructive split is Button-owned; confirmation container, object identity, consequence copy, action order, and form/dialog composition remain surface-owned.

There is no generic success, warning, pill, full-width, selected, or tab Button role. Status belongs to state presentation, width belongs to composition, and mutually exclusive selection belongs to Tabs, Toggle, choice-group, or the owning surface.

## 3. Geometry

| Geometry role | Labeled control | Icon-only counterpart | Intended use | Guardrail |
| --- | --- | --- | --- | --- |
| Nested extra-small | `24px` high, `8px` radius, `8px` horizontal padding, `14px` icon | `24 × 24px` | Restricted composite control such as a calendar helper or tightly bounded input group | Explicit nested exception; not a standalone LE/TA action or critical touch target |
| Compact | `32px` high, `12px` radius, `12px` horizontal padding, `16px` icon | `32 × 32px` | Dense local actions close to their object | Not the only critical action in a touch-primary context |
| Standard | `36px` high, `12px` radius, `14px` horizontal padding, `18px` icon | `36 × 36px` | Ordinary product action and shared default, including repeated actions unless a larger target is proven necessary | Does not become full-width automatically |
| Comfortable | `44px` high, `12px` radius, `20px` horizontal padding, `20px` icon | `44 × 44px` | Explicit larger or touch-heavy target required by the owning surface | Does not follow merely from repetition, dominance, or display typography |

Labeled roles use the accepted action type role `14/20`, weight `600`, unless the object is not actually a Button. Default labels remain one line and must not clip; multiline action labels require deliberate surface composition.

Compatibility intent for later runtime work:

```text
xs / icon-xs   → Nested extra-small
sm / icon-sm   → Compact
default / icon → Standard
lg / icon-lg   → Comfortable
```

The semantic default is Standard `36px`. A genuinely dense consumer selects Compact explicitly; a touch-heavy consumer selects Comfortable explicitly. Exact prop aliases and migration mechanics remain implementation hypotheses until CP2 discovery.

## 4. Interaction states

| State | Shared obligation |
| --- | --- |
| Default | Treatment matches the semantic role; label remains legible and geometry stable |
| Hover | Immediate response is perceptible, restrained, and position-stable |
| Focus-visible | Native keyboard `:focus-visible` shows a Route Blue ring at least `2px`, visibly separated from the boundary, and retains it while keyboard focus remains |
| Pointer focus | Does not need to show the same ring when `:focus-visible` does not match |
| Active/pressed | Tone and/or inset response without translation or layout shift |
| Disabled | Native `disabled` for a native button, no pointer activation, and readable reduced emphasis |
| Pending/loading | Same geometry, unavailable to repeat, visible progress, progressive verb, and `aria-busy` when appropriate |
| Invalid/error-related | Focus remains Route Blue; Correction Red supplements the affected context rather than replacing focus |
| Reduced motion | No transform; the same meaning and settled action remain available immediately or through the accepted short opacity/color response |

Implementation transitions only the properties the contract uses; `transition-all` is not allowed. The contract does not require a shared `loading` prop. Async state, the exact progressive verb, announcements, retry behavior, persistence truth, and focus destination after route/dialog/state transitions remain consumer-owned.

## 5. Icon and responsive input behavior

- Lucide remains the interface icon source. Ordinary icon dimensions follow the geometry table; icon-plus-label gap is `4px` for Nested extra-small, `6px` for Compact, and `8px` for Standard and Comfortable.
- Icon plus label supports explicit start/end placement or an equivalent shared mechanism; ordinary spacing does not require repeated consumer margin utilities.
- Decorative icons and spinners are `aria-hidden`. Icon-only Button requires `aria-label` or equivalent screen-reader text at the usage site; tooltip alone is insufficient.
- On a primary input that satisfies `(hover: hover) and (pointer: fine)`, a contextual icon-only control may rest as glyph-only. Hover reveals a restrained rounded-rectangle surface using the ordinary Control `12px` radius. Circle hover geometry is not part of the contract.
- When the primary input does not satisfy both hover and fine-pointer capability, a standalone icon-only action retains a visible boundary and an easy-to-hit target. Critical touch-primary actions use at least `44 × 44px`; Nested extra-small remains a restricted composite exception, not a standalone touch action.
- A companion action may use Subordinate text in a mouse/trackpad composition and a visible Strong secondary treatment in a touch-primary composition when the owning surface proves that stronger affordance is needed. This is contextual composition, not a blanket mapping for every secondary action.
- Keyboard focus-visible remains visible regardless of whether a fine-pointer control has a resting boundary.

Input capability selects interaction affordance; viewport or container width independently selects wrapping, stacking, and placement. The `700px` threshold used by the review aid is not part of this contract.

## 6. Composition and accessibility boundary

Button owns reusable emphasis roles, geometry, shared state visuals, accessible primitive behavior, icon rhythm, and compatibility constraints. It does not own:

- which role a concrete LE/TA action uses;
- full width, responsive order, stacking, sticky placement, dialog footer order, or route layout;
- action copy, permissions, availability, async business state, learning response flow, or authoring workflow;
- Tabs, Toggle, choice-group, or selected-state behavior; or
- universal replacement of every native `<button>`.

Surface composition may choose width, alignment, responsive order, and a proven local exception. It must not redefine accepted Button color, radius, height, focus, or motion merely to restyle the shared role.

Every Button remains a semantic native control unless correct link composition is required. `asChild`-style composition must preserve the child's valid semantics; native `disabled` is not forwarded as though an anchor supported it. Complete names, keyboard order, contrast, pending truth, and disabled truth are required.

## 7. Runtime implementation guardrails

1. Re-audit exact consumers before changing the shared default; inspect shared primitives plus representative LE and TA flows.
2. Keep Action Blue and Route Blue theme-addressable; do not embed them as feature-owned literals.
3. Do not repurpose broad global tokens without proving all consumers accept the new meaning.
4. Preserve native semantics, complete names, focus-visible behavior, disabled/pending truth, and accepted touch targets in every directly affected migration.
5. Preserve current prop aliases or migrate every affected consumer coherently in the same authorized checkpoint.
6. Treat Tabs and consuming primitives as regression surfaces only; changing their independent contract requires a separate candidate.
7. Use component tests for behavior and focused rendered evidence for geometry, focus, hover, pressed, pending, long-label, input-capability, and reduced-motion claims.

These guardrails do not authorize CP2. Production runtime, token, consumer, and test changes require a separate Owner instruction.
