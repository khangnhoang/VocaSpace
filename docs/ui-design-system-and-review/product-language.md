# VocaSpace Product Language

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — published for downstream UI-2 design work; not runtime implementation authority |
| Accepted candidate identity | `PL-CANDIDATE-1`; Owner-accepted pre-publication SHA-256 `CF68E4972CDFAC4B805ADEB0117C0CF895B07C5561D0E2D36676F8A356B439C1` on 2026-09-27 |
| Accepted correction identity | `PL-MOTION-CORRECTION-1`; Owner-accepted through exact gate `PL-MOTION-CORRECTION-ACCEPT`, pre-publication SHA-256 `05F259BC199D4CAC880E29F6243BB7F49BDE48B33BC504F769396A260B3C2439`, on 2026-09-27 |
| Acceptance scope | Typography, CTA hierarchy, tab/mode selector grammar, motion language, and the current light-reference/theme-capable direction are accepted together with the complete candidate |
| Upstream contract | [UI-2 Detail Plan](./implementation-plans/ui-2/plan.md), Stage 1 |
| Scope | Product-wide visual identity and semantic intent shared by Learning Experience (LE) and Teacher Authoring (TA) |
| Excludes | Page composition, route or workflow behavior, exact shared-component variants, runtime token migration, and screen-type-specific hierarchy |

This document defines the accepted reusable Product Language for its stated scope. Current CSS and components remain comparison evidence rather than proof that runtime implementation already conforms. On 2026-09-30, the Owner accepted `BUTTON-RADIUS-CORRECTION-1` after rendered comparison of `8/10/12px`: Button specializes the Control intent with an `8px` rounded rectangle. This bounded correction does not change Input, card, or other control radii; exact Button geometry belongs to [Button](./components/button.md).

## 1. Subject grounding and design thesis

VocaSpace is a Vietnamese-first language-learning and course-authoring product. Learners need focus, correction, progress, and earned momentum; teachers need structure, confidence, recoverability, and low-friction authoring. These are two expressions of one product, not separate brands.

**Design thesis — Guided momentum:** VocaSpace should feel like a calm, light workspace in which one clear route signal, visible state changes, and restrained progress cues move people from the current task to the next meaningful action. Recognition comes from the combination of deep ink, route blue, recall cyan, softly bounded work surfaces, and a path-oriented state language—not from generic dashboard decoration.

Falsification rule: if a surface could replace its course, lesson, practice, authoring, and status content with generic SaaS metrics without changing its hierarchy or state language, it is not expressing this thesis strongly enough. Conversely, a screen that adds ornamental gradients, glass panels, floating icons, or motion without clarifying learning or authoring also violates it.

### Product signature — Progression rail

When a task has a real order, VocaSpace may express it as a **progression rail**: a restrained line-and-node relationship that makes completed, current, and next context legible without turning the screen into a stepper by default.

- The base rail uses Border `#CBD5E1`; a completed segment may use Growth Green, an in-progress/supporting segment may use Recall Cyan, and the current node uses Route Blue with visible separation from its surface.
- A compact rail uses a `2px` line and `8–12px` nodes; exact component construction remains with UI-3 or the owning surface.
- LE may apply the grammar to course/topic/practice progression. TA may apply it to the real course → chapter → topic structure, readiness sequence, or a bounded authoring journey.
- The rail exists only when the underlying order and state are truthful. It is prohibited for unrelated dashboard cards, arbitrary section numbering, decorative timelines, or invented completion scores.
- Text, labels, list order, or semantic progress values must preserve the same meaning without the line; the signature is never color-only or required to understand the flow.

## 2. Inheritance and semantic ownership

Every in-scope LE and TA product surface governed by this language inherits:

- the core and neutral colors in this document;
- the typography roles and Vietnamese readability rules in this document;
- the product-level surface, geometry, elevation, focus, state, iconography, and motion language defined later in this accepted Product Language; and
- the rule that color, shape, and motion encode identity or state rather than decoration.

Ownership remains separated:

| Owner | Owns | Does not own |
| --- | --- | --- |
| Product Language | Shared identity, semantic color, type roles, surface relationships, geometry intent, elevation, focus/state grammar, and motion intent | A page layout, route flow, exact component dimensions, or feature behavior |
| Screen-type design | LE or TA hierarchy, density, interaction emphasis, feedback, and justified type-specific semantic roles | A second palette, font stack, radius family, or shadow system |
| Shared-component contract (UI-3) | Exact variants, dimensions, interaction behavior, and usage constraints for shared primitives | Product or screen-type identity beyond the accepted intent it implements |
| Surface specification (UI-4 or later) | Route-specific composition, content, states, and component selection | Changes to inherited product/type decisions without a new Owner decision |

