"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/config";

// Layout gốc chỉ render `<html lang>` một lần và được giữ nguyên khi điều hướng client (U9 H4), nên mỗi khu vực tự đặt lại
// `lang` theo ngôn ngữ mà server đã chọn cho request của khu đó.
export default function DocumentLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
