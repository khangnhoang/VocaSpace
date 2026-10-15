# Plan — screen-type design instead of per-page briefs, plus an Admin design

Revision: r1, 2026-10-15. Owner approval: 2026-10-15. Amends: the [Master Plan](../../plan.md) "Design artifact lifecycle" (closed program). Related open problem: [ADMIN-005](../../../programs/admin-console/problems.md).

This is a standalone plan: the UI design program is closed and this work is not an admin-console unit, so its State is the inline block in §7 (shaped like the progress template).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this PR merges, a new page or a redesign is built on Product Language, the matching screen-type design and the shared-component contracts, with no per-page design brief. Admin has its own Owner-accepted screen-type design, including a dark-only palette, that the later admin page redesign builds on.

| ID | Observable result |
| --- | --- |
| AC1 | A reader of the Master Plan lifecycle, `index.md` or `frontend-design` finds no requirement to write or revise a design brief (surface specification) for a new page or a redesign. |
| AC2 | The same three sources say that a new page or a redesign still needs Owner review of the running screen before merge. |
| AC3 | The same three sources say that a change to the destructive-confirmation model, a cross-surface interaction, or a new palette or geometry still needs an explicit Owner decision before implementation. |
| AC4 | `frontend-design` says that when the screen type of a new page or redesign has no accepted screen-type design (today: Client / Marketing), the agent raises it as an Owner question at planning, before design work. |
| AC5 | The two accepted briefs (Teacher Course Structure, Learning Workspace) stay in `index.md` as accepted references. A later PR that makes one of them wrong fixes or removes the wrong part in the same PR; nobody has to create a new brief. |
| AC6 | Where an accepted design says a choice belongs to "a surface specification" (Product Language §2, Learning Experience confetti and §342, Teacher Authoring §6 and §11), the lifecycle says the page's own plan makes that choice and the Owner's review of the running screen accepts it. Those accepted bodies are not rewritten. The homepage direction in `future-features.md` says the homepage plan, not a surface specification, reconciles it with the real page. |
| AC7 | `docs/ui-design-system-and-review/screen-types/admin-business-operations.md` exists, is `Accepted` by an explicit Owner decision tied to the exact candidate, and is listed in `index.md`. |
| AC8 | The Admin design inherits Product Language and covers: thesis and latitude; dark-only palette as counterparts of Product Language roles, with measured contrast; typography and density; page frame (sidebar, header, page title, actions); tables and lists; search and filters, including as-you-type search with no visible jump; status language; summary panels; confirmations for consequential actions; pagination; loading, empty, error, permission and stale states; responsive behavior; keyboard and focus; motion. |
| AC9 | Every text pair in the Admin palette meets 4.5:1 (3:1 for large text), and focus rings, control boundaries and meaningful icons meet 3:1, computed from the hex values by a script, not estimated. |
| AC10 | The `frontend-design` Admin reference states medium latitude (polish through typography, spacing rhythm, data hierarchy and smooth interaction, still predictable and safe) and routes to the accepted Admin design. |
| AC11 | Changed and new `frontend-design` eval cases cover AC1–AC4 and AC10; structural validation passes; a fresh-reader check of the changed rules is reported with its real result. |
| AC12 | ADMIN-005 records that the design half is done and stays open; its exit condition (admin pages reviewed against the accepted design) is unchanged. |
| AC13 | No runtime file changes: nothing under `app/`, `components/`, `lib/`, `app/globals.css`, tests or migrations. |

### 1.2 Scope and non-goals

- In scope:
  - Master Plan lifecycle section (steps 3–5) and the `index.md` header;
  - the Product Language §2 ownership text and §3.2 note, only as far as the Admin dark values need (G2);
  - `future-features.md`: the Admin theme line and the homepage sentence that requires a surface specification (AC6);
  - `frontend-design` `SKILL.md` "Design sources and decision boundary", `references/admin-business-operations.md`, and `.agents/evals/frontend-design/*`;
  - the new Admin screen-type design and its `index.md` entry;
  - the ADMIN-005 entry in `docs/programs/admin-console/problems.md`;
  - an ephemeral review aid for the Owner (outside the repository, not committed).
