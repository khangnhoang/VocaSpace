# ENLOC-004 detail plan — Keep the shown answer across a workspace refresh

Revision: r1, 2026-11-25. Owner approval: 2026-11-25. Master plan: [plan.md](../../plan.md), section 5 step 2. Entry: [ENLOC-004](../../problems.md#enloc-004-workspace-remounts-on-a-language-switch-after-rating-cards).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a learner who rated cards and answered a question in a topic, then switches language (or any other `router.refresh()` that returns the same card and question set), still sees the same step, the same question and its answer outcome and explanation, now in the new language. A refresh that brings a real change to the card set rebuilds the workspace as today.

| ID | Observable result |
| --- | --- |
| AC1 | With the English flag on, a learner rates at least one card in the session, answers an exercise question (correct, and separately incorrect) and switches language: the exercise step, the same question, the chosen option, the outcome and the explanation stay shown, and the labels change language. |
| AC2 | The same as AC1 for a memory check question: the memory step, the question, its outcome and explanation stay shown after the switch. |
| AC3 | A refresh whose card id list differs from the shown one (the `cards_locked` recovery, LF3) rebuilds the workspace from the new data as today: flashcard step, new cards queued, the single "new cards" toast, no answer outcome carried over. |
| AC4 | The flashcard queue, the unrated, due and memory-gate sets, the landing step for a fresh visit and the "Ôn ngay" offer always come from the refreshed server data, never from the carried state (LF4 AC5 behavior). |
| AC5 | Carried state lives only while the learner stays on the topic URL: opening another topic, the course overview or reloading the page (F5) and coming back lands as today (LF5 landing), with no outcome from the earlier visit. |
| AC6 | An answer still in flight when the refresh happens is not carried as pending: after the remount the question behaves as on a fresh load of the refreshed data and never stays stuck in a pending state. |
| AC7 | The existing tests pass unchanged, including `learning-workspace.test.tsx` "changes the workspace key ..." (LF3 AC6) and "... only the due cards change ..." (LF4 AC5) and the page-key string test. With the flag off, output and route table are unchanged. |

### 1.2 Scope and non-goals

- In scope: the topic route (`app/(client)/learn/[course-slug]/[topic-slug]/` layout, page and `_components`), a small session store for the carried view state, and tests.
- Non-goals: changing the page key formula or its tests; the flashcard queue position across a refresh (the queue rebuilds from server data as today); ENLOC-003 (render writes progress); the language switcher and `setLocale`; any action, schema, database or catalog change beyond a new string if one is needed.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The page key formula and every existing assertion stay unchanged; only setup changes allowed by U3 G6 are allowed. | The fix silently drops the LF3 AC6 or LF4 AC5 rebuild. |
| G2. Carry only view state of the question steps (current step when it is memory or exercise, exercise/group/question position, settled attempts, session-wrong question ids). Card sets, queue, gates and progress always come from the new server data. | Stale client state wins over fresh server data (the LF9 rule that local data never beats the server snapshot). |
| G3. Restore only when the new data has the same topic id, the same flashcard id list and the same exercise and memory question ids as the snapshot, and the carried step is still unlocked under the new data; otherwise start fresh. | A real content change keeps an outdated question or opens a locked step. |
| G4. The store is scoped to the topic layout instance, not a module variable, so it ends when the topic URL is left or the page reloads. | A later visit restores an old outcome and breaks LF5 landing (AC5). |
| G5. Pending attempts are never carried. | A question stays stuck in pending because its result lands in the unmounted workspace (AC6). |

### 1.4 Owner decisions that bind this unit

- 2026-11-24: ENLOC-004 is fixed in step A, before U8; the Owner decides only if the fix conflicts with the LF3 AC6 and LF4 AC5 behavior (problems entry).
- Master plan r5 section 5 step 2: the fix follows a detail plan linked to its entry.

## 2. Repository facts

Baseline: `596962d4`, checked 2026-11-25.

- `page.tsx:42-53` keys `LearningWorkspace` by topic, card ids, `unseenCardIds`, `unratedCardIds` and `dueCardIds`; rating cards changes the last three on the server, so the next refresh remounts — justifies the problem and G1.
- `__tests__/components/learning-workspace.test.tsx:129-198` assert the exact key string and that it changes with seen/rated state and with due cards — justifies G1 and AC7.
- `components/ui/language-switcher.tsx:31-34` calls `setLocale` then `router.refresh()` — the trigger in AC1.
- `LearningWorkspace.tsx:292-452` holds the step, exercise position, `attempts` (pending or settled with outcome and explanation) and `incorrectIds` in component state, lost on remount; `userAnswers` and memory explanations are rebuilt from the server `answers` — justifies G2 and AC6.
- `LearningWorkspace.tsx:234-237,513-520` already carries one flag across this remount with a module `Set` (`relockedTopicIds`) for the `cards_locked` path — the existing precedent; G4 chooses a layout scope instead because the carried state must not survive leaving the topic.
- `[topic-slug]/layout.tsx` is a thin client-namespace wrapper around the page — the candidate holder for the store (H1, H2).
- `__tests__/components/area-locale.test.tsx:40` shows the area locale provider follows a locale change without remounting its children, so the key change is the only remount cause in AC1.

## 3. Bounded implementation hypotheses

- A client context provider rendered by `[topic-slug]/layout.tsx` holds one snapshot per mounted topic; `LearningWorkspace` writes it as the carried state changes and reads it once in its state initializers — may change to another holder if G4 still holds.
- The layout instance at `[topic-slug]` stays mounted across `router.refresh()` and remounts when the topic param changes and on a full reload, which ends the snapshot (AC5) — verify early in CP1 before building on it with a render test and the browser check; if a layout survives a topic change, the snapshot must also store the topic id and G3 rejects it, which is already required.
- The restore check compares ids only (G3), not full content — may widen if a content edit with unchanged ids proves to show an outdated question.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Store, snapshot, restore check and tests for AC1 to AC7 | New component tests: refresh with changed unseen/unrated/due lists and an `en` provider keeps step, question, outcome and explanation (exercise correct and incorrect, memory check); changed card ids rebuild (AC3); fresh mount after the store ends lands as today (AC5); a pending attempt is not carried (AC6). Existing learning-workspace, memory-check-stage and presentation tests unchanged. `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`. |
| Final | Whole-diff self-review and browser check | Local production build with the English flag on and a seeded student: rate cards, answer an exercise and a memory question, switch language (AC1, AC2); `cards_locked` path if a fixture allows (otherwise covered by the AC3 test); open another topic and back (AC5). Flag-off route table equals the baseline. Final regression as `test-quality-strategy` Verification stages require. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The restore shows a question whose saved answer changed on the server meanwhile (another tab). | Settled attempts are shown only for questions present in the new data; the server `answers` still drive completion and gates (G2). |
| The snapshot and fresh server data disagree about locks after the refresh. | G3: restore the step only when it is unlocked under the new data. |
| Carry hides a real content change with the same ids. | Accepted bound of H3; a content edit during a session already rebuilds only on id changes today. |

- Rollout runbook: none; production stays Vietnamese while the English flag is off, and the fix also applies to the retry refresh in Vietnamese.
- Stop when: an existing assertion must change beyond U3 G6; the layout scope cannot end the snapshot on topic change or reload; the restore cannot meet both AC1 and AC3 (Owner decides, per the entry).
- Rollback: revert the commit; no data or configuration change.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