A screen type may request an exception only when the product rule cannot safely express its job. The exception must name its use, reason, boundary, and fallback; it never silently becomes a second product rule.

## 3. Color system

### 3.1 Core colors

| Name | Exact value | Semantic role | Use constraint |
| --- | --- | --- | --- |
| Route Blue | `#2563EB` | Current route/step, selected state, link/action accent, keyboard focus | One dominant route signal per local task area; separate from the filled-primary CTA role |
| Action Blue | `#2B6CED` | Preferred filled primary CTA | Use for one dominant primary action in a local decision area; pair with white text |
| Recall Cyan | `#0E7490` | Learning/progress accent, supportive information, product signature companion | Never substitutes for success; avoid large decorative cyan fields |
| Growth Green | `#15803D` | Confirmed success, completed state, safe positive result | Use only after a real positive state exists |
| Attention Amber | `#A16207` | Warning, incomplete prerequisite, attention without failure | Must include text/icon semantics; not a decorative highlight |
| Correction Red | `#B91C1C` | Error, destructive consequence, blocked/invalid state | Reserve for correction and danger; never use for ordinary emphasis |

### 3.2 Neutral surfaces and text

| Role | Exact value | Intended relationship |
| --- | --- | --- |
| Canvas | `#F8FAFC` | Default light application field |
| Surface | `#FFFFFF` | Primary work surface over Canvas |
| Subtle surface | `#F1F5F9` | Grouping, quiet hover, skeleton, or secondary region |
| Border | `#CBD5E1` | Standard boundary on light surfaces |
| Muted border | `#E2E8F0` | Low-emphasis separation inside an already bounded surface |
| Primary text / Deep Space | `#0F172A` | Headings, essential body text, and a rare dark identity anchor; not a full-page dark theme by default |
| Secondary text | `#475569` | Supporting text that must remain readable |
| Inactive text | `#64748B` | Nonessential metadata; never the only signal for disabled state |

The exact values in this accepted Product Language describe the current light reference. They do not impose a single-theme architecture: future implementations must keep semantic roles theme-addressable rather than embedding light values as feature-owned assumptions. This leaves room for separately accepted LE and TA dark counterparts without pretending those dark values are specified here. The intended dark-only Admin direction is also future scope, not approval of current `.dark` variables or a product-wide dark theme. See [Future product directions](./future-features.md).

### 3.3 State pairs and contrast rules

| State | Foreground | Quiet background | Boundary/focus |
| --- | --- | --- | --- |
| Route/current | `#2563EB` | `#EFF6FF` | `#93C5FD` |
| Informational/progress | `#0E7490` | `#ECFEFF` | `#A5F3FC` |
| Success/complete | `#15803D` | `#F0FDF4` | `#86EFAC` |
| Warning/incomplete | `#A16207` | `#FFFBEB` | `#FCD34D` |
| Error/destructive | `#B91C1C` | `#FEF2F2` | `#FCA5A5` |

- Normal text must meet WCAG AA contrast (`4.5:1`); large text and essential non-text boundaries must meet their applicable AA thresholds.
- White may be used on Action Blue, Route Blue, Recall Cyan, Growth Green, Attention Amber, and Correction Red only after contrast is verified for the exact pair and text size. Action Blue with white normal text is `4.70:1`; quiet state backgrounds use the dark state foreground above.
- Visible focus uses Route Blue as the default ring with at least a 2px perceptible stroke plus separation from the component boundary. Error focus keeps the focus indicator and adds Correction Red semantics; it must not replace focus with red alone.
- State meaning always combines color with text, icon, shape, or position. Completion, correctness, warning, and error are never color-only.
- Reduced transparency is the default for work surfaces. Translucency may soften a local state background, but text and essential boundaries must retain the same contrast without backdrop blur.
- Direct feature literals matching these values remain runtime debt until mapped by the owning implementation work. Data visualization may use additional colors only when categories require them, labels remain available, and the chart contract owns the mapping. LE/TA decorative color additions are not allowed.

Current comparison: the runtime already uses slate neutrals, blue routes/actions, cyan progress, emerald success-like states, and rose/amber errors or warnings, but it does so through fragmented literals. This accepted Product Language consolidates their semantic intent; it does not claim current screens already conform.

