# Teacher Course Structure — Design Brief

| Field | Value |
| --- | --- |
| Status | Brief condensed from the accepted full spec (`6e771ce`) on 2026-10-02 without changing a design decision; Owner acceptance of the brief as the surface template is pending. Approval and history follow the [index](../../index.md) rules |
| Route | `/teacher/courses/[id]/structure` |
| Builds on | [Product Language](../../product-language.md), [Teacher Authoring](../../screen-types/teacher-authoring.md) (TA), [Button](../../components/button.md) |
| Excludes | Shared primitives, token values, Overview, portfolio, topic builder, permissions, persistence, lifecycle, preview-quota rules, analytics |

This brief composes the accepted sources and references their values by name. Behavior detail lives in tests: `__tests__/components/course-structure-workspace.test.tsx`, `e2e/smoke/course-structure.smoke.spec.ts`, `e2e/smoke/issue-deep-links.smoke.spec.ts`, and `e2e/smoke/topic-create-navigation.smoke.spec.ts`. Copy strings here are intent; wording may change without changing meaning.

## 1. Job and reading path

Structure answers: **"How is this course organized, and what do I build or fix next?"** It takes the Teacher from an empty course to authored topics, and is where structure is renamed, reordered, deleted, and restored.

Removal is a soft delete. The interface says `Xóa` and always says the item can be restored (`Chương đã xóa`, `Khôi phục`); it never exposes the mechanism.

Reading and focus order:

1. Course context: course navigation and title (TA §5).
2. Header: `h1` `Cấu trúc khóa học`, one purpose line (states read-only status when it applies), one inline totals line, course-level actions.
3. Route feedback: issue, return, stale-target, and preview notices.
4. Chapter navigator: search, the compact preview allocation bar, chapter rows.
5. Selected-chapter workbench: that chapter and its topics, and the way into authoring.

The page never replays Overview. Any direct entry lands with a chapter selected when one exists; the URL (`?chapter=<id>`) carries the selection, so Back, refresh, and the Topic Builder back link return to it.

## 2. Composition

- **Wide (≥ `1024px`):** navigator as a `320px` Work surface beside a workbench filling the rest, Level 0–1 elevation (TA §10). The navigator list scrolls inside its region. No card per chapter or topic, no stats card grid.
- **Narrow (< `1024px`):** sequential disclosure (TA §7.4): chapter list, then chapter detail with a `Tất cả chương` back control. At `320px` nothing overflows horizontally: titles wrap, action groups stack, the topic table becomes a row list.
- The `1024px` split belongs to this route, not a shared breakpoint.
- Scale: no chapters → one empty-state well that points to the header's `Thêm chương`; search appears from 8 chapters; only the selected chapter's topics are mounted; no pagination or virtualization until measurement demands it (TA §7.3).

## 3. Regions

**Totals line** — direct totals (for example `12 chương · 48 bài học · 640 thẻ từ vựng · 58 bài tập`) in Secondary text. A scan aid, not a readiness score; if it fails, nothing else is blocked.

**Navigator** — a dense list. Each row shows order number, title (up to two lines), and topic count; the full title is always in the accessible name. The selection uses the Selected/current treatment plus `aria-current`, never color alone. An Attention Amber text marker appears only for a current deep-link issue. Chapter `Lên` / `Xuống` controls sit on each row, hidden while a search filter is active. Deleted chapters are reached only through `Chương đã xóa`.

**Workbench** — header with `Chương {n} / {total}`, the chapter title (`h2`), local topic and lifecycle counts, `Đổi tên`, `Xóa chương`, and the primary `Thêm bài học`. Below it, the topic table:

| Column | Content |
| --- | --- |
| Order | Drag handle, order number, `Lên` / `Xuống` |
| Topic | Title (wraps) and a `Xem thử` badge for preview topics |
| Status | `Bản nháp`, `Chờ duyệt`, `Đã xuất bản` as text with icon |
| Actions | `Mở bài học` and a `Thao tác khác` menu (`Đổi tên`, `Cài đặt`, preview marking, `Xóa bài học` last in Correction Red) |

An empty chapter shows an Inset well, `Chương này chưa có bài học`, and `Thêm bài học`.

**Editing patterns** — titles are renamed in place, except a topic below `640px`, which uses the shared title dialog. Creating a chapter or a topic uses that same title dialog. An action illegal for the role is absent; an action blocked by state is present, disabled, and explained nearby (for example a topic `Chờ duyệt` cannot be renamed or deleted but can still be moved).

**Reordering** — `Lên` / `Xuống` is the keyboard and accessible path. Dragging a topic within the selected chapter is a pointer shortcut only: nothing requires it, the handle is not a tab stop, and it never crosses chapters. The list shows confirmed server order; a failed move returns to it with a retryable message, and a stale order is a neutral notice, not an error.

## 4. Action roles

One Action Blue primary per decision area (TA §9, Button contract).

| Action | Fine pointer | Touch-primary |
| --- | --- | --- |
| `Thêm chương` | Primary when the course is empty, otherwise Strong secondary | Same, Comfortable |
| `Thêm bài học` | Primary | Primary, Comfortable; full width below `640px` |
| `Chương đã xóa` | Subordinate text | Strong secondary |
| `Đổi tên`, `Hủy` | Quiet/local | Strong secondary, Comfortable (`44px`) |
| `Lưu tên` | Strong secondary | Strong secondary |
| `Xóa chương` | Quiet destructive | Outlined destructive, no fill, Comfortable |
| `Lên` / `Xuống`, `Thao tác khác` | Icon-only Compact, glyph-only rest | `44 × 44px` with visible boundary |
| Drag handle (not a Button) | `32px` quiet grip | `44 × 44px` with visible boundary |
| `Mở bài học` | Subordinate text | Strong secondary |

No success, warning, or progress color is used as a Button color. Touch roles change appearance and target size only.

## 5. Motion

Within TA §13: `120ms` hover and focus; `220ms` selected-row change and a quiet settle tint after a confirmed move; up to `240ms` for the narrow step change and dialogs. Button moves do not animate rows across positions. Only a drag travels: the row lifts and follows the pointer while others slide aside. Under reduced motion everything resolves at once (opacity up to `100ms`), except that the dragged row still follows the pointer.

## 6. Non-goals

- No drag between chapters, no chapter drag, no keyboard drag mode, no virtualization or pagination, and no new package beyond the recorded drag library.
- No change to permissions, the confirmed-server-order model, soft delete and restore, topic lifecycle, review flow, readiness, or preview-quota rules.
- No per-chapter card or exercise totals, attention scores, or analytics.
- No change to shared primitives; existing Button roles, dialog, menu, and input primitives are selected, not modified.
