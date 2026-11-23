import Link from "next/link";
import { useTranslations } from "next-intl";

const LINK_CLASS =
  "text-blue-600 underline underline-offset-2 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// Chỉ là dòng thông báo, không có checkbox: tiếp tục đăng nhập/đăng ký (email hoặc Google) được coi là đồng ý (A4b decision 6).
export function LegalConsentNotice() {
  const t = useTranslations("auth.legal");
  return (
    <p className="text-center text-xs leading-5 text-gray-600">
      {t.rich("consent", {
        terms: (chunks) => (
          <Link href="/terms" className={LINK_CLASS}>
            {chunks}
          </Link>
        ),
        privacy: (chunks) => (
          <Link href="/privacy" className={LINK_CLASS}>
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