## 4. Typography

### 4.1 Installed font roles

No new font dependency is proposed.

| Role | Family | Concrete guidance | Use |
| --- | --- | --- | --- |
| Display | Plus Jakarta Sans | `32/40` mobile and `40/48` wide, weight `800`, tracking `-0.02em` | Rare product/surface heading; never routine card decoration |
| Heading 1 | Plus Jakarta Sans | `32/40`, weight `800`, tracking `-0.015em` | One route or surface title |
| Heading 2 | Plus Jakarta Sans | `24/32`, weight `700`, tracking `-0.01em` | Major task section |
| Heading 3 | Plus Jakarta Sans | `18/26`, weight `700`, normal tracking | Local group or card title |
| Body large | Plus Jakarta Sans | `16/26`, weight `400–500` | Explanations and learning content |
| Body | Plus Jakarta Sans | `14/22`, weight `400–500` | Default product copy |
| Label/action | Plus Jakarta Sans | `14/20`; weight `600` for actions and `600–700` for non-action labels/state | Controls, field labels, state labels |
| Utility/caption | Geist Sans | `12/16`, weight `500–600`, tracking `0–0.04em` | Compact metadata, breadcrumbs, short eyebrow labels |
| Data emphasis | Plus Jakarta Sans | `28/34` or `32/38`, weight `800`, tabular numerals where available | Real progress/count values, not decorative metrics |

Plus Jakarta Sans is the primary voice because its installed Vietnamese subset supports the product's language and its rounded construction fits the calm, approachable direction. Geist Sans is a compact supporting voice only. Geist Mono is installed but has no approved ordinary learner- or teacher-facing role in this Product Language. Runtime font-variable wiring is a deferred implementation concern and is not changed by this document.

### 4.2 Readability rules

- Vietnamese diacritics must remain distinct at body and caption sizes. Do not use all caps for sentences, long labels, feedback, or learning content.
- Uppercase utility labels are limited to short anchors, normally no more than four words; use `0.04em` tracking by default and never exceed `0.08em` for Vietnamese text.
- Body copy targets 45–75 characters per line where composition permits, uses natural wrapping, and never relies on fixed-height clipping.
- Long course/topic titles wrap with preserved word integrity; truncation is allowed only when the full value is available nearby or through an accessible name/title and the task does not require comparison of the hidden text.
- Dense TA surfaces may reduce space, not body readability: keep body text at least `14/22` and labels at least `12/16`.
- LE practice content may scale above the role table for the learning object itself, but the LE screen-type contract owns that exception and must preserve mobile wrapping.
- Ordinary product UI must not expose route slugs, UUIDs, database IDs, or internal keys to justify a mono role. Use human-readable course/topic titles, breadcrumbs, labels, and navigation state. A later specialist/admin tool may propose mono only when a real user task consumes technical text.

Current comparison: `app/layout.tsx` loads Plus Jakarta Sans, Geist, and Geist Mono, while current screens independently choose weights, tracking, and sizes. This accepted Product Language defines product-facing roles for Plus Jakarta Sans and Geist Sans only; loading Geist Mono does not create a product-facing use. Runtime mapping remains deferred.

## 5. Surfaces and elevation

VocaSpace uses a light, layered workbench rather than a stack of decorative cards.

| Surface role | Color and boundary | Elevation intent | Typical semantic use |
| --- | --- | --- | --- |
| Canvas | Canvas `#F8FAFC`; no border | None | Route background and breathing room |
| Work surface | Surface `#FFFFFF`; Border `#CBD5E1` or Muted border `#E2E8F0` | None or Level 1 | Primary learning/authoring region, form group, task section |
| Inset surface | Subtle surface `#F1F5F9`; optional Muted border | None | Supporting context, grouped metadata, read-only preview, empty-state well |
| State surface | Exact quiet state pair from section 3.3 | None | Current, progress, success, warning, error, or destructive context |
| Floating surface | Surface `#FFFFFF`; standard boundary | Level 2 | Popover, sheet, menu, or non-blocking overlay |
| Modal surface | Surface `#FFFFFF`; standard boundary; dimmed backdrop | Level 3 | Blocking decision or focused edit requiring dismissal |
| Dark anchor | Deep Space `#0F172A` with white/quiet light text | None or Level 1 | Rare navigation/identity anchor; not a default content card |

Elevation levels are deliberately few:

