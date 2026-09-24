# D2 — Public topic preview: detailed implementation plan

Status: implementation contract for the D2 feature branch. Baseline: `main @ 65e8481`; Q7 status reconciliation is the preceding, separate checkpoint. This plan does not claim that D2 is implemented or deployed.

## 1. Objective, scope, and exclusions

Let a course owner or co-owner choose preview topics within the current 20% cap. A public visitor or unenrolled learner may open the complete published preview topic, including its exercises and media, and receive immediate answer correctness. Preview use must create no persistent learning state.

D2 includes the topic marker and quota, authoring control, public course detail link and preview route, guarded content and answer reads, private media delivery, local/CI integration and browser verification, and the documentation needed to describe the shipped state. D2 preserves D1's authoring/review lifecycle and Q7's internal collaborator/read and enrolled-write boundaries. D3 memory, D4 completion, broad `LEARNING-INTEGRITY-001` relation/correctness repair, candidate revisions, payment, and collaborator redesign are excluded.

## 2. Confirmed repository state and decisions

| Area | Current fact / owner decision |
| --- | --- |
| Product rule | Master plan Decision 12, the Wave D decision table, and `PREVIEW-001` require owner/co-owner selection, `ceil(active_topic_count * 0.2)`, draft topics in the denominator, and published/active course and topic plus marker for public access. If a smaller denominator exceeds the cap, the owner/co-owner chooses markers to remove in the same operation; never silently unmark or require another screen. |
| Public catalog | `get_public_course_detail` is a narrow `SECURITY DEFINER` RPC for active published courses. Its active published syllabus topics have metadata only. `addTemporaryPreviewFlag` marks the first topic in the Action DTO; the syllabus calls that badge temporary and offers no content link. There is no persisted topic preview marker. |
| Topic lifecycle | `topics` has `status`, `removed_at`, `course_id`, and `chapter_id`; no preview column. D1 owns publish approval, pending freeze, delete, and restore. `d1_delete_topic` locks course then topic and sets draft/removed; `d1_restore_topic` restores a draft. D1 narrowed direct topic UPDATE to draft/topic-group rows and explicitly granted only named columns; the new marker must not be added to that grant. Direct `removed_at` changes can still affect the quota. A marker must not become an alternate publish or authoring path. |
| Learning workspace | `/learn/[course-slug]/[topic-slug]` and `getLearningWorkspace` require auth and enrollment. Its UI calls `submitCardReview`, `submitQuestionAnswer`, and `updateStageProgress`; reusing that mutation behavior for preview would violate the product contract. |
| Q7 | Q7 topic/child SELECT and D1 read RPCs use authenticated internal topic access. Private question-group media buckets use authenticated Storage SELECT and `/api/question-group-media/[groupId]/[type]` uses the user's RLS context. Q7 learner writes require actual enrollment. Do not broaden those policies or the Q7 media route for public preview. |
| Public status | The current public contract uses `courses.status = published` and `removed_at IS NULL`; no separate public visibility field was found. Active chapter means `chapters.removed_at IS NULL`. Verify this remains true at implementation time. |

The source of truth for current delivery evidence is `progress.md`; the master plan owns product decisions. A plan here must not update the old D1 or Q7 historical plans merely to align wording.

## 3. Target contract

### 3.1 Eligibility and state matrix

`active_topic_count` is the number of course topics with `removed_at IS NULL`, including draft and pending topics and topics under a removed chapter unless the established topic lifecycle actually soft-deletes those topics. `marked_active_count` counts active topics with the persisted preview marker. Every successful topic/marker mutation must leave `marked_active_count <= ceil(active_topic_count / 5)`; zero active topics allow zero active markers. A removed topic's retained marker does not grant access and must be accounted for on restore.

| Course | Chapter | Topic | Marker | Public detail | Public preview content/answer/media |
| --- | --- | --- | --- | --- | --- |
| Active published | Active | Active published | On | Preview link | Allowed |
| Active published | Active | Active published | Off | Locked syllabus row | Denied |
| Active published | Active | Active draft or pending | Either | No topic in published syllabus | Denied |
| Draft/pending or removed | Any | Any | Either | No public course | Denied |
| Active published | Removed | Any | Either | No topic in syllabus | Denied |
| Active published | Active | Removed | Either | No topic in syllabus | Denied |

The same gates apply to anonymous and authenticated but unenrolled callers. An enrolled user continues to use the existing learning route; preview eligibility does not change enrollment, progress, or collaborator rights. Recheck eligibility at every public RPC and media request, so changing publication or marker closes future reads without relying on a cached page. Previously downloaded or cached media cannot be recalled.

