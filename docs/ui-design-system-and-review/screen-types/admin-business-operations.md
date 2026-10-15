# VocaSpace Admin Business Operations Screen-Type Design

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` — published as the Admin business-operations screen-type design on 2026-10-15 (Owner acceptance in chat via Main), together with the Product Language §2/§3.2 edit in section 3; not runtime implementation authority |
| Upstream contract | [Product Language](../product-language.md), [Button](../components/button.md) |
| Plan | [Screen-type design plan](../implementation-plans/screen-type-design/plan.md), checkpoints CP3 and CP4 |
| Repository evidence | The three admin screens (`/admin`, `/admin/courses`, `/admin/user-management`), the admin shell, and the AD3 Owner QA recorded in ADMIN-005, inspected 2026-10-15 |
| Computed evidence | A script computed WCAG 2.x contrast from the hex values for every pair in section 4, including the chart gradient (the result is reproduced there); the script is not committed |
| Review evidence | A non-authoritative interactive review aid outside the repository (palette plates, a populated courses queue with as-you-type search, a confirmation dialog, a summary panel, a dashboard whose revenue chart has a Cột / Xu hướng / Bảng view switch, and a users list with animated data bars and icon-only row actions, and state plates, at 1440 and 375 px) with deterministic synthetic data. It does not replace this document |
| Scope | Admin business operations: hierarchy, density, palette, page frame, tables, search and filters, status, summary panels, confirmations, pagination, states, responsive behavior, keyboard and focus, motion |
| Excludes | Runtime implementation, the admin page redesign, token or `.dark` variable changes, data queries and formulas, routes and permissions, and any Client / Marketing design |

This artifact specializes the Product Language for Admin. It says what an Admin screen should help an operator understand and do. It does not claim that the current admin pages conform, and the review-aid values are not production data.

## 1. Admin jobs and evidence boundary

Admin is a signed-in, low-frequency, high-consequence workspace for platform operators. Three jobs recur:

1. **Clear the queue.** See what needs a decision (courses waiting for review, longest wait first) and decide quickly with the facts beside the action.
2. **Find and inspect.** Locate a course or person by name or slug, open a summary without losing the list, and see status and history truthfully.
3. **Take a consequential action safely.** Approve, reject, demote, take down, edit a role or delete an account, with the object, the consequence and the reversibility visible before the final click.

Repository facts that shape this design (confirmed 2026-10-15):

- The admin shell hard-codes a dark slate stack and an unbordered surface layering with scattered literals; the shadcn `.dark` variables are defaults, not accepted values. The look is plain: every region is the same panel, hierarchy depends on size alone, and nothing marks what needs attention.
- `/admin/courses` is URL-driven: status tab and `q` live in the URL, `q` applies after a 300 ms debounce through `router.replace`, a new term resets the page, row actions open reason-required dialogs, and a summary sheet shows the course. These interaction decisions are sound and are kept.
- Typing in the course search feels abrupt (ADMIN-005). The cause is structural: each applied term causes a server render that swaps the results heading, the table or empty state and the pager in one step; the empty state and a full table have different heights; and nothing signals that a request is in flight. Section 8 answers this.
- The dashboard shows four icon cards, some with trend strings that the data layer does not compute. The users list uses uppercase wide-tracked column labels, per-role purple/blue chips, an icon-only delete button with no accessible name and an all-pages numbered pager. These are reported here as design defects for the redesign, not fixed by this document.

Review aids may use clearly labeled deterministic synthetic values. Queries, aggregation formulas and live values remain later runtime and domain work.

## 2. Design thesis and latitude

**Thesis: a calm, dense control room.** Admin is a dark, quiet workspace where the next decision is the loudest thing on the page, every number says what it measures, and nothing moves unless it explains a change.

Latitude is **medium**: Admin may be polished through typography, spacing rhythm, data hierarchy and smooth interaction, but it stays predictable and safe. Admin may not use landing-page effects, decorative backgrounds, gradients anywhere except the fill of a data bar (section 14), ornamental illustration, hidden actions, or clever interaction that costs predictability. Polish earns its place by speeding up a decision or reducing a mistake.

Principles:

- **Hierarchy before decoration.** Hierarchy comes from spacing, boundary, type weight and one accent, in that order, not from a different tint per card.
- **Attention is scarce.** One region per page is allowed to look urgent (the review queue); everything else stays neutral.
- **Truthful numbers.** A metric states its basis or period. No trend, ratio or comparison appears unless the data layer computes it.
- **Stable layout while data changes.** Searching, filtering, paging and acting never move the controls the operator is using.
- **Consequence is named.** An action says what it does, to what, and whether it can be undone.

## 3. Ownership and the Product Language edit

The Admin design is dark-only. Product Language §2 forbids a screen-type design from owning "a second palette", and the §3.2 note says the dark-only Admin direction is future scope. Reusing role names alone would not give Admin ownership of dark values, so this design carries a Product Language edit that the Owner accepted in the same decision.

Admin does not add roles. Every dark value in section 4 is the dark counterpart of an existing Product Language role. The edit is limited to ownership of those counterparts for Admin screens.

**Product Language §2 table, Screen-type design row, "Does not own" cell** (replaces "A second palette, font stack, radius family, or shadow system"):

> A second palette, font stack, radius family, or shadow system, except that the Admin screen-type design owns the dark values of Product Language roles for Admin screens

**Product Language §3.2 note** (replaces "The intended dark-only Admin direction is also future scope, not approval of current `.dark` variables or a product-wide dark theme. See Future product directions." — the preceding sentences of the note stay):

> Admin is dark-only: the Admin screen-type design owns the dark values of these roles for Admin screens only. That design is not approval of current `.dark` variables, of a product-wide dark theme, or of dark values for Learning Experience or Teacher Authoring. See Future product directions.

In Product Language the names "Admin screen-type design" and "Future product directions" are links to `./screen-types/admin-business-operations.md` and `./future-features.md`, as the existing note links the second.

The Owner accepted this edit with this design on 2026-10-15 and it is applied to Product Language in the same change. Learning Experience and Teacher Authoring dark counterparts remain future work.

### Exceptions to Product Language

Two things are not expressible with the accepted Product Language, and the Owner accepted both on 2026-10-15 (mono slug role and gradient with staggered reveal, as written below), together with one extension of the gradient exception, the quiet fade under the trend line, accepted on 2026-10-15 and written after the table. A third item, the sliding indicator of the tab-style selectors, is a small motion exception the Owner asked for and accepted on 2026-10-15, listed after the fade.

| Exception | Use | Reason | Boundary | Fallback |
| --- | --- | --- | --- | --- |
| Mono data role: Geist Mono, `12/16`, weight `500` | A course slug or an internal key shown as data in a table row or summary panel | Admins search and compare by slug; Product Language §4.2 allows a mono proposal only when a real user task consumes technical text, and this task does | Technical identifiers only: never labels, titles, numbers, dates or prose; never a UUID or database ID unless the task needs it | Geist Sans `12/16`, weight `500`, secondary text |
| Data-bar gradient and one-shot reveal | The fill of a bar or column that encodes a value in a chart or share bar (section 14), shaded from Action Blue `#2B6CED` to Route Blue `#60A5FA`, and revealed once by a staggered grow-in whose duration is proportional to the bar's length and whose whole sequence is at most `1200ms` (section 17) | The Owner asked for gradient fills and per-bar animation with longer bars running longer. Product Language has no gradient fill, and its motion roles stop at a `320ms` single cue or a `600–900ms` completion sequence that applies only when several semantic states change | Both gradient stops are existing roles (Action Blue and Route Blue), so no new color. Only the fill of a data bar uses it: never a surface, button, border, text or background. Text never sits on it. The reveal runs once per page view, never on search, filter, paging or refresh, never delays a label or number, and animates a paint-only clip, not layout | Solid Route Blue `#60A5FA` bars, drawn in place with no animation |