- Non-goals:
  - the admin page redesign (`/admin`, `/admin/courses`, `/admin/user-management`), including the search fix: a later PR;
  - any CSS token, `.dark` variable, component or runtime change, including the admin shell colors;
  - a Client / Marketing screen-type design;
  - the content of Learning Experience, Teacher Authoring, Button and the two accepted briefs;
  - the floating sheet component design (`future-features.md`);
  - `frontend-ui-review`, `frontend-workflow` and other skills (their wording already works without briefs, see §2);
  - historical plans and progress (UI-1 to UI-5, design-spec-governance, AD3).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No runtime change in this PR (AC13). | Admin colors ship before the Owner accepts them, and the redesign PR loses its review boundary. |
| G2. Admin dark values are dark counterparts of existing Product Language roles (Canvas, Surface, Border, text roles, Route/Action Blue, state colors), not new roles; a role Product Language does not have is named in the Admin design as an exception with use, reason, boundary and fallback. The Product Language edit is part of the Admin candidate and is accepted by the same Owner decision: §2 says the Admin screen-type design owns the dark values of Product Language roles for Admin screens only, and the §3.2 note points to it. Neither is published before that acceptance. | Product Language §2 forbids a second palette in a screen-type design; reusing role names alone does not give Admin ownership of the values, so the two accepted sources would contradict each other. |
| G3. The Admin candidate is not listed in `index.md` and its Status is not `Accepted` until the Owner accepts that exact candidate. | `frontend-design` routes agents to an unapproved design. |
| G4. The two accepted briefs are not deleted or rewritten. | Owner decision 2026-10-14 keeps them as reference; their routes lose their accepted composition. |
| G5. Contrast is computed from hex values by a script and reported per pair (AC9). | A dark palette that looks fine fails WCAG 2.2 AA in the redesign. |
| G6. Skill changes follow `maintain-repo-skills`: evals updated with the rule change, validators run, fresh-reader check only after the skill candidate passes implementation review, and only under an explicit Owner grant for that check; otherwise it is reported `not_run`. Plan approval or edit permission does not grant it. | A routing or approval rule changes with no evidence that agents read it the new way, or a model run happens without authority. |

### 1.4 Owner decisions that bind this plan

1. (2026-10-14) Stop requiring a design brief per surface; new pages and redesigns build on Product Language, the screen-type design and component contracts, with room for agent creativity.
2. (2026-10-14) Kept conditions: a new page or redesign still needs Owner review of the running screen before merge; destructive-confirmation, cross-surface interaction, or new palette or geometry changes still need an explicit Owner decision; a screen type with no accepted design is raised as an Owner question at planning.
3. (2026-10-14) The two accepted briefs stay as reference; no new briefs are required.
4. (2026-10-14) This is a separate PR after AD3 (AD3 merged in PR 157).
5. (2026-10-15) PR scope: the rules plus the Admin screen-type design; the admin page redesign is a later PR.
6. (2026-10-15) The plan is standalone under the UI design docs; ADMIN-005 stays open until the admin pages are redesigned.
7. (2026-10-15) The Admin design defines a dark palette mapped to semantic roles, shown to the Owner with visual samples, with contrast measured.
8. (2026-10-15) Admin latitude rises from low to medium; the `frontend-design` Admin reference changes with it.

## 2. Repository facts

Baseline: `fea4f47`, checked 2026-10-15.

