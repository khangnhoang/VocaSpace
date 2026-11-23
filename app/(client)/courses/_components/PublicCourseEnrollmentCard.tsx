"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { createCheckoutSession } from "@/app/actions/payment";
import { getFirstTopicSlugByCourseSlugLocalized } from "@/app/actions/course-navigation-localized";
import {
  CourseActivityUnavailable,
  CourseStreakLine,
  RecentTopicsList,
} from "@/components/learning-activity/CourseLearningActivity";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { viCoursesText } from "@/lib/i18n/courses-text";
import { formatCatalogCount, formatVnd } from "@/lib/i18n/format";
import { pickServerText, useLatest } from "@/lib/i18n/held-message";
import { viLearningText } from "@/lib/i18n/learning-text";
import { asTranslate, type Translate } from "@/lib/i18n/translate";
import type { CourseLearningSummaryResult } from "@/lib/schemas/learning-activity";
import { getPublicCourseDetailPath, RESUME_PAYMENT_PARAM } from "@/lib/public-courses/routes";
import type { CheckoutResponse, ResumeCheckoutResult } from "@/lib/schemas/payment";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import { PublicCourseCover } from "./PublicCourseCover";
import PublicCoursePaymentModal, { type PublicCourseContentSummary } from "./PublicCoursePaymentModal";

/**
 * FEAT3 AC6a: dữ liệu cho thẻ "đang học" của học viên đã ghi danh. Tính ở server từ dữ liệu công khai đã có (đề cương, tiến độ) nên
 * không thêm lần đọc nào; `summary` đi riêng khỏi payload công khai đã cache (G5).
 */
export type PublicCourseLearnerCard = {
  completedTopicCount: number;
  totalTopicCount: number;
  nextTopicTitle: string | null;
  summary?: CourseLearningSummaryResult;
};

type PublicCourseEnrollmentCardProps = {
  course: Pick<
    PublicCourseDetail,
    | "id"
    | "title"
    | "slug"
    | "price"
    | "thumbnail_url"
    | "is_enrolled"
    | "learner_progress"
  >;
  learnerCard?: PublicCourseLearnerCard;
  // U4 AC3: số chương và chủ đề công khai cho hộp thoại đăng ký miễn phí, tính sẵn từ đề cương ở trang chi tiết.
  contentSummary?: PublicCourseContentSummary;
  // FEAT6 AC11: kết quả mở lại mã QR khi vào bằng link "Tiếp tục thanh toán"; chỉ được đọc một lần lúc mount.
  resume?: ResumeCheckoutResult;
  // Bản dịch và ngôn ngữ do trang chi tiết truyền xuống. Thành phần này không gọi hook next-intl vì test gọi nó như một hàm; thiếu
  // thì dùng tiếng Việt lấy từ catalog (cùng cách với PublicCourseRetryButton và các thành phần dùng chung của U3, H7).
  t?: Translate;
  learningText?: Translate;
  locale?: Locale;
  // Bản dịch và ngôn ngữ của lần render mới nhất, cho toast phát sau một request async (người dùng có thể đổi ngôn ngữ trong lúc chờ).
  // Do lớp client mỏng bên dưới cấp; thiếu thì dùng `t`/`locale` của lần render gửi đi.
  latest?: { readonly current: { t: Translate; locale: Locale } };
};

