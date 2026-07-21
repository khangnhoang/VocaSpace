"use client";

import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { PendingPaymentSummary } from "@/lib/schemas/learn-dashboard";
import { cn } from "@/lib/utils";
import { getPaymentPreviewLimit } from "./learning-dashboard-state";

function formatPaymentDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function PaymentRow({
  payment,
  onDismiss,
  surface = "panel",
}: {
  payment: PendingPaymentSummary;
  onDismiss: (paymentId: string) => void;
  surface?: "panel" | "preview";
}) {
  const deadline = payment.expiresAt
    ? formatPaymentDeadline(payment.expiresAt)
    : null;
  const statusLabel =
    payment.status === "creating"
      ? "Đang tạo thanh toán"
      : "Đang chờ thanh toán";

  return (
    <article
      className={cn(
        "grid min-h-30 min-w-0 grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 p-3 sm:grid-cols-[24px_minmax(0,1fr)_auto] sm:items-center sm:p-4",
        surface === "preview" ? "bg-transparent" : "bg-white",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-amber-700">
        <span aria-hidden="true">!</span>
        <span className="sr-only">Cần xử lý</span>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 wrap-break-word text-sm font-bold leading-5 text-slate-950 sm:text-base sm:leading-6">
          {payment.courseTitle}
        </h3>
        <p className="mt-1 text-xs leading-4.5 text-amber-700">
          {statusLabel}
        </p>
        {deadline && (
          <p className="mt-0.5 text-xs leading-4.5 text-slate-600">
            Hạn {deadline}
          </p>
        )}
      </div>
      <div className="col-start-2 flex shrink-0 items-center gap-2 sm:col-start-3 sm:row-start-1">
        <Link
          href={`/courses/${payment.courseSlug}`}
          aria-label={`Tiếp tục thanh toán cho ${payment.courseTitle}`}
          className="inline-flex min-h-11 min-w-34.5 items-center justify-center rounded-xl bg-amber-700 px-3 text-xs font-bold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
        >
          Tiếp tục thanh toán
        </Link>
        <button
          type="button"
          aria-label={`Ẩn nhắc nhở này: ${payment.courseTitle}`}
          onClick={() => onDismiss(payment.paymentId)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  );
}

export function PendingPaymentPreview({
  isDesktop,
  onDismiss,
  payments,
}: {
  isDesktop: boolean;
  onDismiss: (paymentId: string) => void;
  payments: PendingPaymentSummary[];
}) {
  if (payments.length === 0) return null;

  const previewLimit = getPaymentPreviewLimit(isDesktop);
  const previewPayments = payments.slice(0, previewLimit);
  const hasMore = payments.length > previewLimit;

  return (
    <section aria-labelledby="pending-payments-title" className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle aria-hidden="true" className="size-5 text-amber-700" />
        <div className="min-w-0">
          <h2
            id="pending-payments-title"
            className="text-lg font-bold text-slate-950"
          >
            Thanh toán cần xử lý
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Hoàn tất đăng ký khóa học còn đang chờ.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[20px] border border-amber-200 bg-amber-50/70 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="divide-y divide-amber-200">
          {previewPayments.map((payment) => (
            <PaymentRow
              key={payment.paymentId}
              payment={payment}
              onDismiss={onDismiss}
              surface="preview"
            />
          ))}
        </div>
        {hasMore && (
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center border-t border-amber-200 px-4 text-sm font-bold text-amber-900 transition hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-700"
            >
              Xem tất cả {payments.length} khoản thanh toán
            </button>
          </SheetTrigger>
        )}
      </div>
    </section>
  );
}

export function PendingPaymentsPanel({
  onDismiss,
  payments,
}: {
  onDismiss: (paymentId: string) => void;
  payments: PendingPaymentSummary[];
}) {
  return (
    <SheetContent
      side="right"
      showCloseButton={false}
      className="h-dvh! w-screen! max-w-none! gap-0 overflow-hidden border-0 bg-white p-0 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.24)] md:w-105! md:max-w-105! lg:w-120! lg:max-w-120!"
    >
      <SheetHeader className="relative min-h-26 shrink-0 justify-center border-b border-amber-200 bg-amber-50 px-5 py-5 pr-20 lg:min-h-30 lg:px-6">
        <SheetTitle className="text-xl font-bold leading-7 text-amber-900 lg:text-2xl lg:leading-8">
          Thanh toán đang chờ
        </SheetTitle>
        <SheetDescription className="text-xs leading-4.5 text-amber-900">
          {payments.length} khoản · Giữ nguyên thứ tự hiện tại
        </SheetDescription>
        <SheetClose asChild>
          <button
            type="button"
            aria-label="Đóng danh sách thanh toán"
            className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:right-6 lg:top-6"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </SheetClose>
      </SheetHeader>

      <div
        data-testid="pending-payments-scroll-area"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-4 md:p-5"
      >
        <div className="divide-y divide-slate-200">
          {payments.map((payment) => (
            <PaymentRow
              key={payment.paymentId}
              payment={payment}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </div>

      <SheetFooter className="min-h-18 shrink-0 justify-center border-t border-slate-200 bg-white px-5 py-4">
        <p className="text-xs leading-4.5 text-slate-600">
          Ẩn nhắc nhở không hủy thanh toán · Danh sách cuộn bên trong
        </p>
      </SheetFooter>
    </SheetContent>
  );
}
