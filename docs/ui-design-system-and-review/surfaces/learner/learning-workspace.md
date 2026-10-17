# Learning Workspace and Public Preview — Design Brief

| Field | Value |
| --- | --- |
| Status | `Accepted` 2026-10-09 by the Owner on the running local UI as a design brief. Approval and history follow the [index](../../index.md) rules; implementation and review status live in the [program progress](../../../programs/student-user-flow-route/progress.md) |
| Routes | `/learn/[course-slug]/[topic-slug]`, `/courses/[course-slug]/preview/[topic-slug]` |
| Builds on | [Product Language](../../product-language.md), [Learning Experience](../../screen-types/learning-experience.md) (LE), [Button](../../components/button.md) |
| Excludes | New question formats, grading, FSRS, persistence, permissions, transcript or speaker data, learning history or streak, global shell and shared primitive redesign |

This brief composes the accepted sources and references their values by name. Behavior detail lives in tests: `__tests__/components/{learning-workspace-presentation,topic-completion-ui,memory-check-stage,choice-group-motion,question-navigator,public-course-preview,exercise-arrangement}`, `e2e/smoke/learning-workspace-matrix.smoke.spec.ts` and `e2e/d2/public-course-preview.spec.ts`. Copy strings here are intent; wording may change without changing meaning.

## 1. Job and signature

The learner sees **the current task, its evidence, their response and the next useful action** without searching a second panel. The signature is one continuous practice plane: the word turns in place; a chosen response resolves where it was chosen; the stage thread changes only when the real state changes. There is no hero, glass, gradient, mascot, perpetual pulse, score tile, or celebration after a correct answer.

## 2. Composition and reading path

- Header: quiet course/chapter/topic context, a `Đã hoàn thành` badge once the server says the topic is complete, and an on-demand chapter and lesson outline (a sheet), never a permanent competing panel.
- Stage thread: `Từ vựng → Memory check → Bài tập`, only stages that exist, with current, locked and done stated in words. It is not a bypass of server gates.
- Forward `Tới…` stage actions appear only when their target is unlocked; do not send learners to a locked panel and a return action. Locked steps remain visible on the thread with their existing inline explanation (Owner local-QA decision 2026-10-18, LF9 r4).
- One practice plane below it. Standalone and recall tasks use the whole plane; grouped material and its current question form one reading and answer path.
- Wide (1024px and up): grouped material and the question sit in two columns inside the plane. Each column sticks to the top only while it fits in the viewport, and otherwise scrolls with the page. Medium and narrow: one column in the order context, stage, material, question, response, action, topic navigation, with 24px gutters at medium and 16px at narrow (12px at 320px).
- When the layout is stacked and the material is long, a `Tới câu hỏi` link jumps to the question.
- Normal page scrolling only: no nested scroll pane for passage, question or outline. The flashcard box is the one bounded exception (section 3).
- Stage and queue counts stay local and are never merged into one percentage; Again and Hard requeues are not counted as unique completion.

## 3. Content arrangements

Questions are single-choice. The renderer never invents blanks, multi-select, tokens or speaker structure.

| Content | Arrangement | Continuity |
| --- | --- | --- |
| Flashcard | One bounded card of fixed height (19, 21 and 23rem by breakpoint) turning in 3D; content that does not fit scrolls inside its face. Front: the word, part of speech, phonetic. Back: translation first, then example, explanation and hint when present. The back is centered like the review card when it fits and left-aligned for reading when it overflows. Four recall ratings below, `Lại`, `Khó`, `Ổn`, `Dễ`. | Layout below the card never moves when the card changes. Only the active face is exposed to assistive technology. |
| Part 1 | Image as dominant material, uncropped, with audio and an enlarge control | No cover-cropping; failed media has a local retry state |
| Part 2–4 | Compact audio or illustration band, then question and options | The audio node and its position survive question changes inside one group; no autoplay, no fake transcript |
| Part 5 | Prompt and options fill the plane | No empty material box |
| Part 6–7 | Passage with preserved whitespace beside or above the current question | Same-group passage context persists; no inferred blank placement |
| Memory check | One question and response, correct count, concise gate explanation. No question navigator | Wrong answers return through the existing queue; the server pass unlocks exercises |

Media rules: native accessible audio only; uncropped images with authored or fallback alt text; reserved quiet loading region; private-media errors follow the existing eligibility boundary and never fall back to a public URL; retry is local to the failed media and does not resubmit an answer.

## 4. Selection, feedback, progression, completion

