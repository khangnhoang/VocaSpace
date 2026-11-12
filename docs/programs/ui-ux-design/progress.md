# Progress — UI/UX design

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [U3 plan](./implementation-plans/u3-auth-pages-redesign/plan.md) r5: r2 approved by the Owner 2026-11-10 with decision 13; r3–r5 add Owner decisions 15, 16 and 17 (2026-11-11/12). |
| Current unit / checkpoint | U3 on `feat/auth-pages-redesign` from `ab809e8`; CP1–CP4 and Final QA done; final independent review passed in round 3 (`23ac37a`); Owner review of the running screens pending. |
| Status | CP1 passed its independent review (`08f0db8`). The final independent review of `a42f4b4..8d90f55` (Claude Fable 5.2, high) returned CHANGES REQUIRED (0 Critical, 3 Required, 7 Suggestions, 4 Nits); the three Required findings and Suggestions 1, 2, 4, 5, 6 and 7 are fixed in `6214b9f`, Suggestion 3 (network-failure copy) needs an Owner decision. Round 2 on `6214b9f` returned CHANGES REQUIRED (0 Critical, 1 Required, 1 Nit): the date button's focus ring turned Correction red when the field was invalid; fixed in `23ac37a`, together with the Nit. Round 3 on `23ac37a` returned PASS (0 Critical, 0 Required, 0 Suggestions, 1 Nit on this State wording, fixed in `75cbdc1`). |
| Completed evidence | Detailed CP1–CP4 evidence (suites, browser checks, motion samples) is in `git show 238d7aa:docs/programs/ui-ux-design/progress.md`. Final (2026-11-11): `npm run test:run` 151 files, 2371/2371 at `238d7aa`, 2374/2374 at `6214b9f`; `npm run lint` and `npx tsc --noEmit` clean in source; `npm run docs:check` passed. Production-build smoke (`NEXT_DIST_DIR=.next-e2e`, `E2E_WEB_SERVER=start`, unsharded) on this branch: 84 passed, 1 failed, twice; the same unsharded suite on `main` `ab809e8` (detached worktree, CI test PayOS values): 81 passed, 1 failed, with the same failure — `topic-builder-sheet-layout` "opening a dialog on the course portfolio does not shift the page" — so it is a pre-existing order-dependent failure, not a U3 regression; main CI's sharded smoke passes. Playwright CLI on `next dev`: no horizontal overflow at 320/375/640/768/1440 px on `/login`, `/register`, `/forgot-password`; lowest measured text contrast 4.7:1, input borders 4.76:1; keyboard order follows the visual order; inputs, buttons and the date-of-birth control show a Route Blue 2px focus indicator offset 2px (inputs fixed in `8d90f55`, the date button in `6214b9f`, and the date button while invalid in `23ac37a` — measured settled box-shadow `rgb(37, 99, 235)` against Correction at 25% alpha before the fix); the `AutoHeight` clip box leaves 6px around each field. Decision 15 (`28f022c`): auth-onboarding and both auth-motion suites 64/64; with `**/login` routed to 502 after load, Enter in the password field shows the connection message, keeps the password and focuses it with an empty selection. Decision 16 (Playwright CLI, `next dev`): the strip is 408px wide and 189px tall at 768, 820 and 959px on `/login`, `/register` and `/forgot-password` (about 390px before), 161px at 375px and 148px at 320px; strip and form share the same left edge; no horizontal overflow at 320, 375, 768, 820, 959, 960, 1024 and 1440px; at 1024×1366 the card is centred vertically; auth suites 118/118. Decision 17 (Playwright CLI, `next dev`): below 960px only the deck region is shown and from 960px only the curve (checked at 320, 375, 768, 820, 959, 960 and 1440px), no horizontal overflow; `/login` reviews twice and stops with "vivid" on top, password focus turns the top card (`rotateY(180deg)`); register step 2 puts "profile" on top with the enter animation; `/forgot-password` fades the word to opacity 0.35 with 1.5px blur; auth suites 127/127. |
| Accepted deviations | CP1: `lib/auth/sign-in-reason.ts` and `app/auth/confirm/route.ts` keep their G1 comments, which stay true under the amended wording. CP3: gender uses the accepted demo's three radio boxes instead of the old Select; the date of birth keeps the Calendar popover; the check-email stage drops the old "Đã có tài khoản? Đăng nhập" line (header and tabs keep the sign-in link). CP4: the curve draw, flashcard flip and rail fill use CSS (keyframes with `pathLength="1"`, transitions) instead of Motion, so they start at first paint without hiding server HTML (G10); Motion for React drives the tab indicator (`layoutId`), view and step entry, form height, shake and success check. Views and steps enter without an exit animation so the next inputs are usable at once. Decision 17: the word deck also uses CSS transitions and keyframes (deck positions, enter, fade) for the same G10 reason; Motion for React supplies only its reduced-motion signal. The callback's Supabase session cookies next to the new cookies are proven only by the Owner's post-merge Google check. The local QA account `u3qa1110@gmail.com` stays in the root-local DB until the Owner's QA ends. |
| Blockers / Owner decisions | None open. Owner decision 2026-11-11 on review Suggestion 3: when the sign-in request fails in transit, `/login` shows "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại." instead of "Sai email hoặc mật khẩu!", keeps both values and refocuses the password without selecting it or shaking; plan decision 15, done in `28f022c`; review round 4 PASS (0 Critical, 0 Required, 1 Suggestion, 3 Nits), all four addressed in `6ef505a`. Owner decision 2026-11-11 on tablet layout (decision 16): option A, compact strip below 960px; done in `a729214`. Owner decision 2026-11-12 (decision 17): a word-card deck replaces the curve below 960px, accepted from the rendered demo `sources/small-screen-deck.html`; done in this commit. A Supabase outage seen by the server still returns the wrong-credentials message. |
| Next action | The Owner reviews the running screens; delivery (push, PR) needs a new grant. |
| Current authority | Owner granted 2026-11-10: plan r2 approval, implementation of CP1–CP4 by Main in this session, local commits per checkpoint and a local commit of the plan docs. No push, PR, merge, hosted change or deployment is granted. |

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
- 2026-11-05 Owner approved the U2 course catalog plan r3 after independent review (`115cc18`).
- 2026-11-05 U2 CP1: catalog listing RPC, schema, action, parity tests and local catalog fixture (`455dde0`).
- 2026-11-05 U2 CP2: catalog page with search, filters, sort, URL state, pagination, cards and states (`e415176`).
- 2026-11-05 U2 CP3: list reflow, sliding price indicator, page fade-in and scroll reveal (`0ba9156`).
- 2026-11-05 U2 CP4: shared course states on Product Language tokens and the discovery smoke contract (`607788e`).
- 2026-11-05 U2 implementation review 1 fixes: touch targets, pending-search and same-page history guards, focus reveal, fixture card backs, enrollment parity (`c86164d`).
- 2026-11-05 U2 final QA: contrast fixes for counts, hint and control boundaries (decision 15) (`048a317`).
- 2026-11-05 U2 Owner QA: the sort control uses the shared Radix Select with icons instead of the native select (`f2238a7`).
- 2026-11-05 U2 Owner QA: mobile back-to-top button after about two courses (decision 16) (`b461e99`).
- 2026-11-06 U2 merged (PR 185, `ab809e8`).
- 2026-11-10 Owner approved the U3 plan r2 after independent plan review (`a42f4b4`).
- 2026-11-10 U3 CP1: server-recorded return path for /teacher, /profile and /admin, last sign-in method cookie and the auth-onboarding G1 amendment (`ca8c691`).
- 2026-11-10 U3 CP1 correction: repaired the progress State and clear the stored path when a guarded path fails the allowlist (`08f0db8`).
- 2026-11-10 U3 CP2: auth shell with the memory-curve panel and tabs, redesigned /login and /forgot-password, Vietnamese login names in the smoke suite, POST-only auth forms and the return-path smoke (`cb0934c`).
- 2026-11-10 U3 CP3: five-stage registration with the check-email stage and the two-stage set-password page on the shared shell (`d693a62`).
- 2026-11-10 U3 CP4: curve draw, sliding tab indicator, step and view entry, form height, failure shake and success check, with reduced-motion equivalence (`238d7aa`).
- 2026-11-10 U3 Final QA: keyboard focus outline on auth inputs (`8d90f55`).
- 2026-11-11 U3 final independent review round 1 fixes: date-button focus, focus on the check-email stage, AUTH-012 status, reduced-motion success check, avatar reset, regional email domains, clip room and State (`6214b9f`).
- 2026-11-11 U3 final independent review round 2 fix: Route Blue focus ring on the invalid date button (`23ac37a`).
- 2026-11-11 U3 final independent review round 3: PASS on `23ac37a` (`75cbdc1`).
- 2026-11-11 U3 Owner decision on review Suggestion 3: a separate connection message when sign-in fails in transit (`28f022c`).
- 2026-11-11 U3 review round 4 PASS on `28f022c`; plan r3 records decision 15 and the review notes are applied (`6ef505a`).
- 2026-11-11 U3 Owner decision 16: compact curve strip and centred card on tablets and phones (`a729214`).
- 2026-11-12 U3 Owner decision 17: word-card deck replaces the curve below 960px (this commit).