**Owner-accepted extension: quiet fade under the trend line.** The "Xu hướng" revenue view (section 14) fills the area under its line with a fade from Route Blue at `28%` opacity at the line to transparent at the baseline. This extends the data-bar-only gradient exception to this one decorative use, and the Owner accepted it on 2026-10-15 (round 4). The fade encodes nothing: the line, the markers and the direct labels carry the data, and the fade is decorative (it is `1.67:1` on Surface and is never relied on). Fallback: the line alone with no area. It never carries text, never appears outside the trend view, and is clipped and revealed together with the line (section 17); under reduced motion it is drawn static.

**Owner-accepted exception: sliding indicator on the tab-style selectors.** The accepted interaction-review aid shows the tab-style grammar with a bottom indicator that slides between options over `260ms` with `cubic-bezier(0.16, 1, 0.3, 1)`, and the Owner asked for the revenue view switch and the status tab selector to behave the same way. Product Language says that review-aid instance cannot establish a runtime duration or easing, and its roles give a selected-state change `220ms` with `cubic-bezier(0.2, 0, 0, 1)`, so a `260ms` slide with the micro-cue easing is recorded here as an exception, accepted with this design. Use: the `3px` Route Blue indicator of the revenue view switch (section 14) and of the status tab selector (section 8) only. Boundary: a `transform` translation only, never a layout animation; the options never move. Fallback: the indicator moves under the State transition role (`220ms`, `cubic-bezier(0.2, 0, 0, 1)`), and under reduced motion it moves with no transition.

## 4. Dark palette — counterparts of Product Language roles

Every row maps an existing role to its dark value. The light value is shown for the role mapping only. Ratios are computed from the hex values by script. Required: `4.5:1` for text, `3:1` for large text and for non-text (control boundaries, focus rings, meaningful icons, selected markers, chart series).

### 4.1 Ladder and accent (Owner-chosen)

| Role | Light | Admin dark | Notes |
| --- | --- | --- | --- |
| Canvas | `#F8FAFC` | `#0B1120` | Page and sidebar field |
| Surface | `#FFFFFF` | `#111827` | Work panels, dialogs, sheets |
| Subtle surface | `#F1F5F9` | `#1E293B` | Row hover, inset wells, count chips. Must stay at or near this value or darker (section 4.4) |
| Border | `#CBD5E1` | `#64748B` | Control boundaries |
| Muted border | `#E2E8F0` | `#334155` | Panel outlines and dividers; decorative, never the only identifier of a control |
| Primary text | `#0F172A` | `#F8FAFC` | |
| Secondary text | `#475569` | `#CBD5E1` | |
| Inactive text | `#64748B` | `#94A3B8` | |
| Route Blue (text, focus, marker) | `#2563EB` | `#60A5FA` | |
| Action Blue (filled primary) | `#2B6CED` | `#2B6CED` | Unchanged; white label |
| Recall Cyan | `#0E7490` | `#22D3EE` | |
| Growth Green | `#15803D` | `#4ADE80` | |
| Attention Amber | `#A16207` | `#FBBF24` | |
| Correction Red (text) | `#B91C1C` | `#F87171` | |
| Correction Red (filled confirmation) | `#B91C1C` | `#DC2626` | White label. The light value has `2.74:1` against dark Surface, below the `3:1` edge requirement |
| Route quiet / boundary | `#EFF6FF` / `#93C5FD` | `#172554` / `#1E40AF` | Selected row, current nav item |
| Cyan quiet / boundary | `#ECFEFF` / `#A5F3FC` | `#083344` / `#155E75` | |
| Green quiet / boundary | `#F0FDF4` / `#86EFAC` | `#052E16` / `#166534` | |
| Amber quiet / boundary | `#FFFBEB` / `#FCD34D` | `#451A03` / `#92400E` | |
| Red quiet / boundary | `#FEF2F2` / `#FCA5A5` | `#450A0A` / `#991B1B` | |

Layering: Canvas → Surface → Subtle surface. Panel lift is carried by the Muted border and spacing, not by the tint step (Surface on Canvas is `1.06:1`, informational only).

### 4.2 Computed contrast (ladder A Ink and Route Blue 400)

All 89 computed pairs pass; the load-bearing ones:

| Pair | Foreground / background | Ratio | Required |
| --- | --- | --- | --- |
| Primary text on Canvas / Surface / Subtle | `#F8FAFC` on `#0B1120` / `#111827` / `#1E293B` | 18.00 / 16.96 / 13.98 | 4.5 |
| Secondary text on Canvas / Surface | `#CBD5E1` | 12.68 / 11.95 | 4.5 |
| Inactive text on Canvas / Surface / Subtle | `#94A3B8` | 7.34 / 6.92 / 5.71 | 4.5 |
| Placeholder (Inactive) on input fill (Canvas) | `#94A3B8` on `#0B1120` | 7.34 | 4.5 |
| Route Blue text on Canvas / Surface / Subtle / Route quiet | `#60A5FA` | 7.41 / 6.98 / 5.75 / 5.78 | 4.5 |
| Primary text on Route quiet (selected row) | `#F8FAFC` on `#172554` | 14.04 | 4.5 |
| Inactive text on Route quiet | `#94A3B8` on `#172554` | 5.73 | 4.5 |
| State chip, Route / Cyan / Green / Amber / Red text on its quiet fill | `#60A5FA` on `#172554`; `#22D3EE` on `#083344`; `#4ADE80` on `#052E16`; `#FBBF24` on `#451A03`; `#F87171` on `#450A0A` | 5.78 / 7.41 / 8.55 / 8.97 / 5.84 | 4.5 |
| State text on Surface, Cyan / Green / Amber / Red | | 9.82 / 10.18 / 10.63 / 6.41 | 4.5 |
| White label on Action Blue / on Correction Red fill | `#FFFFFF` on `#2B6CED` / `#DC2626` | 4.70 / 4.83 | 4.5 |
| Border on Canvas / Surface / Subtle | `#64748B` | 3.96 / 3.73 / 3.07 | 3 |
| Focus ring (Route Blue) on Canvas / Surface / Subtle | `#60A5FA` | 7.41 / 6.98 / 5.75 | 3 |
| Action Blue fill edge on Surface / Subtle | `#2B6CED` | 3.78 / 3.11 | 3 |
| Correction Red fill edge on Surface / Subtle | `#DC2626` | 3.67 / 3.03 | 3 |
| Secondary / Inactive icon on Surface | `#CBD5E1` / `#94A3B8` | 11.95 / 6.92 | 3 |
| Route Blue selected marker on Canvas / Route quiet | | 7.41 / 5.78 | 3 |
| Chart series on Surface, Route Blue / Recall Cyan | | 6.98 / 9.82 | 3 |
| Chart gradient bar edge, worst of 101 samples between `#2B6CED` and `#60A5FA`, on Surface / on Subtle (bar track) | `#2B6CED` end | 3.78 / 3.11 | 3 |
| Route Blue icon or initials on Route quiet (icon tile, avatar); Recall Cyan icon on Cyan quiet | `#60A5FA` on `#172554`; `#22D3EE` on `#083344` | 5.78 / 7.41 | 4.5 |
| Trend view: line and markers (Route Blue) on Surface; marker ring (Surface) against the line | `#60A5FA` on `#111827` | 6.98 / 6.98 | 3 |
| Trend view: value label (Primary text) and month label (Secondary text) on Surface | `#F8FAFC` / `#CBD5E1` on `#111827` | 16.96 / 11.95 | 4.5 |
| Trend view: tooltip text, Primary and Route Blue value, on Subtle; tooltip edge (Border) on Surface; baseline (Border) on Surface | `#F8FAFC` / `#60A5FA` on `#1E293B`; `#64748B` on `#111827` | 13.98 / 5.75; 3.73; 3.73 | 4.5 / 4.5; 3; 3 |
| Trend view: quiet fade at its strongest (Route Blue at 28% on Surface, `#273F62`) on Surface; decorative, information only | `#273F62` on `#111827` | 1.67 | not a requirement |
| View switch: selected label and icon (Route Blue), unselected label (Secondary text), on Surface | `#60A5FA` / `#CBD5E1` on `#111827` | 6.98 / 11.95 | 4.5 |
| View switch: selected indicator `3px` (Route Blue), unselected icon (Secondary text), focus ring (Route Blue), on Surface | | 6.98 / 11.95 / 6.98 | 3 |
| View switch: hovered unselected label, Primary / Secondary text on Subtle | `#F8FAFC` / `#CBD5E1` on `#1E293B` | 13.98 / 9.85 | 4.5 |
| Row actions: edit icon (Secondary text) at rest on Surface / on Subtle row hover; on Muted border hover fill (Primary text) | `#CBD5E1` on `#111827` / `#1E293B`; `#F8FAFC` on `#334155` | 11.95 / 9.85; 9.90 | 3 |
| Row actions: delete icon (Correction Red text) at rest on Surface / on Subtle row hover; on Red quiet hover fill | `#F87171` on `#111827` / `#1E293B` / `#450A0A` | 6.41 / 5.29 / 5.84 | 3 |
| Row actions: own-row delete icon (Inactive text, aria-disabled) on Surface / on Subtle row hover | `#94A3B8` | 6.92 / 5.71 | 3 |
| Row actions: own-row tooltip text (Primary) on Subtle; own-row tooltip edge (Border) on Subtle; touch boundary (Border) on Surface / on Subtle | `#F8FAFC` on `#1E293B`; `#64748B` on `#1E293B` / `#111827` | 13.98; 3.07; 3.73 / 3.07 | 4.5; 3; 3 |
| Row actions: focus ring (Route Blue) on Surface / on Subtle row hover | `#60A5FA` | 6.98 / 5.75 | 3 |
| Row actions: edit hover fill (Muted border) against Subtle row hover; the same fill if it were Subtle; delete hover fill (Red quiet) against Subtle row hover; information only | `#334155` / `#1E293B` / `#450A0A` on `#1E293B` | 1.41 / 1.00 / 1.10 | not a requirement |
| Logo lowest gradient stop `#2F6FF0` on Canvas (sidebar) | | 4.17 | 3 |
| Muted border / Surface / Subtle (information only) | `#334155` on Surface; `#111827` on Canvas; `#1E293B` on Surface | 1.71 / 1.06 / 1.21 | not a requirement |

The light Product Language values are not reused on dark: Route Blue `#2563EB` on Surface is `3.43:1` and Recall Cyan `#0E7490` is `3.31:1`, both below the `4.5:1` text requirement.

### 4.3 Chart gradient and text

The Owner chose ladder A Ink and Route Blue `#60A5FA` on 2026-10-15; the alternatives are dropped. A data-bar gradient runs from Action Blue `#2B6CED` to Route Blue `#60A5FA`. The script samples the gradient at 101 points and reports the worst one against each background: the bar edge is `3.78:1` on Surface and `3.11:1` on the Subtle track, both at the darker Action Blue end and above `3:1`, so the bar's boundary is the bar itself and no outline is needed.

Text cannot sit on the gradient: Primary text on the lightest stop `#60A5FA` is `2.43:1` and Secondary text `1.71:1`, both below `4.5:1`. Every label, value and percentage therefore sits beside or above its bar on Surface (Primary text `16.96:1`, Secondary text `11.95:1`, Inactive text `6.92:1`), never on a gradient.

The trend view stays within the same roles. The line and markers are Route Blue (`6.98:1` on Surface), each marker is ringed in Surface so it stays distinct where it interrupts the line (`6.98:1` ring against the line), and every value is a direct label in Primary text on Surface, never on the fade. The fade is decorative and is the one part below `3:1` (`1.67:1`); it is allowed because it carries no data and no text.

