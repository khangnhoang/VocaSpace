<!-- Template: detail plan. Copy to docs/refactors/<program>/implementation-plans/<unit>/plan.md, fill every <placeholder>, delete this comment. No State section. -->

# <Unit ID> detail plan — <unit title>

Revision: r<n>, <YYYY-MM-DD>. Owner approval: <date or pending>. Master plan: [plan.md](<relative path>).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: <what is true after this unit merges>.

| ID | Observable result |
| --- | --- |
| AC1 | <actor + action + condition + expected result> |

### 1.2 Scope and non-goals

- In scope: <item>.
- Non-goals: <item>.

### 1.3 Execution guardrails

Only guardrails whose omission causes a concrete failure.

| Guardrail | Failure if omitted |
| --- | --- |
| G1. <rule> | <concrete failure> |

### 1.4 Owner decisions that bind this unit

- <decision number from the master plan or a new dated decision>.

## 2. Repository facts

Only facts that justify a Spec item or expose a conflict. Frozen after approval.

Baseline: `<commit>`, checked <YYYY-MM-DD>.

- <fact> — justifies <Spec item or conflict>.

## 3. Bounded implementation hypotheses

Each names what may change and which Spec or guardrail facts must stay true.

- <likely file, helper, or mechanism> — may change if <Spec/guardrail> still holds.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | <independently reviewable outcome> | <exact commands or manual checks> |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| <risk> | <mitigation> |

- Rollout runbook (Owner or hosted steps, in order): <steps, or "none">.
- Stop when: <conditions>.
- Rollback: <how to undo, and what cannot be undone>.

## 6. Progress

Current State and milestones: [progress.md](<relative path>).
