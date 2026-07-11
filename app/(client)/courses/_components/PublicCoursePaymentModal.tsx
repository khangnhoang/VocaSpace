"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import {
  CheckoutResponse,
  PaymentRealtimePayload,
} from "@/lib/schemas/payment";
import { discountCouponSchema } from "@/lib/schemas/discount";
import {
  cancelCheckoutSession,
  checkPaymentStatus,
} from "@/app/actions/payment";
import { createClient } from "@/utils/supabase/client";
import PublicCoursePaymentStageDiscount from "./PublicCoursePaymentStageDiscount";
import PublicCoursePaymentStageQr from "./PublicCoursePaymentStageQr";
import { validateDiscountPreview } from "@/app/actions/discount";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: CheckoutResponse | null;
  paymentId: string | null;
  courseId: string;
  coursePrice: number;
  courseTitle?: string;
  thumbnailUrl?: string | null;
  onGeneratePayment: (couponCode?: string) => Promise<boolean>;
  onSuccess: () => void | Promise<void>;
}

type PublicCoursePaymentModalCloseButtonProps = {
  onClose: () => void;
};

export function PublicCoursePaymentModalCloseButton({
  onClose,
}: PublicCoursePaymentModalCloseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClose}
      aria-label="Đóng cửa sổ đăng ký"
      className="absolute right-4 top-4 z-20 text-slate-400 hover:text-slate-700"
    >
      <X aria-hidden="true" className="size-4" />
    </Button>
  );
}

