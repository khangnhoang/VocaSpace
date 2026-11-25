// app/(client)/profile/_components/payment-history.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ReceiptText } from "lucide-react";
import { getPaymentHistory } from "@/app/actions/payment-history";
import { Button } from "@/components/ui/button";
import { getResumePaymentPath } from "@/lib/public-courses/routes";
import type { Locale } from "@/lib/i18n/config";
import { formatVnd } from "@/lib/i18n/format";
import {
  canContinuePayment,
  formatPaymentDateIn,
  formatPaymentDateTimeIn,
  hasLivePaymentDeadline,
} from "@/lib/payment-history-format";
import type {
  PaymentHistoryData,
  PaymentHistoryFilter,
  PaymentHistoryItem,
} from "@/lib/schemas/payment-history";
import { cn } from "@/lib/utils";

const FILTERS: PaymentHistoryFilter[] = ["all", "paid", "pending", "other"];

const STATUS_BADGE_CLASS: Record<PaymentHistoryItem["status"], string> = {
  paid: "border-growth-line bg-growth-quiet text-growth",
  pending: "border-attention-line bg-attention-quiet text-attention",
  creating: "border-attention-line bg-attention-quiet text-attention",
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  expired: "border-slate-200 bg-slate-100 text-slate-700",
  failed: "border-correction-line bg-correction-quiet text-correction",
};

const touchButtonClass =
  "h-11 [@media(hover:hover)_and_(pointer:fine)]:h-9";

type Target = { filter: PaymentHistoryFilter; page: number };

// `settledTarget` là yêu cầu mới nhất đã có kết quả. `data` giữ trang đọc thành công gần nhất để danh sách không trống
// trong lúc trang mới đang tải; `readAt` là lúc đọc đó, dùng để xét "còn hạn" mà không gọi đồng hồ khi render.
type HistoryState = {
  settledTarget: Target | null;
  data: PaymentHistoryData | null;
  readAt: number;
  failed: boolean;
};

export function PaymentHistorySkeleton() {
  const t = useTranslations("payments");
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{t("history.loading")}</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function PaymentRow({
  item,
  readAt,
}: {
  item: PaymentHistoryItem;
  readAt: number;
}) {
  const t = useTranslations("payments");
  const locale = useLocale() as Locale;
  const createdAt = formatPaymentDateTimeIn(locale, item.createdAt);
  const canContinue = canContinuePayment(item, readAt);
  const deadline =
    hasLivePaymentDeadline(item, readAt) && item.expiresAt
      ? formatPaymentDateIn(locale, item.expiresAt)
      : null;

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.course ? (
            // AC9: link là phần tử inline trong khối line-clamp; hover chỉ đổi màu chữ, không gạch chân; focus bàn phím giữ vòng focus.
            <p className="line-clamp-2 wrap-break-word text-sm font-bold leading-5">
              <Link
                href={`/courses/${item.course.slug}`}
                className="text-slate-950 hover:text-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
              >
                {item.course.title}
              </Link>
            </p>
          ) : item.hiddenCourseTitle ? (
            // AC10: học viên không còn đọc được khóa học nhưng vẫn thấy tên khóa đã mua; chữ thường, không link.
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="line-clamp-2 wrap-break-word text-sm font-bold leading-5 text-slate-950">
                {item.hiddenCourseTitle}
              </p>
              <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {t("history.unavailableBadge")}
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold leading-5 text-slate-500">
              {t("history.courseUnavailable")}
            </p>
          )}
          <p className="mt-1 break-all text-xs leading-5 text-slate-600">
            {createdAt ? `${createdAt} · ` : ""}
            {t("history.orderCode", { code: item.orderCode })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold leading-5 text-slate-950">
            {formatVnd(locale, item.amountFinal)}
          </p>
          {item.amountDiscount > 0 && (
            <p className="mt-0.5 text-xs leading-5 text-growth">
              {t("history.discount", { amount: formatVnd(locale, item.amountDiscount) })}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
            STATUS_BADGE_CLASS[item.status],
          )}
        >
          {t(`status.${item.status}`)}
        </span>
        {deadline && (
          <span className="text-xs leading-5 text-slate-600">
            {t("deadline", { date: deadline })}
          </span>
        )}
        {canContinue && item.course && (
          <Link
            href={getResumePaymentPath(item.course.slug)}
            className="text-xs font-bold text-route underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2"
          >
            {t("continue")}
          </Link>
        )}
      </div>
    </li>
  );
}

