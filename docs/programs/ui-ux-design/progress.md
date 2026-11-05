# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U1 plan](./implementation-plans/u1-homepage-redesign/plan.md) r7. Owner QA accepted the overall composition and authorized delivery after clarifying the trial queue, card motion, indicator and connector start state on 2026-11-05. |
| Current unit / checkpoint | U1 follow-up on `feat/homepage-motion-identity`. R6 uses the real learning stage for the public trial and corrects the connector start state. |
| Status | Owner accepted the overall rendered composition. Preparing grouped commits and PR delivery. |
| Completed evidence | Historical U1 delivery merged as PR #183 at `dfe79c4e`. R6 focused run passed 186 tests in seven files. The homepage regression verifies Again → Easy → Easy leaves two of three cards passed, Hard leaves the last card pending, and Good completes it. TypeScript and focused eslint passed. Edge at 320/375/768/1440px in default and reduced motion confirmed fixed card bounds, label-width underlines and correct focus and queue transitions. A further 73 rapid switches showed one matching front face at each step. The underline passed through intermediate positions and rendered CSS reports an 800ms flip. At 375/1440px both connectors began at zero, connector two stayed at zero during the delay and both reached one. The reduced-motion probe showed the settled connectors and a revealed answer without rotation. Docker Engine and the existing local Supabase containers recovered after isolating the stale Secrets Engine socket. QA scripts and images are in `test-results/homepage-motion/`. |
| Accepted deviations | R6 uses `FlashcardStage` for the real card layout and rating controls. The homepage applies a 650ms entry to the text on deck change and an 800ms flip at the usage site. The one-time intro reveals the same rating controls as a manual reveal. |
| Blockers / Owner decisions | Browser UI zoom at 200%, exhaustive control contrast and production bundle size remain unverified. Prior r4 audit findings are tracked in the working evidence for that revision. |
| Next action | Commit related groups, push, create the PR and merge after CI passes. |
| Current authority | Fetch/switch/pull, branch creation, removal of Product Language timing limits, homepage refinement, Motion installation, frontend skill guidance and local verification granted 2026-11-05. Owner granted grouped commits, push, PR creation and merge after CI passes on 2026-11-05. The task started the Next dev server; the pre-existing local Supabase stack was reused without fixture writes/reset. |

## Milestones

- 2026-11-04 Owner approved the U1 homepage redesign plan r1 (`c64f30c`).
- 2026-11-04 U1 homepage body, deck demo, motion and sample mode committed (`6ec68b9`).
- 2026-11-04 U1 public course card restyle committed (`da245f6`).
- 2026-11-04 U1 white header and mobile navigation committed (`876f366`).
- 2026-11-04 U1 local demo covers script committed (`bf177c6`).
- 2026-11-04 U1 plan r2 records the Owner QA decisions 11–16 (`18bdded`).
- 2026-11-04 PR #183 opened for U1 (PR 183, `18bdded`).
- 2026-11-04 U1 plan r3 records the PR #183 review fixes and UIUX-001 (`b66649c6`).
