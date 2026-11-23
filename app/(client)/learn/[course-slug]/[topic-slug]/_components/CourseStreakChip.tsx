import { Flame } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatCatalogCount } from "@/lib/i18n/format";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";

/**
 * FEAT3 AC7: chip chuỗi ngày học của khóa trong header của không gian học. Chưa có chuỗi thì không hiện gì; chưa tải được
 * hiện một dòng lặng lẽ (AC10) vì việc học không phụ thuộc vào chip này. Trang không truyền kết quả nào thì không hiện gì.
 */
export default function CourseStreakChip({ summary }: { summary: CourseLearningSummaryResult | undefined }) {
  const t = useTranslations("learn");
  const locale = useLocale() === "en" ? "en" : "vi";
  if (!summary) return null;
  if (!summary.success) {
    return (
      <span role="status" className="inline-flex shrink-0 items-center text-sm text-slate-500">
        {t("streak.unavailableTitle")}
      </span>
    );
  }
  if (summary.data.streak === 0) return null;
  const { streak, studiedToday } = summary.data;

  return (
    <span
      role="status"
      title={studiedToday ? t("workspace.streakChip.studiedTitle") : t("workspace.streakChip.keepTitle")}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-sm font-bold text-orange-700"
    >
      <Flame aria-hidden="true" className="size-4" />
      <span>{t("workspace.streakChip.days", { count: streak, shown: formatCatalogCount(locale, streak) })}</span>
      {!studiedToday && <span className="sr-only">{t("workspace.streakChip.keepNote")}</span>}
    </span>
  );
}