### 3.2 Marker, authority, and quota mutation

Add a non-null `topics.is_preview` boolean with `false` default and backfill-safe migration. Only an active owner or co-owner of the target course may turn markers on/off; editor, previewer, contributor, ordinary student, and unassociated admin do not gain this right. A topic may hold a marker while draft or pending, but the public gate remains closed. Show current marked/active counts and cap in the teacher topic settings or course Structure surface, with a clear publish-dependent explanation.

Use one short transactional RPC for setting markers. It must acquire the existing course-level lifecycle lock before counting/mutating, validate all selected topic IDs belong to that course, and reject over-cap changes atomically. Keep the marker out of authenticated table UPDATE grants; enforce the quota at the database boundary for direct `removed_at` updates and existing D1 mutation paths as well as the marker RPC. Application checks alone are insufficient. Inspect the final grants and policies and preserve the existing course → topic lock order before selecting the guard implementation. Do not add a duplicate semantic owner for D1 delete authority.

When deleting an unmarked topic would reduce the denominator enough to exceed the cap, the same confirmation flow must display the resulting cap and selectable currently marked topics. The owner/co-owner submits exactly the markers to unmark together with the delete; the server validates authority and the proposed final count, unmarks and deletes within one transaction, and rolls back all changes on error. A plain D1 delete can still succeed when the cap remains valid; it must fail closed if it would violate the cap. Preserve D1's pending cancellation and published confirmation semantics. The Builder and Structure delete entry points must reach the same outcome. Restore and any other mutation that can increase the marked-active numerator must also fail closed or offer an inline owner/co-owner resolution path if it can breach the cap; no silent marker removal. Revalidate affected teacher/public paths after a successful transaction.

The marker control follows owner/co-owner course authority even when D1 marks that actor's topic content editor as read-only. Conversely, a D1 original creator or responsible author who can delete a topic but cannot manage markers may delete only when the resulting quota remains valid; if it would exceed the cap, surface the required owner/co-owner resolution without granting marker authority.

### 3.3 Public read and answer boundary

Extend the public course-detail read model with the persisted `is_preview` value for published active syllabus topics, remove the temporary first-topic flag, and render a link only for eligible rows. Use a dedicated public preview route under the existing `/courses/[course-slug]` namespace; keep `/learn` as the enrolled route. Invalid slugs, mismatched course/topic, removed or unpublished rows, and unmarked topics return a uniform unavailable response without leaking content.

Provide a narrow public read RPC or equivalent server boundary that checks course, chapter, topic, marker, and active states before returning the ordered active flashcards, exercises, groups, questions, and option labels/content needed by the preview UI. Do not return `question_options.is_correct`, previous answers, progress, enrollment records, authoring/review metadata, or unrelated topics. Validate the entire output with a strict D2 DTO. The public preview UI should permit local card browsing and exercise selection, show that progress is not saved, and avoid calls to the enrolled learning Actions.

The preview page and its content/answer responses must not serve stale eligible data after publication or marker revocation; use request-time authorization and appropriate no-store behavior rather than relying on a previously rendered public page.

Provide a stateless answer-evaluation RPC/Action that checks the same eligibility gates and that the option belongs to the specified active question/exercise/topic. Return only immediate correctness and the existing explanation when appropriate; write no `user_question_answers`, `user_topic_progress`, `user_flashcards`, review history, or analytics state. Validate input/response at the Server Action boundary. A stale or revoked preview must fail closed before evaluation. Brute-force answer probing is inherent in a public practice interaction; do not expose the answer key in the initial read payload.

### 3.4 Private media

Keep both Q7 Storage buckets private and their authenticated policies intact. The preview read DTO may contain external media URLs unchanged, with the existing external-host confidentiality limitation. For a managed question-group reference, emit a dedicated public preview media URL keyed by persisted group identity and type; do not accept arbitrary bucket/path from the browser. The GET route must obtain a persisted group reference through a guarded public RPC that rechecks preview eligibility and media parent chain, parse canonical/known legacy references, verify the stored path belongs to that course/topic, then use a server-only privileged Storage client to download only that validated object. The service-role credential must never reach the client; no broad anonymous Storage SELECT or public bucket. Preserve content type, Range behavior for audio, `nosniff`, and `no-store` caching. Inspect flashcard media delivery separately: if a managed private reference exists or becomes possible, cover it under the same explicit eligibility model rather than emitting an unusable private URL.