| Level | Accepted recipe | Use rule |
| --- | --- | --- |
| Level 0 | `none` | Default; hierarchy should first come from spacing, boundary, and type |
| Level 1 | `0 1px 2px rgba(15, 23, 42, 0.06)` | Quiet separation for a work surface when a border alone is insufficient |
| Level 2 | `0 8px 24px rgba(15, 23, 42, 0.10)` | Floating menus, sheets, and temporary raised context |
| Level 3 | `0 20px 48px rgba(15, 23, 42, 0.14)` | Modal/dialog focus only |

Do not combine a strong border, tinted background, and high elevation merely to make a section appear important. Dense TA areas should usually remain Level 0–1. A focused LE object may use Level 1–2 when elevation clarifies the active practice plane. Exact component shadow implementation belongs to UI-3 or the owning surface.

Current comparison: runtime surfaces already use Canvas-like slate backgrounds and white cards, but many feature shadows and arbitrary state tints differ. Their existence is evidence, not an exception to this hierarchy.

## 6. Geometry and spacing

The geometry is softly rounded and precise: approachable enough for repeated learning, disciplined enough for dense authoring. It may echo the composure of Windows 11 without copying Fluent materials, acrylic, or component specifications.

### 6.1 Radius family

| Intent | Accepted radius | Semantic boundary |
| --- | --- | --- |
| Compact | `8px` | Compact metadata, icon container, small internal grouping |
| Control | `12px`; Button `8px` | Inputs and other ordinary controls retain `12px`; Owner-accepted Button specialization uses `8px`, with exact shared variants owned by UI-3 |
| Section | `16px` | Standard work surface, card group, sheet or dialog section |
| Focus | `24px` | One emphasized learning object, completion/state panel, or spacious top-level work surface |
| Full/pill | `9999px` | Progress track, avatar, status dot, or short filter/status chip. A compact utility/context action is a candidate semantic role for UI-3 to resolve from real usage evidence; it is not yet an accepted Button variant. |

Rules:

- A surface normally uses one radius level; nested children step down rather than repeating the parent's radius.
- `24px` is an emphasis budget, not the default for every card.
- The preferred primary Button action is a rounded rectangle using the corrected `8px` Button radius. It is not a capsule; exact shared-component dimensions remain UI-3-owned. Other Control geometry is unchanged.
- Full pills do not replace ordinary buttons, tabs, cards, labels, or inputs. Short copy alone is not evidence for capsule geometry; UI-3 must distinguish any future compact utility/context action from standard actions and state/filter chips.
- Shared controls may support stretch/full-width composition, but width remains a surface/layout decision. A learning reveal may span its content region while a completion action stays intrinsic; neither example establishes a global Button-width rule.
- Product Language fixes the family and intent. UI-3 decides exact shared-component variants after usage audit; UI-4/later surfaces decide which allowed role applies to a concrete composition.

### 6.2 Spacing rhythm

Use a `4px` base with the working sequence `4, 8, 12, 16, 24, 32, 48, 64px`.

- `4–8px`: icon/label or tightly related inline content.
- `12–16px`: control interiors and related local fields.
- `24–32px`: work-surface padding and separation between task groups.
- `48–64px`: major route sections or an intentional pause in a learning journey.
- Dense TA composition reduces outer spacing before shrinking readable text or touch targets.
- LE composition may spend more vertical space on the active learning object, while navigation and feedback stay nearby and predictable.

Current feature overrides at `20px`, `24px`, `28px`, `rounded-3xl`, and many independent gaps are migration evidence. This accepted Product Language does not silently change them.

## 7. Iconography and imagery

- Lucide is the default interface icon family. Prefer `16px` inline, `20px` for controls, and `24px` for state anchors; larger icons require a content or empty-state reason.
- Use the library's regular stroke character consistently. Do not mix arbitrary filled icon sets or use an icon as the only accessible label.
- Course thumbnails, learning media, diagrams, and user-provided content may carry visual richness because they explain real content. Preserve aspect ratio, supply meaningful alt text, and provide an initial/icon fallback for missing or failed media.
- Empty/error/completion imagery must explain state or the next action. A Lucide state anchor plus direct copy is sufficient; do not reserve space for a mascot, illustration, or decorative scene that does not yet exist.
- Generic gradients, glass effects, floating decorative icons, emoji headings, and stock dashboard illustrations are not product identity.
- A local two-color wash may be proposed later only when it encodes a real content or state transition and keeps text/boundary contrast without backdrop effects. It is not accepted by this Product Language merely because current code contains gradients.

