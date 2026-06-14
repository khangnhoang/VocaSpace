---
name: frontend-design
description: Product-aware frontend UI/UX design for VocaSpace/DevSpace. Use when building or improving pages, components, learning experiences, course authoring screens, admin dashboards, dialogs, forms, tables, and product UI. Balances distinctive visual quality with usability, accessibility, maintainability, and business-context safety.
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

## Related skills

Use `frontend-workflow` for repository discovery, implementation, state, async behavior, tests, and manual validation.

Use `code-commenting-and-maintainability` when documenting non-obvious UI/UX intent, accessibility constraints, design-system boundaries, responsive behavior, or interaction decisions.

If the task also touches schemas, Server Actions, tests, Supabase, or database behavior, use the corresponding skills.

## Core principles

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
* Do not install packages, run shadcn CLI, or add fonts without permission.
* Do not fake production success or invent backend behavior.
* Avoid generic AI-looking decoration, random gradients, glassmorphism, and unnecessary motion.

## Screen types

### 1. Client / Marketing

Use for homepages, landing pages, public course discovery, pricing, promotion, and product introduction.

Direction:

* polished, memorable, modern, premium, and trustworthy
* stronger hierarchy, typography, color accents, visual storytelling, and tasteful motion are allowed

Prioritize:

* clear product value
* fast comprehension
* coherent brand identity
* readable content and obvious calls to action

Avoid:

* generic purple-gradient AI visuals
* random glassmorphism
* effects that compete with the message
* decorative text that hurts readability
* visuals unrelated to the learning product

### 2. Learning Experience

Use for lessons, exercises, quizzes, flashcards, review sessions, progress, and learner dashboards.

Direction:

* focused, motivating, responsive, low-friction, and emotionally rewarding

Prioritize:

* clear next action
* stage-based progression for complex flows
* obvious correct/incorrect feedback
* progress visibility
* keyboard and mobile usability
* motion that clarifies reveal, transition, progress, or completion

The learner should always know:

```txt
What am I doing?
What happens next?
Was I correct?
What should I learn from the result?
```

Avoid:

* clutter around the learning task
* equal visual weight for too many actions
* tiny answer controls
* hidden feedback
* motion that delays repeated practice
* layouts that break on mobile

### 3. Teacher Authoring

Use for course creation/editing, lessons, exercises, media, preview, submission, and rejected-course revision.

Direction:

* productive, friendly, structured, forgiving, and easy to scan

Prioritize:

* clear page purpose and status
* grouped forms
* visible validation
* save or submit state
* preview before submission
* rejection feedback
* safe destructive actions
* easy navigation across content sections

Group long forms by meaning, for example:

```txt
Basic information
Media
Pricing
Lessons
Exercises
Review / Submit
```

Avoid:

* exposing raw database fields
* cold admin-like density
* ambiguous destructive actions
* lost input after errors
* hidden validation
* decoration that distracts from authoring

### 4. Admin / Business Operations

Use for dashboards, course review, users, payments, discounts, roles, moderation, and audit-like workflows.

Direction:

* direct, readable, predictable, safe, and information-dense without clutter

Prioritize:

* stable layouts
* clear tables, filters, search, status, timestamps, and overflow behavior
* safe confirmation dialogs
* enough context to prevent the wrong action
* accessible controls
* loading, empty, and error handling

Important confirmations should identify:

* affected object
* action
* consequence
* reversibility when relevant

Avoid:

* landing-page visual effects
* decorative backgrounds that reduce readability
* hidden actions
* tiny unlabeled icon controls
* adjacent destructive actions
* clever interaction at the cost of predictability

### 5. Shared Design System Components

Shared components are high-risk.

Before editing one, confirm:

1. The change is genuinely global.
2. Existing usages were inspected.
3. A usage-site `className`, composition, or feature wrapper is insufficient.
4. The change is backward-compatible or explicitly approved.

Do not globally change dialog width, button radius, card padding, or table density for one screen.

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

Typography should provide clear hierarchy and readable body text. Marketing pages may be more expressive only when the project supports it.

Do not add external fonts without permission.

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

Avoid motion that delays repeated actions, distracts in dense forms/tables, or requires a new library without approval.

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

## Final design review

Before completion, verify:

* [ ] Screen type and design direction are correct
* [ ] Primary, secondary, and destructive actions are clear
* [ ] Important states and edge cases are handled
* [ ] Dialogs provide enough context
* [ ] Mobile layout is safe
* [ ] Long, null, and missing data are safe
* [ ] Accessibility is preserved
* [ ] Motion supports the task
* [ ] Shared components were not changed unnecessarily
* [ ] Product conventions remain coherent

## Output expectations

Summarize:

```txt
- Screen type and design direction
- Files changed
- Shared components touched: yes/no
- UI states handled
- Responsive and accessibility considerations
- What was intentionally not changed
```