## 4. Implementation checkpoints and expected affected areas

1. **Schema and authority:** a focused `supabase/migrations/*_d2_*.sql` adds the marker, atomic marker/quota mutation, public read/answer boundary, and quota guard. Update `types/database.ts` and relevant Zod input/output schemas. Inspect migration/seed compatibility and final grants, `search_path`, RLS `USING`/`WITH CHECK`, and lock order. Do not modify Q7 access helper or broad child SELECT policies to enable public access.
2. **Teacher flow:** `app/actions/topic.ts` and topic/structure settings, delete dialogs, and any restore surface that can breach the cap. Display count/cap, status explanation, stale-state errors, and inline unmark selection. Preserve D1 capability and confirmation logic.
3. **Public read and UI:** `app/actions/public-course.ts`, `lib/schemas/public-course.ts`, `PublicCourseSyllabus.tsx`, a preview Action/DTO and route under `app/(client)/courses/[course-slug]/`, and bounded preview components. Reuse presentational learning pieces only where they do not call persistent Actions.
4. **Media:** a dedicated public preview Route Handler plus shared parsing/streaming logic only if it reduces duplication without weakening the Q7 authenticated route. Keep Q7's own route and policies functioning.
5. **Evidence and docs:** add focused migration/RPC/RLS/Action/Route/UI tests and fixture states, run local integration and browser/E2E checks, then update current progress/problem status using observed results. Preserve historical D1/Q7 artifacts.

The listed files are expected ownership surfaces, not a license to edit all of them. Confirm each actual dependency immediately before its edit.

## 5. Acceptance and verification

- Migration applies on a clean local reset and existing seed; old rows default to unmarked. DB test matrix covers cap boundaries at 0, 1, 5, 6, and a denominator reduction; draft marker, delete, restore, retries, concurrent marker/delete attempts, stale selections, and rollback. Denied actors and direct Data API bypass attempts cannot set a marker or leave an over-cap course.
- Anonymous and authenticated unenrolled callers can read exactly eligible topic content and media and get correctness for a valid option. They cannot read unmarked/draft/pending/removed/cross-course data, answer keys, or unrelated media. Revoking marker or publication immediately closes fresh reads, answer checks, and media requests.
- Preview interaction creates zero rows/updates in persistent learner tables. Q7 previewer-only internal read and enrolled learner write tests remain green; D1 published/pending/delete/restore and teacher authoring tests remain green.
- Public course detail renders real preview links and locked rows accurately, including no-preview and all-draft cases. Teacher owner/co-owner can manage markers and resolve over-cap inline from both delete surfaces; non-managers see no active control. Mobile and keyboard interaction, loading/error states, and audio Range/media rendering are checked.
- Run focused unit/component/Action/Route tests, real local Supabase integration after a local reset, TypeScript, targeted lint, and affected existing suites. Run browser smoke/E2E with named anonymous, unenrolled, owner/co-owner and denied-role fixtures against the local app/database. Record exact counts, failures, skipped checks, fixture cleanup, and observed persistent-state delta. A passing test suite alone does not replace the browser gate.

Browser fixtures must have a published course with six active topics (at least one draft), two marked published topics, one unmarked published topic, and one marked draft topic in a separate quota-valid course. Include private image/audio group objects and an external URL, an unenrolled authenticated learner, an owner/co-owner, and a D1 author without marker authority. Exercise the public link, content, answer, and media paths; remove a marker or demote publication and retry the same URL; attempt an over-cap delete with and without the inline selection. Record starting rows, actor, action, visible result, and final learner-table counts. Keep fixture setup isolated from production and clean residue after QA.

## 6. Risks, stop conditions, and handoff

Stop for an owner decision if a current source establishes a separate course visibility/publication field, if removing a topic must retain an active preview allocation contrary to the matrix above, or if an existing D1 lifecycle operation cannot be composed with quota enforcement without changing its approved authority/confirmation semantics. Do not guess past a production migration conflict, privilege escalation, broad public content exposure, private media leak, quota race, or persistent preview learning write. Correct such findings before review passes.

Before implementation review, provide the migration/RPC privilege and return-shape audit, full state-matrix evidence, local integration and browser results, exact branch diff from `65e8481`, and a current progress update. Review the schema → Action/RPC → route/UI → Storage → state path as one integration outcome. Keep the Q7 reconciliation and this plan as separate commits before implementation changes. No push, PR, merge, hosted database mutation, or production deployment is authorized by this plan.
