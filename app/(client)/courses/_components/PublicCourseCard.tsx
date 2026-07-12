import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import type { PublicCourseCatalogItem } from "@/lib/schemas/public-course";

type PublicCourseCardProps = {
  course: PublicCourseCatalogItem;
  headingLevel: "h2" | "h3";
  prioritizeImage?: boolean;
};

const priceFormatter = new Intl.NumberFormat("vi-VN");

export function PublicCourseCard({
  course,
  headingLevel,
  prioritizeImage = false,
}: PublicCourseCardProps) {
  const detailPath = getPublicCourseDetailPath(course.slug);
  const imageAlt = `Ảnh bìa khóa học ${course.title}`;
  const Heading = headingLevel;

  return (
    <Link
      href={detailPath}
      aria-label={`Xem chi tiết khóa học ${course.title}`}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-blue-400/50 focus-visible:ring-offset-3"
    >
      <Card className="h-full gap-0 overflow-hidden rounded-2xl border border-gray-100 bg-white py-0 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-blue-100 group-hover:shadow-lg">
        <div className="relative aspect-4/3 overflow-hidden bg-linear-to-br from-blue-50 to-cyan-50">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={imageAlt}
              fill
              priority={prioritizeImage}
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              role="img"
              aria-label={`Chưa có ảnh bìa cho khóa học ${course.title}`}
              className="flex h-full items-center justify-center text-blue-400"
            >
              <BookOpen aria-hidden="true" className="size-14" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant="secondary"
              className="bg-blue-50 text-blue-700"
            >
              {course.price === 0 ? "Miễn phí" : "Khóa học trả phí"}
            </Badge>
            <span className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
              <Users aria-hidden="true" className="size-3.5" />
              {priceFormatter.format(course.enrollment_count)} học viên
            </span>
          </div>

          <Heading className="line-clamp-2 text-lg font-bold leading-snug text-gray-900">
            {course.title}
          </Heading>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-lg font-extrabold text-blue-500">
              {course.price === 0
                ? "Miễn phí"
                : `${priceFormatter.format(course.price)} ₫`}
            </p>
            <span className="font-semibold text-[#2db2b9] transition group-hover:translate-x-0.5">
              Xem chi tiết →
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
