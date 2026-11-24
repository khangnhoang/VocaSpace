import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "../_components/LegalDocument";
import { TermsBodyEn } from "./_components/TermsBodyEn";
import { TermsBodyVi } from "./_components/TermsBodyVi";

// Nội dung hai bản là bản đã được Owner duyệt (A4b plan, Appendix B; U7 plan, Appendix B). Đổi chữ phải qua Owner và phải
// cập nhật cả bản tiếng Việt lẫn tiếng Anh cùng PR (G1; U7 G5).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("metaTitle") };
}

export default function TermsPage() {
  const locale = useLocale();
  const t = useTranslations("legal.terms");

  return <LegalDocument title={t("title")}>{locale === "en" ? <TermsBodyEn /> : <TermsBodyVi />}</LegalDocument>;
}
