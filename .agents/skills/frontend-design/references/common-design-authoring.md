# Common Design Authoring

Read only when the Owner requests creating or revising a screen philosophy, product language, or common screen-type design. Routine UI implementation and a surface-specific design that leaves common design unchanged do not use this procedure.

1. Inspect accepted design sources, nearby real screens, existing tokens and components, and relevant product, accessibility, and permission contracts. Identify the one artifact level that owns the proposed decision; do not copy values into another level.
2. Present a concrete candidate for that level. State the user goal, scope, inherited decisions, proposed changes and exceptions, and how the proposed visual or interaction choices map to existing or proposed semantic tokens and components. Show enough examples for the Owner to judge the material choice; do not invent exact values where the task has not reached that decision.
3. Separate repository facts, existing accepted decisions, and new proposals. Surface conflicts with accepted sources and name the decision needed to resolve them. A draft, rendered screen, or current CSS does not approve the candidate.
4. Request explicit Owner acceptance tied to the identifiable candidate before treating a material design change as a reusable standard. Design acceptance does not grant implementation, component installation, Git, or remote authority.
5. After acceptance and under the applicable action permission, update only the owning design artifact and its discoverable index when one exists or is now needed. Later UI tasks reuse that accepted source; an intentional change to it requires a new Owner decision.
