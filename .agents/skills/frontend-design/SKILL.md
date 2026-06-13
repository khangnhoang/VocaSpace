---

name: frontend-design
description: Product-aware frontend UI/UX design for VocaSpace/DevSpace. Use this skill when building or improving pages, components, learning experiences, course authoring screens, admin dashboards, dialogs, forms, tables, and product UI. Balances distinctive visual quality with usability, accessibility, maintainability, and business-context safety.
---

# Frontend Design Skill

## Activation scope

This skill guides UI/UX design and frontend implementation for a production learning platform.

The goal is not to make every screen visually loud. The goal is to make each screen feel intentionally designed for its product context:

* client-facing pages should feel polished, memorable, and trustworthy
* learning experiences should feel engaging, clear, and motivating
* teacher authoring tools should feel productive, friendly, and safe
* admin/business screens should feel direct, reliable, readable, and hard to misuse

Avoid generic AI-looking UI, but do not sacrifice usability for decoration.

## Product Design Principle

Before designing or coding, identify the screen type:

1. Client / Marketing
2. Learning Experience
3. Teacher Authoring
4. Admin / Business Operations
5. Shared Design System Component

Each screen type has different design freedom.

Do not apply the same visual intensity to every part of the product.

## 1. Client / Marketing Pages

Use this mode for:

* homepage
* landing page
* public course discovery
* public feature sections
* pricing or promotional sections
* product introduction pages

Design direction:

* polished
* memorable
* emotionally appealing
* visually distinctive
* modern and premium
* trustworthy for learners and teachers

Allowed:

* bold hero sections
* strong visual hierarchy
* tasteful gradients
* soft illustrations or decorative shapes
* richer typography
* motion on page load
* section transitions
* visual storytelling
* feature cards with personality
* stronger color accents

Avoid:

* generic purple-gradient AI slop
* random glassmorphism
* too many competing effects
* unreadable decorative text
* landing-page visuals that do not match the learning product

A client homepage should have a clear visual identity. It should make users remember the product, but still explain what the product does quickly.

## 2. Learning Experience Pages

Use this mode for:

* lesson pages
* exercise pages
* quiz flows
* flashcard learning
* review sessions
* progress screens
* learner dashboards

Design direction:

* engaging
* focused
* motivating
* easy to understand
* low-friction
* responsive
* emotionally rewarding

This area can use more creative UX than admin screens, but every effect must support learning.

Good patterns:

* stage-based flows
* step-by-step progression
* flashcard flip interactions
* progress indicators
* streak/progress feedback
* clear correct/incorrect states
* subtle celebration after completion
* focused reading area
* sticky progress/action panels when useful
* keyboard-friendly interactions
* mobile-first exercise layouts

For complex learning pages that combine exercise, flashcard, explanation, and review, prefer organizing the page into stages instead of showing everything at once.

Example structure:

```txt
Stage 1: Learn / Preview
Stage 2: Practice
Stage 3: Check Answer
Stage 4: Review Explanation
Stage 5: Continue / Retry
```

Use animation for:

* flashcard flip
* answer reveal
* step transition
* completion feedback
* progress movement

Do not use animation that slows down repeated practice.

Avoid:

* visual clutter around the learning task
* too many actions at the same priority
* tiny answer buttons
* hidden feedback
* unclear next step
* animations that make the learner wait
* layouts that break on mobile

The learner should always know:

```txt
What am I doing?
What is the next action?
Did I get it right?
What should I learn from the result?
```

## 3. Teacher Authoring Pages

Use this mode for:

* teacher course list
* course create/edit
* lesson management
* exercise/question authoring
* media upload
* course preview
* submit course for review
* rejected course revision UI

Design direction:

* productive
* friendly
* structured
* clear
* forgiving
* easy to scan

Teacher screens are closer to admin screens than marketing pages, but they should feel less cold.

Prioritize:

* clear page titles and descriptions
* obvious primary action
* form grouping by meaning
* autosave or clear save state when applicable
* preview before submit
* helpful validation messages
* destructive confirmation
* visible course status
* rejected feedback shown clearly
* easy navigation between course content sections

Good patterns:

* cards for content sections
* tabs or stepper for course setup stages
* status badges
* inline validation
* preview panels
* sticky action bar for long forms
* clear empty states
* upload progress and error messages