## 8. Product interaction-state language

State changes should answer: what changed, whether the action completed, and what remains possible.

| State | Product-level presentation | Required non-color evidence |
| --- | --- | --- |
| Default | Neutral boundary, Primary or Secondary text | Clear label and semantic control |
| Hover | Perceptible but quiet visual response beyond the pointer, such as a stronger boundary, quiet surface tint, or equally restrained cue | Pointer affordance only; never the sole discoverability mechanism |
| Focus-visible | Route Blue ring, at least 2px perceptible, separated from the boundary | Native/semantic focus order and label |
| Active/pressed | Small contrast/position response without layout shift | Control semantics; any `1px` press behavior remains UI-3-owned |
| Selected/current | Route Blue foreground or boundary on `#EFF6FF` | Check, marker, `aria-current`, `aria-selected`, or text |
| Pending | Stable control width, visible progress indicator, action unavailable to repeat | Verb describing the in-progress action; status announcement when material |
| Disabled | Reduced emphasis while preserving legibility | Native disabled/`aria-disabled`; nearby reason when the block is not obvious |
| Informational/progress | Recall Cyan pair | Value, label, step, or progress semantics |
| Success/complete | Growth Green pair only after confirmed success | Confirmation text/icon and next action |
| Warning/incomplete | Attention Amber pair | Named prerequisite, consequence, or recovery action |
| Error/invalid | Correction Red pair near the affected context | Error message explaining correction; focus remains visible |
| Destructive | Quiet Correction Red for entry; stronger red at confirmation | Object identity, consequence, reversibility, cancel and confirm actions |

Representative combinations:

- A selected course/topic row uses `#EFF6FF`, a Route Blue boundary/marker, readable ink, and current-state text; it is not only a blue fill.
- A completed learning step uses a Growth Green check and “Đã hoàn thành”; Recall Cyan remains reserved for progress, not completion.
- A TA readiness warning uses the amber pair with the missing prerequisite and a direct route action; it does not become an alarming destructive card.
- A failed form field keeps a Route Blue focus indicator when focused, adds a Correction Red boundary, and places a corrective message beside the field.
- A destructive dialog identifies the course/chapter/topic, states soft-delete versus permanent deletion truthfully, and separates cancel from the destructive confirmation.

Current primitives already preserve many semantic focus, invalid, disabled, dialog-title, and keyboard behaviors. Their exact variants and dimensions are not accepted here. UI-3 owns shared component implementation; UI-4/later surface specifications own concrete placement, whether stronger secondary affordance is warranted, any additional action count, and state composition.

Preferred CTA hierarchy uses one Action Blue filled primary action with one subordinate Route Blue text action. A surface may replace that text treatment with an outlined secondary only when the secondary action genuinely needs stronger affordance. This allowance does not define a global three-action pattern; additional action count and placement remain surface-owned decisions.

Mutually exclusive tab or mode selection uses one tab-style selector rather than a segmented box: each option uses an icon plus label; inactive options remain readable; hover adds a subtle but clearly perceptible quiet tint; and the active option uses Route Blue icon/text emphasis plus a bottom indicator. The options do not move on hover or selection, and the selector must not produce a bordered box nested inside another box. UI-3 owns exact construction and dimensions. The `Default motion / Reduced motion` selector demonstrates this accepted grammar inside the review aid, but that specific control is not a required product-facing motion setting.

## 9. Motion language

Motion explains cause, state, or spatial continuity. It is not ambient decoration.

| Motion role | Duration | Accepted easing | Allowed use |
| --- | --- | --- | --- |
| Immediate response | `120ms` | `cubic-bezier(0.2, 0, 0, 1)` | Hover, focus emphasis, press release, or another small perceptible response |
| State transition | `220ms` | `cubic-bezier(0.2, 0, 0, 1)` | Selected state, validation feedback, progress/value change |
| Spatial transition | `240ms` | `cubic-bezier(0.2, 0, 0, 1)` | Dialog, sheet, disclosure, answer reveal, flashcard flip |
| Single earned micro-cue | `320ms` maximum | `cubic-bezier(0.16, 1, 0.3, 1)` | One bounded confirmation, progress movement, node change, or accomplishment accent |
| Composed earned-completion sequence | Approximately `600–900ms` total | Each constituent uses the accepted easing appropriate to its semantic role | Two or more distinct, truthful completion transitions whose causal order would become unclear if collapsed into one micro-cue |

Rules:

