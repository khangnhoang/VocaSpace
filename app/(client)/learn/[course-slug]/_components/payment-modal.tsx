"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Copy,
  Check,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  CheckoutResponse,
  PaymentRealtimePayload,
} from "@/lib/schemas/payment";
import confetti from "canvas-confetti";
import {
  cancelCheckoutSession,
  checkPaymentStatus,
} from "@/app/actions/payment";
import { createClient } from "@/utils/supabase/client";
import { z } from "zod";

// MOCK DATA & ZOD SCHEMA (SOP Bước 3 & 4)
const MOCK_COUPONS = [
  { code: "VOCASPACE100", type: "fixed", value: 100000, status: "active" },
  { code: "HELLOSUMMER", type: "percentage", value: 10, status: "expired" },
];

const discountCouponSchema = z.object({
  code: z
    .string()
    .min(1, "Vui lòng nhập mã giảm giá")
    .regex(
      /^[A-Z0-9]+$/,
      "Mã giảm giá chỉ bao gồm chữ in hoa và số, không chứa ký tự đặc biệt",
    ),
});

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: CheckoutResponse | null;
  paymentId: string | null;
  coursePrice: number;
  courseTitle?: string; // <--- THÊM DÒNG NÀY (Tên khóa học)
  thumbnailUrl?: string | null; // <--- THÊM DÒNG NÀY (Ảnh khóa học)
  onGeneratePayment: (couponCode: string) => Promise<boolean>;
  onSuccess: () => void | Promise<void>;
}

