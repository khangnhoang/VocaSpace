import Link from "next/link";
import { AlertCircle, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicCourseRetryButton } from "@/app/(client)/courses/_components/PublicCourseRetryButton";

type PublicCoursePreviewUnavailableProps = {
  kind: "unavailable" | "error";
  returnToCourseHref: string;
};

export function PublicCoursePreviewUnavailable({
  kind,
  returnToCourseHref,
}: PublicCoursePreviewUnavailableProps) {
  const isError = kind === "error";

  return (
    <section
      aria-labelledby="public-course-preview-unavailable-title"
      role={isError ? "alert" : "status"}
      className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10"
    >
      <div className="mb-5 rounded-full bg-slate-100 p-4 text-slate-600">
        {isError ? (
          <AlertCircle aria-hidden="true" className="size-7" />
        ) : (
          <EyeOff aria-hidden="true" className="size-7" />
        )}
      </div>
      <h1
        id="public-course-preview-unavailable-title"
        className="text-2xl font-extrabold text-slate-900"
      >
        {isError ? "Chưa thể tải nội dung xem thử" : "Nội dung xem thử hiện không khả dụng"}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
        {isError
          ? "Vui lòng thử tải lại trang sau ít phút."
          : "Tính năng xem trước nội dung của khóa học này đang tạm thời không khả dụng."}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline" className="min-h-11 px-5">
          <Link href={returnToCourseHref}>Về khóa học</Link>
        </Button>
        {isError && <PublicCourseRetryButton />}
      </div>
    </section>
  );
}
