# Future features — backlog

Owner direction that no open program owns. This is not a program: it has no plan and no progress. Work that is in scope belongs in the owning program's plan.

## BFEAT-001: Dependency update policy

- Status: Planned (Owner direction, 2026-10-24); no unit or program owns it yet. An update is accepted only when the tests stay green.
- Direction: update dependencies on a regular schedule, with one rule per update type. Patch (for example 4.1.0 to 4.1.1): update regularly and run the tests. Minor (4.1 to 4.2): read the changelog, then update when it fits. Major (4.x to 5.x): handle it as its own migration task and check the breaking changes. Security fix: handle it early, ordered by impact. DevSpace records the same policy as its infrastructure FEAT-001.
- Waiting (2026-10-24): `next` 16.2.6 to 16.3.8, a minor update that fixes the router action queue bug behind `ACTION-QUEUE-001` in [student-user-flow-route problems](../programs/student-user-flow-route/problems.md). A trial on a local production build passed the topic builder repro and `issue-deep-links` 3 times each. Known costs: `AppRouterInstance` gains a required `bfcacheId`, so the two router mocks in `__tests__/components/public-course-*.test.tsx` need it; `issue-deep-links` must wait for hydration before it dismisses the unavailable-content notice; `next dev` run by an AI agent appends a managed block to `AGENTS.md` that must not be committed. 16.4.3 was published on 2026-10-23 and is not yet a candidate.
- Target program: none yet.