### 4.4 Constraint for future palette edits

Row hover uses Subtle surface and every control boundary and fill edge must keep `3:1` against it. Border on Subtle is `3.07:1`, Action Blue edge `3.11:1` and Red edge `3.03:1`, so Subtle must not be made lighter than `#1E293B` without recomputing. Row hover is also Subtle, so a control inside a row cannot use Subtle as its own hover fill: it would be `1.00:1` against the hovered row and invisible. In-row hover fills therefore step one level lighter (Muted border `#334155`, `1.41:1` against the hovered row) or use a tinted quiet fill (Red quiet). An early ladder with Surface `#1E293B` and Subtle `#2B3A52` failed `3:1` for the Action Blue and Red fill edges on hover.

### 4.5 Color rules specific to Admin

- Selected and current use Route quiet with a Route Blue marker, text and `aria-current` or `aria-selected`; never a fill alone.
- State color always pairs with an icon and text (section 9). Amber is reserved for warning and waiting; it is not a chart or category color.
- Charts use the Action Blue to Route Blue gradient as the fill for a value-encoding bar (section 14) and neutral text colors elsewhere. Categories are separated by direct labels and position, not hue, so one gradient serves every bar. State colors never encode categories.
- Color beyond Route Blue comes only from quiet role pairs: an Amber quiet panel for the waiting queue, and Route or Recall Cyan quiet icon tiles that identify a metric or a role group. The tile color says "which measure", not a state.
- Reduced transparency: no translucent work surface; the dialog backdrop dims the page without blur.

## 5. Typography and density

Admin uses Product Language families: Plus Jakarta Sans for most text, Geist Sans for utility, and the section 3 mono exception.

| Use | Role | Admin value |
| --- | --- | --- |
| Page title | Heading 2 | `24/32`, weight `700`, tracking `-0.01em`. Owner-chosen: Heading 1 `32/40` is the Product Language default for a route title; Admin uses the smaller role because the shell already names the area |
| Region or panel title | Heading 3 | `18/26` or `16/24`, weight `700` |
| Body and table cell | Body | `14/22` |
| Action and field label | Label/action | `14/20`, weight `600` |
| Column header, count line, metadata | Utility/caption | Geist Sans `12/16`, weight `600` for headers, `500` for metadata; sentence case, tracking `0.02em`, never uppercase and wide-tracked |
| Metric value | Data emphasis | `28/34`, weight `800`, tabular numerals |
| Slug and internal key | Mono exception | Geist Mono `12/16`, weight `500` |

Rules:

- Numbers, prices, counts and dates use tabular numerals and a fixed format; a date shows the same format in the table, the sheet and the dialog.
- Table text stays at `14/22` and metadata at least `12/16`. Density comes from row height and spacing, not from smaller text.
- Spacing follows the Product Language `4px` rhythm: `16–24px` panel padding, `20–24px` between regions, `12–16px` between controls in a toolbar.
- Long titles wrap; truncation only when the full value is in the summary panel or the accessible name.

## 6. Page frame

- **Shell.** A fixed `248px` sidebar on Canvas (product logo, one navigation group, current item), a `56px` top bar with orientation and the account, and a single scrolling content column. Content is at most `1184px` wide, centered, with `24px` padding (`16px` on narrow screens).
- **Sidebar.** Items are `40px` high with an icon, a label and `aria-current="page"`. The current item uses Route quiet, Route Blue text and a `3px` marker. A pending-review count may appear on the Courses item in the Attention Amber pair with an accessible label, only when the layout can read it without a new query path; otherwise omit it.
- **Top bar.** Breadcrumb or area name on the left, account on the right. It holds no search or notification control until that control works; a control that does nothing is not shown.
- **Page title.** Exactly one `h1`, with a one-sentence purpose line in secondary text. Page-level actions sit on the right of the title row; a page has at most one filled primary action.
- **Order.** Needs-attention region first, then summary metrics, then the working list.
- **Narrow screens.** The sidebar becomes a menu button in the top bar that opens a modal navigation panel; the page keeps one column.

## 7. Tables and lists

A table is a bounded Surface panel with the `16px` Section radius and a Muted border. The column header row uses Canvas as its fill, sentence-case Utility/caption labels and a bottom divider.

- **First column.** Title in weight `700` (a button when it opens a summary), slug beneath it in the mono role. The title opens the summary panel and carries an accessible hint, not the full row.
- **Columns.** Owner, price, status, time, actions. The time cell shows the relevant timestamp and, for the review queue, `Đã chờ N ngày` in Attention Amber. Order: the queue sorts by longest wait first, other tabs by most recent change; the count line states the order (section 8).
- **Row.** `64px` minimum height, one divider per row, hover on Subtle surface in `120ms`, selected row (summary open) on Route quiet with the Route Blue marker.
- **Row actions, labeled (course queue and published rows).** In the review queue the primary action is a Compact (`32px`) Action Blue Button "Duyệt" and the destructive entry is the quiet red "Từ chối". On published rows the safe action is outlined and the destructive entry is quiet red text. The two sit side by side with `8px` of space and no divider or separator between them. Row actions never reorder the row.
- **Reason shown in context.** A rejection reason appears inside the row on a red-quiet note with the label "Lý do từ chối", not only in the sheet.
- **Narrow screens.** The table becomes stacked rows: title, labeled values, status chip, then actions at full width as `44px` Buttons. Headers become visually hidden labels.
- **Lists of people.** The users list uses the same row, divider and hover language. A summary strip above the list shows one count per role in an icon tile with a share bar (section 14). The avatar is a circle with a thin Action Blue to Route Blue ring on a Route quiet fill with Route Blue initials; a photo replaces the initials when there is one. Role is a neutral chip with an icon (section 9), not a color per role. Row actions are two icon-only buttons (next bullet). At narrow widths role and join date stay on the row, stacked under the name.
- **Row actions, icon-only (users list).** Edit is a pencil and delete is a trash can, `8px` apart, no divider. Geometry is the Button contract's Comfortable icon-only role (`44 × 44px`, `8px` radius, `20px` icon): it is the smallest contract size that meets the Owner's `40px` floor, and `44px` also covers touch.
  - *Rest, on a primary input with hover and a fine pointer* (Button contract section 5): glyph only, no border and no fill. Edit glyph in Secondary text; delete glyph in Correction Red text.
  - *Hover and keyboard focus:* a quiet fill with the `8px` radius and the `2px` Route Blue focus ring. Edit fills with Muted border `#334155` (glyph turns Primary text); delete fills with Red quiet `#450A0A` (glyph stays Correction Red text). The Owner asked for a Subtle hover on edit; Subtle is the row's own hover color, so it would show nothing (section 4.4), and the Owner chose Muted border as the substitute (section 19).
  - *Touch-primary input* (no hover or no fine pointer): the button keeps a visible Border `#64748B` boundary (`3.73:1` on Surface, `3.07:1` on Subtle) as the Button contract requires, at `44 × 44px`.
  - *Name, no tooltip.* Each button has an `aria-label` naming the action and the person ("Sửa Nguyễn Văn An", "Xóa Nguyễn Văn An"). The Owner removed the hover and focus tooltip text on these two buttons, so the glyph, the accessible name and the confirmation dialog carry the meaning. The only tooltip in the row is the own-row reason below.
  - *Delete* opens the existing reason-required confirmation dialog (section 11). Icon-only does not change the destructive confirmation model: the dialog names the person, states the consequence and requires the reason.
