"use client";

import Image from "next/image";
import { AlertCircle, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCourseContentSummary } from "./PublicCoursePaymentModal";

interface PaymentStageDiscountProps {
  coursePrice: number;
  courseTitle?: string;
  thumbnailUrl?: string | null;
  contentSummary?: PublicCourseContentSummary;
  // Nút "Để sau" của hộp thoại miễn phí đóng hộp thoại, giống nút X.
  onDismiss?: () => void;
  couponCode: string;
  discountAmount: number;
  finalAmount: number;
  couponLoading: boolean;
  isGenerating: boolean;
  errorMsg: string;
  successMsg: string;
  onCouponChange: (value: string) => void;
  onApplyCoupon: () => void;
  onProceedToPayment: () => void;
}

export default function PublicCoursePaymentStageDiscount({
  coursePrice,
  courseTitle,
  thumbnailUrl,
  contentSummary,
  onDismiss,
  couponCode,
  discountAmount,
  finalAmount,
  couponLoading,
  isGenerating,
  errorMsg,
  successMsg,
  onCouponChange,
  onApplyCoupon,
  onProceedToPayment,
}: PaymentStageDiscountProps) {
  const isFreeCourse = coursePrice === 0;

  if (isFreeCourse) {
    return (
      <FreeEnrollmentStage
        courseTitle={courseTitle}
        thumbnailUrl={thumbnailUrl}
        contentSummary={contentSummary}
        isGenerating={isGenerating}
        onDismiss={onDismiss}
        onEnroll={onProceedToPayment}
      />
    );
  }

  return (
    <div className="w-full shrink-0 flex flex-col md:flex-row bg-slate-50">
      <div className="w-full md:w-[45%] bg-slate-100 p-8 flex flex-col justify-center border-r border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Xác nhận đăng ký
        </h2>

        <p className="text-slate-500 mb-6 text-sm">
          Vui lòng kiểm tra lại thông tin và áp dụng ưu đãi nếu có.
        </p>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
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

          <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1 block">
            Khóa học
          </span>

          <p className="text-slate-800 font-semibold line-clamp-2">
            {courseTitle || "Khóa học VocaSpace Premium"}
          </p>

          <div className="mt-3 space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Truy cập trọn đời
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Hệ thống Flashcard FSRS
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-[55%] bg-white p-8 flex flex-col justify-center">
        <>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Mã giảm giá
            </label>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => onCouponChange(e.target.value)}
                disabled={couponLoading || isGenerating}
                placeholder="Nhập mã (VD: VOCASPACE100)"
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />

              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={couponLoading || isGenerating || !couponCode.trim()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-800"
              >
                {couponLoading ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  "Áp dụng"
                )}
              </button>
            </div>

            <div className="h-6">
              {errorMsg && (
                <p className="text-sm text-rose-500 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errorMsg}
                </p>
              )}

              {successMsg && (
                <p className="text-sm text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={14} />
                  {successMsg}
                </p>
              )}
            </div>

            <div className="mt-6 pt-6 space-y-3">
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

              <div className="flex justify-between text-slate-900 font-bold text-xl pt-2">
                <span>Thanh toán</span>
                <span>{finalAmount.toLocaleString()}đ</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 italic">
              *Số tiền tính toán ở Client chỉ nhằm mục đích hiển thị trực quan.
              Backend sẽ đối soát độc lập.
            </p>

            <button
              type="button"
              onClick={onProceedToPayment}
              disabled={isGenerating || couponLoading}
              className="w-full mt-4 py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-blue-500"
            >
              {isGenerating ? (
                <RefreshCw className="animate-spin" size={24} />
              ) : (
                "TIẾN HÀNH THANH TOÁN"
              )}
            </button>
        </>
      </div>
    </div>
  );
}

/**
 * U4 AC3: hộp thoại đăng ký khóa miễn phí là một cột gọn (khóa học, nội dung, quyền lợi, học phí, hai nút) thay vì bố cục
 * hai cột của khóa trả phí, vốn để trống nửa bên phải khi không có mã giảm giá hay số tiền.
 */
function FreeEnrollmentStage({
  courseTitle,
  thumbnailUrl,
  contentSummary,
  isGenerating,
  onDismiss,
  onEnroll,
}: {
  courseTitle?: string;
  thumbnailUrl?: string | null;
  contentSummary?: PublicCourseContentSummary;
  isGenerating: boolean;
  onDismiss?: () => void;
  onEnroll: () => void;
}) {
  return (
    <div className="w-full p-6 sm:p-8">
      <h2 className="pr-10 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
        Đăng ký khóa học miễn phí
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">
        Đăng ký xong là bạn có thể bắt đầu học ngay.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-route-quiet sm:w-28">
          {thumbnailUrl ? (
            <Image src={thumbnailUrl} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            <BookOpen aria-hidden="true" className="absolute inset-0 m-auto size-6 text-route" />
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 break-words font-bold leading-snug text-slate-900">
            {courseTitle || "Khóa học VocaSpace"}
          </p>
          {contentSummary && contentSummary.chapterCount > 0 && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {contentSummary.chapterCount} chương · {contentSummary.topicCount} chủ đề
            </p>
          )}
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {["Truy cập trọn đời", "Hệ thống Flashcard FSRS"].map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5 text-sm text-slate-700">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-growth" />
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-baseline justify-between border-t border-slate-100 pt-5">
        <span className="text-sm font-semibold text-slate-600">Học phí</span>
        <span className="text-2xl font-extrabold text-growth">Miễn phí</span>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={onEnroll}
          disabled={isGenerating}
          data-dialog-initial-focus=""
        >
          {isGenerating ? "Đang đăng ký..." : "Đăng ký miễn phí"}
        </Button>
        <Button type="button" variant="ghost" className="w-full text-slate-600" onClick={onDismiss} disabled={isGenerating}>
          Để sau
        </Button>
      </div>
    </div>
  );
}