- Master Plan lifecycle step 3, first bullet (`plan.md:75`) requires a short design brief for a new surface or redesign; step 5 (`plan.md:82`) sets brief size — the rule to replace (AC1).
- `index.md:5` repeats "a new surface or redesign needs a brief" — the second place (AC1).
- `frontend-design` `SKILL.md:56` lists "surface specification" among design sources and says "a surface specification composes them"; it does not itself require one. `SKILL.md:58` already says an absent accepted design is not a stop condition — the place for AC3/AC4 wording.
- `frontend-design/references/admin-business-operations.md:7` says "low, but not zero, design latitude" — conflicts with Owner decision 8 (AC10).
- Product Language §2 (`product-language.md:49`) says a screen-type design does not own "a second palette"; §3.2 note (`:81`) says the dark-only Admin direction is future scope and not approval of current `.dark` variables — conflict with Owner decision 7, resolved by G2.
- `future-features.md:11` records "Admin is intended to be dark-only"; `future-features.md:25` says a future surface specification must reconcile the homepage direction before any code change — a third brief requirement (AC6).
- Learning Experience (`learning-experience.md:229`, `:342`), Teacher Authoring (`teacher-authoring.md:138`, `:295`) and Product Language (`product-language.md:51`) defer choices to "a surface specification" — the reason for AC6.
- `frontend-ui-review/SKILL.md:51` lists a surface specification as one of "every applicable" accepted source; it works when none exists, so the skill needs no change.
- Current admin shell hard-codes dark hex values (`app/admin/layout.tsx:12` `bg-[#0F172A]`; `#1E293B`, `#0B1120`, `#111827`, `#334155` across admin components) under the `.dark` class, whose `globals.css:185` variables are shadcn defaults, not accepted values — the starting point the Admin palette replaces in the later redesign.
- ADMIN-005 (`docs/programs/admin-console/problems.md:24`) names this direction and the AD3 Owner QA (admin pages look poor; search jumps while typing) — inputs to AC8 and AC12.
- `frontend-design` evals: `routing.json` criterion `admin-route-and-latitude` (`:48`, case `fd-route-admin-operations`) and `regression.json:384` describe Admin as "stable, dense, predictable"; neither asserts "low" latitude, so they stay valid but new cases are needed for AC1–AC4 and AC10.

## 3. Bounded implementation hypotheses

- The Admin design follows the section shape of the accepted Teacher Authoring and Learning Experience designs (thesis, ownership, hierarchy, states, responsive, accessibility, motion, representative plates, non-goals) at about 200–300 lines — may change if AC8 still holds.
- The palette is presented as a table of Product Language role → dark hex → contrast against its pair, with one or two alternatives for the canvas/surface ladder and the accent on dark — may change if G2 and G5 hold.
- The review aid is one local HTML file in the session scratchpad with palette plates, a dense table with status, a search-with-results state, a confirmation dialog and a summary panel, at 1440 and 375 px, opened in the browser pane — may change to another non-committed form if the Owner can judge the same choices.
- New eval cases: (a) a new Admin page with an accepted Admin design and no brief; (b) a new Client / Marketing page with no accepted screen-type design; (c) an Admin redesign that wants a new destructive-confirmation pattern — may change if AC11 still holds.
- Fresh-reader check uses the `opus-medium-reader` agent on cases (a)–(c), per `maintain-repo-skills/references/fresh-reader-testing.md`, once the Owner grants it (G6) — may change to another fresh reader that the reference allows.

## 4. Checkpoints

