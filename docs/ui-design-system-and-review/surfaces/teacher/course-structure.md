# Teacher Course Structure Surface

## Status and authority

| Field | Value |
| --- | --- |
| Status | `Accepted` on 2026-10-01 from exact `STRUCTURE-SURFACE-CANDIDATE-2`, pre-publication SHA-256 `8A4A48AAC34E5E44988BDD47C690D9610A2EE6237B875EFF2395EF686FC7F5FF` (UTF-8, LF), after the Owner reviewed the running result. It amends the spec `Accepted` on 2026-09-30 from exact `STRUCTURE-SURFACE-CANDIDATE-1` (pre-publication SHA-256 `F35177E6226D0486B6C1E7D5E015BA26E6A9E986E7E1FF997C506D5CC60A2425`) with topic drag-and-drop and pending-topic reordering (Owner decisions R1–R4 of the [UI-4 reorder plan](../../implementation-plans/ui-4-reorder/plan.md)). Amended on 2026-10-01 by Owner decisions from the UI-5 Structure pilot correction review (touch roles for `Đổi tên`, `Xóa chương`, and `Hủy`; phone-width `Thêm bài học`; one shared title dialog; topic rename by dialog on phones). The Owner live-reviewed the amended runtime (PR #113, `main` `f04c2f7`) and froze the amendment on 2026-10-01, pre-publication SHA-256 `231F93A7970BABA3E05CEC7545CE886F33BA91F7616B346821449BA77DF3ACC9` (UTF-8, LF). Routed from the [index](../../index.md) |
| Owner gate | UI-4 CP1 accepted the direction; CP4 froze the `CANDIDATE-1` bytes. The Owner live-reviewed the `CANDIDATE-2` runtime on 2026-10-01 (two review corrections applied: a neutral notice for a stale order, no focus move after a pointer drop) and froze it (SHA-256 above); the pilot-correction amendment was live-reviewed and frozen on 2026-10-01 (SHA-256 in Status). Any later change needs a new Owner decision |
| Upstream authority | [Product Language](../../product-language.md), [Teacher Authoring](../../screen-types/teacher-authoring.md) (TA), [Button](../../components/button.md), [UI-4 Detail Plan](../../implementation-plans/ui-4/plan.md) with Owner decisions D1–D4, and the [UI-4 reorder plan](../../implementation-plans/ui-4-reorder/plan.md) with Owner decisions R1–R4 |
| Route | `/teacher/courses/[id]/structure` |
| Scope | Route-specific composition of the Structure destination: reading path, wide and narrow layout, chapter navigator, selected-chapter workbench, action roles, states, scale, focus, and motion |
| Excludes | Shared primitive construction, token values, Overview, portfolio, topic builder, permissions, persistence, lifecycle, preview-quota rules, and analytics |

This surface composes the accepted sources. It does not restate or change their values: colors, radii, spacing, elevation, motion durations, Button roles and geometry, and state pairs are referenced by name and remain owned upstream. Where this document names a copy string, it is the intended Vietnamese label; the implementation may adjust wording only without changing meaning.

## 1. Job and reading path

Structure answers one question: **"How is this course organized, and what do I build or fix next?"** It is the Teacher's route from an empty course to authored topics, and the place to rename, reorder, delete, and restore structure.

**Wording rule:** chapter and topic removal is a soft delete. The interface calls it `Xóa` and always says that the item can be restored (`Chương đã xóa`, `Khôi phục`). It never exposes the mechanism.

Reading path, in DOM and focus order:

1. **Course context** — existing course-level navigation (TA §5.1, `Tổng quan` / `Cấu trúc`) and human-readable course title (TA §5.2).
2. **Surface header** — `h1` `Cấu trúc khóa học`, one line of purpose copy that states read-only status when it applies, the compact structure summary (§3.1), and course-level actions (§5).
3. **Route feedback** — issue notices, return feedback, stale-target notice, and preview suspension notice, in the existing order, directly under the header.
4. **Chapter navigator** — find, reorder, and select a chapter, with the compact preview allocation bar between search and the rows (§3.2).
5. **Selected-chapter workbench** — manage that chapter and its topics, and enter authoring (§3.3).
6. **Preview allocation** — the existing course-level preview allocation, shown as a compact quota bar inside the navigator (§3.2) rather than a separate region after the workbench (Owner live review, CP3).

The page never replays Overview content. Direct entry (bookmark, deep link, return from the topic builder) lands on a usable state with a chapter selected when one exists.

## 2. Composition

### 2.1 Wide (viewport ≥ `1024px`)

Two regions sit side by side on the Canvas:

- **Navigator** — a Work surface with a fixed column of `320px`. Its chapter list scrolls inside the region when it exceeds the available height; the region stays within the viewport below the header so the selected row and search remain reachable without scrolling the page.
- **Workbench** — a Work surface filling the remaining width, with the TA §10 region spacing between the two regions.

Both regions use Level 0–1 elevation (TA §10). No card per chapter, no card per topic, no stats card grid. Sticky behavior is limited to the navigator region and must never cover dialogs, errors, or the last topic row (TA §11).

### 2.2 Narrow (viewport < `1024px`)

Sequential disclosure (TA §7.4, §11):

- **Step 1 — Chapter list.** The navigator fills the width. Selecting a chapter shows step 2.
- **Step 2 — Chapter detail.** The workbench fills the width and starts with a `Tất cả chương` back control (Standard strong secondary; `44 × 44px` minimum touch target on touch-primary input). Back returns to step 1 and places focus on the row of the chapter that was open.

The URL carries the selected chapter in both compositions (§6.1), so browser Back and refresh keep the same step. At `320px` nothing overflows the page horizontally: titles wrap, action groups stack, and the topic table becomes a row list (§3.3). This preserves the `39feb3a` narrow-width fix as a regression guard.

The `1024px` split is a surface choice for this route; it does not become a shared breakpoint.

## 3. Regions

### 3.1 Structure summary

One inline line of direct totals from `getCourseStats`, for example `12 chương · 48 bài học · 640 thẻ từ vựng · 58 bài tập`, using Secondary text. It replaces the four-card stats grid. It is a scan aid, not a readiness score (TA §7.3). If stats fail to load, the line is replaced by a short inline message with a retry text action; the navigator and workbench stay usable (TA §9: analytics unavailable).

Read-only viewers see the totals they are allowed to see, with the same wording the runtime uses today for visible counts.

### 3.2 Chapter navigator

- Heading `Chương` (`h2`) with the chapter count.
- **Search** — a labeled text input `Tìm chương` shown when the course has `8` or more chapters. It filters the already loaded list by title or order number on the client; it does not paginate. Results announce their count politely (for example `3 chương phù hợp`). A no-match result shows `Không có chương phù hợp` with a text action to clear the search. Clearing never changes the selected chapter.
- **Preview allocation bar** — when `canManagePreviewMarkers` holds: `Bài học xem thử`, the used/cap count with a meter, the remaining count, and a text action `Xem bài học đã chọn` that expands the existing unmark list in place. Quota rules are unchanged.
- **Rows** — a dense list, one row per chapter, each row a selectable control whose accessible name contains the order number, full title, and topic count:
  - order number;
  - title, wrapping to at most two visual lines, with the full title always in the accessible name;
  - topic count from D2 (for example `6 bài học`, `Chưa có bài học`);
  - an Attention Amber marker with text only when the chapter is the target of a current deep-link issue (`chapter_has_no_topics`); no other attention state is invented.
- **Selected row** — the Product Language Selected/current treatment (Route Blue marker on the quiet current background) plus `aria-current="true"`; never color-only.
- Deleted chapters are not listed. They are reached only through the recovery path in §5.

Chapter reorder lives on each navigator row as always-visible `Lên` / `Xuống` icon controls beside the selection control, so any chapter can be moved without selecting it first (Owner live review, CP3). Moves follow the same pending/confirmed/failed states as §6.2; a failed chapter move shows its retryable message at the top of the navigator list. Moves are hidden while a search filter is active, because a move swaps with the real neighbour, which the filter may hide. Chapter rename and delete stay in the workbench header.

### 3.3 Selected-chapter workbench

Only the selected chapter mounts topic detail (TA §7.1; plan guardrail).

**Header**

- Eyebrow `Chương {n} / {total}` and `h2` with the full chapter title (wraps, never truncates the accessible name).
- Local totals from loaded topics: topic count and lifecycle counts (`Bản nháp`, `Chờ duyệt`, `Đã xuất bản`). Per-chapter flashcard or exercise totals are not shown because no direct read exists for them.
- Chapter actions, grouped and named with the chapter title: `Đổi tên` and `Xóa chương`, only when `canManage` holds. Chapter moves live on the navigator rows (§3.2), gated by `canReorderChapters`; a move at the first or last position is disabled with its existing reason (`Đã ở đầu danh sách` / `Đã ở cuối danh sách`).
- Primary action `Thêm bài học` (§5).

**Inline rename (chapter and topic)**

Rename edits the title in place instead of opening a form dialog. The one exception is a topic on a phone-width viewport (below `640px`), described at the end of this list:

- `Đổi tên` turns the title into a text input prefilled with the current title and selected, with focus in the input. The `Đổi tên` control becomes `Lưu tên`, and a `Hủy` control appears next to it.
- Enter or `Lưu tên` saves; Escape or `Hủy` cancels. Moving focus or clicking outside the title, the input, and its two controls cancels, unless a save is pending or an error is shown.
- Validation uses the existing chapter or topic title schema. An invalid title keeps the input open with a corrective message linked to the input.
- While saving, the input and controls are unavailable and `Lưu tên` shows its pending verb (`Đang lưu…`). On failure, the typed value stays in the input with the error and a retry through `Lưu tên`; nothing shows the new title until the server confirms.
- On confirmation the title updates from the server, the live region announces `Đã đổi tên chương thành "{title}"`, and focus returns to `Đổi tên`. On cancel, focus also returns to `Đổi tên`.
- On a topic row, `Đổi tên` in the row menu turns that row's title into the same input; the row keeps its other columns. Because the row has no standalone `Đổi tên` button, focus returns to that row's menu trigger (`Thao tác khác cho bài học {title}`) after save or cancel.
- Below `640px`, the inline topic input has no room beside the row's other columns, so `Đổi tên` in the topic row menu opens the shared title dialog (below), prefilled with the current title and selected. Title `Đổi tên bài học`, submit `Lưu tên` (pending `Đang lưu…`), and `Hủy`. Validation, the pending state, a failure that keeps the typed value with its error, the announcement, and focus returning to the row's menu trigger are the same as inline rename. Chapter rename stays inline at every width, and topic rename stays inline from `640px` up.

**Title dialog (create chapter, create topic, phone topic rename)**

Creating a chapter and creating a topic are the same task with a different object, so they share one dialog composition. It contains:

- a title (`Thêm chương` / `Thêm bài học`) and one line of description;
- one labeled title field;
- a Primary submit with its pending verb (`Tạo chương` / `Tạo và tiếp tục`);
- `Hủy`.

The dialog keeps the existing title schemas, Server Actions, and post-create flows. Below `640px`, both buttons span the width and stack with the Primary on top; from `640px` up they sit at the end of the footer with `Hủy` before the Primary.

**Topic table**

Wide composition uses one column model shared by header and rows (TA §7.3):

| Column | Content |
| --- | --- |
| Order | Fixed-width column: a drag handle, the order number, and centered `Lên` / `Xuống` move controls when `canManageStructure` holds for that topic |
| Topic | Full title (wraps) plus a `Xem thử` text badge when the topic is a public preview marker |
| Status | Lifecycle text with icon: `Bản nháp`, `Chờ duyệt`, `Đã xuất bản` — never color-only |
| Actions | `Mở bài học` plus a `Thao tác khác` menu for the remaining actions |

Below `1024px`, each topic becomes one list row: title and status on top, then the move controls and actions on a wrapped line. The same controls and names are kept.

**Topic actions**

- `Mở bài học` opens the topic builder directly. It is available to every viewer who can open the topic today, including read-only viewers.
- The `Thao tác khác cho bài học {title}` menu contains, when legal: `Đổi tên`, `Cài đặt`, `Đánh dấu xem thử` / `Bỏ xem thử`, and `Xóa bài học`. Every item has a leading icon; items use the same rhythm as the header account menu (roomy rows, quiet icons, Route Blue focus), with `Xóa bài học` separated at the end in Correction Red. The preview item carries a one-line explanation under its label, not a hover tooltip, so it also reads on touch: `Ai cũng xem được, không cần ghi danh` (published), `Ai cũng xem được khi đã xuất bản, không cần ghi danh` (draft or pending), `Chỉ học viên đã ghi danh mới xem được` (on `Bỏ xem thử`). A quota block replaces it with `Đã dùng hết lượt xem thử`.
- Permission meaning is unchanged: rename requires `canEditContent`; delete requires `canDeleteTopic`; preview marking requires `canManagePreviewMarkers` and follows the existing quota rule; nothing is legal while `isReadOnly`.
- A topic in `Chờ duyệt` keeps rename and delete unavailable, as today, and the menu states the reason (`Bài học đang chờ duyệt`) instead of silently disabling them. Its position is not part of the reviewed content, so a pending topic can still be moved, and other topics can be moved past it, by the move controls and by dragging; the topic stays `Chờ duyệt`.
- Reordering is offered two ways that reach the same result. The `Lên` / `Xuống` controls swap a topic with its neighbour and are the keyboard and single-pointer path. The drag handle moves a topic to any position in one gesture and is a pointer shortcut only: nothing requires dragging (TA §12; WCAG 2.5.7). The handle is shown only where the move controls are shown, is not a tab stop, and carries no accessible name because the same operation is already available as named buttons.
- Dragging applies only to the selected chapter's topic list. A topic cannot be dragged into another chapter, and chapters are not draggable.
- When the preview quota blocks marking, the menu item states `Đã dùng hết lượt xem thử` and the same menu offers a `Xem phân bổ` item, which moves focus to the preview allocation region.
- An action that is illegal for the viewer's role is absent. An action that is legal in principle but blocked by state is present, disabled, and explained nearby.

**Empty chapter**

When the selected chapter has no topics, the table is replaced by an empty-state well (Inset surface) with a Lucide state anchor, `Chương này chưa có bài học`, one sentence on what a topic holds, and the primary `Thêm bài học`. Read-only viewers see the message without the action.

## 4. Scale behavior

| Course | Behavior |
| --- | --- |
| No chapters | Navigator and workbench are replaced by one empty-state well: `Khóa học chưa có chương` and one sentence pointing to the header's `Thêm chương` (read-only viewers get a read-only sentence). The well does not repeat the header button. No empty columns are drawn |
| 1–7 chapters | No search. The navigator sizes to its rows; the workbench aligns to the top of the navigator. No stretched empty regions (TA §7.4) |
| 8+ chapters | Search appears. The navigator list scrolls within its region; the selected row is scrolled into view on load and on selection |
| 20–50 chapters | Same as 8+. Only one chapter's topics are mounted. No pagination or virtualization until measurement demands it (TA §7.3) |

Default selection on load, in priority order: the chapter in the URL (an explicit Teacher choice); the chapter named by a deep-link issue target; the first chapter by confirmed order.

## 5. Actions and Button roles

Roles follow TA §9 and the Button contract. One Action Blue primary per local decision area.

| Area | Action | Button role and geometry |
| --- | --- | --- |
| Surface header | `Thêm chương` | Primary when the course has no chapters; otherwise Strong secondary, so the workbench primary leads the creation journey. Standard on fine pointer, Comfortable on touch-primary input |
| Surface header | `Chương đã xóa` (with count when known) | Subordinate text on fine pointer; Strong secondary on touch-primary input. Opens the existing deleted-chapter dialog |
| Workbench header | `Thêm bài học` | Primary. Standard on fine pointer, Comfortable on touch-primary input. Full width below `640px`; intrinsic width from `640px` up. On success it follows the current flow into the new topic's builder |
| Workbench header and topic row | `Đổi tên` → `Lưu tên` / `Hủy` | On fine pointer, `Đổi tên` and `Hủy` are Quiet/local. On touch-primary input, both are Strong secondary Comfortable (`44px`), so they read as tappable without competing with the Primary. `Lưu tên` is Strong secondary, so the workbench keeps one Primary |
| Workbench header | `Xóa chương` | Quiet destructive on fine pointer. On touch-primary input, a destructive control with a light Correction Red boundary, Comfortable (`44px`), and no fill, so it never competes with the Primary. It opens the existing confirmation dialog with chapter identity, consequence, and restore path |
| Title dialog | Submit / `Hủy` | Submit is Primary. `Hủy` is Quiet/local on fine pointer and Strong secondary Comfortable on touch-primary input |
| Workbench header and topic rows | `Lên` / `Xuống` | Icon-only Compact on fine pointer with glyph-only rest (Button §5); `44 × 44px` with a visible boundary on touch-primary input. Accessible name includes the object and direction |
| Topic row | Drag handle | Not a Button: a decorative grip glyph that starts a pointer drag. `32px` with a quiet rest on fine pointer; `44 × 44px` with a visible boundary on touch-primary input. Hidden from assistive technology and skipped by Tab (the move controls are the accessible path) |
| Topic row | `Mở bài học` | Subordinate text on fine pointer; Strong secondary Compact → Comfortable on touch-primary input |
| Topic row | `Thao tác khác` | Icon-only, same geometry rule as moves; menu items are menu items, not Buttons |
| Deleted-chapter dialog | `Khôi phục` | Quiet/local per row; Primary is not used in that dialog |

No action uses success, warning, or progress color as a Button color. Width is intrinsic except that narrow CTA pairs stack (TA §11) and `Thêm bài học` spans the width below `640px`. The touch roles above change only appearance and target size; the semantics and confirmation flows are unchanged.

## 6. States

### 6.1 URL and context

- The selected chapter is carried as `?chapter=<id>`. The existing issue-context and feedback parameters keep priority and keep their current removal behavior.
- **Stale target** — if the URL names a chapter that no longer exists or is deleted, select the first chapter, remove the stale parameter with `replace`, and show the existing `Nội dung không còn khả dụng` notice. Never show an empty workbench for a missing chapter.
- After a chapter is deleted, the next chapter in confirmed order (or the previous one at the end) is selected once the structure has re-read; the deleted chapter's ID never triggers the stale-target notice. URL changes wait until in-flight Server Actions finish.
- Browser Back from the topic builder returns to the same Structure URL, so an explicitly selected chapter is kept. The topic builder's own back link opens Structure at the default selection; making it restore the containing chapter is a Topic Builder change, open for the Owner at CP3.

### 6.2 Recovery matrix (TA §9)

| State | Behavior on this surface |
| --- | --- |
| Loading chapters | Header and course context render at once. Navigator shows row skeletons with `Đang tải danh sách chương.` as its accessible status; the workbench shows a labeled skeleton. Focus does not move |
| Loading topics for the selected chapter | Workbench header renders from the chapter row; the topic table shows skeleton rows. Switching chapters cancels the earlier load's effect |
| Chapters failed to load | Inline error in the navigator region with `Thử lại`; header actions stay available when legal |
| Stats failed | §3.1; nothing else is blocked |
| Empty course / empty chapter | §4 and §3.3 empty wells; deep-link issues `course_has_no_chapters` and `chapter_has_no_topics` keep their existing notice and clear after the first chapter or topic is created. Because topic creation then opens the topic builder, the issue parameters are removed from the current history entry before leaving, so Back does not replay a resolved notice |
| Pending move | With the move controls, the moved row keeps its position until the server confirms. The pressed control shows its pending state; all move controls and drag handles in that list are unavailable until the result (single `OrderingPendingState`). The row states `Đang di chuyển…`. A dropped row is the exception: it is placed at the drop position at once (an optimistic placement) and the row states `Đang di chuyển…` until the server answers |
| Confirmed move | The list re-reads confirmed server order. A polite live region announces the new position (for example `Đã chuyển "Hỏi đường" lên vị trí 2`, or `Đã chuyển "Hỏi đường" tới vị trí 2` after a drop). Focus stays on the same control of the moved item at its new position; if that control is now disabled at an edge, focus goes to the other direction's control. A drop made with the pointer does not move focus (the drag handle is not focusable and no control was used, so there is nothing to restore; moving focus would show an unexpected focus ring on `Lên`); the live-region announcement is the confirmation. Only a `Thử lại` activated from the error notice returns focus to the moved item's `Lên` control (`Xuống` at the first position), because that button disappears when the retry is saved |
| Failed move | Order returns to the last confirmed state: with the move controls it never left it; after a drop, the row returns from the drop position and the list re-reads the server order, which also covers a list that changed underneath (a removed or moved anchor). An inline Correction Red message sits at the top of the affected list with the existing error copy and a `Thử lại` action. `Thử lại` repeats the same request without placing the row first. A drop request carries the topic order the client rendered; if the server order differs (`TOPIC_ORDER_STALE`), the drop is rejected and the list re-reads the server order. That case is not an error: a quiet Route Blue notice (`role="status"`, info icon, no Correction Red, no `Thử lại`) asks the user to repeat the action on the new order, because repeating the old request cannot succeed |
| Cancelled drag | A drag that is cancelled, or a drop that leaves the row where it started, changes nothing and calls no action |
| Pending create / delete / restore | Existing dialogs own pending, validation, and failure; the triggering control regains focus on cancel |
| Rename | Inline rename rules in §3.3 |
| Confirmed create | New chapter becomes the selected chapter and focus moves to its workbench heading; a new topic follows the existing navigation into its builder |
| Confirmed delete | The next chapter by order (or the previous one when the last was deleted) becomes selected; focus moves to its workbench heading; the notice names the deleted chapter and says it can be restored from `Chương đã xóa` |
| Confirmed restore | Restored chapter returns to its confirmed position and becomes selected |
| Read-only | Purpose line states the read-only reason. Create, rename, delete, restore, move, and preview actions are absent. Navigation, totals, and `Mở bài học` remain |
| Preview suspension / return feedback | Existing notices keep their placement in §1 step 3 and their current behavior |

A toast may reinforce a result; it is never the only status (TA §9).

## 7. Keyboard, focus, and assistive technology

- One `h1`; navigator and workbench each have an `h2` and a labeled region landmark. Deleted-chapter and form dialogs keep their titles.
- Focus order: course navigation → header actions → route notices → search → preview allocation bar → chapter rows (selection, then its moves) → workbench header actions → topic rows.
- Chapter rows are reachable in order with Tab. Selecting a row with Enter or Space updates the workbench without moving focus on wide screens, and announces the selected chapter politely. On narrow screens, selection moves focus to the workbench heading, and back returns focus to the originating row (TA §12).
- Every icon-only control has an accessible name that includes its object (for example `Di chuyển chương "Đi lại trong thành phố" lên`).
- Menus follow the existing `dropdown-menu` primitive behavior: arrow-key navigation, Escape closes, and focus returns to the trigger.
- Dialogs enter at their title or first field, trap focus, and return focus to the invoker (TA §12).
- One polite live region per surface announces move results, search result counts, and chapter selection; errors use the existing alert semantics. The drag library adds no second live region and no keyboard instructions of its own.
- Dragging has no keyboard mode. Keyboard and screen-reader reordering uses the named `Lên` / `Xuống` controls only.
- On touch, a drag starts from the handle after a short press so the page still scrolls normally from everywhere else in the row.
- The WCAG 2.2 AA thresholds in `frontend-design` apply. Critical touch actions are `Thêm chương`, `Thêm bài học`, `Mở bài học`, `Đổi tên`, `Xóa chương`, dialog `Hủy`, move controls, the row menu trigger, and the narrow back control.

## 8. Motion

Within TA §13 only:

- `120ms` hover and focus response on rows and controls.
- `220ms` selected-row transition and confirmed-move settle cue (a brief quiet tint on the moved row; the settled order and focus are shown immediately).
- Up to `240ms` narrow step change (list ↔ detail) and dialog reveal.

Moves made with the move controls do not animate a row across positions. The only travelling motion is a drag: the dragged row follows the pointer with a quiet lift (shadow and ring), and the other rows slide aside and settle into the drop position. Under reduced motion, all of the above resolve immediately or with opacity up to `100ms`, except that the dragged row still follows the pointer; the slide of the other rows and the settling animation are removed.

## 9. D2 — chapter topic count

The navigator topic count comes from one grouped count added to the existing `getChaptersByCourseId` read under its current membership check. It counts the chapter's non-removed topics that the viewer can see through the same read path; it is not a readiness or progress value. If the count is unavailable, the row omits it rather than showing `0`.

## 10. Non-goals

- No drag-and-drop between chapters, no chapter drag-and-drop, no keyboard drag mode, no virtualization, and no pagination. Topic drag-and-drop inside the selected chapter uses the drag library recorded in the UI-4 reorder plan and no other new package.
- No change to permissions, the confirmed-server-order model, soft-delete and restore semantics, topic lifecycle, review flow, readiness order, or preview-quota rules.
- No per-chapter flashcard or exercise totals, attention scores, or analytics.
- No change to the topic builder, Overview, or portfolio beyond existing links back to Structure.
- No change to shared primitives; this surface selects existing Button roles and existing dialog, menu, and input primitives.
- The `TopicManagementSheet` interaction is replaced by the workbench (D4); its create and delete dialogs and its Server Actions are reused, not re-specified; the rename dialogs are replaced by inline rename (and, for topics below `640px`, by the shared title dialog in §3.3).

## 11. Acceptance checklist for the runtime pilot (UI-4 CP3)

1. Add chapter → add topic → open builder completes with keyboard only, at wide and narrow widths.
2. Rename inline, reorder, delete, and restore a chapter; rename inline, reorder, delete, open, and mark preview on a topic — each from this surface, with unchanged permissions.
3. With a 2-chapter and a 24-chapter course, only one chapter's topics are in the DOM, search finds a chapter by title or number, and small courses show no stretched empty regions.
4. At `320px`, no horizontal page overflow; back returns focus to the originating row.
5. Each §6.2 state is observed or reported as not verified.
6. Contrast, target size, focus visibility, and reduced motion are measured per the `frontend-design` thresholds.
