# Future features — Agent workflow

Charter: [README.md](./README.md). Directions below are not implementation authority. Transferred wording retains its original planning scope and dated evidence; this migration does not revalidate runtime status.

<a id="feat-023"></a>

## FEAT-023: Local CI gate before a PR

- Status: Deferred; scope remains unsettled.
- Direction: (2026-10-17) Local CI gate before a PR: before creating a PR or pushing to a PR branch, the agent runs locally the CI jobs the diff triggers, so a failure is fixed before GitHub Actions runs. Scope is not settled, and the skill eval suite needs cases for it before any skill text changes. Direction so far: `.github/workflows/ci.yml` stays the only source of the commands; integration jobs run only when the diff matches the `changes` pattern; when a triggered job cannot run locally, the agent stops and asks the Owner with its structured question tool; a local pass is not CI evidence.
- Target program: [Agent workflow](./README.md).
