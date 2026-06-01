"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Copy, Check, RefreshCw, X, Bug } from "lucide-react";
import { CheckoutResponse } from "@/lib/schemas/payment";
import confetti from "canvas-confetti";
import { cancelCheckoutSession } from "@/app/actions/payment";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: CheckoutResponse | null;
  paymentId: string | null;
  onRefresh: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  paymentData,
  paymentId,
  onRefresh,
}: PaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 phút = 600s
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Xử lý đếm ngược
  useEffect(() => {
    if (!isOpen || isSuccess || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, isSuccess, timeLeft]);

  // Reset state mỗi khi mở lại modal
  const handleCloseModal = () => {
    // Reset lại state trước khi đóng
    setIsSuccess(false);
    setTimeLeft(600);
    // Gọi hàm onClose từ component cha truyền vào
    onClose();
  };

  const handleSuccess = () => {
    setIsSuccess(true);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => {
      onClose();
    }, 4000);
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!isOpen || !paymentData) return null;

  const isExpired = timeLeft <= 0;

  // 🔥 LOGIC SỬ LÝ HỦY ĐƠN
  const handleCancelClick = async () => {
    if (paymentId || isCancelling) return;

    setIsCancelling(true);
    try {
      const res = await cancelCheckoutSession(paymentId!);
      if (res.error) {
        alert(res.error);
        return;
      }
      // Hủy thành công dưới DB thì đóng luôn modal giải phóng giao diện
      handleCloseModal(); //
    } catch (err) {
      alert("Gặp sự cố khi kết nối lệnh hủy với máy chủ.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
      {/* Container Modal: Sử dụng flex-col trên mobile và md:flex-row trên Desktop 
        Tối đa chiều rộng max-w-4xl để hiển thị ngang vừa vặn
      */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        {/* Nút Đóng (Góc trên cùng bên phải của thẻ) */}
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-20"
        >
          <X size={20} />
        </button>

        {/* ================= PHẦN BÊN TRÁI: QR CODE (NỀN BLUE) ================= */}
        <div className="w-full md:w-[45%] bg-gradient-to-br from-blue-400 to-blue-600 p-8 flex flex-col items-center justify-center relative">
          {/* Nút Test (Dev Mode) */}
          {!isSuccess && (
            <button
              onClick={handleSuccess}
              className="absolute top-4 left-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
              title="Dev Mode: Bấm để test Success"
            >
              <Bug size={20} />
            </button>
          )}

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
                  onClick={() => {
                    setTimeLeft(600);
                    onRefresh();
                  }}
                  className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-full font-semibold hover:bg-blue-600 transition-colors"
                >
                  <RefreshCw size={16} /> Làm mới
                </button>
              </div>
            ) : (
              <>
                <Image
                  src={paymentData.qrCodeUrl}
                  alt="QR Code"
                  fill
                  className="object-contain p-3 rounded-xl"
                />
                {/* Viền bo góc vuông (Scan Brackets) */}
                <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

                {/* Hiệu ứng tia quét */}
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_3px_rgba(96,165,250,0.7)] animate-[scan_2.5s_ease-in-out_infinite]" />
              </>
            )}
          </div>
        </div>

        {/* ================= PHẦN BÊN PHẢI: CHI TIẾT GIAO DỊCH (NỀN TRẮNG) ================= */}
        <div className="w-full md:w-[55%] bg-white p-6 md:p-8 flex flex-col justify-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-6 hidden md:block">
            Thông tin đơn hàng
          </h3>

          <div className="space-y-4 flex-1">
            {/* Lặp các ô thông tin theo đúng chuẩn Design (Tiêu đề trên, Box input dưới) */}
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
                    className="m-1 p-2 bg-white border border-slate-200 rounded-lg text-blue-500 hover:text-white hover:bg-blue-500 hover:border-blue-500 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-blue-500"
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

          {/* Dòng Timer và Nút Hủy ở dưới cùng */}
          <div className="mt-8 flex gap-4 items-stretch">
            {/* Bộ đếm giờ */}
            <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center py-3 shadow-inner">
              <span
                className={`font-mono text-3xl font-bold tracking-widest ${isExpired ? "text-slate-400" : "text-blue-600"}`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Nút Hủy Thanh Toán */}
            <button
              onClick={handleCancelClick}
              disabled={isCancelling || isSuccess}
              className="flex-[1.2] bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCancelling ? "ĐANG HỦY ĐƠN..." : "HỦY THANH TOÁN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
