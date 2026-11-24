import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "../_components/LegalDocument";
import { PrivacyBodyEn } from "./_components/PrivacyBodyEn";
import { PrivacyBodyVi } from "./_components/PrivacyBodyVi";

// Nội dung hai bản là bản đã được Owner duyệt (A4b plan, Appendix A; U7 plan, Appendix A). Đổi chữ phải qua Owner; đổi cách
// thu thập dữ liệu, bên thứ ba hoặc cookie trong code thì phải cập nhật cả bản tiếng Việt lẫn tiếng Anh cùng PR (G1, G2; U7 G5).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

export default function PrivacyPage() {
  const locale = useLocale();
  const t = useTranslations("legal.privacy");

  return <LegalDocument title={t("title")}>{locale === "en" ? <PrivacyBodyEn /> : <PrivacyBodyVi />}</LegalDocument>;
}
