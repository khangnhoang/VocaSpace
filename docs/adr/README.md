# Architecture decision records

An ADR records a decision that outlives one program or spans programs: architecture, product rules, workflow or docs structure. A decision that only one program needs stays in that program's master plan. The template is `.agents/skills/repo-docs-system/references/templates/adr.md`. Every file in this folder must be linked from this index; `npm run docs:check` fails when one is missing.

| ADR | Date | Status | Summary |
| --- | --- | --- | --- |
| [docs-system.md](./docs-system.md) | 2026-10-05 | Accepted | Docs system: `progress.md` owns State, program home under `docs/programs/`, English docs, ADR scope. |
| [student-user-flow-route ADR](./refactor-student-user-flow-route-adr.md) | 2026-07-05 | Accepted | Student and user flow refactor in waves: teacher authoring hard-cut to `/teacher/courses`, public `/courses` catalog, learner `/learn` dashboard, URL topic slug as the workspace source of truth. |
| [refactor-exercise-authoring.md](./refactor-exercise-authoring.md) | 2026-06-11 | Accepted | Complex multi-table exercise authoring mutations move into transaction-safe PostgreSQL RPCs; Server Actions stay thin. |
| [question-group-media-upload.md](./question-group-media-upload.md) | 2026-06-11 | Accepted | Question group media: two public Storage buckets, existing `image_url` and `audio_url` columns kept, and file upload through a Route Handler instead of Server Actions. |
| [admin-course-review-ui.md](./admin-course-review-ui.md) | 2026-06-29 | Accepted (inherited record) | Admin course review screen: scannable list, explicit approve and reject with a required reason, honest feedback, server-owned fields not editable. |