export default function PaymentModal({
  isOpen,
  onClose,
  paymentData,
  paymentId,
  coursePrice,
  courseTitle, // <--- THÊM DÒNG NÀY
  thumbnailUrl, // <--- THÊM DÒNG NÀY
  onGeneratePayment,
  onSuccess,
}: PaymentModalProps) {
  // STATE CỦA STAGE 1 (DISCOUNT)
  const [stage, setStage] = useState<1 | 2>(1);
  const [couponCode, setCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // STATE CỦA STAGE 2 (QR CODE - Nguyên bản)
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const successHandledRef = useRef(false);

  const finalAmount = coursePrice - discountAmount;

  /* =========================================================
     LOGIC STAGE 1: ÁP MÃ & TẠO PHIÊN
     ========================================================= */
  const handleApplyCoupon = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setCouponLoading(true);

    const validation = discountCouponSchema.safeParse({ code: couponCode });
    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      setCouponLoading(false);
      return;
    }

    // Giả lập API
    setTimeout(() => {
      const found = MOCK_COUPONS.find((c) => c.code === couponCode);
      if (!found || found.status === "expired") {
        setErrorMsg("Mã giảm giá không tồn tại hoặc hết hạn sử dụng");
        setDiscountAmount(0);
      } else {
        setSuccessMsg("Áp dụng mã giảm giá thành công");
        setDiscountAmount(found.value);
      }
      setCouponLoading(false);
    }, 500);
  };

  const handleProceedToPayment = async () => {
    setIsGenerating(true);
    // Gọi ngược hàm lên parent để tạo Session API
    const isSuccess = await onGeneratePayment(couponCode);
    if (isSuccess) {
      setStage(2); // Thành công mới trượt qua Stage 2 (Có QR)
    }
    setIsGenerating(false);
  };

  /* =========================================================
     LOGIC STAGE 2: GIỮ NGUYÊN BẢN CỦA BẠN (Realtime & Polling)
     ========================================================= */
  const handleSuccess = useCallback(() => {
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    setIsSuccess(true);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => void onSuccess(), 3500);
  }, [onSuccess]);

  useEffect(() => {
    // Chỉ chạy đếm ngược khi ở Stage 2
    if (!isOpen || isSuccess || timeLeft <= 0 || stage !== 2) return;
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [isOpen, isSuccess, timeLeft, stage]);

  useEffect(() => {
    // Chỉ lắng nghe Realtime khi có paymentId và ở Stage 2
    if (!isOpen || !paymentId || isSuccess || stage !== 2) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`payment_status_${paymentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${paymentId}`,
        },
        (payload: PaymentRealtimePayload) => {
          if (payload.new && payload.new.status === "paid") handleSuccess();
        },
      )
      .subscribe();

    const pollingInterval = setInterval(async () => {
      try {
        const res = await checkPaymentStatus(paymentId);
        if (res && res.status === "paid") handleSuccess();
      } catch {}
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [isOpen, paymentId, isSuccess, handleSuccess, stage]);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // SOP RULE: Bấm X chỉ đóng Modal (Lớp CSS ẩn đi), KHÔNG RESET STAGE
  const handleCloseModal = () => onClose();

  // SOP RULE: Bấm Hủy Thanh Toán thì Xóa Đơn & RESET VỀ STAGE 1
  const handleCancelClick = async () => {
    if (!paymentId || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await cancelCheckoutSession(paymentId);
      if (res.error) {
        alert(res.error);
        setIsCancelling(false);
        return;
      }
      setIsCancelling(false);

      // Xóa State hoàn toàn đưa về lại Stage 1
      setStage(1);
      setCouponCode("");
      setDiscountAmount(0);
      setTimeLeft(600);
      successHandledRef.current = false;
      onClose();
    } catch {
      alert("Sự cố kết nối máy chủ.");
      setIsCancelling(false);
    }
  };

  const isExpired = timeLeft <= 0;

  return (
    // SOP RULE: Dùng CSS để ẩn/hiện, giữ nguyên component trên DOM
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto bg-slate-900/60 backdrop-blur-sm"
          : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Container có overflow-hidden để bọc thanh trượt bên trong */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative overflow-hidden">
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-20"
        >
          <X size={20} />
        </button>

        {/* BĂNG CHUYỀN TRƯỢT (SLIDER) */}
        <div
          className="flex w-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(${stage === 1 ? "0%" : "-100%"})` }}
        >
          {/* =======================================
              STAGE 1: MÃ GIẢM GIÁ (Cột Trái - Phải) 
              ======================================= */}
          <div className="w-full shrink-0 flex flex-col md:flex-row bg-slate-50">
            {/* Cột trái (Stage 1) */}
            <div className="w-full md:w-[45%] bg-slate-100 p-8 flex flex-col justify-center border-r border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Xác nhận đăng ký
              </h2>
              <p className="text-slate-500 mb-6 text-sm">
                Vui lòng kiểm tra lại thông tin và áp dụng ưu đãi nếu có.
              </p>

              {/* --- KHỐI CHỨA THÔNG TIN & ẢNH KHÓA HỌC --- */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                {/* --- CHÈN THÊM KHỐI ẢNH NÀY --- */}
                {thumbnailUrl && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4 border border-slate-100 shadow-inner">
                    <Image
                      src={thumbnailUrl}
                      alt="Course Thumbnail"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                {/* ------------------------------- */}

                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 block">
                  Khóa học
                </span>

                {/* SỬ DỤNG TÊN KHÓA HỌC ĐỘNG TỪ PROPS */}
                <p className="text-slate-800 font-semibold line-clamp-2">
                  {courseTitle || "Khóa học VocaSpace Premium"}
                </p>

                <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Truy
                    cập trọn đời
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Hệ
                    thống Flashcard FSRS
                  </div>
                </div>
              </div>
            </div>

            {/* Cột phải (Stage 1) */}
            <div className="w-full md:w-[55%] bg-white p-8 flex flex-col justify-center">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Mã giảm giá
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={couponLoading || isGenerating}
                  placeholder="Nhập mã (VD: VOCASPACE100)"
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || isGenerating || !couponCode}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors"
                >
                  {couponLoading ? "..." : "Áp dụng"}
                </button>
              </div>

              <div className="h-6">
                {errorMsg && (
                  <p className="text-sm text-rose-500 flex items-center gap-1">
                    <AlertCircle size={14} /> {errorMsg}
                  </p>
                )}
                {successMsg && (
                  <p className="text-sm text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 size={14} /> {successMsg}
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-slate-100 pt-6 space-y-3">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Giá khóa học</span>
                  <span>{coursePrice.toLocaleString()}đ</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-500 font-medium animate-in fade-in slide-in-from-top-2">
                    <span>Giảm giá</span>
                    <span>-{discountAmount.toLocaleString()}đ</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold text-xl pt-2 border-t border-slate-100">
                  <span>Thanh toán</span>
                  <span>{finalAmount.toLocaleString()}đ</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-4 italic">
                *Số tiền tính toán ở Client chỉ nhằm mục đích hiển thị trực
                quan. Backend sẽ đối soát độc lập.
              </p>

              <button
                onClick={handleProceedToPayment}
                disabled={isGenerating}
                className="w-full mt-4 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
              >
                {isGenerating ? (
                  <RefreshCw className="animate-spin" size={24} />
                ) : (
                  "TIẾN HÀNH THANH TOÁN"
                )}
              </button>
            </div>
          </div>

          {/* =======================================
              STAGE 2: QUÉT QR (Giữ nguyên code UI của bạn)
              ======================================= */}
          <div className="w-full shrink-0 flex flex-col md:flex-row">
            {/* PHẦN BÊN TRÁI: QR CODE */}
            <div className="w-full md:w-[45%] bg-linear-to-br from-blue-400 to-blue-600 p-8 flex flex-col items-center justify-center relative">
              <div className="text-white font-bold text-xl mb-6 tracking-wide drop-shadow-sm">
                QUÉT MÃ THANH TOÁN
              </div>
              <div className="relative mx-auto w-64 h-64 bg-white rounded-2xl shadow-xl p-3 overflow-hidden flex items-center justify-center">
                {isSuccess ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500 text-white z-20">
                    <Check size={56} className="mb-2 animate-bounce" />
                    <p className="font-bold text-lg">Thành công!</p>
                  </div>
                ) : isExpired ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 backdrop-blur-sm">
                    <p className="font-medium mb-3">Mã QR đã hết hạn</p>
                    <button
                      onClick={() => setTimeLeft(600)}
                      className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-full font-semibold hover:bg-blue-600 transition-colors"
                    >
                      <RefreshCw size={16} /> Làm mới
                    </button>
                  </div>
                ) : (
                  <>
                    {paymentData && (
                      <Image
                        src={paymentData.qrCodeUrl}
                        alt="QR Code"
                        fill
                        className="object-contain p-3 rounded-xl"
                      />
                    )}
                    <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                    <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_3px_rgba(96,165,250,0.7)] animate-[scan_2.5s_ease-in-out_infinite]" />
                  </>
                )}
              </div>
            </div>

            {/* PHẦN BÊN PHẢI: CHI TIẾT GIAO DỊCH */}
            <div className="w-full md:w-[55%] bg-white p-6 md:p-8 flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-slate-800 mb-6 hidden md:block">
                Thông đón đơn hàng
              </h3>
              {paymentData && (
                <div className="space-y-4 flex-1">
                  {[
                    {
                      label: "Số tài khoản ngân hàng",
                      value: paymentData.accountNumber,
                      field: "account",
                    },
                    {
                      label: "Số tiền thanh toán",
                      value: `${paymentData.amount.toLocaleString()} VNĐ`,
                      field: "amount",
                    },
                    {
                      label: "Nội dung chuyển khoản",
                      value: paymentData.bankMessage,
                      field: "message",
                    },
                  ].map((item) => (
                    <div key={item.field} className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-600 block">
                        {item.label}
                      </label>
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                        <div className="px-3 py-2 font-mono font-bold text-slate-800 text-lg truncate flex-1">
                          {item.value}
                        </div>
                        <button
                          onClick={() => handleCopy(item.value, item.field)}
                          disabled={isExpired || isSuccess}
                          className="m-1 p-2 bg-white border border-slate-200 rounded-lg text-blue-500 hover:text-white hover:bg-blue-500 hover:border-blue-500 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                          {copiedField === item.field ? (
                            <Check size={20} />
                          ) : (
                            <Copy size={20} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex gap-4 items-stretch">
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center py-3 shadow-inner">
                  <span
                    className={`font-mono text-3xl font-bold tracking-widest ${isExpired ? "text-slate-400" : "text-blue-600"}`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <button
                  onClick={handleCancelClick}
                  disabled={isCancelling || isSuccess}
                  className="flex-[1.2] bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
                >
                  {isCancelling ? "ĐANG HỦY..." : "HỦY THANH TOÁN"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
