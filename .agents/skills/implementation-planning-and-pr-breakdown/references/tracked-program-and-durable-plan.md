# Tracked programs and durable plans

Read this reference when work belongs to a tracked multi-session or multi-PR program, or when it needs durable plan/progress ownership. Skip it for standalone small or medium plans with no tracked program.

## Source routing

Use these source conditions instead of broad-reading the repository:

| Source | Read when | Do not read merely because |
| --- | --- | --- |
| Root/nested `AGENTS.md` | It applies to the target path | Never skip an applicable instruction file |
| Activated skill | Its activation or discovered-scope condition matches | Its name sounds adjacent |
| Direct repository evidence | The target or its consumer is needed to understand the contract | More context feels safer without an ownership signal |
| Master plan | The task belongs to the program or can change intended scope, dependency or approved direction | An unrelated small edit exists in the same repository |
| Progress/problem source | The tracked task can change current status/evidence or addresses a recorded problem | A tracker exists but has no matching consumer |
| ADR or deferred source | The task can change its owned decision or pull deferred behavior into scope | A local correction does not affect that decision |
| Per-PR plan and owner record | Implementing, fixing or reviewing that exact unit and the artifacts exist | The task belongs to another unit or no artifact exists |
| Git state | A file/branch/checkpoint/remote mutation or baseline/ownership decision is involved | A pure explanation is independent of repository state |

Open additional context only when a direct link, shared contract consumer, source conflict, changed ownership/dependency, deferred-scope signal, verification gap, unclear Git state or activated-skill route makes it relevant. Record the source, triggering evidence, question to answer and whether it may change. Do not broad-read a bundle to search for possible relevance.

Record `not applicable` only when the absent/inapplicable source affects a decision or gives the owner useful audit evidence. Do not force small tasks to enumerate irrelevant categories or create a file to make a taxonomy complete.

## Tracked-program reconciliation

When direct evidence shows that a task belongs to a tracked program:

1. read the authoritative program scope, current progress/problem sources and the program-owned artifact convention when present;
2. load the exact per-PR detailed plan and owner decision record when they exist;
3. reconcile behavior, scope, ownership, dependency, acceptance criteria, verification and permission across them;
4. treat a pending owner record as no implementation permission and stop on a material conflict;
5. update the detailed plan within planning permission and re-review it when an explicit owner decision materially changes the implementation contract;
6. do not create empty, retrospective or duplicate per-PR artifacts without a current consumer.

The tracked program owns its artifact layout. This skill owns the generic reading and reconciliation procedure and must not hard-code one program's paths.

## Documentation and progress tracking

For multi-PR or multi-session work, inspect repository conventions and define:

* plan and progress paths
* status vocabulary
* update points
* verification evidence to record
* how deviations are documented

Useful statuses:

```txt
not started
in progress
blocked
implemented
automated checks passed
manual QA pending
completed
```

Do not invent paths or mark work complete before its criteria are satisfied.

## Durable-plan decision and self-review

A durable plan is required when large/high-risk work needs continuity across sessions or agents, spans multiple owners or dependencies, defines an exact permission contract, requires a material owner decision, has ordered phases, or needs an auditable rollback boundary.

Do not create a plan file for small clear work, bounded medium work already covered by a concise approved brief, or work already owned by a complete authoritative plan. Update the owning source when permitted; do not duplicate master plans, trackers, ADRs or problem records.

After a durable draft stabilizes, the main agent must review it against:

* owner-confirmed goal, exclusions and permissions;
* current repository behavior and direct implementation evidence;
* owning master plan, ADR, per-PR owner record and progress/problem sources;
* source ownership, dependency/order and branch baseline;
* observable acceptance criteria and proportional verification/manual QA;
* expected and forbidden files/domains;
* permission, stop and rollback boundaries;
* self-contradiction, stale claims, invented contracts and hidden scope expansion.

Correct supported findings within current planning permission and re-review. Self-review cannot approve a material agent-authored decision or grant implementation, commit, push, PR, merge or remote permission.
