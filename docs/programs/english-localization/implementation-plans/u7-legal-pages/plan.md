# U7 detail plan — English legal pages

Revision: r1, 2026-11-25. Owner approval: 2026-11-25, including the English wording in Appendix A and B. Master plan: [plan.md](../../plan.md), section 4 row U7, section 5 step 2, decision 4.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: with the English flag on and English chosen, `/privacy` and `/terms` show the Owner-approved English text (Appendix A and B), which states that the Vietnamese text prevails. In Vietnamese, and whenever the flag is off, both pages stay exactly as they are today.

| ID | Observable result |
| --- | --- |
| AC1 | In Vietnamese (the default, and always with the flag off), both pages render text-identical to base `fffaaded`: heading, every section, the "Cập nhật lần cuối" line, links and the browser tab title. The existing `legal-pages` and `privacy-cookie-language` assertions keep their Vietnamese values. |
| AC2 | With the flag on and an `en` cookie, `/privacy` and `/terms` render the Appendix A and B text: English heading, the prevailing-language notice, every numbered section in the same order as the Vietnamese page, an English last-updated line with the same date, the `mailto:support@vocaspace.com` link and the cross link to the other page; tab titles are "Privacy Policy \| VocaSpace" and "Terms of Use \| VocaSpace", and `<html lang="en">`. No Vietnamese text remains on either English page. |
| AC3 | The disclosures the Vietnamese tests protect have English tests too: the DiceBear account-id-only line, the 16+ audience, the per-minute learning times and who sees them, the paid course title kept after hiding, the aggregate figures collaborators see, the display-language cookie, and in `/terms` the 16+ rule and the payment and removed-course sections. |
| AC4 | With the flag off, an `en` cookie still gets the Vietnamese pages, and the `next build` route table equals that of base `fffaaded`. |
| AC5 | Before merge the Owner has approved the English wording; the shipped English text equals the approved Appendix A and B. |

### 1.2 Scope and non-goals

- In scope: `app/(client)/privacy/page.tsx`, `app/(client)/terms/page.tsx`, `app/(client)/_components/LegalDocument.tsx`, new per-locale page bodies next to them, a `legal` message namespace, and tests.
- Non-goals: any Vietnamese wording change (master plan invariant; ENLOC-002 is closed); the homepage footer labels ("Privacy policy", "Terms of use", owned by U1); the auth consent line (U2); the last-updated date; any data, cookie or third-party change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. The Vietnamese text and markup move without a byte change; a whitespace-insensitive diff of the Vietnamese body against base shows no wording change. | An approved legal text changes without Owner approval (A4b G1). |
| G2. The English text is Appendix A and B exactly; a wording change after approval goes back to the Owner. | Unapproved legal wording ships (decision 4). |
| G3. `LEGAL_LAST_UPDATED` stays `22/11/2026`; the English line shows the same date. | The date claims a policy change that did not happen, or the two languages show different dates. |
| G4. The English pages carry the notice that the Vietnamese text prevails. | A translation error becomes binding (U7 row). |
| G5. The code comment on each page says that a privacy or terms change updates both language versions in the same PR. | A later data change updates only the Vietnamese page and the English policy becomes false (AGENTS.md user-data rule). |

### 1.4 Owner decisions that bind this unit

- Decision 4 (2026-11-21): an agent drafts the English pages; the Owner approves the wording before merge; the Vietnamese text stays authoritative.
- 2026-11-25: U7 goes before U5.

## 2. Repository facts

Baseline: `fffaaded`, checked 2026-11-25.

- `privacy/page.tsx` (183 lines) and `terms/page.tsx` (106 lines) are server components that export a constant `metadata` and hold the approved Vietnamese text inline as JSX with `<strong>`, `<Link>` and `mailto` links; the comment at lines 9–10 binds wording changes to the Owner — justifies G1 and G5.
- `LegalDocument.tsx` renders the title and the line `Cập nhật lần cuối: ${LEGAL_LAST_UPDATED}` with `LEGAL_LAST_UPDATED = "22/11/2026"` — justifies G3.
- `__tests__/components/legal-pages.test.tsx` renders both pages through `@/__tests__/support/intl` (which accepts `locale: "en"`) and reads `metadata.title` directly; `privacy-cookie-language.test.tsx` renders `PrivacyPage` with plain RTL — justifies AC1 and AC3.
- English UI names already in the catalogs: "Terms of Use" and "Privacy Policy" (`messages/en/auth.json` legal consent), "Forgot password?" (`auth.json`), "Profile" (`common.json`) — the Appendix uses these names.

