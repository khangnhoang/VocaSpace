# Migrating an existing live program

Read this only when migrating a live program's docs to the current shape. The parent `SKILL.md` stays authoritative for roles, State ownership, lifecycle and stop conditions. Use the templates beside this file for the new shape; do not copy structure from the old files.

## Procedure

1. Record the baseline: the commit that holds the old files, and the paths you will change. Confirm nothing else (a parallel branch or session) is editing them; stop if it is.
2. List what must survive. From the old files, extract every Owner decision, invariant, gate, hard rule, rollout step, and open problem, with its number or ID. This list is the meaning checklist.
3. Find citations that constrain paths: search `supabase/migrations/*.sql`, `AGENTS.md`, skills, `.claude/`, `.codex/` and other docs for each path you might move. Keep every path cited by a published migration resolvable. Never edit a published migration. Prefer moving nothing.
4. Write the new version from the old one, one file at a time, in the template shape:
   - master plan: keep decisions numbered and dated, invariants, units, gates and rollout order; remove State and history;
   - progress: one in-place State block carrying the current truth (read Git and the old State for it), then one-line milestones;
   - problems: keep every open entry with its ID and fields; resolved entries become one line;
   - detail plan: a frozen reviewed plan keeps its content and path. Replace only its State section with the one-line progress pointer and add the legacy banner from `SKILL.md`.
5. Preserve meaning (guardrail): every item on the checklist appears in the new files with the same meaning. Reword only for shape. Do not re-decide, merge, or drop an Owner decision, gate, or rollout step.
6. Do not keep `_old` copies. Old versions stay in Git; compare with `git show <baseline>:<path>`.
7. Run the repository link check (`npm run docs:check-links`) and confirm no new broken link and that every migration-cited path still resolves.
8. Meaning check: read old and new side by side against the checklist from step 2 and confirm each item is present, unchanged in meaning, and in the right file.
9. Update `docs/README.md` only if a folder's purpose changed.

## Stop

Stop and report instead of continuing when an item cannot be expressed without changing its meaning, a cited path would break, or the baseline moved under files you are migrating.

## Rollback

Fix forward on the branch before merge. After merge, prefer a small correction change over a revert. A revert must leave State and milestones at their current truth and must not restore an old State block as if it were current; reconcile or mark it historical in the same change. If another unit has already started on the new shape, stop and reconcile with the Owner before reverting.