export default function PublicCoursePaymentModal({
  isOpen,
  onClose,
  paymentData,
  paymentId,
  courseId,
  coursePrice,
  courseTitle,
  thumbnailUrl,
  onGeneratePayment,
  onSuccess,
}: PaymentModalProps) {
  // STATE CỦA STAGE 1 (DISCOUNT)
  const [stage, setStage] = useState<1 | 2>(1);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // STATE CỦA STAGE 2 (QR CODE - Giữ nguyên core flow)
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const successHandledRef = useRef(false);
  const submissionPendingRef = useRef(false);

  const finalAmount = Math.max(0, coursePrice - discountAmount);
  const isFreeCourse = coursePrice === 0;

  /* =========================================================
     LOGIC STAGE 1: ÁP MÃ & TẠO PHIÊN
     ========================================================= */

  const handleCouponChange = (value: string) => {
    const nextValue = value.toUpperCase();

    setCouponCode(nextValue);
    setAppliedCouponCode("");
    setDiscountAmount(0);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleApplyCoupon = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setCouponLoading(true);

    const validation = discountCouponSchema.safeParse({ code: couponCode });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0].message);
      setCouponLoading(false);
      return;
    }

    const normalizedCode = validation.data.code;
    setCouponCode(normalizedCode);

    try {
      const result = await validateDiscountPreview({
        courseId,
        code: normalizedCode,
      });

      if (
        result.error ||
        !result.success ||
        !result.discount ||
        !result.pricing
      ) {
        setErrorMsg(result.error || "Mã giảm giá không hợp lệ.");
        setSuccessMsg("");
        setAppliedCouponCode("");
        setDiscountAmount(0);
        setCouponLoading(false);
        return;
      }

      setSuccessMsg(result.message || "Áp dụng mã giảm giá thành công");
      setErrorMsg("");
      setAppliedCouponCode(result.discount.code);
      setDiscountAmount(result.pricing.discountAmount);
      setCouponLoading(false);
    } catch {
      setErrorMsg("Hệ thống gặp sự cố khi kiểm tra mã giảm giá.");
      setSuccessMsg("");
      setAppliedCouponCode("");
      setDiscountAmount(0);
      setCouponLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (submissionPendingRef.current) return;

    submissionPendingRef.current = true;
    setIsGenerating(true);

    // Chỉ gửi coupon đã apply thành công.
    // Nếu user chỉ nhập nhưng chưa bấm "Áp dụng", không gửi mã đó xuống checkout.
    try {
      const isPaymentCreated = await onGeneratePayment(
        isFreeCourse ? undefined : appliedCouponCode || undefined,
      );

      if (isPaymentCreated) {
        setStage(2);
      }
    } finally {
      submissionPendingRef.current = false;
      setIsGenerating(false);
    }
  };

  /* =========================================================
     LOGIC STAGE 2: Realtime & Polling
     ========================================================= */

  const handleSuccess = useCallback(() => {
    if (successHandledRef.current) return;

    successHandledRef.current = true;
    setIsSuccess(true);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

    setTimeout(() => void onSuccess(), 3500);
  }, [onSuccess]);

  useEffect(() => {
    if (!isOpen || isSuccess || stage !== 2 || !paymentData?.expiresAt) return;

    const updateTimeLeft = () => {
      const expiresAtMs = new Date(paymentData.expiresAt).getTime();

      if (Number.isNaN(expiresAtMs)) {
        setTimeLeft(0);
        return;
      }

      const nextTimeLeft = Math.max(
        0,
        Math.ceil((expiresAtMs - Date.now()) / 1000),
      );

      setTimeLeft(nextTimeLeft);
    };

    updateTimeLeft();

    const timer = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isSuccess, stage, paymentData?.expiresAt]);

  useEffect(() => {
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
          if (payload.new && payload.new.status === "paid") {
            handleSuccess();
          }
        },
      )
      .subscribe();

    const pollingInterval = setInterval(async () => {
      try {
        const res = await checkPaymentStatus(paymentId);

        if (res && res.status === "paid") {
          handleSuccess();
        }
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

  const handleCloseModal = () => onClose();

  // SOP RULE: Bấm Hủy Thanh Toán thì hủy đơn server-side và RESET VỀ STAGE 1.
  const handleCancelClick = async () => {
    if (!paymentId || isCancelling) return;

    setIsCancelling(true);

    try {
      const res = await cancelCheckoutSession(paymentId);

      if (res.error) {
        toast.error(res.error);
        setIsCancelling(false);
        return;
      }

      setIsCancelling(false);
      toast.success("Đã hủy phiên thanh toán.");

      setStage(1);
      setCouponCode("");
      setAppliedCouponCode("");
      setDiscountAmount(0);
      setErrorMsg("");
      setSuccessMsg("");
      setTimeLeft(0);
      setIsSuccess(false);
      successHandledRef.current = false;

      onClose();
    } catch {
      toast.error("Sự cố kết nối máy chủ.");  
      setIsCancelling(false);
    }
  };

  const isExpired = timeLeft <= 0;

  return (
    <div
      role="dialog"
      aria-modal={isOpen ? true : undefined}
      aria-label={
        isFreeCourse
          ? "Đăng ký khóa học miễn phí"
          : "Đăng ký và thanh toán khóa học"
      }
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.55),rgba(15,23,42,0.78))]"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative overflow-hidden">
        <PublicCoursePaymentModalCloseButton onClose={handleCloseModal} />

        <div
          className="flex w-full transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(${stage === 1 ? "0%" : "-100%"})` }}
        >
          <div
            className="w-full shrink-0"
            aria-hidden={stage !== 1}
            inert={stage !== 1}
          >
            <PublicCoursePaymentStageDiscount
              coursePrice={coursePrice}
              courseTitle={courseTitle}
              thumbnailUrl={thumbnailUrl}
              couponCode={couponCode}
              discountAmount={discountAmount}
              finalAmount={finalAmount}
              couponLoading={couponLoading}
              isGenerating={isGenerating}
              errorMsg={errorMsg}
              successMsg={successMsg}
              onCouponChange={handleCouponChange}
              onApplyCoupon={handleApplyCoupon}
              onProceedToPayment={handleProceedToPayment}
            />
          </div>

          {!isFreeCourse && (
            <div
              className="w-full shrink-0"
              aria-hidden={stage !== 2}
              inert={stage !== 2}
            >
              <PublicCoursePaymentStageQr
                paymentData={paymentData}
                timeLeft={timeLeft}
                copiedField={copiedField}
                isSuccess={isSuccess}
                isExpired={isExpired}
                isCancelling={isCancelling}
                formatTime={formatTime}
                onCopy={handleCopy}
                onCancelPayment={handleCancelClick}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
