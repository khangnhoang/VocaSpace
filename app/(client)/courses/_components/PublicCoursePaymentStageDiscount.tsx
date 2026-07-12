"use client";

import Image from "next/image";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface PaymentStageDiscountProps {
  coursePrice: number;
  courseTitle?: string;
  thumbnailUrl?: string | null;
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

  return (
    <div className="w-full shrink-0 flex flex-col md:flex-row bg-slate-50">
      <div className="w-full md:w-[45%] bg-slate-100 p-8 flex flex-col justify-center border-r border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Xác nhận đăng ký
        </h2>

        <p className="text-slate-500 mb-6 text-sm">
          {isFreeCourse
            ? "Xác nhận khóa học trước khi đăng ký miễn phí."
            : "Vui lòng kiểm tra lại thông tin và áp dụng ưu đãi nếu có."}
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
        {isFreeCourse ? (
          <>
            <p className="text-sm font-semibold text-slate-600">Học phí</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">
              Miễn phí
            </p>
            <button
              type="button"
              onClick={onProceedToPayment}
              disabled={isGenerating}
              className="mt-6 flex w-full cursor-pointer items-center justify-center rounded-xl bg-blue-500 py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-blue-500"
            >
              {isGenerating ? "Đang đăng ký..." : "Đăng ký miễn phí"}
            </button>
          </>
        ) : (
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
        )}
      </div>
    </div>
  );
}
