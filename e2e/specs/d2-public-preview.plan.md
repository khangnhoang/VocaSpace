# D2 public Preview browser scenario

Seed: the isolated local Supabase E2E runtime plus `test.beforeAll` in `e2e/d2/public-course-preview.spec.ts` creates a published course with 21 active topics, five marked topics, private question-group media, one exercise, and an enrolled seeded learner.

## Scenario: guest and enrolled Preview recovers after denominator growth

1. Open the public course detail as a guest at 320px; verify one marked topic is linked and the page has no horizontal overflow.
2. Use the Preview card queue and quiz with keyboard input; verify the private group image loads, correctness is immediate, the session is not saved, and an unenrolled guest sees no learning CTA.
3. Sign in as the seeded enrolled learner, finish Preview, and verify `Tiếp tục học` appears only at the end while card, answer, and topic-progress rows remain unchanged.
4. As the course owner, open a published marked topic's hide dialog, verify its title receives focus, cancel with Escape, and confirm the marker and topic remain active.
5. Create a real platform-moderation takedown for one unmarked topic, yielding `A=20, M=5, cap=4`; verify the teacher sees the exact cause while public detail and a fresh Preview request show only generic unavailability.
6. Create one unmarked draft topic through the teacher Structure UI; verify `A=21, M=5, cap=5`, the causal pointer and teacher warning disappear, and public Preview, answer, and private media work again without a reactivation action.
7. Check no horizontal overflow at 320, 375, tablet, and desktop widths on the touched public and teacher surfaces.