- **Own row.** The signed-in admin cannot delete themselves. On a pointer, the trash icon stays in place, so the column stays aligned, as `aria-disabled="true"` (not the `disabled` attribute, so it stays focusable and its tooltip can open on keyboard focus) in Inactive text, no hover fill, with a tooltip that is also its `aria-describedby` text, "Không thể xóa chính bạn" (the Owner kept this tooltip), and activating it does nothing. The tooltip shows on hover and on focus, stays while the pointer is over it, closes on Escape without moving focus, and sits on Subtle with a Border edge. On touch-primary layouts, where no tooltip can open, the short text "Không thể xóa chính bạn" replaces the disabled icon so the reason is visible. Showing the short text on every layout instead would be visible everywhere but would break the column alignment.

## 8. Search and filters

Search and status filters are the primary way an operator moves through data, so they must never make the page move.

### 8.1 Filter structure

- One panel holds the search field and the status tab selector. The tab selector uses the same grammar as the revenue view switch (section 14): five equal columns under one `1px` Muted border that runs across the whole width of the panel content, options at least `44px` high with an icon, a label and a neutral count chip, Secondary text when unselected, Route Blue text and weight `700` when selected, a top-rounded quiet Subtle hover, and one `3px` Route Blue indicator, one fifth wide, that slides to the chosen option (section 17). The options never move. No box is nested in a box. Below `640px` the columns keep a minimum width and the control scrolls horizontally.
- Status, search term and page live in the URL as today, so a view is shareable and Back works. Changing the status resets the page and keeps the term; changing the term resets the page.
- The search field is `40px`, `12px` radius, Border boundary, a leading search icon and a clear button (`32px`) when it has a value. It is a `role="search"` form; Enter applies immediately.

### 8.2 As-you-type search with no visible jump

The accepted behavior, to be implemented in the page redesign:

1. **Typing is never interrupted.** The input is the source of truth while the operator types; the caret, focus and composition are not touched by a result update. The debounce stays at `300 ms`. While an input method editor is composing (Vietnamese Telex or VNI), no request is made until composition ends.
2. **The results region is a stable region.** The region keeps the same container, the same heading, the same count line and the same minimum height (a full page of rows plus the pager) from the first keystroke to the last result. The heading is fixed text for the list; the term and the count appear in the count line, not in the heading.
3. **Stale-while-pending.** While a request is in flight the previous rows stay on screen. A `2px` Route Blue progress bar across the top of the region and `aria-busy="true"` signal the request. There is no spinner, no skeleton swap and no row fade for a refresh. Reduced motion shows the bar as a static line.
4. **One swap.** When results arrive, rows, count line and pager change together, in place, with no layout shift. The pager stays pinned to the bottom of the region minimum height.
5. **Empty is inside the region.** An empty result renders inside the same minimum height, names the term and the status, and offers "Xóa tìm kiếm"; it does not collapse the page.
6. **Latest wins.** A response for an older term never replaces a newer one. A failed request keeps the previous rows, shows the error inline in the region (section 13) and keeps the term.
7. **Announce, do not steal focus.** The count line is a polite status region and reads "N khóa học trong «Tab» khớp với «term»". Focus stays in the input. Clear returns focus to the input.

The current page jumps because the heading and body swap in one step, the empty state has a different height than a full table and nothing shows that a request is running. A stable region, a pending bar and one in-place swap remove those causes without changing the URL model.

### 8.3 Other filters

A select filter (for example role) is a `40px` field with a visible label or an icon plus label, applies immediately and also resets the page. Applied filters are visible in the count line.

## 9. Status language

State is always icon plus text; color is a third signal, never the only one.

| Status | Pair | Icon | Text |
| --- | --- | --- | --- |
| Pending review | Attention Amber | clock | Chờ duyệt |
| Published | Growth Green | check circle | Đã xuất bản |
| Draft | Neutral (Subtle surface, secondary text) | file | Bản nháp |
| Removed | Correction Red | ban | Đã gỡ |

- A status is a `24px` chip with the full-pill radius, a `14px` icon, label weight `600` and the quiet fill with its state boundary. It is not a Button: no hover change, no pointer, not in the tab order.
- Roles (Học viên, Giáo viên, Quản trị viên) are neutral chips with the same geometry. No color per role.
- A count is a neutral pill; the active tab's count uses Route quiet.
- Status chips, tab selectors and action Buttons stay visually distinct by role: chips are full pills with no hover, tabs have an indicator, Buttons are `8px` rectangles.

## 10. Summary panels

A summary panel lets the operator inspect without leaving the list.

- **Container.** A side sheet on wide screens (up to `576px`, Surface, Muted border, Product Language Level 2 elevation recipe adapted for dark in section 17) and a full-screen panel on narrow ones. It is modal with a dimmed backdrop, traps focus, closes on Escape and returns focus to the title that opened it. The list row stays marked as selected while it is open.
- **Order of content.** Title and slug, then a facts grid (status, owner, price, submission time and wait), then the rejection reason when present, then description, then the chapter and lesson structure with each item's status chip.
- **Footer.** The same actions as the row, in the same style, so the operator can decide with all facts on screen. The action opens the confirmation dialog on top; on success the sheet closes and focus lands on the list heading.
- **No silent mutation.** The sheet never changes data by itself.

## 11. Consequential-action confirmations

Admin keeps the Product Language §8 destructive pattern and the Button contract; it does not introduce a new confirmation model.

