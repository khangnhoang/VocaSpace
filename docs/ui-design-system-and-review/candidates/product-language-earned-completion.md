# Product Language earned-completion motion correction

| Field | Value |
| --- | --- |
| Status | `Accepted correction evidence` — exact candidate was accepted and published into the Product Language owner on 2026-09-27; this file is not a second accepted-source route |
| Candidate identity | `PL-MOTION-CORRECTION-1`; Owner-accepted through exact gate `PL-MOTION-CORRECTION-ACCEPT`, pre-publication SHA-256 `05F259BC199D4CAC880E29F6243BB7F49BDE48B33BC504F769396A260B3C2439` |
| Accepted baseline | [VocaSpace Product Language](../product-language.md), accepted `PL-CANDIDATE-1` |
| Scope | Only the duration and composition rule for the `Earned completion` motion role |
| Excludes | Immediate response, State transition, Spatial transition, ordinary progress updates, CTA behavior, component construction, LE layout, and runtime implementation |

## Conflict

The accepted `320ms` maximum correctly bounds one earned micro-cue, but it collapses a completion story that must communicate several distinct truthful transitions. For example, a chapter completion may need to show local progress reaching its final value, the current chapter becoming completed, and only then the next chapter becoming available as subordinate context. Compressing those states into one simultaneous cue weakens causality; simply extending the existing animation beyond `320ms` would exceed accepted authority.

## Accepted correction

Replace only the accepted `Earned completion` duration/usage rule with this two-level contract:

| Earned-completion form | Duration | Easing | Allowed use |
| --- | --- | --- | --- |
| Single earned micro-cue | `320ms` maximum | Existing earned easing `cubic-bezier(0.16, 1, 0.3, 1)` | One bounded confirmation, progress movement, node change, or accomplishment accent |
| Composed earned-completion sequence | Approximately `600–900ms` total | Each constituent uses an accepted easing appropriate to its semantic role | Two or more distinct, truthful completion transitions whose causal order would become unclear if collapsed into one micro-cue |

Rules:

- A composed sequence contains only short, purposeful constituent transitions. Within this exception, a constituent may run longer than the ordinary role ceiling when the extra time is necessary to make a truthful progression state perceptible; constituent transitions should normally remain approximately `220–450ms`, and the complete sequence still remains approximately `600–900ms`.
- This longer constituent timing is part of the composed earned-completion exception only. The ordinary Immediate response, State transition, Spatial transition, and single earned micro-cue roles retain their accepted ceilings unchanged.
- The sequence exists only when multiple semantic states truly change, such as local progress reaching complete → the active object becoming completed → the next context becoming available. It is not permission to lengthen a single cue.
- Result text, confirmed values, and the legal next action render immediately. They never wait for the visual sequence, and the sequence never blocks input, focus, navigation, or repeated practice.
- Causal order must remain truthful. A next chapter, step, or route cannot appear current before the completed object has actually settled to completed; a subordinate next hint may follow.
- Reduced motion skips the composed spatial/temporal sequence and exposes the same settled text, values, completed state, next context, focus destination, and actions immediately, or through the already accepted opacity alternative up to `100ms`.
- The exception does not apply to hover, selection, validation, ordinary answer feedback, reveal, routine save/pending state, navigation, loading, or ordinary progress updates. Those interactions keep their accepted motion roles and ceilings.
- The sequence remains one-shot and completion-triggered. It must not become a perpetual pulse, replay automatically, or add decorative steps merely to consume the available duration.

## LE review evidence

The non-authoritative LE aid demonstrated this accepted correction with an `880ms` composed sequence:

1. chapter-local progress reaches complete over approximately `420ms` using the earned easing;
2. the current chapter uses an approximately `300ms` state transition beginning at `360ms`; its first `60ms` retain the current state, so visible completion resolution starts only as progress reaches complete and settles by `660ms`;
3. a subordinate next-chapter hint appears over approximately `220ms`, beginning only after the completed chapter is legible and settling at approximately `880ms`.

The modest overlap keeps the total below `900ms` without reversing the semantic order: progress reaches completion → Chapter 3 resolves to completed → Chapter 4 becomes a subtle next hint. Completion copy, course progress truth, and both actions remain available from the first frame. This choreography is review evidence for the bounded correction, not a runtime component recipe.

## Acceptance and publication boundary

The Owner issued `PL-MOTION-CORRECTION-ACCEPT: PL-MOTION-CORRECTION-1 SHA-256 05F259BC199D4CAC880E29F6243BB7F49BDE48B33BC504F769396A260B3C2439` on 2026-09-27. Its motion delta is folded into `product-language.md`, which remains the only accepted Product Language source. This file preserves correction evidence and must not be treated as a second authority or indexed accepted artifact.
