import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

// Ngày cập nhật dùng chung cho /privacy và /terms. Khi nội dung đổi, commit cuối trước khi merge đặt lại thành ngày merge
// (A4b G3); thêm bản dịch tiếng Anh không đổi nội dung nên giữ nguyên ngày (U7 G3).
export const LEGAL_LAST_UPDATED = "22/11/2026";

// Chỉ bản tiếng Anh có câu này: bản tiếng Việt là bản có giá trị ưu tiên (quyết định 4, U7 G4), nên không có bản dịch ngược.
const ENGLISH_TRANSLATION_NOTICE =
  "This English version is a translation provided for convenience. If it differs from the Vietnamese version, the Vietnamese version prevails.";

// Cùng một ngày với bản tiếng Việt (U7 G3), chỉ đổi cách viết để người đọc tiếng Anh không nhầm ngày/tháng.
function englishLastUpdated(): string {
  const [day, month, year] = LEGAL_LAST_UPDATED.split("/").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("legal");
  const isEnglish = locale === "en";

  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-gray-700 shadow-sm md:p-10 [&_p]:mt-3 [&_p]:leading-7 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:leading-7 [&_a]:text-blue-600 [&_a]:underline-offset-2 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-gray-900">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">{title}</h1>
        <p className="!mt-2 text-sm text-gray-500">
          {t("lastUpdated", { date: isEnglish ? englishLastUpdated() : LEGAL_LAST_UPDATED })}
        </p>
        {isEnglish ? <p className="text-sm italic text-gray-500">{ENGLISH_TRANSLATION_NOTICE}</p> : null}
        {children}
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
