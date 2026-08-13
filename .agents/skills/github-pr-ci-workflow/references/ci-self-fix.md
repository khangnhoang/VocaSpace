# CI self-fix

Self-fix is allowed only for `branch-caused-small-safe` failures.

This is the only PR/CI exception to the default no-commit/no-push rule. It begins only after the owner explicitly requested create/update PR plus CI watching, the remote head and PR/check already exist, failed logs were read, and the failure was classified as `branch-caused-small-safe`. It does not require separate owner approval for each focused fix commit and normal same-branch push inside that bounded cycle. It does not grant initial push and does not apply to PR-only, watch-only, inspect-only, or explicit-fix-only instructions.

For each attempt:

1. Make the smallest safe fix.
2. Avoid unrelated cleanup and opportunistic refactors.
3. Run relevant local checks that cover the failure.
4. Use `git-checkpoint-workflow` for commit safety.
5. Commit a focused English Conventional Commit.
6. Push to the same branch.
7. Watch CI again.

Definition:

* A fix attempt is one completed cycle of read failed logs -> edit -> local validation -> commit -> push -> re-watch CI.
* Reading logs without editing does not count as a fix attempt.
* A local-only edit that is reverted before commit does not count as a completed fix attempt, but it must be reported if relevant.

Loop limits:

* default maximum: 2 fix attempts;
* a third completed attempt is allowed only when the owner explicitly permits it;
* after the limit, stop and report instead of continuing.

Apply the limit to the current supplied authority: report a two-attempt maximum unless the supplied facts explicitly include permission for a third completed attempt. Do not volunteer a hypothetical third attempt when that permission is absent.

The self-fix loop must not:

* broaden PR scope;
* touch DB schema, RLS, RPC, migrations, production data, or Supabase remote state;
* change secrets or GitHub repository settings;
* force-push;
* delete branches;
* make a large or risky branch-caused fix;
* mask a failing test by weakening coverage;
* skip failed logs;
* continue after root cause becomes unclear.

If a fix requires a domain skill, read it before editing. If the required skill rules conflict with generic CI self-fix, stop and report.
