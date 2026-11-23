import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getPublicCourseDetailPath } from "@/lib/public-courses/routes";
import type { EnrolledCourseOverviewResult } from "@/lib/schemas/enrolled-course-overview";
import EnrolledCourseOverviewRetryButton from "./EnrolledCourseOverviewRetryButton";

type FeedbackResult = Extract<
  EnrolledCourseOverviewResult,
  { status: "unenrolled" | "error" }
>;

export default function EnrolledCourseOverviewFeedback({
  result,
}: {
  result: FeedbackResult;
}) {
  const t = useTranslations("learn");
  const isUnenrolled = result.status === "unenrolled";

  return (
    <div className="flex min-h-[72vh] items-center justify-center bg-slate-50 px-4 py-12 sm:px-6">
      <section
        role={isUnenrolled ? "status" : "alert"}
        aria-labelledby="course-overview-feedback-title"
        className={`w-full max-w-2xl rounded-[28px] border bg-white p-6 text-center shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:p-10 ${
          isUnenrolled ? "border-route-line" : "border-correction-line"
        }`}
      >
        <span
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            isUnenrolled
              ? "bg-route-quiet text-route"
              : "bg-correction-quiet text-correction"
          }`}
        >
          {isUnenrolled ? (
            <LockKeyhole aria-hidden="true" className="size-7" />
          ) : (
            <TriangleAlert aria-hidden="true" className="size-7" />
          )}
        </span>

        <p
          className={`mt-5 text-xs font-extrabold tracking-[0.15em] ${
            isUnenrolled ? "text-route" : "text-correction"
          }`}
        >
          {isUnenrolled
            ? t("overview.feedback.unenrolledEyebrow")
            : t("overview.feedback.errorEyebrow")}
        </p>
        <h1
          id="course-overview-feedback-title"
          className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl"
        >
          {isUnenrolled
            ? t("overview.feedback.unenrolledTitle")
            : t("overview.feedback.errorTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
          {isUnenrolled ? (
            <>
              {t("overview.feedback.unenrolledBodyBefore")}
              <span className="font-bold text-slate-900">
                {result.course.title}
              </span>
              {t("overview.feedback.unenrolledBodyAfter")}
            </>
          ) : (
            result.error
          )}
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {isUnenrolled ? (
            <Button
              asChild
              className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700"
            >
              <Link href={getPublicCourseDetailPath(result.course.slug)}>
                {t("overview.feedback.viewCourse")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          ) : (
            <EnrolledCourseOverviewRetryButton />
          )}

          <Button
            asChild
            variant="outline"
            className="min-h-11 rounded-xl border-slate-200 px-5 text-slate-700 hover:bg-slate-50"
          >
            <Link href="/learn">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("overview.feedback.backToLearn")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
