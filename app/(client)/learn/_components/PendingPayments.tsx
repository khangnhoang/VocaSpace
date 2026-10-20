"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectNearestPendingPayment } from "@/lib/learn-dashboard";
import { canContinuePayment, formatPaymentDate } from "@/lib/payment-history-format";
import { getResumePaymentPath } from "@/lib/public-courses/routes";
import type { PendingPaymentSummary } from "@/lib/schemas/learn-dashboard";

const CARD_CLASS =
  "rounded-[20px] border border-blue-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] lg:p-6";

/**
 * FEAT6 AC8: thẻ gọn cho khoản thanh toán đang chờ. Chỉ hiện khoản có hạn gần nhất trong các khoản chưa ẩn;
 * các khoản còn lại gom thành một dòng dẫn tới lịch sử trong hồ sơ. Không có khoản nào thì không render gì.
 */
export function PendingPaymentCard({
  onDismiss,
  payments,
}: {
  onDismiss: (paymentId: string) => void;
  payments: PendingPaymentSummary[];
}) {
  // Mốc "bây giờ" chốt một lần khi thẻ mount để quyết định hiện link tiếp tục mà không gọi đồng hồ ở mỗi lần render.
  const [now] = useState(() => Date.now());
  const payment = selectNearestPendingPayment(payments);
  if (!payment) return null;

  // AC11: chỉ khoản `pending` còn hạn mới có mã QR để mở; `creating` hoặc đã quá hạn chỉ hiện thông tin.
  const canContinue = canContinuePayment(payment, now);

  const deadline = payment.expiresAt ? formatPaymentDate(payment.expiresAt) : null;
  const otherCount = payments.length - 1;

  return (
    <section aria-label="Thanh toán cần xử lý" className={CARD_CLASS}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-2 size-2 shrink-0 rounded-full bg-attention"
        />
        <div className="min-w-0 flex-1">
          <h2
            title={payment.courseTitle}
            className="truncate text-base font-bold text-slate-950"
          >
            {payment.courseTitle}
          </h2>
          {deadline && (
            <p className="mt-0.5 text-xs leading-5 text-slate-600">
              Hạn {deadline}
            </p>
          )}
          {canContinue && (
            <Link
              href={getResumePaymentPath(payment.courseSlug)}
              aria-label={`Tiếp tục thanh toán cho ${payment.courseTitle}`}
              className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-route underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 [@media(hover:hover)_and_(pointer:fine)]:min-h-9"
            >
              Tiếp tục thanh toán
            </Link>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Ẩn nhắc nhở này: ${payment.courseTitle}`}
          onClick={() => onDismiss(payment.paymentId)}
          className="-mr-2 -mt-2 shrink-0"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {otherCount > 0 && (
        <Link
          href="/profile?tab=payments"
          className="mt-3 flex min-h-11 items-center border-t border-slate-100 pt-3 text-xs font-bold text-route underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 [@media(hover:hover)_and_(pointer:fine)]:min-h-9"
        >
          {`+${otherCount} khoản khác · Xem trong hồ sơ`}
        </Link>
      )}
    </section>
  );
}