For authoring flows, avoid dumping all fields into one long unstructured form. Group them into meaningful sections:

```txt
Basic information
Media / Thumbnail
Pricing
Lessons
Exercises
Review / Submit
```

Teacher UI should help the user complete a course safely, not just expose database fields.

Avoid:

* admin-like density when the user is creating content
* ambiguous destructive actions
* hidden validation errors
* forms that lose user input after error
* overly decorative UI that distracts from writing/editing
* changing course status without clear feedback

## 4. Admin / Business Operations Pages

Use this mode for:

* admin dashboards
* course review
* user management
* payment/order management
* discount management
* role/permission screens
* moderation screens
* audit-like workflows

Design direction:

* direct
* readable
* trustworthy
* safe
* information-dense but not cluttered
* predictable

Admin screens should not be visually boring, but they must not be overly artistic.

Prioritize:

* clear tables/lists
* strong filtering/search
* obvious status badges
* safe destructive actions
* audit-relevant timestamps
* clear confirmation dialogs
* loading/empty/error states
* stable layout
* responsive overflow handling
* accessible controls

Admin UI should make it hard to perform the wrong action.

For business workflows, always show enough context before confirmation.

Bad confirmation:

```txt
Are you sure?
```

Good confirmation:

```txt
Publish this course?
This will make “TOEIC Listening Basics” visible to students if it meets the public listing rules.
```

For reject/approve/review flows, dialogs should include the relevant object name and consequence.

Avoid:

* flashy landing-page visuals
* unnecessary animation
* decorative backgrounds that hurt readability
* hiding important actions in clever UI
* tiny icon-only buttons without labels/tooltips
* multiple destructive actions close together
* changing shared components for one admin screen

Admin design should feel polished through spacing, alignment, typography, state handling, and clarity, not through excessive visual effects.

## 5. Shared Design System Components

Use this mode for:

* `components/ui/*`
* shared buttons/cards/dialogs/tables/badges
* global layout primitives
* theme tokens
* common wrappers

Shared components are high-risk.

Do not modify shared components to fix a single screen.

Before editing shared UI, answer:

```txt
1. Is this a global design-system change?
2. Which existing usages are affected?
3. Can this be solved with className at the usage site?
4. Can this be solved with a feature-level wrapper instead?
5. Is the change backward-compatible?
```

For one-off screen needs, prefer:

```tsx
<AlertDialogContent className="max-w-2xl">
  ...
</AlertDialogContent>
```

or a feature wrapper:

```tsx
// components/admin/courses/course-review-dialog.tsx
export function CourseReviewDialog() {
  return (
    <AlertDialog>
      <AlertDialogContent className="max-w-2xl">
        ...
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Do not globally change default dialog width, button radius, card padding, or table density unless the task is explicitly a design-system update.

## 6. Visual Identity

The product should have a coherent visual identity.

Choose and reuse a small set of primary visual tokens:

* primary brand color
* secondary/accent color
* success color
* warning color
* destructive color
* muted surface color
* border color
* text hierarchy
* radius scale
* spacing rhythm

Use existing CSS variables and Tailwind conventions first.

Do not introduce random one-off colors for each screen.

Color should communicate meaning:

```txt
primary: main action / brand
success: completed / published / correct
warning: pending / needs attention
destructive: delete / reject / irreversible
muted: secondary information
```

Avoid:

* random gradients
* random accent colors
* inconsistent shadows
* inconsistent border radius
* different button styles for the same action type
* overusing bright colors in admin screens

## 7. Typography

Typography should improve hierarchy and readability.

For app/product screens:

* use existing project font conventions
* keep body text readable
* use clear heading hierarchy
* use muted text for descriptions
* avoid too many text sizes

For client/marketing pages:

* more expressive typography is allowed
* display font choices may be stronger if the project already supports them
* pair expressive headings with readable body text

Do not add external fonts or packages unless explicitly allowed.

Avoid:

* tiny labels
* low contrast helper text
* all text having the same visual weight
* using font changes as decoration without purpose

## 8. Layout and Spacing

Good UI comes from grouping, spacing, and hierarchy.

Use spacing to show relationships:

* related items should be close
* unrelated sections should have clear separation
* primary actions should be easy to find
* destructive actions should be visually separated

Avoid:

* four or more buttons with equal visual weight next to each other
* buttons that are too small to click comfortably
* pill-shaped buttons everywhere unless the design system intends it
* cramped dialog content
* tables without responsive overflow
* cards with inconsistent padding

When multiple actions are available:

```txt
Primary action: strong button
Secondary action: outline/secondary
Low-priority action: ghost/link/dropdown
Destructive action: destructive and separated
```

## 9. Dialogs and Feedback

Dialogs must help users make safe decisions.

Every important dialog should have:

* clear title
* concise description
* object name when applicable
* consequence of the action
* cancel action
* confirm action
* loading/disabled state during submit

For dialogs that include images, course names, or longer context, increase content width at the usage site instead of changing the global dialog component.

Example:

```tsx
<AlertDialogContent className="max-w-2xl">
  ...
