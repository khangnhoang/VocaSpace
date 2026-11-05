import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Users } from "lucide-react";
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
      className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
    >
      <Card className="h-full gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white py-0 shadow-none transition-[border-color,box-shadow,translate] duration-[700ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:-translate-y-0.5 group-hover:border-route-line group-hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={imageAlt}
              fill
              priority={prioritizeImage}
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div
              role="img"
              aria-label={`Chưa có ảnh bìa cho khóa học ${course.title}`}
              className="flex h-full items-center justify-center text-slate-500"
            >
              <BookOpen aria-hidden="true" className="size-14" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge
              variant="secondary"
              className={
                course.price === 0
                  ? "bg-growth-quiet text-growth"
                  : "bg-slate-100 text-slate-600"
              }
            >
              {course.price === 0 ? "Miễn phí" : "Khóa học trả phí"}
            </Badge>
            <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
              <Users aria-hidden="true" className="size-3.5" />
              {priceFormatter.format(course.enrollment_count)} học viên
            </span>
          </div>

          <Heading className="line-clamp-2 text-lg font-bold leading-[26px] text-slate-900">
            {course.title}
          </Heading>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-base font-extrabold leading-6 text-slate-900">
              {course.price === 0
                ? "Miễn phí"
                : `${priceFormatter.format(course.price)} ₫`}
            </p>
            <span className="relative inline-flex items-center gap-1 font-semibold text-route after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[650ms] after:ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:after:scale-x-100 motion-reduce:after:transition-none">
              Xem chi tiết
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
