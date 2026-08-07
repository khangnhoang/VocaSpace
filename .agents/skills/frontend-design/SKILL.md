---
name: frontend-design
description: Product-aware visual design for VocaSpace/DevSpace UI. Use when building or reshaping product-facing UI; apply distinctive visual direction proportionally while preserving safe, maintainable UX.
---

# Frontend Design Skill

## Activation scope

Use this skill for product-facing UI/UX work, including pages, components, learning flows, authoring screens, admin workflows, dialogs, forms, tables, responsive behavior, accessibility, and motion.

The goal is intentional design for the product context, not maximum visual intensity.

Before designing or coding, classify the screen:

1. Client / Marketing
2. Learning Experience
3. Teacher Authoring
4. Admin / Business Operations
5. Shared Design System Component

Do not apply the same visual freedom to every screen type.

Apply the process proportionally:

* **Local cosmetic fix:** state the screen type, user goal, and why the change fits the existing direction. Do not invent a full palette or signature element.
* **New component or substantial reshape:** make a compact design plan and a short uniqueness critique before building.
* **New page or major redesign:** use the full two-pass process in this skill, including layout exploration, visual-system direction, and post-build critique.

## Related skills

Use `frontend-workflow` for repository discovery, implementation, state, async behavior, tests, and manual validation.

Use `code-commenting-and-maintainability` when documenting non-obvious UI/UX intent, accessibility constraints, design-system boundaries, responsive behavior, or interaction decisions.

If the task also touches schemas, Server Actions, tests, Supabase, or database behavior, use the corresponding skills.

## Repository and product guardrails

* Match the screen type and user goal.
* Preserve usability, trust, accessibility, and product safety.
* Use existing project components, tokens, Tailwind patterns, routes, and feedback conventions.
* Make the primary action obvious and subordinate secondary actions.
* Separate destructive actions visually and explain consequences.
* Handle loading, empty, error, success, pending, and disabled states where meaningful.
* Preserve user input after recoverable failures.
* Prevent double submission.
* Design for mobile and long or missing data.
* Do not modify shared design-system primitives for one local screen.
* Do not install packages, run shadcn CLI, add fonts, or add an animation library without permission.
* Do not fake production success or invent backend behavior.
* Do not use generic AI-looking decoration, random gradients, glassmorphism, or unnecessary motion as a substitute for a subject-specific direction.

## Screen types

Classify every applicable task into all matching screen types. Read every matching reference before making design decisions or editing; do not read references whose conditions do not match the task.

## Resource routing

| Resource | Read condition |
| --- | --- |
| [references/client-marketing.md](references/client-marketing.md) | Read for homepages, landing pages, public course discovery, pricing, promotion, or product-introduction UI. |
| [references/learning-experience.md](references/learning-experience.md) | Read for lessons, exercises, quizzes, flashcards, review sessions, learner progress, or learner-dashboard UI. |
| [references/teacher-authoring.md](references/teacher-authoring.md) | Read for course creation or editing, lesson or exercise authoring, media, preview, submission, or rejected-course revision UI. |
| [references/admin-business-operations.md](references/admin-business-operations.md) | Read for dashboards, course review, users, payments, discounts, roles, moderation, or audit-like operational UI. |
| [references/shared-design-system-components.md](references/shared-design-system-components.md) | Read only when the task proposes or evaluates a change to a shared design-system component, primitive, default, or global behavior. Do not read it merely because a feature-local UI composes an unchanged shared component. |

When a task matches more than one row, read all matching references. For example, an Admin proposal to change a global dialog default requires both Admin / Business Operations and Shared Design System Components guidance; a Teacher dialog customized only at its usage site requires Teacher Authoring guidance and skips Shared Design System Components.

## Subject grounding

Before a substantial UI change, ground the direction in the real screen rather than a fashionable visual recipe. Record a compact answer to:

* the specific product or feature;
* the audience;
* the screen's single job;
* artifacts, language, or mental models from that subject's world;
* repository context and the product identity already present.

