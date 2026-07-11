import { BookOpen, Layers3, Users } from "lucide-react";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";

type PublicCourseStatsProps = {
  course: PublicCourseDetail;
};

export function PublicCourseStats({ course }: PublicCourseStatsProps) {
  const topicCount = course.syllabus.reduce(
    (total, chapter) => total + chapter.topics.length,
    0,
  );
  const stats = [
    {
      label: "Chương học",
      value: course.syllabus.length,
      icon: BookOpen,
    },
    { label: "Chủ đề công khai", value: topicCount, icon: Layers3 },
    { label: "Học viên", value: course.enrollment_count, icon: Users },
  ];

  return (
    <section aria-labelledby="public-course-stats-title">
      <h2
        id="public-course-stats-title"
        className="mb-4 text-2xl font-extrabold text-gray-900"
      >
        Tổng quan khóa học
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <stat.icon aria-hidden="true" className="size-6 text-blue-500" />
            <p className="mt-4 text-2xl font-extrabold text-gray-950">
              {stat.value.toLocaleString("vi-VN")}
            </p>
            <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
