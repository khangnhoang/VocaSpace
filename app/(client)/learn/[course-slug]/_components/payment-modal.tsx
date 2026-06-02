"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Copy, Check, RefreshCw, X } from "lucide-react";
import {
  CheckoutResponse,
  PaymentRealtimePayload,
} from "@/lib/schemas/payment";
import confetti from "canvas-confetti";
import {
  cancelCheckoutSession,
  checkPaymentStatus,
} from "@/app/actions/payment";
import { createClient } from "@/utils/supabase/client"; //

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: CheckoutResponse | null;
  paymentId: string | null;
  onSuccess: () => void | Promise<void>;
}

export default function PaymentModal({
  isOpen,
  onClose,
  paymentData,
  paymentId,
  onSuccess,
}: PaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const successHandledRef = useRef(false);

  const handleSuccess = useCallback(() => {
    if (successHandledRef.current) return;
    successHandledRef.current = true;

    setIsSuccess(true);

    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    setTimeout(() => {
      void onSuccess();
    }, 3500);
  }, [onSuccess]);

  // Bộ đếm ngược thời gian độc lập
  useEffect(() => {
    if (!isOpen || isSuccess || timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, isSuccess, timeLeft]);

  // Bộ lắng nghe Realtime và Polling dự phòng
  useEffect(() => {
    if (!isOpen || !paymentId || isSuccess) return;

    const supabase = createClient();

    // Khởi tạo kênh Realtime
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
          if (payload.new && payload.new.status === "paid") {
            handleSuccess();
          }
        },
      )
      .subscribe();

    // Cơ chế Polling 10s dự phòng
    const pollingInterval = setInterval(async () => {
      try {
        const res = await checkPaymentStatus(paymentId);
        if (res && res.status === "paid") {
          handleSuccess();
        }
      } catch (error) {
        console.error("🚨 [PAYMENT_POLLING_ERROR]:", error);
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [isOpen, paymentId, isSuccess, handleSuccess]); // Đã điền đầy đủ dependency bao gồm handleSuccess theo luật ESLint

  const handleCloseModal = () => {
    setIsSuccess(false);
    setTimeLeft(600);
    onClose();
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
      handleCloseModal();
    } catch {
      alert("Gặp sự cố khi kết nối lệnh hủy với máy chủ.");
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors z-20"
        >
          <X size={20} />
        </button>

        {/* PHẦN BÊN TRÁI: QR CODE */}
        <div className="w-full md:w-[45%] bg-gradient-to-br from-blue-400 to-blue-600 p-8 flex flex-col items-center justify-center relative">
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
                <Image
                  src={paymentData.qrCodeUrl}
                  alt="QR Code"
                  fill
                  className="object-contain p-3 rounded-xl"
                />
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
            Thông tin đơn hàng
          </h3>

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
