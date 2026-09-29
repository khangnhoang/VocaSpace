import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "@/components/ui/button";

// Test plan:
// - Mục tiêu: khóa semantic variants, geometry và interaction contract của shared Button UI-3.
// - Loại test: component static render và source contract trong hạ tầng Vitest hiện có.
// - Đối tượng: shared Button, CVA variants và coarse-pointer treatment trong global CSS.
// - Case thành công: default/Compact/Comfortable/nested icon geometry đúng; destructive strong và quiet tách biệt; data attributes phản ánh contract.
// - Case thất bại: legacy transition-all/pressed translation quay lại hoặc touch icon-only mất nền/target rõ ràng.
// - Bảo mật/phân quyền: không áp dụng; component không sở hữu dữ liệu hay authorization.
// - Ổn định/resilience: alias secondary còn tương thích, disabled props và accessible name vẫn được forward.
// - Invariant cần giữ: semantic emphasis độc lập với geometry; 24px chỉ có qua xs/icon-xs; focus-visible dùng Route Blue.
// - Kết quả verify gần nhất: passed trong focused bundle (7 files / 96 tests) và full Vitest (71 files / 602 tests) của UI-3 CP2.

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("shared Button contract", () => {
  it("defaults to the 36px ordinary action geometry", () => {
    const html = renderToStaticMarkup(<Button>Lưu thay đổi</Button>);

    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain("h-9");
    expect(html).toContain("bg-action");
    expect(html).toContain("rounded-[12px]");
    expect(html).toContain("focus-visible:ring-route");
  });

  it("keeps geometry choices independent from semantic variants", () => {
    expect(buttonVariants({ size: "sm", variant: "outline" })).toContain("h-8");
    expect(buttonVariants({ size: "lg", variant: "default" })).toContain("h-11");
    expect(buttonVariants({ size: "xs", variant: "ghost" })).toContain("h-6");
    expect(buttonVariants({ size: "icon-xs", variant: "destructive-quiet" })).toContain("size-6");

    expect(buttonVariants({ variant: "destructive" })).toContain("bg-correction");
    expect(buttonVariants({ variant: "destructive-quiet" })).toContain("text-correction");
    expect(buttonVariants({ variant: "destructive-quiet" })).not.toContain("bg-correction text-white");
  });

  it("marks icon-only geometry and forwards accessibility state", () => {
    const html = renderToStaticMarkup(
      <Button size="icon-sm" variant="ghost" aria-label="Tùy chọn" aria-busy="true" disabled>
        <svg aria-hidden="true" />
      </Button>,
    );

    expect(html).toContain('data-icon-only="true"');
    expect(html).toContain('data-size="icon-sm"');
    expect(html).toContain('aria-label="Tùy chọn"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
  });

  it("retains the secondary alias as a compatibility outline", () => {
    const secondary = buttonVariants({ variant: "secondary" });

    expect(secondary).toContain("border-border");
    expect(secondary).toContain("bg-background");
    expect(secondary).not.toContain("bg-secondary");
  });

  it("uses bounded motion and visible touch affordances", () => {
    const classes = buttonVariants();
    const globalCss = readSource("app/globals.css");

    expect(classes).toContain("duration-[120ms]");
    expect(classes).toContain("motion-reduce:transition-none");
    expect(classes).not.toContain("transition-all");
    expect(classes).not.toContain("translate-y");
    expect(globalCss).toContain("@media (not (hover: hover)), (not (pointer: fine))");
    expect(globalCss).toContain('[data-icon-only="true"]');
    expect(globalCss).toContain('[data-variant="destructive-quiet"]');
    expect(globalCss).toContain("min-width: 44px");
    expect(globalCss).toContain(':not([data-size="icon-xs"])');
  });
});
