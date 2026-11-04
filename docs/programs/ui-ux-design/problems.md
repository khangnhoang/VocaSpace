# Problems, risks and follow-ups — UI/UX design

Charter: [README.md](./README.md). Progress: [progress.md](./progress.md). Transferred evidence below remains historical at its stated date; no probes were rerun.

## Open

<a id="auth-012"></a>

### AUTH-012: Auth screens have no accepted design yet

- Status: Deferred 2026-10-03 by the Owner to a separate login/register UI/UX redesign PR.
- Problem: A1's new check-email and set-password cards use a neutral white header, while `/login` and `/register` keep the older Blue 400 header. The login form is also small and visually dated. There is no accepted screen-type design for public/auth screens (the "Client/Marketing" type named in `docs/ui-design-system-and-review/plan.md`), so neither header can claim to be the target.
- A1 kept only cheap, behavior-level fixes: login floating labels now pass clicks to their inputs (`pointer-events-none`, matching `/register`).
- Direction: design Client/Marketing (homepage, login, register, check-email, set-password) first, then align all auth cards in one redesign PR.
- Evidence: A2 implementation review on `39581b0` (thread `01a10757-9a52-7440-ab95-3f9554bdcb5f`, 2026-10-04) found a Required contrast defect: the forgot-password email input inherits `Input`'s `--input` / `--ring` colors; on white, its border is 1.26:1 and focus border 2.59:1, with the translucent focus ring lighter still. The same defaults also affect A1's set-password input; login/register use that primitive with their own overrides.
- Owner decision 2026-10-04 (option 1): defer the shared auth contrast defect to this redesign PR; keep A2 consistent with set-password and change neither the auth pages nor shared primitive in this correction. This deferral does not mean the current UI meets WCAG 1.4.11.
- Required redesign acceptance: enabled input boundaries and focus indicators reach at least 3:1 against adjacent colors across all auth screens, verified in their rendered states with keyboard focus; align their styling together.
- Owner production QA of A2 (2026-10-04): move the "Quên mật khẩu?" link on `/login` to the right edge (under the password field) in this redesign.
- Exit condition: the auth redesign PR merges and meets the Required redesign acceptance above.
- Origin: auth-onboarding:AUTH-012; [original delivery contract](../auth-onboarding/plan.md).

<a id="student-003"></a>

### STUDENT-003: Visual composition of `/learn` is a temporary solution

- Status: Accepted for now (tracked; accepted in B2 after manual QA on 2026-07-13). Not a final design approval.
- Problem: the layout puts review, course path and payment reminder in the right responsibility zones, but visual quality and density balance do not yet meet the final quality bar for a workspace used often.
- Evidence: B2 manual QA of the dashboard, 2026-07-13. Desktop keeps review and payment in the left column and the learning path in the right; mobile orders `Nhịp ôn tập`, then course path, then payment. Course CTA, review action and payment interactions are unchanged.
- Direction: a separate frontend polish task (D8) re-evaluates hierarchy, density, card height and responsive rhythm; it is not merged with C2 URL synchronization or deeper payment history.
- Update (2026-10-09): D8-LUI (Decision 24) changes only semantic colors on `/learn`; hierarchy, density, card height and responsive rhythm are not revisited by it, so this entry stays open.
- Exit condition: that polish task is delivered.
- Origin: student-user-flow-route:STUDENT-003; [original delivery contract](../student-user-flow-route/plan.md).

<a id="uiux-001"></a>

### UIUX-001: Public course loading, empty and error states keep pre-Product-Language colors

- Status: Open (2026-11-04), recorded from the PR #183 review; outside U1, whose AC6 keeps these states unchanged.
- Problem: `PublicCourseFeedback` and `PublicCourseGridSkeleton` in `app/(client)/courses/_components/PublicCourseStates.tsx` still use `gray-200`, `gray-600`, `blue-50` and `blue-500` literals. On `/` and `/courses` they no longer match the restyled course cards and section headings.
- Evidence: U1 review of PR #183 on 2026-11-04; the states are shared by the homepage highlights and the `/courses` catalog.
- Direction: a later UI task maps them to Product Language neutral and state tokens on both routes, with Owner review of the rendered states.
- Exit condition: both routes render loading, empty and error states with Product Language tokens and the Owner accepts them.

## Resolved

One line each.