## 3. Bounded implementation hypotheses

- H1: Each page keeps its body as JSX in two components, a Vietnamese one moved verbatim from today's page and an English one from the Appendix, and picks one by the request locale. Long legal prose with inline links and bold labels stays readable this way, and G1 is a pure move. A `legal` namespace holds only the short strings (titles, tab titles, the last-updated label, the notice). May change to catalog keys if G1 still holds.
- H2: The pages stay synchronous server components and read the locale with next-intl's `useLocale`, so the existing tests keep rendering them through the intl test wrapper; the tab title moves to `generateMetadata`, and the two metadata tests switch from reading the constant to awaiting `generateMetadata()` with the same Vietnamese values, and `privacy-cookie-language.test.tsx` switches its `render` import to the intl test wrapper (setup changes, as U3 G6 allowed).
- H3: The English date reads "22 November 2026", formatted from the same constant.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Both pages in both languages with tests for AC1 to AC3 | English component tests for AC2 and AC3; the existing legal tests unchanged except the H2 metadata setup; G1 diff of the Vietnamese bodies against base; `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`. |
| Final | Whole-diff self-review and browser check | Local production build with the English flag on: `/privacy` and `/terms` in Vietnamese and English, tab title and `lang` (AC1, AC2); flag-off build with an `en` cookie shows Vietnamese and the route table equals base (AC4); final regression as `test-quality-strategy` Verification stages require. Owner reads the rendered English pages during QA (AC5). |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The translation changes a legal meaning. | Owner approval of the Appendix (G2) and the prevailing-language notice (G4). |
| Reading the locale makes the pages dynamic with the flag off. | AC4 route table check; the flag-off locale resolution reads no request data (U1, H4). |

- Rollout runbook: none; production stays Vietnamese while the English flag is off.
- Stop when: G1 cannot hold; the Owner asks for a wording change after approval (re-approval); the flag-off route table changes.
- Rollback: revert the commit; no data or configuration change.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A — Privacy Policy (English draft for Owner approval)

Title: Privacy Policy. Last-updated line: "Last updated: 22 November 2026".

Notice (below the date): This English version is a translation provided for convenience. If it differs from the Vietnamese version, the Vietnamese version prevails.

VocaSpace is a project run by the VocaSpace development team. This policy explains what data we collect when you use VocaSpace, what we use it for and what rights you have.

**1. Data we collect**

- **Account information:** your email and password. Passwords are stored hashed (one-way encrypted), never in readable form.
- **Profile information you provide:** username, full name, phone number, date of birth, gender and profile picture.
- **When you sign in with Google:** the email, full name and profile picture of your Google account. We do not receive your Google password and do not access any other data in your Google account.
- **Learning data:** the courses you join, your learning progress, which learning content is unlocked for you, your answers and your review results. Each time you answer a question or rate a review card, we record the time (to the minute, with the related course and lesson) to show your learning streak, your recent lessons and your estimated study time.
- **Teacher content:** courses, lessons, questions, images and files that teachers upload.
- **Payment information:** order code, course, amount, discount code used and payment status. You can still see the title of a course you paid for in your payment history, even if that course is later hidden. We do not store your card number or bank account details.

**2. How we use data**

- Create and maintain your account and let you sign in.
- Send account verification and password recovery emails.
- Unlock courses, save your progress and show your learning results.
- Process course payments.
- Help you when you contact us, keep the system secure and handle violations.

