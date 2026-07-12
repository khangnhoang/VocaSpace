"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutSession } from "@/app/actions/payment";
import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { Button } from "@/components/ui/button";
import type { CheckoutResponse } from "@/lib/schemas/payment";
import type { PublicCourseDetail } from "@/lib/schemas/public-course";
import PublicCoursePaymentModal from "./PublicCoursePaymentModal";

type PublicCourseEnrollmentCardProps = {
  course: Pick<
    PublicCourseDetail,
    "id" | "title" | "slug" | "price" | "thumbnail_url" | "is_enrolled"
  >;
};

export function PublicCourseEnrollmentCard({
  course,
}: PublicCourseEnrollmentCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<CheckoutResponse | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  async function continueLearning() {
    try {
      const result = await getFirstTopicSlugByCourseSlug(course.slug);
      if (result.error || !result.topicSlug) {
        toast.error(result.error || "Không tìm thấy chủ đề học đầu tiên.");
        return;
      }

      router.push(`/learn/${course.slug}/${result.topicSlug}`);
    } catch (error) {
      console.error("Public course learning entry navigation failed", error);
      toast.error("Chưa thể mở chủ đề học đầu tiên. Vui lòng thử lại sau.");
    }
  }

  async function handlePrimaryAction() {
    if (course.is_enrolled) {
      await continueLearning();
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
        toast.success(response.message || "Đăng ký thành công!");
        router.refresh();
        // Enrollment đã thành công; lỗi điều hướng sau đó chỉ được báo riêng, không mở lại modal.
        await continueLearning();
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

  const priceLabel =
    course.price === 0
      ? "Miễn phí"
      : `${course.price.toLocaleString("vi-VN")} ₫`;
  const actionLabel = course.is_enrolled
    ? "Tiếp tục học"
    : course.price === 0
      ? "Đăng ký miễn phí"
      : "Đăng ký khóa học";

  return (
    <>
      <section
        aria-labelledby="public-course-enrollment-title"
        className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg"
      >
        <div className="relative aspect-video bg-linear-to-br from-blue-50 to-cyan-50">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={`Ảnh bìa khóa học ${course.title}`}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 352px"
              className="object-cover"
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

        <div className="p-6">
          <h2
            id="public-course-enrollment-title"
            className="text-xl font-extrabold text-gray-900"
          >
            Bắt đầu khóa học
          </h2>
          <p className="mt-3 text-3xl font-extrabold text-blue-600">
            {priceLabel}
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-5 min-h-12 w-full bg-blue-600 px-5 text-base text-white hover:bg-blue-700"
            onClick={() => void handlePrimaryAction()}
          >
            {actionLabel}
          </Button>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-500">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-600" />
            Nội dung học chỉ mở sau khi tài khoản có quyền truy cập khóa học.
          </p>
        </div>
      </section>

      <PublicCoursePaymentModal
        courseId={course.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        paymentData={paymentData}
        paymentId={paymentId}
        coursePrice={course.price}
        thumbnailUrl={course.thumbnail_url}
        courseTitle={course.title}
        onGeneratePayment={createPayment}
        onSuccess={async () => {
          setIsModalOpen(false);
          router.refresh();
          await continueLearning();
        }}
      />
    </>
  );
}