If the brief does not supply a subject, choose one concrete subject that fits the repository and state that assumption before designing. For VocaSpace or DevSpace, derive decisions from language practice, course discovery, course creation, feedback, review, or the exact screen subject—not from generic SaaS styling.

## Two-pass design process

### Pass 1: brainstorm, explore, and plan

For a new component or substantial reshape, create a compact design plan from the subject grounding. It must cover:

* **Color:** describe the active color direction using 4–6 named colors with hex values when color is materially in scope. Otherwise, state which existing semantic tokens remain unchanged and why. Prefer existing project variables and tokens; any new token is a proposal, not permission to change the design system. Each color must encode meaning or identity, not merely decorate.
* **Typography:** roles for display, body, and utility/data/caption as needed. Do not install fonts. If the repository lacks a suitable face, use the existing font stack and create personality through scale, width, weight, tracking, line height, and composition.
* **Layout:** one or two short layout concepts. For a page or major redesign, use prose or a small ASCII wireframe to compare them. Structure must communicate real information; do not use numbered markers unless the content is genuinely sequential.
* **Signature:** one structural element, interaction, or state language the screen should be remembered by. It must come from the subject and support the user goal, not be a random gradient, glass card, decorative blob, floating icon, or bento treatment.
* **Aesthetic risk:** identify one deliberate, justified risk when the screen's design latitude permits it. Otherwise, state why restraint is the more appropriate deliberate choice. When used, state where the risk appears, why it fits the subject, and which guardrail keeps it from harming usability. Spend boldness in one place; keep the rest disciplined.

For marketing, the opening may be the signature visual thesis. For learning, authoring, and admin screens, the signature should usually appear in feedback, structure, or state language rather than an ornamental hero.

### Pass 2: critique uniqueness before build

Challenge the plan before coding:

* Could this direction be reused almost unchanged for an arbitrary SaaS, fintech, or AI landing page?
* Does it default to cream plus serif plus terracotta; near-black plus acid accent; newspaper layout; generic purple gradient; glassmorphism; bento cards; pills everywhere; random floating icons; or a large metric with a gradient accent?
* Which choices directly express VocaSpace, DevSpace, learning, language practice, course creation, or the exact screen subject?

If the direction is still generic, revise before building and state briefly what changed and why. Build from the revised plan; do not add random decoration later.

## Visual system

Use existing CSS variables and Tailwind conventions first.

Keep a coherent system for:

* brand and accent colors
* success, warning, destructive, and muted states
* text hierarchy
* spacing rhythm
* radius and shadow usage
* borders and surfaces

Color should communicate meaning, not decorate randomly.

Typography carries personality as well as hierarchy. Define display, body, and utility/data/caption roles when the screen needs them. Marketing pages may be more expressive when the project supports it; learning, authoring, and admin typography must remain readable under repeated task use. Make type memorable through intentional scale, width, weight, tracking, and composition, not by adding an unapproved font.

Do not add external fonts without permission.

Match complexity to the vision. Maximal directions require sufficient execution depth; minimal directions require precision in spacing, typography, and detail.

## Layout and action hierarchy

Use spacing to show relationships:

* related items close together
* unrelated sections clearly separated
* primary action easy to find
* destructive action separated

When multiple actions exist:

```txt
Primary: strong
Secondary: outline/secondary
Low priority: ghost/link/menu
Destructive: destructive and separated
```

Avoid cramped dialogs, inconsistent card padding, tables without responsive overflow, and pill-shaped controls everywhere.

## Dialogs and feedback

Important dialogs need:

* clear title and concise description
* object identity when applicable
* consequence of the action
* cancel and confirm actions
* pending/disabled state

Increase dialog width at the usage site when content needs it; do not change the global default for one feature.

Follow the existing toast/notification convention.

Do not add route-specific hardcoded toast theme hacks. The shared toast should remain light by default for now. A coherent light/dark theme system belongs in a separate approved PR across user, teacher, and admin route groups.

Feedback must tell the user:

* what succeeded
* what failed
* what remains editable
* what action is available next

## Forms

Every form should consider:

* required versus optional fields
* helper text and inline errors
* disabled/pending state
* server errors separate from client validation
* input preservation after recoverable failure
* keyboard and mobile use

