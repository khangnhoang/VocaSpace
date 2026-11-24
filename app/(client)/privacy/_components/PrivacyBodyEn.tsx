import Link from "next/link";
import { LegalSection } from "../../_components/LegalDocument";

// Bản dịch tiếng Anh đã được Owner duyệt (U7 plan, Appendix A); đổi chữ phải qua Owner. Bản tiếng Việt có giá trị ưu tiên.
export function PrivacyBodyEn() {
  return (
    <>
      <p>
        VocaSpace is a project run by the VocaSpace development team. This policy explains what data we collect when you
        use VocaSpace, what we use it for and what rights you have.
      </p>

      <LegalSection title="1. Data we collect">
        <ul>
          <li>
            <strong>Account information:</strong> your email and password. Passwords are stored hashed (one-way
            encrypted), never in readable form.
          </li>
          <li>
            <strong>Profile information you provide:</strong> username, full name, phone number, date of birth, gender
            and profile picture.
          </li>
          <li>
            <strong>When you sign in with Google:</strong> the email, full name and profile picture of your Google
            account. We do not receive your Google password and do not access any other data in your Google account.
          </li>
          <li>
            <strong>Learning data:</strong> the courses you join, your learning progress, which learning content is
            unlocked for you, your answers and your review results. Each time you answer a question or rate a review
            card, we record the time (to the minute, with the related course and lesson) to show your learning streak,
            your recent lessons and your estimated study time.
          </li>
          <li>
            <strong>Teacher content:</strong> courses, lessons, questions, images and files that teachers upload.
          </li>
          <li>
            <strong>Payment information:</strong> order code, course, amount, discount code used and payment status.
            You can still see the title of a course you paid for in your payment history, even if that course is later
            hidden. We do not store your card number or bank account details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How we use data">
        <ul>
          <li>Create and maintain your account and let you sign in.</li>
          <li>Send account verification and password recovery emails.</li>
          <li>Unlock courses, save your progress and show your learning results.</li>
          <li>Process course payments.</li>
          <li>Help you when you contact us, keep the system secure and handle violations.</li>
        </ul>
        <p>
          <strong>Who can see your information:</strong> your username, full name and profile picture may be shown to
          other users and visitors (for example a teacher&apos;s name on a course page). Profile pictures are stored
          publicly, so anyone with the image link can view them. Your email, phone number, date of birth and gender are
          visible only to you and VocaSpace administrators; your email may also be shown to collaborators who can view
          a course&apos;s member list, author or reviewer information or notes, including preview-only collaborators
          and collaborators with a student account.
        </p>
        <p>
          Data about when you study is visible only to you in VocaSpace; teachers, other students and administrators
          cannot see it.
        </p>
        <p>
          Teachers and collaborators who author a course can see aggregate figures for that course: the number of
          students enrolled per month and the number of students who have not started, are in progress or have
          completed it. These figures do not include your name or account information, but for a course with very few
          students they may reflect one particular person&apos;s progress.
        </p>
        <p>
          When a VocaSpace administrator approves a course, returns it to draft or removes it, they can see the
          course&apos;s author name and content.
        </p>
        <p>
          We do not sell your data, do not use it for advertising and do not track your activity on other websites.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookies">
        <p>
          VocaSpace uses cookies to keep you signed in and to remember interface state (for example the display
          language, or whether the sidebar is open or closed). We do not use advertising cookies or behavioral
          analytics tools.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party services">
        <p>
          To operate, VocaSpace uses the following services. Each service receives only the data it needs for its task
          and may store data on servers outside Vietnam:
        </p>
        <ul>
          <li>
            <strong>Supabase:</strong> stores the database, accounts and uploaded files.
          </li>
          <li>
            <strong>Vercel:</strong> hosts and runs the website.
          </li>
          <li>
            <strong>Resend:</strong> sends verification and password recovery emails.
          </li>
          <li>
            <strong>Google:</strong> Google sign-in, if you choose it.
          </li>
          <li>
            <strong>PayOS:</strong> processes course payments.
          </li>
          <li>
            <strong>QR Server (api.qrserver.com):</strong> receives the QR code content of an order to create the
            payment QR code image.
          </li>
          <li>
            <strong>Cloudflare:</strong> forwards emails you send to support@vocaspace.com.
          </li>
          <li>
            <strong>DiceBear:</strong> creates default profile pictures in the admin area and receives only the account
            identifier (not the email).
          </li>
        </ul>
        <p>
          Some images on the website are loaded directly from external image hosting services (for example GitHub,
          Unsplash, or an image address a teacher uses for a course). When that happens, your browser sends these
          services ordinary technical information such as your IP address.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention and deletion">
        <p>
          We keep your data while your account is active. You can ask us to delete your account by emailing
          support@vocaspace.com from your account&apos;s email address; we will delete it within 30 days. Order
          information may be kept longer only when needed to resolve a payment issue.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights">
        <ul>
          <li>View and edit your profile information on the Profile page.</li>
          <li>Request a copy of your data or the deletion of your account by email.</li>
          <li>
            Stop signing in with Google at any time; you can still set a password through &quot;Forgot password&quot;.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          Connections to VocaSpace are encrypted with HTTPS, and each user can access only the data they are allowed to
          see. No system is perfectly secure; if you find a security issue, please tell us at the email address below.
        </p>
      </LegalSection>

      <LegalSection title="8. Users under 16">
        <p>
          VocaSpace is for people aged 16 and over. We do not knowingly collect data from people under 16. If you know
          that someone under 16 has created an account, please contact us so we can delete that data.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          When this policy changes, we update this page and the &quot;Last updated&quot; date at the top. For important
          changes, we will post a notice on the website.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          For any privacy questions, please email <a href="mailto:support@vocaspace.com">support@vocaspace.com</a>.
        </p>
        <p>
          See also: <Link href="/terms">Terms of Use</Link>.
        </p>
      </LegalSection>
    </>
  );
}
