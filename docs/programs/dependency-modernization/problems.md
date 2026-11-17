# Problems, risks and follow-ups — Initial dependency modernization

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md).

## Open

Register delivery-owned findings as the unit detail plans open. The audit snapshot records the baseline advisory paths.

### DMOD-001: shadcn 4.23.0 still carries advisories outside its own fix

- Status: Open (2026-11-17).
- Problem: After U2, the omit-dev audit still reports affected paths through shadcn. These are `ts-morph` and `@ts-morph/common` with nested `minimatch` and `brace-expansion`, plus `@babel/core` (low, [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8), range `<=7.29.0`). shadcn 4.23.0 requests `ts-morph ^26.0.0` and `@babel/core ^7.28.0`. The registry lists `ts-morph` 28.0.0 and `@babel/core` 8.1.2, so both fixes fall outside shadcn's ranges. npm audit offers only a semver-major downgrade of shadcn. `source-map-js` also remains, through Tailwind and Next.js as well as shadcn.
- Evidence: U2 CP1 on Node 20.20.2/npm 11.6.2 at `9cedf97e`. The omit-dev audit dropped from 21 to 8 entries and the full audit from 32 to 19.
- Direction: U5 tries a narrow in-range resolution for nested `brace-expansion` and `minimatch` and owns `source-map-js`. Revisit `ts-morph` and `@babel/core` when a shadcn release widens those ranges. Otherwise record a deferral with an owner in the closing audit.
- Exit condition: Neither audit reports an affected path through shadcn, or the closing audit records each remaining path with an owner, rationale and reopening condition.

## Resolved
