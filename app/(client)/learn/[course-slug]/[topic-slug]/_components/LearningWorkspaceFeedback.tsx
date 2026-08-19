import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import type { LearningWorkspaceResult } from "@/lib/schemas/learning-workspace";
import LearningWorkspaceRetryButton from "./LearningWorkspaceRetryButton";

type FeedbackResult = Extract<
  LearningWorkspaceResult,
  { status: "unenrolled" | "topic_unavailable" | "error" }
>;

export default function LearningWorkspaceFeedback({
  result,
}: {
  result: FeedbackResult;
}) {
  const isError = result.status === "error";
  const isUnenrolled = result.status === "unenrolled";
  const title = isUnenrolled
    ? "Tài khoản này chưa đăng ký khóa học"
    : result.status === "topic_unavailable"
      ? "Bài học này không khả dụng"
      : "Chưa thể tải không gian học tập";

  return (
    <div className="flex min-h-[72vh] items-center justify-center bg-slate-50 px-4 py-12 sm:px-6">
      <section
        role={isError ? "alert" : "status"}
        aria-labelledby="learning-workspace-feedback-title"
        className={`w-full max-w-2xl rounded-[28px] border bg-white p-6 text-center shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:p-10 ${
          isError ? "border-rose-100" : "border-emerald-100"
        }`}
      >
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            isError
              ? "bg-rose-50 text-rose-600"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {isError ? (
            <TriangleAlert aria-hidden="true" className="size-7" />
          ) : (
            <LockKeyhole aria-hidden="true" className="size-7" />
          )}
        </span>

        <p
          className={`mt-5 text-xs font-extrabold tracking-[0.15em] ${
            isError ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {isUnenrolled
            ? "QUYỀN TRUY CẬP KHÓA HỌC"
            : result.status === "topic_unavailable"
              ? "BÀI HỌC KHÔNG KHẢ DỤNG"
              : "KHÔNG THỂ TẢI DỮ LIỆU"}
        </p>
        <h1
          id="learning-workspace-feedback-title"
          className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl"
        >
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
          {isUnenrolled ? (
            <>
              Bạn đang đăng nhập nhưng chưa có quyền học khóa “
              <span className="font-bold text-slate-900">
                {result.course.title}
              </span>
              ”. Xem trang giới thiệu để kiểm tra thông tin và lựa chọn đăng ký.
            </>
          ) : result.status === "topic_unavailable" ? (
            "Liên kết này không trỏ tới một bài học bạn có thể mở trong khóa học hiện tại. Hãy quay lại tổng quan khóa học để chọn bài khác."
          ) : (
            result.error
          )}
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {isUnenrolled ? (
            <Button
              asChild
              className="min-h-11 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700"
            >
              <Link href={getPublicCourseDetailPath(result.course.slug)}>
                Xem thông tin khóa học
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : result.status === "topic_unavailable" ? (
            <Button
              asChild
              className="min-h-11 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700"
            >
              <Link href={`/learn/${result.course.slug}`}>
                Về tổng quan khóa học
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : (
            <LearningWorkspaceRetryButton />
          )}

          <Button
            asChild
            variant="outline"
            className="min-h-11 rounded-xl border-slate-200 px-5 text-slate-700 hover:bg-slate-50"
          >
            <Link href="/learn">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Về không gian học tập
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
