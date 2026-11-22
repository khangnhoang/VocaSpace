import { BookOpen, Layers3, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

type PublicCourseStatsProps = {
  course: PublicCourseDetail;
};

export function PublicCourseStats({ course }: PublicCourseStatsProps) {
  const t = useTranslations("courses");
  const locale = useLocale() as Locale;
  const topicCount = course.syllabus.reduce(
    (total, chapter) => total + chapter.topics.length,
    0,
  );
  const stats = [
    {
      label: t("detail.stats.chapters"),
      value: course.syllabus.length,
      icon: BookOpen,
    },
    { label: t("detail.stats.topics"), value: topicCount, icon: Layers3 },
    { label: t("detail.stats.students"), value: course.enrollment_count, icon: Users },
  ];

  return (
    <section aria-labelledby="public-course-stats-title">
      <h2
        id="public-course-stats-title"
        className="mb-4 text-2xl font-extrabold text-gray-900"
      >
        {t("detail.stats.title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <stat.icon aria-hidden="true" className="size-6 text-blue-500" />
            <p className="mt-4 text-2xl font-extrabold text-gray-950">
              {formatNumber(locale, stat.value)}
            </p>
            <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
