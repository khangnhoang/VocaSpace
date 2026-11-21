# Future features — Infrastructure and reliability

Charter: [README.md](./README.md). Directions below are not implementation authority. Transferred wording retains its original planning scope and dated evidence; this migration does not revalidate runtime status.

<a id="bfeat-001"></a>

## BFEAT-001: Dependency update policy

- Status: Planned (Owner direction, 2026-10-24); infrastructure owns the direction; no initiative is open. An update is accepted only when the tests stay green.
- Direction: update dependencies on a regular schedule, with one rule per update type. Patch (for example 4.1.0 to 4.1.1): update regularly and run the tests. Minor (4.1 to 4.2): read the changelog, then update when it fits. Major (4.x to 5.x): handle it as its own migration task and check the breaking changes. Security fix: handle it early, ordered by impact. DevSpace records the same policy as its infrastructure FEAT-001.
- Waiting (2026-10-24): `next` 16.2.6 to 16.3.8, a minor update that fixes the router action queue bug behind `ACTION-QUEUE-001` in [student-user-flow-route problems](../student-user-flow-route/problems.md). A trial on a local production build passed the topic builder repro and `issue-deep-links` 3 times each. Known costs: `AppRouterInstance` gains a required `bfcacheId`, so the two router mocks in `__tests__/components/public-course-*.test.tsx` need it; `issue-deep-links` must wait for hydration before it dismisses the unavailable-content notice; `next dev` run by an AI agent appends a managed block to `AGENTS.md` that must not be committed. 16.4.3 was published on 2026-10-23 and is not yet a candidate. Applied (2026-10-28, Owner): TFEAT4 on `feat/topic-builder-redesign` updates `next` to 16.3.8 with the `bfcacheId` mock change; it is delivered with that PR.
- Target program: [Infrastructure and reliability](./README.md).

## FEAT-026: Parallel Playwright workers per E2E shard

- Status: Deferred (Owner direction, 2026-11-22), outside [INFRA-U1](./implementation-plans/u1-test-runtime/plan.md).
- Direction: run more than one Playwright worker per shard. Today every smoke file shares one isolated database with `workers: 1`. This needs an audit of each spec's fixture ownership (per-worker data, no shared seed mutation) first. Revisit after INFRA-U1 CP4 measures shard timing.
- Target program: [Infrastructure and reliability](./README.md).

## FEAT-027: Pin the local Node version to CI

- Status: Deferred (Owner direction, 2026-11-22).
- Direction: VocaSpace has no `.node-version`; CI runs Node 20 while the Owner's machine defaults to Node 24 through fnm. Add a `.node-version` that matches CI and an agent command rule (DevSpace uses `fnm exec -- <command>`), once the Owner wants local and CI runtimes aligned.
- Target program: [Infrastructure and reliability](./README.md).

## FEAT-028: Balance E2E shards and measure 3 and 4 shards

- Status: Deferred (Owner direction, 2026-11-22; INFRA-U1 CP4 dropped because the GitHub Actions quota is nearly used up).
- Direction: shorten the slowest CI E2E shard further. Playwright's `--shard` splits the smoke files by test count in file order, so one shard's test time varies from 4.9 to 6.8 min on the same revision; `fullyParallel` does not move that boundary while the four serial spec files keep their groups. Options: an explicit duration-balanced file list per shard with a test that no smoke spec is left out (a replay on the `9b343dcd` logs put the two shards at about 304/314 s and 351/342 s of test time against 332/287 s and 395/298 s), or splitting the longest serial specs. Then measure 3 and 4 shards, which cost more runner minutes. The Supabase start still outlasts `npm ci` plus Chromium by about 37 s, so a start that is not the critical path, or `H2` of the INFRA-U1 plan (build without waiting for the stack), is the other open lever. The repeatable identity check is `scripts/e2e/shard-ids.mjs`.
- Target program: [Infrastructure and reliability](./README.md).