- **Entry** is a quiet red or outlined control that names the verb and the object ("Gỡ khóa học"). An icon-only entry (the trash in a people list) names the verb and the person in its accessible name, and the dialog names the person visibly. An entry never confirms by itself.
- **Dialog content, in order:** title that names the action; one sentence on the consequence for the public and for the owner; an identity block (title, slug, owner, price, current status chip); an irreversible callout in the Amber pair when the action cannot be undone from Admin ("Không thể hoàn tác"); the reason field when the action needs a reason; a reversibility line; then Cancel and the confirm action.
- **Reason.** Reject, demote and take down require a reason (limits as the schemas define: today `1000` and `2000` characters). The label states who reads it, the help text says where it is stored, and a character count shows the limit. An empty reason keeps the dialog open, marks the field invalid with a red boundary plus message, and moves focus to the field. The reason the operator typed is never lost to a validation or stale error.
- **Confirm button.** Strong Correction Red (`#DC2626`, white label) only after the consequence is explicit, for destructive actions; Action Blue for approve. Cancel is outlined and sits to the left of the confirm action on wide screens and below it on narrow screens (stacked, `44px`).
- **Pending.** On submit both buttons disable, the confirm label becomes the in-progress verb with a progress icon, the width does not change, and Escape and backdrop clicks are ignored until the request ends.
- **Result.** The dialog closes, the list refreshes, a status toast confirms, and focus moves to the list heading. A failure stays in the dialog with the message and the reason intact.
- **Focus.** On open, focus goes to the reason field when there is one, otherwise to Cancel for an irreversible action or to the confirm action for approve. Closing without a result returns focus to the control that opened it.
- **Toasts.** A toast on a dark shell uses the dark Surface and Primary text, with a polite status role; it is not a light toast on a dark page.

## 12. Pagination

- A line states the window ("Hiển thị 1–20 trong tổng số 63 khóa học") in the Utility role.
- Previous and next are `36px` square icon Buttons with accessible names ("Trang trước", "Trang sau"); a current-page field accepts a typed page number and shows "/ N". There is no row of every page number, which does not scale. On narrow screens the controls are `44px`.
- Paging keeps the filter and term, scrolls the list to the top of the region and moves focus to the list heading. When the result fits on one page the pager shows only the window line and "1 / 1".

## 13. Loading, empty, error, permission and stale states

