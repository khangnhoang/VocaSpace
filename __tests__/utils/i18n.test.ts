import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isEnglishUiEnabled, LOCALES } from "@/lib/i18n/config";
import { formatDateTime, formatNumber, formatVnd } from "@/lib/i18n/format";
import { parseAcceptLanguage, resolveLocale } from "@/lib/i18n/resolve-locale";

// Test plan:
// - Mục tiêu: English localization U1 - chọn ngôn ngữ (AC1-AC3), định dạng theo ngôn ngữ (AC7) và độ khớp catalog (AC6).
// - Loại test: hàm thuần và đọc tệp catalog thật trong messages/.
// - Case: cờ tắt bỏ qua cookie và header; cookie hợp lệ thắng header; cookie lạ về tiếng Việt; trọng số q, mã vùng, q=0,
//   header thiếu hay không có ngôn ngữ hỗ trợ; VND giữ nguyên ở cả hai ngôn ngữ; hai bộ catalog cùng khóa ở mọi namespace.

describe("parseAcceptLanguage", () => {
  it.each([
    ["en-US,en;q=0.9,vi;q=0.5", "en"],
    ["vi-VN,vi;q=0.9,en;q=0.8", "vi"],
    ["fr-FR,en;q=0.3,vi;q=0.7", "vi"],
    ["en;q=0,vi;q=0.1", "vi"],
    ["EN-gb", "en"],
    ["fr,de", null],
    ["", null],
    [null, null],
    ["en;q=abc,vi;q=0.2", "vi"],
  ] as const)("reads %j as %j", (header, expected) => {
    expect(parseAcceptLanguage(header)).toBe(expected);
  });

  it("keeps header order when weights tie", () => {
    expect(parseAcceptLanguage("vi,en")).toBe("vi");
    expect(parseAcceptLanguage("en,vi")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("returns Vietnamese while the flag is off, whatever the cookie or header says", () => {
    expect(resolveLocale({ enabled: false, cookieValue: "en", acceptLanguage: "en-US,en;q=0.9" })).toBe("vi");
  });

  it("lets a valid cookie win over the header", () => {
    expect(resolveLocale({ enabled: true, cookieValue: "vi", acceptLanguage: "en-US" })).toBe("vi");
    expect(resolveLocale({ enabled: true, cookieValue: "en", acceptLanguage: "vi-VN" })).toBe("en");
  });

  it("falls back to Vietnamese for an unknown cookie value instead of the header", () => {
    expect(resolveLocale({ enabled: true, cookieValue: "fr", acceptLanguage: "en-US" })).toBe("vi");
    expect(resolveLocale({ enabled: true, cookieValue: "", acceptLanguage: "en-US" })).toBe("vi");
  });

  it("uses the header without a cookie, then Vietnamese", () => {
    expect(resolveLocale({ enabled: true, cookieValue: undefined, acceptLanguage: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveLocale({ enabled: true, cookieValue: undefined, acceptLanguage: "fr" })).toBe("vi");
    expect(resolveLocale({ enabled: true, cookieValue: undefined, acceptLanguage: null })).toBe("vi");
  });
});

describe("isEnglishUiEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [undefined, false],
    ["0", false],
    ["true", false],
    ["1", true],
  ] as const)("reads ENGLISH_UI_ENABLED=%j as %j", (value, expected) => {
    if (value === undefined) vi.stubEnv("ENGLISH_UI_ENABLED", undefined);
    else vi.stubEnv("ENGLISH_UI_ENABLED", value);
    expect(isEnglishUiEnabled()).toBe(expected);
  });
});

describe("format helpers", () => {
  it("formats Vietnamese exactly like the existing vi-VN calls", () => {
    expect(formatNumber("vi", 1234567)).toBe((1234567).toLocaleString("vi-VN"));
    expect(formatVnd("vi", 159000)).toBe(`${(159000).toLocaleString("vi-VN")} ₫`);
  });

  it("keeps VND in English and only changes separators", () => {
    expect(formatNumber("en", 1234567)).toBe("1,234,567");
    expect(formatVnd("en", 159000)).toBe("159,000 ₫");
  });

  it("formats dates for each locale", () => {
    const date = new Date("2026-11-22T03:00:00Z");
    const options = { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" } as const;
    expect(formatDateTime("vi", date, options)).toBe(new Intl.DateTimeFormat("vi-VN", options).format(date));
    expect(formatDateTime("en", date, options)).toBe("November 22, 2026");
  });
});

describe("message catalogs", () => {
  const root = path.join(process.cwd(), "messages");
  const keysOf = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
      : [prefix];
  const namespaces = (locale: string) => readdirSync(path.join(root, locale)).filter((file) => file.endsWith(".json")).sort();
  const read = (locale: string, file: string) => JSON.parse(readFileSync(path.join(root, locale, file), "utf8"));

  it("has the same namespace files for every locale", () => {
    for (const locale of LOCALES) expect(namespaces(locale)).toEqual(namespaces("vi"));
  });

  it.each(namespaces("vi"))("has the same keys in every locale for %s", (file) => {
    const expected = keysOf(read("vi", file)).sort();
    for (const locale of LOCALES) expect(keysOf(read(locale, file)).sort()).toEqual(expected);
  });

  it("has no empty translation", () => {
    for (const locale of LOCALES) {
      for (const file of namespaces(locale)) {
        const data = read(locale, file);
        for (const key of keysOf(data)) {
          const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], data);
          expect(typeof value === "string" && value.trim().length > 0, `${locale}/${file}: ${key}`).toBe(true);
        }
      }
    }
  });
});
