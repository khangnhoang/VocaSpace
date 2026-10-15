# Admin / Business Operations

Use for dashboards, course review, users, payments, discounts, roles, moderation, and audit-like workflows.

Accepted design: read the Owner-accepted Admin screen-type design, `docs/ui-design-system-and-review/screen-types/admin-business-operations.md` (listed in `docs/ui-design-system-and-review/index.md`), before designing or reviewing an Admin screen. It owns the dark palette, typography, density, page frame, tables, filters, status, confirmations and motion; this reference only sets the direction. A new Admin page or redesign builds on it with no per-page brief, and the Owner reviews the running screen before merge. A change to the Admin design, a new palette or geometry, or a different destructive-confirmation model needs an explicit Owner decision first.

Direction:

* medium design latitude: polish through typography, spacing rhythm, data hierarchy, and smooth interaction, while staying direct, readable, predictable, safe, and information-dense without clutter
* establish identity through typography, spacing rhythm, data hierarchy, state language, and controlled brand color—not landing-page effects

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
* icon controls without an accessible name, a visible focus ring and the target size and touch boundary the Admin design and Button contract require (an icon-only edit or delete action that meets them is allowed)
* destructive actions that confirm from the entry control, or sit where a mis-tap lands on them (a destructive icon needs its own named confirmation dialog and the spacing the Admin design sets)
* clever interaction at the cost of predictability
