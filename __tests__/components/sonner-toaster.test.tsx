import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";

vi.mock("sonner", () => ({
  Toaster: ({
    theme,
    position,
    richColors,
    className,
  }: {
    theme?: string;
    position?: string;
    richColors?: boolean;
    className?: string;
  }) => (
    <div
      data-class-name={className}
      data-position={position}
      data-rich-colors={richColors ? "true" : "false"}
      data-theme={theme}
    />
  ),
}));

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const countToasterTags = (source: string) =>
  (source.match(/<Toaster\b/g) ?? []).length;

describe("shared Sonner toaster", () => {
  it("defaults to the light theme", () => {
    const html = renderToStaticMarkup(
      <Toaster position="top-right" richColors />,
    );

    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-position="top-right"');
    expect(html).toContain('data-rich-colors="true"');
    expect(html).toContain('data-class-name="toaster group"');
  });

  it("forwards an explicit theme prop for future reuse", () => {
    const html = renderToStaticMarkup(
      <Toaster position="top-right" richColors theme="dark" />,
    );

    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-position="top-right"');
    expect(html).toContain('data-rich-colors="true"');
  });

  it("keeps one shared toaster and does not depend on system theme", () => {
    const rootLayout = readSource("app/layout.tsx");
    const clientLayout = readSource("app/(client)/layout.tsx");
    const teacherLayout = readSource("app/(teacher)/layout.tsx");
    const adminLayout = readSource("app/admin/layout.tsx");
    const sharedToaster = readSource("components/ui/sonner.tsx");

    expect(sharedToaster).not.toContain("next-themes");
    expect(sharedToaster).not.toContain("useTheme");
    expect(sharedToaster).not.toContain('theme="system"');
    expect(sharedToaster).toContain('theme = "light"');

    expect(rootLayout).toContain("@/components/ui/sonner");
    expect(rootLayout).toContain("<Toaster position=\"top-right\" richColors />");
    expect(countToasterTags(rootLayout)).toBe(1);

    expect(clientLayout).not.toContain("@/components/ui/sonner");
    expect(teacherLayout).not.toContain("@/components/ui/sonner");
    expect(adminLayout).not.toContain("@/components/ui/sonner");
    expect(countToasterTags(clientLayout)).toBe(0);
    expect(countToasterTags(teacherLayout)).toBe(0);
    expect(countToasterTags(adminLayout)).toBe(0);
  });
});