Dependencies: CP2 needs CP1. CP3 needs CP2 (the Admin design is written under the new rules). CP4 needs CP3, because the Admin reference routes to the accepted Admin design. Checkpoints are review boundaries; how commits are split follows the actual change and the Owner's commit grant.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | This plan, after Codex plan review PASS and Owner approval. | `npm run docs:check`; `git diff --check` |
| CP2 | Rules: Master Plan lifecycle steps 3–5 rewritten (AC1–AC3, AC5, AC6); `index.md` header updated; the two brief entries kept. | Read the lifecycle, `index.md` and `frontend-design` §Design sources together for contradictions; `npm run docs:check`; `git diff --check`; grep that no current rule source says a new surface needs a brief |
| CP3 | Admin design: discovery of the three admin screens; contrast script over the candidate palette; review aid; one candidate made of the Admin document (Status `Candidate`) and the Product Language §2/§3.2 edit (G2); Owner review and explicit acceptance of that candidate; then Status `Accepted`, the Product Language edit applied, `index.md` entry, `future-features.md` Admin line, ADMIN-005 update (AC7–AC9, AC12). Owner feedback rounds revise the candidate before acceptance. | Contrast script output for every pair; browser pane view of the review aid at 1440 and 375 px; `npm run docs:check`; `git diff --check` |
| CP4 | Skill: `frontend-design` §Design sources (AC1–AC4), Admin reference (AC10), eval cases (AC11). Order: edit skill and evals → structural checks → whole-branch self-review and Codex implementation review until PASS → fresh-reader check (G6) → evidence summary. A skill correction after the fresh-reader check reruns only the affected cases. | `node .agents/scripts/validate-skill.mjs`; `node .agents/scripts/run-skill-evals.mjs validate --skill frontend-design`; fresh-reader result or `not_run`; `npm run docs:check`; `git diff --check`; `git diff --stat fea4f47` shows no runtime path (AC13) |

Manual QA: none of the runtime; the Owner's review of the Admin candidate in CP3 is the only manual step. Fixture readiness: not applicable (no data-dependent QA).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Without briefs, a redesign drifts from the accepted screen-type design and nobody notices before merge. | AC2: Owner review of the running screen stays mandatory; `frontend-ui-review` still runs for new pages and redesigns against the screen-type design. |
| The Admin palette passes contrast in isolation but looks wrong in dense tables. | The review aid shows the palette in a real admin table, dialog and summary panel, not only swatches. |
| Medium latitude is read as permission for marketing effects in Admin. | The Admin reference and design keep the existing "avoid" list (landing-page effects, decorative backgrounds, hidden actions, clever interaction at the cost of predictability). |
| A future agent treats "surface specification" wording in accepted LE/TA bodies as a brief requirement. | AC6 states the mapping in the lifecycle; eval case (a) checks the no-brief reading. |
| The Owner wants changes after acceptance. | That is a new Owner decision on the Admin design per the lifecycle; no amendment ceremony. |

- Rollout runbook: none (documentation and skill only; no hosted step).
- Stop when: the Owner does not accept an Admin candidate; a palette pair cannot reach AA without a new Product Language role the Owner has not accepted; a fresh-reader result shows agents still require a brief or skip the Owner review; a change outside §1.2 scope becomes necessary.
- Rollback: revert the PR; no data or runtime state changes.

## 6. Verification limits

- No product tests, build or browser QA of the app: the runtime does not change.
- Eval suite runs with live models (`run-skill-eval-cli.mjs` dispatch) are not planned; they run only if the Owner grants them. Structural validation is not semantic evidence.

## 7. State

| Field | Value |
| --- | --- |
| Spec revision | This plan r1 |
| Current unit / checkpoint | CP2 |
| Status | in progress: plan approved by the Owner (2026-10-15) and committed as CP1 |
| Completed evidence | Branch `docs/screen-type-design` from `main` at `fea4f47` (2026-10-15). Codex plan review (`gpt-6.1-sol`, high, read-only): round 1 FAIL (4 Required, 1 Suggestion, 1 Nit, all fixed), round 2 PASS. `npm run docs:check`: 0 structure violations, 0 new broken links |
| Accepted deviations | none |
| Blockers / Owner decisions | Owner acceptance of the Admin candidate in CP3; Owner grant for the CP4 fresh-reader check |
| Next action | Main implements CP2 |
| Current authority | Owner, 2026-10-15: plan r1 approved; commit CP1 and implement CP2–CP4 on this branch with local commits only. Push, PR and the CP4 fresh-reader check are not granted |
