import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function countTag(source: string, tag: "h1" | "h2") {
  return (source.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;
}

describe("public page heading hierarchy", () => {
  it("keeps branding and mobile account identity outside the heading outline", () => {
    const headerSource = readSource("components/ui/header.tsx");

    expect(countTag(headerSource, "h1")).toBe(0);
    expect(headerSource).toContain(
      '<SheetTitle className="sr-only">Điều hướng tài khoản</SheetTitle>',
    );
    expect(headerSource).toContain(
      '<SheetTrigger aria-label="Mở điều hướng tài khoản">',
    );
    expect(headerSource).toContain(
      '<span className="font-bold text-xl text-white">VocaSpace</span>',
    );
    expect(headerSource).toContain('<p className="font-bold">Nguyễn Văn A</p>');
  });

  it("keeps one primary homepage hero heading and makes the alternate slide secondary", () => {
    const homepageSource = readSource("app/(client)/page.tsx");

    expect(countTag(homepageSource, "h1")).toBe(1);
    expect(homepageSource).toContain(
      "<h2 className=\"text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight\">",
    );
  });
});