export default function PaymentHistory() {
  const t = useTranslations("payments");
  const [target, setTarget] = useState<Target>({ filter: "all", page: 1 });
  const [state, setState] = useState<HistoryState>({
    settledTarget: null,
    data: null,
    readAt: 0,
    failed: false,
  });

  // Mỗi lần effect chạy là một yêu cầu; cleanup đánh dấu nó đã cũ nên phản hồi chậm của lọc/trang trước không ghi đè danh sách (G6).
  useEffect(() => {
    let isCurrent = true;
    getPaymentHistory({ filter: target.filter, page: target.page })
      .then((result) => (result.success ? result.data : null))
      .catch(() => null)
      .then((data) => {
        if (!isCurrent) return;
        const readAt = Date.now();
        setState((previous) =>
          data
            ? { settledTarget: target, data, readAt, failed: false }
            : { ...previous, settledTarget: target, failed: true },
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [target]);

  const isLoading = state.settledTarget !== target;
  const { data } = state;
  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  // Khi chưa có kết quả cho yêu cầu hiện tại, trang đích là cơ sở để bấm tiếp, nên "Sau" rồi "Trước" thật nhanh vẫn đi đúng hướng.
  const basePage = isLoading ? target.page : (data?.page ?? target.page);
  const showError = !isLoading && state.failed;
  const showPager = !showError && data !== null && data.total > data.pageSize;

  const selectFilter = (filter: PaymentHistoryFilter) => {
    if (filter === target.filter) return;
    setTarget({ filter, page: 1 });
  };
  const goToPage = (page: number) => setTarget({ filter: target.filter, page });

  return (
    <section aria-labelledby="payment-history-title" className="min-w-0">
      <h2
        id="payment-history-title"
        className="text-lg font-bold leading-7 text-slate-950"
      >
        {t("history.title")}
      </h2>

      <div
        role="group"
        aria-label={t("history.filterLabel")}
        className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
      >
        {FILTERS.map((filter) => {
          const isActive = target.filter === filter;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={isActive}
              onClick={() => selectFilter(filter)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 [@media(hover:hover)_and_(pointer:fine)]:min-h-9",
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50",
              )}
            >
              {t(`history.filters.${filter}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-2" aria-busy={isLoading}>
        {showError ? (
          <div
            role="status"
            className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center"
          >
            <p className="text-sm font-semibold text-slate-700">
              {t("history.errorTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {t("history.errorBody")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget({ ...target })}
              className={cn("mt-4", touchButtonClass)}
            >
              {t("history.retry")}
            </Button>
          </div>
        ) : data === null ? (
          <PaymentHistorySkeleton />
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
            <ReceiptText
              aria-hidden="true"
              className="size-8 text-slate-400"
            />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {target.filter === "all"
                ? t("history.emptyAll")
                : t("history.emptyFilter")}
            </p>
          </div>
        ) : (
          <ul
            className={cn(
              "divide-y divide-slate-100 transition-opacity motion-reduce:transition-none",
              isLoading && "opacity-60",
            )}
          >
            {data.items.map((item) => (
              <PaymentRow
                key={item.paymentId}
                item={item}
                readAt={state.readAt}
              />
            ))}
          </ul>
        )}
      </div>

      {showPager && data && (
        <nav
          aria-label={t("history.pagerLabel")}
          className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3"
        >
          <Button
            type="button"
            variant="outline"
            disabled={basePage <= 1}
            onClick={() => goToPage(basePage - 1)}
            className={touchButtonClass}
          >
            <ArrowLeft aria-hidden="true" />
            {t("history.previous")}
          </Button>
          <p className="text-xs font-bold text-slate-600">
            {t("history.page", { page: data.page, count: pageCount })}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={basePage >= pageCount}
            onClick={() => goToPage(basePage + 1)}
            className={touchButtonClass}
          >
            {t("history.next")}
            <ArrowRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  );
}