- Feedback appears immediately; animation never delays correctness, error, save state, or the next repeated-practice action.
- A composed earned-completion sequence contains only short, purposeful constituent transitions. Within this exception, one constituent may run longer than its ordinary role ceiling when necessary to make a truthful progression state perceptible; constituent transitions should normally remain approximately `220–450ms`, and the complete sequence remains approximately `600–900ms`.
- The composed exception applies only when multiple semantic states truly change, such as local progress reaching complete → the active object becoming completed → the next context becoming available. It does not lengthen a single cue or change the accepted ceilings for Immediate response, State transition, Spatial transition, or ordinary progress updates.
- Result text, confirmed values, focus, and the legal next action render immediately and never wait for the sequence. Causal order remains truthful: subordinate next context may appear only after the completed object is legibly completed.
- A composed sequence is one-shot and completion-triggered. It must not replay automatically, pulse perpetually, or add decorative steps merely to consume the available duration.
- Immediate response defines an interaction intent, not an exact Button recipe: hover remains position-stable and provides a restrained tone, contrast, boundary, or shadow cue beyond the pointer. Product Language does not require a separate Button press animation; UI-3 owns whether and how a component distinguishes press, plus the exact property combination, distance, shadow, and behavior.
- Across Product Language examples, action controls, mutually exclusive selection controls, and status/state indicators must remain visually distinguishable by role rather than collapsing into one pill/chip grammar. UI-3 owns their exact construction, dimensions, and component behavior.
- The preferred filled primary action uses Action Blue `#2B6CED`, white text, action weight `600`, and rounded-rectangle Control geometry. Route Blue remains the current/selected/focus and link/action accent rather than the filled-primary CTA color.
- Geometry and emphasis are separate decision axes. UI-3 must derive a small role-based set from usage evidence rather than multiply every rounded-rectangle/capsule and filled/outlined/quiet/text combination into a separate Button variant. Capsule remains a candidate semantic role for compact utility/context actions, not an arbitrary primary-action shape.
- State transition may combine color or boundary change with a very small opacity/transform cue when that improves continuity. The content, control position, and next action must remain stable; the owning component or surface decides the exact properties.
- Animate opacity and transform when motion is necessary. Avoid layout-thrashing width/height animation except a bounded progress indicator whose value is also exposed semantically.
- No perpetual scan, shimmer, bounce, floating, or pulse outside a real loading/progress state. Loading animation stops when loading stops.
- TA uses Immediate response and State transition by default. Spatial motion is limited to dialogs, sheets, disclosures, and context-preserving navigation cues.
- LE may use answer reveal, flashcard flip, progress movement, or one earned completion moment; it must keep controls stable and feedback readable throughout.
- A future surface may use confetti only for a meaningful completion, with no blocked interaction or hidden feedback and with a non-motion equivalent. This accepted Product Language does not install or select a confetti implementation.

### Reduced-motion equivalence

Under `prefers-reduced-motion: reduce`:

- remove nonessential translation, scale, rotation, flip, confetti, and stagger;
- present the final state immediately or use an opacity change no longer than `100ms`;
- preserve the same text, icon, progress value, focus destination, and available next action; and
- never require motion to explain correctness, sequence, hierarchy, or completion.

Runtime should normally follow the operating-system/browser `prefers-reduced-motion` preference. The Default/Reduced selector in the non-authoritative review aid exists only to compare accessibility equivalence; it does not require a user-facing product setting. Its tab-style visual grammar is accepted above, while this review-specific instance and its own indicator transition cannot establish another runtime duration, easing, or product setting. Any explicit in-product override remains future product scope.

Example pair: a flashcard answer may flip over `240ms` in the default mode; reduced motion swaps the face immediately with a `100ms` opacity change while retaining the same revealed content and focus position. A single completion cue may move/fade once over at most `320ms`. When multiple truthful completion states require causal storytelling, a composed sequence may span approximately `600–900ms`; reduced motion skips that sequence and shows the same settled completion, progress, next context, focus, and actions immediately.

A static board can show the start/end states and reduced-motion equivalence, but it cannot establish timing or easing quality. Motion acceptance therefore requires the Owner to review a non-authoritative interactive aid derived from these exact values, compare default and reduced modes, and explicitly include motion in `PL-ACCEPT`. The document remains the source of truth; the aid must not introduce another duration, easing, state, or implementation requirement.

## 10. Token and runtime mapping

This table classifies ownership; it is not an instruction to edit runtime code in UI-2.

