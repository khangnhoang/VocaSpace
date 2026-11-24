import Link from "next/link";
import { LegalSection } from "../../_components/LegalDocument";

// Bản dịch tiếng Anh đã được Owner duyệt (U7 plan, Appendix B); đổi chữ phải qua Owner. Bản tiếng Việt có giá trị ưu tiên.
export function TermsBodyEn() {
  return (
    <>
      <p>
        VocaSpace is a project run by the VocaSpace development team: an online vocabulary learning platform where
        teachers create courses and students learn through them. By creating an account, signing in or using VocaSpace,
        you agree to the terms below and to the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <LegalSection title="1. Age">
        <p>You must be at least 16 years old to use VocaSpace.</p>
      </LegalSection>

      <LegalSection title="2. Account">
        <ul>
          <li>You provide accurate information and keep your password secret.</li>
          <li>You are responsible for the activity in your account.</li>
          <li>
            If you sign in with Google using an email that matches an existing VocaSpace account, you sign in to that
            same account.
          </li>
          <li>If you suspect that someone else is using your account, change your password and let us know.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Rules of use">
        <p>You must not:</p>
        <ul>
          <li>use VocaSpace for unlawful purposes;</li>
          <li>upload content that infringes copyright or is offensive, fraudulent or harmful;</li>
          <li>gain unauthorized access to VocaSpace accounts, data or systems;</li>
          <li>disrupt or overload the system;</li>
          <li>share or resell access to paid courses.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Teacher content">
        <p>
          Teachers keep ownership of the content they create and are responsible for making sure they have the right to
          use everything they upload, including the copyright of images, audio and documents. By posting content on
          VocaSpace, teachers allow VocaSpace to store it and show it to learners in order to run the service.
          VocaSpace may remove content that violates these terms or the law.
        </p>
      </LegalSection>

      <LegalSection title="5. Courses and payment">
        <ul>
          <li>
            Paid courses are paid for through PayOS. When the payment succeeds, the course is unlocked in your account.
          </li>
          <li>
            Successful payments are not refunded, except in case of a system error (for example you were charged but
            the course was not unlocked); in that case VocaSpace will unlock the course or refund you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Removed courses">
        <p>
          A course may be removed when its teacher stops offering it or when it violates our policies; you may then no
          longer be able to access it. If you paid for a removed course, contact support@vocaspace.com and VocaSpace
          will help as appropriate, for example by giving you a discount code for another course.
        </p>
      </LegalSection>

      <LegalSection title="7. Suspension and termination">
        <p>
          VocaSpace may suspend or delete accounts that violate these terms. You can stop using VocaSpace and ask for
          your account to be deleted at any time, as described in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          VocaSpace is provided &quot;as is&quot;. We try to keep the service running reliably but do not guarantee that
          it will always be available or free of errors. To the extent permitted by law, VocaSpace is not liable for
          indirect damages arising from the use of the service.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these terms">
        <p>
          When these terms change, we update this page and the &quot;Last updated&quot; date at the top. For important
          changes, we will post a notice on the website. If you continue to use VocaSpace after a change, you accept the
          new terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          For any questions about these terms, please email{" "}
          <a href="mailto:support@vocaspace.com">support@vocaspace.com</a>.
        </p>
      </LegalSection>
    </>
  );
}
