"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
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

const EASE = [0.2, 0, 0, 1] as const;

export type PublicCourseContentSummary = {
  chapterCount: number;
  topicCount: number;
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: CheckoutResponse | null;
  paymentId: string | null;
  courseId: string;
  coursePrice: number;
  courseTitle?: string;
  thumbnailUrl?: string | null;
  contentSummary?: PublicCourseContentSummary;
  onGeneratePayment: (couponCode?: string) => Promise<boolean>;
  onSuccess: () => void | Promise<void>;
  // FEAT6 AC11: mở thẳng bước QR khi đã có sẵn phiên thanh toán (chỉ đọc lúc mount); bước đếm ngược dùng lại nguyên cách cũ.
  openAtQr?: boolean;
}

type PublicCoursePaymentModalCloseButtonProps = {
  onClose: () => void;
  disabled?: boolean;
};

export function PublicCoursePaymentModalCloseButton({
  onClose,
  disabled = false,
}: PublicCoursePaymentModalCloseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClose}
      disabled={disabled}
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
  contentSummary,
  onGeneratePayment,
  onSuccess,
  openAtQr = false,
}: PaymentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const portalTarget = useSyncExternalStore(
    subscribeToNothing,
    () => document.body,
    () => null,
  );
  // STATE CỦA STAGE 1 (DISCOUNT)
  const [stage, setStage] = useState<1 | 2>(openAtQr && paymentData ? 2 : 1);
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
  // Đang tạo đơn/đăng ký hoặc đang hủy đơn thì không cho đóng, để kết quả của yêu cầu đang chạy không bị bỏ dở (U4 AC2).
  const isBusy = isGenerating || isCancelling;

  useDialogFocus({ isOpen, panelRef, onEscape: isBusy ? undefined : handleCloseModal });

  const dialog = (
    <m.div
      role="dialog"
      aria-modal={isOpen ? true : undefined}
      aria-label={
        isFreeCourse
          ? "Đăng ký khóa học miễn phí"
          : "Đăng ký và thanh toán khóa học"
      }
      aria-hidden={!isOpen}
      inert={!isOpen}
      initial={false}
      animate={{ opacity: isOpen ? 1 : 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.55),rgba(15,23,42,0.78))] p-4 ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <m.div
        ref={panelRef}
        initial={false}
        animate={{ scale: isOpen ? 1 : 0.96 }}
        transition={{ duration: 0.28, ease: EASE }}
        className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-2xl ${
          isFreeCourse ? "max-w-lg" : "max-w-4xl"
        }`}
      >
        <PublicCoursePaymentModalCloseButton onClose={handleCloseModal} disabled={isBusy} />

        <m.div
          className="flex w-full"
          initial={false}
          animate={{ x: stage === 1 ? "0%" : "-100%" }}
          transition={{ duration: 0.42, ease: EASE }}
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
              contentSummary={contentSummary}
              onDismiss={handleCloseModal}
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
        </m.div>
      </m.div>
    </m.div>
  );

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        {/* U4 AC1: sau khi hydrate, hộp thoại ra thẳng `document.body`. Nếu ở lại trong cột `lg:sticky` của trang chi tiết thì
            nó bị nhốt trong stacking context của cột đó, và phần tử `relative` nằm sau trong DOM (ảnh giảng viên) vẽ đè lên lớp phủ. */}
        {portalTarget ? createPortal(dialog, portalTarget) : dialog}
      </MotionConfig>
    </LazyMotion>
  );
}

const subscribeToNothing = () => () => {};

/**
 * Giữ focus trong hộp thoại khi mở (U4 AC2): đưa focus vào phần tử thao tác được đầu tiên của bước hiện tại, Tab và
 * Shift+Tab xoay vòng trong hộp thoại, Esc đóng khi được phép, và khi đóng thì trả focus về nút đã mở hộp thoại.
 * Phần tử nằm trong bước bị `inert` không được tính.
 */
function useDialogFocus({
  isOpen,
  panelRef,
  onEscape,
}: {
  isOpen: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  onEscape?: () => void;
}) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.closest("[inert]"));
    const primary = panel.querySelector<HTMLElement>("[data-dialog-initial-focus]");
    (primary && !primary.closest("[inert]") ? primary : focusables()[0])?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!onEscapeRef.current) return;
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Sau khi chuyển bước, nút vừa bấm nằm trong bước đã bị `inert` nên focus rơi ra ngoài; Tab kéo nó về lại hộp thoại.
      if (!items.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen, panelRef]);
}