</AlertDialogContent>
```

Use toast/notification conventions already present in the repo.

Do not install a new toast library.

Feedback rules:

* success should confirm what happened
* error should explain what failed
* pending state should prevent double submit
* validation errors should appear close to the field

## 10. Forms

Forms should be safe, clear, and hard to misuse.

Every form should consider:

* required fields
* helper text
* inline validation
* disabled state while submitting
* error state
* success feedback
* preserving input after failed submit
* mobile layout
* keyboard navigation

For dynamic exercise/question forms:

* make add/remove actions clear
* avoid accidental deletion
* keep field errors near the affected field
* prevent layout jumps when possible
* make answer options easy to scan
* separate content editing from destructive actions

Do not make forms visually clever at the cost of clarity.

## 11. Empty, Loading, Error, and Success States

Do not design only the happy path.

Every async UI should handle:

```txt
loading
empty
error
success or completion feedback
disabled/pending
```

Bad empty state:

```txt
No data.
```

Good empty state:

```txt
No lessons yet.
Create the first lesson to start building this course.
```

For admin and teacher screens, empty states should tell the user what happened and what to do next.

## 12. Motion

Use motion intentionally.

Allowed motion:

* hover/focus transitions
* dialog enter/exit
* collapsible sections
* flashcard flip
* answer reveal
* progress update
* completion celebration
* subtle page section reveal on marketing pages

Avoid:

* motion that delays repeated actions
* animation in dense admin tables
* distracting decorative motion in forms
* adding animation libraries unless already available
* excessive staggered effects in business screens

Motion should clarify state, not show off.

## 13. Responsive Design

Every UI change must consider mobile.

Check:

* 375px width
* tablet width
* desktop width
* long text
* nullable/missing images
* table overflow
* dialog width
* button wrapping
* tap target size

Use responsive layout intentionally:

* stack sections on mobile
* use `overflow-x-auto` for wide tables
* use `max-w-*` and responsive padding
* avoid fixed widths that overflow
* avoid hiding critical actions on mobile

## 14. Accessibility Baseline

Do not remove accessibility provided by shadcn/ui or Radix.

Maintain:

* semantic buttons
* input labels
* accessible dialog titles
* keyboard navigation
* visible focus states
* icon-only button labels
* sufficient contrast
* disabled and loading states
* clear error messages

Do not use clickable `div` when a `button` is appropriate.

## 15. Implementation Rules

Follow the existing codebase conventions.

Prefer:

* existing components
* existing shadcn/ui wrappers
* existing Tailwind patterns
* existing helper functions
* existing toast convention
* existing route/layout structure

Do not:

* install packages without permission
* run shadcn CLI without permission
* invent component paths
* rewrite large modules for a small UI task
* refactor unrelated files
* modify database, RLS, migrations, or generated database types from a UI task
* add mock production data unless explicitly requested
* fake success for actions that are not implemented

## 16. Design Review Before Finalizing

Before finishing any UI task, check:

```txt
1. Is the screen type identified correctly?
2. Does the visual style match the screen type?
3. Is the primary action obvious?
4. Are secondary/destructive actions correctly separated?
5. Are loading/empty/error/success states handled?
6. Are dialogs clear enough for the user to decide?
7. Is the layout safe on mobile?
8. Are nullable/missing values handled?
9. Did I avoid unnecessary shared component changes?
10. Does the UI match the product's overall visual identity?
```

## 17. Output Expectations

When completing a UI/design task, summarize:

```txt
- Screen type used
- Design direction
- Files changed
- Shared components touched: yes/no
- UI states handled
- Responsive considerations
- Accessibility considerations
- What was intentionally not changed
```
