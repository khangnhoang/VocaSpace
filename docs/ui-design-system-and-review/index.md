# UI Design Sources

This index routes only to Owner-accepted design artifacts. Plans, progress records, review aids, future directions, and candidates remain outside the accepted-source route.

## Accepted product language

Current correction: `BUTTON-RADIUS-CORRECTION-1`, Owner-accepted on 2026-09-30, specializes Button at `8px` without changing Input/card/other control radii. The corrected Product Language Git-blob SHA-256 is `6EEA4E684FAF0F4583DDAE7B651FE972E897A6078F4B3A38D20500D0049D3BCC`. The candidate hashes below identify historical acceptance snapshots, not the corrected file bytes.

- [VocaSpace Product Language](./product-language.md) — `Accepted` on 2026-09-27 from exact candidate `PL-CANDIDATE-1`, pre-publication SHA-256 `CF68E4972CDFAC4B805ADEB0117C0CF895B07C5561D0E2D36676F8A356B439C1`, with Owner-accepted bounded earned-completion amendment `PL-MOTION-CORRECTION-1`, pre-publication SHA-256 `05F259BC199D4CAC880E29F6243BB7F49BDE48B33BC504F769396A260B3C2439`, published on 2026-09-27. It owns the shared product identity and semantic intent for in-scope Learning Experience and Teacher Authoring design work; it does not authorize runtime implementation.

## Accepted screen-type designs

- [Learning Experience](./screen-types/learning-experience.md) — `Accepted` on 2026-09-27 from exact `LE-CANDIDATE-1`, pre-publication SHA-256 `34C633DFBFA054ABADD7C9973CFB3F2EF50AA79C97B824A4294C08C0097BC508`. It specializes the accepted Product Language for learner hierarchy, feedback, progress, recall, completion, responsive behavior, and accessibility; it does not authorize runtime implementation or route-specific composition.
- [Teacher Authoring](./screen-types/teacher-authoring.md) — `Accepted` on 2026-09-28 from exact `TA-CANDIDATE-1`, pre-publication SHA-256 `78D30BCE07ADA7BAB941C1B730AEBB3A5AB4571E684F23DA5E2160514ED77C94`. It specializes the accepted Product Language for Teacher portfolio, insight/action hierarchy, scalable Structure, focused topic authoring, recovery, responsive behavior, and accessibility; it does not authorize runtime implementation, analytics data work, shared-component construction, or route-specific composition.

## Accepted shared-component contracts

- [Button](./components/button.md) — `Accepted` on 2026-09-29 from exact `BUTTON-CONTRACT-CANDIDATE-1`, pre-publication SHA-256 `B30406CCA97AC4B5537D71986F0889B0A0E0FFF8ED0C4FD9E913B96D6CDC8D3F`, through Owner gate `BUTTON-ACCEPT`. It owns reusable Button semantics, geometry, shared interaction treatment, icon/accessibility behavior, motion, and composition boundaries. It does not authorize production runtime implementation, route-specific composition, UI-4, or UI-5.

Current Button revision includes Owner-accepted `BUTTON-RADIUS-CORRECTION-1` on 2026-09-30: all labeled/icon-only sizes and fine-pointer hover surfaces use `8px`; other geometry and semantics are unchanged. Corrected Button Git-blob SHA-256: `E4F0F97A7976A31C278167E3249967DC0397A478DA11F705056F96A99E18281F`. The original `B30406…` hash remains historical candidate evidence only. Current hashes identify exact UTF-8 Git-blob bytes with LF line endings; hash the bytes returned by `git show <revision>:<path>` for verification. Windows working copies may use CRLF and therefore have different raw file hashes without a semantic change. Any later source-content change requires recomputation.

## Accepted surface specifications

- [Teacher Course Structure](./surfaces/teacher/course-structure.md) — `Accepted` on 2026-10-01 from exact `STRUCTURE-SURFACE-CANDIDATE-2`, pre-publication SHA-256 `8A4A48AAC34E5E44988BDD47C690D9610A2EE6237B875EFF2395EF686FC7F5FF` (UTF-8, LF), after the Owner reviewed the running result; it amends `STRUCTURE-SURFACE-CANDIDATE-1` (accepted 2026-09-30, SHA-256 `F35177E6226D0486B6C1E7D5E015BA26E6A9E986E7E1FF997C506D5CC60A2425`) with topic drag-and-drop and pending-topic reordering. A 2026-10-01 Owner amendment from the UI-5 Structure pilot correction review (touch action roles, phone-width `Thêm bài học`, a shared title dialog, phone topic rename by dialog) was live-reviewed on the running PR #113 result and frozen by the Owner on 2026-10-01, pre-publication SHA-256 `231F93A7970BABA3E05CEC7545CE886F33BA91F7616B346821449BA77DF3ACC9` (UTF-8, LF). A 2026-10-01 §6.1 amendment (Topic Builder back link restores the topic's chapter) is Owner-accepted, pre-publication SHA-256 `5BA1311A83CE915ED7661E713A2C9DCCC9B45DC74013BB333D5D7ED0F0C2BC7C` (UTF-8, LF). It owns the route-specific composition of `/teacher/courses/[id]/structure` (reading path, navigator and workbench, action roles, states, scale, focus, and motion) on top of Product Language, Teacher Authoring, and Button; it does not change their values or authorize other Teacher surfaces.
