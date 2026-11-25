"use client";

import Image from "next/image";
import { Copy, Check, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatCheckoutAmount } from "@/lib/payment-history-format";
import { CheckoutResponse } from "@/lib/schemas/payment";

interface PaymentStageQrProps {
  paymentData: CheckoutResponse | null;
  timeLeft: number;
  copiedField: string | null;
  isSuccess: boolean;
  isExpired: boolean;
  isCancelling: boolean;
  formatTime: (seconds: number) => string;
  onCopy: (text: string, field: string) => void;
  onCancelPayment: () => void;
}

export default function PublicCoursePaymentStageQr({
  paymentData,
  timeLeft,
  copiedField,
  isSuccess,
  isExpired,
  isCancelling,
  formatTime,
  onCopy,
  onCancelPayment,
}: PaymentStageQrProps) {
  const t = useTranslations("payments.checkout.qr");
  const locale = useLocale() as Locale;

  return (
    <div className="w-full shrink-0 flex flex-col md:flex-row">
      <div className="w-full md:w-[45%] bg-linear-to-br from-blue-400 to-blue-600 p-8 flex flex-col items-center justify-center relative">
        <div className="text-white font-bold text-xl mb-6 tracking-wide drop-shadow-sm">
          {t("title")}
        </div>

        <div className="relative mx-auto w-64 h-64 bg-white rounded-2xl shadow-xl p-3 overflow-hidden flex items-center justify-center">
          {isSuccess ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500 text-white z-20">
              <Check size={56} className="mb-2 animate-bounce" />
              <p className="font-bold text-lg">{t("success")}</p>
            </div>
          ) : isExpired ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 backdrop-blur-sm px-6 text-center">
              <p className="font-medium mb-3">{t("expired")}</p>

              <button
                onClick={onCancelPayment}
                disabled={isCancelling}
                className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-full font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60"
              >
                <RefreshCw size={16} />
                {isCancelling ? t("processing") : t("cancel")}
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

              <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-tr-lg" />
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_15px_3px_rgba(96,165,250,0.7)] animate-[scan_2.5s_ease-in-out_infinite]" />
            </>
          )}
        </div>
      </div>

      <div className="w-full md:w-[55%] bg-white p-6 md:p-8 flex flex-col justify-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-6 hidden md:block">
          {t("orderTitle")}
        </h3>

        {paymentData && (
          <div className="space-y-4 flex-1">
            {[
              {
                label: t("account"),
                value: paymentData.accountNumber,
                field: "account",
              },
              {
                label: t("amount"),
                value: formatCheckoutAmount(locale, paymentData.amount, " VNĐ"),
                field: "amount",
              },
              {
                label: t("message"),
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
                    onClick={() => onCopy(item.value, item.field)}
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
              className={`font-mono text-3xl font-bold tracking-widest ${
                isExpired ? "text-slate-400" : "text-blue-600"
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          <button
            onClick={onCancelPayment}
            disabled={isCancelling || isSuccess}
            className="flex-[1.2] bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
          >
            {isCancelling ? t("cancelling") : t("cancelButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