- Choices are one labelled radio group. Neutral, then Route selected, then confirmed result: correct uses Growth, incorrect uses Correction, always with an icon and words. Green never means merely selected, and the correct option is not shown before the server returns permitted feedback.
- A correct answer with an explanation shows the same titled box as an incorrect one: `Chính xác` in Growth with its icon, then the explanation (Owner decision 2026-10-10); the heading is the announcement, so no second live status is added. A correct answer without an explanation shows no box, and correctness reaches assistive technology through a live status only. An incorrect answer shows the `Chưa chính xác` box with its explanation and `Thử lại`. Ordinary question feedback continues deliberately; its final automatic continuation retains the 1200 ms interval (LF5). A confirmed final correct memory-check answer immediately opens the next unfinished content or server-confirmed topic result, without a feedback wait (Owner local-QA decision 2026-10-17, LF9 r3).
- One response row: `Câu trước` as a link beside the primary action, and `Câu sau` as a link while the answer is not correct and a next question exists. The primary is `Xác nhận đáp án`, then `Thử lại` or `Câu tiếp theo` as the state requires.
- Once the last question is answered correctly the primary is `Làm câu còn thiếu` when questions are unanswered, otherwise `Bài tiếp theo`, or `Về tổng quan khóa học` when no next topic exists. There is no separate "finish exercises" step and no completion interstitial; completion is the header badge plus the server toast, once.
- A failed save keeps the selection and offers retry. A saved answer whose progress sync failed is shown as partial success and never as topic completion. A successful memory-check pass immediately opens the next unfinished content or the server-confirmed topic result without `Mở bài tập`. Wrong memory answers show `Câu tiếp theo` while other questions remain, otherwise `Thử lại`; the incorrect question stays in the retry queue. A first, due or full vocabulary queue also continues automatically after its saves settle; deliberately revisiting vocabulary may still show review actions.
- Preview is stateless: notice `Xem thử · Tiến độ không được lưu`, local ratings, transient answer evaluation (it returns the explanation for both outcomes), no memory-check lock. `Hoàn thành bài học` (or `Bỏ qua và hoàn thành`) opens a "viewed" summary with the enrolled or unenrolled call to action, and it never claims saved progress.

## 5. Question navigator

`Danh sách câu hỏi` is a popover from 768px and a bottom sheet below it, replacing click-through browsing. It groups questions by exercise and by `Nhóm n/m` passage group and numbers them across the topic. Each row shows the question text (truncated), a status icon with words (viewing, answered correctly, answered incorrectly, unanswered, locked), and the summary `Đã trả lời đúng X/Y câu`. Any unlocked question, answered or not, can be picked; a locked row is disabled and says why. Picking closes the list and moves focus to the question heading. Preview has the same list over local state and on its summary.

## 6. Motion

Default motion is the normal design; reduced motion (platform preference) is an equivalent alternative with the same state, focus and copy. Inherit LE timings and easing; no `transition-all`.

| Event | Choreography | Stays stable |
| --- | --- | --- |
| Hover, focus, press | 120ms tone and boundary change; focus ring immediately | Control footprint |
| Reveal a flashcard | 240ms 3D turn of one card; after a confirmed rating the next front turns back while the previous answer stays on the hidden back | Card box height; only the active face is accessible |
| Choice selected | 220ms boundary and tint on the chosen row | Option position |
| Incorrect validation | One short horizontal corrective nudge on that choice, once per fresh validation, not on revisiting a saved answer; reduced motion removes it | Choice order and focus |
| Next or previous question | 220ms directional entrance of the question and response | Same-group material and audio; the new heading takes focus |
| Stage or group change | 240ms entrance of the new stage plane | No stale feedback under the new heading |
| Progress bar | 220ms from the previous authoritative value | No animation from zero on render |

Scroll only for a real boundary (a jump to the question, a new group) or to reveal the focused next action; reduced motion uses instant scroll. A decorative animation never gates a network result or an action.

## 7. Learner color mapping

Reuse the accepted values through semantic names; this is not a second palette. `/profile` uses Route for selected tab and focus, Action for the primary button, and a neutral avatar fallback. The dashboard and course overview use Recall for progress, Growth for confirmed completion, Attention for the pending-payment reminder, and Correction or Route for feedback. Layout and behavior of those screens are unchanged. Recall ratings keep neutral control geometry: Attention accents for `Lại` and `Khó`, Recall accents for `Ổn` and `Dễ`, expressing recall difficulty and not correct or error. ReviewSheet's rating presentation is not reopened.

## 8. Typography and accessibility

- Inherit Plus Jakarta Sans and Geist roles, Button 8px radius, 44px touch targets. One large-radius practice object dominates; supporting material is quiet. Not every paragraph becomes a card.
- Focus order: task and material, then choices, then result and action, then supporting navigation. A new task moves focus to a stable heading; in-place feedback uses concise live status.
- Color and motion are never the only signal. Contrast follows the Product Language pairs. Check 320, 375, 768, 1024, 1366 and 1440px, long text, portrait and landscape media, keyboard, touch and 200% zoom; vertical scrolling is valid, clipping and unreachable controls are not.
