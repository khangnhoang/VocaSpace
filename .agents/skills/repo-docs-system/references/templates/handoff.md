<!-- Template: handoff. Only with the Owner's explicit handoff/memory-write request, copy to the permitted handoff destination as one file per task, fill every <placeholder>, delete this comment, and link it from MEMORY.md. A handoff carries exactly one task (AGENTS.md and the Owner's explicit handoff grant) and holds only the facts no doc reflects yet, plus the next task's approved scope; link to the owning docs instead of copying them. -->

---
name: <task-id>-handoff
description: "Handoff for <program> <task>: <state in a few words>"
metadata:
  type: project
---

Written <YYYY-MM-DD> at the Owner's request. Task: <program> <task>. Delete this file (and its `MEMORY.md` line) when <the task's PR n is merged and the owning docs record every durable fact below | the catch-up item has moved to a new task's handoff>.

**Session facts (expire with the task)**
- Hosted state: <what was applied or checked on hosted, or "none">.
- Git: <branch, `HEAD`, pushed or not, PR number, merged and leftover branches>.
- Running processes: <local stack, dev server, background jobs, or "none">.
- Idle sessions: <session names and ids, or "none">.
- Grants used and pending: <each grant (commit, push, PR, merge, migration apply, CI fixing) as used, open or not asked>.
- Lagging records: <state record and the fact it must hold, or "none">.

**Approved scope**
- <item one: what to do, with a link to the owning doc instead of a copy>.
- <item two>.
- Docs catch-up from PR <n> (only when the previous task's docs lagged at its merge): <doc and the fact it must record>, one line per doc item.

**Later unit owns**
- <what a later unit or program owns, with a link>.

**After this task**
- <what comes next, or "nothing planned">.

**Prompt for the new session**
- <one line the Owner pastes into the new session>.