export function PublicCourseEnrollmentCard({
  course,
  learnerCard,
  contentSummary,
  resume,
  t = viCoursesText,
  learningText = viLearningText,
  locale = "vi",
  latest,
}: PublicCourseEnrollmentCardProps) {
  const router = useRouter();
  // Khoản pending còn hạn chỉ làm giá trị khởi tạo của state: modal mở ở bước QR ngay lần render đầu, không cần click và không tạo thanh toán mới.
  // Sau đó `resume` biến mất khỏi props (tham số bị gỡ) cũng không đóng hay mở lại gì.
  const resumed = resume?.status === "resume" ? resume : null;
  const [isModalOpen, setIsModalOpen] = useState(resumed !== null);
  const [paymentData, setPaymentData] = useState<CheckoutResponse | null>(resumed?.data ?? null);
  const [paymentId, setPaymentId] = useState<string | null>(resumed?.paymentId ?? null);
  // LF3 AC7: vừa đăng ký xong thì ở lại trang, nút chính đổi thành "Bắt đầu học" và chỉ mở chủ đề đầu khi bấm.
  const [justEnrolled, setJustEnrolled] = useState(false);

  async function continueLearning() {
    try {
      const { result, locale: responseLocale } = await getFirstTopicSlugByCourseSlugLocalized(course.slug);
      if (result.error || !result.topicSlug) {
        // Dịch theo ngôn ngữ lúc toast bật, không phải lúc gửi request; chuỗi của server chỉ dùng khi nó cùng ngôn ngữ đó.
        const now = latest?.current ?? { t, locale };
        toast.error(
          result.error
            ? pickServerText(result.error, responseLocale, now.locale, now.t("detail.enrollment.openFirstFailed"))
            : now.t("detail.enrollment.noFirstTopic"),
        );
        return;
      }

      router.push(`/learn/${course.slug}/${result.topicSlug}`);
    } catch (error) {
      console.error("Public course learning entry navigation failed", error);
      toast.error((latest?.current ?? { t }).t("detail.enrollment.openFirstFailed"));
    }
  }

  // LF3 AC10/Q7: "Tiếp tục học" mở chủ đề "Học tiếp" của đề cương, hoặc tổng quan khóa học khi đã xong hết/không có chủ đề.
  function openProgressDestination() {
    const nextTopicSlug = course.learner_progress?.next_topic_slug;
    router.push(
      nextTopicSlug
        ? `/learn/${course.slug}/${nextTopicSlug}`
        : `/learn/${course.slug}`,
    );
  }

  async function handlePrimaryAction() {
    if (justEnrolled) {
      await continueLearning();
      return;
    }
    if (course.is_enrolled) {
      openProgressDestination();
      return;
    }

    setIsModalOpen(true);
  }

  async function createPayment(couponCode?: string): Promise<boolean> {
    try {
      // B1.4 giữ nguyên checkout contract; canonical cancel URL được xử lý riêng ở B1.5.
      const response = await createCheckoutSession({
        courseId: course.id,
        ...(couponCode ? { couponCode } : {}),
      });

      if (response.error) {
        toast.error(response.error);
        return false;
      }

      if (response.type === "free") {
        // Đóng và xóa state thanh toán trước khi refresh/navigation cập nhật UI phía sau.
        setIsModalOpen(false);
        setPaymentData(null);
        setPaymentId(null);
        setJustEnrolled(true);
        toast.success(response.message || t("detail.enrollment.freeSuccess"));
        router.refresh();
        return false;
      }

      if (response.type === "paid" && response.data && response.paymentId) {
        setPaymentData(response.data);
        setPaymentId(response.paymentId);
        return true;
      }

      toast.error("Không thể khởi tạo phiên thanh toán.");
      return false;
    } catch (error) {
      console.error("Public course enrollment entry failed", error);
      toast.error("Không thể kết nối máy chủ. Vui lòng thử lại.");
      return false;
    }
  }

  const priceLabel = course.price === 0 ? t("price.free") : formatVnd(locale, course.price);
  // AC6a: học viên đã ghi danh từ trước thấy thẻ "đang học"; khách, người chưa ghi danh và trạng thái vừa đăng ký giữ thẻ bán hàng.
  const isLearningCard = course.is_enrolled && !justEnrolled;
  const nextTopicSlug = course.learner_progress?.next_topic_slug ?? null;
  const continueLabel = nextTopicSlug
    ? learnerCard?.nextTopicTitle
      ? t("detail.enrollment.continueTopic", { title: learnerCard.nextTopicTitle })
      : t("detail.enrollment.continue")
    : t("detail.enrollment.overview");
  const actionLabel = justEnrolled
    ? t("detail.enrollment.start")
    : course.is_enrolled
      ? continueLabel
      : course.price === 0
        ? t("detail.enrollment.enrollFree")
        : t("detail.enrollment.enroll");

  return (
    <>
      {resume && <ResumePaymentEntry resume={resume} courseSlug={course.slug} />}
      {isLearningCard ? (
        <section
          aria-labelledby="public-course-enrollment-title"
          className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg"
        >
          <div className="p-6">
            <h2
              id="public-course-enrollment-title"
              className="text-xl font-extrabold text-gray-900"
            >
              {t("detail.enrollment.learningTitle")}
            </h2>
            {learnerCard?.summary &&
              (learnerCard.summary.success ? (
                <div className="mt-4">
                  <CourseStreakLine data={learnerCard.summary.data} as="h3" t={learningText} />
                </div>
              ) : (
                <CourseActivityUnavailable className="mt-4" t={learningText} />
              ))}
            {learnerCard && <LearnerProgress card={learnerCard} courseTitle={course.title} t={t} locale={locale} />}
            <Button
              type="button"
              size="lg"
              className="mt-5 h-auto min-h-11 w-full whitespace-normal py-2.5"
              onClick={() => void handlePrimaryAction()}
            >
              {actionLabel}
            </Button>
            {learnerCard?.summary?.success && (
              <RecentTopicsList
                courseSlug={course.slug}
                topics={learnerCard.summary.data.recentTopics}
                className="mt-6"
                t={learningText}
              />
            )}
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="public-course-enrollment-title"
          className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg"
        >
          {/* Học viên đã ghi danh có ảnh bìa ở phần đầu trang; thẻ không lặp lại ảnh đó. */}
          {!course.is_enrolled && (
            <PublicCourseCover
              title={course.title}
              thumbnailUrl={course.thumbnail_url}
              sizes="(max-width: 1023px) 100vw, 352px"
            />
          )}

          <div className="p-6">
            <h2
              id="public-course-enrollment-title"
              className="text-xl font-extrabold text-gray-900"
            >
              {t("detail.enrollment.startTitle")}
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-blue-600">
              {priceLabel}
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-5 w-full"
              onClick={() => void handlePrimaryAction()}
            >
              {actionLabel}
            </Button>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-600" />
              {t("detail.enrollment.accessNote")}
            </p>
          </div>
        </section>
      )}

      <PublicCoursePaymentModal
        courseId={course.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        paymentData={paymentData}
        paymentId={paymentId}
        openAtQr={resumed !== null}
        coursePrice={course.price}
        thumbnailUrl={course.thumbnail_url}
        courseTitle={course.title}
        contentSummary={contentSummary}
        onGeneratePayment={createPayment}
        onSuccess={async () => {
          setIsModalOpen(false);
          setJustEnrolled(true);
          toast.success("Thanh toán thành công! Bạn đã có quyền truy cập khóa học.");
          router.refresh();
        }}
      />
    </>
  );
}

/**
 * Điểm vào cho trang chi tiết (Server Component). Hàm dịch là hàm nên không đi qua ranh giới server → client được; lớp client mỏng này
 * lấy bản dịch từ provider rồi mới truyền xuống `PublicCourseEnrollmentCard`, vốn nhận `t` qua props để test gọi trực tiếp được.
 */
export function PublicCourseEnrollmentCardLocalized(
  props: Omit<PublicCourseEnrollmentCardProps, "t" | "learningText" | "locale" | "latest">,
) {
  const t = asTranslate(useTranslations("courses"));
  const learningText = asTranslate(useTranslations("learning"));
  const locale = useLocale() as Locale;
  const latest = useLatest({ t, locale });
  return <PublicCourseEnrollmentCard {...props} t={t} learningText={learningText} locale={locale} latest={latest} />;
}

/**
 * FEAT6 AC11: xử lý tham số `?thanh-toan=tiep-tuc` đúng một lần cho mỗi lần tải trang. Báo khi không còn khoản nào chờ
 * (người chưa đăng nhập không có toast vì họ đi theo luồng đăng nhập hiện có), rồi gỡ tham số khỏi URL để tải lại hay Back
 * không mở lại modal. Không tạo thanh toán nào.
 */
function ResumePaymentEntry({
  resume,
  courseSlug,
}: {
  resume: ResumeCheckoutResult;
  courseSlug: string;
}) {
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (resume.status === "none" && resume.reason === "unavailable") {
      toast.info("Khoản thanh toán này không còn chờ");
    }
    // Chỉ gỡ đúng tham số `thanh-toan`; các tham số khác và hash của URL hiện tại được giữ nguyên.
    const remaining = new URLSearchParams(window.location.search);
    remaining.delete(RESUME_PAYMENT_PARAM);
    const query = remaining.toString();
    router.replace(
      `${getPublicCourseDetailPath(courseSlug)}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }, [resume, router, courseSlug]);

  return null;
}

function LearnerProgress({
  card,
  courseTitle,
  t,
  locale,
}: {
  card: PublicCourseLearnerCard;
  courseTitle: string;
  t: Translate;
  locale: Locale;
}) {
  const { completedTopicCount, totalTopicCount } = card;
  const percentage = totalTopicCount > 0 ? Math.round((completedTopicCount / totalTopicCount) * 100) : 0;
  // Cùng quy tắc với số đếm của danh mục (AC5): `en` có dấu phân cách hàng nghìn, `vi` giữ chữ số trần như trước.
  const counts = {
    done: formatCatalogCount(locale, completedTopicCount),
    total: formatCatalogCount(locale, totalTopicCount),
  };

  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-gray-900">
        {t("detail.enrollment.progress", counts)}
      </p>
      <div
        role="progressbar"
        aria-label={t("detail.enrollment.progressLabel", { title: courseTitle })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={t("detail.enrollment.progressText", counts)}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full bg-recall" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