| Product decision | Current repository comparison | Classification | Future owner/limit |
| --- | --- | --- | --- |
| Surface white | `--card` / `--popover` are light white surfaces | `maps to current token` | Later work may reuse the tokens without claiming every current card conforms |
| Quiet neutral grouping | `--muted` is a light neutral | `maps to current token` | Accepted `#F1F5F9` needs verification before a runtime value change |
| Canvas `#F8FAFC` | Many LE/TA routes use `bg-slate-50`; `--background` is currently white | `proposed token/runtime change` | UI-3 or bounded route migration; no UI-2 edit |
| Deep Space / text neutrals | Current semantic foreground is neutral while feature code uses slate literals | `proposed token/runtime change` | Token migration requires usage audit |
| Route Blue `#2563EB` | Widely used as `blue-600` or `#2563EB`; current `--primary` is neutral | `proposed token/runtime change` | Product token decision first; UI-3/runtime work maps safely |
| Action Blue `#2B6CED` | No accepted dedicated filled-primary token exists; current blue actions vary by feature | `proposed token/runtime change` | UI-3 maps the preferred filled-primary role without replacing Route Blue state/focus semantics |
| Recall Cyan `#0E7490` | Current cyan usage varies and chart tokens are blue | `proposed token/runtime change` | Do not reuse chart tokens as product semantics |
| Success/warning/error pairs | Destructive exists; success/warning/info tokens do not form a complete product set | `proposed token/runtime change` | Later token work; keep current behavior truthful meanwhile |
| Focus mechanism | Shared primitives already use visible ring/border mechanics | `maps to current token` for mechanism; `proposed token/runtime change` for Route Blue value | UI-3 verifies shared interactions and contrast |
| Installed font families | Plus Jakarta Sans, Geist, and Geist Mono are loaded | `maps to current token` for availability; `proposed token/runtime change` for Plus Jakarta Sans/Geist Sans role wiring; no approved product role for Geist Mono | No font install; do not expose technical identifiers to create a mono use case |
| Radius `8/12/16/24/full` | `--radius: 0.625rem` and generated radii coexist with many feature literals | `proposed token/runtime change` | UI-3 audits component uses before exact variants change |
| Elevation levels | Current feature shadows are direct and inconsistent | `proposed token/runtime change` | Tokens are optional; the semantic limit matters more than token count |
| Motion durations/easing | Tailwind/Radix utilities and feature durations exist without one product contract | `proposed token/runtime change` | Later component/surface work maps only where needed |
| Lucide and real-content imagery | Current product already uses Lucide and course media | `maps to current token` / current convention | Continue; no asset or package addition |
| Direct-literal and no-decoration rules | No single runtime owner can enforce these by itself | `documentation-only rule` | Review and later migrations apply the rule locally |
| Screen-type expression | Current LE/TA patterns provide evidence but conflict in places | `documentation-only rule` until LE/TA acceptance | Screen-type artifacts specialize without copying values |

Proposed token names such as `--color-route`, `--color-progress`, `--color-success`, `--color-warning`, or elevation tokens are illustrative mapping targets only. UI-2 does not reserve exact runtime identifiers, add variables, or require a generalized token framework; the future implementation owner should reuse existing semantic names when they can truthfully own the accepted role.

## 11. Concrete review plates

These plates are specification examples, not page designs or runtime claims. The accompanying review board, when shown, is derived from the exact values below and is non-authoritative. Static motion frames show semantic endpoints only; use the separate interactive aid to judge timing/easing.

### Plate A — Identity, palette, and type

| Element | Accepted composition |
| --- | --- |
| Product heading | Deep Space on Canvas; Plus Jakarta Sans `32/40`, `800`, `-0.015em` |
| Supporting copy | Secondary text on Canvas; Plus Jakarta Sans `16/26`, `400–500` |
| Primary CTA pair | One Action Blue `#2B6CED` filled primary with white `14/20`, weight `600`, corrected Button `8px` radius; one subordinate Route Blue text action. An outlined secondary is allowed only when the owning surface needs stronger affordance. Specimen width and padding remain illustrative; no global three-action pattern is defined. |
| Progress cue | Recall Cyan text/marker on `#ECFEFF`; value and label remain visible without color |
| Short utility anchor | Geist Sans `12/16`, `600`, maximum `0.04em` tracking; no long uppercase sentence |

Rejected comparison: generic purple gradient, glass card, large decorative metric, or a different palette for learner versus teacher.

