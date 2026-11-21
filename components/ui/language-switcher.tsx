"use client";

import { useId, useTransition } from "react";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  /** Hiện chữ "Ngôn ngữ" trước các lựa chọn (menu mobile); ở header desktop nhãn chỉ dành cho trình đọc màn hình. */
  showLabel?: boolean;
};

/**
 * Bộ chọn VI/EN của English localization U1 (AC3, quyết định 7). Header chỉ render khi cờ giao diện tiếng Anh bật.
 * Theo product language: dạng tab, mục đang chọn dùng chữ Route Blue và gạch chân, không phải hộp segmented.
 * Đổi ngôn ngữ chờ action ghi cookie xong mới làm mới route; URL giữ nguyên.
 */
export default function LanguageSwitcher({ className, showLabel = false }: LanguageSwitcherProps) {
  const labelId = useId();
  const locale = useLocale();
  const t = useTranslations("common.languageSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === locale || isPending) return;
    startTransition(async () => {
      // Request hỏng (mất mạng) thì giữ nguyên trang như khi action từ chối, không để lỗi lên error boundary.
      const result = await setLocale(next).catch(() => ({ ok: false }));
      if (result.ok) router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={isPending || undefined}
      className={cn("flex items-center gap-1 text-slate-500", className)}
    >
      <Languages aria-hidden="true" className="size-4 shrink-0" />
      <span id={labelId} className={showLabel ? "mr-auto pl-1 text-sm font-medium text-slate-700" : "sr-only"}>
        {t("label")}
      </span>
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            // Tên đầy đủ bằng chính ngôn ngữ đó, mở đầu bằng mã đang hiển thị để khớp nhãn nhìn thấy (WCAG 2.5.3).
            aria-label={`${code.toUpperCase()} (${LOCALE_NAMES[code]})`}
            aria-pressed={active}
            disabled={isPending}
            onClick={() => choose(code)}
            className={cn(
              "relative inline-flex min-h-10 min-w-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11 cursor-pointer items-center justify-center rounded-[8px] px-2 text-sm font-semibold transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route disabled:cursor-wait motion-reduce:transition-none",
              active
                ? "text-route after:absolute after:inset-x-2 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-route"
                : "text-slate-600 hover:bg-route-quiet hover:text-slate-900",
            )}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
