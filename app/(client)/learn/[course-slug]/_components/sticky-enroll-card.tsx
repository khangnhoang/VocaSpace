"use client";

import { useState } from "react";
import { Play, ShieldCheck, RefreshCw, Clock } from "lucide-react";
import Image from "next/image";
import PaymentModal from "./payment-modal";
import { CheckoutResponse } from "@/lib/schemas/payment";
import { createCheckoutSession } from "@/app/actions/payment"; 
import { useRouter } from "next/navigation";

interface StickyEnrollCardProps {
  courseId?: string;
  price: number;
  original_price?: number | null;
  thumbnail_url: string | null;
  is_enrolled: boolean;
}

export default function StickyEnrollCard({
  courseId,
  price,
  original_price,
  thumbnail_url,
  is_enrolled,
}: StickyEnrollCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState<CheckoutResponse | null>(null);

  const [paymentId, setPaymentId] = useState<string | null>(null);

  const benefits = [
    { text: "Quyền sở hữu trọn đời khóa học", icon: ShieldCheck },
    { text: "Cập nhật giáo trình liên tục miễn phí", icon: RefreshCw },
    { text: "Hỗ trợ giải đáp chuyên môn 24/7", icon: Clock },
  ];

  const handleEnrollClick = async () => {
    if (is_enrolled) {
      // Nếu đã sở hữu rồi, đá học viên sang route học tập tương ứng luôn
      router.push(`/(client)/learn/${courseId}`); 
      return;
    }

    setIsGeneratingPayment(true);

    try {
      // 1. Kích hoạt lệnh gọi Server Action xuyên qua lớp gác cổng Zod
      const response = await createCheckoutSession({ courseId });

      // 2. Chốt chặn lỗi: Nếu Backend trả về chuỗi error, quăng thông báo ngay
      if (response.error) {
        alert(response.error); // Ú có thể thay bằng component Toast đẹp mắt tùy ý
        return;
      }

      // 3. Xử lý nhánh: Khóa học MIỄN PHÍ (Price = 0)
      if (response.type === "free") {
        alert(response.message || "Đăng ký thành công!");
        // Làm tươi lại trang (Refresh Server Component) để nút chuyển sang trạng thái "Vào học ngay"
        router.refresh(); 
        return;
      }

      // 4. Xử lý nhánh: Khóa học TRẢ PHÍ (Đã lấy được dữ liệu link QR an toàn từ PayOS)
      if (response.type === "paid" && response.data) {
        setPaymentData(response.data); // Đập dữ liệu thật vào state để bóc tách
        setPaymentId(response.paymentId);
        setIsModalOpen(true);          // Kích hoạt mở bung Modal quét mã QR
      }

    } catch (err) {
      console.error("🚨 [FRONTEND_ENROLL_ERROR]:", err);
      alert("Hệ thống kết nối máy chủ gặp sự cố kỹ thuật. Vui lòng thử lại.");
    } finally {
      setIsGeneratingPayment(false);   // Giải phóng trạng thái loading của nút bấm
    }
  };

  return (
    <>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-5 space-y-6 lg:sticky lg:top-6">
        {/* Video / Thumbnail Preview */}
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

        {/* Bảng giá */}
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
          <p className="text-xs text-rose-500 font-semibold animate-pulse">
            ⚡ Ưu đãi có giới hạn thời gian học viên mới
          </p>
        </div>

        {/* Nút CTA hành động */}
        <button
          onClick={handleEnrollClick}
          disabled={isGeneratingPayment}
          className={`w-full py-4 px-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${
            is_enrolled
              ? "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10"
              : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
          }`}
        >
          {isGeneratingPayment
            ? "Đang khởi tạo thanh toán..."
            : is_enrolled
              ? "Vào tiếp tục học ngay"
              : "Đăng ký khóa học ngay"}
        </button>

        {/* Cam kết chất lượng */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {benefits.map((b, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <b.icon size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-xs font-medium text-slate-600 leading-normal">
                {b.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Render Modal thanh toán */}
      <PaymentModal
        key={
          isModalOpen ? "opened" : "closed"
        } /* Fix triệt để lỗi Cascading Renders */
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        paymentData={paymentData}
        paymentId={paymentId}
        onRefresh={handleEnrollClick}
      />
    </>
  );
}
