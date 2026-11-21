import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viCommon from "@/messages/vi/common.json";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function countTag(source: string, tag: "h1" | "h2") {
  return (source.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;
}

describe("public page heading hierarchy", () => {
  it("keeps branding and mobile account identity outside the heading outline", () => {
    const headerSource = readSource("components/ui/header.tsx");
    const mobileAccountSheetSource = readSource(
      "components/ui/mobile-account-sheet.tsx",
    );

    expect(countTag(headerSource, "h1")).toBe(0);
    expect(countTag(mobileAccountSheetSource, "h1")).toBe(0);
    // English localization U1 (Owner chấp nhận ngoại lệ G7, 2026-11-22): chữ nằm trong catalog; kiểm khóa trong mã nguồn
    // và giá trị tiếng Việt đúng nguyên văn cũ.
    expect(mobileAccountSheetSource).toContain(
      '<SheetTitle className="sr-only">{t("mobileMenu.title")}</SheetTitle>',
    );
    expect(viCommon.mobileMenu.title).toBe("Điều hướng tài khoản");
    expect(mobileAccountSheetSource).toContain(
      'aria-label={t("mobileMenu.open")}',
    );
    expect(viCommon.mobileMenu.open).toBe("Mở điều hướng tài khoản");
    expect(headerSource).toContain('src="/brand/vocaspace-logo.svg"');
    expect(headerSource).toContain('alt="VocaSpace"');
    expect(mobileAccountSheetSource).toContain(
      '<p className="truncate font-semibold text-slate-900">',
    );
    expect(mobileAccountSheetSource).toContain(
      '{fullName || t("mobileMenu.guestName")}',
    );
    expect(viCommon.mobileMenu.guestName).toBe("Khách VocaSpace");
  });

  it("keeps exactly one homepage h1, in the hero", () => {
    const homeSources = [
      "app/(client)/page.tsx",
      "app/(client)/_components/home/HeroPractice.tsx",
      "app/(client)/_components/home/HomeHowItWorks.tsx",
      "app/(client)/_components/home/HomeTestimonials.tsx",
      "app/(client)/_components/home/HomeTeacherSection.tsx",
      "app/(client)/_components/home/HomeFooter.tsx",
      "app/(client)/_components/PublicCourseHighlights.tsx",
    ];

    expect(countTag(readSource("app/(client)/_components/home/HomeHero.tsx"), "h1")).toBe(1);
    homeSources.forEach((path) => expect(countTag(readSource(path), "h1")).toBe(0));
  });
});
