# UI-5 CP2: Structure Pilot Domain Result

This is the `frontend-ui-review` domain result for the first rendered review of the Structure surface, run under [UI-5 CP2](./plan.md). It is evidence for `code-review-and-quality`; it contains no readiness or merge verdict. Under D2, the findings are reported only and any fix is separate follow-up work.

## Status

`mismatches_found`: five (A) findings and one (B) finding; the unobserved required cells are listed below.

Follow-up (2026-10-01): A1–A5 and B1 were fixed in the separate D2 follow-up [PR #113](https://github.com/khangnhoang/VocaSpace/pull/113), merged to `main` as `f04c2f7` and normal-merged into this branch as `50c38bf`. The same PR amended the Structure surface (touch action roles, phone-width `Thêm bài học`, a shared title dialog, phone topic rename by dialog); the Owner live-reviewed and froze that amendment on 2026-10-01 (pre-publication SHA-256 `231F93A7…3ACC9`). This domain result stays historical evidence for the `8dd9e85` target; it is not a re-review of `f04c2f7`.

## Inputs

| Input | Value |
| --- | --- |
| Target | Branch `docs/ui-5-detail-plan` at `8dd9e85` with uncommitted CP1 skill files only; app, components, and lib equal `main` `91025bd`. Route `/teacher/courses/44444444-4444-4444-8444-4444444444d3/structure`, served by `next dev` on `127.0.0.1:3300` against the local E2E Supabase stack (`.e2e-runtime`) |
| Accepted sources (current Git-blob SHA-256, LF) | [Structure surface](../../surfaces/teacher/course-structure.md) `f33b6a7e…` (last changed in acceptance commit `ebb9624`; the index records the pre-publication candidate hash `8A4A48…`); Product Language `6eea4e68…`; Teacher Authoring `e2a5ed2c…` (the index records the pre-publication hash `78D30B…`; last changed in `5c79043`); Button `e4f0f97a…` |
| Fixture | `node scripts/e2e/structure-large-course-fixture.mjs prepare`: 22 active chapters, 1 removed, busy chapter with 8 topics, fixture teacher (owner) and `structure-previewer@gmail.com` (read-only). Reset again after the pilot |
| Preconditions | Focused Structure Vitest (actions, workspace component, schemas): 3 files, 89/89 passed |
| Driver | `playwright-cli` (Chromium); touch via `open --mobile` (360 × 800, coarse pointer); reduced motion via `set-reduced-motion` |

## Matrix

| Cell | Result |
| --- | --- |
| 1440 fine pointer, owner: landmarks, live region, selected row, focus ring, contrast, tab order | observed |
| Keyboard journey (add chapter → add topic → open builder) at 1440 | observed |
| Rename inline, delete, restore, topic menu, preview marking (keyboard, 1440) | observed |
| Search by title, by order number, no match, clear | observed |
| Confirmed chapter move with move controls (keyboard) | observed |
| 1024 fine pointer: two-pane layout, overflow, targets | observed (layout only; journey not repeated) |
| 375 fine pointer: narrow step change, focus to heading, back returns focus to row | observed |
| 360 touch (coarse pointer): overflow, 44px critical targets, drag-handle size, back focus return | observed |
| Reduced motion (touch) | observed (row transitions become `none`) |
| 320 fine pointer and 200% zoom (viewport-equivalent 720 × 450): overflow, stale-target notice | observed |
| Previewer role, read-only at 1440 | observed |
| Stale `?chapter=` target | observed |
| Forced failed chapter move (aborted request) and `Thử lại` | observed |
| 768 touch | `not_run`: touch was observed at the emulated 360 device width only |
| 375 and 320 on touch | `not_run`: these widths were observed with a fine pointer |
| 200% browser zoom | `not_verified`: viewport-equivalent emulation only |
| Loading, structure load failure, stats failure, `TOPIC_ORDER_STALE`, failed topic drop, pending saves | `not_run`: not forced in this bounded pilot |
| Touch drag and pointer drag-and-drop | `not_run` |
| Breadcrumb focus-indicator contrast (`outline: auto`) | `not_verified` |

## Findings

### (A) Contract mismatch

| ID | Source | Observed | Reproducible state | Correction direction | Cause |
| --- | --- | --- | --- | --- | --- |
| A1 | Structure §3.3 | The workbench header shows lifecycle counts only (`3 bản nháp · 2 chờ duyệt · 3 đã xuất bản`), with no topic count | Owner, 1440, chapter 1 selected | Add the local topic count to the workbench totals | `implementation_drift` |
| A2 | Structure §3.2 | Search filters by title only; `23` finds nothing although chapter 23 exists | Owner, 1440, a newly created chapter titled `Chương UI5 pilot` at position 23 (since removed by the fixture reset) | Also match the displayed order number | `implementation_drift` |
| A3 | Structure §7 | On wide screens, selecting a chapter row with Enter or Space updates the workbench but announces nothing; no live region changes | Owner, 1440, focus a row, press Enter or Space | Announce the selected chapter politely in the single surface live region | `implementation_drift` |
| A4 | Structure §6.2 (Failed move) | After a failed chapter move, `Thử lại` saves and announces the move, but focus drops to `body` | Owner, 1440, abort the move request, then unroute and activate `Thử lại` | Return focus to the moved chapter's `Lên` control (`Xuống` at the first position), as the topic workbench already does | `implementation_drift` |
| A5 | Structure §2.2 | The narrow `Tất cả chương` back control renders as `ghost` (transparent boundary); it is 44px high on touch | 360 touch, chapter detail (computed `data-variant="ghost"`, border `rgba(0,0,0,0)`) | Use the Standard strong secondary role with a visible boundary | `implementation_drift` |

### (B) Usability or accessibility mismatch

| ID | Measurement | Reproducible state |
| --- | --- | --- |
| B1 | The topic count (`8 bài học`) on the selected chapter row, `text-muted-foreground` on the selected tint `#EFF6FF`, measures 4.36:1 at 12px/400, below the 4.5:1 text threshold | Owner, 1440, selected row in the navigator |

### (C) Design recommendations

- An empty chapter shows `0 bài học`. §3.2 gives `Chưa có bài học` as the example; the wording rule allows this as long as the meaning is kept.
- On touch, the search input is 36px high. It passes the 24px minimum and is not one of the critical touch actions; matching the 44px rhythm of the other controls would make it more consistent.

## Conformant observations (summary)

- Structure: one `h1`; the navigator and workbench landmarks are labeled; one polite surface live region (plus the app-wide toaster).
- Selected row: `aria-current` with a Route Blue boundary on the quiet tint.
- No horizontal overflow at 1440, 1024, 720, 375, 360, or 320.
- Keyboard flows:
  - Confirmed move: the announcement, focus staying on the same control, and the list re-reading all match §6.2.
  - Confirmed create: the new chapter is selected and focus moves to its heading.
  - Confirmed delete: the previous chapter is selected, focus moves to its heading, and the notice names the restore path.
  - Inline rename announces the new title and focus returns to `Đổi tên`.
  - The topic menu supports arrow keys, Escape returns focus to the trigger, and the preview item carries a one-line explanation.
  - Preview marking updates the meter to `1/4`.
- Narrow screens: selecting a row moves focus to the workbench heading; back returns focus to the originating row.
- Touch: critical targets and drag handles are ≥ 44px.
- Reduced motion removes row transitions.
- Previewer sees the read-only purpose line, with navigation and `Mở bài học` only.
- A stale `?chapter=` shows the existing alert, falls back to the first chapter, and clears the parameter.
- A failed move keeps the confirmed order and shows the inline error with `Thử lại`.

## Functional observations for code review

- After topic creation navigates to the Topic Builder, focus is on `body`. This is outside the Structure surface; it relates to the known Topic Builder debt.
- In development, the Next.js dev-tools portal adds an unnamed tab stop after the workbench. It does not appear in production builds.

## Procedure notes

- The pilot exposed no gap in the `frontend-ui-review` procedure, so CP1 needs no correction. Two environment lessons:
  - Run `next dev` with the E2E stack's env, because the fixture writes only there.
  - `prepare` recreates users and IDs, which signs out open sessions and turns earlier `?chapter=` ids stale.
- Screenshots are in the ignored `test-results/ui-5-pilot/` and are not committed.