For dynamic fields:

* use stable keys
* preserve values
* handle add/remove/reorder safely
* keep errors near the affected field
* make destructive removal explicit
* submit the intended order

Do not make forms visually clever at the cost of clarity.

## Copy is design material

Write from the end user's side of the screen. Use active voice and name things people control and recognize, not implementation details. A label should describe its result; keep vocabulary consistent throughout a flow, so an action labeled `Publish` produces a `Published` result.

Errors state what happened and how to fix it. Empty states direct the next action. Use sentence case, plain verbs, and a tone suited to the audience. Avoid filler marketing in product UI, vague apologies, clever copy that reduces clarity, and labels that quietly do two jobs.

## UI states and edge cases

Do not design only the happy path.

Consider:

```txt
loading
empty
error
success
pending
disabled
permission denied
stale or partial data
```

Also check:

* null and undefined values
* long text
* missing images
* slow and failed requests
* repeated actions
* empty collections

Empty states should explain what happened and what the user can do next.

## Motion

Use motion only to clarify state or support learning.

Appropriate examples:

* hover/focus transitions
* dialog and collapsible transitions
* flashcard flip
* answer reveal
* progress movement
* completion feedback

Marketing may use a purposeful signature interaction or atmosphere when it serves the visual thesis. Prefer one orchestrated motion moment over scattered effects unless repeated interaction requires otherwise. Avoid motion that delays repeated actions, distracts in dense forms/tables, or requires a new library without approval. Respect reduced motion.

## Responsive design

Check at minimum:

* about 375px mobile width
* tablet
* desktop
* long content
* table overflow
* dialog width
* button wrapping
* tap targets

Stack sections on mobile, allow wide tables to scroll, avoid unsafe fixed widths, and keep critical actions discoverable.

## Accessibility baseline

Preserve accessibility from shadcn/ui and Radix.

Maintain:

* semantic controls
* labels and accessible dialog titles
* keyboard navigation
* visible focus
* icon-button labels
* sufficient contrast
* clear errors
* disabled and loading states

Do not use a clickable `div` where a `button` belongs.

## Implementation boundaries

Prefer:

* existing components and wrappers
* feature-level composition
* usage-site customization
* existing helpers, routes, icons, animation libraries, and toast conventions

Do not:

* invent component paths or APIs
* rewrite large modules for a small UI task
* refactor unrelated screens
* modify DB, RLS, migrations, or generated types from a UI-only task
* add production-like mock success
* expose incomplete integration as working behavior

## Build and final design critique

Build from the revised design plan. Check CSS selector specificity and class conflicts so layout, padding, type, and state styles do not silently cancel one another.

When the environment supports it, inspect the result with screenshots or the browser. Before completion, verify:

* [ ] Screen type, design latitude, and design direction are correct
* [ ] For substantial work, subject grounding, visual-system choices, signature, and either a justified aesthetic risk or deliberate restraint are explicit; the uniqueness critique was completed
* [ ] Primary, secondary, and destructive actions are clear
* [ ] Important loading, empty, error, success, pending, disabled, destructive, long-data, null-data, and missing-data paths are handled where meaningful
* [ ] Dialogs provide enough context and forms preserve input after recoverable failure
* [ ] Mobile layout, table overflow, and critical-action discoverability are safe
* [ ] Keyboard focus, contrast, semantic controls, and reduced motion are preserved
* [ ] Motion supports the task rather than delaying it
* [ ] Shared components were not changed unnecessarily and existing tokens, routes, and feedback conventions remain coherent
* [ ] Hierarchy, density, visual identity, and the signature support the screen's job
* [ ] No decorative detail remains unless it serves the brief; remove one if the final composition feels over-accessorized

## Output expectations

Summarize at the level the task warrants:

```txt
- Screen type and design latitude
- Subject grounding and visual direction (for substantial work)
- Signature and justified aesthetic risk or deliberate restraint (when relevant)
- Files changed
- Shared components touched: yes/no
- UI states handled
- Responsive and accessibility considerations
- Visual inspection or screenshot result, if available
- What was intentionally not changed
```