### Plate B — Surfaces, geometry, and elevation

| Element | Accepted composition |
| --- | --- |
| Route field | Canvas `#F8FAFC`, Level 0 |
| Standard work surface | Surface `#FFFFFF`, Border `#CBD5E1`, Section radius `16px`, Level 0–1 |
| Focused learning object | Surface, Focus radius `24px`, Level 1–2; reserved for the active object |
| Dense authoring group | Surface, Section radius `16px`, Level 0–1, `24px` outer padding on wide screens |
| Modal decision | Surface, Section radius `16px`, standard boundary, Level 3, dimmed backdrop |
| Status/filter chip | Full radius allowed only because the compact shape communicates state/filter scope |

Rejected comparison: every section at `24–28px`, nested Level 2 shadows, or pill-shaped ordinary controls.

### Plate C — State and motion pair

| Scenario | Default motion | Reduced motion | Persistent meaning |
| --- | --- | --- | --- |
| Selected/current row | State colors settle over `220ms` | Immediate | Route Blue marker + “Hiện tại”/selection semantics |
| Flashcard answer reveal | Spatial transition up to `240ms` | Immediate or opacity up to `100ms` | Revealed answer, stable focus, rating actions |
| Confirmed completion — single cue | One cue up to `320ms` | Immediate | Growth Green check, completion copy, next action |
| Confirmed completion — composed sequence | Approximately `600–900ms` across purposeful constituents | Immediate settled state | Truthful progress complete → active object completed → subordinate next context; result and actions never wait |
| Invalid focused field | State transition up to `220ms` | Immediate | Route Blue focus plus red boundary and corrective message |
| Destructive confirmation | Dialog enter up to `240ms` | Immediate or opacity up to `100ms` | Object identity, consequence, cancel, destructive confirm |

## 12. Uniqueness critique and corrections

Initial risk: light slate canvas, blue primary actions, rounded white surfaces, and clean sans typography can describe almost any modern SaaS dashboard.

Corrections built into this accepted language:

1. Product recognition depends on **Guided momentum**, not the palette alone: current/next/completed/correction states must expose a path through a real lesson or authoring task.
2. Recall Cyan is reserved for progress and supportive learning information, while Growth Green means confirmed success. This prevents the common “any positive-looking accent everywhere” pattern.
3. LE spends expression on recall, reveal, correction, progress, and earned completion; TA spends it on course structure, readiness, direct edit, recovery, and confidence. Neither receives ornamental hero treatment.
4. Focus radius and higher elevation are scarce emphasis budgets. Dense tools remain disciplined; repeated practice receives space only around the active learning object.
5. Real course content, Vietnamese copy, and course/chapter/topic structure carry identity. Generic gradients, glass, floating icons, decorative charts, and mascot placeholders are explicitly excluded.
6. The progression rail gives the path thesis a concrete grammar, but only for truthful ordered work; it cannot be pasted onto unrelated cards as a brand flourish.

The direction would fail this critique if a future application used only the color table and rounded cards while omitting path/state behavior. Screen-type artifacts must demonstrate the product thesis through their own task-specific hierarchy.

## 13. Accepted scope and exclusions

The Owner accepted exact candidate `PL-CANDIDATE-1`, pre-publication SHA-256 `CF68E4972CDFAC4B805ADEB0117C0CF895B07C5561D0E2D36676F8A356B439C1`, on 2026-09-27. Acceptance covers the color values, typography roles, CTA hierarchy, tab/mode selector grammar, surface/elevation model, geometry intent, motion language, current light-reference/theme-capable direction, and token mapping together. The Owner later issued exact gate `PL-MOTION-CORRECTION-ACCEPT` for bounded amendment `PL-MOTION-CORRECTION-1`, pre-publication SHA-256 `05F259BC199D4CAC880E29F6243BB7F49BDE48B33BC504F769396A260B3C2439`, on 2026-09-27. That amendment changes only the earned-completion composition rule; every other accepted Product Language decision remains unchanged.

This accepted Product Language does not:

- edit `app/globals.css`, `app/layout.tsx`, shared components, routes, or feature UI;
- approve current feature literals, dark mode, page layouts, or exact shared-component dimensions;
- install fonts, icons, animation packages, shadcn components, illustrations, or mascots;
- define LE- or TA-specific hierarchy, density, feedback, or exceptions;
- authorize UI-3/UI-4 implementation, browser validation, Git publication, or remote action; or
- claim that current runtime screens match the accepted language.
