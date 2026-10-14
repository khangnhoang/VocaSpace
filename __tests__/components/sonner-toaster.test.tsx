import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";

const navigation = vi.hoisted(() => ({ pathname: "/" as string | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

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
  beforeEach(() => {
    navigation.pathname = "/";
  });

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

  it.each([
    ["/admin", "dark"],
    ["/admin/courses", "dark"],
    ["/admin/user-management", "dark"],
    ["/courses", "light"],
    ["/", "light"],
    ["/administrator", "light"],
    ["/administrator/courses", "light"],
    ["/teacher/admin", "light"],
    [null, "light"],
  ])("picks the theme from the route %s -> %s", (pathname, theme) => {
    navigation.pathname = pathname;

    const html = renderToStaticMarkup(<Toaster position="top-right" richColors />);

    expect(html).toContain(`data-theme="${theme}"`);
    expect(html).toContain('data-rich-colors="true"');
    expect(html).toContain('data-position="top-right"');
  });

  it("lets an explicit theme prop win over the route in both directions", () => {
    navigation.pathname = "/admin/courses";
    expect(renderToStaticMarkup(<Toaster theme="light" />)).toContain('data-theme="light"');

    navigation.pathname = "/courses";
    expect(renderToStaticMarkup(<Toaster theme="dark" />)).toContain('data-theme="dark"');
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
