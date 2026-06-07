"use client";

import { useState } from "react";
import { Play, ShieldCheck, RefreshCw, Clock } from "lucide-react";
import Image from "next/image";
import PaymentModal from "./payment-modal";
import { CheckoutResponse } from "@/lib/schemas/payment";
import { createCheckoutSession } from "@/app/actions/payment";
import { useRouter } from "next/navigation";
import { getFirstTopicSlugByCourseSlug } from "@/app/actions/course-navigation";
import { toast } from "sonner";

interface StickyEnrollCardProps {
  courseId: string;
  courseSlug: string;
  price: number;
  original_price?: number | null;
  thumbnail_url: string | null;
  is_enrolled: boolean;
}

export default function StickyEnrollCard({
  courseId,
  courseSlug,
  price,
  original_price,
  thumbnail_url,
  is_enrolled,
}: StickyEnrollCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<CheckoutResponse | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const benefits = [
    { text: "Quyền sở hữu trọn đời khóa học", icon: ShieldCheck },
    { text: "Cập nhật giáo trình liên tục miễn phí", icon: RefreshCw },
    { text: "Hỗ trợ giải đáp chuyên môn 24/7", icon: Clock },
  ];

  const redirectToLearningEntry = async () => {
    const res = await getFirstTopicSlugByCourseSlug(courseSlug);
    if (res.error || !res.topicSlug) {
      toast.error(res.error || "Không tìm thấy bài học đầu tiên.");
      return;
    }
    router.push(`/learn/${courseSlug}/${res.topicSlug}`);
  };

  // CHỈNH SỬA PHẪU THUẬT: Nút này giờ chỉ làm nhiệm vụ mở Modal (Stage 1)
  const handleEnrollClick = async () => {
    if (is_enrolled) {
      await redirectToLearningEntry();
      return;
    }
    setIsModalOpen(true);
  };

  // CHỈNH SỬA PHẪU THUẬT: Chuyển logic gọi API thành callback truyền vào Modal
  const handleGeneratePayment = async (
    couponCode?: string,
  ): Promise<boolean> => {
    try {
      const response = await createCheckoutSession({
        courseId,
        ...(couponCode ? { couponCode } : {}),
      });

      if (response.error) {
        toast.error(response.error);
        return false;
      }

      if (response.type === "free") {
        toast.success(response.message || "Đăng ký thành công!");
        router.refresh();
        await redirectToLearningEntry();
        return false;
      }

      if (response.type === "paid" && response.data && response.paymentId) {
        setPaymentData(response.data);
        setPaymentId(response.paymentId);
        return true;
      }

      toast.error("Không thể khởi tạo phiên thanh toán.");
      return false;
    } catch (err) {
      console.error("🚨 [FRONTEND_ENROLL_ERROR]:", err);
      toast.error(
        "Hệ thống kết nối máy chủ gặp sự cố kỹ thuật. Vui lòng thử lại.",
      );
      return false;
    }
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-5 space-y-6 lg:sticky lg:top-6">
        {/* ... (Giữ nguyên toàn bộ giao diện Video và Bảng giá cũ của bạn) ... */}
        <div className="relative aspect-video w-full rounded-2xl bg-slate-900 overflow-hidden group shadow-inner cursor-pointer">
          {thumbnail_url && (
            <Image
              src={thumbnail_url}
              alt="Course Preview"
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
            />
          )}
          <button className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-xl text-emerald-600 hover:scale-110 active:scale-95 transition-all cursor-pointer">
            <Play size={24} className="fill-current ml-1" />
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900">
              {price === 0 ? "Miễn phí" : `${price.toLocaleString()}đ`}
            </span>
            {original_price && original_price > price && (
              <span className="text-sm font-medium text-slate-400 line-through">
                {original_price.toLocaleString()}đ
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleEnrollClick}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
            is_enrolled
              ? "bg-slate-900 hover:bg-slate-800 text-white"
              : "bg-emerald-500 hover:bg-emerald-600 text-white"
          }`}
        >
          {is_enrolled ? "Vào tiếp tục học ngay" : "Đăng ký khóa học ngay"}
        </button>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          {benefits.map((b, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <b.icon size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-xs font-medium text-slate-600">
                {b.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CHỈNH SỬA PHẪU THUẬT: Bỏ {isModalOpen &&}, dùng prop trực tiếp để bảo toàn DOM State */}
      <PaymentModal
        courseId={courseId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        paymentData={paymentData}
        paymentId={paymentId}
        coursePrice={price}
        thumbnailUrl={thumbnail_url}
        courseTitle={courseSlug}
        onGeneratePayment={handleGeneratePayment}
        onSuccess={async () => {
          setIsModalOpen(false);
          router.refresh();
          await redirectToLearningEntry();
        }}
      />
    </>
  );
}