**Who can see your information:** your username, full name and profile picture may be shown to other users and visitors (for example a teacher's name on a course page). Profile pictures are stored publicly, so anyone with the image link can view them. Your email, phone number, date of birth and gender are visible only to you and VocaSpace administrators; your email may also be shown to collaborators who can view a course's member list, author or reviewer information or notes, including preview-only collaborators and collaborators with a student account.

Data about when you study is visible only to you in VocaSpace; teachers, other students and administrators cannot see it.

Teachers and collaborators who author a course can see aggregate figures for that course: the number of students enrolled per month and the number of students who have not started, are in progress or have completed it. These figures do not include your name or account information, but for a course with very few students they may reflect one particular person's progress.

When a VocaSpace administrator approves a course, returns it to draft or removes it, they can see the course's author name and content.

We do not sell your data, do not use it for advertising and do not track your activity on other websites.

**3. Cookies**

VocaSpace uses cookies to keep you signed in and to remember interface state (for example the display language, or whether the sidebar is open or closed). We do not use advertising cookies or behavioral analytics tools.

**4. Third-party services**

To operate, VocaSpace uses the following services. Each service receives only the data it needs for its task and may store data on servers outside Vietnam:

- **Supabase:** stores the database, accounts and uploaded files.
- **Vercel:** hosts and runs the website.
- **Resend:** sends verification and password recovery emails.
- **Google:** Google sign-in, if you choose it.
- **PayOS:** processes course payments.
- **QR Server (api.qrserver.com):** receives the QR code content of an order to create the payment QR code image.
- **Cloudflare:** forwards emails you send to support@vocaspace.com.
- **DiceBear:** creates default profile pictures in the admin area and receives only the account identifier (not the email).

Some images on the website are loaded directly from external image hosting services (for example GitHub, Unsplash, or an image address a teacher uses for a course). When that happens, your browser sends these services ordinary technical information such as your IP address.

**5. Data retention and deletion**

We keep your data while your account is active. You can ask us to delete your account by emailing support@vocaspace.com from your account's email address; we will delete it within 30 days. Order information may be kept longer only when needed to resolve a payment issue.

**6. Your rights**

- View and edit your profile information on the Profile page.
- Request a copy of your data or the deletion of your account by email.
- Stop signing in with Google at any time; you can still set a password through "Forgot password".

**7. Security**

Connections to VocaSpace are encrypted with HTTPS, and each user can access only the data they are allowed to see. No system is perfectly secure; if you find a security issue, please tell us at the email address below.

**8. Users under 16**

VocaSpace is for people aged 16 and over. We do not knowingly collect data from people under 16. If you know that someone under 16 has created an account, please contact us so we can delete that data.

**9. Changes to this policy**

When this policy changes, we update this page and the "Last updated" date at the top. For important changes, we will post a notice on the website.

**10. Contact**

For any privacy questions, please email support@vocaspace.com (link: `mailto:support@vocaspace.com`).

See also: Terms of Use (link: `/terms`).

## Appendix B — Terms of Use (English draft for Owner approval)

Title: Terms of Use. Last-updated line and notice: as in Appendix A.

VocaSpace is a project run by the VocaSpace development team: an online vocabulary learning platform where teachers create courses and students learn through them. By creating an account, signing in or using VocaSpace, you agree to the terms below and to the Privacy Policy (link: `/privacy`).

**1. Age**

You must be at least 16 years old to use VocaSpace.

**2. Account**

- You provide accurate information and keep your password secret.
- You are responsible for the activity in your account.
- If you sign in with Google using an email that matches an existing VocaSpace account, you sign in to that same account.
- If you suspect that someone else is using your account, change your password and let us know.

**3. Rules of use**

You must not:

- use VocaSpace for unlawful purposes;
- upload content that infringes copyright or is offensive, fraudulent or harmful;
- gain unauthorized access to VocaSpace accounts, data or systems;
- disrupt or overload the system;
- share or resell access to paid courses.

**4. Teacher content**

Teachers keep ownership of the content they create and are responsible for making sure they have the right to use everything they upload, including the copyright of images, audio and documents. By posting content on VocaSpace, teachers allow VocaSpace to store it and show it to learners in order to run the service. VocaSpace may remove content that violates these terms or the law.

**5. Courses and payment**

- Paid courses are paid for through PayOS. When the payment succeeds, the course is unlocked in your account.
- Successful payments are not refunded, except in case of a system error (for example you were charged but the course was not unlocked); in that case VocaSpace will unlock the course or refund you.

**6. Removed courses**

A course may be removed when its teacher stops offering it or when it violates our policies; you may then no longer be able to access it. If you paid for a removed course, contact support@vocaspace.com and VocaSpace will help as appropriate, for example by giving you a discount code for another course.

**7. Suspension and termination**

VocaSpace may suspend or delete accounts that violate these terms. You can stop using VocaSpace and ask for your account to be deleted at any time, as described in the Privacy Policy (link: `/privacy`).

**8. Limitation of liability**

VocaSpace is provided "as is". We try to keep the service running reliably but do not guarantee that it will always be available or free of errors. To the extent permitted by law, VocaSpace is not liable for indirect damages arising from the use of the service.

**9. Changes to these terms**

When these terms change, we update this page and the "Last updated" date at the top. For important changes, we will post a notice on the website. If you continue to use VocaSpace after a change, you accept the new terms.

**10. Contact**

For any questions about these terms, please email support@vocaspace.com (link: `mailto:support@vocaspace.com`).
