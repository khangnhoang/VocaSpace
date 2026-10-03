<!-- Template: master plan. Copy to docs/refactors/<program>/plan.md, fill every <placeholder>, delete this comment. No State section. Real markdown links to sibling files are added when the file is copied into the program folder. -->

# Master plan — <program name>

Progress: `progress.md`. Problems: `problems.md`. Each unit has a detail plan at `implementation-plans/<unit>/plan.md`.

## 1. Goal and outcome

- Goal: <one or two sentences>.
- Outcome <n>: <observable result the program delivers>.
- Size and risk: <small / medium / large, and the reason in one line>.

## 2. Owner decisions

One line each: number, date, decision. Keep the decision's meaning; put reasoning in a source or detail plan, not here.

1. (<YYYY-MM-DD>) <decision>.

## 3. Shared invariants

Rules every unit must keep. One line each, with the failure it prevents.

- <invariant> — prevents <failure>.

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| <U1> | `<branch>` | Outcome <n> | <none or hard/soft on Ux> | <Owner approval, rollout step, merge of Ux> |

## 5. Order and rollout gates

<Merge and rollout order, including hosted or production steps and what must be true before each. A diagram or numbered list.>

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| <risk> | <mitigation> |

## 7. Out of scope

- <excluded item>.
