# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U2 plan](./implementation-plans/u2-courses-catalog-redesign/plan.md) r3, approved by the Owner 2026-11-05. |
| Current unit / checkpoint | U2 on `feat/courses-catalog-redesign` from `736cc56`; CP1 next. |
| Status | Plan approved; implementation starting. Independent review passed r2 (0 Critical, 0 Required); r3 applies its optional suggestions. |
| Completed evidence | U1 merged in PR #183 and PR #184 (see Milestones). U2 demo `sources/index.html` checked in the built-in browser at 375/660/1440px: search, price filter, no-results, page 2 with focus, signed-in overlay and 0/1/3-course and error states rendered without console errors or horizontal scroll. Contrast, 200% zoom and full keyboard order were not measured on the demo. |
| Accepted deviations | none. |
| Blockers / Owner decisions | The hosted migration needs its own grant before merge. U1 leftovers are tracked in [UIUX-002](./problems.md#uiux-002). |
| Next action | Implement CP1 (Main). |
| Current authority | Owner granted 2026-11-05: plan r3 approval, implementation of CP1–CP4 by Main in this session, and local commits per checkpoint. Local DB work follows the plan (root `migration up`, isolated-runtime reset, root-local fixture script). No push, PR, merge, hosted migration or deployment is granted. |

## Milestones

- 2026-11-04 Owner approved the U1 homepage redesign plan r1 (`c64f30c`).
- 2026-11-04 U1 homepage body, deck demo, motion and sample mode committed (`6ec68b9`).
- 2026-11-04 U1 public course card restyle committed (`da245f6`).
- 2026-11-04 U1 white header and mobile navigation committed (`876f366`).
- 2026-11-04 U1 local demo covers script committed (`bf177c6`).
- 2026-11-04 U1 plan r2 records the Owner QA decisions 11–16 (`18bdded`).
- 2026-11-04 PR #183 opened for U1 (PR 183, `18bdded`).
- 2026-11-04 U1 plan r3 records the PR #183 review fixes and UIUX-001 (`b66649c6`).
- 2026-11-05 U1 merged after review fixes (PR 183, `dfe79c4`).
- 2026-11-05 U1 trial motion and responsive follow-up merged (PR 184, `736cc56`).
- 2026-11-05 Owner approved the U2 course catalog plan r3 after independent review (this commit).
