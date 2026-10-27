<!-- Template: charter, the identity document of an evergreen program. Copy to docs/programs/<program>/README.md, fill every <placeholder>, delete this comment. An evergreen program has no root plan.md and no State section. Replace the backticked file names with real Markdown links once the file sits in the program folder. Keep every Initiatives row, also for closed initiatives: each initiative plan must be a row. -->

# Charter — <program name>

Progress: `progress.md`. Problems: `problems.md`. Each initiative has a detail plan at `implementation-plans/u<n>-<slug>/plan.md`.

## 1. Capability and boundary

- Capability: <the long-lived thing this program owns and keeps working, in one or two sentences>.
- Boundary: <what is inside this program and what belongs to another program or to the backlog>.

## 2. Owner decisions

One line each: number, date, decision. Keep the decision's meaning; put reasoning in an initiative plan, not here.

1. (<YYYY-MM-DD>) <decision>.

## 3. Invariants

Rules every initiative must keep. One line each, with the failure it prevents.

- <invariant> — prevents <failure>.

## 4. Initiatives

At most one initiative has an open plan at a time. A closed initiative keeps its row.

| Initiative | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- |
| U1 <title> | `<branch>` | <observable result> | <none, or hard/soft on U<n>> | <Owner approval, merge of U<n>> |

## 5. Opening an initiative

<The steps to open the next initiative: where the Owner's request is recorded, who writes the detail plan, which gates apply (for example the Codex gate), and how the row is added. A short numbered list.>
