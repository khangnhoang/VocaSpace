# QA fixture readiness

Read this reference when a plan contains data-dependent manual QA or fixture/seed readiness decisions. Skip it for plans with no data-dependent manual QA.

For data-dependent QA, decide fixture readiness before implementation reaches final UI or browser QA. Use `test-quality-strategy` for the state matrix, canonical fixture assessment, deterministic fixture rules, verification scope, evidence, and manual-QA completion criteria; use `frontend-workflow` for browser timing, responsive checks, and interaction/visual validation.

Record exactly one outcome:

* existing canonical fixture is sufficient
* canonical fixture requires the following narrow additions
* manual QA does not require seeded data
* fixture preparation is blocked and requires owner input

Use this compact section when the task has meaningful data-dependent QA:

```txt
### QA fixture readiness

- QA type:
- Canonical fixture source:
- Existing covered states:
- Missing states:
- Required fixture additions:
- Reset/setup command:
- Fixture checkpoint:
- Browser QA may begin when:
```

Do not require this section for tasks without meaningful data-dependent QA. Do not postpone the decision until final manual QA, and do not reproduce the owning skills' detailed fixture or browser rules in the plan.
