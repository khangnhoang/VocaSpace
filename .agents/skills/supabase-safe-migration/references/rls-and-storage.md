# RLS and Storage

Read this reference only when its resource-routing condition in `SKILL.md` matches. The core remains authoritative for permission, safety, inspection, stop conditions, and reporting.

## RLS and permission rules

Before changing RLS:

* inspect existing policies and helper functions
* reuse a helper when it expresses the same boundary
* for each affected operation, inspect the applicable `USING` and `WITH CHECK` predicates and state what row access or mutation each predicate permits
* test both allowed and denied actors
* consider draft, private, removed, ownership, collaborator, and admin cases
* avoid broad policies that expose more rows than intended

Current helper patterns may include:

```txt
has_course_content_read_access(course_id)
has_course_management_access(course_id)
is_course_owner_or_co_owner(course_id)
is_admin()
get_my_role()
can_modify_content_by_topic(topic_id)
can_modify_exercise_child(exercise_id)
can_modify_question_option(question_id)
```

Use actual repository definitions; do not assume names or behavior without inspection.

Common ownership predicates include:

```sql
auth.uid() = user_id
auth.uid() = id
```

## Storage policies

Before changing Storage:

* inspect bucket-specific policies
* preserve owner/admin checks
* keep public access only when product requirements need public URLs
* do not trust client-provided bucket names or paths
* prefer server-generated paths for permission-sensitive uploads
* inspect related upload validation and handlers

## Verification details

### RLS

* allowed role
* denied role
* allowed and denied paths for each affected read or mutation operation, including both `USING` and `WITH CHECK` behavior when applicable
* ownership/admin/collaborator cases
* draft/private/removed cases when relevant