| State | Behavior |
| --- | --- |
| Initial load | Static placeholder rows in the table shape; no shimmer. The first paint keeps the region's minimum height |
| Refresh (search, filter, page, action) | Previous rows stay; a `2px` progress bar and `aria-busy` show the request (section 8.2). No skeleton swap |
| Empty because of a filter or term | Inside the region: message naming the term and tab, and a "Xóa tìm kiếm" Button |
| Empty because nothing exists | Plain message and what makes entries appear ("Khi có khóa học mới…"); no marketing illustration |
| Error loading | Inline in the region with an alert icon, the cause in plain words, that the filters are kept, and a "Thử lại" Button; the previous rows stay if there were any |
| Permission | An action the signed-in admin cannot take is hidden when the page would otherwise promise it, or shown disabled with a nearby reason when the block is not obvious (for example, one's own account). A route the admin may not open shows a plain access-denied panel, not a blank page |
| Stale | When another admin already handled the object, the dialog explains who or what changed ("đã được duyệt cách đây 2 phút"), nothing was applied, the list refreshes and the typed reason is kept |

Success confirmation is a status toast plus the changed row; the toast never carries the only record of the result.

## 14. Dashboard

- **First region: needs attention.** An Amber quiet panel with an Amber boundary and a clock tile states how many courses wait, the longest wait, and one Action Blue button into the queue. When nothing waits it says so in plain text and uses the neutral style.
- **One metric band.** Four to five metrics in a single Surface panel separated by dividers, not four separate cards. Each metric has an icon tile (Route quiet or Cyan quiet, naming the measure), a label, a value in the Data emphasis role and a one-line basis or period ("Thanh toán thành công, 6 tháng gần nhất"). No trend, percentage or "vs last period" text appears unless the data layer computes it.
- **Charts.** A chart has a title, a unit, a one-line description of what it measures and direct labels on the values. Value-encoding bars use the data-bar gradient from section 4.3: a column chart has the value above each column and the month beneath it on a Border baseline with Muted gridlines; a composition is a list of labeled horizontal bars with count and share, not a donut. Text never sits on a bar. A bar's length or height is proportional to its value from zero, and the smallest non-zero bar keeps a visible minimum. Values are also available as a table for assistive technology and exact reading.
- **Revenue chart: one dataset, three views.** The "Doanh thu theo tháng" card has a view switch on its own row under the title and description, with "Cột", "Xu hướng" and "Bảng". It follows the tab-style grammar of the accepted interaction-review aid (`.mode-tabs`): a grid of three equal columns whose `1px` Muted border runs along the whole bottom of the control, and the control spans the full content width of the card, so the line is as wide as the title and the chart baseline, not only as wide as the three options. Options are at least `44px` high with an icon and a label, Secondary text when unselected, Route Blue text and weight `700` when selected, and a top-rounded quiet Subtle hover. One `3px` Route Blue indicator (`border-radius: 3px 3px 0 0`, sitting on the border, one third of the width) marks the selected option and slides to the chosen one (section 17). The options never move on hover or selection. All three views show the same six values in the same unit (millions of đồng, successful payments); the view is a presentation choice, not a filter, and no view shows a computed trend percentage, growth rate or comparison with a previous period. "Xu hướng" names a chart type, not a computed claim. The card body keeps a constant height (`262px` in the aid), so switching never moves the page. The choice lives in client state only; remembering it is later work. Default view: "Xu hướng" (Owner decision, section 19).
- **Cột view.** The gradient column chart described above.
- **Xu hướng view.** A `3px` Route Blue line through one `12px` Route Blue marker per month, each marker ringed in Surface, on the same Border baseline and Muted gridlines; the value axis starts at zero so heights stay proportional. Each point has its value as a direct label above it (Primary text, weight `700`, tabular numerals) and the month label beneath (Secondary text). The quiet fade under the line is an Owner-accepted extension of the gradient exception (section 3), with a line-only fallback. The plot is one focusable group: hover or Left and Right Arrow shows a tooltip with the month and the exact amount ("Tháng 8 · 12.000.000 ₫") and a polite live region announces the same text, so the exact reading is not hover-only.
- **Bảng view.** A table with "Tháng" and "Doanh thu (triệu ₫)" columns, tabular numerals, right-aligned amounts, a visually hidden caption, and the same row and divider language as section 7.
- **Reveal.** Bars grow in once when the chart first becomes visible, in order, each over a duration proportional to its length; the trend line draws once from left to right (section 17). Numbers and labels are visible immediately.
- **No filler.** A metric or chart with no source of truth is omitted.

## 15. Responsive behavior

- **Wide (at least `1024px`).** Sidebar plus content; tables with all columns; summary sheet beside the list.
- **Medium.** The sidebar collapses into the menu button; the table keeps its columns and may drop the time column into the first cell; the metric band becomes two columns.
- **Narrow (below `640px`).** One column; the toolbar stacks; the status tab selector scrolls horizontally and keeps `44px` targets; rows become stacked labeled values with full-width `44px` labeled actions, or `44 × 44px` icon-only actions with a visible boundary and, for the own row, the short text in place of the disabled icon; dialogs and the summary panel fill the screen with stacked `44px` footer buttons; the metric band is one column. The page never scrolls sideways.
- The page keeps all information it has on wide screens; a narrow screen reorders, it does not remove status, wait time or reasons.

## 16. Keyboard, focus and accessibility

- Every control is reachable and operable by keyboard with a visible Route Blue ring of at least `2px`, separated from the boundary, and `3:1` against every surface (section 4.2).
- Landmarks: one `nav`, one `main`, one `h1`; results sit in a labeled region; the list heading is programmatically focusable and receives focus after paging and after an action completes.
- The tab selector uses `role="tablist"` with `aria-selected`, or an equivalent native pattern, and arrow-key support; counts are included in the accessible name.
- The revenue view switch is a `tablist` with roving `tabindex` (only the selected tab is in the Tab order), Left and Right Arrow moving and wrapping among the three tabs, Home and End jumping to the first and last, each tab controlling a `tabpanel` named by its tab; the hidden panels are not in the accessibility tree; the sliding indicator is decorative and hidden from assistive technology. The trend view is a focusable group named "Doanh thu theo tháng, dạng xu hướng", with Left and Right Arrow moving between points, a tooltip tied to the active point and a polite live region announcing "Tháng 8: 12.000.000 ₫". The column view has a text alternative with all six values, and the table view is a real table with a caption.
- Icon-only controls are allowed where the glyph is a universal action (pencil for edit, trash for delete) and only with all of: an accessible name that names the action and the object ("Sửa Nguyễn Văn An", "Xóa Nguyễn Văn An"), a visible focus ring, a target of at least `44 × 44px`, `3:1` glyph contrast against its ground and its hover fill, and on touch-primary input a visible boundary. A tooltip is not required; where one is shown (the own-row reason) it stays while hovered or focused and closes on Escape, and it never replaces the accessible name. A destructive icon-only entry still opens the confirmation dialog (section 11) and is not the confirmation.
- An unavailable action stays discoverable: the own-row delete is `aria-disabled` and focusable with its reason as the accessible description, not removed.
- Dialogs and the summary panel are modal: focus trap, Escape closes unless a request is pending, focus returns to the opener, and the background is inert.
- Status, error and count changes use polite live regions; an error that blocks the task uses `role="alert"`.
- Color never carries meaning alone; contrast is as computed in section 4.2 and is rechecked by script for any changed value.
- Touch targets are at least `44 × 44px` on touch-primary layouts, and `32px` Compact Buttons appear only where a fine pointer is the primary input.

## 17. Motion and elevation

Admin uses the Product Language motion roles, plus the data-bar reveal below, which is the exception in section 3.

- **Immediate response (`120ms`)** for hover, focus emphasis and the progress bar's appearance. **State transition (`220ms`)** for selected state and validation feedback. **Spatial transition (`240ms`)** for the dialog and the summary sheet, as a small opacity and translation (`24px` or less).
- All easing is `cubic-bezier(0.2, 0, 0, 1)`. Feedback never waits for an animation.
- **Data-bar reveal (exception).** Each bar or column in a chart or share bar is revealed once when its chart first enters view (and once again for a revenue chart each time the operator picks another view, section 14), by an animated paint-only clip that grows from the baseline, with the gradient intact; width and height never animate. Duration is `200ms + 700ms × (value ÷ largest value in the chart)`, so the longest bar takes `900ms` and a short bar `200–300ms`. Bars start in order with a stagger of `min(100ms, 300ms ÷ (bars − 1))`, so the whole sequence ends within `1200ms` (six revenue columns: longest column `900ms`, last start `300ms`). Easing is `cubic-bezier(0.2, 0, 0, 1)`. It runs once per page view and never on search, filter, paging, refresh or data update; values update in place. The only other trigger is the operator's own view switch on the revenue chart, which replays the chosen view once.
- **Trend reveal (same exception).** In the "Xu hướng" view the line and the fade are revealed left to right by a paint-only `clip-path` over `900ms` with the same easing, and each marker fades in over `120ms` as the line reaches it, so the sequence ends within `1200ms`. Labels and values are visible from the first frame. Switching views keeps the card height, replays the chosen view's reveal once, never delays input (a new switch cancels the running reveal), and the "Bảng" view has no reveal. Reduced motion draws the line, markers and fade static and does not replay. Numbers, labels and the table are visible from the first frame, and a reveal never blocks input.
- The only repeating motion is the `2px` progress bar while a request is in flight, and it stops when the request stops. No shimmer, pulse, bounce, count-up or decorative animation.
- **Tab-selector indicator (exception).** The `3px` indicator of the revenue view switch and of the status tab selector slides between options by `transform: translateX` over `260ms` with `cubic-bezier(0.16, 1, 0.3, 1)` (section 3); option color and the hover tint change over `120ms`; the chosen view's own reveal, or the new status list, starts on selection and does not wait for the slide. Under reduced motion the indicator has no transition.
- Reduced motion removes translation (including the tab-selector indicators, which move with no transition), the sliding progress bar (it shows as a static line) and the data-bar reveal (bars are drawn at full length at once), presents other final states at once or with an opacity change of at most `100ms`, and keeps text, focus and next actions the same. Admin honours the operating-system `prefers-reduced-motion` setting only; a product-level preference is future work recorded in [Future product directions](../future-features.md).
- **Elevation on dark.** Hierarchy comes from the surface step, boundary and spacing. Floating surfaces (sheet, menu) may use the Level 2 recipe and modal surfaces the Level 3 recipe with a darker shadow color (black at the Product Language alpha or stronger) over a dimmed backdrop; the border, not the shadow, carries the edge.

## 18. Representative patterns

The review aid shows these as evidence of intent, not as required layout:

| Pattern | Shows |
| --- | --- |
| Palette plate | Roles, dark values and computed pairs for the chosen ladder and accent |
| Courses queue | Frame, toolbar, tab selector with counts, table with wait time and row actions, pager, summary sheet |
| As-you-type search | The proposed stable region and, for comparison, the current jump |
| Confirmation dialog | Approve, reject (reason), demote and take down (irreversible callout) |
| Dashboard | Amber quiet needs-attention panel, metric band with icon tiles, a revenue card with the Cột / Xu hướng / Bảng view switch (gradient columns, trend line with direct labels and a keyboard tooltip, table), labeled gradient share bars, with the staggered reveal and a replay control (aid only) |
| Users list | Role summary strip with share bars, gradient-ringed avatars, neutral role chips with icons, icon-only edit and delete (named by `aria-label`, no tooltip), hover and focus states, the own-row treatment with its reason tooltip, typed-page pager. The course queue shows labeled Duyệt / Từ chối with no divider |
| State plates | Loading, empty, error and stale |

The aid is a 1440 px and 375 px review of these patterns with deterministic synthetic data and is deleted after the Owner decision.

## 19. Choices for the Owner

Decided by the Owner on 2026-10-15:

| Choice | Decided value |
| --- | --- |
| Neutral ladder | A Ink: Canvas `#0B1120`, Surface `#111827`, Subtle `#1E293B` |
| Route accent | Blue 400 `#60A5FA` |
| Page title size | Heading 2 role (`24/32`, 700) |
| Pagination | Previous, next and a typed page field |
| Mono slug role | Geist Mono `12/16`, course slugs only, as the exception in section 3 |
| Row-action tooltips | None on the edit and delete icon buttons; the own-row "Không thể xóa chính bạn" tooltip stays |
| Revenue view switch | The interaction-review `.mode-tabs` grammar: three equal columns, the bottom border across the full card content width, a `3px` Route Blue indicator that slides (the `260ms` slide is the exception in section 3) |
| Status tab selector (section 8) | Same grammar as the revenue view switch: five equal columns, full-width bottom border, `3px` sliding indicator |
| Icon-only row actions | `44 × 44px` (Button Comfortable) edit and delete icon buttons |
| Own-row delete | Disabled icon with tooltip and description on a pointer, short text on touch layouts (section 7) |
| Data-bar gradient and staggered reveal | Accepted as the exception in section 3 (Action Blue to Route Blue on value-encoding bars only; reveal at most `1200ms`, once) |
| Sidebar pending count | Shown only when the layout reads it without a new query path; otherwise omitted |
| Default revenue view | "Xu hướng"; "Cột" and "Bảng" stay one click away |
| Edit icon hover fill | Muted border `#334155`, because Subtle equals the row hover and would be invisible (`1.00:1`) |
| Quiet fade under the trend line | Kept as an Owner-accepted extension of the gradient exception in section 3 (Route Blue at `28%` to transparent, decorative, trend view only); line-only fallback stays; static under reduced motion |

No choice is open. The Owner's acceptance on 2026-10-15 fixes these values and the exceptions in section 3. A change to any of them is a later Owner decision under the design lifecycle.

## 20. Review and falsification checklist

An Admin screen fails review if any of these is true:

1. A color, radius, shadow or font exists that is not a Product Language role or a section 3 exception, or a text pair is below `4.5:1` or a control boundary, focus ring or meaningful icon is below `3:1`.
2. A search or filter change moves the heading, the toolbar, the pager or the page height, steals focus from the input, or replaces newer results with older ones.
3. A destructive action has no named object, no stated consequence or reversibility, no cancel, or confirms from the entry control.
4. A metric has no basis or period, or shows a trend, ratio or comparison the data layer does not compute.
5. Status relies on color alone, or a status chip behaves like a Button.
6. A control is hidden, icon-only without an accessible name that names the action and the object, or shown without working.
7. The page shifts sideways or loses status, wait time or reasons at `375px`.
8. Landing-page effects, decorative backgrounds, perpetual animation or hidden actions appear.
9. A gradient appears anywhere other than the fill of a value-encoding bar, text sits on a gradient, or a bar edge is below `3:1` against its background.
10. A data-bar or trend reveal replays on search, filter, paging or refresh (the revenue view switch may replay the chosen view once), runs longer than `1200ms` in total, delays a label or number, or ignores `prefers-reduced-motion`.
11. Row actions have a divider or separator between them, or an icon-only row action lacks any of: an accessible name with action and person, a focus ring, a `44px` target, `3:1` glyph contrast on its ground and hover fill, a visible boundary on touch input; or the own-row delete is removed instead of shown unavailable with its reason.
12. A chart view switch changes the card height, is not operable by arrow keys, hides data in one of its views, or any view shows a trend percentage, growth rate or comparison the data layer does not compute.
13. The trend view carries meaning by color or fill alone, has no direct labels or keyboard-reachable tooltip, starts its value axis above zero, or puts text on the fade.
14. A tab selector (the revenue view switch or the status tab selector) is not equal options under one bottom border across its full content width, has options below `44px` or that move on hover or selection, lacks the `3px` Route Blue indicator, moves it without the `260ms` slide, or animates it under `prefers-reduced-motion`.

## 21. Explicit non-goals and downstream ownership

- Runtime implementation: the admin page redesign, the search fix, the pagination change, token and `.dark` variable mapping, and shell colors are a later change that builds on this design and the Owner reviews the running screens.
- Data: queries, formulas, the pending-count source and any chart data are owned by the data layer; this design only constrains how they are shown.
- The dashboard's fabricated trend strings, the non-functional header search, the placeholder avatar, the double `h1`, the icon-only delete with no accessible name (icon-only is allowed under section 16 once it has one), the all-pages numbered pager and the light shared toast are existing defects reported for the redesign; this design does not fix them.
- The current dashboard revenue chart is an off-palette purple area chart with no view switch, and its "Theo tuần" select does nothing. Both are existing defects reported for the redesign, not fixed here.
- Exact shared-component construction remains owned by the component contracts. This design does not change Button geometry or the destructive split.
- Learning Experience and Teacher Authoring dark values, a product-wide dark theme and Client / Marketing design are separate decisions.

## 22. Acceptance boundary

The Owner's acceptance on 2026-10-15 published this design as the Admin screen-type design and applied the Product Language edit in section 3 in the same decision. It does not approve any runtime change. Later Owner decisions change the Admin design under the design lifecycle; a new palette, geometry or destructive-confirmation model needs an explicit Owner decision.
